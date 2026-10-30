const { FRONTEND_ORIGIN } = require('../config');
const { auditar } = require('../seguridad/auditoria');

const OCHO_HORAS = 8 * 60 * 60 * 1000;

// La inactividad (15 min) la controla la cookie; aquí se controla el máximo absoluto (8 h)
function requiereSesion(req, res, next) {
  if (!req.session?.usuario) return res.status(401).json({ error: 'Debe iniciar sesión' });
  if (Date.now() - req.session.inicio > OCHO_HORAS) {
    return req.session.destroy(() => res.status(401).json({ error: 'La sesión expiró' }));
  }
  next();
}

// Denegar por defecto: si el rol no está en la lista, 403
function requiereRol(...roles) {
  return async (req, res, next) => {
    if (roles.includes(req.session.usuario.rol)) return next();
    await auditar(req, 'ACCESO_DENEGADO', 'DENEGADO', req.originalUrl);
    res.status(403).json({ error: 'No autorizado' });
  };
}

// Protección CSRF adicional a SameSite=Strict: las peticiones que cambian datos
// solo se aceptan desde el origen del frontend
function verificarOrigen(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origen = req.get('origin');
  if (origen && origen !== FRONTEND_ORIGIN) return res.status(403).json({ error: 'Origen no permitido' });
  next();
}

module.exports = { requiereSesion, requiereRol, verificarOrigen };
