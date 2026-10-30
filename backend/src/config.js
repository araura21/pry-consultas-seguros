require('dotenv').config({ quiet: true });
const { z } = require('zod');

// Si falta un secreto o es débil, la API no arranca (falla de forma segura)
const esquema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  DATA_KEY: z.string().regex(/^[0-9a-f]{64}$/i, 'DATA_KEY debe tener 64 caracteres hexadecimales'),
  HMAC_KEY: z.string().min(32),
  INSURER_URL: z.string().min(1),
  INSURER_SECRET: z.string().min(32),
  PAYMENT_URL: z.string().min(1),
  PAYMENT_SECRET: z.string().min(32),
  FRONTEND_ORIGIN: z.string().min(1),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
});

module.exports = esquema.parse(process.env);
