const logger = require('../config/logger');

/**
 * Middleware para autenticar requests de jobs internos
 * Requiere header x-jobs-key con el valor correcto
 */
module.exports = (req, res, next) => {
  const JOBS_KEY = process.env.JOBS_KEY;
  
  if (!JOBS_KEY) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('JOBS_KEY no configurado en produccion - bloqueando endpoint interno');
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Internal jobs auth is not configured'
      });
    }
    logger.warn('JOBS_KEY no configurado - permitiendo requests solo en entorno no productivo');
    return next();
  }
  
  const authHeader = req.headers['x-jobs-key'];
  
  if (authHeader === JOBS_KEY) {
    return next();
  }
  
  logger.warn('Intento de acceso no autorizado a endpoint de jobs', {
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  return res.status(401).json({ 
    error: 'Unauthorized',
    message: 'Invalid jobs key'
  });
};
