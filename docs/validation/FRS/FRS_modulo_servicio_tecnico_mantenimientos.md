# FRS — MÓDULO SERVICIO TÉCNICO Y MANTENIMIENTOS

**Sistema:** FamSPI
**Versión:** 2.0
**Fecha:** 2026-06-18
**Estado:** En revisión
**Alineación:** WHO TRS 1019, Annex 3, Appendix 5

---

## 1. Introducción

El presente documento especifica el comportamiento funcional del módulo Servicio Técnico y Mantenimientos del sistema FamSPI. Describe cada área funcional con sus endpoints reales, entradas, proceso ejecutado por el servicio y salida esperada. Es la referencia técnica que traza el puente entre los requerimientos de usuario (URS) y el diseño de sistema (DS).

El módulo está implementado en `backend/src/modules/servicio/` y sus rutas se registran bajo el prefijo `/api/v1/servicio` y `/api/v1/external-cases`. Incluye cuatro procedimientos técnicos formales (ST-01-01 a ST-01-04) con sus máquinas de estado, nueve tipos de documentos PDF y dos conjuntos de rutas independientes.

## 2. Descripción funcional del módulo

El módulo agrupa las siguientes áreas funcionales:

1. **Capacitaciones** — CRUD de cronograma de capacitaciones técnicas.
2. **Disponibilidad de técnicos** — Lectura y actualización de disponibilidad individual.
3. **Actividades técnicas** — Listado y creación de actividades del equipo técnico.
4. **Equipos** — Consulta y registro de equipos bajo responsabilidad técnica.
5. **Mantenimientos** — Consulta de mantenimientos registrados.
6. **Mantenimientos anuales** — Consulta y creación de mantenimientos anuales planificados.
7. **Desinfección** — Generación de PDF de desinfección de instrumentos (F.ST-02).
8. **Workflow de entrenamiento (ST-01-01)** — Máquina de estado con 9 PDFs controlados: coordinación, asistencia, evaluación, evaluación de especialista, conformidad, verificación de equipos, más emisión y entrega de certificado.
9. **Workflow de retiro de equipos (ST-01-01)** — Máquina de estado con PDF FST-11 y gestión de etapas de retiro físico.
10. **Mantenimientos correctivos (ST-01-03)** — Workspace con KPIs, máquina de estado CEAC, timeline, comentarios y evidencias.
11. **Casos externos (ST-01-04)** — Integración con Navify, Rexis, GoApp y Online Support mediante adaptadores, con cola de sincronización, despacho CEAC y hitos GoApp.
12. **Infraestructura de workflow** — Catálogo de procedimientos, registry de estado, timeline de eventos, documentos y reporting.

## 3. Especificaciones funcionales

---

### FRS-SRV-001 — Gestión de capacitaciones técnicas

**Endpoints:**
- `GET /api/v1/servicio/capacitaciones`
- `POST /api/v1/servicio/capacitaciones`
- `PUT /api/v1/servicio/capacitaciones/:id`
- `DELETE /api/v1/servicio/capacitaciones/:id`

**Roles permitidos:** `tecnico`, `jefe_tecnico`, `jefe_servicio_tecnico`, `gerencia` (todas las operaciones)

**Entradas:**
- GET: ningún parámetro requerido.
- POST: cuerpo JSON con datos de la capacitación (título, fecha, responsable, participantes).
- PUT: `id` en path + cuerpo JSON con campos a actualizar.
- DELETE: `id` en path.

**Proceso:**
El controlador `servicio.controller.js` delega en el servicio de capacitaciones. Las operaciones de lectura consultan la tabla de cronograma de capacitaciones. Las operaciones de escritura persisten el registro con identificación del usuario autenticado. La eliminación marca el registro como eliminado o lo suprime según la implementación del servicio.

**Salida:**
- GET: array de registros de capacitación activos.
- POST: objeto con el registro creado y su identificador asignado.
- PUT: objeto con el registro actualizado.
- DELETE: confirmación de eliminación (`204 No Content` o JSON de confirmación).

---

### FRS-SRV-002 — Disponibilidad de técnicos

**Endpoints:**
- `GET /api/v1/servicio/disponibilidad`
- `POST /api/v1/servicio/disponibilidad`

**Roles permitidos:** `servicio_tecnico`, `tecnico`, `jefe_servicio_tecnico`, `gerencia`

**Entradas:**
- GET: ningún parámetro requerido.
- POST: cuerpo JSON con el identificador del técnico y su nuevo estado de disponibilidad.

**Proceso:**
La consulta retorna el estado de disponibilidad de todos los técnicos registrados. La actualización persiste el nuevo estado para el técnico indicado e identifica al usuario que realizó el cambio.

**Salida:**
- GET: array de técnicos con su estado de disponibilidad actual (disponible / no disponible / en visita / etc.).
- POST: confirmación de actualización con el estado nuevo registrado.

---

### FRS-SRV-003 — Actividades técnicas

