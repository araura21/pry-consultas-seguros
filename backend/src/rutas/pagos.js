const router = require('express').Router();
const { z } = require('zod');
const pool = require('../db');
const env = require('../config');
const { verificarMensaje } = require('../seguridad/firma');
const { auditar } = require('../seguridad/auditoria');
const { notificarCita } = require('../servicios/externos');

const esquemaWebhook = z.strictObject({
  referencia: z.string().uuid(),
  estado: z.enum(['APROBADO', 'RECHAZADO']),
  monto: z.number().positive(),
  token: z.string().max(100),
  marca: z.string().max(20),
  ultimos4: z.string().regex(/^\d{4}$/),
  transaccionId: z.string().max(100),
});

// La pasarela avisa el resultado. Sin firma válida y nonce nuevo no se acepta (R13).
router.post('/webhook', async (req, res) => {
  if (!(await verificarMensaje(req.rawBody ?? '', req.headers, env.PAYMENT_SECRET))) {
    await auditar(req, 'WEBHOOK_PAGO', 'FIRMA_INVALIDA');
    return res.status(401).json({ error: 'Firma inválida' });
  }
  const r = esquemaWebhook.safeParse(req.body);
  if (!r.success) return res.status(400).json({ error: 'Datos inválidos' });
  const d = r.data;

  const cliente = await pool.connect();
  let pago;
  try {
    await cliente.query('BEGIN');
    const p = await cliente.query(
      `SELECT pg.id, pg.cita_id, pg.monto, pg.estado, c.paciente_id
         FROM pagos pg JOIN citas c ON c.id = pg.cita_id WHERE pg.referencia = $1 FOR UPDATE OF pg`,
      [d.referencia],
    );
    pago = p.rows[0];
    if (!pago) {
      await cliente.query('ROLLBACK');
      return res.status(404).json({ error: 'Pago no encontrado' });
    }
    if (pago.estado !== 'PENDIENTE') {
      await cliente.query('ROLLBACK');
      return res.json({ ok: true }); // idempotente: ya se procesó
    }
    if (Number(pago.monto) !== d.monto) {
      await cliente.query('ROLLBACK');
      await auditar(req, 'WEBHOOK_PAGO', 'MONTO_NO_COINCIDE', `pagos/${pago.id}`);
      return res.status(400).json({ error: 'Monto no coincide' });
    }
    // Solo se guarda token, marca y últimos 4: nunca el número de tarjeta (S11)
    await cliente.query(
      `UPDATE pagos SET estado = $1, token = $2, marca = $3, ultimos4 = $4, transaccion_id = $5, actualizado = now()
        WHERE id = $6`,
      [d.estado, d.token, d.marca, d.ultimos4, d.transaccionId, pago.id],
    );
    if (d.estado === 'APROBADO') {
      await cliente.query(`UPDATE citas SET estado = 'CONFIRMADA' WHERE id = $1`, [pago.cita_id]);
    } else {
      await cliente.query(`UPDATE citas SET estado = 'CANCELADA', cancelada = now() WHERE id = $1`, [pago.cita_id]);
      await cliente.query(
        `UPDATE horarios SET estado = 'LIBRE' WHERE id = (SELECT horario_id FROM citas WHERE id = $1)`,
        [pago.cita_id],
      );
    }
    await cliente.query('COMMIT');
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  } finally {
    cliente.release();
  }
  await auditar(req, 'WEBHOOK_PAGO', d.estado, `pagos/${pago.id}`);
  if (d.estado === 'APROBADO') await notificarCita(pago.paciente_id, pago.cita_id);
  res.json({ ok: true });
});

module.exports = router;
