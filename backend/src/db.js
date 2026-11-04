const { Pool, types } = require('pg');
const { DATABASE_URL } = require('./config');

// Las fechas sin hora (DATE) se devuelven como texto 'AAAA-MM-DD', sin desfase de zona horaria
types.setTypeParser(1082, (v) => v);

// Todas las consultas usan parámetros ($1, $2...): nunca se concatena texto del usuario
module.exports = new Pool({ connectionString: DATABASE_URL, max: 10 });
