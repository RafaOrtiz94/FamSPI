# FRS — MÓDULO DE REPORTES Y AUDITORÍA

**Sistema:** FamSPI  
**Versión:** 2.0  
**Fecha:** 2026-06-18  
**Estado:** En revisión  
**Alineación:** WHO TRS 1019, Annex 3, Appendix 5  
**Referencia URS:** URS_modulo_reportes_auditoria.md v2.0

---

## 1. Introducción

El presente documento describe cómo el sistema SPI implementa funcionalmente los requerimientos del módulo de Reportes y Auditoría. Cubre tres submódulos: `dashboard` (KPIs ejecutivos), `auditoria` (bitácora transversal) y `audit-prep` (expediente de auditoría formal).

---

## 2. Descripción funcional del módulo

El módulo de Reportes y Auditoría provee visibilidad ejecutiva del negocio, trazabilidad de eventos del sistema y preparación documental para auditorías. Opera sobre datos producidos por todos los demás módulos y los expone de forma agregada, filtrada o exportable según el actor y el contexto.

Las tablas de origen son: `bc_master`, `requests`, `clients`, `visit_schedules`, `client_visit_logs`, `collaborator_profiles`, `auditoria.logs`, `audit_settings`, `audit_sections`, `audit_documents` y `audit_access_grants`.

---

## 3. Especificaciones funcionales

### FRS-RPT-001 — Dashboard comercial con KPIs en tiempo real
**Requerimiento origen:** REQ-RPT-001  
**Endpoint:** `GET /api/v1/dashboard/comercial/summary`  
**Entradas:** Token JWT válido con rol en `COMMERCIAL_DASHBOARD_ROLES`; parámetro opcional `fresh=true` para invalidar caché.  
**Proceso:** El servicio intenta servir desde caché en memoria (TTL 60 s). Si no hay caché válido, ejecuta seis consultas SQL en paralelo sobre `bc_master`, `requests`, `clients`, `visit_schedules`/`scheduled_visits`/`client_visit_logs` y `collaborator_profiles`/`permisos_vacaciones`. Agrega los resultados con mappings de estado (`STATE_MAPPINGS`), normaliza datos de gráficos (máx. 8 items, agrupa resto en "Otros") y construye el payload. El resultado se almacena en caché antes de retornar. Errores de esquema faltante (código PostgreSQL `42P01`, `42703`) producen HTTP 500; errores de conexión producen HTTP 503.  
**Salida:** Objeto JSON con `kpis` (totalBC, bcActivos, bcCompletados, solicitudesPendientes, clientesNuevos30d, avgCompliance), `alerts` (colaboradores con novedades de TH), `charts` (bcStatus, requestsMonthly) y `_metadata` (stateMappings, dataSources, cache.hit, cache.ttlSeconds).  
**Roles habilitados:** `comercial`, `jefe_comercial`, `backoffice_comercial`, `acp_comercial`, `analista_comercial`, `gerencia`

### FRS-RPT-002 — Listado paginado de bitácora de auditoría
**Requerimiento origen:** REQ-RPT-002  
**Endpoint:** `GET /api/v1/auditoria`  
**Entradas:** Token JWT con rol en `['ti', 'gerencia', 'talento_humano']`; parámetros opcionales: `page` (default 1), `limit` (default 50), `user_id`, `email`, `module`, `action`, `date_from`, `date_to`, `request_id`, `mantenimiento_id`, `inventario_id`, `auto`.  
**Proceso:** El servicio construye dinámicamente la cláusula `WHERE` añadiendo condiciones según los parámetros presentes. Parámetros numéricos se normalizan con `parseInt`; fechas se normalizan con `new Date()`. La consulta aplica `OFFSET` calculado por página y `LIMIT` para paginación. Se retorna también el total de registros para que el cliente calcule el número de páginas.  
**Salida:** Objeto con `rows` (array de registros de auditoría) y `total` (entero). Cada registro incluye: `id`, `usuario_id`, `usuario_email`, `modulo`, `accion`, `detalle`, `creado_en`, `request_id`, `mantenimiento_id`, `inventario_id`, `auto`.

