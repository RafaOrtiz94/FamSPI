# URS — MÓDULO COMERCIAL Y CLIENTES

**Sistema:** FamSPI
**Versión:** 2.0
**Fecha:** 2026-06-18
**Estado:** En revisión
**Alineación:** WHO TRS 1019, Annex 3, Appendix 5

---

## 1. Introducción

El presente documento define los requerimientos de usuario del módulo Comercial y Clientes del sistema SPI. Su propósito es establecer, desde la perspectiva del negocio y de los actores que operan el ciclo comercial, qué capacidades deben existir, por qué son necesarias y cómo deben manifestarse en la operación diaria.

El módulo integra cinco dominios funcionales: (1) solicitudes comerciales generales, (2) flujo de alta de nuevos clientes con consentimiento LOPDP, (3) gestión de cartera de clientes activos con asignaciones, visitas y CRM básico, (4) gestión de oportunidades comerciales con cuentas y contactos, y (5) seguimiento de interacciones y sedes georreferenciadas. Estos dominios responden a la necesidad de tener trazabilidad verificable desde el primer contacto comercial hasta la aprobación formal del cliente, y de mantener visibilidad operativa de la cartera asignada.

La necesidad de estas capacidades se fundamenta en la obligación de documentar el consentimiento LOPDP del cliente, mantener evidencia documental adjunta en Google Drive, registrar asignaciones con vigencia explícita, y hacer trazable cada interacción comercial por actor y fecha.

---

## 2. Objetivo

Definir los requerimientos de usuario de alto nivel para los módulos `clients`, `requests` (flujo de nuevo cliente y solicitudes generales) y `opportunities`, estableciendo su justificación funcional, la forma esperada de operación y los actores que intervienen en cada etapa del proceso comercial.

---

## 3. Alcance

**Incluye:**
- Creación, consulta, corrección y procesamiento de solicitudes generales del área comercial.
- Flujo completo de alta de nuevo cliente: envío de token de consentimiento, verificación, carga de documentos, revisión de calidad y aprobación/rechazo por Backoffice Comercial.
- Consulta y actualización de clientes activos con filtros por cartera, cronograma y caso de negocio.
- Asignación y desasignación de clientes a asesores comerciales con soporte de asignaciones temporales y con vigencia definida.
- Registro de visitas a clientes (estados: `visited`, `pending`, `skipped`, `in_visit`) con georreferenciación de entrada y salida.
- Registro de visitas a prospectos fuera de cartera.
- Registro de interacciones CRM por cliente (tipos: `call`, `visit`) con notas.
- Consulta del historial CRM de un cliente.
- Gestión de sedes del cliente (alta, actualización, eliminación) con geocodificación automática vía Google Maps Geocoding API.
- Gestión de oportunidades comerciales: cuentas (`accounts`), contactos, oportunidades, influencias, flags, competidores, acciones, comentarios y vínculos a procesos.
- Dashboard gerencial de oportunidades.
- Sincronización bidireccional con Odoo CRM cuando la integración está habilitada.

**Excluye:**
- Flujo de compras públicas de equipos (módulo `equipment-purchases`).
- Flujo de compras privadas (módulo `private-purchases`).
- Cronogramas mensuales de visitas (módulo `schedules`).
- Business Case (módulo `business-case`).
- Emisión de documentos formales, firma avanzada e infraestructura de notificaciones.

---

## 4. Actores

| Actor | Rol en el sistema | Acciones principales |
|---|---|---|
| `comercial` | Asesor comercial de campo | Registra solicitudes y nuevos clientes, actualiza visitas, registra interacciones CRM, gestiona oportunidades |
| `acp_comercial` | Asistente comercial | Mismas acciones que `comercial`; acceso de edición a clientes |
| `backoffice` / `backoffice_comercial` | Operador Backoffice | Crea solicitudes, edita clientes, procesa (aprueba/rechaza) solicitudes de nuevo cliente |
| `jefe_comercial` | Jefe de área comercial | Asigna y desasigna clientes, crea/reenvía/cancela solicitudes generales, aprueba cronogramas |
| `gerencia` / `gerente` | Gerencia o dirección | Acceso completo de lectura y asignación de clientes, dashboard gerencial de oportunidades |
| `calidad` / `jefe_calidad` | Área de calidad | Revisión y actualización del checklist de calidad en solicitudes de nuevo cliente |
| `tecnico` / `jefe_tecnico` / `jefe_servicio_tecnico` | Técnicos y jefaturas técnicas | Acceso de lectura limitada a clientes activos (field client read) |
| `logistica` / `jefe_logistica` | Logística | Acceso de lectura limitada a clientes activos |
| `ti` / `admin` / `administrador` | Administración TI | Acceso completo, asignación y sincronización Odoo |
| Cliente externo (sin cuenta) | Sin rol en el sistema | Otorga consentimiento LOPDP mediante enlace público con token |

