// Aplica los plazos de conservación (S14). Se ejecuta a mano o programado una vez al día.
require('dotenv').config({ quiet: true });
const { Pool } = require('pg');

const db = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });

const tareas = [
  // Libera horarios de reservas que no se pagaron en 30 minutos
  ['Reservas sin pagar', `
    WITH vencidas AS (
      UPDATE citas SET estado = 'CANCELADA', cancelada = now()
       WHERE estado = 'PENDIENTE_PAGO' AND creada < now() - interval '30 minutes'
      RETURNING horario_id)
    UPDATE horarios SET estado = 'LIBRE' WHERE id IN (SELECT horario_id FROM vencidas)`],
  // Motivo y alergias: 90 días después de la cita (luego quedan en la historia clínica del establecimiento)
  ['Motivo y alergias', `
    UPDATE citas c SET motivo_cif = NULL, alergias_cif = NULL
      FROM horarios h
     WHERE h.id = c.horario_id AND h.inicio < now() - interval '90 days'
       AND (c.motivo_cif IS NOT NULL OR c.alergias_cif IS NOT NULL)`],
  ['Notificaciones', `DELETE FROM notificaciones WHERE creada < now() - interval '30 days'`],
  ['Nonces', `DELETE FROM nonces WHERE recibido < now() - interval '1 day'`],
];

async function main() {
  for (const [nombre, sql] of tareas) {
    const r = await db.query(sql);
    console.log(`${nombre}: ${r.rowCount} filas`);
  }
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
