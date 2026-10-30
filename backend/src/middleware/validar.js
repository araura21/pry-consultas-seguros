// Valida body o query con un esquema zod. Los esquemas "strict" rechazan
// cualquier campo extra (por ejemplo, un "copago" enviado desde el navegador).
function validar(esquema, origen = 'body') {
  return (req, res, next) => {
    const r = esquema.safeParse(req[origen] ?? {});
    if (!r.success) {
      const campos = r.error.issues.map((i) => i.path.join('.') || (i.keys ?? []).join(', '));
      return res.status(400).json({ error: 'Datos inválidos', campos });
    }
    req.datos = r.data;
    next();
  };
}

module.exports = { validar };
