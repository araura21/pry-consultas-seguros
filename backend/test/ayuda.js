const request = require('supertest');
const { authenticator } = require('otplib');
const app = require('../src/app');
const pool = require('../src/db');
const { descifrar } = require('../src/seguridad/cripto');

const CLAVE = 'Demo-Segura-2026';

// Inicia sesión y devuelve un "agente" que conserva la cookie, como un navegador
async function entrar(email) {
  const agente = request.agent(app);
  const { rows } = await pool.query('SELECT mfa_secret_cif FROM usuarios WHERE email = $1', [email]);
  const secreto = descifrar(rows[0].mfa_secret_cif);
  const body = { email, password: CLAVE, ...(secreto && { totp: authenticator.generate(secreto) }) };
  const res = await agente.post('/api/auth/login').send(body);
  if (res.status !== 200) throw new Error(`No se pudo entrar como ${email}: ${res.status}`);
  return agente;
}

// Horario libre lejano (más de 24 h) para poder cancelarlo después
async function horarioLibre(profesionalId = 1) {
  const { rows } = await pool.query(
    `SELECT id FROM horarios WHERE profesional_id = $1 AND estado = 'LIBRE' AND inicio > now() + interval '48 hours'
      ORDER BY inicio DESC LIMIT 1`,
    [profesionalId],
  );
  return rows[0].id;
}

module.exports = { app, pool, entrar, horarioLibre, CLAVE };
