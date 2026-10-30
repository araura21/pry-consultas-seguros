// Muestra el código TOTP actual de un secreto (reemplaza a la app de autenticación en la demo)
const { authenticator } = require('otplib');

const secreto = process.argv[2];
if (!secreto) {
  console.log('Uso: npm run totp -- <SECRETO>');
  process.exit(1);
}
console.log(`Código actual: ${authenticator.generate(secreto)} (cambia cada 30 segundos)`);
