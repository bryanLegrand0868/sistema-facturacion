const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Crear nueva factura
router.post('/', (req, res) => {
    const { cliente_id, total, forma_pago, productos } = req.body;
    
    if (!cliente_id || !productos || productos.length === 0) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }

    db.beginTransaction(err => {
        if (err) {
            console.error('Error al iniciar transacción:', err);
            return res.status(500).json({ error: 'Error al crear factura' });
        }

        // Insertar factura
        const sqlFactura = 'INSERT INTO facturas (cliente_id, total, forma_pago) VALUES (?, ?, ?)';
        db.query(sqlFactura, [cliente_id, total, forma_pago], (err, result) => {
            if (err) {
                return db.rollback(() => {
                    console.error('Error al crear factura:', err);
                    res.status(500).json({ error: 'Error al crear factura' });
                });
            }

            const factura_id = result.insertId;
            const sqlDetalle = 'INSERT INTO detalle_factura (factura_id, producto_id, cantidad, precio_unitario, unidad_medida, subtotal) VALUES ?';
            const valores = productos.map(p => [
                factura_id,
                p.producto_id,
                p.cantidad,
                p.precio,
                p.unidad,
                p.subtotal
            ]);

            db.query(sqlDetalle, [valores], err => {
                if (err) {
                    return db.rollback(() => {
                        console.error('Error al crear detalle de factura:', err);
                        res.status(500).json({ error: 'Error al crear factura' });
                    });
                }

                db.commit(err => {
                    if (err) {
                        return db.rollback(() => {
                            console.error('Error al confirmar transacción:', err);
                            res.status(500).json({ error: 'Error al crear factura' });
                        });
                    }
                    res.status(201).json({ id: factura_id });
                });
            });
        });
    });
});

// Vista previa e impresión de factura
router.get('/:id/imprimir', async (req, res) => {
    const factura_id = req.params.id;

    try {
        // Obtener configuración con imágenes en base64
        const [configRows] = await db.promise().query(
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
        const [facturas] = await db.promise().query(
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
        const [detalles] = await db.promise().query(
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
        res.status(500).json({ error: 'Error al obtener datos de factura' });
    }
});

// Ruta para obtener detalles de una factura
router.get('/:id/detalles', async (req, res) => {
    try {
        // Obtener información de la factura
        const [facturas] = await db.promise().query(
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
        const [productos] = await db.promise().query(
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