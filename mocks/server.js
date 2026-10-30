// Sistemas EXTERNOS simulados: una aseguradora (4001) y una pasarela de pagos (4002).
// En la vida real son de otras empresas; por eso viven fuera del backend.
require('dotenv').config({ quiet: true });
const crypto = require('node:crypto');
const express = require('express');
const { firmar, firmaValida } = require('./firma');

const { INSURER_SECRET, PAYMENT_SECRET, BACKEND_WEBHOOK_URL, FRONTEND_URL } = process.env;
const usados = new Set(); // nonces ya recibidos (anti-replay)

const json = express.json({ verify: (req, _res, buf) => { req.rawBody = buf.toString('utf8'); } });
function exigirFirma(secreto) {
  return (req, res, next) => {
    const nonce = req.headers['x-nonce'];
    if (!firmaValida(req.rawBody, req.headers, secreto) || usados.has(nonce)) {
      return res.status(401).json({ error: 'Firma inválida' });
    }
    usados.add(nonce);
    next();
  };
}

// ---------------- Aseguradora simulada ----------------
const POLIZAS = {
  'POL-1001': { aseguradoraId: 1, porcentaje: 80 },
  'POL-2001': { aseguradoraId: 2, porcentaje: 70 },
  'POL-1999': { aseguradoraId: 1, porcentaje: 80, vencida: true },
};

const aseguradora = express();
aseguradora.post('/elegibilidad', json, exigirFirma(INSURER_SECRET), (req, res) => {
  const { referencia, aseguradoraId, poliza } = req.body;
  const p = POLIZAS[poliza];
  const elegible = !!p && p.aseguradoraId === aseguradoraId && !p.vencida;
  const cuerpo = JSON.stringify({ referencia, elegible, porcentaje: elegible ? p.porcentaje : 0 });
  res.set(firmar(cuerpo, INSURER_SECRET)).type('application/json').send(cuerpo);
});
aseguradora.listen(4001, '127.0.0.1', () => console.log('Aseguradora simulada en http://localhost:4001'));

// ---------------- Pasarela de pagos simulada ----------------
const intentos = new Map();
const pasarela = express();

pasarela.post('/intentos', json, exigirFirma(PAYMENT_SECRET), (req, res) => {
  const { referencia, monto } = req.body;
  intentos.set(referencia, { monto });
  res.json({ url: `http://localhost:4002/pagar/${referencia}` });
});

