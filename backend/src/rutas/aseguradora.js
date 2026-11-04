const router = require('express').Router();
const pool = require('../db');
const { descifrar } = require('../seguridad/cripto');
const { auditar } = require('../seguridad/auditoria');
const { requiereSesion, requiereRol } = require('../middleware/auth');
const { enmascarar, esUuid } = require('../util');

router.use(requiereSesion, requiereRol('ASEGURADORA'));

// S08: cada aseguradora ve solo las solicitudes de SUS afiliados y solo campos mínimos.
// No hay datos clínicos ni pacientes de otras aseguradoras.
const SELECT_SOLICITUD = `
  SELECT s.id, s.prestacion, s.elegible, s.porcentaje, s.creada, h.inicio, e.nombre AS establecimiento,
         po.numero_cif
    FROM solicitudes_cobertura s
    JOIN citas c ON c.id = s.cita_id
    JOIN horarios h ON h.id = c.horario_id
    JOIN profesionales pr ON pr.id = h.profesional_id
    JOIN establecimientos e ON e.id = pr.establecimiento_id
    LEFT JOIN polizas po ON po.id = c.poliza_id
   WHERE s.aseguradora_id = $1`;

const vista = ({ numero_cif, ...s }) => ({ ...s, poliza: enmascarar(descifrar(numero_cif)) });

router.get('/solicitudes', async (req, res) => {
  const { rows } = await pool.query(`${SELECT_SOLICITUD} ORDER BY s.creada DESC LIMIT 100`, [req.session.usuario.aseguradoraId]);
  res.json(rows.map(vista));
});

router.get('/solicitudes/:id', async (req, res) => {
  const { rows } = esUuid(req.params.id)
    ? await pool.query(`${SELECT_SOLICITUD} AND s.id = $2`, [req.session.usuario.aseguradoraId, req.params.id])
    : { rows: [] };
  if (!rows.length) {
    await auditar(req, 'ACCESO_DENEGADO', 'NO_ENCONTRADO', `solicitudes/${req.params.id}`);
    return res.status(404).json({ error: 'No encontrado' });
  }
  await auditar(req, 'VER_SOLICITUD', 'OK', `solicitudes/${req.params.id}`);
  res.json(vista(rows[0]));
});

module.exports = router;
