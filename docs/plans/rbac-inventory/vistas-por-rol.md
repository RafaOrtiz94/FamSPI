# Vistas del frontend por rol

Generado el 2026-10-08 por `backend/scripts/rbac/build_access_review.js`. No editar a mano: se regenera.

Fuentes: `frontend-routes.json` (166 rutas, 124 protegidas y sin parametros), `frontend-navigation-by-role.json` (menu real de cada cuenta de prueba) y `vistas-por-rol.json` (cada enlace abierto en el navegador contra el ambiente local).

La regla de rol es la de `ProtectedRoute.jsx`. No incluye el acceso por modulo (`user_module_access`) ni `extra_roles`, asi que una ruta "abrible por rol" puede estar apagada para un usuario concreto.

## acp_comercial

Identidades que usa el frontend: `acp_comercial`, `comercial` · Panel: `/dashboard/comercial`

- Rutas que puede abrir por su rol: 93 de 124.
- Enlaces en su menu: 15.
- Enlaces del menu que la regla de rol le niega: ninguno.
- Rutas que puede abrir escribiendo la URL pero su menu no muestra: 78 — `/asistencia/mobile-shortcuts`, `/configuration`, `/dashboard`, `/dashboard/auditoria/preparacion`, `/dashboard/backoffice/client-requests`, `/dashboard/backoffice/clientes`, `/dashboard/backoffice/private-purchases`, `/dashboard/business-case`, `/dashboard/business-case/workspace`, `/dashboard/calidad`, `/dashboard/calidad/areas`, `/dashboard/calidad/auditorias`, `/dashboard/calidad/buenas-practicas`, `/dashboard/calidad/capa`, ... y 64 mas.
- Verificacion en navegador de sus 15 enlaces: abre 15.

## comercial

Identidades que usa el frontend: `comercial` · Panel: `/dashboard/comercial`

- Rutas que puede abrir por su rol: 92 de 124.
- Enlaces en su menu: 15.
- Enlaces del menu que la regla de rol le niega: ninguno.
- Rutas que puede abrir escribiendo la URL pero su menu no muestra: 77 — `/asistencia/mobile-shortcuts`, `/configuration`, `/dashboard`, `/dashboard/auditoria/preparacion`, `/dashboard/backoffice/client-requests`, `/dashboard/backoffice/clientes`, `/dashboard/backoffice/private-purchases`, `/dashboard/business-case`, `/dashboard/business-case/workspace`, `/dashboard/calidad`, `/dashboard/calidad/areas`, `/dashboard/calidad/auditorias`, `/dashboard/calidad/buenas-practicas`, `/dashboard/calidad/capa`, ... y 63 mas.
- Verificacion en navegador de sus 15 enlaces: abre 15.

## financiero

Identidades que usa el frontend: `financiero` · Panel: `/dashboard/finanzas`

- Rutas que puede abrir por su rol: 67 de 124.
- Enlaces en su menu: 8.
- Enlaces del menu que la regla de rol le niega: ninguno.
- Rutas que puede abrir escribiendo la URL pero su menu no muestra: 59 — `/asistencia/mobile-shortcuts`, `/configuration`, `/dashboard`, `/dashboard/auditoria/preparacion`, `/dashboard/calidad`, `/dashboard/calidad/areas`, `/dashboard/calidad/auditorias`, `/dashboard/calidad/buenas-practicas`, `/dashboard/calidad/capa`, `/dashboard/calidad/comunicaciones`, `/dashboard/calidad/documentos`, `/dashboard/calidad/higiene`, `/dashboard/calidad/incidentes`, `/dashboard/calidad/limpieza`, ... y 45 mas.
- Verificacion en navegador de sus 8 enlaces: abre 8.

## gerencia_general

Identidades que usa el frontend: `gerencia_general` · Panel: `/dashboard/gerencia`

- Rutas que puede abrir por su rol: 100 de 124.
- Enlaces en su menu: 16.
- Enlaces del menu que la regla de rol le niega: ninguno.
- Rutas que puede abrir escribiendo la URL pero su menu no muestra: 84 — `/asistencia/mobile-shortcuts`, `/configuration`, `/dashboard/auditoria`, `/dashboard/auditoria/preparacion`, `/dashboard/business-case/workspace`, `/dashboard/calidad`, `/dashboard/calidad/areas`, `/dashboard/calidad/auditorias`, `/dashboard/calidad/buenas-practicas`, `/dashboard/calidad/capa`, `/dashboard/calidad/comunicaciones`, `/dashboard/calidad/documentos`, `/dashboard/calidad/higiene`, `/dashboard/calidad/incidentes`, ... y 70 mas.
- Verificacion en navegador de sus 16 enlaces: abre 15, en_construccion 1.
  - `/dashboard/kickoff` (Kick Off 2026 🚧): en_construccion

