# INFORME DE VALIDACION DEL MODULO

## Nombre del modulo
Control Financiero Operativo y Viaticos

## Descripcion del modulo
Gestiona procesos financieros internos vinculados al inventario operativo y al ciclo de viaticos corporativos (solicitud, soporte documental, validacion, aprobacion y pago). El alcance observado no implementa facturacion tributaria.

## Alcance funcional
- Consulta de inventario financiero y movimientos.
- Registro de entradas/salidas de inventario con motivo.
- Exportacion de reporte CSV de movimientos.
- Conciliacion con sistema externo Silver.
- Gestion de viaticos desde visitas o viajes manuales.
- Control de estado de viaticos y generacion de reporte de cotejo.
- Carga y consulta de evidencias documentales de viaticos.

## Componentes del sistema
### Controladores
- `backend/src/modules/finanzas/finanzas.controller.js`
- `backend/src/modules/viaticos/viaticos.controller.js`

### Servicios
- `backend/src/modules/viaticos/viaticos.service.js`
- `backend/src/modules/finanzas/finanzas.service.js` (sin implementacion funcional)

### Modelos
- Sin ORM; SQL directo y reglas de negocio en servicios/controladores.

### Rutas
- `backend/src/modules/finanzas/finanzas.routes.js`
- `backend/src/modules/viaticos/viaticos.routes.js`

### Componentes de interfaz
- `spi_front/src/modules/finanzas/Dashboard.jsx`
- `spi_front/src/modules/finanzas/pages/ViaticosWorkspace.jsx`
- `spi_front/src/core/api/viaticosApi.js`

## Endpoints de API
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

## Tablas de base de datos asociadas
- `inventory`
- `inventory_movements`
- `travel_allowances`
- `travel_allowance_documents`
- `user_attendance_records`
- `client_visit_logs`
- `prospect_visits`
- `users`

## Dependencias con otros modulos
- Inventario (stock y movimientos).
- Clientes (visitas comerciales que originan viaticos).
- Usuarios/Autenticacion (roles y trazabilidad por usuario).
- Asistencia (validacion geoespacial y de marcaciones en reporte de viatico).
- Documentos/Integraciones Google (almacenamiento de soportes en Drive).
- Integracion externa Silver (conciliacion de inventario financiero).
- Solicitudes internas (origen indirecto de visitas/clientes y contexto operativo).

## Controles de seguridad
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

## Riesgos operativos
- Prefijo redundante en rutas de finanzas (`/api/v1/finanzas/api/v1/inventory`) con riesgo de integracion incorrecta.
- `finanzas.service.js` vacio, lo que sugiere deuda tecnica y posible dispersion de logica en controlador.
- Sincronizacion con Silver sin confirmacion transaccional distribuida (riesgo de desalineacion temporal).
- Creacion/alteracion de tablas en runtime en viaticos (`ensureSchema`), con riesgo de deriva de esquema.

## Posibles escenarios de falla
- Movimiento de inventario con stock insuficiente.
- Falla de conectividad con Silver durante sincronizacion.
- Rechazo de viatico por rol no autorizado o estado invalido.
- Carga de documento fuera de formato o mayor a 15MB.
- Reporte de viatico sin datos de asistencia o georreferencias incompletas.

## Nivel de criticidad
ALTO

## Prioridad de validacion
ALTA

---

## BASE DOCUMENTAL PARA VALIDACION

## Requerimientos del usuario (URS)
- `URS-FAC-001`: Registrar y consultar movimientos financieros de inventario.
- `URS-FAC-002`: Conciliar inventario local con sistema financiero externo.
- `URS-FAC-003`: Solicitar viaticos con evidencia documental.
- `URS-FAC-004`: Aprobar/rechazar/pagar viaticos con control por Finanzas.
- `URS-FAC-005`: Generar reporte tecnico de soporte para cada viatico.

## Requerimientos funcionales
- `RF-FAC-001`: El sistema debe impedir salidas de inventario con saldo negativo.
- `RF-FAC-002`: El sistema debe registrar cada movimiento en `inventory_movements`.
- `RF-FAC-003`: El sistema debe restringir cambio de estado de viatico a roles financieros.
- `RF-FAC-004`: El sistema debe validar reglas de viatico (fuera de area, combustible por kilometraje).
- `RF-FAC-005`: El sistema debe permitir adjuntar documentos y generar reporte de cotejo por viatico.

## Resumen del diseño tecnico
- Arquitectura REST con backend Express y frontend React desacoplado.
- Persistencia SQL directa con transacciones para movimientos de inventario.
- Modulo de viaticos con control de acceso por rol + validaciones de negocio en servicio.
- Integraciones externas: Silver (inventario) y Google Drive (documentos de viaticos).

## Escenarios de prueba
### Funcionalidad
- Caso: Registro de viatico desde visita validada.
- Resultado esperado: se crea/actualiza `travel_allowances` con datos de visita y estado coherente.

### Seguridad
- Caso: Usuario no financiero intenta actualizar estado de viatico.
- Resultado esperado: respuesta `403` y estado sin cambios.

### Manejo de errores
- Caso: Movimiento `out` con cantidad mayor al stock disponible.
- Resultado esperado: respuesta de error de negocio y rollback de transaccion.

### Integridad de datos
- Caso: Generar reporte de viatico con asistencia y soportes.
- Resultado esperado: actualizacion de `attendance_check_status` y persistencia del payload de cotejo.

---

## MATRIZ DE TRAZABILIDAD

| Requerimiento | Componente | Prueba |
|---|---|---|
| REQ-FAC-001 Control de saldos | `finanzas.controller.moveInventory` | Ejecutar salida con stock insuficiente y validar rechazo |
| REQ-FAC-002 Registro de movimientos | `inventory_movements` | Registrar entrada/salida y verificar traza completa |
| REQ-FAC-003 Control por rol financiero | `viaticos.routes` + `viaticos.service.updateAllowanceStatus` | Intentar `PATCH /viaticos/:id/status` con rol no autorizado |
| REQ-FAC-004 Reglas de viatico | `viaticos.service.upsertAllowance` | Crear viatico con `fuel_amount` y `distance_km <= 1000` |
| REQ-FAC-005 Evidencia y cotejo | `viaticos.service.createAllowanceDocument` + `buildAllowanceReport` | Cargar soporte y generar reporte de recomendacion |
