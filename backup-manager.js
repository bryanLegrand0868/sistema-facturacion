const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const db = require('./db');

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
                        try {
                            const stat = fs.statSync(fullPath);
                            if (stat.isDirectory()) {
                                // Verificar si es un directorio válido y accesible
                                fs.accessSync(fullPath, fs.constants.W_OK);
                                usbFound = fullPath;
                                break;
                            }
                        } catch (err) {
                            // No es accesible, continuar
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
     * Generar SQL para backup de la base de datos
     */
    async generateBackupSQL() {
        const dbName = process.env.DB_NAME || 'sistema_facturacion';
        let sqlContent = `-- Backup de ${dbName}\n`;
        sqlContent += `-- Fecha: ${new Date().toLocaleString('es-GT')}\n\n`;
        sqlContent += `SET FOREIGN_KEY_CHECKS=0;\n\n`;

        try {
            // Obtener todas las tablas
            const [tables] = await db.query('SHOW TABLES');
            const tableKey = `Tables_in_${dbName}`;

            for (const tableRow of tables) {
                const tableName = tableRow[tableKey];

                // Obtener estructura de la tabla
                const [createTableResult] = await db.query(`SHOW CREATE TABLE ${tableName}`);
                const createTableSQL = createTableResult[0]['Create Table'];

                sqlContent += `-- Estructura para tabla ${tableName}\n`;
                sqlContent += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
                sqlContent += `${createTableSQL};\n\n`;

                // Obtener datos de la tabla
                const [rows] = await db.query(`SELECT * FROM ${tableName}`);

                if (rows.length > 0) {
                    sqlContent += `-- Datos para tabla ${tableName}\n`;

                    // Obtener nombres de columnas
                    const [columns] = await db.query(`SHOW COLUMNS FROM ${tableName}`);
                    const columnNames = columns.map(col => `\`${col.Field}\``).join(', ');

                    // Insertar datos en lotes de 100 filas
                    for (let i = 0; i < rows.length; i += 100) {
                        const batch = rows.slice(i, i + 100);
                        const values = batch.map(row => {
                            const vals = Object.values(row).map(val => {
                                if (val === null) return 'NULL';
                                if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
                                if (typeof val === 'string') return `'${val.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
                                if (Buffer.isBuffer(val)) return `'${val.toString('hex')}'`;
                                return val;
                            }).join(', ');
                            return `(${vals})`;
                        }).join(',\n    ');

                        sqlContent += `INSERT INTO \`${tableName}\` (${columnNames}) VALUES\n    ${values};\n`;
                    }

                    sqlContent += '\n';
                }
            }

            sqlContent += `SET FOREIGN_KEY_CHECKS=1;\n`;

            return sqlContent;
        } catch (error) {
            console.error('Error generando SQL de backup:', error);
            throw new Error(`Error al generar backup SQL: ${error.message}`);
        }
    }

    /**
     * Crear un backup de la base de datos
     * @param {string} type - Tipo de backup ('manual' o 'auto')
     * @param {boolean} saveToFile - Si se debe guardar en archivo (default: true)
     */
    async createBackup(type = 'manual', saveToFile = true) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' +
                         new Date().toLocaleTimeString('es-GT', { hour12: false }).replace(/:/g, '-');
        const filename = `backup_${type}_${timestamp}.sql`;

        try {
            // Generar SQL del backup
            const sqlContent = await this.generateBackupSQL();

            if (saveToFile) {
                const filepath = path.join(this.backupDir, filename);

                // Guardar en archivo
                fs.writeFileSync(filepath, sqlContent, 'utf8');
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
            } else {
                // Retornar el SQL sin guardar en archivo (para descarga directa)
                return {
                    success: true,
                    filename,
                    sqlContent,
                    size: Buffer.byteLength(sqlContent, 'utf8'),
                    date: new Date()
                };
            }
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

        try {
            // Leer el archivo SQL
            const sqlContent = fs.readFileSync(filepath, 'utf8');

            // Dividir en declaraciones SQL individuales
            const statements = sqlContent
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

            // Ejecutar cada declaración
            for (const statement of statements) {
                try {
                    await db.query(statement);
                } catch (error) {
                    console.error('Error ejecutando statement:', statement.substring(0, 100));
                    console.error(error);
                    // Continuar con las demás declaraciones
                }
            }

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