## ing_servicio

Identidades que usa el frontend: `ing_servicio` · Panel: `/dashboard/servicio-tecnico`

- Rutas que puede abrir por su rol: 71 de 124.
- Enlaces en su menu: 19.
- Enlaces del menu que la regla de rol le niega: ninguno.
- Rutas que puede abrir escribiendo la URL pero su menu no muestra: 53 — `/asistencia/mobile-shortcuts`, `/configuration`, `/dashboard`, `/dashboard/business-case`, `/dashboard/business-case/workspace`, `/dashboard/calidad`, `/dashboard/calidad/areas`, `/dashboard/calidad/auditorias`, `/dashboard/calidad/buenas-practicas`, `/dashboard/calidad/capa`, `/dashboard/calidad/comunicaciones`, `/dashboard/calidad/documentos`, `/dashboard/calidad/higiene`, `/dashboard/calidad/incidentes`, ... y 39 mas.
- Verificacion en navegador de sus 19 enlaces: abre 18, redirige 1.
  - `/dashboard/servicio-tecnico/inspecciones` (Inspecciones de Ambiente): redirige → `/dashboard/servicio-tecnico/solicitudes`

## ing_servicio_ext

Identidades que usa el frontend: `ing_servicio_ext` · Panel: `/dashboard/ext`

- Rutas que puede abrir por su rol: 63 de 124.
- Enlaces en su menu: 6.
- Enlaces del menu que la regla de rol le niega: ninguno.
- Rutas que puede abrir escribiendo la URL pero su menu no muestra: 57 — `/asistencia/mobile-shortcuts`, `/configuration`, `/dashboard`, `/dashboard/calidad`, `/dashboard/calidad/areas`, `/dashboard/calidad/auditorias`, `/dashboard/calidad/buenas-practicas`, `/dashboard/calidad/capa`, `/dashboard/calidad/comunicaciones`, `/dashboard/calidad/documentos`, `/dashboard/calidad/higiene`, `/dashboard/calidad/incidentes`, `/dashboard/calidad/limpieza`, `/dashboard/calidad/muestreo`, ... y 43 mas.
- Verificacion en navegador de sus 6 enlaces: abre 6.

## jefe_calidad

Identidades que usa el frontend: `jefe_calidad`, `calidad` · Panel: `/dashboard/calidad`

- Rutas que puede abrir por su rol: 66 de 124.
- Enlaces en su menu: 8.
- Enlaces del menu que la regla de rol le niega: ninguno.
- Rutas que puede abrir escribiendo la URL pero su menu no muestra: 58 — `/asistencia/mobile-shortcuts`, `/configuration`, `/dashboard`, `/dashboard/auditoria/preparacion`, `/dashboard/backoffice/client-requests`, `/dashboard/backoffice/clientes`, `/dashboard/calidad/areas`, `/dashboard/calidad/auditorias`, `/dashboard/calidad/buenas-practicas`, `/dashboard/calidad/capa`, `/dashboard/calidad/comunicaciones`, `/dashboard/calidad/documentos`, `/dashboard/calidad/documentos-rrhh`, `/dashboard/calidad/higiene`, ... y 44 mas.
- Verificacion en navegador de sus 8 enlaces: abre 8.

## jefe_comercial

Identidades que usa el frontend: `jefe_comercial`, `comercial` · Panel: `/dashboard/comercial`

- Rutas que puede abrir por su rol: 95 de 124.
- Enlaces en su menu: 15.
- Enlaces del menu que la regla de rol le niega: ninguno.
- Rutas que puede abrir escribiendo la URL pero su menu no muestra: 80 — `/asistencia/mobile-shortcuts`, `/configuration`, `/dashboard`, `/dashboard/auditoria/preparacion`, `/dashboard/backoffice/client-requests`, `/dashboard/backoffice/clientes`, `/dashboard/backoffice/private-purchases`, `/dashboard/business-case`, `/dashboard/business-case/observabilidad`, `/dashboard/business-case/workspace`, `/dashboard/calidad`, `/dashboard/calidad/areas`, `/dashboard/calidad/auditorias`, `/dashboard/calidad/buenas-practicas`, ... y 66 mas.
- Verificacion en navegador de sus 15 enlaces: abre 15.

## jefe_financiero

