function requireAuth(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }
    req.flash('error', 'Debes iniciar sesión primero');
    res.redirect('/login');
}

function requireRole(roles) {
    return (req, res, next) => {
        if (req.session && req.session.userId) {
            if (roles.includes(req.session.userRole)) {
                return next();
            }
            req.flash('error', 'No tienes permiso para acceder');
            return res.redirect('/');
        }
        res.redirect('/login');
    };
}

module.exports = { requireAuth, requireRole };