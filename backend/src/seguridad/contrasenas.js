const argon2 = require('argon2');

// Parámetros mínimos que recomienda OWASP para argon2id
const OPCIONES = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

// Lista corta de ejemplo. En un sistema real se usa una lista grande (p. ej. las 10 000 más comunes)
const COMUNES = new Set([
  'password123!', 'password1234', '123456789012', 'qwertyuiop12', 'contraseña123',
  'contrasena123', 'admin1234567', 'ecuador12345', 'iloveyou1234', 'bienvenido123',
]);

function validarContrasena(password, email) {
  if (password.length < 12) return 'La contraseña debe tener al menos 12 caracteres';
  if (COMUNES.has(password.toLowerCase())) return 'Esa contraseña es muy común, elige otra';
  const usuario = email.split('@')[0].toLowerCase();
  if (usuario.length >= 4 && password.toLowerCase().includes(usuario)) return 'La contraseña no debe contener tu correo';
  return null;
}

const hashear = (password) => argon2.hash(password, OPCIONES);

// Si el usuario no existe se verifica contra un hash ficticio para que la
// respuesta tarde lo mismo y no revele qué correos están registrados
const FICTICIO = argon2.hash('valor-ficticio-solo-para-igualar-tiempos', OPCIONES);

async function verificar(hash, password) {
  if (!hash) {
    await argon2.verify(await FICTICIO, password);
    return false;
  }
  return argon2.verify(hash, password);
}

module.exports = { validarContrasena, hashear, verificar };
