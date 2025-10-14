const express = require('express');
const router = express.Router();
const db = require('../db');

// Crear nueva factura
router.post('/api/facturas', async (req, res) => {
    const { cliente_id, total, forma_pago, productos } = req.body;

    if (!cliente_id || !Array.isArray(productos) || productos.length === 0) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }

    const connection = await db.getConnection();
    
    try {
        // Iniciar transacción
        await connection.beginTransaction();

        // Insertar factura
        const [resultFactura] = await connection.query(
            'INSERT INTO facturas (cliente_id, total, forma_pago) VALUES (?, ?, ?)',
            [cliente_id, total, forma_pago]
        );

        const factura_id = resultFactura.insertId;

        // Verificar stock y actualizar productos
        for (const p of productos) {
            // Verificar stock disponible
            const [rows] = await connection.query(
                'SELECT stock_actual FROM productos WHERE id = ? FOR UPDATE',
                [p.producto_id]
            );
            
            if (!rows.length) {
                await connection.rollback();
                return res.status(404).json({ 
                    error: `Producto ${p.producto_id} no encontrado` 
                });
            }
            
            const stockActual = parseFloat(rows[0].stock_actual) || 0;
            const cantidad = parseFloat(p.cantidad) || 0;
            
            if (stockActual < cantidad) {
                await connection.rollback();
                return res.status(400).json({ 
                    error: `Stock insuficiente para el producto "${p.nombre}". Stock disponible: ${stockActual}` 
                });
            }

            // Actualizar stock
            await connection.query(
                'UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ?',
                [cantidad, p.producto_id]
            );
        }

        // Insertar detalles de factura
        const sqlDetalle = 'INSERT INTO detalle_factura (factura_id, producto_id, cantidad, precio_unitario, unidad_medida, subtotal) VALUES ?';
        const valores = productos.map(p => [
            factura_id,
            p.producto_id,
            p.cantidad,
            p.precio,
            p.unidad,
            p.subtotal
        ]);

        await connection.query(sqlDetalle, [valores]);

        // Confirmar transacción
        await connection.commit();
        
        res.status(201).json({ 
            id: factura_id,
            mensaje: 'Factura creada exitosamente' 
        });

    } catch (error) {
        // Revertir cambios en caso de error
        await connection.rollback();
        console.error('Error al crear factura:', error);
        res.status(500).json({ 
            error: 'Error al crear factura',
            detalle: error.message 
        });
    } finally {
        connection.release();
    }
});

// Vista previa e impresión de factura
router.get('/:id/imprimir', async (req, res) => {
    const factura_id = req.params.id;

    try {
        // Obtener configuración con imágenes en base64
        const [configRows] = await db.query(
            `SELECT *, 
             TO_BASE64(logo_data) as logo_base64,
             TO_BASE64(qr_data) as qr_base64
             FROM configuracion_impresion LIMIT 1`
        );
        const config = configRows[0];

        if (!config) {
            return res.status(400).json({ error: 'Configuración no encontrada' });
        }

        // Convertir imágenes a formato data URL si existen
        if (config.logo_base64) {
            config.logo_src = `data:image/${config.logo_tipo};base64,${config.logo_base64}`;
        }
        if (config.qr_base64) {
            config.qr_src = `data:image/${config.qr_tipo};base64,${config.qr_base64}`;
        }

        // Obtener datos de la factura
        const [facturas] = await db.query(
            `SELECT f.*, c.nombre as cliente_nombre, c.direccion, c.telefono
             FROM facturas f
             JOIN clientes c ON f.cliente_id = c.id
             WHERE f.id = ?`,
            [factura_id]
        );

        if (facturas.length === 0) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }

        // Obtener detalles de la factura
        const [detalles] = await db.query(
            `SELECT d.*, p.nombre as producto_nombre
             FROM detalle_factura d
             JOIN productos p ON d.producto_id = p.id
             WHERE d.factura_id = ?`,
            [factura_id]
        );

        // Renderizar la vista de la factura
        res.render('factura', {
            factura: facturas[0],
            detalles: detalles,
            config: config
        });

    } catch (error) {
        console.error('Error al obtener datos:', error);
        res.status(500).json({ 
            error: 'Error al obtener datos de factura',
            detalle: error.message 
        });
    }
});

// Ruta para obtener detalles de una factura
router.get('/:id/detalles', async (req, res) => {
    try {
        // Obtener información de la factura
        const [facturas] = await db.query(
            'SELECT f.*, c.nombre as cliente_nombre, c.direccion, c.telefono FROM facturas f ' +
            'JOIN clientes c ON f.cliente_id = c.id ' +
            'WHERE f.id = ?',
            [req.params.id]
        );

        if (facturas.length === 0) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }

        const factura = facturas[0];

        // Obtener productos de la factura
        const [productos] = await db.query(
            'SELECT d.cantidad, d.precio_unitario, d.unidad_medida, d.subtotal, p.nombre ' +
            'FROM detalle_factura d ' +
            'JOIN productos p ON d.producto_id = p.id ' +
            'WHERE d.factura_id = ?',
            [req.params.id]
        );

        // Estructurar la respuesta asegurando que los valores numéricos sean válidos
        res.json({
            factura: {
                id: factura.id,
                fecha: factura.fecha,
                total: parseFloat(factura.total || 0),
                forma_pago: factura.forma_pago
            },
            cliente: {
                nombre: factura.cliente_nombre || '',
                direccion: factura.direccion || '',
                telefono: factura.telefono || ''
            },
            productos: productos.map(p => ({
                nombre: p.nombre || '',
                cantidad: parseFloat(p.cantidad || 0),
                unidad: p.unidad_medida || '',
                precio: parseFloat(p.precio_unitario || 0),
                subtotal: parseFloat(p.subtotal || 0)
            }))
        });
    } catch (error) {
        console.error('Error al obtener detalles de la factura:', error);
        res.status(500).json({ error: 'Error al obtener detalles de la factura' });
    }
});

module.exports = router;