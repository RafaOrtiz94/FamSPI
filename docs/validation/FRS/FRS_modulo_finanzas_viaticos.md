# FRS — MÓDULO DE VIÁTICOS

**Sistema:** FamSPI  
**Versión:** 2.0  
**Fecha:** 2026-06-18  
**Estado:** En revisión  
**Alineación:** WHO TRS 1019, Annex 3, Appendix 5  
**Referencia URS:** URS_modulo_finanzas_viaticos.md v2.0

---

## 1. Introducción

El presente documento describe cómo el sistema SPI implementa funcionalmente los requerimientos del módulo de Viáticos definidos en el URS. Cada especificación funcional identifica las entradas esperadas, el proceso que ejecuta el backend y la salida producida, con referencia a los controles de acceso y las reglas de negocio que aplican en cada caso.

---

## 2. Descripción funcional del módulo

El módulo de Viáticos gestiona el ciclo completo de gastos de desplazamiento corporativo: creación del viático vinculado a una salida operacional, carga de soportes documentales (facturas electrónicas del SRI vía TXT, notas de venta manuales, compras sin factura), flujo de aprobación multinivel (solicitante → jefe de área → financiero) y registro de pago. Incluye un workspace agrupado por período con asistente guiado de cuatro pasos para el colaborador.

El módulo opera sobre las tablas `travel_allowances`, `travel_allowance_invoices`, `travel_allowance_documents`, `travel_allowance_purchases_no_invoice` y tablas de configuración (`travel_allowance_zones`, `travel_allowance_fixed_profiles`, `travel_allowance_policy`).

---

## 3. Especificaciones funcionales

### FRS-VT-001 — Listado de viáticos del usuario
**Requerimiento origen:** REQ-VT-001, REQ-VT-013  
**Endpoint:** `GET /api/v1/viaticos`  
**Entradas:** Token JWT válido; parámetros opcionales de filtro por rango de fechas (`start_date`, `end_date`).  
**Proceso:** El servicio verifica el token y el rol del actor. Si el rol no pertenece a `FINANCE_REVIEWER_ROLES` ni a gerencia, la consulta se restringe a registros con `created_by = actor.id`. Los resultados se ordenan por fecha de inicio descendente.  
**Salida:** Array de objetos viático con todos sus campos, incluyendo `workflow_status`, `total_amount`, `created_by_name` y totales consolidados por categoría.

### FRS-VT-002 — Listado de candidatos de viático
**Requerimiento origen:** REQ-VT-001  
**Endpoint:** `GET /api/v1/viaticos/candidates`  
**Entradas:** Token JWT válido; parámetros opcionales de filtro por fecha.  
**Proceso:** Consulta las salidas operacionales (visitas a clientes, prospectos, salidas manuales) del usuario autenticado que aún no tienen un viático asociado o cuyo viático está en estado inicial. Devuelve las candidatas elegibles.  
**Salida:** Array de candidatos con metadatos de la salida operacional de origen.

### FRS-VT-003 — Creación o actualización de viático
**Requerimiento origen:** REQ-VT-001  
**Endpoint:** `POST /api/v1/viaticos`  
**Entradas:** Token JWT; cuerpo con `source_type`, `source_id` (opcional), `start_date`, `end_date`, `destination`, montos estimados y demás metadatos.  
**Proceso:** El servicio valida que `source_type` pertenezca a los tipos permitidos (`client_visit`, `prospect_visit`, `manual_trip`, `operational_exit`). Si ya existe un viático para esa fuente, lo actualiza (upsert); si no existe, lo crea con `workflow_status = 'borrador'`. El `created_by` se toma del token.  
**Salida:** Objeto viático creado o actualizado con su identificador.

### FRS-VT-004 — Previsualización de archivo TXT del SRI
**Requerimiento origen:** REQ-VT-003  
**Endpoint:** `POST /api/v1/viaticos/:id/invoices/txt/preview`  
**Entradas:** Token JWT; `txt_content` (texto del archivo TXT del SRI delimitado por tabulaciones).  
**Proceso:** El servicio parsea el archivo TXT leyendo la fila de cabeceras para mapear posiciones de columna con compatibilidad de dos variantes de nombre (con y sin guion bajo). Por cada fila de datos extrae 14 campos: `supplier_ruc`, `supplier_name`, `receipt_type`, `establishment`, `emission_point`, `sequential`, `access_key`, `authorization_number`, `authorization_date`, `issue_date`, `buyer_id`, `subtotal`, `iva`, `total`. Calcula `in_trip_date_range` comparando `issue_date` contra el rango de fechas del viático. No persiste ningún dato.  
**Salida:** Array de objetos con los 14 campos por comprobante y el indicador `in_trip_date_range`.

