# Especificacion de Diseno y Configuracion

## Arquitectura logica y fisica resumida
- Frontend web institucional.
- Backend Node.js/Express con APIs ` /api/v1`.
- Base de datos relacional para persistencia de tramites.

## Componentes de diseno y evidencia en codigo
| Componente | Referencia de codigo | Estado |
|---|---|---|
| Frontend | `spi_front/src/routes/AppRoutes.jsx` | Evidenciado |
| Backend | `backend/src/app.js`, `backend/src/server.js` | Evidenciado |
| Base de datos | `modules/permisos/*.service`, `modules/vacaciones/*.service` | Evidenciado en logica |
| Autenticacion | `backend/src/middlewares/auth.js` | Evidenciado |
| Autorizacion y roles | `backend/src/middlewares/roles.js` | Evidenciado |
| Rutas publicas/privadas | `backend/src/routes/registerRoutes.js`, `publicPaths.js` | Evidenciado |
| Auditoria/logs | `backend/src/middlewares/auditMiddleware.js` | Evidenciado |
| Modulo permisos | `backend/src/modules/permisos/*` | Evidenciado |
| Modulo vacaciones | `backend/src/modules/vacaciones/*` | Evidenciado |

## Configuracion
Variables logicas observadas (sin exponer secretos): `NODE_ENV`, `PORT`, `ENABLE_JOBS`, `JOBS_RUNNER_INSTANCE`, `APP_TIMEZONE`, `TZ`, `PREFERRED_APPROVER_EMAILS`, `DRIVE_ROOT_FOLDER_ID`, `LEGAL_VERIFICATION_BASE_URL`, `BACKEND_BASE_URL`, `API_BASE_URL`, `GOOGLE_REDIRECT_URI`, `PUBLIC_BASE_URL`.

## Flujo de datos y estados del tramite
Permisos y vacaciones operan mediante solicitud, revision, aprobacion/rechazo, cambios de estado y trazabilidad asociada.

## Configuraciones pendientes
- Confirmacion de topologia fisica final en entorno productivo validado.
- Confirmacion de politicas de respaldo/recuperacion con evidencia operativa.
