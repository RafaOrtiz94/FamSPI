# DOCUMENTO DE ESPECIFICACION FUNCIONAL DEL SISTEMA (FRS)

## Nombre del modulo
Inventario y Equipos

## Descripcion funcional
Administra la disponibilidad y trazabilidad de equipos por unidad para los procesos internos de compra, entrega y servicio tecnico, incluyendo alta desde modelo, captura de serial, asignacion a cliente y cambios de estado.

## Logica funcional observada
- Consulta de inventario completo y equipos disponibles.
- Consulta de modelos de equipos.
- Creacion de unidad por modelo.
- Captura/confirmacion de serial.
- Asignacion de unidad a cliente/sucursal.
- Cambio de estado operativo de unidad.
- Registro de movimientos de inventario.

## Especificaciones funcionales
### FRS-INV-001
**Descripcion:** Consulta de inventario completo y equipos disponibles.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-INV-002
**Descripcion:** Consulta de modelos de equipos.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-INV-003
**Descripcion:** Creacion de unidad por modelo.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-INV-004
**Descripcion:** Captura/confirmacion de serial.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-INV-005
**Descripcion:** Asignacion de unidad a cliente/sucursal.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-INV-006
**Descripcion:** Cambio de estado operativo de unidad.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-INV-007
**Descripcion:** Registro de movimientos de inventario.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

## Endpoints API relacionados
- `GET /api/v1/inventario`
- `GET /api/v1/inventario/equipos-disponibles`
- `GET /api/v1/inventario/equipos-cliente/:cliente_id`
- `GET /api/v1/inventario/modelos`
- `POST /api/v1/inventario/equipos-unidad`
- `POST /api/v1/inventario/equipos-unidad/:id/serial`
- `POST /api/v1/inventario/equipos-unidad/:id/asignar`
- `POST /api/v1/inventario/equipos-unidad/:id/cambiar-estado`
- `POST /api/v1/inventario/movimiento`

## Validaciones y controles funcionales
### Control de acceso
- Ruta protegida con `verifyToken`.
- No se observa `requireRole` especifico por operacion (riesgo de privilegios amplios).

### Autenticacion
- JWT obligatorio.

### Autorizacion
- Validaciones de negocio en servicio (`ALLOWED_STATES`, serial unico).

### Registro de auditoria
- Trazabilidad tecnica mediante `equipos_historial` y `inventory_movements`.

### Proteccion de datos
- Validaciones para evitar serial duplicado y estados invalidos.

## Dependencias funcionales
- Clientes (asignacion de unidad por `cliente_id`).
- Pedidos/Solicitudes (referencia `request_id` en historial de equipo).
- Facturacion (movimientos de inventario usados por finanzas/reportes).

## Observaciones
- Falta de segmentacion por rol en endpoints de mutacion critica.
- Dependencia de vista `v_inventario_completo`; si cambia, impacta todas las consultas.
- Manejo de serial temporal (`SIN-SERIE-*`) puede ocultar unidades sin regularizacion.
