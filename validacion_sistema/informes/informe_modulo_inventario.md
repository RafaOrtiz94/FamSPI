# INFORME DE VALIDACION DEL MODULO

## Nombre del modulo
Inventario

## Descripcion del modulo
Administra la disponibilidad y trazabilidad de equipos por unidad para los procesos internos de compra, entrega y servicio tecnico, incluyendo alta desde modelo, captura de serial, asignacion a cliente y cambios de estado.

## Alcance funcional
- Consulta de inventario completo y equipos disponibles.
- Consulta de modelos de equipos.
- Creacion de unidad por modelo.
- Captura/confirmacion de serial.
- Asignacion de unidad a cliente/sucursal.
- Cambio de estado operativo de unidad.
- Registro de movimientos de inventario.

## Componentes del sistema
### Controladores
- `backend/src/modules/inventario/inventario.controller.js`

### Servicios
- `backend/src/modules/inventario/inventario.service.js`

### Modelos
- Sin ORM; SQL directo.

### Rutas
- `backend/src/modules/inventario/inventario.routes.js`

### Componentes de interfaz
- `spi_front/src/core/api/inventarioApi.js`
- `spi_front/src/modules/servicio/components/dashboard/EquiposManagement.jsx`
- `spi_front/src/modules/operaciones/pages/EquipmentCatalog.jsx`

## Endpoints de API
- `GET /api/v1/inventario`
- `GET /api/v1/inventario/equipos-disponibles`
- `GET /api/v1/inventario/equipos-cliente/:cliente_id`
- `GET /api/v1/inventario/modelos`
- `POST /api/v1/inventario/equipos-unidad`
- `POST /api/v1/inventario/equipos-unidad/:id/serial`
- `POST /api/v1/inventario/equipos-unidad/:id/asignar`
- `POST /api/v1/inventario/equipos-unidad/:id/cambiar-estado`
- `POST /api/v1/inventario/movimiento`

## Tablas de base de datos asociadas
- `inventory`
- `inventory_movements`
- `equipos_modelo`
- `equipos_unidad`
- `equipos_historial`
- `v_inventario_completo` (vista)

## Dependencias con otros modulos
- Clientes (asignacion de unidad por `cliente_id`).
- Pedidos/Solicitudes (referencia `request_id` en historial de equipo).
- Facturacion (movimientos de inventario usados por finanzas/reportes).

## Controles de seguridad
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

## Riesgos operativos
- Falta de segmentacion por rol en endpoints de mutacion critica.
- Dependencia de vista `v_inventario_completo`; si cambia, impacta todas las consultas.
- Manejo de serial temporal (`SIN-SERIE-*`) puede ocultar unidades sin regularizacion.

## Posibles escenarios de falla
- Cambio de estado no permitido.
- Serial duplicado en captura/asignacion.
- Registro de movimiento con cantidad invalida.

## Nivel de criticidad
CRITICO

## Prioridad de validacion
MUY ALTA

---

## BASE DOCUMENTAL PARA VALIDACION

## Requerimientos del usuario (URS)
- `URS-INV-001`: Visualizar inventario actualizado por equipo/unidad.
- `URS-INV-002`: Crear unidades de equipos desde catalogo de modelos.
- `URS-INV-003`: Registrar serial real de cada unidad.
- `URS-INV-004`: Asignar y cambiar estado de unidades por flujo operativo.
- `URS-INV-005`: Registrar entradas/salidas de inventario.

## Requerimientos funcionales
- `RF-INV-001`: Consultar inventario filtrable por estado, tipo y cliente.
- `RF-INV-002`: En creacion de unidad, validar existencia de modelo.
- `RF-INV-003`: Garantizar unicidad de serial.
- `RF-INV-004`: Permitir solo estados definidos por catalogo.
- `RF-INV-005`: Registrar todo cambio en `equipos_historial`.

## Resumen del diseño tecnico
- Servicio transaccional con `BEGIN/COMMIT` para operaciones de unidad.
- Integridad de serial y estado en backend.
- Exposicion de endpoints REST para operaciones operativas.
- Frontend desacoplado mediante `inventarioApi`.

## Escenarios de prueba
### Funcionalidad
- Caso: Crear unidad con modelo valido y sin serial.
- Resultado esperado: unidad creada en `no_asignado` y evento `unidad_creada`.

### Seguridad
- Caso: Usuario autenticado sin perfil operativo intenta mutar inventario.
- Resultado esperado: rechazo por politica de roles (control requerido en validacion).

### Manejo de errores
- Caso: Captura de serial ya existente.
- Resultado esperado: `409` por conflicto de unicidad.

### Integridad de datos
- Caso: Cambio de estado de unidad y posterior auditoria.
- Resultado esperado: actualizacion en `equipos_unidad` + traza en `equipos_historial`.

---

## MATRIZ DE TRAZABILIDAD

| Requerimiento | Componente | Prueba |
|---|---|---|
| REQ-INV-001 Consulta inventario | `inventario.service.getAllInventario` | Filtrar por cliente, estado y serial pendiente |
| REQ-INV-002 Alta de unidad | `inventario.service.createUnidad` | Crear unidad desde `modelo_id` valido |
| REQ-INV-003 Serial unico | `inventario.service.captureSerial` | Registrar serial repetido y esperar conflicto |
| REQ-INV-004 Estados controlados | `inventario.service.cambiarEstadoUnidad` | Intentar estado fuera de catalogo |
| REQ-INV-005 Trazabilidad | `equipos_historial` via servicio | Verificar eventos por cada mutacion |
