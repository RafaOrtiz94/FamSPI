# DICCIONARIO DE DATOS

## Area 01: Gobierno, Seguridad y Cumplimiento

## 1. Objetivo
Documentar las estructuras de datos reales consumidas por los modulos `auth`, `security`, `auditoria`, `audit-prep`, `approvals`, `management` y `signature`, tomando como fuente la base vigente en Neon.

## 2. Fuente de verdad
- Motor consultado: PostgreSQL en Neon.
- Base consultada: `FamSPI`.
- Extraccion realizada desde catalogos reales (`information_schema`, `pg_catalog`).
- Regla aplicada: cuando el codigo usa objetos distintos a los existentes en Neon, se registra como discrepancia tecnica.

## 3. Tablas y vistas incluidas
- `auditoria.logs` (table)
- `public.audit_access_grants` (table)
- `public.audit_documents` (table)
- `public.audit_sections` (table)
- `public.audit_settings` (table)
- `public.departments` (table)
- `public.document_hashes` (table)
- `public.document_qr_codes` (table)
- `public.document_seals` (table)
- `public.document_signature_logs` (table)
- `public.document_signatures_advanced` (table)
- `public.document_verification_info` (view)
- `public.documents` (table)
- `public.notifications` (table)
- `public.request_approvals` (table)
- `public.request_attachments` (table)
- `public.request_types` (table)
- `public.request_versions` (table)
- `public.requests` (table)
- `public.user_attendance_records` (table)
- `public.user_lopdp_consents` (table)
- `public.user_profile` (table)
- `public.user_sessions` (table)
- `public.users` (table)

## 4. Diccionario por entidad

### auditoria.logs
- Tipo de objeto: table.
- Modulos que la consumen: auth, auditoria, security, approvals.
- Descripcion: Registra todas las acciones de usuarios del sistema SPI Fam (creaciones, modificaciones, logins, etc.)
- Clave primaria: id
- Relaciones foraneas: no aplica o no visibles.

| Campo | Tipo | Nulo | Default | Comentario |
|---|---|---|---|---|
| id | integer | NO | nextval('auditoria.logs_id_seq'::regclass) |  |
| usuario_id | integer | YES |  |  |
| usuario_email | character varying | YES |  | Correo del usuario que realizó la acción |
| rol | character varying | YES |  |  |
| modulo | character varying | YES |  | Módulo afectado (auth, solicitudes, mantenimientos, etc.) |
| accion | character varying | YES |  | Tipo de acción (CREATE, UPDATE, DELETE, LOGIN, APPROVE, etc.) |
| descripcion | text | YES |  | Descripción amigable de la acción realizada |
| datos_anteriores | jsonb | YES |  | JSON con los datos antes del cambio |
| datos_nuevos | jsonb | YES |  | JSON con los datos después del cambio |
| ip | character varying | YES |  |  |
| user_agent | text | YES |  |  |
| fecha | timestamp without time zone | YES | CURRENT_TIMESTAMP | Fecha y hora del evento registrado |
| duracion_ms | integer | YES |  |  |
| request_id | integer | YES |  |  |
| mantenimiento_id | integer | YES |  |  |
| inventario_id | integer | YES |  |  |
| auto | boolean | YES | false |  |
| creado_en | timestamp with time zone | YES | now() |  |

- Indices visibles:
  - idx_auditoria_accion: CREATE INDEX idx_auditoria_accion ON auditoria.logs USING btree (accion)
  - idx_auditoria_fecha: CREATE INDEX idx_auditoria_fecha ON auditoria.logs USING btree (fecha DESC)
  - idx_auditoria_modulo: CREATE INDEX idx_auditoria_modulo ON auditoria.logs USING btree (modulo)
  - idx_auditoria_usuario: CREATE INDEX idx_auditoria_usuario ON auditoria.logs USING btree (usuario_email)
  - logs_pkey: CREATE UNIQUE INDEX logs_pkey ON auditoria.logs USING btree (id)

### public.audit_access_grants
- Tipo de objeto: table.
- Modulos que la consumen: audit-prep.
- Descripcion: Sin comentario de catalogo.
- Clave primaria: id
- Relaciones foraneas:
  - created_by -> public.users.id
  - revoked_by -> public.users.id

| Campo | Tipo | Nulo | Default | Comentario |
|---|---|---|---|---|
| id | integer | NO | nextval('audit_access_grants_id_seq'::regclass) |  |
| email | text | NO |  |  |
| display_name | text | YES |  |  |
| expires_at | timestamp with time zone | YES |  |  |
| active | boolean | NO | true |  |
| created_by | integer | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| revoked_at | timestamp with time zone | YES |  |  |
| revoked_by | integer | YES |  |  |

- Indices visibles:
  - audit_access_grants_pkey: CREATE UNIQUE INDEX audit_access_grants_pkey ON public.audit_access_grants USING btree (id)

### public.audit_documents
- Tipo de objeto: table.
- Modulos que la consumen: audit-prep.
- Descripcion: Sin comentario de catalogo.
- Clave primaria: id
- Relaciones foraneas:
  - section_code -> public.audit_sections.code
  - uploaded_by -> public.users.id

