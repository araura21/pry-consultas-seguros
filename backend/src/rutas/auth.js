const router = require('express').Router();
const { z } = require('zod');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { authenticator } = require('otplib');
const pool = require('../db');
const { cifrar, descifrar, indiceBusqueda } = require('../seguridad/cripto');
const { validarContrasena, hashear, verificar } = require('../seguridad/contrasenas');
const { auditar } = require('../seguridad/auditoria');
const { validar } = require('../middleware/validar');
const { requiereSesion } = require('../middleware/auth');
const { edad, fechaNacimiento } = require('../util');

const ROLES_CON_MFA = ['PROFESIONAL', 'RECEPCION', 'ASEGURADORA', 'AUDITOR'];

// 5 intentos fallidos cada 15 minutos por IP y correo (credential stuffing, R12)
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.email ?? '').toLowerCase()}`,
  handler: (req, res) => {
    res.status(429).json({ error: 'Demasiados intentos. Espere 15 minutos.' });
    auditar(req, 'LOGIN_BLOQUEADO', 'DENEGADO', null, { email: req.body?.email }).catch(console.error);
  },
});

// Mismas reglas que el formulario: el navegador solo ayuda, la validación real es esta
const NOMBRE = z.string().trim().min(2).max(50).regex(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+( [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/, 'Solo letras y espacios');

const esquemaRegistro = z.strictObject({
  email: z.string().trim().toLowerCase().email().max(100),
  password: z.string().min(1).max(64),
  nombres: NOMBRE,
  apellidos: NOMBRE,
  identificacion: z.string().trim().regex(/^\d{10}$/, 'La identificación debe tener 10 dígitos'),
  fechaNacimiento,
  telefono: z.string().regex(/^\d{10}$/, 'El teléfono debe tener 10 dígitos').optional(),
  // Consentimiento opcional y separado: no es condición para crear la cuenta (S14)
  aceptaRecordatoriosSms: z.boolean().default(false),
});

router.post('/registro', validar(esquemaRegistro), async (req, res) => {
  const d = req.datos;
  const problema = validarContrasena(d.password, d.email);
  if (problema) return res.status(400).json({ error: problema });
  if (edad(d.fechaNacimiento) < 15) {
    return res.status(400).json({ error: 'Los menores de 15 años se registran a través de su representante' });
  }
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const u = await cliente.query(
      `INSERT INTO usuarios (email, password_hash, rol) VALUES ($1, $2, 'PACIENTE') RETURNING id`,
      [d.email, await hashear(d.password)],
    );
    const p = await cliente.query(
      `INSERT INTO pacientes (usuario_id, nombres, apellidos, identificacion_cif, identificacion_hmac, fecha_nacimiento, telefono)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [u.rows[0].id, d.nombres, d.apellidos, cifrar(d.identificacion), indiceBusqueda(d.identificacion),
        d.fechaNacimiento, d.telefono ?? null],
    );
    await cliente.query(
      `INSERT INTO consentimientos (paciente_id, finalidad, version, aceptado) VALUES ($1, 'RECORDATORIOS_SMS', 'v1', $2)`,
      [p.rows[0].id, d.aceptaRecordatoriosSms],
    );
    await cliente.query('COMMIT');
  } catch (e) {
    await cliente.query('ROLLBACK');
    // Mensaje genérico: no revela si el correo o la cédula ya existen
    if (e.code === '23505') return res.status(409).json({ error: 'No se pudo completar el registro' });
    throw e;
  } finally {
    cliente.release();
  }
  await auditar(req, 'REGISTRO', 'OK', 'usuarios', { email: d.email });
  res.status(201).json({ mensaje: 'Cuenta creada' });
});

const esquemaLogin = z.strictObject({
  email: z.string().trim().toLowerCase().email().max(100),
  password: z.string().min(1).max(64),
  totp: z.string().regex(/^\d{6}$/).optional(),
});

router.post('/login', limiteLogin, validar(esquemaLogin), async (req, res) => {
  const { email, password, totp } = req.datos;
  const { rows } = await pool.query(
    `SELECT u.id, u.password_hash, u.rol, u.mfa_secret_cif, u.establecimiento_id, u.aseguradora_id,
            p.id AS paciente_id, pr.id AS profesional_id
       FROM usuarios u
       LEFT JOIN pacientes p ON p.usuario_id = u.id
       LEFT JOIN profesionales pr ON pr.usuario_id = u.id
      WHERE u.email = $1 AND u.activo`,
    [email],
  );
  const u = rows[0];
  const claveOk = await verificar(u?.password_hash, password);
  // MFA obligatorio para el personal (S12)
  const mfaOk = !claveOk || !ROLES_CON_MFA.includes(u.rol)
    || (!!totp && authenticator.check(totp, descifrar(u.mfa_secret_cif)));

  if (!claveOk || !mfaOk) {
    await auditar(req, 'LOGIN_FALLIDO', 'DENEGADO', null, { email, motivo: claveOk ? 'MFA' : 'CREDENCIALES' });
    return res.status(401).json({ error: 'Credenciales o código incorrectos' });
  }

  // Nueva sesión en cada inicio de sesión (evita la fijación de sesión)
  await new Promise((ok, mal) => req.session.regenerate((e) => (e ? mal(e) : ok())));
  req.session.usuario = {
    id: u.id,
    rol: u.rol,
    pacienteId: u.paciente_id,
    profesionalId: u.profesional_id,
    establecimientoId: u.establecimiento_id,
    aseguradoraId: u.aseguradora_id,
  };
  req.session.inicio = Date.now();
  await auditar(req, 'LOGIN', 'OK');
  res.json({ rol: u.rol });
});

router.get('/yo', requiereSesion, (req, res) => {
  res.json({ rol: req.session.usuario.rol });
});

router.post('/logout', requiereSesion, async (req, res) => {
  await auditar(req, 'LOGOUT', 'OK');
  req.session.destroy(() => {
    res.clearCookie('sid');
    res.status(204).end();
  });
});

// Revoca todas las sesiones abiertas del usuario (por ejemplo, si perdió el celular)
router.post('/cerrar-sesiones', requiereSesion, async (req, res) => {
  await auditar(req, 'CERRAR_SESIONES', 'OK');
  await pool.query(`DELETE FROM "session" WHERE sess->'usuario'->>'id' = $1`, [req.session.usuario.id]);
  res.clearCookie('sid');
  res.status(204).end();
});

module.exports = router;
