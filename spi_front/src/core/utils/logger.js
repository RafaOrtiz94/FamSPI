/**
 * Sistema de logging centralizado para el frontend SPI
 * Proporciona logs estructurados con timestamps y metadatos
 */

class FrontendLogger {
 constructor() {
 this.isDevelopment = process.env.NODE_ENV === 'development';
 this.enableConsole = true;
 }

 /**
 * Formatea el mensaje de log con prefijo y timestamp
 */
 formatMessage(level, message, data = {}) {
 const timestamp = new Date().toISOString();
 const prefix = `[FRONTEND_${level.toUpperCase()}]`;
 return {
 message: `${prefix} ${message}`,
 data: {
 timestamp,
 level,
 ...data
 }
 };
 }

 /**
 * Log de información general
 */
 info(message, data = {}) {
 if (!this.enableConsole) return;

 const { message: formattedMessage, data: formattedData } = this.formatMessage('info', message, data);

 if (this.isDevelopment) {
 console.log(`%c${formattedMessage}`, 'color: #0066cc; font-weight: bold;', formattedData);
 } else {
 console.log(formattedMessage, formattedData);
 }
 }

 /**
 * Log de éxito de operaciones
 */
 success(message, data = {}) {
 if (!this.enableConsole) return;

 const { message: formattedMessage, data: formattedData } = this.formatMessage('success', message, {
 ...data,
 emoji: '✅'
 });

 if (this.isDevelopment) {
 console.log(`%c${formattedMessage}`, 'color: #28a745; font-weight: bold;', formattedData);
 } else {
 console.log(formattedMessage, formattedData);
 }
 }

 /**
 * Log de advertencias
 */
 warn(message, data = {}) {
 if (!this.enableConsole) return;

 const { message: formattedMessage, data: formattedData } = this.formatMessage('warn', message, {
 ...data,
 emoji: '⚠️'
 });

 if (this.isDevelopment) {
 console.warn(`%c${formattedMessage}`, 'color: #ffc107; font-weight: bold;', formattedData);
 } else {
 console.warn(formattedMessage, formattedData);
 }
 }

 /**
 * Log de errores
 */
 error(message, error = {}, data = {}) {
 if (!this.enableConsole) return;

 const errorInfo = error instanceof Error ? {
 message: error.message,
 stack: error.stack,
 name: error.name
 } : error;

 const { message: formattedMessage, data: formattedData } = this.formatMessage('error', message, {
 error: errorInfo,
 ...data,
 emoji: '❌'
 });

 if (this.isDevelopment) {
 console.error(`%c${formattedMessage}`, 'color: #dc3545; font-weight: bold;', formattedData);
 } else {
 console.error(formattedMessage, formattedData);
 }
 }

 /**
 * Log de debug (solo en desarrollo)
 */
 debug(message, data = {}) {
 if (!this.isDevelopment || !this.enableConsole) return;

 const { message: formattedMessage, data: formattedData } = this.formatMessage('debug', message, {
 ...data,
 emoji: '🔍'
 });

 console.debug(`%c${formattedMessage}`, 'color: #6c757d; font-style: italic;', formattedData);
 }

 /**
 * Log específico para flujos de solicitudes
 */
 requestFlow(stage, message, data = {}) {
 this.info(`[FLUJO_SOLICITUDES] ${stage}: ${message}`, {
 flow: 'requests',
 stage,
 ...data
 });
 }

 /**
 * Log específico para flujos de business cases
 */
 businessCaseFlow(stage, message, data = {}) {
 this.info(`[FLUJO_BUSINESS_CASE] ${stage}: ${message}`, {
 flow: 'business_case',
 stage,
 ...data
 });
 }

 /**
 * Log específico para flujos de clientes
 */
 clientFlow(stage, message, data = {}) {
 this.info(`[FLUJO_CLIENTES] ${stage}: ${message}`, {
 flow: 'clients',
 stage,
 ...data
 });
 }

 /**
 * Log de rendimiento
 */
 performance(operation, startTime, additionalData = {}) {
 const duration = Date.now() - startTime;
 this.info(`[PERFORMANCE] ${operation} completado en ${duration}ms`, {
 operation,
 duration,
 performance: true,
 ...additionalData
 });
 }

 /**
 * Log de API calls
 */
 apiCall(method, endpoint, data = {}) {
 this.debug(`[API] ${method} ${endpoint}`, {
 api: true,
 method,
 endpoint,
 ...data
 });
 }

 /**
 * Log de navegación
 */
 navigation(from, to, data = {}) {
 this.info(`[NAVIGATION] ${from} → ${to}`, {
 navigation: true,
 from,
 to,
 ...data
 });
 }
}

// Instancia singleton del logger
const logger = new FrontendLogger();

export default logger;