| Campo | Tipo | Nulo | Default | Comentario |
|---|---|---|---|---|
| id | integer | NO | nextval('audit_documents_id_seq'::regclass) |  |
| section_code | text | NO |  |  |
| name | text | NO |  |  |
| status | text | NO | 'pendiente'::text |  |
| drive_file_id | text | YES |  |  |
| drive_folder_id | text | YES |  |  |
| uploaded_by | integer | YES |  |  |
| uploaded_at | timestamp with time zone | YES |  |  |
| metadata | jsonb | NO | '{}'::jsonb |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |

- Indices visibles:
  - audit_documents_pkey: CREATE UNIQUE INDEX audit_documents_pkey ON public.audit_documents USING btree (id)
  - idx_audit_documents_section: CREATE INDEX idx_audit_documents_section ON public.audit_documents USING btree (section_code)
  - idx_audit_documents_status: CREATE INDEX idx_audit_documents_status ON public.audit_documents USING btree (status)

### public.audit_sections
- Tipo de objeto: table.
- Modulos que la consumen: audit-prep.
- Descripcion: Sin comentario de catalogo.
- Clave primaria: id
- Relaciones foraneas: no aplica o no visibles.

| Campo | Tipo | Nulo | Default | Comentario |
|---|---|---|---|---|
| id | integer | NO | nextval('audit_sections_id_seq'::regclass) |  |
| code | text | NO |  |  |
| title | text | NO |  |  |
| description | text | YES |  |  |
| area | text | YES |  |  |
| storage_path | text | YES |  |  |
| allowed_roles | _text[] | NO | '{}'::text[] |  |
| ordering | integer | NO | 0 |  |
| active | boolean | NO | true |  |
| metadata | jsonb | NO | '{}'::jsonb |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |

- Indices visibles:
  - audit_sections_code_key: CREATE UNIQUE INDEX audit_sections_code_key ON public.audit_sections USING btree (code)
  - audit_sections_pkey: CREATE UNIQUE INDEX audit_sections_pkey ON public.audit_sections USING btree (id)

### public.audit_settings
- Tipo de objeto: table.
- Modulos que la consumen: audit-prep.
- Descripcion: Sin comentario de catalogo.
- Clave primaria: id
- Relaciones foraneas: no aplica o no visibles.

| Campo | Tipo | Nulo | Default | Comentario |
|---|---|---|---|---|
| id | smallint | NO | 1 |  |
| audit_mode | boolean | NO | false |  |
| audit_start_date | timestamp with time zone | YES |  |  |
| audit_end_date | timestamp with time zone | YES |  |  |
| drive_root_id | text | YES |  |  |
| checklist_schema | jsonb | NO | '{}'::jsonb |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |

- Indices visibles:
  - audit_settings_pkey: CREATE UNIQUE INDEX audit_settings_pkey ON public.audit_settings USING btree (id)

### public.departments
- Tipo de objeto: table.
- Modulos que la consumen: auth.
- Descripcion: Sin comentario de catalogo.
- Clave primaria: id
- Relaciones foraneas: no aplica o no visibles.

| Campo | Tipo | Nulo | Default | Comentario |
|---|---|---|---|---|
| id | integer | NO | nextval('departments_id_seq'::regclass) |  |
| code | character varying | NO |  |  |
| name | character varying | NO |  |  |
| description | text | YES |  |  |
| created_at | timestamp without time zone | YES | now() |  |
| updated_at | timestamp without time zone | YES | now() |  |

- Indices visibles:
  - departments_code_key: CREATE UNIQUE INDEX departments_code_key ON public.departments USING btree (code)
  - departments_pkey: CREATE UNIQUE INDEX departments_pkey ON public.departments USING btree (id)

### public.document_hashes
- Tipo de objeto: table.
- Modulos que la consumen: signature.
- Descripcion: Cryptographic hashes for document integrity verification
- Clave primaria: id
- Relaciones foraneas:
  - calculated_by -> public.users.id

| Campo | Tipo | Nulo | Default | Comentario |
|---|---|---|---|---|
| id | integer | NO | nextval('document_hashes_id_seq'::regclass) |  |
| document_id | bigint | NO |  |  |
| document_type | character varying | NO |  | Type of document: pdf, docx, excel, etc. |
| hash_sha256 | character varying | NO |  | SHA-256 hash of the document content |
| hash_algorithm | character varying | YES | 'SHA-256'::character varying |  |
| calculated_at | timestamp with time zone | YES | now() |  |
| calculated_by | integer | YES |  |  |
| is_current | boolean | YES | true | True if this is the current valid hash for the document |

- Indices visibles:
  - document_hashes_pkey: CREATE UNIQUE INDEX document_hashes_pkey ON public.document_hashes USING btree (id)
  - idx_document_hashes_current: CREATE INDEX idx_document_hashes_current ON public.document_hashes USING btree (document_id, is_current) WHERE (is_current = true)
  - idx_document_hashes_document_id: CREATE INDEX idx_document_hashes_document_id ON public.document_hashes USING btree (document_id)
  - unique_current_hash: CREATE UNIQUE INDEX unique_current_hash ON public.document_hashes USING btree (document_id, is_current)

