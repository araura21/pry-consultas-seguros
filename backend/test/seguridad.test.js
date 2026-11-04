// Pruebas del plan de verificación (punto 7 del informe).
// Requisitos: base de datos levantada, "npm run seed" ejecutado y los mocks corriendo.
const crypto = require('node:crypto');
const request = require('supertest');
const { app, pool, entrar, horarioLibre } = require('./ayuda');
const { firmar } = require('../src/seguridad/firma');
const { verificarCadena } = require('../src/seguridad/auditoria');
const { PAYMENT_SECRET } = require('../src/config');

let ana;
let citaAna;
let citaConSeguro;
const creadas = [];

beforeAll(async () => {
  ana = await entrar('ana@demo.ec');
  const r = await ana.post('/api/citas').send({ horarioId: await horarioLibre(1), motivo: 'Dolor en el pecho' });
  expect(r.status).toBe(201);
  citaAna = r.body.citaId;
  creadas.push(citaAna);
});

afterAll(async () => {
  for (const id of creadas) await ana.post(`/api/citas/${id}/cancelar`);
  await pool.end();
});

describe('Sesiones (R03)', () => {
  test('P04: la cookie es HttpOnly y SameSite=Strict, y no hay token en la respuesta', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'luis@demo.ec', password: 'Demo-Segura-2026' });
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(JSON.stringify(res.body)).not.toMatch(/sid|token/i);
  });

  test('P05: el identificador de sesión cambia al iniciar sesión', async () => {
    const agente = request.agent(app);
    const a = await agente.post('/api/auth/login').send({ email: 'luis@demo.ec', password: 'Demo-Segura-2026' });
    const b = await agente.post('/api/auth/login').send({ email: 'luis@demo.ec', password: 'Demo-Segura-2026' });
    expect(a.headers['set-cookie'][0].split(';')[0]).not.toBe(b.headers['set-cookie'][0].split(';')[0]);
  });

  test('P06: después de cerrar sesión la cookie anterior ya no sirve', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'luis@demo.ec', password: 'Demo-Segura-2026' });
    const cookie = res.headers['set-cookie'][0].split(';')[0];
    expect((await request(app).post('/api/auth/logout').set('Cookie', cookie)).status).toBe(204);
    expect((await request(app).get('/api/auth/yo').set('Cookie', cookie)).status).toBe(401);
  });
});

describe('Autenticación (R05, R12)', () => {
  test('P08: se rechaza una contraseña común', async () => {
    const res = await request(app).post('/api/auth/registro').send({
      email: 'nuevo@demo.ec', password: 'Password123!', nombres: 'Nuevo', apellidos: 'Paciente',
      identificacion: '1700000001', fechaNacimiento: '1995-01-01',
    });
    expect(res.status).toBe(400);
  });

  test('P09: el personal no entra sin el código TOTP', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'recepcion.norte@demo.ec', password: 'Demo-Segura-2026' });
    expect(res.status).toBe(401);
    await expect(entrar('recepcion.norte@demo.ec')).resolves.toBeDefined(); // con TOTP sí entra
  });
});

