# CONTEXT.md — attendance

## 1. Descripción
Módulo de control de asistencia. Permite a colaboradores marcar entrada/salida, pausas de almuerzo, salidas imprevistas y visitas de campo. Incluye soporte para iPhone shortcuts (aliases en español), geolocalización, horas extras, excepciones, reportes de rango y generación de PDF. Tiene una doble ruta de acceso: `/api/v1/attendance` y `/asistencia`.

## 2. Endpoints

- **POST /api/v1/attendance/clock-in** | alias: `/marcar/entrada`
  - Controller: `attendance.controller.js → clockIn`
  - Service: `attendance.service.js`
  - Middleware: `verifyToken`
  - Roles requeridos: Cualquier usuario autenticado

- **POST /api/v1/attendance/clock-out** | alias: `/marcar/salida`
  - Controller: `attendance.controller.js → clockOut`
  - Middleware: `verifyToken`

- **POST /api/v1/attendance/clock-out-lunch** | alias: `/marcar/almuerzo-salida`
  - Controller: `attendance.controller.js → clockOutLunch`
  - Middleware: `verifyToken`

- **POST /api/v1/attendance/clock-in-lunch** | alias: `/marcar/almuerzo-entrada`
  - Controller: `attendance.controller.js → clockInLunch`
  - Middleware: `verifyToken`

- **POST /api/v1/attendance/marcar/visita-entrada** | alias: `/marcar/cliente-entrada`
  - Controller: `attendance.controller.js → clockInField`
  - Middleware: `verifyToken`

- **POST /api/v1/attendance/marcar/visita-salida** | alias: `/marcar/cliente-salida`
  - Controller: `attendance.controller.js → clockOutField`
  - Middleware: `verifyToken`

- **POST /api/v1/attendance/marcar/salida-imprevista**
  - Controller: `attendance.controller.js → clockOutUnexpected`
  - Middleware: `verifyToken`

- **POST /api/v1/attendance/marcar/regreso-imprevisto**
  - Controller: `attendance.controller.js → clockInUnexpected`
  - Middleware: `verifyToken`

- **POST /api/v1/attendance/marcar/salida-oficina** | `/marcar/entrada-oficina` | `/marcar/salida-campo` | `/marcar/entrada-campo`
  - Controller: `attendance.controller.js → clockOutOperational` / `clockInOperational`
  - Middleware: `verifyToken`

- **POST /api/v1/attendance/late-justification**
  - Controller: `attendance.controller.js → justifyLateArrival`
  - Middleware: `verifyToken`

- **POST /api/v1/attendance/location-sync**
  - Controller: `attendance.controller.js → syncLocation`
  - Middleware: `verifyToken`

- **POST /api/v1/attendance/exception**
  - Controller: `attendance.controller.js → registerException`
  - Middleware: `verifyToken`

- **POST /api/v1/attendance/exception/status**
  - Controller: `attendance.controller.js → updateExceptionStatus`
  - Middleware: `verifyToken`

- **GET /api/v1/attendance/exception/active**
  - Controller: `attendance.controller.js → getActiveException`
  - Middleware: `verifyToken`

- **POST /api/v1/attendance/overtime**
  - Controller: `attendance.controller.js → markOvertime`
  - Middleware: `verifyToken`

- **GET /api/v1/attendance/overtime**
  - Controller: `attendance.controller.js → getOvertimeRecords`
  - Middleware: `verifyToken`

- **GET /api/v1/attendance/today**
  - Controller: `attendance.controller.js → getToday`
  - Middleware: `verifyToken`

- **GET /api/v1/attendance/user/:userId**
  - Controller: `attendance.controller.js → getUserAttendance`
  - Middleware: `verifyToken`, `requireAttendanceReportAccess("param")`
  - Roles requeridos: Controlado por `attendance.auth.js`

- **GET /api/v1/attendance/range**
  - Controller: `attendance.controller.js → getRange`
  - Middleware: `verifyToken`, `requireAttendanceReportAccess("query", { allowAll: true })`, rate limit (30 req/min)
  - Roles requeridos: Controlado por `attendance.auth.js`

- **GET /api/v1/attendance/operational-health**
  - Controller: `attendance.controller.js → getOperationalHealth`
  - Middleware: `verifyToken`, `requireAttendanceOpsAccess` (inline, verifica `hasReportingAccess`)

- **GET /api/v1/attendance/pdf/:userId**
  - Controller: `attendance.controller.js → generatePDF`
  - Middleware: `verifyToken`, `requireAttendanceReportAccess("param", { allowAll: true })`

## 3. Flujo principal

1. Colaborador marca entrada desde app/iPhone shortcut → `POST /clock-in` o `/marcar/entrada`
2. Sistema registra timestamp, geolocalización (si aplica) y tipo de marcación
3. Durante el día: marcaciones de almuerzo, visitas de campo, salidas imprevistas
4. Al final del día: `clock-out`
5. TH/Finanzas/Gerencia consultan reportes por usuario o rango de fechas
6. PDF generado por usuario bajo demanda

## 4. Validaciones
- `attendance.auth.js`: control de acceso específico para reportes (`requireAttendanceReportAccess`)
- `attendanceGeo.utils.js`: utilidades de geolocalización
- `attendanceRangeFilters.js`: filtros para reportes por rango de fechas
- Rate limit en `/range`: 30 req/min por IP
- `attendanceAudit.service.js`: registro de auditoría de cambios

## 5. Base de datos

### Tablas usadas:
- No verificado en DB

### Campos relevantes:
- No verificado en DB

## 6. Relaciones
- `attendance.service.js` (27KB): lógica de negocio principal
- `attendanceReports.service.js` (26KB): generación de reportes
- Dependencias con otros módulos: `notifications` (probable, no verificado)

## 7. Frontend asociado
- Rutas React:
  - `/asistencia/marcar/:action` → `AttendanceAction`
  - `/dashboard/talento-humano/asistencia-reportes` → `AsistenciaReportes`
  - `/dashboard/servicio-tecnico/asistencia` → `ServicioAsistencia`
- Roles con acceso a reportes: `talento_humano`, `gerencia`, `finanzas`, `admin`

## 8. Riesgos detectados
- `attendance.controller.js` pesa 103KB — altísima concentración de lógica, difícil de mantener
- Doble ruta de acceso (`/api/v1/attendance` y `/asistencia`) puede generar confusión en logs
- La lógica de autorización de reportes está en `attendance.auth.js` separada de `roles.js` — inconsistencia con el patrón del resto de módulos

## 9. Notas técnicas
- Alias en español creados para compatibilidad con iPhone Shortcuts (`/marcar/entrada`, etc.)
- `ATTENDANCE_PRODUCTION_CHECKLIST.md` existe en el módulo — documentación de despliegue
- Directorio `__tests__` presente
