const crypto = require('node:crypto');
const { z } = require('zod');
const env = require('../config');
const pool = require('../db');
const { firmar, verificarMensaje } = require('../seguridad/firma');
const { ErrorHttp } = require('../util');

const respuestaCobertura = z.object({
  referencia: z.string(),
  elegible: z.boolean(),
  porcentaje: z.number().int().min(0).max(100),
});

// S07: solo se envían los campos mínimos y la respuesta debe venir firmada
async function consultarCobertura({ aseguradoraId, poliza, prestacion }) {
  const referencia = crypto.randomUUID();
  const cuerpo = JSON.stringify({ referencia, aseguradoraId, poliza, prestacion });
  let resp;
  try {
    resp = await fetch(`${env.INSURER_URL}/elegibilidad`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...firmar(cuerpo, env.INSURER_SECRET) },
      body: cuerpo,
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new ErrorHttp(502, 'La aseguradora no responde, intente más tarde');
  }
  const texto = await resp.text();
  const firmaOk = resp.ok && await verificarMensaje(texto, Object.fromEntries(resp.headers), env.INSURER_SECRET);
  const datos = firmaOk ? respuestaCobertura.safeParse(JSON.parse(texto)) : null;
  // La respuesta debe corresponder a esta solicitud (no a una reenviada de otra)
  if (!datos?.success || datos.data.referencia !== referencia) {
    throw new ErrorHttp(502, 'No se pudo verificar la cobertura');
  }
  return datos.data;
}

// S11: la plataforma solo crea el intento; la tarjeta se escribe en la página de la pasarela
async function crearIntentoPago({ referencia, monto }) {
  const cuerpo = JSON.stringify({ referencia, monto });
  let resp;
  try {
    resp = await fetch(`${env.PAYMENT_URL}/intentos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...firmar(cuerpo, env.PAYMENT_SECRET) },
      body: cuerpo,
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new ErrorHttp(502, 'La pasarela de pagos no responde');
  }
  const { url } = resp.ok ? await resp.json() : {};
  // Solo se redirige a la pasarela configurada (evita redirecciones abiertas)
  if (typeof url !== 'string' || !url.startsWith(`${env.PAYMENT_URL}/`)) {
    throw new ErrorHttp(502, 'No se pudo iniciar el pago');
  }
  return url;
}

// S09: plantilla fija, sin diagnóstico, especialidad, póliza ni nombre del profesional
async function notificarCita(pacienteId, citaId) {
  const { rows } = await pool.query(
    'SELECT h.inicio FROM citas c JOIN horarios h ON h.id = c.horario_id WHERE c.id = $1',
    [citaId],
  );
  const f = new Date(rows[0].inicio);
  const zona = { timeZone: 'America/Guayaquil' };
  const mensaje = `Tienes una cita el ${f.toLocaleDateString('es-EC', zona)} a las `
    + `${f.toLocaleTimeString('es-EC', { ...zona, hour: '2-digit', minute: '2-digit' })}. Abre la app para ver los detalles.`;
  await pool.query('INSERT INTO notificaciones (paciente_id, mensaje) VALUES ($1, $2)', [pacienteId, mensaje]);
  console.log('[notificación]', mensaje);
}

module.exports = { consultarCobertura, crearIntentoPago, notificarCita };
