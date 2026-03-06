# INFORME DE VALIDACION DEL MODULO

## Nombre del modulo
Servicio Tecnico y Mantenimientos

## Descripcion del modulo
Coordina procesos tecnicos internos: capacitaciones, disponibilidad de tecnicos, actividades, mantenimientos, aplicaciones tecnicas y generacion de documentos operativos de soporte en campo.

## Alcance funcional
- Gestion de cronograma de capacitaciones tecnicas.
- Gestion de disponibilidad y actividades del equipo tecnico.
- Gestion de equipos y mantenimientos anuales.
- Registro y seguimiento de mantenimientos con firmas.
- Generacion de PDFs operativos (desinfeccion, entrenamiento, verificacion).
- Publicacion de documentos de workflow tecnico.
- Aprobaciones tecnicas de solicitudes y acceso a aplicaciones tecnicas.

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

## Endpoints de API
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

## Tablas de base de datos asociadas
- `servicio.cronograma_capacitacion`
- `servicio.disponibilidad_tecnicos`
- `servicio.cronograma_actividades_tecnicas`
- `servicio.cronograma_mantenimientos`
- `servicio.cronograma_mantenimientos_anuales`
- `servicio.workflow_documents`
- `servicio.aplicaciones_tecnicas`
- `documents`
- `request_attachments`

## Dependencias con otros modulos
- Autenticacion y Sesiones.
- Comercial y Gestion de Clientes.
- Inventario y Equipos.
- Documentos/Archivos/Firma.
- Notificaciones y Comunicaciones.

## Controles de seguridad
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

## Riesgos operativos
- Multiplicidad de roles puede generar configuracion inconsistente de autorizacion.
- Uso de almacenamiento temporal (`/tmp`) para archivos en algunos flujos.
- Dependencia de Drive y correo para evidencia y recordatorios.
- Acoplamiento entre mantenimiento y tabla `documents` puede impactar trazabilidad documental.

## Posibles escenarios de falla
- Mantenimiento creado sin firma completa en etapas esperadas.
- Error de generacion PDF por datos incompletos del formulario tecnico.
- Fallo en recordatorios programados de mantenimiento.
- Documento de workflow tecnico no visible por desincronizacion de rol.

## Nivel de criticidad
ALTO

## Prioridad de validacion
ALTA

---

## BASE DOCUMENTAL PARA VALIDACION

## Requerimientos del usuario (URS)
- `URS-SER-001`: El sistema debe permitir gestionar cronogramas y actividades del equipo tecnico.
- `URS-SER-002`: El sistema debe permitir registrar y aprobar mantenimientos con evidencia.
- `URS-SER-003`: El sistema debe permitir emitir formatos PDF operativos del servicio tecnico.
- `URS-SER-004`: El sistema debe permitir publicar y consultar documentos de workflow tecnico.
- `URS-SER-005`: El sistema debe permitir acceder al catalogo de aplicaciones tecnicas disponibles.

## Requerimientos funcionales
- `RF-SER-001`: CRUD de capacitaciones, disponibilidad y actividades.
- `RF-SER-002`: Flujo de mantenimiento con firma, aprobacion y exportacion.
- `RF-SER-003`: Generacion de documentos PDF con datos operativos y firmas.
- `RF-SER-004`: Consulta de pendientes de aprobacion y resolucion por jefaturas tecnicas.
- `RF-SER-005`: Control de acceso por rol tecnico en toda operacion critica.

## Resumen del diseno tecnico
- Submodulos `servicio`, `mantenimientos`, `technical-applications`, `approvals`.
- SQL directo sobre esquema `servicio` y tablas transversales.
- Scheduler de recordatorios en backend + endpoint de job interno.
- Frontend React con panel por vista tecnica y workspace de procedimientos.

## Escenarios de prueba
### Funcionalidad
- Caso: Crear mantenimiento con evidencias y posterior aprobacion.
- Resultado esperado: Registro en `servicio.cronograma_mantenimientos` y documento exportado.

### Seguridad
- Caso: Usuario no tecnico intenta aprobar mantenimiento.
- Resultado esperado: `403` sin cambio de estado.

### Manejo de errores
- Caso: Falla de subida de evidencia durante creacion de mantenimiento.
- Resultado esperado: Error controlado, sin registro parcial inconsistente.

### Integridad de datos
- Caso: Registrar disponibilidad y actividad tecnica del mismo dia.
- Resultado esperado: Consistencia de datos en cronograma y resumen operativo.

---

## MATRIZ DE TRAZABILIDAD

| Requerimiento | Componente | Prueba |
|---|---|---|
| REQ-SER-001 Planificacion tecnica | `servicio.controller` | Crear/editar capacitaciones, disponibilidad y actividades |
| REQ-SER-002 Mantenimientos | `mantenimientos.service` | Flujo completo crear->firmar->aprobar->exportar |
| REQ-SER-003 PDFs operativos | `desinfeccion.service` + `entrenamiento.service` | Generar PDF y validar contenido/firma |
| REQ-SER-004 Aprobaciones tecnicas | `approvals.controller` | Aprobar/rechazar pendiente con rol autorizado |
| REQ-SER-005 Aplicaciones disponibles | `technicalApplications.controller.listAvailable` | Consultar catalogo por rol y validar filtros |
