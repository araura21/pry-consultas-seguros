const router = require('express').Router();
const { z } = require('zod');
const pool = require('../db');
const { validar } = require('../middleware/validar');
const { requiereSesion } = require('../middleware/auth');

router.use(requiereSesion);

const esquemaBusqueda = z.strictObject({
  especialidad: z.string().trim().max(50).optional(),
  ciudad: z.string().trim().max(50).optional(),
});

// La búsqueda no pide ni devuelve datos clínicos (S04)
router.get('/', validar(esquemaBusqueda, 'query'), async (req, res) => {
  const { especialidad, ciudad } = req.datos;
  const { rows } = await pool.query(
    `SELECT pr.id, pr.nombres, pr.especialidad, pr.precio, e.nombre AS establecimiento, e.ciudad
       FROM profesionales pr JOIN establecimientos e ON e.id = pr.establecimiento_id
      WHERE ($1::text IS NULL OR pr.especialidad ILIKE '%' || $1 || '%')
        AND ($2::text IS NULL OR e.ciudad ILIKE $2)
      ORDER BY pr.nombres LIMIT 50`,
    [especialidad || null, ciudad || null],
  );
  res.json(rows);
});

router.get('/:id/horarios', async (req, res) => {
  const id = z.coerce.number().int().positive().safeParse(req.params.id);
  if (!id.success) return res.status(404).json({ error: 'No encontrado' });
  const { rows } = await pool.query(
    `SELECT id, inicio FROM horarios
      WHERE profesional_id = $1 AND estado = 'LIBRE' AND inicio > now()
      ORDER BY inicio LIMIT 100`,
    [id.data],
  );
  res.json(rows);
});

module.exports = router;
