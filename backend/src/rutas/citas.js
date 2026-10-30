const router = require('express').Router();
const crypto = require('node:crypto');
const { z } = require('zod');
const pool = require('../db');
const { cifrar, descifrar } = require('../seguridad/cripto');
const { auditar } = require('../seguridad/auditoria');
const { validar } = require('../middleware/validar');
const { requiereSesion, requiereRol } = require('../middleware/auth');
const { consultarCobertura, crearIntentoPago, notificarCita } = require('../servicios/externos');
const { esUuid } = require('../util');

router.use(requiereSesion);

const SELECT_CITA = `
  SELECT c.id, c.estado, c.copago, c.paciente_id, c.motivo_cif, c.alergias_cif, c.nota_cif,
         h.inicio, pr.nombres AS profesional, pr.especialidad, e.nombre AS establecimiento,
         pa.nombres || ' ' || pa.apellidos AS paciente,
         pg.estado AS estado_pago, pg.marca, pg.ultimos4, pg.transaccion_id
    FROM citas c
    JOIN horarios h ON h.id = c.horario_id
    JOIN profesionales pr ON pr.id = h.profesional_id
    JOIN establecimientos e ON e.id = pr.establecimiento_id
    JOIN pacientes pa ON pa.id = c.paciente_id
    LEFT JOIN pagos pg ON pg.cita_id = c.id`;

// Autorización por recurso: cada rol solo "ve" las filas que le corresponden.
// Si la cita no entra en su filtro, para él no existe (404) → evita IDOR (R11).
function filtroPorRol(u) {
  switch (u.rol) {
    case 'PACIENTE':
      return [`(c.paciente_id = $1 OR c.paciente_id IN (
                 SELECT dependiente_id FROM dependientes WHERE representante_id = $1 AND estado = 'VERIFICADO'))`, u.pacienteId];
    case 'PROFESIONAL':
      return ['pr.id = $1', u.profesionalId];
    case 'RECEPCION':
      return ['pr.establecimiento_id = $1', u.establecimientoId];
    default:
      return null;
  }
}

// Cada rol recibe solo los campos que necesita (minimización)
function vistaPorRol(c, rol) {
  const base = {
    id: c.id, estado: c.estado, inicio: c.inicio, profesional: c.profesional,
    especialidad: c.especialidad, establecimiento: c.establecimiento, paciente: c.paciente,
  };
  if (rol === 'PROFESIONAL') {
    return { ...base, motivo: descifrar(c.motivo_cif), alergias: descifrar(c.alergias_cif) };
  }
  const pago = { copago: c.copago, estadoPago: c.estado_pago, marca: c.marca, ultimos4: c.ultimos4, transaccion: c.transaccion_id };
  if (rol === 'RECEPCION') return { ...base, ...pago }; // sin motivo, alergias ni nota
  return { ...base, ...pago, motivo: descifrar(c.motivo_cif) };
}

async function buscarCita(req, id, extra = '') {
  const filtro = filtroPorRol(req.session.usuario);
  if (!filtro || !esUuid(id)) return null;
  const { rows } = await pool.query(`${SELECT_CITA} WHERE ${filtro[0]} AND c.id = $2 ${extra}`, [filtro[1], id]);
  if (!rows.length) await auditar(req, 'ACCESO_DENEGADO', 'NO_ENCONTRADO', `citas/${id}`);
  return rows[0] ?? null;
}

router.get('/', requiereRol('PACIENTE', 'PROFESIONAL', 'RECEPCION'), async (req, res) => {
  const [condicion, valor] = filtroPorRol(req.session.usuario);
  const { rows } = await pool.query(`${SELECT_CITA} WHERE ${condicion} ORDER BY h.inicio DESC LIMIT 100`, [valor]);
  res.json(rows.map((c) => vistaPorRol(c, req.session.usuario.rol)));
});

router.get('/:id', requiereRol('PACIENTE', 'PROFESIONAL', 'RECEPCION'), async (req, res) => {
  const c = await buscarCita(req, req.params.id);
  if (!c) return res.status(404).json({ error: 'Cita no encontrada' });
  await auditar(req, 'VER_CITA', 'OK', `citas/${c.id}`);
  res.json(vistaPorRol(c, req.session.usuario.rol));
});

// Ningún campo de precio o copago: si llega uno, zod lo rechaza (R14)
const esquemaCita = z.strictObject({
  horarioId: z.number().int().positive(),
  pacienteId: z.string().uuid().optional(),
  polizaId: z.string().uuid().optional(),
  motivo: z.string().trim().max(100).optional(),
  alergias: z.string().trim().max(100).optional(),
});

