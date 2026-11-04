const router = require('express').Router();
const { z } = require('zod');
const pool = require('../db');
const { cifrar, descifrar, indiceBusqueda } = require('../seguridad/cripto');
const { auditar } = require('../seguridad/auditoria');
const { validar } = require('../middleware/validar');
const { requiereSesion, requiereRol } = require('../middleware/auth');
const { edad, enmascarar, fechaNacimiento } = require('../util');

router.use(requiereSesion, requiereRol('PACIENTE'));

async function datosPropios(pacienteId) {
  const p = await pool.query(
    'SELECT nombres, apellidos, identificacion_cif, fecha_nacimiento, telefono FROM pacientes WHERE id = $1',
    [pacienteId],
  );
  const polizas = await pool.query(
    `SELECT po.id, a.nombre AS aseguradora, po.numero_cif, po.relacion
       FROM polizas po JOIN aseguradoras a ON a.id = po.aseguradora_id WHERE po.paciente_id = $1`,
    [pacienteId],
  );
  const dependientes = await pool.query(
    `SELECT d.id, d.estado, pa.id AS paciente_id, pa.nombres, pa.apellidos
       FROM dependientes d JOIN pacientes pa ON pa.id = d.dependiente_id WHERE d.representante_id = $1`,
    [pacienteId],
  );
  const consentimientos = await pool.query(
    `SELECT DISTINCT ON (finalidad) finalidad, aceptado, fecha
       FROM consentimientos WHERE paciente_id = $1 ORDER BY finalidad, fecha DESC, id DESC`,
    [pacienteId],
  );
  return { p: p.rows[0], polizas: polizas.rows, dependientes: dependientes.rows, consentimientos: consentimientos.rows };
}

// Vista normal: identificación y póliza enmascaradas
router.get('/yo', async (req, res) => {
  const d = await datosPropios(req.session.usuario.pacienteId);
  res.json({
    nombres: d.p.nombres,
    apellidos: d.p.apellidos,
    identificacion: enmascarar(descifrar(d.p.identificacion_cif)),
    fechaNacimiento: d.p.fecha_nacimiento,
    telefono: d.p.telefono,
    polizas: d.polizas.map((x) => ({ id: x.id, aseguradora: x.aseguradora, numero: enmascarar(descifrar(x.numero_cif)), relacion: x.relacion })),
    dependientes: d.dependientes,
    consentimientos: d.consentimientos,
  });
});

// Derecho de acceso y portabilidad (LOPDP arts. 13 y 17): exporta los datos propios completos
router.get('/yo/exportar', async (req, res) => {
  const d = await datosPropios(req.session.usuario.pacienteId);
  await auditar(req, 'EXPORTAR_DATOS', 'OK', 'pacientes/yo');
  res.json({
    ...d.p,
    identificacion_cif: undefined,
    identificacion: descifrar(d.p.identificacion_cif),
    polizas: d.polizas.map((x) => ({ aseguradora: x.aseguradora, numero: descifrar(x.numero_cif), relacion: x.relacion })),
    dependientes: d.dependientes,
    consentimientos: d.consentimientos,
  });
});

const esquemaPoliza = z.strictObject({
  aseguradoraId: z.number().int().positive(),
  numero: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{4,20}$/),
  relacion: z.enum(['TITULAR', 'BENEFICIARIO']),
});

router.post('/polizas', validar(esquemaPoliza), async (req, res) => {
  const d = req.datos;
  await pool.query(
    'INSERT INTO polizas (paciente_id, aseguradora_id, numero_cif, relacion) VALUES ($1, $2, $3, $4)',
    [req.session.usuario.pacienteId, d.aseguradoraId, cifrar(d.numero), d.relacion],
  );
  await auditar(req, 'REGISTRAR_POLIZA', 'OK', 'polizas');
  res.status(201).json({ mensaje: 'Póliza registrada. La cobertura se verifica con la aseguradora al reservar.' });
});

const esquemaDependiente = z.strictObject({
  nombres: z.string().trim().min(2).max(50).regex(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+( [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/),
  apellidos: z.string().trim().min(2).max(50).regex(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+( [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/),
  identificacion: z.string().trim().regex(/^\d{10}$/),
  fechaNacimiento,
});

// S06: el vínculo queda PENDIENTE hasta que recepción revise el documento de representación
router.post('/dependientes', validar(esquemaDependiente), async (req, res) => {
  const d = req.datos;
  const propio = req.session.usuario.pacienteId;
  if (edad(d.fechaNacimiento) >= 15) {
    return res.status(400).json({ error: 'Desde los 15 años el adolescente gestiona su propia cuenta (LOPDP art. 21)' });
  }
  const hmac = indiceBusqueda(d.identificacion);
  const existe = await pool.query('SELECT id FROM pacientes WHERE identificacion_hmac = $1', [hmac]);
  let dependienteId = existe.rows[0]?.id;
  if (!dependienteId) {
    const nuevo = await pool.query(
      `INSERT INTO pacientes (nombres, apellidos, identificacion_cif, identificacion_hmac, fecha_nacimiento)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [d.nombres, d.apellidos, cifrar(d.identificacion), hmac, d.fechaNacimiento],
    );
    dependienteId = nuevo.rows[0].id;
  }
  if (dependienteId === propio) return res.status(400).json({ error: 'No puede vincularse a sí mismo' });
  await pool.query(
    'INSERT INTO dependientes (representante_id, dependiente_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [propio, dependienteId],
  );
  await auditar(req, 'SOLICITAR_DEPENDIENTE', 'OK', `pacientes/${dependienteId}`);
  res.status(201).json({ mensaje: 'Solicitud registrada. Acérquese a recepción con el documento que acredite la representación.' });
});

const esquemaConsentimiento = z.strictObject({
  finalidad: z.enum(['RECORDATORIOS_SMS']),
  aceptado: z.boolean(),
});

// Se guarda un registro nuevo cada vez: queda el historial de aceptaciones y revocaciones
router.post('/consentimientos', validar(esquemaConsentimiento), async (req, res) => {
  const d = req.datos;
  await pool.query(
    `INSERT INTO consentimientos (paciente_id, finalidad, version, aceptado) VALUES ($1, $2, 'v1', $3)`,
    [req.session.usuario.pacienteId, d.finalidad, d.aceptado],
  );
  await auditar(req, d.aceptado ? 'ACEPTAR_CONSENTIMIENTO' : 'REVOCAR_CONSENTIMIENTO', 'OK', d.finalidad);
  res.status(201).json({ mensaje: 'Preferencia guardada' });
});

module.exports = router;
