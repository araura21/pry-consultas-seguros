const crypto = require('node:crypto');

const VENTANA_MS = 5 * 60 * 1000;

// Firma HMAC de "marca de tiempo.nonce.cuerpo" para mensajes entre sistemas
function firmar(cuerpo, secreto) {
  const ts = Date.now().toString();
  const nonce = crypto.randomUUID();
  const firma = crypto.createHmac('sha256', secreto).update(`${ts}.${nonce}.${cuerpo}`).digest('hex');
  return { 'x-timestamp': ts, 'x-nonce': nonce, 'x-firma': firma };
}

function firmaValida(cuerpo, headers, secreto) {
  const ts = Number(headers['x-timestamp']);
  const nonce = headers['x-nonce'];
  const firma = headers['x-firma'];
  if (!Number.isFinite(ts) || !nonce || !firma) return false;
  if (Math.abs(Date.now() - ts) > VENTANA_MS) return false; // mensaje viejo o del futuro
  const esperada = crypto.createHmac('sha256', secreto).update(`${ts}.${nonce}.${cuerpo}`).digest();
  const recibida = Buffer.from(String(firma), 'hex');
  return recibida.length === esperada.length && crypto.timingSafeEqual(recibida, esperada);
}

// Igual que firmaValida, pero además rechaza un nonce que ya se usó (anti-replay)
async function verificarMensaje(cuerpo, headers, secreto) {
  if (!firmaValida(cuerpo, headers, secreto)) return false;
  const pool = require('../db');
  const r = await pool.query('INSERT INTO nonces (nonce) VALUES ($1) ON CONFLICT DO NOTHING', [headers['x-nonce']]);
  return r.rowCount === 1;
}

module.exports = { firmar, firmaValida, verificarMensaje };
