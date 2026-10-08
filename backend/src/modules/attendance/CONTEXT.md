# CONTEXT.md — attendance

## 1. Descripción
Módulo de control de asistencia. Permite a colaboradores marcar entrada/salida, pausas de almuerzo, salidas imprevistas y visitas de campo. Incluye soporte para iPhone shortcuts (aliases en español), geolocalización, horas extras, excepciones, reportes de rango y generación de PDF. Tiene una doble ruta de acceso: `/api/v1/attendance` y `/asistencia`.

## 2. Endpoints

- **POST /api/v1/attendance/shortcut/run-smart-mark** (Siri Smart Attendance)
  - Controller: `attendanceShortcut.controller.js → runSmartMark`
  - Service: `attendanceShortcut.service.js`
  - Middleware: `verifyToken`, `attendanceMarkLimiter`
  - Body: `{ intent: "smart_attendance"|"operational_exit", spoken_input?, continuation_token?, location: "lat,lng" }`
  - Resuelve la marcación correcta según `canonical_flow` de getToday y reusa los handlers existentes vía dispatch interno. Modos de respuesta: `completed` (acción ejecutada), `conversation` (Siri pregunta y reenvía `continuation_token`, JWT stateless TTL 10m ligado al usuario), `handoff` (`open_url` al paso exacto `/asistencia/marcar/:action`), `blocked` (mensaje hablable controlado). Siempre responde HTTP 200 en fallos de negocio para que Shortcuts lea `spoken_message`.

- **POST /api/v1/attendance/shortcut/location** (Atajo de ubicacion)
  - Controller: `attendance.controller.js → recordLocationPing`
  - Service: `attendanceLocationPings.service.js`
  - Middleware: `verifyToken`, `attendanceMarkLimiter`
  - Body: `{ lat, lng, accuracy? }` o `{ location: "lat,lng" }`. Responde siempre 200 con `{ tracking, stored, reason? }`.
  - Solo guarda (tabla `attendance_location_pings`, migracion 312) si el usuario tiene una salida operacional activa. Quien tiene salida activa se resuelve desde una lista en memoria renovada cada 2 min: un ping sin salida no toca la base. Maximo un punto por persona cada 4 min; retencion 30 dias. Guia: `docs/user-guides/atajo-ubicacion-ios.md`.

- **GET /api/v1/attendance/live-presence/map**
  - Controller: `attendance.controller.js → getLiveMap` · Service: `attendanceLiveLocation.service.js`
  - Middleware: `verifyToken`, `requireLiveMapAccess` (solo Talento Humano y Gerencia General), `attendanceReportLimiter`
  - Ultima ubicacion conocida de quienes estan en salida operacional activa: la mas reciente entre las marcaciones (inicio, llegada, salida, regreso, visitas, almuerzo) y el ultimo ping del Atajo. Cada consulta queda auditada (`attendance_live_map_access`).

- **POST /api/v1/attendance/shortcut/token**
  - Controller: `attendanceShortcut.controller.js → issueToken`
  - Middleware: `verifyToken`
  - Emite JWT de larga duración (`SHORTCUT_TOKEN_EXPIRES_IN`, default 180d) con los mismos claims del access token (verifyToken lo acepta sin cambios). Queda registrado en `attendance_shortcut_tokens` (migración 246) para poder revocarlo individualmente.

- **POST /api/v1/attendance/shortcut/admin/token/:userId** (TI)
  - Controller: `attendanceShortcut.controller.js → adminIssueTokenForUser`
  - Middleware: `verifyToken`, `requireRole(["ti"])` (incluye `jefe_ti`)
  - TI/jefe_ti emite el token en nombre de otro usuario (no requiere que ese usuario tenga sesión activa). Mismo TTL y registro de revocación que el autoservicio.

- **GET /api/v1/attendance/shortcut/admin/tokens/:userId** (TI)
  - Controller: `attendanceShortcut.controller.js → listTokensForUser`
  - Middleware: `verifyToken`, `requireRole(["ti"])`
  - Lista los tokens emitidos para un usuario (`issued_at`, `expires_at`, `revoked_at`) sin exponer el JWT completo.

