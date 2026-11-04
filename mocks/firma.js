// Copia de las funciones de firma del backend (cada sistema tiene su propia implementación)
const crypto = require('node:crypto');

const VENTANA_MS = 5 * 60 * 1000;

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
  if (Math.abs(Date.now() - ts) > VENTANA_MS) return false;
  const esperada = crypto.createHmac('sha256', secreto).update(`${ts}.${nonce}.${cuerpo}`).digest();
  const recibida = Buffer.from(String(firma), 'hex');
  return recibida.length === esperada.length && crypto.timingSafeEqual(recibida, esperada);
}

module.exports = { firmar, firmaValida };
