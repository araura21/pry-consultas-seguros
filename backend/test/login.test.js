// P07 va en un archivo aparte porque deja bloqueado el correo durante 15 minutos
const request = require('supertest');
const { app, pool } = require('./ayuda');

afterAll(() => pool.end());

test('P07: el sexto intento fallido en 15 minutos devuelve 429', async () => {
  const intento = () => request(app).post('/api/auth/login').send({ email: 'luis@demo.ec', password: 'clave-incorrecta' });
  for (let i = 1; i <= 5; i++) expect((await intento()).status).toBe(401);
  expect((await intento()).status).toBe(429);
});
