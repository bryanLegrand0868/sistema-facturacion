const mysql = require('mysql2');
env = require('dotenv').config();

const connection = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'bl123',
    database: 'sistema_facturacion',
});

connection.connect(error => {
    if (error) throw error;
    console.log('Conexión exitosa a la base de datos.');
});

module.exports = connection; 