describe('Autorización por recurso (R01, R11)', () => {
  test('P01: un paciente no puede ver la cita de otro (404) y queda auditado', async () => {
    const luis = await entrar('luis@demo.ec');
    expect((await luis.get(`/api/citas/${citaAna}`)).status).toBe(404);
    const { rows } = await pool.query(
      `SELECT 1 FROM audit_log WHERE accion = 'ACCESO_DENEGADO' AND recurso = $1`, [`citas/${citaAna}`],
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  test('P02: recepción no puede leer la nota clínica (403) ni ve el motivo', async () => {
    const recepcion = await entrar('recepcion.norte@demo.ec');
    expect((await recepcion.get(`/api/citas/${citaAna}/nota`)).status).toBe(403);
    const cita = await recepcion.get(`/api/citas/${citaAna}`);
    expect(cita.status).toBe(200);
    expect(cita.body).not.toHaveProperty('motivo');
  });

  test('P03: una aseguradora solo ve las solicitudes de sus afiliados', async () => {
    const poliza = (await ana.get('/api/pacientes/yo')).body.polizas[0].id;
    const r = await ana.post('/api/citas').send({ horarioId: await horarioLibre(1), polizaId: poliza });
    expect(r.status).toBe(201);
    expect(r.body.porcentaje).toBe(80);
    expect(r.body.copago).toBe(8);
    citaConSeguro = r.body.citaId;
    creadas.push(citaConSeguro);

    const { rows } = await pool.query('SELECT id FROM solicitudes_cobertura WHERE cita_id = $1', [citaConSeguro]);
    const analistaA = await entrar('analista.a@demo.ec');
    const analistaB = await entrar('analista.b@demo.ec');
    const propia = await analistaA.get(`/api/aseguradora/solicitudes/${rows[0].id}`);
    expect(propia.status).toBe(200);
    for (const campo of ['motivo', 'alergias', 'nota']) expect(propia.body).not.toHaveProperty(campo);
    expect((await analistaB.get(`/api/aseguradora/solicitudes/${rows[0].id}`)).status).toBe(404);
  });

  test('P16: no se puede reservar para un dependiente sin verificar', async () => {
    await ana.post('/api/pacientes/dependientes').send({
      nombres: 'Sofía', apellidos: 'Torres', identificacion: '1750000002', fechaNacimiento: '2018-06-01',
    });
    const dep = (await ana.get('/api/pacientes/yo')).body.dependientes.find((d) => d.nombres === 'Sofía');
    expect(dep.estado).toBe('PENDIENTE');
    const r = await ana.post('/api/citas').send({ horarioId: await horarioLibre(2), pacienteId: dep.paciente_id });
    expect(r.status).toBe(403);
  });
});

describe('Validación (R14)', () => {
  test('P10: el copago enviado por el navegador se rechaza', async () => {
    const r = await ana.post('/api/citas').send({ horarioId: await horarioLibre(2), copago: 0 });
    expect(r.status).toBe(400);
  });
});

describe('Integraciones firmadas (R13) y pagos (R04)', () => {
  const firmado = (cuerpo) => ({ 'content-type': 'application/json', ...firmar(cuerpo, PAYMENT_SECRET) });
  const webhook = (cuerpo, headers) => request(app).post('/api/pagos/webhook').set(headers).send(cuerpo);

  test('P11: un webhook reenviado (mismo nonce) o viejo se rechaza', async () => {
    const cuerpo = JSON.stringify({ referencia: crypto.randomUUID(), estado: 'APROBADO', monto: 1, token: 't', marca: 'VISA', ultimos4: '1111', transaccionId: 'x' });
    const headers = firmado(cuerpo);
    expect((await webhook(cuerpo, headers)).status).toBe(404); // firma válida, referencia inexistente
    expect((await webhook(cuerpo, headers)).status).toBe(401); // replay
    const viejo = { ...firmado(cuerpo), 'x-timestamp': String(Date.now() - 10 * 60 * 1000) };
    expect((await webhook(cuerpo, viejo)).status).toBe(401);
  });

  test('P12: si se altera el cuerpo, la firma deja de ser válida', async () => {
    const cuerpo = JSON.stringify({ referencia: crypto.randomUUID(), estado: 'APROBADO', monto: 1, token: 't', marca: 'VISA', ultimos4: '1111', transaccionId: 'x' });
    const headers = firmado(cuerpo);
    expect((await webhook(cuerpo.replace('"monto":1', '"monto":0'), headers)).status).toBe(401);
  });

  test('P13 y P14: el pago aprobado guarda solo token y últimos 4, y la notificación es genérica', async () => {
    const { rows } = await pool.query('SELECT referencia FROM pagos WHERE cita_id = $1', [citaConSeguro]);
    const cuerpo = JSON.stringify({ referencia: rows[0].referencia, estado: 'APROBADO', monto: 8, token: 'tok_prueba', marca: 'VISA', ultimos4: '1111', transaccionId: 'tx_prueba' });
    expect((await webhook(cuerpo, firmado(cuerpo))).status).toBe(200);

    const columnas = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'pagos'`);
    const nombres = columnas.rows.map((c) => c.column_name);
    for (const campo of ['tarjeta', 'numero_tarjeta', 'cvv']) expect(nombres).not.toContain(campo);
    const pan = await pool.query(`SELECT count(*)::int AS n FROM pagos WHERE concat_ws(' ', token, ultimos4, transaccion_id) ~ '\\d{13,19}'`);
    expect(pan.rows[0].n).toBe(0);

    const n = await pool.query('SELECT mensaje FROM notificaciones ORDER BY id DESC LIMIT 1');
    expect(n.rows[0].mensaje).toMatch(/Abre la app/);
    expect(n.rows[0].mensaje).not.toMatch(/Cardiología|POL-|Pérez/);
  });
});

describe('Datos y auditoría (R02, R16, R19)', () => {
  test('P18: la cédula está cifrada en la base de datos', async () => {
    const { rows } = await pool.query(
      `SELECT p.identificacion_cif FROM pacientes p JOIN usuarios u ON u.id = p.usuario_id WHERE u.email = 'ana@demo.ec'`,
    );
    expect(rows[0].identificacion_cif).not.toContain('1712345678');
    expect(rows[0].identificacion_cif.split('.')).toHaveLength(3); // iv.tag.ct
  });

  test('P15: la aplicación no puede modificar la auditoría y la cadena es válida', async () => {
    await expect(pool.query(`UPDATE audit_log SET resultado = 'X' WHERE id = 1`)).rejects.toThrow(/permission denied/);
    await expect(pool.query('DELETE FROM audit_log')).rejects.toThrow(/permission denied/);
    expect((await verificarCadena()).ok).toBe(true);
  });

  test('P24: cancelar es un borrado lógico', async () => {
    const r = await ana.post(`/api/citas/${citaAna}/cancelar`);
    expect(r.status).toBe(200);
    const { rows } = await pool.query('SELECT estado FROM citas WHERE id = $1', [citaAna]);
    expect(rows[0].estado).toBe('CANCELADA');
  });
});
