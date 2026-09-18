# FAMSIGN_WORKFLOW_BLUEPRINT.md

## 1. Propósito

Definir el blueprint técnico de Fase 1 para construir un motor transversal de workflow de firma documental interna en FamSPI.

Este documento aterriza:

- modelo de datos
- estados
- contratos API
- RBAC
- servicios backend
- integración con módulos origen
- integración frontend
- estrategia de convivencia con lo existente

No implementa todavía.

## 2. Base verificada

### 2.1 Módulo de firma actual

Archivos verificados:

- `backend/src/modules/signature/signature.routes.js`
- `backend/src/modules/signature/signature.v1.routes.js`
- `backend/src/modules/signature/signature.controller.js`
- `backend/src/services/signatures/advancedSignature.service.js`
- `backend/src/services/signatures/digitalSeal.service.js`
- `backend/src/services/signatures/verification.service.js`
- `backend/src/services/signatures/immutableSignatureLogger.service.js`

### 2.2 Módulos origen verificados

- `backend/src/modules/collab-deliveries/collabDeliveries.service.js`
- `backend/src/modules/collab-deliveries/collabDeliveries.routes.js`
- `backend/src/modules/collab-deliveries/collabDeliveries.acta.js`
- `backend/src/modules/ti-assets/tiAssets.service.js`
- `backend/src/modules/ti-assets/tiAssets.routes.js`
- `backend/src/modules/permisos/permisos.service.js`
- `backend/src/modules/documents/document.service.js`

### 2.3 Frontend verificado

- `spi_front/src/modules/signature/components/DocumentSigner.jsx`
- `spi_front/src/modules/signature/pages/SignatureDashboard.jsx`
- `spi_front/src/modules/signature/pages/DocumentVerification.jsx`
- `spi_front/src/routes/AppRoutes.jsx`

### 2.4 DB verificada

Objetos verificados:

- `documents`
- `document_hashes`
- `document_signatures_advanced`
- `document_signature_logs`
- `document_seals`
- `document_qr_codes`
- `permisos_vacaciones`
- `permisos_vacaciones_firmas`
- `collab_delivery_actas`
- `collab_delivery_actas_items`
- `ti_asset_actas`
- `ti_asset_actas_items`
- `document_verification_info`
- `create_document_seal_and_qr`
- `track_qr_access`

## 3. Problema técnico actual

FamSPI tiene mecanismos de firma, pero no un motor transversal multi-firmante.

### 3.1 Gaps verificados

1. `collab_delivery_actas` solo modela firma final simple:
   - `signed_by`
   - `signed_at`
   - `signed_pdf_*`
   - `is_complete`

2. `ti_asset_actas` tiene el mismo patrón simple.

3. `signature.controller.js` maneja firma genérica, pero no modela varios firmantes por documento.

4. `permisos_vacaciones_firmas` sí modela una secuencia de firmas, pero está acoplado al módulo de permisos.

5. El frontend actual de firma no es una bandeja transversal tipo DocuSign.

## 4. Objetivo técnico exacto

Construir un motor de workflow de firma que permita:

- congelar un PDF base
- registrar varios firmantes
- controlar orden y disponibilidad de firma
- firmar dentro de la app
- rechazar dentro de la app
- generar PDF final con representación visible de firmas
- emitir artefacto verificable
- registrar auditoría hash-chain
- integrarse con módulos origen sin duplicar lógica de firma en cada uno

## 5. Principios de arquitectura

1. El documento nace en el módulo origen.
2. El workflow de firma es transversal y desacoplado del origen.
3. El documento a firmar debe versionarse.
4. La evidencia técnica prevalece sobre la firma visual.
5. La firma visual puede mantenerse como representación visible complementaria.
6. Drive es accesorio, no fuente de verdad del workflow.
7. Todo evento relevante debe ser append-only.
8. Ningún módulo origen debe persistir su propia lógica multi-firmante si ya existe el motor transversal.

## 6. Decisiones de diseño

### 6.1 Nombre técnico del módulo

Nombre backend propuesto:

- `signature-workflows`

Razón:

- expresa workflow, no solo firma
- no colisiona con el módulo `signature` actual
- mantiene el lenguaje del proyecto

### 6.2 Prefijo API

Prefijo propuesto:

- `/api/v1/signature-workflows`