router.post('/', requiereRol('PACIENTE'), validar(esquemaCita), async (req, res) => {
  const u = req.session.usuario;
  const d = req.datos;

  // Reservar para otra persona solo si es un dependiente VERIFICADO (S06)
  let pacienteId = u.pacienteId;
  if (d.pacienteId && d.pacienteId !== u.pacienteId) {
    const dep = await pool.query(
      `SELECT 1 FROM dependientes WHERE representante_id = $1 AND dependiente_id = $2 AND estado = 'VERIFICADO'`,
      [u.pacienteId, d.pacienteId],
    );
    if (!dep.rows.length) {
      await auditar(req, 'RESERVA', 'DENEGADO', `pacientes/${d.pacienteId}`, { motivo: 'DEPENDIENTE_NO_VERIFICADO' });
      return res.status(403).json({ error: 'El dependiente todavía no está verificado' });
    }
    pacienteId = d.pacienteId;
  }

  // Máximo 3 citas activas por paciente para evitar el acaparamiento de turnos (R15)
  const activas = await pool.query(
    `SELECT count(*)::int AS n FROM citas WHERE paciente_id = $1 AND estado IN ('PENDIENTE_PAGO', 'CONFIRMADA')`,
    [pacienteId],
  );
  if (activas.rows[0].n >= 3) return res.status(409).json({ error: 'Ya tiene 3 citas activas' });

  let poliza = null;
  if (d.polizaId) {
    const r = await pool.query(
      'SELECT id, aseguradora_id, numero_cif FROM polizas WHERE id = $1 AND paciente_id = $2',
      [d.polizaId, u.pacienteId],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Póliza no encontrada' });
    poliza = r.rows[0];
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    // Reserva atómica: solo una petición puede pasar el horario de LIBRE a RESERVADO
    const h = await cliente.query(
      `UPDATE horarios h SET estado = 'RESERVADO' FROM profesionales pr
        WHERE h.id = $1 AND h.estado = 'LIBRE' AND h.inicio > now() AND pr.id = h.profesional_id
        RETURNING pr.precio, pr.especialidad`,
      [d.horarioId],
    );
    if (!h.rows.length) {
      await cliente.query('ROLLBACK');
      return res.status(409).json({ error: 'El horario ya no está disponible' });
    }
    const { precio, especialidad } = h.rows[0];

    let porcentaje = 0;
    let cobertura = null;
    if (poliza) {
      cobertura = await consultarCobertura({
        aseguradoraId: poliza.aseguradora_id,
        poliza: descifrar(poliza.numero_cif),
        prestacion: especialidad,
      });
      porcentaje = cobertura.elegible ? cobertura.porcentaje : 0;
    }
    // El copago se calcula en el servidor con la respuesta de la aseguradora
    const copago = Math.round(Number(precio) * (100 - porcentaje)) / 100;
    const estado = copago > 0 ? 'PENDIENTE_PAGO' : 'CONFIRMADA';

    const c = await cliente.query(
      `INSERT INTO citas (horario_id, paciente_id, reservada_por, poliza_id, estado, motivo_cif, alergias_cif, copago)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [d.horarioId, pacienteId, u.id, poliza?.id ?? null, estado, cifrar(d.motivo), cifrar(d.alergias), copago],
    );
    const citaId = c.rows[0].id;
    if (poliza) {
      await cliente.query(
        `INSERT INTO solicitudes_cobertura (cita_id, aseguradora_id, prestacion, elegible, porcentaje)
         VALUES ($1, $2, $3, $4, $5)`,
        [citaId, poliza.aseguradora_id, especialidad, cobertura.elegible, porcentaje],
      );
    }
    let urlPago = null;
    if (copago > 0) {
      const referencia = crypto.randomUUID();
      await cliente.query(
        `INSERT INTO pagos (cita_id, referencia, monto, estado) VALUES ($1, $2, $3, 'PENDIENTE')`,
        [citaId, referencia, copago],
      );
      urlPago = await crearIntentoPago({ referencia, monto: copago });
    }
    await cliente.query('COMMIT');
    await auditar(req, 'RESERVA', 'OK', `citas/${citaId}`, { copago, porcentaje });
    if (estado === 'CONFIRMADA') await notificarCita(pacienteId, citaId);
    res.status(201).json({ citaId, copago, porcentaje, urlPago });
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  } finally {
    cliente.release();
  }
});

// Borrado lógico (R19): la cita pasa a CANCELADA y el horario se libera
router.post('/:id/cancelar', requiereRol('PACIENTE', 'RECEPCION'), async (req, res) => {
  const c = await buscarCita(req, req.params.id, `AND c.estado IN ('PENDIENTE_PAGO', 'CONFIRMADA')`);
  if (!c) return res.status(404).json({ error: 'Cita no encontrada' });
  const faltanHoras = (new Date(c.inicio) - Date.now()) / 3_600_000;
  if (req.session.usuario.rol === 'PACIENTE' && faltanHoras < 24) {
    return res.status(409).json({ error: 'Solo se puede cancelar hasta 24 horas antes. Comuníquese con recepción.' });
  }
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query(`UPDATE citas SET estado = 'CANCELADA', cancelada = now() WHERE id = $1`, [c.id]);
    await cliente.query(
      `UPDATE horarios SET estado = 'LIBRE' WHERE id = (SELECT horario_id FROM citas WHERE id = $1)`,
      [c.id],
    );
    await cliente.query('COMMIT');
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  } finally {
    cliente.release();
  }
  await auditar(req, 'CANCELAR_CITA', 'OK', `citas/${c.id}`);
  res.json({ mensaje: 'Cita cancelada' });
});

// La nota solo la leen el profesional de la cita y el propio paciente; recepción recibe 403 (R11)
router.get('/:id/nota', requiereRol('PROFESIONAL', 'PACIENTE'), async (req, res) => {
  const c = await buscarCita(req, req.params.id);
  if (!c) return res.status(404).json({ error: 'Cita no encontrada' });
  await auditar(req, 'VER_NOTA', 'OK', `citas/${c.id}`);
  res.json({ nota: descifrar(c.nota_cif) });
});

const esquemaNota = z.strictObject({ nota: z.string().trim().min(1).max(2000) });

router.put('/:id/nota', requiereRol('PROFESIONAL'), validar(esquemaNota), async (req, res) => {
  const c = await buscarCita(req, req.params.id, `AND c.estado IN ('CONFIRMADA', 'ATENDIDA')`);
  if (!c) return res.status(404).json({ error: 'Cita no encontrada' });
  await pool.query(`UPDATE citas SET nota_cif = $1, estado = 'ATENDIDA' WHERE id = $2`, [cifrar(req.datos.nota), c.id]);
  await auditar(req, 'REGISTRAR_NOTA', 'OK', `citas/${c.id}`);
  res.json({ mensaje: 'Nota registrada' });
});

module.exports = router;
