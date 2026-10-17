/**
 * asyncHandler
 * ------------
 * Envuelve funciones async para capturar errores automáticamente
 * y pasarlos al errorHandler.
 */

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