### FRS-VT-005 — Carga de archivo TXT del SRI con categorías
**Requerimiento origen:** REQ-VT-003, REQ-VT-004  
**Endpoint:** `POST /api/v1/viaticos/:id/invoices/txt`  
**Entradas:** Token JWT; `txt_content` (texto del TXT); `categories` (objeto `{ [access_key]: category }`).  
**Proceso:** El servicio parsea el TXT igual que en la previsualización. Por cada comprobante, verifica que la `access_key` no exista ya en `travel_allowance_invoices` para ese viático (evita duplicados). Si `categories[access_key]` está definido y es una categoría válida del catálogo `ALLOWED_EXPENSE_CATEGORIES`, inserta la factura con `category`, `allowed_category = true`, `category_source = 'requester'` y `status = 'clasificada'`. Si no hay categoría, inserta con `status = 'pendiente_clasificacion'`. Al final, recalcula los totales del viático.  
**Salida:** Array de facturas insertadas con sus identificadores y estado.

### FRS-VT-006 — Carga de facturas XML individuales
**Requerimiento origen:** REQ-VT-003  
**Endpoint:** `POST /api/v1/viaticos/:id/invoices/xml`  
**Entradas:** Token JWT; payload con el contenido XML del comprobante electrónico.  
**Proceso:** El servicio parsea el XML de la factura electrónica, extrae los campos tributarios relevantes y los inserta en `travel_allowance_invoices`. Recalcula totales del viático.  
**Salida:** Objeto factura insertada.

### FRS-VT-007 — Creación de nota de venta manual
**Requerimiento origen:** REQ-VT-005  
**Endpoint:** `POST /api/v1/viaticos/:id/invoices/manual`  
**Entradas:** Token JWT; campos de la nota: `issue_date`, `supplier_ruc`, `supplier_name`, `subtotal_12`, `subtotal_0`, `iva`, `total`, `expense_description`, `document_state`, `emission_point`, `sequential`, `notes`.  
**Proceso:** El servicio verifica acceso al módulo (`assertViaticosAccess`). Inserta en `travel_allowance_invoices` con `document_type = 'nota_venta_manual'` y `status = 'pendiente_clasificacion'`. Recalcula totales del viático.  
**Salida:** Objeto nota de venta manual creada.

### FRS-VT-008 — Listado de notas de venta manuales
**Requerimiento origen:** REQ-VT-005  
**Endpoint:** `GET /api/v1/viaticos/:id/invoices/manual`  
**Entradas:** Token JWT; `id` del viático.  
**Proceso:** Consulta `travel_allowance_invoices` filtrando por `allowance_id = id` y `document_type = 'nota_venta_manual'`. Ordena por `issue_date` descendente.  
**Salida:** Array de notas de venta manuales del viático.

### FRS-VT-009 — Actualización y eliminación de nota de venta manual
**Requerimiento origen:** REQ-VT-005  
**Endpoints:** `PATCH /api/v1/viaticos/invoices/manual/:noteId` | `DELETE /api/v1/viaticos/invoices/manual/:noteId`  
**Entradas:** Token JWT; `noteId`; en PATCH: campos actualizables de la nota.  
**Proceso:** El servicio actualiza o elimina el registro de `travel_allowance_invoices` identificado por `noteId` con `document_type = 'nota_venta_manual'`. Recalcula totales del viático tras la operación.  
**Salida:** Objeto actualizado o confirmación de eliminación.

### FRS-VT-010 — Registro de compra sin factura
**Requerimiento origen:** REQ-VT-006  
**Endpoint:** `POST /api/v1/viaticos/:id/purchases-no-invoice`  
**Entradas:** Token JWT; `description`, `total`, `category`, `justification`.  
**Proceso:** El servicio verifica acceso. Inserta en `travel_allowance_purchases_no_invoice` con `status = 'pending'`. Recalcula totales del viático.  
**Salida:** Objeto compra sin factura creada.

