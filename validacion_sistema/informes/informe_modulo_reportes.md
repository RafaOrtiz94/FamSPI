# INFORME DE VALIDACION DEL MODULO

## Nombre del modulo
Reportes y Auditoria

## Descripcion del modulo
Consolida indicadores operativos/comerciales de procesos internos, consulta de trazas de auditoria y preparacion documental para auditorias internas o externas con control de acceso por rol.

## Alcance funcional
- Dashboard comercial con KPIs y tendencias.
- Consulta paginada y filtrada de logs de auditoria.
- Exportacion de auditoria en CSV.
- Gestion de estado de auditoria (ventana activa/inactiva).
- Gestion de secciones y documentos de auditoria.
- Gestion de accesos externos temporales para auditores.

## Componentes del sistema
### Controladores
- `backend/src/modules/dashboard/dashboard.controller.js`
- `backend/src/modules/auditoria/audit.controller.js`
- `backend/src/modules/audit-prep/auditPrep.controller.js`

### Servicios
- `backend/src/modules/dashboard/dashboard.service.js`
- `backend/src/modules/auditoria/auditoria.service.js`
- `backend/src/modules/audit-prep/auditPrep.service.js`

### Modelos
- Sin ORM; SQL directo y utilidades de auditoria.

### Rutas
- `backend/src/modules/dashboard/dashboard.routes.js`
- `backend/src/modules/auditoria/audit.routes.js`
- `backend/src/modules/audit-prep/auditPrep.routes.js`

### Componentes de interfaz
- `spi_front/src/modules/comercial/pages/Dashboard.jsx`
- `spi_front/src/modules/gerencia/Auditoria.jsx`
- `spi_front/src/modules/audit-prep/AuditPrepPage.jsx`
- `spi_front/src/core/api/dashboardApi.js`
- `spi_front/src/core/api/auditoriaApi.js`
- `spi_front/src/core/api/auditPrepApi.js`

## Endpoints de API
### Dashboard
- `GET /api/v1/dashboard/comercial/summary`

### Auditoria
- `GET /api/v1/auditoria`
- `GET /api/v1/auditoria/:id`
- `GET /api/v1/auditoria/export/csv`

### Preparacion de auditoria
- `GET /api/v1/audit-prep/status`
- `PUT /api/v1/audit-prep/status`
- `GET /api/v1/audit-prep/sections`
- `POST /api/v1/audit-prep/sections`
- `GET /api/v1/audit-prep/documents`
- `POST /api/v1/audit-prep/documents/upload`
- `PATCH /api/v1/audit-prep/documents/:id/status`
- `GET /api/v1/audit-prep/documents/:id/download`
- `GET /api/v1/audit-prep/external-access`
- `POST /api/v1/audit-prep/external-access`
- `DELETE /api/v1/audit-prep/external-access/:id`

## Tablas de base de datos asociadas
- `auditoria.logs`
- `audit_settings`
- `audit_sections`
- `audit_documents`
- `audit_access_grants`
- `bc_master`
- `requests`
- `clients`

## Dependencias con otros modulos
- Autenticacion y Usuarios (JWT, roles, identidad de actor).
- Pedidos/Solicitudes (fuente para metricas y eventos auditables).
- Clientes (fuente de KPI de altas y trazabilidad comercial).
- Documentos/Drive (repositorio de evidencias de auditoria).
- TI/Gobierno de datos (operacion del modo auditoria y accesos externos).

## Controles de seguridad
### Control de acceso
- Seguridad base por JWT global en backend.
- `requireRole` en rutas de auditoria y en operaciones administrativas de `audit-prep`.

### Autenticacion
- Acceso restringido a usuarios autenticados.

### Autorizacion
- Filtrado por rol para consulta de logs y exportaciones.
- Control por seccion (`allowed_roles`) en preparacion de auditoria.
- Restriccion de operaciones sensibles (activar auditoria, accesos externos) a TI/administradores.

### Registro de auditoria
- Persistencia central en `auditoria.logs`.
- `logAction` en cambios de configuracion, carga documental y grants externos.

