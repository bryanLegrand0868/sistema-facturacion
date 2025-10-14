const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /productos - Mostrar página de productos
router.get('/', async (req, res) => {
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

// GET /api/productos - API para obtener productos con formato JSON
router.get('/api/productos', async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT id, codigo, nombre, precio_kg, precio_unidad, precio_libra, stock_actual, stock_minimo FROM productos ORDER BY nombre"
        );
        const productos = rows.map((p) => ({
            ...p,
            stock_actual: Number(p.stock_actual) || 0,
            stock_minimo: Number(p.stock_minimo) || 0,
            low_stock: (Number(p.stock_actual) || 0) <= (Number(p.stock_minimo) || 0),
        }));
        res.json(productos);
    } catch (err) {
        console.error("Error API productos:", err);
        res.status(500).json({ error: "Error al obtener productos" });
    }
});

// GET /productos/buscar - Buscar productos
router.get('/buscar', async (req, res) => {
    try {
        const query = req.query.q || '';
        const sql = `
            SELECT * FROM productos 
            WHERE nombre LIKE ? OR codigo LIKE ?
            ORDER BY nombre
            LIMIT 10
        `;
        const searchTerm = `%${query}%`;
        const [productos] = await db.query(sql, [searchTerm, searchTerm]);
        res.json(productos);
    } catch (error) {
        console.error('Error al buscar productos:', error);
        res.status(500).json({ error: 'Error al buscar productos' });
    }
});

// GET /productos/:id - Obtener un producto específico
router.get('/:id', async (req, res) => {
    try {
        const [productos] = await db.query('SELECT * FROM productos WHERE id = ?', [req.params.id]);
        const producto = productos[0];
        if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json(producto);
    } catch (error) {
        console.error('Error al obtener producto:', error);
        res.status(500).json({ error: 'Error al obtener producto' });
    }
});

// POST /productos - Crear nuevo producto
router.post('/', async (req, res) => {
    try {
        const { codigo, nombre, precio_kg, precio_unidad, precio_libra, stock_actual, stock_minimo } = req.body;
        
        // Validar datos requeridos
        if (!codigo || !nombre) {
            return res.status(400).json({ error: 'El código y nombre son requeridos' });
        }

        const [result] = await db.query(
            'INSERT INTO productos (codigo, nombre, precio_kg, precio_unidad, precio_libra, stock_actual, stock_minimo) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                codigo, 
                nombre, 
                precio_kg || 0, 
                precio_unidad || 0, 
                precio_libra || 0, 
                stock_actual || 0,
                stock_minimo || 0
            ]
        );

        res.status(201).json({ 
            id: result.insertId,
            message: 'Producto creado exitosamente' 
        });
    } catch (error) {
        console.error('Error al crear producto:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Ya existe un producto con ese código' });
        }
        res.status(500).json({ error: 'Error al crear producto' });
    }
});

// PUT /productos/:id - Actualizar producto
router.put('/:id', async (req, res) => {
    try {
        const { codigo, nombre, precio_kg, precio_unidad, precio_libra, stock_actual, stock_minimo } = req.body;
        
        // Validar datos requeridos
        if (!codigo || !nombre) {
            return res.status(400).json({ error: 'El código y nombre son requeridos' });
        }

        const [result] = await db.query(
            'UPDATE productos SET codigo = ?, nombre = ?, precio_kg = ?, precio_unidad = ?, precio_libra = ?, stock_actual = ?, stock_minimo = ? WHERE id = ?',
            [
                codigo, 
                nombre, 
                precio_kg || 0, 
                precio_unidad || 0, 
                precio_libra || 0, 
                stock_actual || 0,
                stock_minimo || 0,
                req.params.id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json({ message: 'Producto actualizado exitosamente' });
    } catch (error) {
        console.error('Error al actualizar producto:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Ya existe un producto con ese código' });
        }
        res.status(500).json({ error: 'Error al actualizar producto' });
    }
});

// DELETE /productos/:id - Eliminar producto
router.delete('/:id', async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM productos WHERE id = ?', [req.params.id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json({ message: 'Producto eliminado exitosamente' });
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        res.status(500).json({ error: 'Error al eliminar producto' });
    }
});

module.exports = router;