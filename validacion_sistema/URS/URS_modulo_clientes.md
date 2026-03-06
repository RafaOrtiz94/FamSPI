# DOCUMENTO DE REQUERIMIENTOS DEL SISTEMA (URS)

## Nombre del modulo
Gestion de Clientes

## Descripcion general del modulo
El modulo administra la cartera de clientes aprobados dentro del flujo interno comercial, sus asignaciones y la trazabilidad de visitas (clientes y prospectos), incluyendo geolocalizacion y evidencia operativa.

## Objetivo del modulo
Asegurar la gestion comercial controlada de clientes y prospectos, con visibilidad por rol y seguimiento de ejecucion en campo.

## Actores del sistema
- Asesor comercial.
- ACP Comercial.
- Backoffice Comercial.
- Jefatura Comercial.
- Gerencia.
- Administrador/TI.

## Alcance funcional
- Consulta de cartera segun permisos y asignaciones activas.
- Consulta de detalle de cliente.
- Actualizacion de datos de cliente y anexos.
- Asignacion/reasignacion de clientes a asesores.
- Registro de estado de visita de cliente.
- Registro de visitas a prospectos.
- Integracion con programacion de visitas.

## Listado de requerimientos del usuario
### REQ-CLI-001
- Actor: Comercial / ACP / Backoffice / Gerencia.
- Requerimiento: El sistema debe permitir listar clientes accesibles segun rol y asignaciones activas.
- Resultado esperado: El usuario visualiza solo clientes permitidos por politica de acceso.

### REQ-CLI-002
- Actor: Comercial / ACP / Backoffice / Gerencia.
- Requerimiento: El sistema debe permitir consultar el detalle completo de un cliente aprobado.
- Resultado esperado: Se muestran datos comerciales, asignados y contexto de seguimiento.

### REQ-CLI-003
- Actor: Jefe Comercial / Gerencia / Administrador/TI.
- Requerimiento: El sistema debe permitir actualizar informacion del cliente y anexos legales.
- Resultado esperado: Los cambios se guardan y permanecen disponibles para operaciones comerciales.

### REQ-CLI-004
- Actor: Jefe Comercial / Gerencia / Administrador/TI.
- Requerimiento: El sistema debe permitir asignar o reasignar clientes a asesores.
- Resultado esperado: Se registra la asignacion activa con responsable, motivo y vigencia.

### REQ-CLI-005
- Actor: Comercial / ACP / Backoffice.
- Requerimiento: El sistema debe permitir registrar estado de visita de cliente por fecha.
- Resultado esperado: Queda trazabilidad de check-in/check-out, coordenadas y observaciones.

### REQ-CLI-006
- Actor: Comercial / ACP / Backoffice.
- Requerimiento: El sistema debe permitir registrar visitas a prospectos.
- Resultado esperado: Cada prospecto queda asociado a tiempos de visita, coordenadas y observaciones.

### REQ-CLI-007
- Actor: Comercial / Jefatura Comercial.
- Requerimiento: El sistema debe permitir filtrar cartera por texto de busqueda y fecha de visita.
- Resultado esperado: La vista refleja clientes relevantes para la jornada operativa.

### REQ-CLI-008
- Actor: Comercial / Jefatura Comercial.
- Requerimiento: El sistema debe incorporar datos de planificacion cuando exista cronograma aprobado.
- Resultado esperado: El usuario puede comparar planificado vs ejecutado en visitas.

### REQ-CLI-009
- Actor: Sistema.
- Requerimiento: El sistema debe impedir acceso a clientes no autorizados para el usuario autenticado.
- Resultado esperado: Se retorna error de autorizacion y no se expone informacion del cliente.

### REQ-CLI-010
- Actor: Sistema.
- Requerimiento: El sistema debe rechazar operaciones sobre clientes no aprobados.
- Resultado esperado: Solo clientes con estado `approved` son gestionables en este modulo.

## Listado de requerimientos no funcionales
### RNF-CLI-001 Seguridad de acceso
Todas las rutas deben exigir autenticacion JWT.

### RNF-CLI-002 Autorizacion por rol y ownership
La consulta/edicion debe aplicar politicas por rol y asignacion activa.

### RNF-CLI-003 Integridad de datos
La asignacion no debe generar duplicados para el mismo cliente y asesor.

### RNF-CLI-004 Validacion de entrada
Estados de visita y rangos de fechas de asignacion deben validarse antes de persistir.

### RNF-CLI-005 Trazabilidad operativa
La informacion de visita debe conservar timestamps y geoposicion para auditoria de campo.

### RNF-CLI-006 Manejo de errores
El sistema debe responder con errores controlados en validaciones y accesos no autorizados.

### RNF-CLI-007 Disponibilidad funcional
La ausencia de cronograma aprobado no debe bloquear la consulta de cartera.

### RNF-CLI-008 Consistencia de esquema
El sistema debe mantener consistencia estructural de tablas de asignaciones y visitas.

## Reglas de negocio identificadas
- Solo clientes en estado `approved` pueden consultarse y gestionarse.
- Los roles de gestion definen acceso completo; otros roles acceden por creador/asignacion.
- Las asignaciones pueden ser permanentes o temporales con fecha de inicio/fin.
- Los estados de visita validos son `visited`, `pending`, `skipped`, `in_visit`.
- El sistema debe controlar acceso mediante `ensureClientAccess`.
- La cartera puede filtrarse por agenda aprobada de visitas para fecha especifica.

## Dependencias con otros modulos
- Usuarios.
- Solicitudes/Pedidos (origen de `client_requests`).
- Cronogramas (`schedules`).
- Documentos/Drive.
- Autenticacion y Sesiones.