### FRS-RPT-003 — Detalle de un registro de auditoría
**Requerimiento origen:** REQ-RPT-003  
**Endpoint:** `GET /api/v1/auditoria/:id`  
**Entradas:** Token JWT con rol en `['ti', 'gerencia', 'talento_humano']`; `id` del registro.  
**Proceso:** Consulta directa por ID en `auditoria.logs`. Si no se encuentra, devuelve HTTP 404.  
**Salida:** Objeto completo del registro de auditoría con todos sus campos.

### FRS-RPT-004 — Exportación de bitácora en CSV
**Requerimiento origen:** REQ-RPT-004  
**Endpoint:** `GET /api/v1/auditoria/export/csv`  
**Entradas:** Token JWT con rol en `['ti', 'gerencia']`; mismos parámetros de filtro que FRS-RPT-002.  
**Proceso:** El servicio aplica los mismos filtros de la consulta pero sin paginación, retornando todos los registros que cumplen los criterios. Serializa el resultado con `csv-stringify/sync` con cabeceras descriptivas. Establece headers `Content-Disposition: attachment; filename="auditoria.csv"` y `Content-Type: text/csv`.  
**Salida:** Stream o buffer CSV descargable con todos los registros filtrados.

### FRS-RPT-005 — Consulta del estado de la ventana de auditoría
**Requerimiento origen:** REQ-RPT-005  
**Endpoint:** `GET /api/v1/audit-prep/status`  
**Entradas:** Token JWT válido (cualquier rol autenticado puede consultar el estado).  
**Proceso:** Lee el registro singleton de `audit_settings` (id = 1). Si no existe, retorna estado `inactive` con valores nulos.  
**Salida:** Objeto con `active` (boolean), `start_date`, `end_date`, `notes` y `updated_at`.

### FRS-RPT-006 — Actualización del estado de la ventana de auditoría
**Requerimiento origen:** REQ-RPT-005  
**Endpoint:** `PUT /api/v1/audit-prep/status`  
**Entradas:** Token JWT con rol `admin_ti` o `jefe_ti`; `active` (boolean), `start_date`, `end_date`, `notes` opcionales.  
**Proceso:** Actualiza el registro singleton en `audit_settings`. Registra la acción en `auditoria.logs` mediante `logAction`. Si el registro no existe, lo crea con los valores proporcionados.  
**Salida:** Objeto actualizado de `audit_settings`.

### FRS-RPT-007 — Listado de secciones del expediente
**Requerimiento origen:** REQ-RPT-006  
**Endpoint:** `GET /api/v1/audit-prep/sections`  
**Entradas:** Token JWT válido.  
**Proceso:** Lista todas las secciones de `audit_sections`. El frontend filtra las visibles según `allowed_roles` y el rol del usuario.  
**Salida:** Array de secciones con `id`, `title`, `description`, `allowed_roles`, `order` y `created_at`.

### FRS-RPT-008 — Creación o actualización de sección
**Requerimiento origen:** REQ-RPT-006  
**Endpoint:** `POST /api/v1/audit-prep/sections`  
**Entradas:** Token JWT con rol `admin_ti` o `jefe_ti`; `title`, `description`, `allowed_roles` (array), `order` opcionales.  
**Proceso:** Upsert en `audit_sections` basado en `title`. Registra la acción en `auditoria.logs`.  
**Salida:** Sección creada o actualizada.

### FRS-RPT-009 — Listado de documentos del expediente
**Requerimiento origen:** REQ-RPT-007  
**Endpoint:** `GET /api/v1/audit-prep/documents`  
**Entradas:** Token JWT válido con acceso al módulo.  
**Proceso:** Lista los documentos de `audit_documents` con sus metadatos. Los identificadores de Drive no se exponen directamente; se genera un enlace de acceso controlado.  
**Salida:** Array de documentos con `id`, `section_id`, `name`, `status`, `uploaded_by`, `uploaded_at` y enlace de descarga.