### FRS-VT-011 — Aprobación de compra sin factura
**Requerimiento origen:** REQ-VT-006  
**Endpoint:** `PATCH /api/v1/viaticos/purchases/:id/approve`  
**Entradas:** Token JWT con rol en `FINANCE_REVIEWER_ROLES` o `talento_humano`/`jefe_talento_humano`; `id` de la compra.  
**Proceso:** Actualiza `status = 'approved'` en `travel_allowance_purchases_no_invoice`. Recalcula totales del viático.  
**Salida:** Objeto compra sin factura actualizado.

### FRS-VT-012 — Envío a revisión por el solicitante
**Requerimiento origen:** REQ-VT-008  
**Endpoint:** `POST /api/v1/viaticos/:id/submit-review`  
**Entradas:** Token JWT.  
**Proceso:** El servicio verifica que el actor sea el propietario del viático (`isOwner`) o un rol privilegiado. Verifica que el estado actual sea `borrador`; si es `pendiente_revision` o posterior, devuelve error. Si pasa las validaciones, ejecuta `UPDATE travel_allowances SET workflow_status = 'pendiente_revision'`.  
**Salida:** Objeto viático actualizado con nuevo estado.

### FRS-VT-013 — Aprobación operacional por jefe de área
**Requerimiento origen:** REQ-VT-009  
**Endpoint:** `PATCH /api/v1/viaticos/:id/workflow`  
**Entradas:** Token JWT con rol de jefe de área; `action` (`approve` | `reject`), `notes` (opcional).  
**Proceso:** `assertOperationalApprover` verifica que el actor tenga rol de jefe. Aplica transición de estado: `pendiente_revision → aprobado_jefe` o `rechazado_jefe`. Registra `reviewed_by` y `reviewed_at`.  
**Salida:** Objeto viático con estado actualizado.

### FRS-VT-014 — Aprobación financiera y registro de pago
**Requerimiento origen:** REQ-VT-010, REQ-VT-011  
**Endpoint:** `PATCH /api/v1/viaticos/:id/status`  
**Entradas:** Token JWT con rol en `FINANCE_REVIEWER_ROLES`; `status` destino; `notes` y montos aprobados cuando aplica.  
**Proceso:** `requireRole(FINANCE_REVIEWER_ROLES)` restringe el acceso. El servicio valida la transición de estado según las reglas del flujo. Actualiza `workflow_status`, `approved_by`, `approved_at` y montos aprobados según corresponda.  
**Salida:** Objeto viático con estado actualizado.

### FRS-VT-015 — Categorización de facturas por finanzas
**Requerimiento origen:** REQ-VT-012  
**Endpoint:** `PATCH /api/v1/viaticos/invoices/:invoiceId`  
**Entradas:** Token JWT con rol en `FINANCE_REVIEWER_ROLES`; `category`.  
**Proceso:** `assertFinanceApprover` restringe la operación. Actualiza `category`, `allowed_category = true`, `category_source = 'finance'`, `status = 'clasificada'` en `travel_allowance_invoices`.  
**Salida:** Objeto factura actualizado.

### FRS-VT-016 — Eliminación de factura
**Requerimiento origen:** REQ-VT-003  
**Endpoint:** `DELETE /api/v1/viaticos/invoices/:invoiceId`  
**Entradas:** Token JWT; `invoiceId`.  
**Proceso:** Elimina el registro de `travel_allowance_invoices`. Recalcula totales del viático.  
**Salida:** Confirmación de eliminación.

### FRS-VT-017 — Gestión de documentos adjuntos
**Requerimiento origen:** REQ-VT-004  
**Endpoints:** `GET /api/v1/viaticos/:id/documents` | `POST /api/v1/viaticos/:id/documents`  
**Entradas:** Token JWT; en POST: `doc_type`, `notes`, datos del archivo y enlace de Drive.  
**Proceso:** GET lista los documentos de `travel_allowance_documents` filtrados por `allowance_id`. POST inserta un nuevo registro con metadatos del archivo y `drive_link`, validando tipo MIME y tamaño máximo de 15 MB.  
**Salida:** Array de documentos o documento creado.

