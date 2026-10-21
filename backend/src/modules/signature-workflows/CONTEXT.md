# CONTEXT.md - signature-workflows

## 1. Descripción

Motor transversal de workflow de firma documental interna.

Gestiona:

- creación de procesos de firma
- snapshot del documento PDF
- múltiples firmantes
- orden de firma
- auditoría de eventos
- verificación por token

## 2. Endpoints

Prefijo de montaje:

- `/api/v1/signature-workflows`

Rutas públicas:

- `GET /api/v1/signature-workflows/verify/:token`
- `GET /api/v1/signature-workflows/verify/:token/json`

Rutas autenticadas:

- `GET /api/v1/signature-workflows/me/pending`
- `GET /api/v1/signature-workflows/me/completed`
- `GET /api/v1/signature-workflows`
- `POST /api/v1/signature-workflows`
- `GET /api/v1/signature-workflows/:id`
- `POST /api/v1/signature-workflows/:id/send`
- `GET /api/v1/signature-workflows/:id/documents/:documentId/pdf`
- `GET /api/v1/signature-workflows/:id/documents/:documentId/final-pdf`
- `POST /api/v1/signature-workflows/:id/signers/:signerId/open`
- `POST /api/v1/signature-workflows/:id/signers/:signerId/sign`
- `POST /api/v1/signature-workflows/:id/signers/:signerId/reject`

## 3. Flujo principal

1. Un módulo origen crea el documento PDF.
2. El módulo crea el workflow con snapshot del PDF y firmantes.
3. El workflow se envía.
4. El primer firmante queda disponible.
5. Cada firmante abre y firma o rechaza.
6. Si todos firman, el workflow se completa.
7. El documento queda verificable por token.

## 4. Base de datos

Tablas base del módulo:

- `signature_workflows`
- `signature_workflow_documents`
- `signature_workflow_signers`
- `signature_workflow_events`
- `signature_workflow_notifications`
- `signature_workflow_artifacts`

## 5. Relaciones

- `collab_delivery_actas`
- `ti_asset_actas`
- `documents`
- `signature`

## 6. Notas técnicas

- El almacenamiento del PDF en esta primera fase se hace inline en DB como base64 para habilitar el flujo end-to-end sin depender aún de un storage definitivo.
- La generación de PDF final visible con bloque gráfico de firmas queda para la siguiente iteración técnica.
