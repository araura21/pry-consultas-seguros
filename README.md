# pry-consultas-seguros

Prototipo del proyecto de la Unidad 1 de Ingeniería de la Seguridad: plataforma para buscar especialistas, reservar consultas, verificar la cobertura del seguro y pagar el copago, con los requisitos corregidos y los controles de seguridad del informe.

| Parte | Tecnología |
|---|---|
| Frontend | Angular 21 (responsive, tema claro/oscuro) |
| Backend | Node.js 22 + Express 5 |
| Base de datos | PostgreSQL 16 en Docker |
| Servicios externos simulados | Aseguradora (puerto 4001) y pasarela de pagos (puerto 4002) |
| Pruebas | Jest + Supertest |

## Requisitos

- Node.js 22.22 o superior
- Docker Desktop
- Git Bash (para los scripts `.sh`)

## Puesta en marcha

1. Copia los archivos de ejemplo y completa las claves (ver `GUIA_Prototipo_Consultas_Seguras.md`, punto 4.1):

   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   cp mocks/.env.example mocks/.env
   ```

2. Instala las dependencias:

   ```bash
   cd backend && npm install && cd ..
   cd mocks && npm install && cd ..
   cd frontend && npm install && cd ..
   ```

3. Levanta la base de datos y carga los datos de prueba:

   ```bash
   docker compose up -d
   cd backend && npm run seed
   ```

4. Abre tres terminales:

   | Carpeta | Comando |
   |---|---|
   | `backend` | `npm run dev` |
   | `mocks` | `npm start` |
   | `frontend` | `npm start` |

5. Entra a <http://localhost:4200>.

## Usuarios de prueba

Contraseña de todos: `Demo-Segura-2026`.

| Usuario | Rol |
|---|---|
| ana@demo.ec, luis@demo.ec | Paciente |
| dr.perez@demo.ec, dra.lopez@demo.ec | Profesional (MFA) |
| recepcion.norte@demo.ec, recepcion.sur@demo.ec | Recepción (MFA) |
| analista.a@demo.ec, analista.b@demo.ec | Aseguradora (MFA) |
| auditor@demo.ec | Auditor (MFA) |

El personal necesita un código TOTP. `npm run seed` muestra el secreto de cada usuario; el código actual se obtiene con `npm run totp -- <SECRETO>` dentro de `backend`.

Tarjetas de prueba en la pasarela simulada: `4111111111111111` (aprobada) y `4000000000000002` (rechazada).

## Pruebas

Con la base levantada, los datos cargados y los mocks corriendo:

```bash
cd backend
npm test
```

## Respaldo y restauración

```bash
sh scripts/respaldo.sh
sh scripts/restaurar.sh respaldos/<archivo>.sql.gz.enc
```

La explicación completa de cada control y su relación con los requisitos está en `GUIA_Prototipo_Consultas_Seguras.md`.