### FRS-VT-018 — Reporte de cotejo
**Requerimiento origen:** REQ-VT-014  
**Endpoint:** `GET /api/v1/viaticos/:id/report`  
**Entradas:** Token JWT con rol en `FINANCE_REVIEWER_ROLES`; `id` del viático.  
**Proceso:** Cruza los gastos declarados del viático contra los registros de asistencia operacional del colaborador para las fechas del viático. Evalúa completitud documental y genera recomendación de monto.  
**Salida:** Objeto con recomendación de monto, estado técnico de validación y detalle de discrepancias.

### FRS-VT-019 — Reporte resumen y ATS XML
**Requerimiento origen:** REQ-VT-016  
**Endpoints:** `GET /api/v1/viaticos/reports/summary` | `GET /api/v1/viaticos/ats/xml`  
**Entradas:** Token JWT con rol en `FINANCE_REVIEWER_ROLES`; parámetros de filtro por período.  
**Proceso:** El reporte resumen agrega viáticos por período con totales por estado. El ATS genera el XML con la estructura requerida por el SRI para el anexo transaccional.  
**Salida:** Array de filas del resumen o contenido XML del ATS.

### FRS-VT-020 — Configuración del módulo
**Requerimiento origen:** REQ-VT-015  
**Endpoints:** `POST /api/v1/viaticos/config/zones` | `POST /api/v1/viaticos/config/fixed-profiles` | `GET /api/v1/viaticos/config/fixed-profiles` | `PATCH /api/v1/viaticos/config/policy`  
**Entradas:** Token JWT con rol en `finanzas`, `financiero`, `admin` o `administrador`; payload de configuración.  
**Proceso:** Persiste o actualiza los parámetros de zona, perfil fijo o política en las tablas de configuración del módulo.  
**Salida:** Objeto de configuración creado o actualizado.

---

## 4. Endpoints API completos del módulo

| Método | Ruta | Acceso | Función |
|---|---|---|---|
| GET | `/api/v1/viaticos/candidates` | Todos los roles del módulo | Listar candidatos de viático |
| GET | `/api/v1/viaticos/reports/summary` | FINANCE_REVIEWER_ROLES | Reporte resumen por período |
| GET | `/api/v1/viaticos/ats/xml` | FINANCE_REVIEWER_ROLES | Exportar ATS en XML |
| GET | `/api/v1/viaticos` | Todos (filtrado por propietario) | Listar viáticos |
| POST | `/api/v1/viaticos` | Todos los roles del módulo | Crear o actualizar viático |
| PATCH | `/api/v1/viaticos/:id/status` | FINANCE_REVIEWER_ROLES | Cambio de estado financiero y pago |
| PATCH | `/api/v1/viaticos/:id/workflow` | Jefes de área | Aprobación operacional |
| POST | `/api/v1/viaticos/:id/submit-review` | Propietario o privilegiado | Enviar a revisión |
| GET | `/api/v1/viaticos/:id/documents` | Todos los roles del módulo | Listar documentos adjuntos |
| POST | `/api/v1/viaticos/:id/documents` | Todos los roles del módulo | Adjuntar documento |
| POST | `/api/v1/viaticos/:id/invoices/xml` | Todos los roles del módulo | Cargar factura XML |
| POST | `/api/v1/viaticos/:id/invoices/zip` | Todos los roles del módulo | Cargar lote de facturas ZIP |
| POST | `/api/v1/viaticos/:id/invoices/txt` | Todos los roles del módulo | Cargar TXT SRI con categorías |
| POST | `/api/v1/viaticos/:id/invoices/txt/preview` | Todos los roles del módulo | Previsualizar TXT SRI |
| GET | `/api/v1/viaticos/:id/invoices` | Todos los roles del módulo | Listar facturas del viático |
| PATCH | `/api/v1/viaticos/invoices/:invoiceId` | FINANCE_REVIEWER_ROLES | Categorizar factura guardada |
| DELETE | `/api/v1/viaticos/invoices/:invoiceId` | Todos los roles del módulo | Eliminar factura |
| GET | `/api/v1/viaticos/:id/report` | FINANCE_REVIEWER_ROLES | Reporte de cotejo |
| POST | `/api/v1/viaticos/:id/invoices/manual` | Todos los roles del módulo | Crear nota de venta manual |
| GET | `/api/v1/viaticos/:id/invoices/manual` | Todos los roles del módulo | Listar notas manuales |
| PATCH | `/api/v1/viaticos/invoices/manual/:noteId` | Todos los roles del módulo | Actualizar nota manual |
| DELETE | `/api/v1/viaticos/invoices/manual/:noteId` | Todos los roles del módulo | Eliminar nota manual |
| POST | `/api/v1/viaticos/:id/purchases-no-invoice` | Todos los roles del módulo | Registrar compra sin factura |
| GET | `/api/v1/viaticos/:id/purchases-no-invoice` | Todos los roles del módulo | Listar compras sin factura |
| PATCH | `/api/v1/viaticos/purchases/:id/approve` | FINANCE_REVIEWER_ROLES + talento_humano | Aprobar compra sin factura |
| POST | `/api/v1/viaticos/config/zones` | finanzas, financiero, admin | Configurar zona |
| POST | `/api/v1/viaticos/config/fixed-profiles` | finanzas, financiero, admin | Crear perfil fijo |
| GET | `/api/v1/viaticos/config/fixed-profiles` | finanzas, financiero, admin | Listar perfiles fijos |
| PATCH | `/api/v1/viaticos/config/policy` | finanzas, financiero, admin | Actualizar política |
| POST | `/api/v1/viaticos/sync-sri` | Todos los roles del módulo | Sincronizar con SRI |