### public.document_qr_codes
- Tipo de objeto: table.
- Modulos que la consumen: signature.
- Descripcion: QR codes for public document verification
- Clave primaria: id
- Relaciones foraneas:
  - document_id -> public.documents.id
  - seal_id -> public.document_seals.id

| Campo | Tipo | Nulo | Default | Comentario |
|---|---|---|---|---|
| id | integer | NO | nextval('document_qr_codes_id_seq'::regclass) |  |
| document_id | bigint | NO |  |  |
| seal_id | integer | YES |  |  |
| qr_code | text | NO |  | Base64 encoded QR code image |
| qr_url | text | NO |  | Public URL for document verification |
| verification_token | uuid | YES | gen_random_uuid() | Token for public verification endpoint |
| generated_at | timestamp with time zone | YES | now() |  |
| expires_at | timestamp with time zone | YES |  |  |
| is_active | boolean | YES | true |  |
| access_count | integer | YES | 0 |  |
| last_accessed_at | timestamp with time zone | YES |  |  |

- Indices visibles:
  - document_qr_codes_pkey: CREATE UNIQUE INDEX document_qr_codes_pkey ON public.document_qr_codes USING btree (id)
  - idx_document_qr_codes_active: CREATE INDEX idx_document_qr_codes_active ON public.document_qr_codes USING btree (is_active) WHERE (is_active = true)
  - idx_document_qr_codes_document_id: CREATE INDEX idx_document_qr_codes_document_id ON public.document_qr_codes USING btree (document_id)
  - idx_document_qr_codes_seal_id: CREATE INDEX idx_document_qr_codes_seal_id ON public.document_qr_codes USING btree (seal_id)
  - idx_document_qr_codes_token: CREATE INDEX idx_document_qr_codes_token ON public.document_qr_codes USING btree (verification_token)
  - idx_document_qr_codes_verification: CREATE INDEX idx_document_qr_codes_verification ON public.document_qr_codes USING btree (document_id, is_active, verification_token)

### public.document_seals
- Tipo de objeto: table.
- Modulos que la consumen: signature.
- Descripcion: Institutional digital seals for document authentication
- Clave primaria: id
- Relaciones foraneas:
  - authorized_user_id -> public.users.id
  - document_hash_id -> public.document_hashes.id
  - document_id -> public.documents.id

| Campo | Tipo | Nulo | Default | Comentario |
|---|---|---|---|---|
| id | integer | NO | nextval('document_seals_id_seq'::regclass) |  |
| document_id | bigint | NO |  |  |
| seal_code | character varying | NO |  | Unique institutional seal code (format: SPI-YYYY-TYPE-NNNNN) |
| seal_type | character varying | YES | 'institutional'::character varying |  |
| issued_by | character varying | YES | 'SPI Fam'::character varying |  |
| authorized_role | character varying | NO |  | Role that authorized the seal (DPD, Manager, etc.) |
| authorized_user_id | integer | YES |  |  |
| seal_token | uuid | YES | gen_random_uuid() | Unique token for seal verification and API access |
| document_hash_id | integer | YES |  |  |
| issued_at | timestamp with time zone | YES | now() |  |
| expires_at | timestamp with time zone | YES |  |  |
| is_active | boolean | YES | true |  |
| created_at | timestamp with time zone | YES | now() |  |

- Indices visibles:
  - document_seals_pkey: CREATE UNIQUE INDEX document_seals_pkey ON public.document_seals USING btree (id)
  - document_seals_seal_code_key: CREATE UNIQUE INDEX document_seals_seal_code_key ON public.document_seals USING btree (seal_code)
  - idx_document_seals_active: CREATE INDEX idx_document_seals_active ON public.document_seals USING btree (is_active) WHERE (is_active = true)
  - idx_document_seals_document_id: CREATE INDEX idx_document_seals_document_id ON public.document_seals USING btree (document_id)
  - idx_document_seals_seal_code: CREATE INDEX idx_document_seals_seal_code ON public.document_seals USING btree (seal_code)
  - idx_document_seals_token: CREATE INDEX idx_document_seals_token ON public.document_seals USING btree (seal_token)
  - idx_document_seals_verification: CREATE INDEX idx_document_seals_verification ON public.document_seals USING btree (document_id, is_active, seal_token)

### public.document_signature_logs
- Tipo de objeto: table.
- Modulos que la consumen: signature.
- Descripcion: Sin comentario de catalogo.
- Clave primaria: id
- Relaciones foraneas:
  - user_id -> public.users.id

