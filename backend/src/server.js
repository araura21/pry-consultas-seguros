const app = require('./app');
const { PORT } = require('./config');

// Solo escucha en el propio equipo; el navegador entra por el proxy de Angular
app.listen(PORT, '127.0.0.1', () => {
  console.log(`API escuchando en http://127.0.0.1:${PORT}`);
});