---

## 5. Justificación del módulo

El módulo Comercial y Clientes existe porque el proceso comercial de la empresa requiere gobierno sobre cuatro momentos críticos que hoy no pueden gestionarse de forma informal:

1. **Consentimiento LOPDP verificable.** El alta de un nuevo cliente requiere que la persona responsable del cliente externo otorgue consentimiento mediante un token enviado por correo, con fecha, IP y confirmación almacenada. Sin este flujo el registro carece de respaldo legal.

2. **Cartera asignada con vigencia.** Un cliente no puede pertenecer a múltiples asesores de forma indeterminada. El sistema necesita registrar quién tiene asignado al cliente, desde cuándo, hasta cuándo (en asignaciones temporales) y con qué justificación, para que los indicadores de visita sean atribuibles.

3. **Trazabilidad de interacciones.** Cada llamada o visita comercial debe quedar registrada con tipo, notas, actor y fecha. Sin este registro no es posible auditar la relación comercial ni calcular frecuencia de contacto.

4. **Oportunidades vinculadas a procesos.** Las oportunidades comerciales necesitan estar vinculadas a procesos reales (business case, compras privadas, compras de equipos) para que la gerencia pueda medir la conversión de pipeline en contratos ejecutados.

---

## 6. Requerimientos funcionales

### REQ-COM-001 — Creación de solicitudes comerciales generales
**Actor:** `jefe_comercial`, `comercial`, `backoffice_comercial`
**Enunciado:** El sistema debe permitir crear solicitudes comerciales con adjuntos (hasta 10 archivos por solicitud) y asignarlas al flujo de aprobación correspondiente.
**Resultado esperado:** La solicitud queda registrada con estado inicial y es visible para los roles autorizados en `GET /api/v1/requests`.
**Criticidad:** Alta

### REQ-COM-002 — Listado y detalle de solicitudes
**Actor:** `gerencia`, `comercial`, `acp_comercial`, `backoffice_comercial`, `tecnico`, `finanzas`, `calidad`, `jefe_calidad`, `jefe_servicio_tecnico`, `jefe_tecnico`, `operaciones`, `ti`, `talento_humano` y sus variantes de jefatura
**Enunciado:** El sistema debe permitir listar y consultar el detalle de solicitudes comerciales según rol del usuario autenticado.
**Resultado esperado:** El listado refleja las solicitudes accesibles para el rol; el detalle incluye adjuntos y estado actual.
**Criticidad:** Alta

### REQ-COM-003 — Reenvío y cancelación de solicitudes
**Actor:** `jefe_comercial`
**Enunciado:** El sistema debe permitir reenviar una solicitud previamente rechazada y cancelar solicitudes activas.
**Resultado esperado:** El estado de la solicitud cambia de forma controlada; el historial de estado queda registrado.
**Criticidad:** Media

### REQ-COM-004 — Token de consentimiento LOPDP para nuevo cliente
**Actor:** Cualquier usuario autenticado (envío); cliente externo sin cuenta (otorgamiento)
**Enunciado:** El sistema debe permitir enviar un token de consentimiento por correo al responsable del nuevo cliente y verificar dicho token antes de continuar con el alta.
**Resultado esperado:** El token queda registrado con fecha de envío; la verificación actualiza el estado de consentimiento. El endpoint `GET /api/v1/requests/public/consent/:token` es el único endpoint público del módulo.
**Criticidad:** Alta