**Endpoints:**
- `GET /api/v1/servicio/actividades`
- `POST /api/v1/servicio/actividades`

**Roles lectura:** `servicio_tecnico`, `tecnico`, `jefe_tecnico`, `jefe_servicio_tecnico`, `gerencia`, `comercial`, `acp_comercial`, `jefe_comercial`
**Roles escritura:** `servicio_tecnico`, `tecnico`, `jefe_tecnico`, `jefe_servicio_tecnico`, `gerencia`

**Entradas:**
- GET: ningún parámetro requerido.
- POST: cuerpo JSON con descripción de la actividad, fecha, técnico asignado y datos del cliente o equipo relacionado.

**Proceso:**
El listado retorna las actividades técnicas registradas en la tabla `servicio.cronograma_actividades_tecnicas`. La creación persiste la nueva actividad con el usuario autenticado como registrador.

**Salida:**
- GET: array de actividades técnicas con sus datos de asignación y estado.
- POST: objeto con la actividad creada e identificador asignado.

---

### FRS-SRV-004 — Equipos

**Endpoints:**
- `GET /api/v1/servicio/equipos`
- `POST /api/v1/servicio/equipos`

**Roles lectura:** `tecnico`, `gerencia`, `jefe_tecnico`, `jefe_servicio_tecnico`, `ti`, `jefe_ti`, `admin_ti`
**Roles escritura:** `tecnico`, `gerencia`, `jefe_tecnico`, `jefe_servicio_tecnico`

**Entradas:**
- GET: ningún parámetro requerido.
- POST: cuerpo JSON con datos del equipo (número de serie, modelo, marca, cliente asignado, fecha de instalación).

**Proceso:**
La consulta retorna los equipos registrados en el sistema. La creación persiste el nuevo equipo con su identificador único y los datos de trazabilidad del registro.

**Salida:**
- GET: array de equipos con sus datos identificativos.
- POST: objeto con el equipo creado e identificador asignado.

---

### FRS-SRV-005 — Mantenimientos y mantenimientos anuales

**Endpoints:**
- `GET /api/v1/servicio/mantenimientos`
- `GET /api/v1/servicio/mantenimientos-anuales`
- `POST /api/v1/servicio/mantenimientos-anuales`

**Roles:** `tecnico`, `gerencia`, `jefe_tecnico`, `jefe_servicio_tecnico`

**Entradas:**
- GET mantenimientos: ningún parámetro requerido.
- GET mantenimientos-anuales: ningún parámetro requerido.
- POST mantenimientos-anuales: cuerpo JSON con datos del mantenimiento anual (equipo, fecha programada, técnico responsable, tipo de mantenimiento).

**Proceso:**
Las consultas retornan los registros de la tabla `servicio.cronograma_mantenimientos` y `servicio.cronograma_mantenimientos_anuales` respectivamente. La creación de mantenimiento anual persiste el evento planificado vinculado al equipo correspondiente.

**Salida:**
- GET mantenimientos: array de mantenimientos registrados con su estado.
- GET mantenimientos-anuales: array de eventos anuales planificados.
- POST: objeto con el mantenimiento anual creado.

---

### FRS-SRV-006 — Generación de PDF de desinfección (F.ST-02)

**Endpoint:** `POST /api/v1/servicio/desinfeccion/pdf`

**Roles:** `tecnico`, `jefe_tecnico`, `jefe_servicio_tecnico`, `gerencia`

**Entradas:** Cuerpo JSON con datos del procedimiento de desinfección: instrumento, técnico responsable, fecha, método de desinfección, observaciones.

**Proceso:**
El controlador invoca al servicio `desinfeccion.service.js`, que compone el documento PDF a partir de los datos recibidos usando la plantilla del formulario F.ST-02. El PDF se genera en memoria o en ruta temporal y se retorna como archivo binario o en base64.

**Salida:** Archivo PDF del formulario de desinfección con los datos del procedimiento, listo para descarga, firma y archivo.

---

### FRS-SRV-007 — Workflow de entrenamiento (ST-01-01): PDFs y máquina de estado

**Endpoints:**
- `GET /api/v1/servicio/entrenamiento/workflow` — Consultar estado actual del workflow
- `POST /api/v1/servicio/entrenamiento/workflow` — Avanzar estado (transición)
- `POST /api/v1/servicio/entrenamiento/pdf` — PDF de coordinación de entrenamiento
- `POST /api/v1/servicio/entrenamiento/asistencia/pdf` — PDF de lista de asistencia
- `POST /api/v1/servicio/entrenamiento/evaluacion/pdf` — PDF de evaluación de entrenamiento
- `POST /api/v1/servicio/entrenamiento/evaluacion-especialista/pdf` — PDF de evaluación de especialista
- `POST /api/v1/servicio/entrenamiento/conformidad/pdf` — PDF de conformidad
- `POST /api/v1/servicio/entrenamiento/verificacion/pdf` — PDF de verificación de equipos nuevos
- `POST /api/v1/servicio/entrenamiento/certificado/emitir` — Emitir certificado
- `POST /api/v1/servicio/entrenamiento/certificado/entregar` — Registrar entrega del certificado

