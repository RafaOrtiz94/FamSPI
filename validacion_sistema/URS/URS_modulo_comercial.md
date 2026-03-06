# DOCUMENTO DE REQUERIMIENTOS DEL SISTEMA (URS)

## Nombre del modulo
Comercial y Gestion de Clientes

## Descripcion general del modulo
El modulo soporta el ciclo comercial interno: solicitudes, alta de nuevos clientes, administracion de cartera, compras asociadas al proceso comercial y planificacion de visitas.

## Objetivo del modulo
Asegurar trazabilidad de punta a punta del proceso comercial interno, desde la solicitud inicial hasta la entrega y seguimiento operativo.

## Actores del sistema
- Comercial.
- Jefe Comercial.
- Backoffice Comercial.
- ACP Comercial.
- Gerencia / Gerencia General.
- Servicio Tecnico / Operaciones (etapas dependientes).

## Alcance funcional
- Crear, listar, consultar y gestionar solicitudes comerciales.
- Gestionar flujo de nuevo cliente con consentimiento y checklist.
- Administrar clientes, asignaciones y visitas.
- Gestionar compras publicas y privadas vinculadas a solicitudes.
- Gestionar cronogramas de visitas y aprobaciones.

## Listado de requerimientos del usuario
### REQ-COM-001
- Actor: Usuario comercial autenticado.
- Requerimiento: El sistema debe permitir crear solicitudes comerciales con adjuntos.
- Resultado esperado: La solicitud queda registrada y visible segun rol.

### REQ-COM-002
- Actor: Comercial / Backoffice Comercial.
- Requerimiento: El sistema debe permitir registrar solicitudes de nuevo cliente con documentos y consentimiento.
- Resultado esperado: El flujo de nuevo cliente avanza por estados validos hasta aprobacion/rechazo.

### REQ-COM-003
- Actor: Jefe Comercial / Gerencia.
- Requerimiento: El sistema debe permitir asignar clientes y registrar seguimiento de visitas.
- Resultado esperado: Se actualiza la cartera y se mantiene historial de visitas.

### REQ-COM-004
- Actor: Comercial, Backoffice, ACP y roles de aprobacion.
- Requerimiento: El sistema debe permitir ejecutar workflows de compra publica y privada.
- Resultado esperado: Cada cambio de estado queda validado y trazado.

### REQ-COM-005
- Actor: Comercial y aprobadores gerenciales.
- Requerimiento: El sistema debe permitir crear, enviar y aprobar cronogramas mensuales de visitas.
- Resultado esperado: El cronograma queda en estado consistente y auditable.

### REQ-COM-006
- Actor: Sistema.
- Requerimiento: El sistema debe restringir acciones por rol en cada etapa del proceso comercial.
- Resultado esperado: Acciones no autorizadas son rechazadas.

## Listado de requerimientos no funcionales
### RNF-COM-001 Seguridad
Todo endpoint privado debe requerir autenticacion JWT.

### RNF-COM-002 Control de acceso
El sistema debe aplicar autorizacion por rol para acciones sensibles de clientes, compras y cronogramas.

### RNF-COM-003 Integridad de flujo
El sistema debe evitar transiciones de estado no permitidas en compras privadas/publicas.

### RNF-COM-004 Trazabilidad
El sistema debe registrar historial de cambios y eventos del workflow comercial.

### RNF-COM-005 Manejo de errores
El sistema debe responder errores de negocio claros para conflictos de estado o datos invalidos.

### RNF-COM-006 Integridad documental
La carga de anexos debe validar tipo/estructura y evitar registros incompletos.

### RNF-COM-007 Rendimiento operativo
Listados de solicitudes/clientes/compras deben responder en tiempos aptos para operacion diaria.

## Reglas de negocio identificadas
- El flujo de nuevo cliente requiere consentimiento legal previo.
- Las transiciones de compra privada dependen de estado actual y rol actor.
- La aprobacion de cronogramas es exclusiva de jefaturas/gerencia.
- El seguimiento de visitas impacta indicadores comerciales.
- Las acciones de cliente pueden restringirse por asignacion activa.

## Dependencias con otros modulos
- Autenticacion y Sesiones.
- Usuarios y Perfiles.
- Inventario y Equipos.
- Documentos/Archivos/Firma.
- Notificaciones y Comunicaciones.
- Business Case Comercial.
- Servicio Tecnico y Mantenimientos.