| Campo | Tipo | Nulo | Default | Comentario |
|---|---|---|---|---|
| id | integer | NO | nextval('document_signature_logs_id_seq'::regclass) |  |
| document_id | bigint | NO |  |  |
| event_type | character varying | NO |  |  |
| event_description | text | YES |  |  |
| user_id | integer | YES |  |  |
| user_name | character varying | YES |  |  |
| user_role | character varying | YES |  |  |
| user_email | character varying | YES |  |  |
| ip_address | inet | YES |  |  |
| user_agent | text | YES |  |  |
| session_id | character varying | YES |  |  |
| event_hash | character varying | NO |  |  |
| previous_event_hash | character varying | YES |  |  |
| event_data | jsonb | YES |  |  |
| event_timestamp | timestamp with time zone | YES | now() |  |
| created_at | timestamp with time zone | YES | now() |  |

- Indices visibles:
  - document_signature_logs_pkey: CREATE UNIQUE INDEX document_signature_logs_pkey ON public.document_signature_logs USING btree (id)

### public.document_signatures_advanced
- Tipo de objeto: table.
- Modulos que la consumen: signature.
- Descripcion: Advanced electronic signatures with full audit trail
- Clave primaria: id
- Relaciones foraneas:
  - document_hash_id -> public.document_hashes.id
  - document_id -> public.documents.id
  - signer_user_id -> public.users.id

| Campo | Tipo | Nulo | Default | Comentario |
|---|---|---|---|---|
| id | integer | NO | nextval('document_signatures_advanced_id_seq'::regclass) |  |
| document_id | bigint | NO |  |  |
| signer_user_id | integer | NO |  |  |
| signer_role | character varying | NO |  | Role of the signer at the time of signing |
| signature_type | character varying | YES | 'advanced_electronic'::character varying | Type of signature: advanced_electronic, qualified, etc. |
| signer_name | character varying | NO |  |  |
| signer_email | character varying | NO |  |  |
| signer_department | character varying | YES |  |  |
| signed_at | timestamp with time zone | YES | now() |  |
| ip_address | inet | NO |  |  |
| user_agent | text | YES |  |  |
| session_id | character varying | YES |  |  |
| auth_method | character varying | YES | 'oauth_corporate'::character varying | Authentication method used: oauth_corporate, certificate, etc. |
| document_hash_id | integer | YES |  | Reference to the document hash at time of signing |
| signature_hash | character varying | YES |  | Hash of the complete signature record for tamper detection |
| is_valid | boolean | YES | true |  |
| invalidated_at | timestamp with time zone | YES |  |  |
| invalidation_reason | text | YES |  |  |
| created_at | timestamp with time zone | YES | now() |  |

- Indices visibles:
  - document_signatures_advanced_pkey: CREATE UNIQUE INDEX document_signatures_advanced_pkey ON public.document_signatures_advanced USING btree (id)
  - idx_document_signatures_advanced_document_id: CREATE INDEX idx_document_signatures_advanced_document_id ON public.document_signatures_advanced USING btree (document_id)
  - idx_document_signatures_advanced_signed_at: CREATE INDEX idx_document_signatures_advanced_signed_at ON public.document_signatures_advanced USING btree (signed_at DESC)
  - idx_document_signatures_advanced_signer: CREATE INDEX idx_document_signatures_advanced_signer ON public.document_signatures_advanced USING btree (signer_user_id)
  - idx_document_signatures_advanced_valid: CREATE INDEX idx_document_signatures_advanced_valid ON public.document_signatures_advanced USING btree (is_valid) WHERE (is_valid = true)

### public.document_verification_info
- Tipo de objeto: view.
- Modulos que la consumen: signature.
- Descripcion: Complete verification information for documents with seals and QR codes
- Clave primaria: No aplica / no visible.
- Relaciones foraneas: no aplica o no visibles.

| Campo | Tipo | Nulo | Default | Comentario |
|---|---|---|---|---|
| document_id | bigint | YES |  |  |
| doc_drive_id | text | YES |  |  |
| pdf_drive_id | text | YES |  |  |
| signature_status | character varying | YES |  |  |
| is_locked | boolean | YES |  |  |
| seal_code | character varying | YES |  |  |
| seal_token | uuid | YES |  |  |
| issued_by | character varying | YES |  |  |
| authorized_role | character varying | YES |  |  |
| issued_at | timestamp with time zone | YES |  |  |
| seal_active | boolean | YES |  |  |
| qr_url | text | YES |  |  |
| verification_token | uuid | YES |  |  |
| access_count | integer | YES |  |  |
| last_accessed_at | timestamp with time zone | YES |  |  |
| qr_active | boolean | YES |  |  |
| hash_sha256 | character varying | YES |  |  |
| hash_calculated_at | timestamp with time zone | YES |  |  |
| last_signed_at | timestamp with time zone | YES |  |  |
| last_signer_name | character varying | YES |  |  |
| last_signer_role | character varying | YES |  |  |

### public.documents
- Tipo de objeto: table.
- Modulos que la consumen: signature.
- Descripcion: Documentos generados desde plantillas: DOCX/PDF/firma y carpeta Drive por request.
- Clave primaria: id
- Relaciones foraneas:
  - current_hash_id -> public.document_hashes.id
  - locked_by -> public.users.id
  - request_id -> public.requests.id
  - request_type_id -> public.request_types.id