**Roles lectura:** `workflowReadRoles` (tecnico, jefe_tecnico, jefe_servicio_tecnico, servicio_tecnico, comercial, acp_comercial, jefe_comercial, gerencia, gerencia_general, operaciones, jefe_operaciones, jefe_logistica)
**Roles escritura:** `tecnico`, `jefe_tecnico`, `jefe_servicio_tecnico`, `gerencia`

**Entradas (GET workflow):** `source_type` y `source_id` como parámetros de query para identificar el workflow.

**Entradas (POST workflow):** Cuerpo JSON con `source_type`, `source_id`, `action` (nombre de la transición a ejecutar) y datos complementarios de la etapa.

**Entradas (PDFs):** Cuerpo JSON con los datos específicos de cada documento: participantes, fechas, puntajes, datos del técnico firmante, datos del cliente y equipo.

**Proceso (GET):** `trainingWorkflow.service.js` consulta el estado actual del workflow en el registry, retorna las etapas completadas, la etapa actual y las transiciones disponibles desde el estado presente.

**Proceso (POST):** El servicio valida la transición mediante `workflowStateMachine.service.js` (ST-01-01), aplica las reglas de negocio de la etapa (porcentaje de asistencia mínimo 100%, nota mínima de evaluación 80%, nota mínima de especialista 80%), persiste el nuevo estado, registra el evento de auditoría mediante `appendWorkflowAuditEvent` y actualiza el documento de workflow mediante `trackWorkflowDocumentByCode`.

**Proceso (PDFs):** Cada endpoint de PDF invoca al servicio correspondiente en `trainingDocumentUtils.service.js` o en el servicio específico del documento. El servicio compone el PDF desde la plantilla, incorpora datos del workflow activo cuando corresponde y retorna el archivo.

**Proceso (certificado):** La emisión del certificado es ejecutada por `trainingCertificates.service.js`; la entrega registra la fecha y el responsable de entrega en el workflow.

**Salida (GET):** Objeto con estado actual, etapas completadas, timestamps, metadatos de cada etapa y transiciones disponibles.
**Salida (POST workflow):** Objeto con el estado nuevo aplicado y el evento de auditoría generado.
**Salida (PDFs):** Archivo PDF del documento correspondiente.
**Salida (certificado emitir):** Objeto con datos del certificado emitido e identificador de documento.
**Salida (certificado entregar):** Confirmación de registro de entrega con fecha y usuario.

---

### FRS-SRV-008 — Workflow de retiro de equipos (ST-01-01): FST-11 y etapas

**Endpoints:**
- `GET /api/v1/servicio/withdrawal/workflow/list` — Listar todos los workflows de retiro
- `GET /api/v1/servicio/withdrawal/workflow` — Consultar estado de un retiro específico
- `POST /api/v1/servicio/withdrawal/workflow` — Avanzar estado del retiro
- `POST /api/v1/servicio/withdrawal/fst11/pdf` — Generar acta de retiro FST-11

**Roles lectura:** `workflowReadRoles`
**Roles escritura:** `withdrawalWriteRoles` (tecnico, jefe_tecnico, jefe_servicio_tecnico, servicio_tecnico, logistica, jefe_logistica, comercial, jefe_comercial, gerencia, gerencia_general)

**Entradas (GET list):** Sin parámetros requeridos; retorna todos los workflows de retiro activos o historizados.
**Entradas (GET workflow):** `source_type` y `source_id` como query params.
**Entradas (POST workflow):** Cuerpo JSON con `source_type`, `source_id`, acción a ejecutar y datos de la etapa (datos de coordinación, datos de desinfección, datos de embalaje, datos de ejecución del retiro).
**Entradas (FST-11):** Cuerpo JSON con datos del acta: equipo, técnico, cliente, fecha de retiro, número de serie, observaciones.

**Proceso (POST workflow):** `withdrawalWorkflow.service.js` valida la transición en la máquina de estado ST-01-01, verifica precondiciones de etapa (estado del caso proveedor y de la orden de trabajo para avanzar), persiste el estado, registra el evento de auditoría y sube archivos a Drive cuando la etapa lo requiere (`ensureFolder`, `uploadBase64File`).

**Estado inicial:** `withdrawal_requested` → `withdrawal_coordinated` → `desinfection_completed` → `packaging_completed` → `withdrawal_executed` → `completed`.

**Proceso (FST-11):** `fst11.service.js` compone el PDF del acta de retiro con los datos del equipo, el técnico y el cliente; retorna el enlace a Drive o el archivo en base64.

