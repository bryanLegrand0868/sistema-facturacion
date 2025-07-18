const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const app = express();
const db = require('./db');

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
app.use('/api/facturas', facturasRoutes);
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

// Verificar la conexión a la base de datos antes de iniciar el servidor
async function startServer() {
    try {
        const connection = await db.getConnection();
        connection.release();
        console.log('Conexión exitosa a la base de datos');
        
        // Iniciar el servidor solo si la conexión a la base de datos es exitosa
        app.listen(PORT, () => {
            console.log(`Servidor corriendo en http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Error al conectar a la base de datos:', err);
        process.exit(1); // Salir si no podemos conectar a la base de datos
    }
}

startServer(); 