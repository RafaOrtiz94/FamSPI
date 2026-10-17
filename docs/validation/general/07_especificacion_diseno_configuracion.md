# Especificación de Diseño y Configuración

**Sistema:** FamSPI  
**Versión:** 1.0  
**Alineación:** WHO TRS 1019, Annex 3, Appendix 5, Sección 7

---

## 1. Objetivo

Describir la arquitectura lógica y física del sistema FamSPI, los componentes principales verificados en el código fuente, las variables de configuración que gobiernan el comportamiento del sistema y los principios de diseño que sustentan la validación.

---

## 2. Arquitectura lógica

FamSPI sigue una arquitectura de tres capas separadas:

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| Presentación | React 19 + Tailwind CSS + Bootstrap | Interfaces de usuario por rol; routing SPA con React Router |
| API / Negocio | Node.js + Express.js | Rutas REST, middlewares, controladores y servicios de negocio |
| Persistencia | PostgreSQL (Neon serverless) | Almacenamiento relacional; SQL directo sin ORM |

**Patrón de diseño del backend:** Router → Middleware (auth/roles) → Controller → Service → Database  
**Patrón de diseño del frontend:** Página → API client → Estado React → Componentes

---

## 3. Arquitectura física del sistema

El sistema opera en producción sobre:
- **Servidor backend:** Node.js en proceso PM2 con reinicio automático
- **Base de datos:** Neon PostgreSQL serverless (cloud)
- **Frontend:** Servido como SPA; archivos estáticos compilados con Vite
- **Dominio y red:** Acceso HTTPS; rutas protegidas por JWT

No existe entorno de staging separado. El entorno de desarrollo es local por desarrollador.

---

## 4. Componentes del sistema verificados

| Componente | Ruta en el repositorio | Estado |
|---|---|---|
| Punto de entrada backend | `backend/src/server.js` | Evidenciado |
| Configuración Express | `backend/src/app.js` | Evidenciado |
| Registro de rutas | `backend/src/routes/registerRoutes.js` | Evidenciado |
| Rutas públicas | `backend/src/routes/publicPaths.js` | Evidenciado |
| Middleware de autenticación JWT | `backend/src/middlewares/auth.js` | Evidenciado |
| Middleware de autorización por rol | `backend/src/middlewares/roles.js` | Evidenciado |
| Middleware de auditoría | `backend/src/middlewares/auditMiddleware.js` | Evidenciado |
| Configuración de base de datos | `backend/src/config/db.js` | Evidenciado |
| Logger del sistema | `backend/src/config/logger.js` | Evidenciado |
| Router del frontend | `spi_front/src/routes/AppRoutes.jsx` | Evidenciado |
| Configuración de build | `spi_front/vite.config.js` | Evidenciado |

---

## 5. Estructura de módulos del backend

El backend organiza la lógica en módulos independientes bajo `backend/src/modules/`. Cada módulo sigue el patrón `routes.js` → `controller.js` → `service.js`. Los módulos validados son:

| Módulo | Prefijo de ruta | Documentación |
|---|---|---|
| auth | `/api/v1/auth` | URS/FRS/DS_modulo_autenticacion_sesiones |
| users | `/api/v1/users` | URS/FRS/DS_modulo_usuarios_perfiles |
| talento_humano | `/api/v1/talento-humano` | URS/FRS/DS_modulo_talento_humano |
| viaticos | `/api/v1/viaticos` | URS/FRS/DS_modulo_finanzas_viaticos |
| servicio | `/api/v1/servicio` | URS/FRS/DS_modulo_servicio_tecnico_mantenimientos |
| clients / requests | `/api/v1/clients`, `/api/v1/requests` | URS/FRS/DS_modulo_comercial_clientes |
| business-case | `/api/v1/business-case` | URS/FRS/DS_modulo_business_case |
| documents / files | `/api/v1/documents`, `/api/v1/files` | URS/FRS/DS_modulo_documentos_firma |
| notifications | `/api/v1/notifications` | URS/FRS/DS_modulo_notificaciones_comunicaciones |
| dashboard / auditoria | `/api/v1/dashboard`, `/api/v1/auditoria` | URS/FRS/DS_modulo_reportes_auditoria |
| support-tickets / ti-assets | `/api/v1/tickets`, `/api/v1/ti-assets` | URS/FRS/DS_modulo_ti_soporte_tickets |

---

## 6. Variables de configuración del sistema

Las siguientes variables de entorno controlan el comportamiento del sistema (sin exponer valores secretos):

| Variable | Propósito | Criticidad |
|---|---|---|
| `NODE_ENV` | Modo de ejecución (development/production) | Alta |
| `PORT` | Puerto de escucha del backend | Alta |
| `DATABASE_URL` | Cadena de conexión a Neon PostgreSQL | Alta |
| `JWT_SECRET` | Clave de firma de tokens JWT | Alta — nunca en repositorio |
| `ENABLE_JOBS` | Activa/desactiva el procesador de colas de jobs | Media |
| `JOBS_RUNNER_INSTANCE` | Instancia PM2 responsable de procesar jobs | Media |
| `APP_TIMEZONE` / `TZ` | Zona horaria del sistema (America/Guayaquil) | Media |
| `PREFERRED_APPROVER_EMAILS` | Emails de aprobadores preferidos en flujos | Media |
| `DRIVE_ROOT_FOLDER_ID` | ID del directorio raíz en Google Drive | Media |
| `GOOGLE_REDIRECT_URI` | URI de callback para OAuth | Alta |
| `BACKEND_BASE_URL` | URL base del backend | Media |
| `API_BASE_URL` | URL base del API para el frontend | Media |
| `PUBLIC_BASE_URL` | URL pública del sistema | Media |
| `LEGAL_VERIFICATION_BASE_URL` | URL para verificación pública de firma documental | Media |

**Gestión de secretos:** Las variables `JWT_SECRET`, `DATABASE_URL` y credenciales OAuth se gestionan mediante variables de entorno del servidor; nunca se versionan en el repositorio.

---

## 7. Principios de diseño de la validación

| Principio | Implementación en FamSPI |
|---|---|
| Autenticación siempre | `verifyToken` aplicado como middleware en todos los routers de módulos |
| Autorización por capa | `requireRole` en rutas + guards de servicio (`assertX`) para doble capa |
| Trazabilidad transversal | `auditMiddleware` registra actor, módulo, acción y timestamp en `auditoria.logs` |
| Integridad de datos | Validaciones en servicio antes de persistencia; sin ORM que pueda ocultar errores |
| Separación de preocupaciones | Módulos independientes con responsabilidad única por capa |
| Manejo explícito de errores | `asyncHandler` en controladores; errores de BD clasificados por tipo |

---

## 8. Configuraciones pendientes de verificación

Las siguientes configuraciones no han sido confirmadas en entorno productivo validado:

| Configuración | Estado | Acción requerida |
|---|---|---|
| Topología física final del servidor | Parcialmente documentada | Confirmar especificaciones de hardware/cloud del servidor |
| Políticas de respaldo de base de datos | No formalizadas | Documentar frecuencia, destino y procedimiento de restauración |
| Configuración HTTPS/TLS | Asumida activa | Verificar y documentar certificado, emisor y fecha de vencimiento |
| Política de rotación de JWT_SECRET | No documentada | Documentar procedimiento y frecuencia de rotación |
