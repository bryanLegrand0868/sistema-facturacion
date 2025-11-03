CREATE DATABASE IF NOT EXISTS sistema_facturacion;
USE sistema_facturacion;

CREATE TABLE IF NOT EXISTS productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    precio_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
    precio_unidad DECIMAL(10,2) NOT NULL DEFAULT 0,
    precio_libra DECIMAL(10,2) NOT NULL DEFAULT 0,
    stock_actual DECIMAL(10,2) NOT NULL DEFAULT 0,
    stock_minimo DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clientes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    direccion TEXT,
    telefono VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS facturas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cliente_id INT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total DECIMAL(10,2) NOT NULL,
    forma_pago ENUM('efectivo', 'transferencia') NOT NULL DEFAULT 'efectivo',
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

CREATE TABLE IF NOT EXISTS detalle_factura (
    id INT PRIMARY KEY AUTO_INCREMENT,
    factura_id INT,
    producto_id INT,
    cantidad DECIMAL(10,2) NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    unidad_medida ENUM('KG', 'UND', 'LB') DEFAULT 'KG',
    subtotal DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (factura_id) REFERENCES facturas(id),
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE TABLE IF NOT EXISTS configuracion_impresion (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre_negocio VARCHAR(100) NOT NULL,
    direccion TEXT,
    telefono VARCHAR(20),
    nit VARCHAR(50),
    pie_pagina TEXT,
    ancho_papel INT DEFAULT 80,
    font_size INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    logo_data LONGBLOB,
    logo_tipo VARCHAR(50),
    qr_data LONGBLOB,
    qr_tipo VARCHAR(50)
); 

-- Agregar a database.sql
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(100),
    rol ENUM('admin', 'vendedor', 'gerente') DEFAULT 'vendedor',
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultimo_acceso TIMESTAMP NULL
);

INSERT INTO usuarios (username, email, password, nombre_completo, rol) VALUES 
('admin', 'admin@sistema.com', '$2b$10$rG5ZqJ3qKx3F.YvN7xC4.OP4Y6JwH7Kqp8vZ1xN2mO3pQ4rS5tU6v', 'Administrador', 'admin'), 
('ventas', 'ventas@sistema.com', '$2b$10$aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uV2wX3yZ4', 'Vendedor', 'vendedor');
