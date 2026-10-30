const router = require('express').Router();
const pool = require('../db');
const { verificarCadena } = require('../seguridad/auditoria');
const { requiereSesion, requiereRol } = require('../middleware/auth');

router.use(requiereSesion, requiereRol('AUDITOR'));

// El auditor ve el identificador del usuario, no sus datos personales
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, ts, usuario_id, rol, accion, recurso, resultado, ip FROM audit_log ORDER BY id DESC LIMIT 200`,
  );
  res.json(rows);
});

router.get('/verificar', async (req, res) => {
  res.json(await verificarCadena());
});

module.exports = router;