### REQ-COM-005 — Creación y corrección de solicitud de nuevo cliente
**Actor:** Cualquier usuario autenticado
**Enunciado:** El sistema debe permitir registrar una solicitud de nuevo cliente adjuntando: `legal_rep_appointment_file`, `ruc_file`, `id_file`, `bpadt_certification_file`, `operating_permit_file` y `consent_evidence_file`. Debe permitir también corregir una solicitud devuelta.
**Resultado esperado:** La solicitud queda registrada en `client_requests` con los identificadores de archivo en Google Drive; la corrección actualiza los campos sin crear un registro nuevo.
**Criticidad:** Alta

### REQ-COM-006 — Listado de solicitudes de nuevo cliente (propio y total)
**Actor:** Cualquier usuario autenticado (listado propio); `backoffice_comercial`, `gerencia`, `calidad`, `jefe_calidad`, `comercial`, `jefe_comercial`, `acp_comercial`, `ti`, `jefe_ti` (listado global y resumen)
**Enunciado:** El sistema debe permitir a cualquier usuario ver sus propias solicitudes de nuevo cliente, y a los roles autorizados ver el total con resumen estadístico.
**Resultado esperado:** `GET /api/v1/requests/new-client/my` devuelve solo las del usuario; `GET /api/v1/requests/new-client` devuelve todas con filtros; `GET /api/v1/requests/new-client/summary` devuelve métricas agregadas.
**Criticidad:** Alta

### REQ-COM-007 — Revisión de calidad y procesamiento de solicitud de nuevo cliente
**Actor:** `calidad`, `jefe_calidad` (checklist); `backoffice_comercial` (procesar/aprobar/rechazar)
**Enunciado:** El sistema debe permitir al área de calidad actualizar el checklist de revisión de la solicitud, y a Backoffice Comercial procesarla con decisión de aprobación o rechazo.
**Resultado esperado:** El checklist queda persistido en la solicitud; el procesamiento cambia el estado de `client_requests` y puede desencadenar la creación del registro de cliente aprobado.
**Criticidad:** Alta

### REQ-COM-008 — Listado de clientes con filtros de cartera y cronograma
**Actor:** Todos los roles autenticados (con visibilidad diferenciada por rol)
**Enunciado:** El sistema debe permitir listar clientes accesibles con filtros por texto (`q`), fecha de visita (`date`), inclusión de información de cronograma (`include_schedule_info`), filtro por cronograma activo (`filter_by_schedule`) y habilitación para Business Case (`include_all_for_business_case`).
**Resultado esperado:** La respuesta incluye `{ data: clients, prospects, summary: { total, visited, pending } }` con los clientes accesibles según el rol y cartera del usuario.
**Criticidad:** Alta

### REQ-COM-009 — Consulta de detalle de cliente
**Actor:** Todos los roles autenticados (con visibilidad diferenciada)
**Enunciado:** El sistema debe permitir obtener el detalle completo de un cliente específico, incluyendo datos de la solicitud original, asignaciones activas, documentos adjuntos y sedes.
**Resultado esperado:** `GET /api/v1/clients/:id` devuelve el perfil del cliente con todos los campos autorizados para el rol del solicitante.
**Criticidad:** Alta

### REQ-COM-010 — Actualización de datos del cliente
**Actor:** `comercial`, `acp_comercial`, `backoffice`, `backoffice_comercial`, `jefe_comercial`, `gerencia`, `gerente`, `admin`, `administrador`, `ti`
**Enunciado:** El sistema debe permitir actualizar los datos del cliente incluyendo la subida de documentos adicionales: `legal_rep_appointment_file`, `ruc_file`, `id_file`, `bpadt_certification_file`, `operating_permit_file`, `consent_evidence_file`, `approval_letter`, `consent_record`.
**Resultado esperado:** Los cambios quedan persistidos; los archivos se almacenan en Google Drive y sus IDs se actualizan en la base de datos.
**Criticidad:** Alta

