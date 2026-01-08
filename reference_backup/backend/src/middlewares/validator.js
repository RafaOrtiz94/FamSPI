/**
 * Middleware de validación Zod para SPI Fam
 * -----------------------------------------
 * Valida el cuerpo (body), query o params según un esquema.
 * Si hay error, devuelve 400 con detalles.
 */

const { ZodError } = require("zod");

function validate(schema, target = "body") {
  return (req, res, next) => {
    try {
      req[target] = schema.parse(req[target]);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map(e => ({
          path: e.path.join("."),
          message: e.message
        }));
        return res.status(400).json({
          ok: false,
          error: "Datos inválidos",
          details
        });
      }
      next(err);
    }
  };
}

module.exports = { validate };