// Página alojada por la pasarela: la tarjeta se escribe aquí, no en nuestra app
// Página alojada por la pasarela: la tarjeta se escribe aquí, no en nuestra app
function paginaPago(ref, monto, error = '', previo = {}) {
  const v = (k) => String(previo[k] ?? '').replace(/\D/g, '');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Pasarela simulada</title>
  <style>body{font-family:sans-serif;max-width:360px;margin:40px auto;padding:0 16px}input,button{width:100%;padding:10px;margin:6px 0;box-sizing:border-box;font-size:16px}
  .fila{display:flex;gap:10px}.error{color:#b42318;background:#ffe3e8;padding:8px 10px;border-radius:6px}label{font-size:14px;font-weight:600}</style></head>
  <body><h2>Pasarela de pagos (simulada)</h2><p>Monto a pagar: <b>$${monto.toFixed(2)}</b></p>
  ${error ? `<p class="error" role="alert">${error}</p>` : ''}
  <form method="post" action="/pagar/${encodeURIComponent(ref)}">
    <label>Número de tarjeta (16 dígitos)</label>
    <input name="tarjeta" inputmode="numeric" autocomplete="cc-number" maxlength="16" minlength="16" pattern="[0-9]{16}"
      placeholder="0000000000000000" value="${v('tarjeta')}" required title="Exactamente 16 dígitos, solo números">
    <div class="fila">
      <div><label>Mes (MM)</label><input name="mes" inputmode="numeric" autocomplete="cc-exp-month" maxlength="2" minlength="2"
        pattern="(0[1-9]|1[0-2])" placeholder="MM" value="${v('mes')}" required title="2 dígitos, de 01 a 12"></div>
      <div><label>Año (AAAA)</label><input name="anio" inputmode="numeric" autocomplete="cc-exp-year" maxlength="4" minlength="4"
        pattern="[0-9]{4}" placeholder="AAAA" value="${v('anio')}" required title="4 dígitos, desde el año actual"></div>
      <div><label>CVV</label><input name="cvv" type="password" inputmode="numeric" autocomplete="cc-csc" maxlength="3" minlength="3"
        pattern="[0-9]{3}" placeholder="123" required title="Exactamente 3 dígitos"></div>
    </div>
    <button>Pagar</button></form>
  <small>Prueba: 4111111111111111 se aprueba; 4000000000000002 se rechaza.</small>
  <script>
    // Mientras se escribe, se descartan las letras y los símbolos
    document.querySelectorAll('input[inputmode=numeric]').forEach((i) =>
      i.addEventListener('input', () => { i.value = i.value.replace(/\D/g, ''); }));
  </script></body></html>`;
}

pasarela.get('/pagar/:ref', (req, res) => {
  const i = intentos.get(req.params.ref);
  if (!i) return res.status(404).send('Intento de pago no encontrado');
  res.send(paginaPago(req.params.ref, i.monto));
});

// Validación también en el servidor: el navegador se puede saltar
function validarTarjeta({ tarjeta = '', mes = '', anio = '', cvv = '' }) {
  if (!/^\d{16}$/.test(tarjeta)) return 'El número de tarjeta debe tener 16 dígitos y solo números.';
  if (!/^(0[1-9]|1[0-2])$/.test(mes)) return 'El mes debe tener 2 dígitos entre 01 y 12.';
  if (!/^\d{4}$/.test(anio)) return 'El año debe tener 4 dígitos.';
  const hoy = new Date();
  if (Number(anio) < hoy.getFullYear()) return `El año no puede ser menor a ${hoy.getFullYear()}.`;
  if (Number(anio) === hoy.getFullYear() && Number(mes) < hoy.getMonth() + 1) return 'La tarjeta está vencida.';
  if (!/^\d{3}$/.test(cvv)) return 'El CVV debe tener 3 dígitos y solo números.';
  return null;
}

pasarela.post('/pagar/:ref', express.urlencoded({ extended: false }), async (req, res) => {
  const ref = req.params.ref;
  const i = intentos.get(ref);
  if (!i) return res.status(404).send('Intento de pago no encontrado');
  const problema = validarTarjeta(req.body);
  if (problema) return res.status(400).send(paginaPago(ref, i.monto, problema, req.body)); // el intento sigue vigente
  intentos.delete(ref);
  const tarjeta = req.body.tarjeta;
  const aprobado = !tarjeta.endsWith('0002');
  // Al backend solo llega un token y los últimos 4 dígitos: el número completo y el CVV se quedan aquí
  const cuerpo = JSON.stringify({
    referencia: ref,
    estado: aprobado ? 'APROBADO' : 'RECHAZADO',
    monto: i.monto,
    token: `tok_${crypto.randomBytes(8).toString('hex')}`,
    marca: tarjeta.startsWith('4') ? 'VISA' : 'MASTERCARD',
    ultimos4: tarjeta.slice(-4).padStart(4, '0'),
    transaccionId: `tx_${crypto.randomBytes(6).toString('hex')}`,
  });
  try {
    await fetch(BACKEND_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...firmar(cuerpo, PAYMENT_SECRET) },
      body: cuerpo,
    });
  } catch (e) {
    console.error('No se pudo avisar al backend:', e.message);
  }
  res.redirect(`${FRONTEND_URL}/citas?pago=${aprobado ? 'ok' : 'rechazado'}`);
});
pasarela.listen(4002, '127.0.0.1', () => console.log('Pasarela simulada en http://localhost:4002'));