**Salida (GET list):** Array de workflows de retiro con su estado actual y datos de identificación.
**Salida (GET workflow):** Objeto con el estado completo del retiro: coordinación, caso proveedor, orden de trabajo, desinfección, embalaje, ejecución.
**Salida (POST workflow):** Objeto con el estado nuevo y el evento de auditoría.
**Salida (FST-11):** PDF del acta de retiro o enlace de Drive.

---

### FRS-SRV-009 — Mantenimientos correctivos (ST-01-03): workspace, KPIs y caso detalle

**Endpoints:**
- `POST /api/v1/servicio/corrective-cases` — Crear caso correctivo
- `GET /api/v1/servicio/corrective-cases/workspace/list` — Listar workspace
- `GET /api/v1/servicio/corrective-cases/workspace/kpi` — KPIs del workspace
- `GET /api/v1/servicio/corrective-cases/:id` — Detalle del caso
- `GET /api/v1/servicio/corrective-cases/:id/timeline` — Timeline de eventos
- `GET /api/v1/servicio/corrective-cases/:id/events` — Eventos del caso
- `GET /api/v1/servicio/corrective-cases/:id/comments` — Comentarios
- `POST /api/v1/servicio/corrective-cases/:id/comments` — Agregar comentario
- `GET /api/v1/servicio/corrective-cases/:id/evidences` — Evidencias
- `POST /api/v1/servicio/corrective-cases/:id/actions` — Ejecutar acción (transición de estado)

**Roles lectura:** `correctiveReadRoles` (tecnico, servicio_tecnico, jefe_tecnico, jefe_servicio_tecnico, ti, jefe_ti, admin_ti, comercial, jefe_comercial, backoffice_comercial, acp_comercial, gerencia, gerencia_general)
**Roles escritura:** `correctiveWriteRoles` (mismos roles que lectura)

**Entradas (POST crear):** Cuerpo JSON con datos del equipo afectado, descripción del problema, cliente, técnico asignado, prioridad y datos de triage inicial.

**Entradas (GET workspace/list):** Query params opcionales para filtros (estado, técnico, fecha, cliente).

**Entradas (POST actions):** Cuerpo JSON con la acción a ejecutar (transición de estado), datos de clasificación cuando aplica (aplicaciones / ingeniería / proveedor LIS), datos de repuestos, datos de visita, decisión de cliente.

**Proceso (crear):** `correctiveCases.service.js` crea el caso con estado inicial `ceac_received`, registra el evento inicial en el timeline, y opcionalmente despacha notificación a roles CEAC/dispatcher mediante `ceacDispatch.service.js`.

**Proceso (workspace/list y kpi):** El servicio consulta todos los casos con sus estados actuales, agrupa por estado y calcula KPIs: total de casos, distribución por estado, tiempo promedio de resolución, casos vencidos.

**Proceso (actions):** El controlador invoca `postCorrectiveCaseActionController`, que delega en el servicio para validar la transición mediante `correctiveStateMachine.service.js`, ejecutar la lógica de negocio de la acción (clasificar, agendar visita, cotizar repuestos, registrar decisión de cliente, cerrar), persistir el nuevo estado y registrar el evento en el timeline.

**Máquina de estado ST-01-03:**
- Estado inicial: `ceac_received`
- Flujo nominal: `ceac_received` → `ceac_diagnosis` → `escalated_dispatch` → `visit_scheduled` → `visit_in_progress` → `parts_pending_quote` → `parts_pending_client_approval` → `parts_approved` → `revisit_scheduled` → `part_replaced` → `pending_disinfection` → `closed`
- Resolución remota: `ceac_received` → `resolved_remote` → `closed`
- Clasificación: `escalated_dispatch` → `classified_applications` / `classified_engineering` / `classified_provider`
- Estados terminales sin transición de salida: `closed`, `cancelled`

**Salida (crear):** Objeto con el caso creado, su identificador y estado inicial.
**Salida (workspace/list):** Array paginado de casos con estado, técnico, equipo, cliente, fecha de creación y tiempo en estado actual.
**Salida (workspace/kpi):** Objeto con métricas agregadas del workspace correctivo.
**Salida (detalle):** Objeto completo del caso con todos sus campos, estado actual y metadata.
**Salida (timeline/events/comments/evidences):** Arrays de los registros correspondientes ordenados cronológicamente.
**Salida (actions):** Objeto con el estado nuevo, datos de la acción ejecutada y evento de timeline generado.

---

### FRS-SRV-010 — Casos externos con integración a plataformas externas (ST-01-04)

