// Carga datos de prueba. Usa la cuenta administradora de la base (solo para este script).
require('dotenv').config({ quiet: true });
const { Pool } = require('pg');
const { authenticator } = require('otplib');
const { cifrar, indiceBusqueda } = require('../src/seguridad/cripto');
const { hashear } = require('../src/seguridad/contrasenas');

const db = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
const CLAVE_DEMO = 'Demo-Segura-2026';

async function usuario(email, rol, extra = {}) {
  const secreto = rol === 'PACIENTE' ? null : authenticator.generateSecret();
  const { rows } = await db.query(
    `INSERT INTO usuarios (email, password_hash, rol, mfa_secret_cif, establecimiento_id, aseguradora_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [email, await hashear(CLAVE_DEMO), rol, cifrar(secreto), extra.establecimientoId ?? null, extra.aseguradoraId ?? null],
  );
  if (secreto) console.log(`  ${email.padEnd(24)} secreto TOTP: ${secreto}`);
  return rows[0].id;
}

async function paciente(email, nombres, apellidos, cedula, nacimiento) {
  const usuarioId = await usuario(email, 'PACIENTE');
  const { rows } = await db.query(
    `INSERT INTO pacientes (usuario_id, nombres, apellidos, identificacion_cif, identificacion_hmac, fecha_nacimiento, telefono)
     VALUES ($1, $2, $3, $4, $5, $6, '0991234567') RETURNING id`,
    [usuarioId, nombres, apellidos, cifrar(cedula), indiceBusqueda(cedula), nacimiento],
  );
  return rows[0].id;
}

async function main() {
  await db.query(`TRUNCATE audit_log, notificaciones, nonces, pagos, solicitudes_cobertura, citas, horarios,
    profesionales, dependientes, consentimientos, polizas, pacientes, usuarios, aseguradoras, establecimientos,
    "session" RESTART IDENTITY CASCADE`);

  await db.query(`INSERT INTO establecimientos (nombre, ciudad) VALUES ('Consultorio Norte', 'Quito'), ('Consultorio Sur', 'Quito')`);
  await db.query(`INSERT INTO aseguradoras (nombre) VALUES ('Aseguradora A'), ('Aseguradora B')`);

  console.log('Usuarios creados (contraseña de todos: ' + CLAVE_DEMO + ')');
  const ana = await paciente('ana@demo.ec', 'Ana', 'Torres', '1712345678', '1990-04-12');
  const luis = await paciente('luis@demo.ec', 'Luis', 'Mora', '1723456789', '1985-09-30');
  console.log('  ana@demo.ec y luis@demo.ec: pacientes, sin MFA');

  const drPerez = await usuario('dr.perez@demo.ec', 'PROFESIONAL', { establecimientoId: 1 });
  const draLopez = await usuario('dra.lopez@demo.ec', 'PROFESIONAL', { establecimientoId: 2 });
  await usuario('recepcion.norte@demo.ec', 'RECEPCION', { establecimientoId: 1 });
  await usuario('recepcion.sur@demo.ec', 'RECEPCION', { establecimientoId: 2 });
  await usuario('analista.a@demo.ec', 'ASEGURADORA', { aseguradoraId: 1 });
  await usuario('analista.b@demo.ec', 'ASEGURADORA', { aseguradoraId: 2 });
  await usuario('auditor@demo.ec', 'AUDITOR');

  await db.query(
    `INSERT INTO profesionales (usuario_id, nombres, especialidad, establecimiento_id, precio)
     VALUES ($1, 'Dr. Carlos Pérez', 'Cardiología', 1, 40.00), ($2, 'Dra. María López', 'Pediatría', 2, 35.00)`,
    [drPerez, draLopez],
  );

  // Pólizas que reconoce la aseguradora simulada (ver mocks/server.js)
  await db.query(
    `INSERT INTO polizas (paciente_id, aseguradora_id, numero_cif, relacion)
     VALUES ($1, 1, $2, 'TITULAR'), ($3, 2, $4, 'TITULAR')`,
    [ana, cifrar('POL-1001'), luis, cifrar('POL-2001')],
  );

  // Horarios de 9:00 a 12:00 (hora de Ecuador) durante los próximos 7 días
  await db.query(`
    INSERT INTO horarios (profesional_id, inicio)
    SELECT p.id, ((current_date + d) + make_interval(hours => h)) AT TIME ZONE 'America/Guayaquil'
      FROM profesionales p, generate_series(1, 7) d, generate_series(9, 12) h`);

  console.log('Datos de prueba cargados.');
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