| Campo | Tipo | Nulo | Default | Comentario |
|---|---|---|---|---|
| id | bigint | NO | nextval('documents_id_seq'::regclass) |  |
| request_id | integer | NO |  |  |
| request_type_id | integer | NO |  |  |
| doc_drive_id | text | YES |  |  |
| pdf_drive_id | text | YES |  |  |
| folder_drive_id | text | YES |  |  |
| version_number | integer | YES | 1 |  |
| signed | boolean | YES | false |  |
| created_at | timestamp without time zone | YES | now() |  |
| updated_at | timestamp without time zone | YES | now() |  |
| signature_status | character varying | YES | 'pending'::character varying | Status: pending, signed, locked, expired |
| current_hash_id | integer | YES |  | Reference to the current document hash |
| is_locked | boolean | YES | false | True if document is locked after signing |
| locked_at | timestamp with time zone | YES |  | Timestamp when document was locked |
| locked_by | integer | YES |  | User who locked the document |

- Indices visibles:
  - documents_pkey: CREATE UNIQUE INDEX documents_pkey ON public.documents USING btree (id)
  - idx_documents_request_id: CREATE INDEX idx_documents_request_id ON public.documents USING btree (request_id)

### public.notifications
- Tipo de objeto: table.
- Modulos que la consumen: auth, security, approvals.
- Descripcion: Sin comentario de catalogo.
- Clave primaria: id
- Relaciones foraneas:
  - user_id -> public.users.id

| Campo | Tipo | Nulo | Default | Comentario |
|---|---|---|---|---|
| id | integer | NO | nextval('notifications_id_seq'::regclass) |  |
| user_id | integer | NO |  |  |
| title | character varying | NO |  |  |
| message | text | YES |  |  |
| type | character varying | YES | 'info'::character varying |  |
| source | character varying | YES |  |  |
| status | character varying | YES | 'unread'::character varying |  |
| priority | integer | YES | 0 |  |
| meta | jsonb | YES | '{}'::jsonb |  |
| created_at | timestamp with time zone | YES | now() |  |
| read_at | timestamp with time zone | YES |  |  |

- Indices visibles:
  - idx_notifications_status: CREATE INDEX idx_notifications_status ON public.notifications USING btree (status)
  - idx_notifications_user: CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id)
  - notifications_pkey: CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id)

### public.request_approvals
- Tipo de objeto: table.
- Modulos que la consumen: approvals.
- Descripcion: Sin comentario de catalogo.
- Clave primaria: id
- Relaciones foraneas:
  - approver_id -> public.users.id
  - request_id -> public.requests.id
- Restricciones CHECK relevantes:
  - CHECK (((action IS NULL) OR (action = ANY (ARRAY['approve'::text, 'reject'::text])))) NOT VALID

| Campo | Tipo | Nulo | Default | Comentario |
|---|---|---|---|---|
| id | integer | NO | nextval('request_approvals_id_seq'::regclass) |  |
| request_id | integer | YES |  |  |
| approver_id | integer | YES |  |  |
| token | text | YES |  |  |
| token_expires_at | timestamp without time zone | YES |  |  |
| used | boolean | YES | false |  |
| action | text | YES |  |  |
| comments | text | YES |  |  |
| acted_at | timestamp without time zone | YES |  |  |

- Indices visibles:
  - idx_request_approvals_pending: CREATE INDEX idx_request_approvals_pending ON public.request_approvals USING btree (used, token_expires_at)
  - request_approvals_pkey: CREATE UNIQUE INDEX request_approvals_pkey ON public.request_approvals USING btree (id)
  - request_approvals_token_key: CREATE UNIQUE INDEX request_approvals_token_key ON public.request_approvals USING btree (token)

### public.request_attachments
- Tipo de objeto: table.
- Modulos que la consumen: management.
- Descripcion: Sin comentario de catalogo.
- Clave primaria: id
- Relaciones foraneas:
  - request_id -> public.requests.id
  - uploaded_by -> public.users.id

| Campo | Tipo | Nulo | Default | Comentario |
|---|---|---|---|---|
| id | integer | NO | nextval('request_attachments_id_seq'::regclass) |  |
| request_id | integer | YES |  |  |
| drive_file_id | text | YES |  |  |
| filename | text | YES |  |  |
| mimetype | text | YES |  |  |
| uploaded_by | integer | YES |  |  |
| created_at | timestamp without time zone | YES | now() |  |
| drive_link | text | YES |  |  |
| mime_type | text | YES |  |  |
| size | bigint | YES |  |  |
| title | text | YES |  |  |

- Indices visibles:
  - idx_request_attachments_request: CREATE INDEX idx_request_attachments_request ON public.request_attachments USING btree (request_id)
  - request_attachments_pkey: CREATE UNIQUE INDEX request_attachments_pkey ON public.request_attachments USING btree (id)

### public.request_types
- Tipo de objeto: table.
- Modulos que la consumen: management, signature.
- Descripcion: Sin comentario de catalogo.
- Clave primaria: id
- Relaciones foraneas: no aplica o no visibles.