### FRS-RPT-010 — Carga de documento al expediente
**Requerimiento origen:** REQ-RPT-007  
**Endpoint:** `POST /api/v1/audit-prep/documents/upload`  
**Entradas:** Token JWT válido; `section_id`, archivo multipart o enlace Drive, `name`, `notes`.  
**Proceso:** Valida tipo MIME y tamaño del archivo. Sube el archivo a Google Drive. Inserta en `audit_documents` con `status = 'pending'`, `drive_file_id` (interno) y metadatos. Registra en `auditoria.logs`.  
**Salida:** Documento creado con su identificador y enlace de acceso.

### FRS-RPT-011 — Actualización de estado de documento
**Requerimiento origen:** REQ-RPT-007  
**Endpoint:** `PATCH /api/v1/audit-prep/documents/:id/status`  
**Entradas:** Token JWT válido; `status` destino (`pending`, `reviewed`, `approved`, `rejected`).  
**Proceso:** Actualiza `status` y `reviewed_by` en `audit_documents`. Registra la acción en `auditoria.logs`.  
**Salida:** Documento actualizado.

### FRS-RPT-012 — Descarga de documento del expediente
**Requerimiento origen:** REQ-RPT-007  
**Endpoint:** `GET /api/v1/audit-prep/documents/:id/download`  
**Entradas:** Token JWT válido (rol con acceso a la sección); `id` del documento.  
**Proceso:** Verifica que el actor tenga acceso a la sección del documento. Genera un enlace de descarga temporal desde Google Drive. El `drive_file_id` nunca se expone en la respuesta.  
**Salida:** Redirección al enlace temporal o URL firmada de descarga.

### FRS-RPT-013 — Listado de accesos externos temporales
**Requerimiento origen:** REQ-RPT-008  
**Endpoint:** `GET /api/v1/audit-prep/external-access`  
**Entradas:** Token JWT con rol `admin_ti` o `jefe_ti`.  
**Proceso:** Lista todos los grants de `audit_access_grants` con su estado de vigencia calculado.  
**Salida:** Array de grants con `id`, `auditor_name`, `auditor_email`, `section_id`, `valid_until`, `created_by` y `is_active` calculado.

### FRS-RPT-014 — Concesión de acceso externo temporal
**Requerimiento origen:** REQ-RPT-008  
**Endpoint:** `POST /api/v1/audit-prep/external-access`  
**Entradas:** Token JWT con rol `admin_ti` o `jefe_ti`; `auditor_email`, `auditor_name`, `section_id`, `valid_until`.  
**Proceso:** Inserta en `audit_access_grants`. Registra la acción en `auditoria.logs` con el email del auditor y la sección autorizada.  
**Salida:** Grant creado con su identificador y vigencia.

### FRS-RPT-015 — Revocación de acceso externo
**Requerimiento origen:** REQ-RPT-008  
**Endpoint:** `DELETE /api/v1/audit-prep/external-access/:id`  
**Entradas:** Token JWT con rol `admin_ti` o `jefe_ti`; `id` del grant.  
**Proceso:** Elimina el registro de `audit_access_grants`. Registra la revocación en `auditoria.logs`. El acceso del auditor externo queda bloqueado inmediatamente.  
**Salida:** Confirmación de eliminación.

---

## 4. Endpoints API completos del módulo

