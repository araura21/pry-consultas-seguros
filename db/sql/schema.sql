-- Usuario con el que se conecta la API (mínimo privilegio)
CREATE ROLE app_user LOGIN PASSWORD :'app_pass';

CREATE TABLE establecimientos (
  id serial PRIMARY KEY,
  nombre text NOT NULL,
  ciudad text NOT NULL
);

CREATE TABLE aseguradoras (
  id serial PRIMARY KEY,
  nombre text NOT NULL
);

-- Una cuenta por persona (S12): no existen cuentas compartidas
CREATE TABLE usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  rol text NOT NULL CHECK (rol IN ('PACIENTE','PROFESIONAL','RECEPCION','ASEGURADORA','AUDITOR')),
  mfa_secret_cif text,
  establecimiento_id int REFERENCES establecimientos(id),
  aseguradora_id int REFERENCES aseguradoras(id),
  activo boolean NOT NULL DEFAULT true,
  creado timestamptz NOT NULL DEFAULT now()
);

-- Solo los datos mínimos (S02). No hay columnas para religión, ingresos,
-- empleador, contactos ni historia clínica completa (S04, S05).
CREATE TABLE pacientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid UNIQUE REFERENCES usuarios(id),
  nombres text NOT NULL,
  apellidos text NOT NULL,
  identificacion_cif text NOT NULL,
  identificacion_hmac text UNIQUE NOT NULL,
  fecha_nacimiento date NOT NULL,
  telefono text,
  creado timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE polizas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES pacientes(id),
  aseguradora_id int NOT NULL REFERENCES aseguradoras(id),
  numero_cif text NOT NULL,
  relacion text NOT NULL CHECK (relacion IN ('TITULAR','BENEFICIARIO'))
);

CREATE TABLE profesionales (
  id serial PRIMARY KEY,
  usuario_id uuid UNIQUE NOT NULL REFERENCES usuarios(id),
  nombres text NOT NULL,
  especialidad text NOT NULL,
  establecimiento_id int NOT NULL REFERENCES establecimientos(id),
  precio numeric(8,2) NOT NULL
);

CREATE TABLE horarios (
  id serial PRIMARY KEY,
  profesional_id int NOT NULL REFERENCES profesionales(id),
  inicio timestamptz NOT NULL,
  estado text NOT NULL DEFAULT 'LIBRE' CHECK (estado IN ('LIBRE','RESERVADO'))
);

CREATE TABLE citas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  horario_id int NOT NULL REFERENCES horarios(id),
  paciente_id uuid NOT NULL REFERENCES pacientes(id),
  reservada_por uuid NOT NULL REFERENCES usuarios(id),
  poliza_id uuid REFERENCES polizas(id),
  estado text NOT NULL CHECK (estado IN ('PENDIENTE_PAGO','CONFIRMADA','CANCELADA','ATENDIDA')),
  motivo_cif text,
  alergias_cif text,
  nota_cif text,
  copago numeric(8,2) NOT NULL,
  creada timestamptz NOT NULL DEFAULT now(),
  cancelada timestamptz
);
-- Segunda barrera contra la doble reserva de un mismo horario
CREATE UNIQUE INDEX una_cita_activa_por_horario ON citas(horario_id) WHERE estado <> 'CANCELADA';

CREATE TABLE solicitudes_cobertura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cita_id uuid NOT NULL REFERENCES citas(id),
  aseguradora_id int NOT NULL REFERENCES aseguradoras(id),
  prestacion text NOT NULL,
  elegible boolean NOT NULL,
  porcentaje int NOT NULL,
  creada timestamptz NOT NULL DEFAULT now()
);

-- Sin número de tarjeta ni CVV (S11): solo token, marca y últimos 4
CREATE TABLE pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cita_id uuid NOT NULL REFERENCES citas(id),
  referencia text UNIQUE NOT NULL,
  monto numeric(8,2) NOT NULL,
  estado text NOT NULL CHECK (estado IN ('PENDIENTE','APROBADO','RECHAZADO')),
  token text,
  marca text,
  ultimos4 char(4),
  transaccion_id text,
  actualizado timestamptz NOT NULL DEFAULT now()
);

-- El vínculo nace PENDIENTE y solo recepción lo verifica (S06)
CREATE TABLE dependientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  representante_id uuid NOT NULL REFERENCES pacientes(id),
  dependiente_id uuid NOT NULL REFERENCES pacientes(id),
  estado text NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','VERIFICADO','RECHAZADO')),
  verificado_por uuid REFERENCES usuarios(id),
  verificado_en timestamptz,
  UNIQUE (representante_id, dependiente_id)
);

-- Consentimientos opcionales, separados y revocables (S14, RN01)
CREATE TABLE consentimientos (
  id serial PRIMARY KEY,
  paciente_id uuid NOT NULL REFERENCES pacientes(id),
  finalidad text NOT NULL,
  version text NOT NULL,
  aceptado boolean NOT NULL,
  fecha timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notificaciones (
  id serial PRIMARY KEY,
  paciente_id uuid NOT NULL REFERENCES pacientes(id),
  mensaje text NOT NULL,
  creada timestamptz NOT NULL DEFAULT now()
);

-- Nonces ya usados en mensajes firmados (anti-replay, S07)
CREATE TABLE nonces (
  nonce text PRIMARY KEY,
  recibido timestamptz NOT NULL DEFAULT now()
);

-- Auditoría con hash encadenado (S12)
CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  ts timestamptz NOT NULL,
  usuario_id uuid,
  rol text,
  accion text NOT NULL,
  recurso text,
  resultado text NOT NULL,
  ip text,
  detalle text,
  hash_prev text NOT NULL,
  hash text NOT NULL
);

-- Tabla de sesiones de connect-pg-simple (S10: la sesión vive en el servidor)
CREATE TABLE "session" (
  "sid" varchar NOT NULL PRIMARY KEY,
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
);
CREATE INDEX "IDX_session_expire" ON "session" ("expire");

-- Permisos del usuario de la aplicación
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT ON establecimientos, aseguradoras, profesionales TO app_user;
GRANT SELECT, INSERT, UPDATE ON usuarios, pacientes, polizas, horarios, citas,
  solicitudes_cobertura, pagos, dependientes, consentimientos TO app_user;
GRANT SELECT, INSERT ON notificaciones, nonces TO app_user;
-- La auditoría solo admite insertar y leer: ni UPDATE ni DELETE
GRANT SELECT, INSERT ON audit_log TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "session" TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
