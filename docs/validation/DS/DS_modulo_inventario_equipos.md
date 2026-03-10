# DOCUMENTO DE DISENO DEL SISTEMA (DS)

## Nombre del modulo
Inventario y Equipos

## Arquitectura del modulo
- Capa de presentacion: frontend React o consumidores internos del SPI.
- Capa API: rutas Express bajo prefijos del backend.
- Capa de negocio: controladores y servicios del modulo.
- Capa de persistencia: consultas SQL directas y tablas asociadas.
- Capa transversal: autenticacion, autorizacion, auditoria y notificaciones cuando aplica.

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

## Modelo de datos asociado
- `inventory`
- `inventory_movements`
- `equipos_modelo`
- `equipos_unidad`
- `equipos_historial`
- `v_inventario_completo` (vista)

## Interfaces API
- `GET /api/v1/inventario`
- `GET /api/v1/inventario/equipos-disponibles`
- `GET /api/v1/inventario/equipos-cliente/:cliente_id`
- `GET /api/v1/inventario/modelos`
- `POST /api/v1/inventario/equipos-unidad`
- `POST /api/v1/inventario/equipos-unidad/:id/serial`
- `POST /api/v1/inventario/equipos-unidad/:id/asignar`
- `POST /api/v1/inventario/equipos-unidad/:id/cambiar-estado`
- `POST /api/v1/inventario/movimiento`

## Dependencias tecnicas
- Clientes (asignacion de unidad por `cliente_id`).
- Pedidos/Solicitudes (referencia `request_id` en historial de equipo).
- Facturacion (movimientos de inventario usados por finanzas/reportes).

## Controles de seguridad y operacion
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

## Riesgos tecnicos detectados
- Falta de segmentacion por rol en endpoints de mutacion critica.
- Dependencia de vista `v_inventario_completo`; si cambia, impacta todas las consultas.
- Manejo de serial temporal (`SIN-SERIE-*`) puede ocultar unidades sin regularizacion.

## Diagrama tecnico
`mermaid
flowchart LR
  UI[Frontend o consumidor] --> API[API INV]
  API --> CTRL[Controladores]
  CTRL --> SVC[Servicios]
  SVC --> DB[(Base de datos)]
  SVC --> EXT[Dependencias externas o modulos transversales]
`