Identidades que usa el frontend: `jefe_financiero` · Panel: `/dashboard/finanzas`

- Rutas que puede abrir por su rol: 69 de 124.
- Enlaces en su menu: 9.
- Enlaces del menu que la regla de rol le niega: ninguno.
- Rutas que puede abrir escribiendo la URL pero su menu no muestra: 60 — `/asistencia/mobile-shortcuts`, `/configuration`, `/dashboard`, `/dashboard/business-case/workspace`, `/dashboard/calidad`, `/dashboard/calidad/areas`, `/dashboard/calidad/auditorias`, `/dashboard/calidad/buenas-practicas`, `/dashboard/calidad/capa`, `/dashboard/calidad/comunicaciones`, `/dashboard/calidad/documentos`, `/dashboard/calidad/higiene`, `/dashboard/calidad/incidentes`, `/dashboard/calidad/limpieza`, ... y 46 mas.
- Verificacion en navegador de sus 9 enlaces: abre 9.

## jefe_logistica

Identidades que usa el frontend: `jefe_logistica` · Panel: `/dashboard/logistica`

- Rutas que puede abrir por su rol: 69 de 124.
- Enlaces en su menu: 8.
- Enlaces del menu que la regla de rol le niega: ninguno.
- Rutas que puede abrir escribiendo la URL pero su menu no muestra: 61 — `/asistencia/mobile-shortcuts`, `/configuration`, `/dashboard`, `/dashboard/business-case`, `/dashboard/business-case/workspace`, `/dashboard/calidad`, `/dashboard/calidad/areas`, `/dashboard/calidad/auditorias`, `/dashboard/calidad/buenas-practicas`, `/dashboard/calidad/capa`, `/dashboard/calidad/comunicaciones`, `/dashboard/calidad/documentos`, `/dashboard/calidad/higiene`, `/dashboard/calidad/incidentes`, ... y 47 mas.
- Verificacion en navegador de sus 8 enlaces: abre 8.

## jefe_operaciones

Identidades que usa el frontend: `jefe_operaciones`, `operaciones` · Panel: `/dashboard/operaciones`

- Rutas que puede abrir por su rol: 73 de 124.
- Enlaces en su menu: 11.
- Enlaces del menu que la regla de rol le niega: ninguno.
- Rutas que puede abrir escribiendo la URL pero su menu no muestra: 62 — `/asistencia/mobile-shortcuts`, `/configuration`, `/dashboard`, `/dashboard/auditoria/preparacion`, `/dashboard/business-case/observabilidad`, `/dashboard/business-case/workspace`, `/dashboard/calidad`, `/dashboard/calidad/areas`, `/dashboard/calidad/auditorias`, `/dashboard/calidad/buenas-practicas`, `/dashboard/calidad/capa`, `/dashboard/calidad/comunicaciones`, `/dashboard/calidad/documentos`, `/dashboard/calidad/higiene`, ... y 48 mas.
- Verificacion en navegador de sus 11 enlaces: abre 11.

## jefe_servicio

Identidades que usa el frontend: `jefe_servicio` · Panel: `/dashboard/servicio-tecnico`

- Rutas que puede abrir por su rol: 72 de 124.
- Enlaces en su menu: 20.
- Enlaces del menu que la regla de rol le niega: ninguno.
- Rutas que puede abrir escribiendo la URL pero su menu no muestra: 52 — `/asistencia/mobile-shortcuts`, `/configuration`, `/dashboard`, `/dashboard/business-case`, `/dashboard/business-case/workspace`, `/dashboard/calidad`, `/dashboard/calidad/areas`, `/dashboard/calidad/auditorias`, `/dashboard/calidad/buenas-practicas`, `/dashboard/calidad/capa`, `/dashboard/calidad/comunicaciones`, `/dashboard/calidad/documentos`, `/dashboard/calidad/higiene`, `/dashboard/calidad/incidentes`, ... y 38 mas.
- Verificacion en navegador de sus 20 enlaces: abre 20.

## jefe_ti

Identidades que usa el frontend: `jefe_ti`, `ti` · Panel: `/dashboard/ti`