| Campo | Tipo | Nulo | Default | Comentario |
|---|---|---|---|---|
| id | integer | NO | nextval('request_types_id_seq'::regclass) |  |
| title | text | NO |  |  |
| drive_folder_id | text | YES |  |  |
| schema | jsonb | YES |  |  |
| created_at | timestamp without time zone | YES | now() |  |
| code | text | NO |  |  |
| version | text | YES |  |  |
| reference | text | YES |  |  |
| template_doc_id | text | YES |  |  |

- Indices visibles:
  - idx_request_types_schema_gin: CREATE INDEX idx_request_types_schema_gin ON public.request_types USING gin (schema)
  - request_types_code_unique: CREATE UNIQUE INDEX request_types_code_unique ON public.request_types USING btree (code)
  - request_types_pkey: CREATE UNIQUE INDEX request_types_pkey ON public.request_types USING btree (id)

### public.request_versions
- Tipo de objeto: table.
- Modulos que la consumen: management.
- Descripcion: Sin comentario de catalogo.
- Clave primaria: id
- Relaciones foraneas:
  - request_id -> public.requests.id

| Campo | Tipo | Nulo | Default | Comentario |
|---|---|---|---|---|
| id | integer | NO | nextval('request_versions_id_seq'::regclass) |  |
| request_id | integer | YES |  |  |
| version_number | integer | YES |  |  |
| payload | jsonb | YES |  |  |
| created_at | timestamp without time zone | YES | now() |  |

- Indices visibles:
  - request_versions_pkey: CREATE UNIQUE INDEX request_versions_pkey ON public.request_versions USING btree (id)
  - uidx_request_versions_req_ver: CREATE UNIQUE INDEX uidx_request_versions_req_ver ON public.request_versions USING btree (request_id, version_number)

### public.requests
- Tipo de objeto: table.
- Modulos que la consumen: approvals, management, signature.
- Descripcion: Sin comentario de catalogo.
- Clave primaria: id
- Relaciones foraneas:
  - origin_department_id -> public.departments.id
  - request_type_id -> public.request_types.id
  - requester_id -> public.users.id
- Restricciones CHECK relevantes:
  - CHECK ((status = ANY (ARRAY['pendiente'::text, 'en_revision'::text, 'aprobado'::text, 'rechazado'::text, 'cancelado'::text])))

| Campo | Tipo | Nulo | Default | Comentario |
|---|---|---|---|---|
| id | integer | NO | nextval('requests_id_seq'::regclass) |  |
| requester_id | integer | NO |  |  |
| status | text | YES | 'pendiente'::text |  |
| version_number | integer | YES | 1 |  |
| created_at | timestamp without time zone | YES | now() |  |
| updated_at | timestamp without time zone | YES | now() |  |
| request_group_id | uuid | YES |  |  |
| request_type_id | integer | YES |  |  |
| payload | jsonb | YES |  |  |
| acta_generada | boolean | YES | false |  |
| legacy_purchase_id | uuid | YES |  | Reverse mapping to legacy purchase for debugging |
| drive_comercial_folder_id | text | YES |  | Google Drive folder ID for the main "Comercial" folder at root level |
| drive_user_folder_id | text | YES |  | Google Drive folder ID for the user-specific folder within "Comercial" |
| drive_type_folder_id | text | YES |  | Google Drive folder ID for the request type folder (e.g., "Inspección de Ambiente") |
| drive_request_folder_id | text | YES |  | Google Drive folder ID for the specific request folder (REQ-xxxx) |
| origin_department_id | integer | YES |  |  |
| origin_department_name | text | YES |  |  |

- Indices visibles:
  - idx_requests_created_at: CREATE INDEX idx_requests_created_at ON public.requests USING btree (created_at)
  - idx_requests_drive_comercial_folder: CREATE INDEX idx_requests_drive_comercial_folder ON public.requests USING btree (drive_comercial_folder_id) WHERE (drive_comercial_folder_id IS NOT NULL)
  - idx_requests_drive_request_folder: CREATE INDEX idx_requests_drive_request_folder ON public.requests USING btree (drive_request_folder_id) WHERE (drive_request_folder_id IS NOT NULL)
  - idx_requests_drive_type_folder: CREATE INDEX idx_requests_drive_type_folder ON public.requests USING btree (drive_type_folder_id) WHERE (drive_type_folder_id IS NOT NULL)
  - idx_requests_drive_user_folder: CREATE INDEX idx_requests_drive_user_folder ON public.requests USING btree (drive_user_folder_id) WHERE (drive_user_folder_id IS NOT NULL)
  - idx_requests_legacy_purchase_id: CREATE INDEX idx_requests_legacy_purchase_id ON public.requests USING btree (legacy_purchase_id) WHERE (legacy_purchase_id IS NOT NULL)
  - idx_requests_payload_gin: CREATE INDEX idx_requests_payload_gin ON public.requests USING gin (payload)
  - idx_requests_status: CREATE INDEX idx_requests_status ON public.requests USING btree (status)
  - requests_pkey: CREATE UNIQUE INDEX requests_pkey ON public.requests USING btree (id)

