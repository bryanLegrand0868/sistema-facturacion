const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const app = express();
const db = require('./db');
const { spawn } = require('node:child_process');
const http = require('http');

// Crear directorios necesarios
const createRequiredDirectories = () => {
    const directories = [
        path.join(__dirname, 'public'),
        path.join(__dirname, 'public', 'uploads')
    ];

    directories.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Directorio creado: ${dir}`);
        }
    });
};

// Crear directorios al iniciar
createRequiredDirectories();

// Configuración
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Configurar body-parser antes de las rutas
app.use(express.json()); // Para procesar application/json
app.use(express.urlencoded({ extended: true })); // Para procesar application/x-www-form-urlencoded

// Rutas
const productosRoutes = require('./routes/productos');
const clientesRoutes = require('./routes/clientes');
const facturasRoutes = require('./routes/facturas');
const configuracionRoutes = require('./routes/configuracion');
const ventasRoutes = require('./routes/ventas');
const { resolve } = require('node:path');

// Ruta principal
app.get('/', (req, res) => {
    res.render('index');
});

// Usar las rutas
app.use('/productos', productosRoutes);
app.use('/api/productos', productosRoutes);
app.use('/clientes', clientesRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/facturas', facturasRoutes);
app.use('/', facturasRoutes);
app.use('/configuracion', configuracionRoutes);
app.use('/ventas', ventasRoutes);

// Ruta para la página de productos
app.get('/productos', async (req, res) => {
    try {
        const [productos] = await db.query('SELECT * FROM productos ORDER BY nombre');
        res.render('productos', { productos: productos || [] });
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).render('error', {
            error: {
                message: 'Error al obtener productos',
                stack: error.stack
            }
        });
    }
});

// Manejo de errores 404
app.use((req, res, next) => {
    console.log('404 - Ruta no encontrada:', req.url);
    res.status(404).render('404');
});

// Manejo de errores generales
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;

function abrirNavegador(url) {
    try {
        if (process.platform === 'win32') {
            //iniciar la URL en windows
            const child = spawn('cmd', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore' });
            child.unref();
        } else if (process.platform === 'darwin') {
            //para macOS
            const child = spawn('open', [url], { detached: true, stdio: 'ignore' });
            child.unref();
        } else {
            //para linux
            const child = spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });
            child.unref();
        }

    } catch (e) {
        console.error('Error al intentar abrir el navegador', e.message);
    }
}

function checkUrlUp(url, timeoutMs = 5000) {
    return new Promise((resolve) => {
        const req = http.get(url, (res) => {
            // Si responde cualquier status, consideramos ok
            res.resume();
            resolve(true);
        });
        req.on('error', () => resolve(false));
        // timeout de la petición
        req.setTimeout(timeoutMs, () => {
            req.destroy();
            resolve(false);
        });
    });
}
async function waitForServerAndOpen(url, maxRetries = 25) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const up = await checkUrlUp(url, 2000); // 2s timeout por intento
        if (up) {
            console.log(`Servidor respondió en intento ${attempt + 1}. Abriendo navegador...`);
            abrirNavegador(url);
            return true;
        }
        const delay = 300 + attempt * 200; // backoff ligero
        console.log(`Intento ${attempt + 1} fallido. Reintentando en ${delay} ms...`);
        await new Promise(r => setTimeout(r, delay));
    }
    console.error('Servidor no respondió después de varios intentos. No se abrió el navegador.');
    return false;
}

// Verificar la conexión a la base de datos antes de iniciar el servidor
async function startServer() {
    try {
        const connection = await db.getConnection();
        connection.release();
        console.log('Conexión exitosa a la base de datos');

        // Iniciar el servidor solo si la conexión a la base de datos es exitosa
        app.listen(PORT, async () => {
            const url = `http://localhost:${PORT}`;
            console.log(`Servidor corriendo en http://localhost:${PORT}`);

            await waitForServerAndOpen(url, 25); // hasta 25 intentos
        });
    } catch (err) {
        console.error('Error al conectar a la base de datos:', err);
        process.exit(1); // Salir si no podemos conectar a la base de datos
    }
}

startServer(); 