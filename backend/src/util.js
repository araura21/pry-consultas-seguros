const { z } = require('zod');

// Error con un mensaje que sí se puede mostrar al usuario
class ErrorHttp extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

function edad(fechaIso) {
  const n = new Date(`${fechaIso}T00:00:00`);
  const hoy = new Date();
  let e = hoy.getFullYear() - n.getFullYear();
  if (hoy < new Date(hoy.getFullYear(), n.getMonth(), n.getDate())) e--;
  return e;
}

// Muestra solo los últimos 4 caracteres (identificación, póliza)
function enmascarar(valor) {
  return valor ? '•'.repeat(Math.max(valor.length - 4, 0)) + valor.slice(-4) : null;
}

// Fecha de nacimiento: AAAA-MM-DD, real (no 31 de febrero), no futura y de este siglo o el anterior
const fechaNacimiento = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida').refine((v) => {
  const d = new Date(`${v}T00:00:00`);
  const hoy = new Date();
  const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v && v <= hoyIso && v >= '1900-01-01';
}, 'La fecha de nacimiento no puede ser futura');

const esUuid = (v) => z.string().uuid().safeParse(v).success;

module.exports = { ErrorHttp, edad, enmascarar, esUuid, fechaNacimiento };