**Endpoints:**
- `GET /api/v1/external-cases/workspace/list` — Listar workspace de casos externos
- `GET /api/v1/external-cases/workspace/kpi` — KPIs
- `GET /api/v1/external-cases/providers/health` — Estado de salud de proveedores externos
- `GET /api/v1/external-cases/provider-identities` — Listar identidades de proveedor
- `POST /api/v1/external-cases/provider-identities` — Crear/actualizar identidad de proveedor
- `POST /api/v1/external-cases/sync/process-queue` — Procesar cola de sincronización
- `POST /api/v1/external-cases/inbound/:provider` — Crear caso inbound por proveedor
- `POST /api/v1/external-cases/` — Crear caso externo
- `GET /api/v1/external-cases/:id` — Detalle del caso
- `GET /api/v1/external-cases/:id/events` — Eventos del caso
- `POST /api/v1/external-cases/:id/retry-sync` — Reintentar sincronización
- `POST /api/v1/external-cases/:id/reconcile` — Reconciliar estado
- `POST /api/v1/external-cases/:id/ceac-decision` — Registrar decisión CEAC
- `POST /api/v1/external-cases/:id/goapp/milestones/:milestone` — Registrar hito GoApp

**Roles lectura:** `READ_ROLES` (ti, jefe_ti, admin_ti, tecnico, servicio_tecnico, jefe_tecnico, jefe_servicio_tecnico, dispatcher, ceac, comercial, jefe_comercial, backoffice_comercial, acp_comercial, gerencia, gerencia_general)
**Roles escritura:** `WRITE_ROLES` (ti, jefe_ti, admin_ti, tecnico, servicio_tecnico, jefe_tecnico, jefe_servicio_tecnico, dispatcher, ceac, gerencia, gerencia_general)

**Proveedores soportados:** `navify`, `online_support`, `rexis`, `goapp`

**Hitos GoApp:** `accept_work_order`, `start_travel`, `work_time`, `finalize_work_order`, `follow_up_appointment`

**Entradas (crear):** Cuerpo JSON con proveedor, datos del caso, equipo, cliente, descripción y datos de sincronización.

**Entradas (inbound/:provider):** Cuerpo JSON con los datos del caso recibido desde el proveedor indicado en el path.

**Entradas (goapp milestones):** `milestone` en path + cuerpo JSON con datos del hito (timestamp, notas, geolocalización si aplica).

**Proceso (crear / inbound):** `externalCases.service.js` valida el proveedor, selecciona el adaptador correspondiente del `ADAPTER_REGISTRY` (navifyAdapter, rexisAdapter, goappAdapter), crea el registro con estado inicial y encola la sincronización con la plataforma externa.

**Proceso (process-queue):** El servicio procesa los casos en cola con sincronización pendiente usando backoff exponencial configurable. Los fallos de sincronización pasan al estado `sync_error` y quedan elegibles para reintento.

**Proceso (retry-sync):** Reintenta la sincronización de un caso específico en estado `sync_error` contra su proveedor.

**Proceso (reconcile):** Consulta el estado real del caso en la plataforma externa y reconcilia con el estado interno, registrando el evento de reconciliación.

**Proceso (ceac-decision):** Registra la decisión del CEAC sobre el caso (despacho o cierre), avanza el estado del workflow y notifica a los roles correspondientes.

**Proceso (goapp milestones):** Valida las precondiciones del hito (`start_travel` requiere `accept_work_order`, `work_time` requiere `start_travel`, `finalize_work_order` requiere `work_time`), persiste el hito y actualiza el estado del workflow ST-01-04.

**Máquina de estado ST-01-04:**
`initiated` → `external_created` → `dispatched` → `executing` → `completed`
(con `blocked` y `cancelled` como salidas desde cualquier estado no terminal)

**Salida:** Arrays y objetos según el endpoint, con estado del caso, eventos de auditoría, datos de sincronización y hitos completados.

---

### FRS-SRV-011 — Infraestructura de workflow: catálogo, registry, timeline y reporting

**Endpoints:**
- `GET /api/v1/servicio/workflow-documents` — Documentos de workflow
- `GET /api/v1/servicio/workflow-documents/summary` — Resumen de documentos
- `GET /api/v1/servicio/workflow/reporting-summary` — Resumen de reporting
- `GET /api/v1/servicio/workflow/catalog` — Catálogo de procedimientos y máquinas de estado
- `GET /api/v1/servicio/workflow/state-machines` — Definición de máquinas de estado
- `GET /api/v1/servicio/workflow/registry` — Estado del registry de workflows activos
- `POST /api/v1/servicio/workflow/registry` — Upsert del registry de workflows
- `GET /api/v1/servicio/workflow/timeline` — Timeline de eventos de todos los workflows

**Roles lectura:** `workflowReadRoles`
**Roles escritura (registry):** `jefe_tecnico`, `jefe_servicio_tecnico`, `gerencia`, `gerencia_general`

**Proceso (catálogo / state-machines):** Retorna la definición estática de los cuatro procedimientos (ST-01-01 a ST-01-04) desde `workflowStateMachine.service.js`: estados, transiciones, estado inicial y estados terminales de cada procedimiento.

**Proceso (registry GET):** `workflowRegistry.service.js` consulta el estado actual de todos los workflows registrados y activos.

**Proceso (registry POST):** Upsert del estado de un workflow específico. Restringido a jefaturas y gerencia.