### REQ-COM-011 — Asignación y desasignación de clientes a asesores
**Actor:** `jefe_comercial`, `gerencia`, `gerente`, `admin`, `administrador`, `ti`
**Enunciado:** El sistema debe permitir asignar un cliente a un asesor comercial, con soporte de asignaciones temporales (con `starts_at` y `ends_at`), razón de asignación y desasignación (`unassign: true`). El asignado debe tener un rol de asesor válido y no estar en estado pasivo/desvinculado/inactivo.
**Resultado esperado:** La asignación queda registrada en `client_assignments` con `is_active = true`, tipo `manual` o `temporary`, y con la vigencia especificada.
**Criticidad:** Alta

### REQ-COM-012 — Registro de estado de visita a cliente
**Actor:** Usuarios autenticados con acceso al cliente
**Enunciado:** El sistema debe permitir registrar el estado de visita a un cliente para una fecha dada, con los estados válidos `visited`, `pending`, `skipped` o `in_visit`, incluyendo georreferenciación de entrada y salida (`lat_entrada`, `lng_entrada`, `lat_salida`, `lng_salida`) y marcas de tiempo.
**Resultado esperado:** El registro queda en `client_visit_logs` con unicidad por `(client_request_id, user_email, visit_date)`; si ya existe, se actualiza.
**Criticidad:** Alta

### REQ-COM-013 — Registro de visita a prospectos
**Actor:** Usuarios autenticados
**Enunciado:** El sistema debe permitir registrar visitas a prospectos que aún no son clientes del sistema, capturando nombre del prospecto, tiempos de check-in/check-out, coordenadas y observaciones.
**Resultado esperado:** El registro queda en la tabla de prospectos identificado por el usuario y la fecha de visita.
**Criticidad:** Media

### REQ-COM-014 — Registro de interacciones CRM (llamadas y visitas)
**Actor:** `comercial`, `acp_comercial`, `backoffice`, `backoffice_comercial`, `jefe_comercial`, `gerencia`, `gerente`, `admin`, `administrador`, `ti`
**Enunciado:** El sistema debe permitir registrar interacciones CRM sobre un cliente con tipo (`call` o `visit`) y notas. Los tipos aceptados también incluyen variantes normalizadas: `llamada`, `phone_call`, `telefono`, `visita`.
**Resultado esperado:** La interacción queda registrada con el actor, fecha y tipo normalizado; se devuelve HTTP 201 con los datos creados.
**Criticidad:** Alta

### REQ-COM-015 — Consulta del historial CRM de un cliente
**Actor:** `comercial`, `acp_comercial`, `backoffice`, `backoffice_comercial`, `jefe_comercial`, `gerencia`, `gerente`, `admin`, `administrador`, `ti`
**Enunciado:** El sistema debe permitir consultar el historial de interacciones registradas para un cliente con límite configurable.
**Resultado esperado:** `GET /api/v1/clients/:id/history` devuelve el listado de interacciones ordenado cronológicamente.
**Criticidad:** Media

### REQ-COM-016 — Gestión de sedes del cliente con geocodificación
**Actor:** Lectura: `CRM_INTERACTION_ROLES`; Escritura/modificación/eliminación: `EDIT_CLIENT_ROLES`
**Enunciado:** El sistema debe permitir listar, agregar, actualizar y eliminar sedes de un cliente. Al registrar o actualizar una sede, el sistema debe intentar geocodificar la dirección completa (`address`, `city`, `province`, `Ecuador`) mediante Google Maps Geocoding API y almacenar las coordenadas resultantes.
**Resultado esperado:** Las sedes quedan en la tabla de ubicaciones del cliente con `lat`, `lng`, `geocoded` y `geocode_status`. Si la API no está configurada, el registro se crea sin coordenadas con estado `MISSING_API_KEY`.
**Criticidad:** Media

### REQ-COM-017 — Gestión de oportunidades comerciales
**Actor (lectura):** `comercial`, `asesor_comercial`, `analista_comercial`, `backoffice_comercial`, `acp_comercial`, `jefe_comercial`, `gerencia`, `gerencia_general`, `director`, `operaciones`, `jefe_operaciones`, `servicio_tecnico`, `jefe_tecnico`
**Actor (escritura):** `comercial`, `asesor_comercial`, `analista_comercial`, `backoffice_comercial`, `acp_comercial`, `jefe_comercial`, `gerencia`, `gerencia_general`
**Enunciado:** El sistema debe permitir crear, listar, consultar y actualizar oportunidades comerciales, con capacidad de gestionar sus influencias, flags, competidores, acciones, comentarios y vínculos a procesos (`business_case`, `private_purchase`, `equipment_purchase`).
**Resultado esperado:** Las oportunidades quedan persistidas en la base de datos y vinculadas a los procesos referenciados; el dashboard gerencial refleja métricas actualizadas.
**Criticidad:** Alta

