# DOCUMENTO DE ESPECIFICACION FUNCIONAL DEL SISTEMA (FRS)

## Nombre del modulo
Reportes y Auditoria

## Descripcion funcional
Consolida indicadores operativos/comerciales de procesos internos, consulta de trazas de auditoria y preparacion documental para auditorias internas o externas con control de acceso por rol.

## Logica funcional observada
- Dashboard comercial con KPIs y tendencias.
- Consulta paginada y filtrada de logs de auditoria.
- Exportacion de auditoria en CSV.
- Gestion de estado de auditoria (ventana activa/inactiva).
- Gestion de secciones y documentos de auditoria.
- Gestion de accesos externos temporales para auditores.

## Especificaciones funcionales
### FRS-RPT-001
**Descripcion:** Dashboard comercial con KPIs y tendencias.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-RPT-002
**Descripcion:** Consulta paginada y filtrada de logs de auditoria.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-RPT-003
**Descripcion:** Exportacion de auditoria en CSV.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-RPT-004
**Descripcion:** Gestion de estado de auditoria (ventana activa/inactiva).

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-RPT-005
**Descripcion:** Gestion de secciones y documentos de auditoria.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-RPT-006
**Descripcion:** Gestion de accesos externos temporales para auditores.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

## Endpoints API relacionados
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

## Validaciones y controles funcionales
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

## Dependencias funcionales
- Autenticacion y Usuarios (JWT, roles, identidad de actor).
- Pedidos/Solicitudes (fuente para metricas y eventos auditables).
- Clientes (fuente de KPI de altas y trazabilidad comercial).
- Documentos/Drive (repositorio de evidencias de auditoria).
- TI/Gobierno de datos (operacion del modo auditoria y accesos externos).

## Observaciones
- En `dashboard.controller` la validacion de rol se ejecuta dentro del controlador, no como middleware de ruta (riesgo de control inconsistente y ejecucion innecesaria en accesos denegados).
- Cache en memoria de dashboard (`60s`) no compartida entre instancias (riesgo de lectura no uniforme en despliegue horizontal).
- Exportacion CSV de auditoria con alto volumen puede afectar rendimiento.
- Dependencia de Google Drive para descarga/subida documental (riesgo de indisponibilidad externa).