**Proceso (timeline):** `workflowAudit.service.js` retorna los eventos de auditoría de todos los workflows, ordenados cronológicamente, con filtros por procedimiento, fuente y rango de fechas.

**Proceso (workflow-documents / summary):** `fst14.service.js` y `documentTemplateRegistry.service.js` retornan los documentos generados en el contexto del workflow activo y su resumen de completitud.

**Proceso (reporting-summary):** Agrega métricas de workflows completados, en progreso, bloqueados y cancelados para el período consultado.

**Salida:** Objetos y arrays según el endpoint con la información de catálogo, estado del registry, eventos de timeline y métricas de reporting.

## 4. Tabla de endpoints API completos

| Método | Ruta | Roles de acceso | Función |
|---|---|---|---|
| GET | `/api/v1/servicio/capacitaciones` | tecnico, jefe_tecnico, jefe_servicio_tecnico, gerencia | Listar capacitaciones |
| POST | `/api/v1/servicio/capacitaciones` | tecnico, jefe_tecnico, jefe_servicio_tecnico, gerencia | Crear capacitación |
| PUT | `/api/v1/servicio/capacitaciones/:id` | tecnico, jefe_tecnico, jefe_servicio_tecnico, gerencia | Actualizar capacitación |
| DELETE | `/api/v1/servicio/capacitaciones/:id` | tecnico, jefe_tecnico, jefe_servicio_tecnico, gerencia | Eliminar capacitación |
| GET | `/api/v1/servicio/disponibilidad` | servicio_tecnico, tecnico, jefe_servicio_tecnico, gerencia | Consultar disponibilidad de técnicos |
| POST | `/api/v1/servicio/disponibilidad` | servicio_tecnico, tecnico, jefe_servicio_tecnico, gerencia | Actualizar disponibilidad de técnico |
| GET | `/api/v1/servicio/actividades` | servicio_tecnico, tecnico, jefe_tecnico, jefe_servicio_tecnico, gerencia, comercial, acp_comercial, jefe_comercial | Listar actividades técnicas |
| POST | `/api/v1/servicio/actividades` | servicio_tecnico, tecnico, jefe_tecnico, jefe_servicio_tecnico, gerencia | Crear actividad técnica |
| GET | `/api/v1/servicio/equipos` | tecnico, gerencia, jefe_tecnico, jefe_servicio_tecnico, ti, jefe_ti, admin_ti | Consultar equipos |
| POST | `/api/v1/servicio/equipos` | tecnico, gerencia, jefe_tecnico, jefe_servicio_tecnico | Registrar equipo |
| GET | `/api/v1/servicio/mantenimientos` | tecnico, gerencia, jefe_tecnico, jefe_servicio_tecnico | Consultar mantenimientos |
| GET | `/api/v1/servicio/mantenimientos-anuales` | tecnico, gerencia, jefe_tecnico, jefe_servicio_tecnico | Consultar mantenimientos anuales |
| POST | `/api/v1/servicio/mantenimientos-anuales` | gerencia, tecnico, jefe_tecnico, jefe_servicio_tecnico | Crear mantenimiento anual |
| POST | `/api/v1/servicio/desinfeccion/pdf` | tecnico, jefe_tecnico, jefe_servicio_tecnico, gerencia | Generar PDF desinfección (F.ST-02) |
| POST | `/api/v1/servicio/entrenamiento/pdf` | tecnico, jefe_tecnico, jefe_servicio_tecnico, gerencia | PDF coordinación entrenamiento |
| POST | `/api/v1/servicio/entrenamiento/asistencia/pdf` | tecnico, jefe_tecnico, jefe_servicio_tecnico, gerencia | PDF lista de asistencia |
| GET | `/api/v1/servicio/entrenamiento/workflow` | workflowReadRoles | Consultar estado del workflow de entrenamiento |
| POST | `/api/v1/servicio/entrenamiento/workflow` | tecnico, jefe_tecnico, jefe_servicio_tecnico, gerencia | Avanzar workflow de entrenamiento |
| POST | `/api/v1/servicio/entrenamiento/evaluacion/pdf` | tecnico, jefe_tecnico, jefe_servicio_tecnico, gerencia | PDF evaluación de entrenamiento |
| POST | `/api/v1/servicio/entrenamiento/evaluacion-especialista/pdf` | tecnico, jefe_tecnico, jefe_servicio_tecnico, gerencia | PDF evaluación de especialista |
| POST | `/api/v1/servicio/entrenamiento/conformidad/pdf` | tecnico, jefe_tecnico, jefe_servicio_tecnico, gerencia | PDF de conformidad |
| POST | `/api/v1/servicio/entrenamiento/certificado/emitir` | tecnico, jefe_tecnico, jefe_servicio_tecnico, gerencia | Emitir certificado de entrenamiento |
| POST | `/api/v1/servicio/entrenamiento/certificado/entregar` | tecnico, jefe_tecnico, jefe_servicio_tecnico, gerencia | Registrar entrega de certificado |
| GET | `/api/v1/servicio/withdrawal/workflow/list` | workflowReadRoles | Listar workflows de retiro |
| GET | `/api/v1/servicio/withdrawal/workflow` | workflowReadRoles | Consultar estado de retiro específico |
| POST | `/api/v1/servicio/withdrawal/workflow` | withdrawalWriteRoles | Avanzar workflow de retiro |
| POST | `/api/v1/servicio/withdrawal/fst11/pdf` | withdrawalWriteRoles | Generar acta de retiro FST-11 |
| POST | `/api/v1/servicio/corrective-cases` | correctiveWriteRoles | Crear caso correctivo |
| GET | `/api/v1/servicio/corrective-cases/workspace/list` | correctiveReadRoles | Workspace de casos correctivos |
| GET | `/api/v1/servicio/corrective-cases/workspace/kpi` | correctiveReadRoles | KPIs del workspace correctivo |
| GET | `/api/v1/servicio/corrective-cases/:id` | correctiveReadRoles | Detalle del caso correctivo |
| GET | `/api/v1/servicio/corrective-cases/:id/timeline` | correctiveReadRoles | Timeline del caso correctivo |
| GET | `/api/v1/servicio/corrective-cases/:id/events` | correctiveReadRoles | Eventos del caso correctivo |
| GET | `/api/v1/servicio/corrective-cases/:id/comments` | correctiveReadRoles | Comentarios del caso correctivo |
| POST | `/api/v1/servicio/corrective-cases/:id/comments` | correctiveWriteRoles | Agregar comentario |
| GET | `/api/v1/servicio/corrective-cases/:id/evidences` | correctiveReadRoles | Evidencias del caso correctivo |
| POST | `/api/v1/servicio/corrective-cases/:id/actions` | correctiveWriteRoles | Ejecutar acción / transición de estado |
| POST | `/api/v1/servicio/entrenamiento/verificacion/pdf` | tecnico, jefe_tecnico, jefe_servicio_tecnico, gerencia | PDF verificación de equipos nuevos |
| GET | `/api/v1/servicio/workflow-documents` | workflowReadRoles | Documentos de workflow |
| GET | `/api/v1/servicio/workflow-documents/summary` | workflowReadRoles | Resumen de documentos |
| GET | `/api/v1/servicio/workflow/reporting-summary` | workflowReadRoles | Resumen de reporting |
| GET | `/api/v1/servicio/workflow/catalog` | workflowReadRoles | Catálogo de procedimientos |
| GET | `/api/v1/servicio/workflow/state-machines` | workflowReadRoles | Definición de máquinas de estado |
| GET | `/api/v1/servicio/workflow/registry` | workflowReadRoles | Estado del registry |
| POST | `/api/v1/servicio/workflow/registry` | jefe_tecnico, jefe_servicio_tecnico, gerencia, gerencia_general | Upsert del registry |
| GET | `/api/v1/servicio/workflow/timeline` | workflowReadRoles | Timeline de eventos de workflows |
| GET | `/api/v1/external-cases/workspace/list` | READ_ROLES | Workspace de casos externos |
| GET | `/api/v1/external-cases/workspace/kpi` | READ_ROLES | KPIs de casos externos |
| GET | `/api/v1/external-cases/providers/health` | READ_ROLES | Estado de salud de proveedores |
| GET | `/api/v1/external-cases/provider-identities` | READ_ROLES | Listar identidades de proveedor |
| POST | `/api/v1/external-cases/provider-identities` | WRITE_ROLES | Upsert identidad de proveedor |
| POST | `/api/v1/external-cases/sync/process-queue` | WRITE_ROLES | Procesar cola de sincronización |
| POST | `/api/v1/external-cases/inbound/:provider` | WRITE_ROLES | Caso inbound por proveedor |
| POST | `/api/v1/external-cases/` | WRITE_ROLES | Crear caso externo |
| GET | `/api/v1/external-cases/:id` | READ_ROLES | Detalle de caso externo |
| GET | `/api/v1/external-cases/:id/events` | READ_ROLES | Eventos de caso externo |
| POST | `/api/v1/external-cases/:id/retry-sync` | WRITE_ROLES | Reintentar sincronización |
| POST | `/api/v1/external-cases/:id/reconcile` | WRITE_ROLES | Reconciliar estado con proveedor |
| POST | `/api/v1/external-cases/:id/ceac-decision` | WRITE_ROLES | Decisión CEAC |
| POST | `/api/v1/external-cases/:id/goapp/milestones/:milestone` | WRITE_ROLES | Hito de GoApp |

