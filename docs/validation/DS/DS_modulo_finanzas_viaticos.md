# DOCUMENTO DE DISENO DEL SISTEMA (DS)

## Nombre del modulo
Control Financiero Operativo y Viaticos

## Arquitectura del modulo
- Capa de presentacion: frontend React o consumidores internos del SPI.
- Capa API: rutas Express bajo prefijos del backend.
- Capa de negocio: controladores y servicios del modulo.
- Capa de persistencia: consultas SQL directas y tablas asociadas.
- Capa transversal: autenticacion, autorizacion, auditoria y notificaciones cuando aplica.

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

## Modelo de datos asociado
- `inventory`
- `inventory_movements`
- `travel_allowances`
- `travel_allowance_documents`
- `user_attendance_records`
- `client_visit_logs`
- `prospect_visits`
- `users`

## Interfaces API
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

## Dependencias tecnicas
- Inventario (stock y movimientos).
- Clientes (visitas comerciales que originan viaticos).
- Usuarios/Autenticacion (roles y trazabilidad por usuario).
- Asistencia (validacion geoespacial y de marcaciones en reporte de viatico).
- Documentos/Integraciones Google (almacenamiento de soportes en Drive).
- Integracion externa Silver (conciliacion de inventario financiero).
- Solicitudes internas (origen indirecto de visitas/clientes y contexto operativo).

## Controles de seguridad y operacion
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

## Riesgos tecnicos detectados
- Prefijo redundante en rutas de finanzas (`/api/v1/finanzas/api/v1/inventory`) con riesgo de integracion incorrecta.
- `finanzas.service.js` vacio, lo que sugiere deuda tecnica y posible dispersion de logica en controlador.
- Sincronizacion con Silver sin confirmacion transaccional distribuida (riesgo de desalineacion temporal).
- Creacion/alteracion de tablas en runtime en viaticos (`ensureSchema`), con riesgo de deriva de esquema.

## Diagrama tecnico
`mermaid
flowchart LR
  UI[Frontend o consumidor] --> API[API FIN]
  API --> CTRL[Controladores]
  CTRL --> SVC[Servicios]
  SVC --> DB[(Base de datos)]
  SVC --> EXT[Dependencias externas o modulos transversales]
`