---

## 5. Controles de acceso y seguridad funcional

**Autenticación:** `verifyToken` se aplica como middleware global en el router del módulo; toda solicitud sin JWT válido es rechazada con HTTP 401.

**Autorización por rol:** `requireRole` se aplica a rutas sensibles:
- `FINANCE_REVIEWER_ROLES` = `['finanzas', 'financiero', 'jefe_financiero', 'jefe_finanzas']`
- Las operaciones de cambio de estado financiero, categorización de facturas y reportes están restringidas a este conjunto.

**Guards de servicio:**
- `assertViaticosAccess(actorUser)` — valida que el actor tenga acceso al módulo.
- `assertFinanceApprover(actorUser)` — restringe operaciones de categorización financiera.
- `assertOperationalApprover(actorUser)` — restringe el endpoint de flujo operacional de jefes.
- `assertAllowanceRequester(actorUser, allowance)` — verifica propiedad del viático para operaciones del solicitante.

**Trazabilidad:** Los cambios de estado registran `reviewed_by` / `approved_by` con ID del actor y `reviewed_at` / `approved_at` con timestamp de la operación.

**Validación documental:** Adjuntos validados por tipo MIME y tamaño máximo de 15 MB antes de la persistencia.

---

## 6. Dependencias funcionales

- **Salidas operacionales / Oportunidades:** Fuente primaria de viáticos con `source_type = 'operational_exit'`.
- **Usuarios / Autenticación:** Resolución de identidad, rol y propietario mediante JWT.
- **Asistencia:** Datos de marcaciones utilizados en el reporte de cotejo.
- **Google Drive:** Almacenamiento de archivos adjuntos con retorno de `drive_file_id` y `drive_link`.
- **Notificaciones:** Eventos de cambio de estado del flujo de aprobación.

---

## 7. Observaciones técnicas y riesgos

- La función `ensureSchema` crea tablas con `CREATE TABLE IF NOT EXISTS` al iniciar el servicio; no aplica migraciones. En entornos de producción con esquema ya estabilizado, los `ALTER TABLE` correctivos deben aplicarse mediante scripts de migración controlados.
- El endpoint `PATCH /:id/workflow` usa `assertOperationalApprover`; el solicitante no puede usarlo. El endpoint `POST /:id/submit-review` es el canal exclusivo del colaborador para iniciar el flujo.
- Las notas de venta manual y las facturas TXT comparten la tabla `travel_allowance_invoices`, discriminadas por `document_type`. Esta arquitectura simplifica los totales consolidados pero requiere consistencia en los valores del discriminador.
- El campo `in_trip_date_range` es calculado en el momento de la previsualización y la carga; no se recalcula si las fechas del viático cambian posteriormente.
