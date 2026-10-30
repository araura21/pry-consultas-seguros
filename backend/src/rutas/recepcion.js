const router = require('express').Router();
const { z } = require('zod');
const pool = require('../db');
const { descifrar } = require('../seguridad/cripto');
const { auditar } = require('../seguridad/auditoria');
const { validar } = require('../middleware/validar');
const { requiereSesion, requiereRol } = require('../middleware/auth');
const { enmascarar, esUuid } = require('../util');

router.use(requiereSesion, requiereRol('RECEPCION'));

// Solicitudes de vínculo pendientes; recepción compara con el documento físico
router.get('/dependientes', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT d.id, r.nombres || ' ' || r.apellidos AS representante,
            p.nombres || ' ' || p.apellidos AS dependiente, p.identificacion_cif, p.fecha_nacimiento
       FROM dependientes d
       JOIN pacientes r ON r.id = d.representante_id
       JOIN pacientes p ON p.id = d.dependiente_id
      WHERE d.estado = 'PENDIENTE' ORDER BY d.id LIMIT 50`,
  );
  res.json(rows.map(({ identificacion_cif, ...x }) => ({ ...x, identificacion: enmascarar(descifrar(identificacion_cif)) })));
});

const esquemaDecision = z.strictObject({ aprobar: z.boolean() });

router.post('/dependientes/:id', validar(esquemaDecision), async (req, res) => {
  if (!esUuid(req.params.id)) return res.status(404).json({ error: 'No encontrado' });
  const estado = req.datos.aprobar ? 'VERIFICADO' : 'RECHAZADO';
  const r = await pool.query(
    `UPDATE dependientes SET estado = $1, verificado_por = $2, verificado_en = now()
      WHERE id = $3 AND estado = 'PENDIENTE' RETURNING id`,
    [estado, req.session.usuario.id, req.params.id],
  );
  if (!r.rows.length) return res.status(404).json({ error: 'No encontrado' });
  await auditar(req, 'VERIFICAR_DEPENDIENTE', estado, `dependientes/${req.params.id}`);
  res.json({ mensaje: `Vínculo ${estado.toLowerCase()}` });
});

module.exports = router;
