const express = require('express');
const router = express.Router();
const db = require('../config/database');
const multer = require('multer');

// Configuración de multer para memoria
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: function (req, file, cb) {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return cb(new Error('Solo se permiten imágenes'));
        }
        cb(null, true);
    }
});

// Obtener configuración actual
router.get('/', (req, res) => {
    db.query('SELECT *, TO_BASE64(logo_data) as logo_base64, TO_BASE64(qr_data) as qr_base64 FROM configuracion_impresion LIMIT 1', (err, results) => {
        if (err) {
            console.error('Error al obtener configuración:', err);
            return res.status(500).json({ error: 'Error al obtener configuración' });
        }
        
        const config = results[0] || {};
        if (config.logo_base64) {
            config.logo_src = `data:image/${config.logo_tipo};base64,${config.logo_base64}`;
        }
        if (config.qr_base64) {
            config.qr_src = `data:image/${config.qr_tipo};base64,${config.qr_base64}`;
        }
        
        res.render('configuracion', { config });
    });
});

// Guardar configuración
router.post('/', upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'qr', maxCount: 1 }
]), (req, res) => {
    try {
        const {
            nombre_negocio,
            direccion,
            telefono,
            nit,
            pie_pagina,
            ancho_papel,
            font_size
        } = req.body;

        db.query('SELECT * FROM configuracion_impresion LIMIT 1', (err, results) => {
            if (err) {
                console.error('Error al verificar configuración:', err);
                return res.status(500).json({ error: 'Error al guardar configuración' });
            }

            let values = [
                nombre_negocio,
                direccion || null,
                telefono || null,
                nit || null,
                pie_pagina || null,
                ancho_papel || 80,
                font_size || 1
            ];

            // Agregar datos de imágenes si se subieron nuevas
            if (req.files?.logo) {
                values.push(req.files.logo[0].buffer);
                values.push(req.files.logo[0].mimetype.split('/')[1]);
            }
            if (req.files?.qr) {
                values.push(req.files.qr[0].buffer);
                values.push(req.files.qr[0].mimetype.split('/')[1]);
            }

            if (results.length === 0) {
                // Insertar nueva configuración
                let sql = `
                    INSERT INTO configuracion_impresion 
                    (nombre_negocio, direccion, telefono, nit, pie_pagina, 
                     ancho_papel, font_size
                `;
                if (req.files?.logo) sql += ', logo_data, logo_tipo';
                if (req.files?.qr) sql += ', qr_data, qr_tipo';
                sql += ') VALUES (' + values.map(() => '?').join(',') + ')';
                
                db.query(sql, values, (err) => {
                    if (err) {
                        console.error('Error al crear configuración:', err);
                        return res.status(500).json({ error: 'Error al guardar configuración' });
                    }
                    res.redirect('/configuracion');
                });
            } else {
                // Actualizar configuración existente
                let sql = `
                    UPDATE configuracion_impresion 
                    SET nombre_negocio = ?, direccion = ?, telefono = ?, nit = ?,
                        pie_pagina = ?, ancho_papel = ?, font_size = ?
                `;
                if (req.files?.logo) sql += ', logo_data = ?, logo_tipo = ?';
                if (req.files?.qr) sql += ', qr_data = ?, qr_tipo = ?';
                sql += ' WHERE id = ?';
                
                values.push(results[0].id);
                
                db.query(sql, values, (err) => {
                    if (err) {
                        console.error('Error al actualizar configuración:', err);
                        return res.status(500).json({ error: 'Error al guardar configuración' });
                    }
                    res.redirect('/configuracion');
                });
            }
        });
    } catch (error) {
        console.error('Error en el procesamiento:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Eliminar la ruta de impresoras que no se usa
router.get('/impresoras', (req, res) => {
    res.json([]);
});

module.exports = router; 