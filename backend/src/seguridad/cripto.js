const crypto = require('node:crypto');
const { DATA_KEY, HMAC_KEY } = require('../config');

const CLAVE = Buffer.from(DATA_KEY, 'hex');

// AES-256-GCM: cifra y además detecta si alguien modificó el valor guardado
function cifrar(texto) {
  if (texto == null || texto === '') return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', CLAVE, iv);
  const ct = Buffer.concat([c.update(String(texto), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString('base64')).join('.');
}

function descifrar(valor) {
  if (!valor) return null;
  const [iv, tag, ct] = valor.split('.').map((p) => Buffer.from(p, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', CLAVE, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
}

// Índice no reversible para buscar por cédula sin descifrar toda la tabla
function indiceBusqueda(texto) {
  return crypto.createHmac('sha256', HMAC_KEY).update(String(texto).trim().toUpperCase()).digest('hex');
}

module.exports = { cifrar, descifrar, indiceBusqueda };