### public.user_attendance_records
- Tipo de objeto: table.
- Modulos que la consumen: auth (referencia transversal).
- Descripcion: Daily attendance records per user with entry, lunch, and exit times. Integrates with user signatures from lopdp_internal_signature_file_id.
- Clave primaria: id
- Relaciones foraneas:
  - user_id -> public.users.id

| Campo | Tipo | Nulo | Default | Comentario |
|---|---|---|---|---|
| id | integer | NO | nextval('user_attendance_records_id_seq'::regclass) |  |
| user_id | integer | NO |  | Foreign key to users table |
| date | date | NO |  | Date of the attendance record (without time component) |
| entry_time | timestamp with time zone | YES |  | Timestamp when user clocked in for the day |
| lunch_start_time | timestamp with time zone | YES |  | Timestamp when user started lunch break (requires signature) |
| lunch_end_time | timestamp with time zone | YES |  | Timestamp when user returned from lunch break |
| exit_time | timestamp with time zone | YES |  | Timestamp when user clocked out for the day (requires signature) |
| notes | text | YES |  | Optional notes for special circumstances (late arrival, early departure, etc.) |
| created_at | timestamp with time zone | YES | now() |  |
| updated_at | timestamp with time zone | YES | now() |  |
| entry_location | text | YES |  |  |
| lunch_start_location | text | YES |  |  |
| lunch_end_location | text | YES |  |  |
| exit_location | text | YES |  |  |
| is_overtime | boolean | YES | false | Indicates if the user worked overtime on this day |
| overtime_hours | numeric | YES | 0.00 | Number of overtime hours worked (automatically calculated) |
| total_hours | numeric | YES | 0.00 | Total hours worked including overtime |
| entry_location_accuracy | numeric | YES |  |  |
| entry_location_timestamp | timestamp with time zone | YES |  |  |
| entry_location_source | text | YES | 'gps'::text |  |
| lunch_start_location_accuracy | numeric | YES |  |  |
| lunch_start_location_timestamp | timestamp with time zone | YES |  |  |
| lunch_start_location_source | text | YES | 'gps'::text |  |
| lunch_end_location_accuracy | numeric | YES |  |  |
| lunch_end_location_timestamp | timestamp with time zone | YES |  |  |
| lunch_end_location_source | text | YES | 'gps'::text |  |
| exit_location_accuracy | numeric | YES |  |  |
| exit_location_timestamp | timestamp with time zone | YES |  |  |
| exit_location_source | text | YES | 'gps'::text |  |
| auto_shift_end_at | timestamp with time zone | YES |  | Calculated timestamp when 8h shift should end (entry_time + 8 hours) |
| auto_closed_at | timestamp with time zone | YES |  | Timestamp when system automatically closed the shift |
| overtime_start_at | timestamp with time zone | YES |  | Timestamp when overtime counting started (same as auto_shift_end_at) |
| latitude | numeric | YES |  |  |
| longitude | numeric | YES |  |  |
| accuracy | numeric | YES |  |  |
| location_address | text | YES |  |  |

- Indices visibles:
  - idx_attendance_date: CREATE INDEX idx_attendance_date ON public.user_attendance_records USING btree (date DESC)
  - idx_attendance_incomplete: CREATE INDEX idx_attendance_incomplete ON public.user_attendance_records USING btree (user_id, date) WHERE (exit_time IS NULL)
  - idx_attendance_user_date: CREATE INDEX idx_attendance_user_date ON public.user_attendance_records USING btree (user_id, date DESC)
  - idx_user_attendance_records_auto_closed_at: CREATE INDEX idx_user_attendance_records_auto_closed_at ON public.user_attendance_records USING btree (auto_closed_at)
  - idx_user_attendance_records_auto_shift_end_at: CREATE INDEX idx_user_attendance_records_auto_shift_end_at ON public.user_attendance_records USING btree (auto_shift_end_at)
  - unique_user_date: CREATE UNIQUE INDEX unique_user_date ON public.user_attendance_records USING btree (user_id, date)
  - user_attendance_records_pkey: CREATE UNIQUE INDEX user_attendance_records_pkey ON public.user_attendance_records USING btree (id)

### public.user_lopdp_consents
- Tipo de objeto: table.
- Modulos que la consumen: auth.
- Descripcion: Sin comentario de catalogo.
- Clave primaria: id
- Relaciones foraneas: no aplica o no visibles.

| Campo | Tipo | Nulo | Default | Comentario |
|---|---|---|---|---|
| id | integer | NO | nextval('user_lopdp_consents_id_seq'::regclass) |  |
| user_id | integer | YES |  |  |
| user_email | character varying | NO |  |  |
| status | character varying | NO |  |  |
| pdf_file_id | character varying | YES |  |  |
| signature_file_id | character varying | YES |  |  |
| ip | character varying | YES |  |  |
| user_agent | text | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |  |

- Indices visibles:
  - user_lopdp_consents_pkey: CREATE UNIQUE INDEX user_lopdp_consents_pkey ON public.user_lopdp_consents USING btree (id)

### public.user_profile
- Tipo de objeto: table.
- Modulos que la consumen: auth.
- Descripcion: Sin comentario de catalogo.
- Clave primaria: id
- Relaciones foraneas:
  - user_id -> public.users.id