Razón:

- sigue el patrón del proyecto
- evita repetir el legado `/api/signature`

### 6.3 Nombre de la capa frontend

Nombre propuesto:

- `Signatures Workspace`

Rutas frontend propuestas:

- `/dashboard/signatures/inbox`
- `/dashboard/signatures/created`
- `/dashboard/signatures/completed`
- `/dashboard/signatures/:workflowId`

## 7. Modelo de datos definitivo propuesto

Los nombres son propuestos para migración nueva. Deben crearse como tablas nuevas, no reutilizar de forma ambigua las tablas actuales de actas.

### 7.1 Tabla `signature_workflows`

Propósito:

- cabecera del proceso de firma

Campos:

- `id BIGSERIAL PRIMARY KEY`
- `workflow_code TEXT NOT NULL UNIQUE`
- `source_module TEXT NOT NULL`
- `source_entity TEXT NOT NULL`
- `source_entity_id BIGINT NOT NULL`
- `document_type TEXT NOT NULL`
- `title TEXT`
- `description TEXT`
- `status TEXT NOT NULL`
- `created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `prepared_at TIMESTAMPTZ`
- `sent_at TIMESTAMPTZ`
- `completed_at TIMESTAMPTZ`
- `rejected_at TIMESTAMPTZ`
- `cancelled_at TIMESTAMPTZ`
- `expired_at TIMESTAMPTZ`
- `invalidated_at TIMESTAMPTZ`
- `current_step INTEGER`
- `verification_token TEXT UNIQUE`
- `active BOOLEAN NOT NULL DEFAULT true`
- `meta JSONB NOT NULL DEFAULT '{}'::jsonb`

Índices:

- `idx_signature_workflows_source`
- `idx_signature_workflows_status`
- `idx_signature_workflows_created_by`
- `idx_signature_workflows_created_at`

### 7.2 Tabla `signature_workflow_documents`

Propósito:

- versionado y snapshot del PDF que se firma

Campos:

- `id BIGSERIAL PRIMARY KEY`
- `workflow_id BIGINT NOT NULL REFERENCES public.signature_workflows(id) ON DELETE CASCADE`
- `version_num INTEGER NOT NULL`
- `filename TEXT NOT NULL`
- `mime_type TEXT NOT NULL DEFAULT 'application/pdf'`
- `source_sha256 TEXT NOT NULL`
- `source_storage_ref TEXT`
- `source_drive_url TEXT`
- `source_drive_file_id TEXT`
- `final_sha256 TEXT`
- `final_storage_ref TEXT`
- `final_drive_url TEXT`
- `final_drive_file_id TEXT`
- `qr_token TEXT`
- `qr_drive_url TEXT`
- `is_current BOOLEAN NOT NULL DEFAULT true`
- `is_frozen BOOLEAN NOT NULL DEFAULT false`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `finalized_at TIMESTAMPTZ`

Restricciones:

- `UNIQUE (workflow_id, version_num)`

Índices:

- `idx_signature_workflow_documents_workflow`
- `idx_signature_workflow_documents_current`

### 7.3 Tabla `signature_workflow_signers`

Propósito:

- participantes del workflow

Campos:

- `id BIGSERIAL PRIMARY KEY`
- `workflow_id BIGINT NOT NULL REFERENCES public.signature_workflows(id) ON DELETE CASCADE`
- `document_id BIGINT NOT NULL REFERENCES public.signature_workflow_documents(id) ON DELETE CASCADE`
- `user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL`
- `email_snapshot TEXT NOT NULL`
- `name_snapshot TEXT NOT NULL`
- `role_snapshot TEXT`
- `signer_kind TEXT NOT NULL DEFAULT 'internal_user'`
- `sequence_order INTEGER NOT NULL`
- `is_required BOOLEAN NOT NULL DEFAULT true`
- `status TEXT NOT NULL`
- `access_token TEXT UNIQUE`
- `access_token_expires_at TIMESTAMPTZ`
- `available_at TIMESTAMPTZ`
- `opened_at TIMESTAMPTZ`
- `signed_at TIMESTAMPTZ`
- `rejected_at TIMESTAMPTZ`
- `expired_at TIMESTAMPTZ`
- `replaced_at TIMESTAMPTZ`
- `session_id TEXT`
- `ip_address TEXT`
- `user_agent TEXT`
- `consent_text TEXT`
- `payload_hash_sha256 TEXT`
- `previous_signature_hash_sha256 TEXT`
- `signature_hash_sha256 TEXT`
- `signature_visual_ref TEXT`
- `rejection_reason TEXT`
- `meta JSONB NOT NULL DEFAULT '{}'::jsonb`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

Restricciones:

- `UNIQUE (workflow_id, sequence_order, user_id)` solo si el diseño final mantiene un usuario por paso

Índices:

- `idx_signature_workflow_signers_workflow`
- `idx_signature_workflow_signers_user`
- `idx_signature_workflow_signers_status`
- `idx_signature_workflow_signers_available_at`

### 7.4 Tabla `signature_workflow_events`

Propósito:

- auditoría inmutable

Campos:

- `id BIGSERIAL PRIMARY KEY`
- `workflow_id BIGINT NOT NULL REFERENCES public.signature_workflows(id) ON DELETE CASCADE`
- `document_id BIGINT REFERENCES public.signature_workflow_documents(id) ON DELETE SET NULL`
- `signer_id BIGINT REFERENCES public.signature_workflow_signers(id) ON DELETE SET NULL`
- `event_type TEXT NOT NULL`
- `event_description TEXT`
- `event_data JSONB NOT NULL DEFAULT '{}'::jsonb`
- `event_hash TEXT NOT NULL`
- `previous_event_hash TEXT`
- `created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

