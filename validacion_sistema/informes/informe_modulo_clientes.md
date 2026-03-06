# INFORME DE VALIDACION DEL MODULO

## Nombre del modulo
Gestion de Clientes

## Descripcion del modulo
Gestiona la cartera comercial aprobada dentro de los procesos internos, asignaciones temporales/permanentes de clientes a asesores, registro de visitas georreferenciadas y visitas a prospectos.

## Alcance funcional
- Listado de clientes accesibles por rol/asignacion.
- Detalle de cliente con trazabilidad de asignados.
- Actualizacion de datos de cliente y anexos legales.
- Asignacion de cliente por jefaturas/gerencia.
- Registro de estado de visita y puntos de geolocalizacion.
- Registro de visitas a prospectos.

## Componentes del sistema
### Controladores
- `backend/src/modules/clients/clients.controller.js`

### Servicios
- `backend/src/modules/clients/clients.service.js`
- Dependencia directa: `backend/src/modules/schedules/schedules.service.js`

### Modelos
- Sin modelos ORM; SQL directo y DDL runtime en servicio.

### Rutas
- `backend/src/modules/clients/clients.routes.js`
- Montaje en app: `app.use("/api/v1/clients", clientsRoutes)`

### Componentes de interfaz
- `spi_front/src/modules/comercial/pages/Clientes.jsx`
- `spi_front/src/modules/comercial/components/ClientRequestManagement.jsx`
- `spi_front/src/core/api/clientsApi.js`

## Endpoints de API
- `GET /api/v1/clients`
- `GET /api/v1/clients/:id`
- `PUT /api/v1/clients/:id`
- `POST /api/v1/clients/:id/assign`
- `POST /api/v1/clients/:id/visit-status`
- `POST /api/v1/clients/prospect-visit`

## Tablas de base de datos asociadas
- `client_requests`
- `client_assignments`
- `client_visit_logs`
- `prospect_visits`
- `users`
- `scheduled_visits`

## Dependencias con otros modulos
- Usuarios (asignacion por correo/rol).
- Solicitudes (origen de `client_requests`).
- Cronogramas (`scheduled_visits`) para visitas planificadas.
- Documentos (archivos legales asociados en Drive).

## Controles de seguridad
### Control de acceso
- JWT obligatorio en todas las rutas.
- Roles restringidos para `assign` y `update`.

### Autenticacion
- `verifyToken` por middleware global y del modulo.

### Autorizacion
- `ensureClientAccess` en servicio para validar acceso por creador o asignacion activa.
- `ASSIGNER_ROLES` valida quien puede reasignar clientes.

### Registro de auditoria
- Trazabilidad operativa mediante tablas de visitas/asignaciones.
- No se observa `logAction` explicito en todas las operaciones de cliente (riesgo de trazabilidad parcial).

### Proteccion de datos
- Carga de anexos por `multer`.
- Campos de geolocalizacion con almacenamiento estructurado.

## Riesgos operativos
- Creacion/alteracion de tablas en runtime (`ensureTables`) puede provocar deriva de esquema.
- Endpoint `visit-status` sin `requireRole` explicito en ruta: riesgo de uso indebido por usuario autenticado.
- Dependencia de correos para autorizacion de acceso puede fallar por inconsistencia de normalizacion.

## Posibles escenarios de falla
- Asignaciones temporales con rango de fechas invalido.
- Registro de visitas con coordenadas incompletas.
- Inconsistencia entre planificacion (`scheduled_visits`) y visitas ejecutadas.

## Nivel de criticidad
ALTO

## Prioridad de validacion
ALTA

---

## BASE DOCUMENTAL PARA VALIDACION

## Requerimientos del usuario (URS)
- `URS-CLI-001`: Ver cartera de clientes segun permisos y asignaciones.
- `URS-CLI-002`: Registrar visita de cliente con hora y ubicacion.
- `URS-CLI-003`: Reasignar clientes entre asesores con trazabilidad.
- `URS-CLI-004`: Actualizar informacion del cliente aprobado.
- `URS-CLI-005`: Registrar visitas a prospectos.

## Requerimientos funcionales
- `RF-CLI-001`: Filtrar clientes por rol, fecha y agenda.
- `RF-CLI-002`: Persistir visitas en `client_visit_logs` con estado y geodatos.
- `RF-CLI-003`: Gestionar asignaciones activas/temporales en `client_assignments`.
- `RF-CLI-004`: Restringir edicion total de cliente a roles de gestion.
- `RF-CLI-005`: Exponer resumen de visita (visitados/pendientes/planificados).

## Resumen del diseño tecnico
- Backend SQL con CTE/joins para datos agregados.
- Integracion con cronogramas para contexto diario.
- Frontend comercial con formularios de visita y panel de cartera.
- Almacenamiento de evidencias documentales en Drive para anexos legales.

## Escenarios de prueba
### Funcionalidad
- Caso: Registrar inicio y fin de visita con coordenadas.
- Resultado esperado: `client_visit_logs` actualizado con duracion y estado `visited`.

### Seguridad
- Caso: Usuario no asignado consulta cliente ajeno.
- Resultado esperado: `403` por `ensureClientAccess`.

### Manejo de errores
- Caso: Asignacion temporal con fecha fin menor a fecha inicio.
- Resultado esperado: `400` con mensaje de validacion.

### Integridad de datos
- Caso: Reasignar cliente existente al mismo usuario.
- Resultado esperado: `ON CONFLICT` actualiza parametros sin duplicar registro.

---

## MATRIZ DE TRAZABILIDAD

| Requerimiento | Componente | Prueba |
|---|---|---|
| REQ-CLI-001 Cartera por permisos | `clients.service.listAccessibleClients` | Listado por rol manager vs asesor |
| REQ-CLI-002 Visitas georreferenciadas | `clients.service.upsertVisitStatus` | Registrar check-in/check-out con GPS |
| REQ-CLI-003 Reasignacion controlada | `clients.service.assignClient` | Asignacion manual y temporal |
| REQ-CLI-004 Edicion de datos cliente | `clients.service.updateClient` | Actualizar campos y adjuntos con rol autorizado |
| REQ-CLI-005 Visitas a prospectos | `clients.service.upsertProspectVisit` | Crear y cerrar visita de prospecto |
