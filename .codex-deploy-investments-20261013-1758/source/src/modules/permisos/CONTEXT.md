# CONTEXT.md — permisos

## 1. Descripción
Módulo de gestión de permisos laborales (ausencias justificadas). Cubre el flujo completo de solicitud, aprobación parcial/final por jefe, carga de justificantes, cancelaciones, plan de recuperación, matrícula de estudios y verificación legal de firma. Incluye generación de PDF y soporte para Drive.

## 2. Endpoints

- **GET /api/v1/permisos/legal-verification/:token** — `verifyLegalToken` — pública (sin verifyToken)
- **POST /api/v1/permisos/** — `create` — verifyToken
- **POST /api/v1/permisos/estudios/matricula** — `registerStudyEnrollment` — verifyToken, multer.single('matricula')
- **GET /api/v1/permisos/estudios/matricula/activa** — `getActiveStudyEnrollment` — verifyToken
- **GET /api/v1/permisos/estudios/matriculas** — `listMyStudyEnrollments` — verifyToken
- **GET /api/v1/permisos/estudios/matriculas/pendientes** — `listPendingStudyEnrollments` — verifyToken
- **POST /api/v1/permisos/estudios/matriculas/:id/revisar** — `reviewStudyEnrollment` — verifyToken
- **POST /api/v1/permisos/:id/aprobar-parcial** — `aprobarParcial` — verifyToken
- **POST /api/v1/permisos/:id/justificantes** — `uploadJustificantes` — verifyToken, multer.any()
- **POST /api/v1/permisos/:id/aprobar-final** — `aprobarFinal` — verifyToken
- **POST /api/v1/permisos/:id/rechazar** — `rechazar` — verifyToken
- **POST /api/v1/permisos/:id/cancelar** — `cancelar` — verifyToken
- **POST /api/v1/permisos/:id/cancelar/revisar** — `revisarCancelacion` — verifyToken
- **POST /api/v1/permisos/:id/recovery-plan** — `updateRecoveryPlan` — verifyToken
- **GET /api/v1/permisos/pendientes** — `listarPendientes` — verifyToken
- **GET /api/v1/permisos/mis-solicitudes** — `listarMias` — verifyToken
- **GET /api/v1/permisos/resumen-colaboradores** — `listarResumenColaboradores` — verifyToken
- **GET /api/v1/permisos/legal-coverage** — `getLegalCoverage` — verifyToken

## 3. Flujo principal

1. Colaborador crea solicitud de permiso via `POST /permisos/`
2. Jefe ve pendientes en `GET /pendientes` y aprueba parcialmente
3. Colaborador sube justificantes via `POST /:id/justificantes`
4. Jefe aprueba final via `POST /:id/aprobar-final`
5. Si el permiso requiere recuperación de horas: `POST /:id/recovery-plan`
6. En caso de cancelación: flujo cancelar + revisar cancelación

## 4. Validaciones
- `permisos.validation.js` (7KB): validaciones de campos
- `permisos.pdf.js` (27KB): generación de PDF del permiso
- `permisos.drive.js` (6KB): almacenamiento en Google Drive
- Ruta pública de verificación legal por token

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `signature`: firma digital aplicada a permisos
- `notifications`: notificación al jefe cuando hay permiso pendiente
- `files`/Drive: `permisos.drive.js` indica uso de Google Drive

## 7. Frontend asociado
- `/dashboard/talento-humano/permisos` → `PermisosPage`

## 8. Riesgos detectados
- `permisos.service.js` (161KB) — el archivo más grande del repositorio — extrema concentración de lógica
- `multer.any()` en justificantes — sin filtro de tipo de archivo ni límite de tamaño visible

## 9. Notas técnicas
- Módulo con flujo de estado complejo (parcial → final → cancelar)
- Integración con firma digital para cobertura legal (`legal-coverage`, `legal-verification`)
