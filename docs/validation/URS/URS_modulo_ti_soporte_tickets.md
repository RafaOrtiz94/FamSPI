# DOCUMENTO DE REQUERIMIENTOS DEL SISTEMA (URS)

## Nombre del modulo
TI Soporte y Tickets

## Descripcion general del modulo
Implementa la mesa de ayuda TI para incidentes y requerimientos internos, con gestion de estados, asignacion de responsables, comentarios, trazabilidad de eventos y control SLA.

## Objetivo del modulo
Estandarizar la atencion de tickets TI con trazabilidad de ciclo, responsabilidades y calidad percibida.

## Actores del sistema
- Solicitante interno.
- Equipo TI (ti, jefe_ti, tecnico, roles tecnicos).
- Gerencia/TI para supervision operativa.

## Alcance funcional
- Registro de tickets por cualquier usuario autenticado.
- Vista del solicitante y workspace especializado de TI.
- Asignacion de ticket, cambios de estado y reglas de transicion.
- Comentarios publicos e internos por ticket.
- Cierre por solicitante, reapertura y encuesta de satisfaccion.
- KPI operativos: atrasos SLA, tiempos de respuesta, ciclo y entrega.

## Listado de requerimientos del usuario
### REQ-TI-001
- Actor: Solicitante autenticado.
- Requerimiento: El sistema debe permitir crear tickets de soporte.
- Resultado esperado: Se genera ticket con codigo unico y SLA calculado.

### REQ-TI-002
- Actor: Equipo TI.
- Requerimiento: El sistema debe permitir asignar tickets y cambiar su estado por flujo permitido.
- Resultado esperado: El ticket evoluciona con trazabilidad de eventos.

### REQ-TI-003
- Actor: Solicitante y equipo TI.
- Requerimiento: El sistema debe permitir registrar comentarios por ticket.
- Resultado esperado: Los comentarios quedan visibles segun su nivel de visibilidad.

### REQ-TI-004
- Actor: Solicitante.
- Requerimiento: El sistema debe permitir cerrar, reabrir y calificar tickets.
- Resultado esperado: El cierre/reapertura/CSAT queda persistido y trazable.

### REQ-TI-005
- Actor: Equipo TI / supervision.
- Requerimiento: El sistema debe mostrar KPI de carga y cumplimiento SLA.
- Resultado esperado: Se presentan indicadores de respuesta, ciclo y vencimientos.

## Listado de requerimientos no funcionales
### RNF-TI-001 Seguridad
Todas las rutas del modulo deben requerir usuario autenticado.

### RNF-TI-002 Control de acceso
Funciones de workspace TI deben limitarse a roles TI.

### RNF-TI-003 Integridad de flujo
El sistema debe rechazar transiciones de estado no permitidas.

### RNF-TI-004 Trazabilidad
El sistema debe registrar eventos de ciclo por cada ticket.

### RNF-TI-005 Integridad de datos
Comentarios internos deben ser inaccesibles para usuarios no TI.

### RNF-TI-006 Rendimiento
El workspace debe soportar filtros y KPI sobre volumen operativo sin degradacion critica.

## Reglas de negocio identificadas
- Estados permitidos: `abierto`, `triage`, `en_progreso`, `en_espera`, `resuelto`, `cerrado`, `reabierto`.
- Cada prioridad define SLA de respuesta y resolucion.
- Solo roles TI gestionan asignacion y cambios de estado.
- Solo solicitante puede cerrar definitivamente su ticket.
- Solo tickets terminados aceptan calificacion de satisfaccion.

## Dependencias con otros modulos
- Autenticacion y Sesiones.
- Usuarios y Perfiles.
- Notificaciones y Comunicaciones.
- Reportes y Auditoria (consumo de trazabilidad y KPI).