| Método | Ruta | Acceso | Función |
|---|---|---|---|
| GET | `/api/v1/dashboard/comercial/summary` | Roles comerciales + gerencia | KPIs del dashboard |
| GET | `/api/v1/auditoria` | ti, gerencia, talento_humano | Listar bitácora paginada |
| GET | `/api/v1/auditoria/:id` | ti, gerencia, talento_humano | Detalle de registro |
| GET | `/api/v1/auditoria/export/csv` | ti, gerencia | Exportar bitácora CSV |
| GET | `/api/v1/audit-prep/status` | Autenticado | Estado de ventana de auditoría |
| PUT | `/api/v1/audit-prep/status` | admin_ti, jefe_ti | Activar/desactivar auditoría |
| GET | `/api/v1/audit-prep/sections` | Autenticado | Listar secciones |
| POST | `/api/v1/audit-prep/sections` | admin_ti, jefe_ti | Crear/actualizar sección |
| GET | `/api/v1/audit-prep/documents` | Autenticado | Listar documentos |
| POST | `/api/v1/audit-prep/documents/upload` | Autenticado | Cargar documento |
| PATCH | `/api/v1/audit-prep/documents/:id/status` | Autenticado | Actualizar estado de documento |
| GET | `/api/v1/audit-prep/documents/:id/download` | Autenticado con acceso a sección | Descargar documento |
| GET | `/api/v1/audit-prep/external-access` | admin_ti, jefe_ti | Listar accesos externos |
| POST | `/api/v1/audit-prep/external-access` | admin_ti, jefe_ti | Conceder acceso externo |
| DELETE | `/api/v1/audit-prep/external-access/:id` | admin_ti, jefe_ti | Revocar acceso externo |

---

## 5. Controles de acceso y seguridad funcional

**Autenticación:** JWT global del backend. Todos los endpoints del módulo operan sobre token verificado.

**Dashboard:** La validación de rol se aplica con `requireRole(COMMERCIAL_DASHBOARD_ROLES)` como middleware en la ruta.

**Auditoría:** `requireRole(['ti', 'gerencia', 'talento_humano'])` en consulta/detalle; `requireRole(['ti', 'gerencia'])` en exportación.

**Audit-prep:** `requireRole(['admin_ti', 'jefe_ti'])` en operaciones de escritura y gestión de accesos. Operaciones de lectura accesibles para todos los roles autenticados; el filtrado por sección se aplica en servicio.

**Trazabilidad de configuración:** Cambios de estado del modo auditoría, carga documental, cambios de estado de documentos y grants externos quedan registrados en `auditoria.logs` mediante `logAction`.

**Protección de Drive:** Los `drive_file_id` internos nunca se exponen en respuestas de listado ni descarga; se genera siempre un enlace intermediado.

---

## 6. Dependencias funcionales

- **Business Case:** `bc_master.current_stage` como fuente de KPI.
- **Solicitudes:** `requests.status` como fuente de KPI y tendencia mensual.
- **Clientes:** `clients.created_at` para KPI de altas.
- **Visitas:** `visit_schedules`, `scheduled_visits`, `client_visit_logs` para KPI de cumplimiento.
- **Talento Humano:** `collaborator_profiles`, `permisos_vacaciones` para alertas de TH.
- **Google Drive:** Almacenamiento y descarga de documentos del expediente.
- **Todos los módulos:** Productores de `auditoria.logs` mediante `logAction`.

---

## 7. Observaciones técnicas y riesgos

- La validación de rol en el dashboard se ejecuta con `requireRole` como middleware en la ruta, lo cual es el patrón correcto; el servicio no debe duplicar esta verificación.
- La caché en memoria del dashboard (Map, TTL 60 s) no se comparte entre instancias de Node. En despliegue horizontal, cada instancia sirve su propia caché, lo que puede producir valores momentáneamente distintos entre instancias. El parámetro `fresh=true` permite bypass explícito.
- La exportación CSV sin paginación puede generar respuestas grandes con alto volumen de auditoría. Se recomienda agregar un límite máximo de filas o un mecanismo de exportación asíncrona para volúmenes superiores a 100.000 registros.
- La dependencia de Google Drive para los documentos del expediente introduce un punto de fallo externo. Si Drive no está disponible, las operaciones de carga y descarga fallarán; la consulta del listado no se ve afectada.
