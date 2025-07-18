const mysql = require('mysql2');
env = require('dotenv').config();

const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'bl123',
    database: 'sistema_facturacion',
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0
}).promise();

// Verificar la conexión
pool.getConnection()
    .then(connection => {
        console.log('Conexión exitosa a la base de datos');
        connection.release();
    })
    .catch(err => {
        console.error('Error al conectar a la base de datos:', err);
    });

module.exports = pool; 