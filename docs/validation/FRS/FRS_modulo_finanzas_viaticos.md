# DOCUMENTO DE ESPECIFICACION FUNCIONAL DEL SISTEMA (FRS)

## Nombre del modulo
Control Financiero Operativo y Viaticos

## Descripcion funcional
Gestiona procesos financieros internos vinculados al inventario operativo y al ciclo de viaticos corporativos (solicitud, soporte documental, validacion, aprobacion y pago). El alcance observado no implementa facturacion tributaria.

## Logica funcional observada
- Consulta de inventario financiero y movimientos.
- Registro de entradas/salidas de inventario con motivo.
- Exportacion de reporte CSV de movimientos.
- Conciliacion con sistema externo Silver.
- Gestion de viaticos desde visitas o viajes manuales.
- Control de estado de viaticos y generacion de reporte de cotejo.
- Carga y consulta de evidencias documentales de viaticos.

## Especificaciones funcionales
### FRS-FIN-001
**Descripcion:** Consulta de inventario financiero y movimientos.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-FIN-002
**Descripcion:** Registro de entradas/salidas de inventario con motivo.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-FIN-003
**Descripcion:** Exportacion de reporte CSV de movimientos.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-FIN-004
**Descripcion:** Conciliacion con sistema externo Silver.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-FIN-005
**Descripcion:** Gestion de viaticos desde visitas o viajes manuales.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-FIN-006
**Descripcion:** Control de estado de viaticos y generacion de reporte de cotejo.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-FIN-007
**Descripcion:** Carga y consulta de evidencias documentales de viaticos.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

## Endpoints API relacionados
### Finanzas (inventario financiero)
- `GET /api/v1/finanzas/api/v1/inventory`
- `POST /api/v1/finanzas/api/v1/inventory/move`
- `GET /api/v1/finanzas/api/v1/inventory/report`
- `POST /api/v1/finanzas/api/v1/inventory/sync`

### Viaticos
- `GET /api/v1/viaticos/candidates`
- `GET /api/v1/viaticos`
- `POST /api/v1/viaticos`
- `PATCH /api/v1/viaticos/:id/status`
- `GET /api/v1/viaticos/:id/documents`
- `POST /api/v1/viaticos/:id/documents`
- `GET /api/v1/viaticos/:id/report`

## Validaciones y controles funcionales
### Control de acceso
- `verifyToken` obligatorio en rutas privadas.
- `requireRole` aplicado para operaciones financieras y estados de viaticos.

### Autenticacion
- JWT requerido para toda operacion del modulo.

### Autorizacion
- Restricciones por rol en rutas (`finanzas`, `gerencia`, `comercial`, `servicio_tecnico`).
- Reglas internas de servicio en viaticos (`assertFinance`, `assertViaticosAccess`, control por solicitante).

### Registro de auditoria
- Registro de movimientos de inventario y viaticos en tablas transaccionales.
- `logAction` en operaciones relevantes de inventario.

### Proteccion de datos
- Validaciones de monto, estado, tipo de origen, tipo documental y tamano maximo de archivo.
- Restriccion de tipos MIME y limite de 15MB para adjuntos.

## Dependencias funcionales
- Inventario (stock y movimientos).
- Clientes (visitas comerciales que originan viaticos).
- Usuarios/Autenticacion (roles y trazabilidad por usuario).
- Asistencia (validacion geoespacial y de marcaciones en reporte de viatico).
- Documentos/Integraciones Google (almacenamiento de soportes en Drive).
- Integracion externa Silver (conciliacion de inventario financiero).
- Solicitudes internas (origen indirecto de visitas/clientes y contexto operativo).

## Observaciones
- Prefijo redundante en rutas de finanzas (`/api/v1/finanzas/api/v1/inventory`) con riesgo de integracion incorrecta.
- `finanzas.service.js` vacio, lo que sugiere deuda tecnica y posible dispersion de logica en controlador.
- Sincronizacion con Silver sin confirmacion transaccional distribuida (riesgo de desalineacion temporal).
- Creacion/alteracion de tablas en runtime en viaticos (`ensureSchema`), con riesgo de deriva de esquema.
