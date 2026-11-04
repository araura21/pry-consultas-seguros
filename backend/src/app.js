const crypto = require('node:crypto');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const PgStore = require('connect-pg-simple')(session);
const { rateLimit } = require('express-rate-limit');
const pool = require('./db');
const env = require('./config');
const { verificarOrigen } = require('./middleware/auth');
const { ErrorHttp } = require('./util');

const app = express();
app.set('trust proxy', 1); // la API solo se publica detrás de un proxy (el de Angular o uno inverso)

// Cabeceras de seguridad: CSP, HSTS, nosniff, frame-ancestors, sin X-Powered-By
app.use(helmet());

// Límite de tamaño del cuerpo; se guarda el texto original para verificar firmas
app.use(express.json({ limit: '20kb', verify: (req, _res, buf) => { req.rawBody = buf.toString('utf8'); } }));

// S10: la sesión vive en el servidor; al navegador solo va una cookie opaca
app.use(session({
  name: 'sid',
  store: new PgStore({ pool, tableName: 'session', pruneSessionInterval: process.env.NODE_ENV === 'test' ? false : 900 }),
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true, // cada petición renueva los 15 minutos de inactividad
  cookie: {
    httpOnly: true,
    secure: env.COOKIE_SECURE === 'true',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
  },
}));

// Límite general de peticiones por IP (R15)
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use('/api', verificarOrigen);

app.use('/api/auth', require('./rutas/auth'));
app.use('/api/profesionales', require('./rutas/profesionales'));
app.use('/api/pacientes', require('./rutas/pacientes'));
app.use('/api/citas', require('./rutas/citas'));
app.use('/api/pagos', require('./rutas/pagos'));
app.use('/api/recepcion', require('./rutas/recepcion'));
app.use('/api/aseguradora', require('./rutas/aseguradora'));
app.use('/api/auditoria', require('./rutas/auditoria'));

app.use((req, res) => res.status(404).json({ error: 'No encontrado' }));

// Mensajes genéricos al usuario; el detalle técnico solo queda en la consola del servidor
app.use((err, req, res, _next) => {
  if (err instanceof ErrorHttp) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Petición demasiado grande' });
  const id = crypto.randomUUID();
  console.error(`[error ${id}]`, err);
  res.status(500).json({ error: 'Ocurrió un error interno', id });
});

module.exports = app;