| Campo | Tipo | Nulo | Default | Comentario |
|---|---|---|---|---|
| id | integer | NO | nextval('user_profile_id_seq'::regclass) |  |
| user_id | integer | NO |  |  |
| avatar_url | text | YES |  |  |
| avatar_drive_id | text | YES |  |  |
| metadata | jsonb | YES | '{}'::jsonb |  |
| preferences | jsonb | YES | '{}'::jsonb |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |

- Indices visibles:
  - idx_user_profile_user_id: CREATE INDEX idx_user_profile_user_id ON public.user_profile USING btree (user_id)
  - user_profile_pkey: CREATE UNIQUE INDEX user_profile_pkey ON public.user_profile USING btree (id)
  - user_profile_user_id_key: CREATE UNIQUE INDEX user_profile_user_id_key ON public.user_profile USING btree (user_id)

### public.user_sessions
- Tipo de objeto: table.
- Modulos que la consumen: auth.
- Descripcion: Sin comentario de catalogo.
- Clave primaria: id
- Relaciones foraneas: no aplica o no visibles.

| Campo | Tipo | Nulo | Default | Comentario |
|---|---|---|---|---|
| id | integer | NO | nextval('user_sessions_id_seq'::regclass) |  |
| user_email | character varying | NO |  |  |
| login_time | timestamp without time zone | YES | now() |  |
| logout_time | timestamp without time zone | YES |  |  |
| ip | character varying | YES |  |  |
| user_agent | text | YES |  |  |
| refresh_token | text | YES |  |  |

- Indices visibles:
  - user_sessions_pkey: CREATE UNIQUE INDEX user_sessions_pkey ON public.user_sessions USING btree (id)

### public.users
- Tipo de objeto: table.
- Modulos que la consumen: auth, approvals, audit-prep, management, signature.
- Descripcion: Sin comentario de catalogo.
- Clave primaria: id
- Relaciones foraneas:
  - department_id -> public.departments.id
  - department_id -> public.departments.id

| Campo | Tipo | Nulo | Default | Comentario |
|---|---|---|---|---|
| id | integer | NO | nextval('users_id_seq'::regclass) |  |
| google_id | text | YES |  |  |
| email | text | NO |  |  |
| name | text | YES |  |  |
| department_id | integer | YES |  |  |
| role | text | YES |  |  |
| created_at | timestamp without time zone | YES | now() |  |
| updated_at | timestamp without time zone | YES | now() |  |
| fullname | text | YES |  |  |
| lopdp_internal_status | character varying | NO | 'granted'::character varying |  |
| lopdp_internal_signed_at | timestamp without time zone | YES |  |  |
| lopdp_internal_pdf_file_id | character varying | YES |  |  |
| lopdp_internal_signature_file_id | character varying | YES |  |  |
| lopdp_internal_ip | character varying | YES |  |  |
| lopdp_internal_user_agent | text | YES |  |  |
| lopdp_internal_notes | text | YES |  |  |
| can_sign_documents | boolean | YES | false | Whether user has permission to sign documents |
| signature_role | character varying | YES |  | Role for signature authorization (DPD, Manager, etc.) |
| signature_certificate_id | character varying | YES |  | ID of digital certificate for qualified signatures |
| active | boolean | NO | true | Indica si el usuario está activo en el sistema. Los usuarios inactivos no pueden acceder. |

- Indices visibles:
  - idx_users_active: CREATE INDEX idx_users_active ON public.users USING btree (active)
  - users_email_key: CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email)
  - users_google_id_key: CREATE UNIQUE INDEX users_google_id_key ON public.users USING btree (google_id)
  - users_pkey: CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id)

## 5. Hallazgos de consistencia codigo vs base real
- `security` no tiene evidencia de tablas `security_offhours_whitelist` ni `security_jobs_log` en la base vigente; el codigo auxiliar que las referencia no esta alineado con Neon.
- `management.service.js` referencia `audit_logs` y `attachments`, pero en la base real existen `auditoria.logs` y `request_attachments`.
- `audit-prep.service.js` usa `users.nombre_completo`, pero en la base real `users` expone `name` y `fullname`.
- `signature.controller.js` inserta `consent_text` en `document_signatures_advanced`, pero esa columna no existe en la base real.
- `document_signatures_advanced` exige `signer_email NOT NULL`; el flujo backend de firma debe poblarlo desde el usuario autenticado.
- `requests.status` en Neon esta restringido a `pendiente`, `en_revision`, `aprobado`, `rechazado`, `cancelado`; cualquier codigo que espere estados en ingles queda desalineado.
- `auth/me` toca `user_attendance_records`; esa tabla es una dependencia transversal y no una entidad nuclear del area 01.

## 6. Conclusion
El area 01 dispone de un modelo de datos real suficiente para autenticacion, auditoria, preparacion de auditoria, aprobaciones, documentos y firma; sin embargo, persisten discrepancias relevantes entre codigo y base vigente en los modulos `security`, `management`, `audit-prep` y `signature`.