const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const cron = require('node-cron');

require('dotenv').config();

class BackupManager {
    constructor() {
        this.backupDir = path.join(__dirname, 'backups');
        this.usbDir = null;
        this.maxBackups = 10;

        // Crear directorio de backups si no existe
        this.ensureBackupDir();

        // Iniciar backup automático semanal (cada domingo a las 2 AM)
        this.scheduleWeeklyBackup();

        // Detectar USB cada 30 segundos
        this.detectUSB();
        setInterval(() => this.detectUSB(), 30000);
    }

    /**
     * Asegurar que el directorio de backups existe
     */
    ensureBackupDir() {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
            console.log(`Directorio de backups creado: ${this.backupDir}`);
        }
    }

    /**
     * Programar backup automático semanal
     */
    scheduleWeeklyBackup() {
        // Ejecutar cada domingo a las 2:00 AM
        cron.schedule('0 2 * * 0', async () => {
            console.log('Ejecutando backup automático semanal...');
            try {
                const result = await this.createBackup('auto');
                console.log('Backup automático completado:', result.filename);

                // Limpiar backups antiguos
                await this.cleanOldBackups();
            } catch (error) {
                console.error('Error en backup automático:', error);
            }
        });

        console.log('Backup automático semanal programado (Domingos 2:00 AM)');
    }

    /**
     * Detectar dispositivos USB montados
     */
    async detectUSB() {
        try {
            // En Linux, buscar en /media y /mnt
            const mediaPaths = ['/media', '/mnt'];
            let usbFound = null;

            for (const mediaPath of mediaPaths) {
                if (fs.existsSync(mediaPath)) {
                    const dirs = fs.readdirSync(mediaPath);

                    for (const dir of dirs) {
                        const fullPath = path.join(mediaPath, dir);
                        const stat = fs.statSync(fullPath);

                        if (stat.isDirectory()) {
                            // Verificar si es un directorio válido y accesible
                            try {
                                fs.accessSync(fullPath, fs.constants.W_OK);
                                usbFound = fullPath;
                                break;
                            } catch (err) {
                                // No es accesible
                            }
                        }
                    }
                }

                if (usbFound) break;
            }

            if (usbFound && usbFound !== this.usbDir) {
                this.usbDir = usbFound;
                console.log(`USB detectado: ${this.usbDir}`);
            } else if (!usbFound && this.usbDir) {
                console.log('USB removido');
                this.usbDir = null;
            }
        } catch (error) {
            console.error('Error detectando USB:', error);
        }
    }

    /**
     * Crear un backup de la base de datos
     * @param {string} type - Tipo de backup ('manual' o 'auto')
     */
    async createBackup(type = 'manual') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' +
                         new Date().toLocaleTimeString('es-GT', { hour12: false }).replace(/:/g, '-');
        const filename = `backup_${type}_${timestamp}.sql`;
        const filepath = path.join(this.backupDir, filename);

        // Obtener credenciales de la base de datos
        const dbHost = process.env.DB_HOST || 'localhost';
        const dbUser = process.env.DB_USER || 'root';
        const dbPassword = process.env.DB_PASSWORD || '';
        const dbName = process.env.DB_NAME || 'sistema_facturacion';

        // Construir comando mysqldump
        const command = `mysqldump -h ${dbHost} -u ${dbUser} ${dbPassword ? `-p${dbPassword}` : ''} ${dbName} > "${filepath}"`;

        try {
            await execPromise(command);
            console.log(`Backup creado exitosamente: ${filename}`);

            // Si hay USB conectado, copiar también ahí
            if (this.usbDir) {
                await this.copyToUSB(filepath, filename);
            }

            return {
                success: true,
                filename,
                filepath,
                size: fs.statSync(filepath).size,
                date: new Date()
            };
        } catch (error) {
            console.error('Error creando backup:', error);
            throw new Error(`Error al crear backup: ${error.message}`);
        }
    }

    /**
     * Copiar backup a USB
     */
    async copyToUSB(sourceFile, filename) {
        try {
            const usbBackupDir = path.join(this.usbDir, 'backups_facturacion');

            // Crear directorio en USB si no existe
            if (!fs.existsSync(usbBackupDir)) {
                fs.mkdirSync(usbBackupDir, { recursive: true });
            }

            const destFile = path.join(usbBackupDir, filename);
            fs.copyFileSync(sourceFile, destFile);
            console.log(`Backup copiado a USB: ${destFile}`);

            return true;
        } catch (error) {
            console.error('Error copiando a USB:', error);
            throw new Error(`Error al copiar a USB: ${error.message}`);
        }
    }

    /**
     * Restaurar un backup
     */
    async restoreBackup(filename) {
        const filepath = path.join(this.backupDir, filename);

        if (!fs.existsSync(filepath)) {
            throw new Error('Archivo de backup no encontrado');
        }

        // Obtener credenciales de la base de datos
        const dbHost = process.env.DB_HOST || 'localhost';
        const dbUser = process.env.DB_USER || 'root';
        const dbPassword = process.env.DB_PASSWORD || '';
        const dbName = process.env.DB_NAME || 'sistema_facturacion';

        // Construir comando mysql para restaurar
        const command = `mysql -h ${dbHost} -u ${dbUser} ${dbPassword ? `-p${dbPassword}` : ''} ${dbName} < "${filepath}"`;

        try {
            await execPromise(command);
            console.log(`Backup restaurado exitosamente: ${filename}`);

            return {
                success: true,
                filename,
                date: new Date()
            };
        } catch (error) {
            console.error('Error restaurando backup:', error);
            throw new Error(`Error al restaurar backup: ${error.message}`);
        }
    }

    /**
     * Obtener lista de backups disponibles
     */
    getBackupList() {
        try {
            const files = fs.readdirSync(this.backupDir);
            const backups = files
                .filter(file => file.endsWith('.sql'))
                .map(file => {
                    const filepath = path.join(this.backupDir, file);
                    const stats = fs.statSync(filepath);

                    return {
                        filename: file,
                        size: stats.size,
                        date: stats.mtime,
                        sizeFormatted: this.formatBytes(stats.size)
                    };
                })
                .sort((a, b) => b.date - a.date); // Ordenar por fecha descendente

            return backups;
        } catch (error) {
            console.error('Error obteniendo lista de backups:', error);
            return [];
        }
    }

    /**
     * Limpiar backups antiguos (mantener solo los últimos 10)
     */
    async cleanOldBackups() {
        try {
            const backups = this.getBackupList();

            if (backups.length > this.maxBackups) {
                const toDelete = backups.slice(this.maxBackups);

                for (const backup of toDelete) {
                    const filepath = path.join(this.backupDir, backup.filename);
                    fs.unlinkSync(filepath);
                    console.log(`Backup antiguo eliminado: ${backup.filename}`);
                }

                return {
                    success: true,
                    deleted: toDelete.length
                };
            }

            return {
                success: true,
                deleted: 0
            };
        } catch (error) {
            console.error('Error limpiando backups antiguos:', error);
            throw new Error(`Error al limpiar backups: ${error.message}`);
        }
    }

    /**
     * Eliminar un backup específico
     */
    async deleteBackup(filename) {
        try {
            const filepath = path.join(this.backupDir, filename);

            if (!fs.existsSync(filepath)) {
                throw new Error('Archivo de backup no encontrado');
            }

            fs.unlinkSync(filepath);
            console.log(`Backup eliminado: ${filename}`);

            return {
                success: true,
                filename
            };
        } catch (error) {
            console.error('Error eliminando backup:', error);
            throw new Error(`Error al eliminar backup: ${error.message}`);
        }
    }

    /**
     * Formatear bytes a tamaño legible
     */
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    /**
     * Obtener estado del USB
     */
    getUSBStatus() {
        return {
            connected: !!this.usbDir,
            path: this.usbDir
        };
    }
}

// Crear instancia singleton
const backupManager = new BackupManager();

module.exports = backupManager;