## 5. Controles de acceso y seguridad

### 5.1 Grupos de roles definidos en rutas

| Grupo | Roles incluidos | Contexto de uso |
|---|---|---|
| `workflowReadRoles` | tecnico, jefe_tecnico, jefe_servicio_tecnico, servicio_tecnico, comercial, acp_comercial, jefe_comercial, gerencia, gerencia_general, operaciones, jefe_operaciones, jefe_logistica | Lectura de todos los workflows internos |
| `withdrawalWriteRoles` | tecnico, jefe_tecnico, jefe_servicio_tecnico, servicio_tecnico, logistica, jefe_logistica, comercial, jefe_comercial, gerencia, gerencia_general | Escritura en workflow de retiro |
| `correctiveReadRoles` | tecnico, servicio_tecnico, jefe_tecnico, jefe_servicio_tecnico, ti, jefe_ti, admin_ti, comercial, jefe_comercial, backoffice_comercial, acp_comercial, gerencia, gerencia_general | Lectura de casos correctivos |
| `correctiveWriteRoles` | Igual que correctiveReadRoles | Escritura en casos correctivos |
| `READ_ROLES` (external-cases) | ti, jefe_ti, admin_ti, tecnico, servicio_tecnico, jefe_tecnico, jefe_servicio_tecnico, dispatcher, ceac, comercial, jefe_comercial, backoffice_comercial, acp_comercial, gerencia, gerencia_general | Lectura de casos externos |
| `WRITE_ROLES` (external-cases) | ti, jefe_ti, admin_ti, tecnico, servicio_tecnico, jefe_tecnico, jefe_servicio_tecnico, dispatcher, ceac, gerencia, gerencia_general | Escritura en casos externos |