### REQ-COM-018 — Gestión de cuentas y contactos comerciales
**Actor (lectura):** roles de `OPPORTUNITY_READ_ROLES`; **Actor (escritura):** roles de `OPPORTUNITY_WRITE_ROLES`
**Enunciado:** El sistema debe permitir listar y crear cuentas (`accounts`) con campos: `name`, `legal_name`, `tax_id`, `industry`, `city`, `province`, `country`, `website`, `notes`, `client_id`. Debe permitir también listar y crear contactos asociados. La búsqueda de cuentas soporta texto libre (nombre, razón social, RUC) con límite máximo de 50 resultados.
**Resultado esperado:** Las cuentas quedan registradas en la tabla `accounts`; los contactos quedan asociados a la cuenta correspondiente.
**Criticidad:** Alta

---

## 7. Requerimientos no funcionales

### RNF-COM-001 — Autenticación obligatoria
Todo endpoint privado del módulo debe estar protegido por el middleware `verifyToken`. El único endpoint sin autenticación es `GET /api/v1/requests/public/consent/:token`.

### RNF-COM-002 — Control de acceso por rol
El sistema debe aplicar `requireRole` con las listas de roles exactas definidas en `clients.routes.js` y `requests.routes.js` para cada operación sensible. La asignación de clientes está restringida a `ASSIGN_CLIENT_ROLES`; la edición de clientes a `EDIT_CLIENT_ROLES`; las interacciones CRM a `CRM_INTERACTION_ROLES`.

### RNF-COM-003 — Unicidad de asignación activa
No debe existir más de una asignación activa del mismo cliente al mismo asesor simultáneamente. La restricción está definida por `UNIQUE(client_request_id, assigned_to_email)` en `client_assignments`.

### RNF-COM-004 — Unicidad de visita por día
El sistema debe garantizar que existe un único registro de visita por combinación `(client_request_id, user_email, visit_date)`. Si ya existe, el endpoint `POST /:id/visit-status` actualiza el registro existente en lugar de crear uno nuevo.

### RNF-COM-005 — Integridad documental
Los archivos adjuntos se procesan en memoria mediante `multer.memoryStorage()` y se persisten en Google Drive. El sistema debe almacenar el `file_id` de Drive en la base de datos para construir el enlace de acceso `https://drive.google.com/file/d/{fileId}/view`.

### RNF-COM-006 — Trazabilidad de asignaciones
Las asignaciones deben registrar `assigned_by_email`, `assignment_type` (`owner`, `manual`, `temporary`), `starts_at`, `ends_at` y `reason`. Las asignaciones con `is_active = false` se conservan para auditoría.

### RNF-COM-007 — Restricción de asignación por estado de empleo
El sistema no debe permitir asignar un cliente a un usuario cuyo estado laboral sea `pasivo`, `desvinculado` o `inactivo`.

### RNF-COM-008 — Geocodificación no bloqueante
El fallo de la API de Google Maps Geocoding no debe impedir el registro de una sede. El campo `geocode_status` debe reflejar el resultado: `OK`, `NO_RESULTS`, `MISSING_API_KEY`, `EMPTY_ADDRESS`, `INVALID_GEOMETRY` o `REQUEST_ERROR`.

### RNF-COM-009 — Sincronización Odoo
La sincronización bidireccional con Odoo CRM solo puede ser iniciada por roles en `ODOO_SYNC_ALLOWED_ROLES`. Los clientes migrados desde Odoo que tengan la asignación técnica `odoo_sync@spi.local` deben tener dicha asignación desactivada para habilitar asignación comercial real.

---

## 8. Reglas de negocio extraídas del código

