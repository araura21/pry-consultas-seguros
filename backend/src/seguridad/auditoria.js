const crypto = require('node:crypto');
const pool = require('../db');

function calcularHash(f) {
  const datos = [f.hash_prev, f.ts, f.usuario_id ?? '', f.rol ?? '', f.accion,
    f.recurso ?? '', f.resultado, f.ip ?? '', f.detalle ?? ''].join('|');
  return crypto.createHash('sha256').update(datos).digest('hex');
}

// Registra quién, qué, cuándo, desde dónde, sobre qué recurso y con qué resultado.
// No se guardan datos clínicos ni contraseñas en "detalle".
async function auditar(req, accion, resultado, recurso = null, detalle = null) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    // Un solo escritor a la vez para que la cadena de hashes no se bifurque
    await cliente.query('SELECT pg_advisory_xact_lock(42)');
    const { rows } = await cliente.query('SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1');
    const usuario = req.session?.usuario;
    const f = {
      hash_prev: rows[0]?.hash ?? 'GENESIS',
      ts: new Date().toISOString(),
      usuario_id: usuario?.id ?? null,
      rol: usuario?.rol ?? null,
      accion,
      recurso,
      resultado,
      ip: req.ip ?? null,
      detalle: detalle ? JSON.stringify(detalle) : null,
    };
    f.hash = calcularHash(f);
    await cliente.query(
      `INSERT INTO audit_log (ts, usuario_id, rol, accion, recurso, resultado, ip, detalle, hash_prev, hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [f.ts, f.usuario_id, f.rol, f.accion, f.recurso, f.resultado, f.ip, f.detalle, f.hash_prev, f.hash],
    );
    await cliente.query('COMMIT');
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  } finally {
    cliente.release();
  }
}

// Recalcula la cadena completa. Si alguien alteró una fila, el hash ya no coincide.
async function verificarCadena(db = pool) {
  const { rows } = await db.query('SELECT * FROM audit_log ORDER BY id');
  let anterior = 'GENESIS';
  for (const r of rows) {
    const f = { ...r, ts: r.ts.toISOString() };
    if (r.hash_prev !== anterior || calcularHash(f) !== r.hash) {
      return { ok: false, filas: rows.length, filaAlterada: Number(r.id) };
    }
    anterior = r.hash;
  }
  return { ok: true, filas: rows.length };
}

module.exports = { auditar, verificarCadena };
