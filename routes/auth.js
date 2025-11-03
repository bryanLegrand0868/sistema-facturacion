const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');

// Página de login
router.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/');
    }
    res.render('login', { 
        error: req.flash('error'),
        success: req.flash('success')
    });
});

// Procesar login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const [users] = await db.query(
            'SELECT * FROM usuarios WHERE username = ? AND activo = TRUE',
            [username]
        );
        
        if (users.length === 0) {
            req.flash('error', 'Usuario o contraseña incorrectos');
            return res.redirect('/login');
        }
        
        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            req.flash('error', 'Usuario o contraseña incorrectos');
            return res.redirect('/login');
        }
        
        // Actualizar último acceso
        await db.query('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = ?', [user.id]);
        
        // Crear sesión
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.userRole = user.rol;
        req.session.nombreCompleto = user.nombre_completo;
        
        // Guardar la sesión antes de redirigir
        req.session.save((err) => {
            if (err) {
                console.error('Error al guardar sesión:', err);
                req.flash('error', 'Error al iniciar sesión');
                return res.redirect('/login');
            }
            
            req.flash('success', `Bienvenido ${user.nombre_completo}`);
            res.redirect('/');
        });
        
    } catch (error) {
        console.error('Error en login:', error);
        req.flash('error', 'Error al iniciar sesión');
        res.redirect('/login');
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error al cerrar sesión:', err);
        }
        res.redirect('/login');
    });
});

// Registro (GET)
router.get('/register', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/');
    }
    res.render('register', { 
        error: req.flash('error'),
        success: req.flash('success')
    });
});

// Registro (POST)
router.post('/register', async (req, res) => {
    const { username, email, password, nombre_completo } = req.body;
    
    try {
        // Validar que no exista
        const [existing] = await db.query(
            'SELECT id FROM usuarios WHERE username = ? OR email = ?',
            [username, email]
        );
        
        if (existing.length > 0) {
            req.flash('error', 'Usuario o email ya registrado');
            return res.redirect('/register');
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Insertar usuario
        await db.query(
            'INSERT INTO usuarios (username, email, password, nombre_completo, rol, activo) VALUES (?, ?, ?, ?, ?, ?)',
            [username, email, hashedPassword, nombre_completo, 'vendedor', true]
        );
        
        req.flash('success', 'Usuario registrado exitosamente. Ya puedes iniciar sesión.');
        res.redirect('/login');
        
    } catch (error) {
        console.error('Error en registro:', error);
        req.flash('error', 'Error al registrar usuario');
        res.redirect('/register');
    }
});

module.exports = router;