| # | Regla | Origen en código |
|---|---|---|
| RN-01 | Los tipos de visita válidos son exactamente: `visited`, `pending`, `skipped`, `in_visit`. Cualquier otro valor es rechazado. | `VALID_VISIT_STATUS` en `clients.service.js` |
| RN-02 | Los tipos de interacción CRM válidos son `call` y `visit`. Las variantes `llamada`, `phone_call`, `telefono`, `visita` se normalizan al tipo canónico. | `normalizeInteractionType()` en `clients.service.js` |
| RN-03 | Una asignación es activa si `is_active = TRUE`, `starts_at <= NOW()` y `ends_at >= NOW()` (o es NULL). | `ACTIVE_ASSIGNMENT_CONDITION` en `clients.service.js` |
| RN-04 | Un asesor es asignable si tiene un rol en `ASSIGNABLE_ADVISOR_ROLES` y su estado de empleo no está en `PASSIVE_EMPLOYMENT_STATUSES`. | `ASSIGNABLE_ADVISOR_ROLES` y `PASSIVE_EMPLOYMENT_STATUSES` en `clients.service.js` |
| RN-05 | El token de consentimiento LOPDP es el único mecanismo válido para registrar el consentimiento del cliente externo antes del alta. | `requests.routes.js`, ruta pública `GET /public/consent/:token` |
| RN-06 | La búsqueda de cuentas en oportunidades tiene un límite mínimo de 1 y máximo de 50 resultados. El parámetro `limit` se coerciona al rango `[1, 50]`. | `listAccounts()` en `opportunities.service.js` |
| RN-07 | El procesamiento de una solicitud de nuevo cliente (aprobar/rechazar) es exclusivo del rol `backoffice_comercial`. | `requests.routes.js`, `PUT /new-client/:id/process` |
| RN-08 | Las asignaciones de tipo `owner` se crean automáticamente al momento de aprobación de la solicitud de cliente, atribuyendo el cliente al usuario que realizó el registro. | `ensureTables()` seed de `client_assignments` en `clients.service.js` |
| RN-09 | Los clientes cuya solicitud fue creada por `odoo_sync@spi.local` tienen la asignación técnica desactivada automáticamente para permitir asignación comercial manual. | `ensureTables()` en `clients.service.js` |
| RN-10 | Las oportunidades pueden vincularse a procesos de tipo `business_case`, `private_purchase` o `equipment_purchase`, mapeados a tablas `bc_master`, `private_purchase_requests` y `equipment_purchase_requests`. | `PROCESS_TYPE_TO_TABLE` en `opportunities.service.js` |

---

## 9. Dependencias con otros módulos

| Módulo dependiente | Tipo de dependencia | Descripción |
|---|---|---|
| `auth` / `security` | Transversal obligatoria | `verifyToken` y `requireRole` usados en todas las rutas |
| `schedules` | Funcional | `clients.service.js` consulta `schedulesService` para incluir información de cronograma en el listado de clientes |
| `integrations` / `odooClient` | Funcional opcional | Sincronización de clientes con Odoo CRM vía `callOdoo` y `enqueueIntegrationEvent` |
| `notifications` | Funcional | Oportunidades disparan notificaciones vía `notificationManager` |
| `business-case` | Referencial | Las oportunidades pueden vincularse a registros de `bc_master` |
| `private-purchases` | Referencial | Las oportunidades pueden vincularse a `private_purchase_requests` |
| `equipment-purchases` | Referencial | Las oportunidades pueden vincularse a `equipment_purchase_requests` |
| Google Drive | Infraestructura | Almacenamiento de documentos adjuntos mediante `uploadBase64File` |
| Google Maps Geocoding API | Infraestructura opcional | Geocodificación de sedes del cliente |

---

## 10. Conclusión

Los requerimientos del módulo Comercial y Clientes se justifican por la necesidad institucional de mantener un ciclo comercial trazable y auditable: desde la obtención verificada del consentimiento LOPDP hasta la gestión activa de la cartera con asignaciones formalizadas, interacciones CRM registradas y oportunidades vinculadas a procesos concretos. El módulo integra controles de acceso diferenciados por rol en cada operación, reglas de negocio sobre estados de visita y tipos de interacción, y dependencias críticas de infraestructura (Google Drive, Google Maps) diseñadas para no bloquear el flujo principal en caso de fallo.
