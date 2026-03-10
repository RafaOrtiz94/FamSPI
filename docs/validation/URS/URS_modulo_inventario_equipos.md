# DOCUMENTO DE REQUERIMIENTOS DEL SISTEMA (URS)

## Nombre del modulo
Inventario y Equipos

## Descripcion general del modulo
Administra la disponibilidad y trazabilidad de equipos por unidad para los procesos internos de compra, entrega y servicio tecnico, incluyendo alta desde modelo, captura de serial, asignacion a cliente y cambios de estado.

## Objetivo del modulo
Garantizar control operativo y trazabilidad completa de activos, desde su alta hasta su asignacion y estado final.

## Actores del sistema
- Servicio Tecnico.
- Operaciones.
- Logistica.
- Comercial (consulta/coordination segun flujo).
- Administrador/TI.

## Alcance funcional
- Consulta de inventario completo y equipos disponibles.
- Consulta de modelos de equipos.
- Creacion de unidad por modelo.
- Captura/confirmacion de serial.
- Asignacion de unidad a cliente/sucursal.
- Cambio de estado operativo de unidad.
- Registro de movimientos de inventario.

## Listado de requerimientos del usuario
### REQ-INV-001
- Actor: Usuario operativo autenticado.
- Requerimiento: El sistema debe permitir consultar inventario con filtros por busqueda, estado, tipo y cliente.
- Resultado esperado: Se retorna listado de unidades con datos consolidados.

### REQ-INV-002
- Actor: Usuario operativo autenticado.
- Requerimiento: El sistema debe permitir listar equipos disponibles para asignacion.
- Resultado esperado: La respuesta prioriza unidades con serial pendiente y estado operativo.

### REQ-INV-003
- Actor: Usuario operativo autenticado.
- Requerimiento: El sistema debe permitir consultar modelos de equipos registrados.
- Resultado esperado: Se muestra catalogo de modelos para alta de nuevas unidades.

### REQ-INV-004
- Actor: Usuario operativo autenticado.
- Requerimiento: El sistema debe permitir crear una unidad desde un modelo existente.
- Resultado esperado: Se crea unidad con estado inicial `no_asignado` y evento historico de creacion.

### REQ-INV-005
- Actor: Usuario operativo autenticado.
- Requerimiento: El sistema debe permitir capturar o confirmar serial de una unidad.
- Resultado esperado: El serial queda registrado de forma unica y la unidad elimina marca de serial pendiente.

### REQ-INV-006
- Actor: Usuario operativo autenticado.
- Requerimiento: El sistema debe permitir asignar una unidad a cliente y sucursal.
- Resultado esperado: La unidad cambia a estado `asignado` y se registra evento de asignacion.

### REQ-INV-007
- Actor: Usuario operativo autenticado.
- Requerimiento: El sistema debe permitir cambiar el estado de una unidad.
- Resultado esperado: El nuevo estado queda persistido y auditado en historial de equipo.

### REQ-INV-008
- Actor: Usuario operativo autenticado.
- Requerimiento: El sistema debe permitir registrar movimiento de entrada o salida de inventario.
- Resultado esperado: Se crea movimiento en `inventory_movements` con referencia de usuario actor.

### REQ-INV-009
- Actor: Sistema.
- Requerimiento: El sistema debe impedir seriales duplicados entre unidades.
- Resultado esperado: La operacion se rechaza con error de conflicto.

### REQ-INV-010
- Actor: Sistema.
- Requerimiento: El sistema debe mantener trazabilidad de cada mutacion de unidad.
- Resultado esperado: Todo cambio relevante genera registro en `equipos_historial`.

## Listado de requerimientos no funcionales
### RNF-INV-001 Seguridad de acceso
Todas las operaciones del modulo deben requerir autenticacion JWT.

### RNF-INV-002 Integridad transaccional
Las operaciones de creacion, serializacion, asignacion y cambio de estado deben ejecutarse en transacciones.

### RNF-INV-003 Integridad de catalogo
El sistema debe validar que `modelo_id` exista antes de crear unidades.

### RNF-INV-004 Control de dominio de estados
Solo deben aceptarse estados definidos por catalogo interno del modulo.

### RNF-INV-005 Trazabilidad
Cada cambio de unidad debe registrar evento, actor y timestamp.

### RNF-INV-006 Manejo de errores
El sistema debe responder codigos coherentes para datos invalidos, conflictos y recursos inexistentes.

### RNF-INV-007 Consistencia de lectura
Las consultas consolidadas deben apoyarse en la vista `v_inventario_completo` con criterios estables.

### RNF-INV-008 Rendimiento
Las consultas de inventario deben responder en tiempos adecuados para uso operativo diario.

## Reglas de negocio identificadas
- Estados permitidos de unidad: `no_asignado`, `asignado`, `reservado`, `en_transito`, `retirado`, `baja`, `mantenimiento_programado`, `en_mantenimiento`, `en_evaluacion`, `evaluado`, `proceso_retiro`.
- Si la unidad se crea sin serial, se marca `serial_pendiente = true` y se asigna serial temporal.
- El serial final debe ser unico a nivel de `equipos_unidad`.
- La asignacion de unidad exige `cliente_id`.
- Todo cambio de estado o asignacion debe quedar registrado en historial.

## Dependencias con otros modulos
- Clientes (asignacion de unidad por `cliente_id`).
- Pedidos/Solicitudes (referencia `request_id` en historial de equipo).
- Facturacion (movimientos de inventario usados por finanzas/reportes).