Índices:

- `idx_signature_workflow_events_workflow`
- `idx_signature_workflow_events_created_at`

### 7.5 Tabla `signature_workflow_notifications`

Propósito:

- control de notificaciones e idempotencia

Campos:

- `id BIGSERIAL PRIMARY KEY`
- `workflow_id BIGINT NOT NULL REFERENCES public.signature_workflows(id) ON DELETE CASCADE`
- `signer_id BIGINT REFERENCES public.signature_workflow_signers(id) ON DELETE CASCADE`
- `notification_type TEXT NOT NULL`
- `dedupe_key TEXT NOT NULL`
- `status TEXT NOT NULL`
- `sent_at TIMESTAMPTZ`
- `error_message TEXT`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

Restricciones:

- `UNIQUE (dedupe_key)`

### 7.6 Tabla `signature_workflow_artifacts`

Propósito:

- referencia explícita a artefactos del proceso

Campos:

- `id BIGSERIAL PRIMARY KEY`
- `workflow_id BIGINT NOT NULL REFERENCES public.signature_workflows(id) ON DELETE CASCADE`
- `document_id BIGINT REFERENCES public.signature_workflow_documents(id) ON DELETE CASCADE`
- `artifact_type TEXT NOT NULL`
- `filename TEXT`
- `sha256 TEXT`
- `storage_ref TEXT`
- `drive_url TEXT`
- `drive_file_id TEXT`
- `created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

## 8. Estados definitivos propuestos

### 8.1 Estados del workflow

- `draft`
- `prepared`
- `sent`
- `in_progress`
- `partially_signed`
- `completed`
- `rejected`
- `cancelled`
- `expired`
- `invalidated`

### 8.2 Estados del firmante

- `pending`
- `available`
- `opened`
- `signed`
- `rejected`
- `expired`
- `skipped`
- `replaced`

### 8.3 Estados del documento

- `draft`
- `frozen`
- `signed_partial`
- `signed_final`
- `invalidated`

## 9. Máquina de transiciones

### 9.1 Workflow

- `draft -> prepared`
- `prepared -> sent`
- `sent -> in_progress`
- `in_progress -> partially_signed`
- `in_progress -> completed`
- `partially_signed -> completed`
- `sent -> rejected`
- `in_progress -> rejected`
- `sent -> cancelled`
- `in_progress -> cancelled`
- `sent -> expired`
- `in_progress -> expired`
- `prepared -> invalidated`
- `sent -> invalidated` solo si se genera nueva versión y se reinicia proceso

### 9.2 Firmante

- `pending -> available`
- `available -> opened`
- `opened -> signed`
- `available -> signed`
- `opened -> rejected`
- `available -> rejected`
- `pending -> replaced`
- `available -> replaced`
- `pending -> expired`
- `available -> expired`

## 10. Reglas de negocio del motor

### 10.1 Regla de snapshot

No se inicia firma si el PDF base no ha sido congelado.

### 10.2 Regla de integridad

Toda firma debe calcular:

- `payload_hash_sha256`
- `signature_hash_sha256`
- referencia al hash previo del firmante en el workflow si aplica

### 10.3 Regla de secuencia

Un firmante no puede firmar si su estado no es `available`.

### 10.4 Regla de mutabilidad

Si el documento cambia después del envío:

- la versión actual se invalida
- se crea nueva versión
- debe reiniciarse el proceso

### 10.5 Regla de rechazo

Si un firmante obligatorio rechaza:

- el workflow pasa a `rejected`
- ningún siguiente firmante puede firmar

### 10.6 Regla de completado

El workflow solo pasa a `completed` cuando todas las firmas obligatorias del documento vigente estén en `signed`.

## 11. Contratos API definitivos propuestos

Todos los endpoints nuevos deben conservar contrato JSON consistente con el proyecto:

- `{ ok: true|false }`

### 11.1 Workflow backend

#### `POST /api/v1/signature-workflows`

Uso:

- crear workflow desde origen o manualmente

Payload:

- `source_module`
- `source_entity`
- `source_entity_id`
- `document_type`
- `title`
- `description`
- `document`
- `signers`
- `meta`

`document`:

- `filename`
- `pdf_base64`
- `source_sha256` opcional si ya viene calculado

`signers[]`:

- `user_id`
- `email`
- `name`
- `role`
- `sequence_order`
- `is_required`

Respuesta:

- `ok`
- `workflow`
- `document`
- `signers`

#### `POST /api/v1/signature-workflows/:id/send`

Uso:

- activar workflow preparado

#### `POST /api/v1/signature-workflows/:id/cancel`

Payload:

- `reason`

#### `GET /api/v1/signature-workflows/:id`

Uso:

- detalle completo

#### `GET /api/v1/signature-workflows`

Filtros:

- `status`
- `source_module`
- `created_by`
- `page`
- `limit`

#### `GET /api/v1/signature-workflows/:id/events`

Uso:

- timeline del proceso

### 11.2 Endpoints del firmante

#### `GET /api/v1/signature-workflows/me/pending`

#### `GET /api/v1/signature-workflows/me/completed`

#### `POST /api/v1/signature-workflows/:id/signers/:signerId/open`

Uso:

- registrar apertura del documento

#### `POST /api/v1/signature-workflows/:id/signers/:signerId/sign`

Payload:

- `consent`
- `consent_text`
- `session_id`
- `signature_visual_base64` opcional

#### `POST /api/v1/signature-workflows/:id/signers/:signerId/reject`

Payload:

- `reason`

### 11.3 Artefactos

#### `GET /api/v1/signature-workflows/:id/documents/:documentId/pdf`

Uso:

- descarga del snapshot base

#### `GET /api/v1/signature-workflows/:id/documents/:documentId/final-pdf`

Uso:

- descarga del documento final

### 11.4 Verificación

#### `GET /api/v1/signature-workflows/verify/:token`

Uso:

- página HTML o respuesta renderizada

#### `GET /api/v1/signature-workflows/verify/:token/json`

Uso:

- verificación JSON

## 12. RBAC definitivo propuesto

RBAC debe alinearse al middleware real `backend/src/middlewares/roles.js`.

### 12.1 Acceso al workspace

Grupo permitido:

- cualquier usuario autenticado

Razón:

- el módulo debe estar accesible, pero la data visible depende de participación o permisos administrativos

### 12.2 Permisos por acción

#### Crear workflow

Permitidos:

- el módulo origen decide

Ejemplos:

- `collab-deliveries`: roles que ya pueden generar actas del caso correspondiente
- `ti-assets`: roles que ya pueden gestionar actas TI
- `documents`: roles que hoy pueden firmar o generar documento

#### Ver workflow

Permitidos:

- creador
- firmantes del workflow
- roles administradores del módulo origen
- `admin`
- `administrador`

#### Firmar

Permitidos:

- solo firmante activo asociado al paso disponible

#### Rechazar

Permitidos:

- solo firmante activo asociado al paso disponible

#### Recordar

Permitidos:

- creador del workflow
- roles administradores del módulo origen
- `admin`
- `administrador`

#### Cancelar

Permitidos:

- creador mientras no esté completado
- administrador del módulo origen
- `admin`
- `administrador`

## 13. Servicios backend propuestos

### 13.1 `signatureWorkflows.service.js`

Responsable de:

- crear workflow
- validar transiciones
- orquestar firmado
- completar documento
- invalidar versión

### 13.2 `signatureWorkflows.repository.js`

Responsable de:

- acceso DB
- queries
- transacciones

### 13.3 `signatureWorkflows.validation.js`

Responsable de:

- payloads
- reglas estructurales

### 13.4 `signatureWorkflows.audit.js`

Responsable de:

- append-only events
- `event_hash`
- `previous_event_hash`

### 13.5 `signatureWorkflows.pdf.js`

Responsable de:

- congelar snapshot
- insertar bloque visual de firmas
- generar PDF final
- QR

### 13.6 `signatureWorkflows.notifications.js`

Responsable de:

- recordatorios
- envío inicial
- dedupe

### 13.7 `signatureWorkflows.verification.js`

Responsable de:

- endpoint público/interno de verificación
- payload de validación

## 14. Reutilización de servicios existentes

### 14.1 Reusar

Se debe evaluar reusar lógica de:

- hash de documento
- generación de sello
- QR
- verificación
- logger inmutable

Servicios con mayor probabilidad de reutilización parcial:

- `advancedSignature.service.js`
- `digitalSeal.service.js`
- `verification.service.js`
- `immutableSignatureLogger.service.js`

### 14.2 No reusar directamente sin adaptación

- `signature.controller.js`

Razón:

- hoy mezcla firma simple con rutas y respuestas legacy

## 15. Integración definitiva con `collab-deliveries`

### 15.1 Primer caso de uso oficial

Documento:

- acta de entrega de herramienta

Origen:

- `collab_delivery_actas`

Firmantes del MVP:

- `gerencia_general`
- `talento_humano`
- colaborador receptor

### 15.2 Estrategia técnica

1. `collab-deliveries` sigue generando el PDF base.
2. Ese PDF se entrega al motor como snapshot.
3. El motor crea workflow.
4. El origen guarda la referencia `signature_workflow_id`.
5. El origen consulta el estado al renderizar.
6. Al completarse, el motor devuelve artefacto final y token de verificación.

### 15.3 Columnas nuevas propuestas en `collab_delivery_actas`

- `signature_workflow_id BIGINT`
- `signature_workflow_status TEXT`
- `final_verification_token TEXT`
- `final_pdf_generated_at TIMESTAMPTZ`

### 15.4 Endpoint origen propuesto

- `POST /api/v1/collab-deliveries/actas/:actaId/start-signature-workflow`
- `GET /api/v1/collab-deliveries/actas/:actaId/signature-workflow`

## 16. Integración definitiva con `ti-assets`

### 16.1 Estrategia

No crear otro motor.

Usar el mismo adaptador conceptual:

- origen `ti_asset_actas`
- snapshot PDF TI
- workflow transversal

### 16.2 Columnas nuevas propuestas en `ti_asset_actas`

- `signature_workflow_id BIGINT`
- `signature_workflow_status TEXT`
- `final_verification_token TEXT`
- `final_pdf_generated_at TIMESTAMPTZ`

## 17. Frontend blueprint

### 17.1 Servicios API

Archivo nuevo sugerido:

- `spi_front/src/core/api/signatureWorkflowsApi.js`

### 17.2 Páginas nuevas sugeridas

- `SignatureInboxPage.jsx`
- `SignatureCreatedPage.jsx`
- `SignatureCompletedPage.jsx`
- `SignatureWorkflowDetailPage.jsx`

### 17.3 Componentes nuevos sugeridos

- `SignatureParticipantsCard.jsx`
- `SignatureTimeline.jsx`
- `SignatureActionPanel.jsx`
- `SignatureDocumentViewer.jsx`
- `SignatureRejectModal.jsx`

### 17.4 Reutilización parcial

Se puede rescatar de `DocumentSigner.jsx`:

- captura visual
- validación de consentimiento

Pero no debe mantenerse su acoplamiento actual al endpoint legacy de firma simple.

## 18. Convivencia con lo actual

### 18.1 Legacy que debe convivir temporalmente

- `signature.routes.js`
- `signature.v1.routes.js`
- `upload-signed` en `collab-deliveries`
- `upload-signed` en `ti-assets`
- `permisos_vacaciones_firmas`

### 18.2 Política de convivencia

1. El nuevo motor no reemplaza de inmediato todo.
2. Se activa por origen y por feature flag.
3. `permisos` no migra en la primera etapa.
4. `upload-signed` queda como contingencia temporal.

## 19. Validaciones mínimas del MVP

### 19.1 Backend

- crear workflow con 3 firmantes
- activar workflow
- firmar paso 1
- firmar paso 2
- firmar paso 3
- generar PDF final
- verificar token
- rechazar workflow
- cancelar workflow

### 19.2 Frontend

- bandeja de pendientes
- detalle del workflow
- acción de firmar
- acción de rechazar
- descarga de PDF final

### 19.3 Integración

- `collab-deliveries` puede iniciar el workflow
- `collab-deliveries` muestra el estado
- `collab-deliveries` recibe el cierre final

## 20. Secuencia de implementación recomendada

1. Crear migración inicial del motor.
2. Crear módulo backend nuevo.
3. Implementar creación y lectura de workflow.
4. Implementar firmado y rechazo.
5. Implementar PDF final y verificación.
6. Implementar bandeja frontend.
7. Integrar `collab-deliveries`.
8. Integrar `ti-assets`.

## 21. Cambios que no deben hacerse todavía

- No eliminar rutas legacy de `signature`.
- No migrar `permisos` al nuevo motor.
- No borrar `upload-signed` hasta completar cobertura de fase 4.
- No asumir firmantes externos.
- No alterar globalmente `publicPaths.js` más de lo necesario.

## 22. Estado del blueprint

Blueprint implementado al 2026-06-19.

### 22.1 Implementado

- Migración `210_signature_workflows_foundation.sql`: tablas `signature_workflows`, `signature_workflow_documents`, `signature_workflow_signers`, `signature_workflow_events`, `signature_workflow_notifications`, `signature_workflow_artifacts`. Columnas en `collab_delivery_actas` y `ti_asset_actas`.
- Motor backend: `backend/src/modules/signature-workflows/signatureWorkflows.service.js` con funciones: `createWorkflow`, `sendWorkflow`, `openSignerStep`, `signStep`, `rejectStep`, `cancelWorkflow`, `listWorkflows`, `getWorkflow`, `listMyPending`, `listMyCompleted`, `getDocumentPayload`, `verifyByToken`.
- Controller: `signatureWorkflows.controller.js` expone todos los handlers.
- Rutas: `POST /`, `GET /`, `GET /:id`, `POST /:id/send`, `POST /:id/cancel`, `POST /:id/signers/:signerId/open`, `POST /:id/signers/:signerId/sign`, `POST /:id/signers/:signerId/reject`, `GET /:id/documents/:documentId/pdf`, `GET /:id/documents/:documentId/final-pdf`, `GET /verify/:token`, `GET /verify/:token/json`, `GET /me/pending`, `GET /me/completed`.
- Frontend API: `spi_front/src/core/api/signatureWorkflowsApi.js` con todas las llamadas incluyendo `cancelSignatureWorkflow`.
- Frontend páginas: `SignatureDashboard.jsx` (bandejas inbox/created/completed/all), `SignatureWorkflowDetailPage.jsx` (firmar, rechazar, cancelar, descargar PDF), `SignatureWorkflowVerificationPage.jsx` (verificación pública).
- Rutas frontend: `/dashboard/signatures/inbox`, `/dashboard/signatures/created`, `/dashboard/signatures/completed`, `/dashboard/signatures/all`, `/dashboard/signatures/workflows/:workflowId`, `/verificar/famsign/:token`.
- Integración `collab-deliveries`: inicio de workflow desde acta, estado visible, botón PDF Firmado directo cuando `signature_workflow_status === completed`.
- Integración `ti-assets`: mismo patrón, tabla `TIActasPage` con estado y botón PDF Firmado directo.

### 22.2 Pendiente (fuera del MVP actual)

- Bloque visual de firmas en el PDF final (actualmente el PDF final = snapshot base, sin overlay visual).
- Recordatorios automáticos y expiración de workflows.
- Reasignación de firmante con política explícita.
- Firmantes opcionales.
