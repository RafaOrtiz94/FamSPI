# DOCUMENTO DE DISENO DEL SISTEMA (DS)

## Nombre del modulo
Servicio Tecnico y Mantenimientos

## Arquitectura del modulo
- Capa de presentacion: frontend React o consumidores internos del SPI.
- Capa API: rutas Express bajo prefijos del backend.
- Capa de negocio: controladores y servicios del modulo.
- Capa de persistencia: consultas SQL directas y tablas asociadas.
- Capa transversal: autenticacion, autorizacion, auditoria y notificaciones cuando aplica.

## Componentes del sistema
### Controladores
- `backend/src/modules/servicio/servicio.controller.js`
- `backend/src/modules/mantenimientos/mantenimientos.controller.js`
- `backend/src/modules/technical-applications/technicalApplications.controller.js`
- `backend/src/modules/approvals/approvals.controller.js`

### Servicios
- `backend/src/modules/mantenimientos/mantenimientos.service.js`
- `backend/src/modules/mantenimientos/mantenimiento.scheduler.js`
- `backend/src/modules/servicio/desinfeccion.service.js`
- `backend/src/modules/servicio/entrenamiento.service.js`
- `backend/src/modules/servicio/asistencia-entrenamiento.service.js`
- `backend/src/modules/servicio/verificacion-equipos.service.js`

### Modelos
- Sin ORM; SQL directo sobre esquemas `servicio` y tablas de soporte documental.

### Rutas
- `backend/src/modules/servicio/servicio.routes.js`
- `backend/src/modules/mantenimientos/mantenimientos.routes.js`
- `backend/src/modules/technical-applications/technicalApplications.routes.js`
- `backend/src/modules/approvals/approvals.routes.js`

### Componentes de interfaz
- `spi_front/src/modules/servicio/pages/Dashboard.jsx`
- `spi_front/src/modules/servicio/pages/Mantenimientos.jsx`
- `spi_front/src/modules/servicio/pages/Disponibilidad.jsx`
- `spi_front/src/modules/servicio/pages/Capacitaciones.jsx`
- `spi_front/src/modules/servicio/pages/Aprobaciones.jsx`
- `spi_front/src/modules/servicio/pages/Aplicaciones.jsx`
- `spi_front/src/modules/servicio/pages/TechnicalProcedureWorkspace.jsx`
- `spi_front/src/modules/servicio/components/MantenimientosList.jsx`
- `spi_front/src/core/api/servicioApi.js`
- `spi_front/src/core/api/mantenimientosApi.js`
- `spi_front/src/core/api/technicalApplicationsApi.js`
- `spi_front/src/core/api/approvalsApi.js`

## Modelo de datos asociado
- `servicio.cronograma_capacitacion`
- `servicio.disponibilidad_tecnicos`
- `servicio.cronograma_actividades_tecnicas`
- `servicio.cronograma_mantenimientos`
- `servicio.cronograma_mantenimientos_anuales`
- `servicio.workflow_documents`
- `servicio.aplicaciones_tecnicas`
- `documents`
- `request_attachments`

## Interfaces API
### Servicio tecnico
- `GET /api/v1/servicio/capacitaciones`
- `POST /api/v1/servicio/capacitaciones`
- `PUT /api/v1/servicio/capacitaciones/:id`
- `DELETE /api/v1/servicio/capacitaciones/:id`
- `GET /api/v1/servicio/disponibilidad`
- `POST /api/v1/servicio/disponibilidad`
- `GET /api/v1/servicio/actividades`
- `POST /api/v1/servicio/actividades`
- `GET /api/v1/servicio/equipos`
- `POST /api/v1/servicio/equipos`
- `GET /api/v1/servicio/mantenimientos`
- `GET /api/v1/servicio/mantenimientos-anuales`
- `POST /api/v1/servicio/mantenimientos-anuales`
- `POST /api/v1/servicio/desinfeccion/pdf`
- `POST /api/v1/servicio/entrenamiento/pdf`
- `POST /api/v1/servicio/entrenamiento/asistencia/pdf`
- `POST /api/v1/servicio/entrenamiento/verificacion/pdf`
- `GET /api/v1/servicio/workflow-documents`
- `GET /api/v1/servicio/workflow-documents/summary`

### Mantenimientos
- `POST /api/v1/mantenimientos`
- `GET /api/v1/mantenimientos`
- `GET /api/v1/mantenimientos/:id`
- `POST /api/v1/mantenimientos/:id/sign`
- `POST /api/v1/mantenimientos/:id/sign-advanced`
- `POST /api/v1/mantenimientos/:id/approve`
- `POST /api/v1/mantenimientos/:id/export`

### Aplicaciones tecnicas y aprobaciones
- `GET /api/v1/technical-applications/available`
- `GET /api/v1/approvals/pending`
- `POST /api/v1/approvals/:id/approve`
- `POST /api/v1/approvals/:id/reject`

## Dependencias tecnicas
- Autenticacion y Sesiones.
- Comercial y Gestion de Clientes.
- Inventario y Equipos.
- Documentos/Archivos/Firma.
- Notificaciones y Comunicaciones.

## Controles de seguridad y operacion
### Control de acceso
- JWT obligatorio y `requireRole` en rutas tecnicas criticas.
- Restriccion por perfiles tecnicos, jefaturas y gerencia.

### Autenticacion
- Todas las operaciones requieren usuario autenticado.

### Autorizacion
- Segmentacion de acciones por rol (tecnico, jefe_tecnico, jefe_servicio_tecnico, gerencia).
- Aprobaciones tecnicas separadas en modulo `approvals`.

### Registro de auditoria
- Registros de workflow tecnico y estados de mantenimiento.
- Historial de firma/aprobacion en mantenimiento.

### Proteccion de datos
- Cargas controladas con `multer`.
- Documentos y evidencias enviados a Drive con identificadores de trazabilidad.

## Riesgos tecnicos detectados
- Multiplicidad de roles puede generar configuracion inconsistente de autorizacion.
- Uso de almacenamiento temporal (`/tmp`) para archivos en algunos flujos.
- Dependencia de Drive y correo para evidencia y recordatorios.
- Acoplamiento entre mantenimiento y tabla `documents` puede impactar trazabilidad documental.

## Diagrama tecnico
`mermaid
flowchart LR
  UI[Frontend o consumidor] --> API[API STM]
  API --> CTRL[Controladores]
  CTRL --> SVC[Servicios]
  SVC --> DB[(Base de datos)]
  SVC --> EXT[Dependencias externas o modulos transversales]
`