- **POST /api/v1/attendance/shortcut/admin/tokens/:tokenId/revoke** (TI)
  - Controller: `attendanceShortcut.controller.js → revokeToken`
  - Middleware: `verifyToken`, `requireRole(["ti"])`
  - Revoca un token puntual. `verifyToken` (middlewares/auth.js) consulta `attendance_shortcut_tokens` por `jti` solo cuando el token trae `token_kind: "shortcut"` — cero costo extra para el resto de la app.

- **POST /api/v1/attendance/clock-in** | alias: `/marcar/entrada`
  - Controller: `attendance.controller.js → clockIn`
  - Service: `attendance.service.js`
  - Middleware: `verifyToken`
  - Roles requeridos: Cualquier usuario autenticado

- **POST /api/v1/attendance/clock-out** | alias: `/marcar/salida`
  - Controller: `attendance.controller.js → clockOut`
  - Middleware: `verifyToken`

- **POST /api/v1/attendance/telework/access-codes**
  - Controller: `teleworkRequests.controller.js → issueCode`
  - Middleware: `verifyToken`, rol exacto `talento_humano`
  - Genera un código individual permanente de ocho caracteres para un colaborador autorizado. El código se persiste como hash y revoca el acceso permanente anterior de ese usuario. Es alternativa a una solicitud aprobada; no se envía por correo.

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

- **POST /internal/jobs/attendance/overtime-justification-report** (job mensual, `x-jobs-key`)
  - Job: `jobs/overtimeJustificationReport.js → runOnce`
  - Service: `attendanceOvertimeJustification.service.js`
  - Body opcional: `{ year, month }` (por defecto, mes calendario anterior en hora Ecuador)
  - Genera el PDF de justificación de horas extras de un colaborador. Total neto = horas "por sistema" (hora extra de marcaciones en jornada normal) + horas "declaradas" (días con salida operacional/teletrabajo; se cuentan aunque no haya otra evidencia) − atrasos no justificados (misma regla del sistema: L-V, >6 min, sin justificación aprobada, sin salida operacional ese día). Jornada L-V 09:00–18:00; sábados y domingos completos. PDF horizontal para RH: resumen (horas y decimal), una fila por día con sustento y justificación técnica (tickets resueltos/cerrados + módulos de `auditoria.logs` con actividad fuera de jornada; sin commits, Cloud Run no tiene el repo) y solo las observaciones que afectan el cálculo. Lo sube a Drive (`Informes Horas Extras`) y lo envía por correo.
  - Env requeridas: `OVERTIME_REPORT_USER_EMAIL`, `OVERTIME_REPORT_RECIPIENTS`; opcional `OVERTIME_REPORT_DRIVE_ROOT_FOLDER_ID`.

- **POST /internal/jobs/attendance/overtime** (job periódico, `x-jobs-key`)
  - Job: `jobs/attendanceOvertimeScheduler.js → runOnce`.
  - Además del cierre automático y alertas operacionales, revisa pausas de almuerzo activas. Entre los minutos 50 y 60 crea una única notificación de retorno por registro de asistencia, solo por Web Push (sin correo). Requiere que el colaborador haya autorizado y mantenga una suscripción push activa.

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
- Verificado parcialmente en Neon el 2026-10-07 para las tablas de teletrabajo.

- `attendance_telework_requests`: solicitudes y aprobaciones de teletrabajo.
- `attendance_telework_access_codes`: códigos individuales, permanentes y revocables para iniciar teletrabajo sin solicitud previa (migraciones `314` y `315`). Solo el rol exacto `talento_humano` puede emitirlos o revocarlos.

### Campos relevantes:
- `attendance_telework_access_codes.is_permanent`: identifica el acceso que no vence ni se consume.
- `attendance_telework_access_codes.status`: admite `ACTIVE` y `REVOKED` para controlar el acceso permanente.

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
