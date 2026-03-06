# DOCUMENTO DE REQUERIMIENTOS DEL SISTEMA (URS)

## Nombre del modulo
Control Financiero Operativo y Viaticos

## Descripcion general del modulo
El modulo gestiona operaciones financieras internas asociadas a inventario operativo (movimientos, reportes y conciliacion externa) y el ciclo de viaticos (solicitud, validacion, documentacion, aprobacion y pago).

## Objetivo del modulo
Asegurar control financiero operativo y soporte documental de gastos internos, con reglas de negocio verificables y trazabilidad para auditoria.

## Actores del sistema
- Finanzas.
- Jefatura financiera/Gerencia.
- Comercial.
- Backoffice Comercial.
- Servicio Tecnico/Tecnico.
- Sistema externo Silver.

## Alcance funcional
- Consulta de inventario financiero.
- Registro de movimientos de inventario (`in`/`out`).
- Exportacion de reporte CSV de movimientos.
- Conciliacion de inventario con Silver.
- Listado de candidatos a viatico por visitas.
- Creacion/actualizacion de viaticos.
- Cambio de estado de viaticos (pendiente/aprobado/pagado/rechazado).
- Carga y consulta de documentos de viaticos.
- Generacion de reporte de cotejo para viatico.

## Listado de requerimientos del usuario
### REQ-FAC-001
- Actor: Finanzas / Gerencia.
- Requerimiento: El sistema debe permitir consultar inventario financiero ordenado por item.
- Resultado esperado: Se obtiene lista actualizada de existencias para control financiero.

### REQ-FAC-002
- Actor: Finanzas / Gerencia.
- Requerimiento: El sistema debe permitir registrar entradas y salidas de inventario con motivo.
- Resultado esperado: Se actualiza stock y se crea movimiento financiero trazable.

### REQ-FAC-003
- Actor: Finanzas / Gerencia.
- Requerimiento: El sistema debe impedir salidas con cantidad mayor al stock disponible.
- Resultado esperado: La operacion es rechazada sin afectar datos persistidos.

### REQ-FAC-004
- Actor: Finanzas / Gerencia.
- Requerimiento: El sistema debe permitir exportar movimientos de inventario en formato CSV.
- Resultado esperado: Se descarga reporte estructurado para conciliacion y auditoria.

### REQ-FAC-005
- Actor: Finanzas / Gerencia.
- Requerimiento: El sistema debe permitir comparar inventario local contra inventario remoto Silver.
- Resultado esperado: Se retorna listado de discrepancias para reconciliacion.

### REQ-FAC-006
- Actor: Comercial / Backoffice / Tecnico / Finanzas.
- Requerimiento: El sistema debe permitir listar candidatos de viaticos por rango de fechas.
- Resultado esperado: Se muestran visitas elegibles con su estado de viatico.

### REQ-FAC-007
- Actor: Comercial / Backoffice / Tecnico / Finanzas.
- Requerimiento: El sistema debe permitir crear o actualizar solicitudes de viaticos.
- Resultado esperado: Se registra viatico con origen, montos y metadatos de desplazamiento.

### REQ-FAC-008
- Actor: Finanzas.
- Requerimiento: El sistema debe permitir aprobar, rechazar o marcar como pagado un viatico.
- Resultado esperado: El estado y montos aprobados quedan actualizados con trazabilidad del revisor.

### REQ-FAC-009
- Actor: Solicitante de viatico / Finanzas.
- Requerimiento: El sistema debe permitir registrar documentos soporte de viaticos.
- Resultado esperado: Los documentos quedan vinculados al viatico con metadata y enlace de almacenamiento.

### REQ-FAC-010
- Actor: Finanzas.
- Requerimiento: El sistema debe generar reporte de cotejo de viatico contra asistencia y soportes.
- Resultado esperado: Se obtiene recomendacion de monto y estado tecnico de validacion.

### REQ-FAC-011
- Actor: Sistema.
- Requerimiento: El sistema debe limitar visibilidad de viaticos segun rol y propietario.
- Resultado esperado: Usuarios no financieros solo visualizan sus propios registros.

### REQ-FAC-012
- Actor: Sistema.
- Requerimiento: El sistema debe aplicar validaciones de negocio para kilometraje, gasolina y ambito laboral.
- Resultado esperado: Solicitudes inconsistentes son rechazadas antes de persistencia.

## Listado de requerimientos no funcionales
### RNF-FAC-001 Seguridad de acceso
Las rutas de inventario financiero y viaticos deben exigir autenticacion JWT.

### RNF-FAC-002 Control de autorizacion
Las operaciones de cambio de estado y reportes de viatico deben limitarse a rol financiero.

### RNF-FAC-003 Integridad transaccional
Los movimientos de inventario deben ejecutarse de forma transaccional para evitar descuadres.

### RNF-FAC-004 Trazabilidad
Cada movimiento y cambio relevante debe registrar actor, timestamp y motivo.

### RNF-FAC-005 Validacion de documentos
El sistema debe validar tipo de documento y tamano maximo (15MB) en adjuntos de viaticos.

### RNF-FAC-006 Manejo de errores
Las fallas de integracion con Silver o Drive deben reportarse sin perder consistencia local.

### RNF-FAC-007 Rendimiento de reportes
La exportacion CSV y reportes de cotejo deben ser aptos para ejecucion operativa recurrente.

### RNF-FAC-008 Consistencia de esquema
Las tablas de viaticos y documentos deben estar disponibles y coherentes para operaciones del modulo.

## Reglas de negocio identificadas
- Tipos de movimiento de inventario permitidos: `in`, `out`.
- Cantidad de movimiento debe ser mayor a cero.
- No se permite stock negativo.
- Estados de viatico permitidos: `pending`, `approved`, `paid`, `rejected`.
- Solo Finanzas puede cambiar estado de viaticos.
- Tipos de origen de viatico permitidos: `client_visit`, `prospect_visit`, `manual_trip`.
- Para solicitantes no financieros, el viatico aplica a gastos fuera de area laboral.
- `fuel_amount` solo aplica cuando `distance_km > 1000`.
- Tipos documentales permitidos: `invoice`, `liquidation`, `support`.

## Dependencias con otros modulos
- Inventario.
- Clientes (visitas que originan viaticos).
- Asistencia.
- Autenticacion y Usuarios.
- Documentos/Drive.
- Integracion externa Silver.