- Rutas que puede abrir por su rol: 95 de 124.
- Enlaces en su menu: 20.
- Enlaces del menu que la regla de rol le niega: ninguno.
- Rutas que puede abrir escribiendo la URL pero su menu no muestra: 75 — `/asistencia/mobile-shortcuts`, `/configuration`, `/dashboard`, `/dashboard/auditoria/preparacion`, `/dashboard/business-case/workspace`, `/dashboard/calidad`, `/dashboard/calidad/areas`, `/dashboard/calidad/auditorias`, `/dashboard/calidad/buenas-practicas`, `/dashboard/calidad/capa`, `/dashboard/calidad/comunicaciones`, `/dashboard/calidad/documentos`, `/dashboard/calidad/higiene`, `/dashboard/calidad/incidentes`, ... y 61 mas.
- Verificacion en navegador de sus 20 enlaces: abre 20.
- Vistas que abren pero con llamadas a la API rechazadas o errores (1):
  - `/dashboard/talento-humano/colaboradores`: 403 GET /api/v1/collaborators

## logistica

Identidades que usa el frontend: `logistica` · Panel: `/dashboard/logistica`

- Rutas que puede abrir por su rol: 65 de 124.
- Enlaces en su menu: 8.
- Enlaces del menu que la regla de rol le niega: ninguno.
- Rutas que puede abrir escribiendo la URL pero su menu no muestra: 57 — `/asistencia/mobile-shortcuts`, `/configuration`, `/dashboard`, `/dashboard/calidad`, `/dashboard/calidad/areas`, `/dashboard/calidad/auditorias`, `/dashboard/calidad/buenas-practicas`, `/dashboard/calidad/capa`, `/dashboard/calidad/comunicaciones`, `/dashboard/calidad/documentos`, `/dashboard/calidad/higiene`, `/dashboard/calidad/incidentes`, `/dashboard/calidad/limpieza`, `/dashboard/calidad/muestreo`, ... y 43 mas.
- Verificacion en navegador de sus 8 enlaces: abre 8.

## operaciones

Identidades que usa el frontend: `operaciones` · Panel: `/dashboard/operaciones`

- Rutas que puede abrir por su rol: 70 de 124.
- Enlaces en su menu: 9.
- Enlaces del menu que la regla de rol le niega: ninguno.
- Rutas que puede abrir escribiendo la URL pero su menu no muestra: 61 — `/asistencia/mobile-shortcuts`, `/configuration`, `/dashboard`, `/dashboard/auditoria/preparacion`, `/dashboard/business-case/workspace`, `/dashboard/calidad`, `/dashboard/calidad/areas`, `/dashboard/calidad/auditorias`, `/dashboard/calidad/buenas-practicas`, `/dashboard/calidad/capa`, `/dashboard/calidad/comunicaciones`, `/dashboard/calidad/documentos`, `/dashboard/calidad/higiene`, `/dashboard/calidad/incidentes`, ... y 47 mas.
- Verificacion en navegador de sus 9 enlaces: abre 9.

## pasante

Identidades que usa el frontend: `pasante` · Panel: `/dashboard/pasante`

- Rutas que puede abrir por su rol: 114 de 124 (114 solo por el pase de gerencia/pasante).
- Enlaces en su menu: 1.
- Enlaces del menu que la regla de rol le niega: ninguno.
- Rutas que puede abrir escribiendo la URL pero su menu no muestra: 113 — `/asistencia/mobile-shortcuts`, `/configuration`, `/dashboard/auditoria`, `/dashboard/auditoria/preparacion`, `/dashboard/backoffice/client-requests`, `/dashboard/backoffice/clientes`, `/dashboard/backoffice/private-purchases`, `/dashboard/business-case`, `/dashboard/business-case/observabilidad`, `/dashboard/business-case/workspace`, `/dashboard/buzon-sugerencias`, `/dashboard/calidad`, `/dashboard/calidad/areas`, `/dashboard/calidad/auditorias`, ... y 99 mas.
- Verificacion en navegador de sus 1 enlaces: abre 1.

## talento_humano

Identidades que usa el frontend: `talento_humano` · Panel: `/dashboard/talento-humano`

- Rutas que puede abrir por su rol: 68 de 124.
- Enlaces en su menu: 9.
- Enlaces del menu que la regla de rol le niega: ninguno.
- Rutas que puede abrir escribiendo la URL pero su menu no muestra: 59 — `/asistencia/mobile-shortcuts`, `/configuration`, `/dashboard`, `/dashboard/auditoria/preparacion`, `/dashboard/calidad`, `/dashboard/calidad/areas`, `/dashboard/calidad/auditorias`, `/dashboard/calidad/buenas-practicas`, `/dashboard/calidad/capa`, `/dashboard/calidad/comunicaciones`, `/dashboard/calidad/documentos`, `/dashboard/calidad/higiene`, `/dashboard/calidad/incidentes`, `/dashboard/calidad/limpieza`, ... y 45 mas.
- Verificacion en navegador de sus 9 enlaces: abre 9.