### 5.2 Autenticación

Todos los endpoints de `servicio.routes.js` aplican `verifyToken` como primer middleware. Las rutas de `externalCases.routes.js` aplican `requireRole` directamente sin `verifyToken` explícito en el archivo de rutas — la autenticación debe estar aplicada en el router padre.

### 5.3 Validación de transiciones de estado

Ninguna transición de estado se persiste sin pasar por la función `isValidTransition` del servicio de máquina de estado correspondiente. Un intento de transición inválida resulta en error HTTP 400 con código `CORRECTIVE_CASE_INVALID_TRANSITION` para correctivos.

## 6. Dependencias funcionales

| Dependencia | Servicio / módulo | Función |
|---|---|---|
| Autenticación JWT | `../../middlewares/auth` → `verifyToken` | Verificación de token en todos los endpoints |
| Control de roles | `../../middlewares/roles` → `requireRole` | Autorización por rol en cada endpoint |
| Auditoría de workflow | `workflowAudit.service.js` → `appendWorkflowAuditEvent` | Registro de eventos de transición |
| Registry de workflows | `workflowRegistry.service.js` → `upsertWorkflow` | Persistencia del estado activo de workflows |
| Tracking de documentos | `fst14.service.js` → `trackWorkflowDocumentByCode` | Registro de documentos generados por etapa |
| Google Drive | `../../utils/drive` → `ensureFolder`, `uploadBase64File` | Almacenamiento de PDFs en Drive (withdrawal) |
| Despacho CEAC | `ceacDispatch.service.js` | Notificación de nuevos casos a roles CEAC/dispatcher |
| Adaptadores externos | `adapters/navify.adapter.js`, `adapters/rexis.adapter.js`, `adapters/goapp.adapter.js` | Integración con plataformas externas |
| Base de datos | `../../config/db` | Consultas SQL directas sin ORM |

## 7. Observaciones técnicas y riesgos

| Riesgo | Descripción | Mitigación identificada |
|---|---|---|
| Consistencia de `verifyToken` en external-cases | `externalCases.routes.js` no incluye `verifyToken` explícito — depende del router padre para aplicarlo | Verificar que el router padre aplique `verifyToken` antes de delegar a `externalCases.routes.js` |
| Fallos de sincronización externa | La cola de sincronización con proveedores puede acumular entradas en `sync_error` si el proveedor externo no responde | Variables de entorno `EXTERNAL_CASE_SYNC_MAX_ATTEMPTS` y backoff exponencial configurado; monitorear cola regularmente |
| Precondiciones de hitos GoApp | El incumplimiento de precondiciones de hito retorna error antes de persistir; si la validación no es atómica puede haber inconsistencias | Revisar que `postGoAppMilestone` sea atómico en la validación y la persistencia |
| Acoplamiento al registry de workflows | `upsertWorkflow` es invocado por múltiples servicios; una escritura concurrente podría generar conflictos | Verificar si el upsert tiene bloqueo optimista o manejo de conflictos |
| PDFs generados en ruta temporal | Algunos servicios de PDF generan archivos en `/tmp`; en entornos serverless o con reinicio frecuente esto puede perder archivos | Subir a Drive o retornar en base64 en lugar de conservar en disco |
| Múltiples responsabilidades en `corrective-cases` | El módulo correctivo mezcla lifecycle del caso, comentarios, evidencias y acciones en el mismo controlador | Documentado como deuda técnica; no impacta funcionalidad actual |