### Proteccion de datos
- Ocultamiento de identificadores sensibles de Drive en respuestas.
- Restriccion de tipos MIME y tamano maximo de archivo en carga documental.

## Riesgos operativos
- En `dashboard.controller` la validacion de rol se ejecuta dentro del controlador, no como middleware de ruta (riesgo de control inconsistente y ejecucion innecesaria en accesos denegados).
- Cache en memoria de dashboard (`60s`) no compartida entre instancias (riesgo de lectura no uniforme en despliegue horizontal).
- Exportacion CSV de auditoria con alto volumen puede afectar rendimiento.
- Dependencia de Google Drive para descarga/subida documental (riesgo de indisponibilidad externa).

## Posibles escenarios de falla
- Error de esquema DB (tabla/columna ausente) en consulta de dashboard.
- Usuario sin rol permitido intenta exportar auditoria.
- Carga de documento de auditoria con tipo no permitido.
- Auditoria desactivada y usuario no administrador intenta descargar documento.
- Agotamiento del limite de auditores externos activos (maximo 2).

## Nivel de criticidad
ALTO

## Prioridad de validacion
ALTA

---

## BASE DOCUMENTAL PARA VALIDACION

## Requerimientos del usuario (URS)
- `URS-REP-001`: Visualizar indicadores comerciales y de solicitudes en panel central.
- `URS-REP-002`: Consultar y filtrar la trazabilidad de acciones del sistema.
- `URS-REP-003`: Exportar evidencia de auditoria para revision externa.
- `URS-REP-004`: Gestionar un repositorio documental por secciones de auditoria.
- `URS-REP-005`: Controlar periodos de auditoria activa y accesos externos temporales.

## Requerimientos funcionales
- `RF-REP-001`: El dashboard debe entregar KPIs agregados y tendencia mensual.
- `RF-REP-002`: El modulo debe paginar y filtrar logs de `auditoria.logs`.
- `RF-REP-003`: El sistema debe exportar CSV con filtros aplicados.
- `RF-REP-004`: El sistema debe validar permisos por rol/seccion para documentos.
- `RF-REP-005`: El sistema debe permitir activar/desactivar modo auditoria y revocar accesos externos.

## Resumen del diseño tecnico
- Composicion modular de reportes: `dashboard`, `auditoria`, `audit-prep`.
- Consultas SQL directas y respuestas REST para consumo de SPA React.
- Uso de cache in-memory para resumen comercial.
- Integracion con Google Drive para almacenamiento y descarga documental.

## Escenarios de prueba
### Funcionalidad
- Caso: Obtener resumen comercial desde dashboard.
- Resultado esperado: payload con `kpis`, `charts` y metadatos de fuente/cache.

### Seguridad
- Caso: Usuario sin rol TI/gerencia intenta exportar auditoria.
- Resultado esperado: respuesta `403` y sin archivo de salida.

### Manejo de errores
- Caso: tabla de metricas ausente (simulacion de `42P01`).
- Resultado esperado: respuesta controlada con codigo de error de esquema.

### Integridad de datos
- Caso: Cargar documento en seccion valida y consultar listado.
- Resultado esperado: registro en `audit_documents`, enlace Drive operativo y visibilidad por rol.

---

## MATRIZ DE TRAZABILIDAD

| Requerimiento | Componente | Prueba |
|---|---|---|
| REQ-REP-001 KPIs comerciales | `dashboard.service.getCommercialSummary` | Consultar endpoint y validar KPIs/series |
| REQ-REP-002 Filtros de trazabilidad | `auditoria.service.listAudits` | Aplicar filtros por modulo, accion y fecha |
| REQ-REP-003 Exportacion CSV | `audit.controller.exportCsv` + `auditoria.service.exportCsv` | Exportar con filtros y verificar estructura CSV |
| REQ-REP-004 ACL documental | `auditPrep.service.assertAllowedSection` | Intentar acceso a seccion no permitida |
| REQ-REP-005 Gobierno de auditoria | `auditPrep.service.updateSettings` + `addExternalAccess`/`revokeExternalAccess` | Activar modo auditoria y administrar grants externos |
