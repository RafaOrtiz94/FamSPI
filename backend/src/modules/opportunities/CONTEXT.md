# CONTEXT.md — opportunities

## 1. Descripción
Módulo comercial FamSheets. Gestiona oportunidades estratégicas, cuentas prospecto, contactos, influencias compradoras, banderas rojas, competidores, plan de acción, comentarios de coaching y vínculos opcionales con procesos existentes.

## 2. Endpoints

Prefijo canónico: `/api/v1/famsheets`

Alias legado soportado: `/api/v1/opportunities`

- `GET /accounts` — búsqueda de cuentas prospecto
- `POST /accounts` — creación rápida de cuenta
- `GET /contacts` — búsqueda de contactos por cuenta
- `POST /contacts` — creación rápida de contacto
- `GET /dashboard/manager` — agregados comerciales del módulo
- `GET /process-lookup/:type/:processId` — lookup de BC / compra privada / compra pública
- `GET /` — listado de hojas
- `POST /` — creación de hoja
- `GET /:id` — detalle completo de hoja
- `PUT /:id` — actualización de hoja
- `POST /:id/influences` — crear/actualizar influencia compradora
- `DELETE /:id/influences/:influenceId`
- `POST /:id/flags` — crear/actualizar bandera roja
- `DELETE /:id/flags/:flagId`
- `POST /:id/competitors` — crear/actualizar competidor
- `DELETE /:id/competitors/:competitorId`
- `POST /:id/actions` — crear/actualizar acción
- `DELETE /:id/actions/:actionId`
- `POST /:id/comments` — comentar / coaching
- `DELETE /:id/comments/:commentId`
- `POST /:id/links` — vincular expediente
- `DELETE /:id/links/:linkId`

## 3. Base de datos
- `accounts`
- `contacts`
- `opportunity`
- `opportunity_rating`
- `buying_influence`
- `opportunity_flag`
- `competitor`
- `bs_action_item`
- `opportunity_snapshot`
- `bs_comment`
- `opportunity_process_link`

## 4. Relaciones
- `users` — owner, auditoría, responsables
- `clients` — vínculo opcional de cuentas convertidas
- `bc_master` — vínculo opcional por `process_type=business_case`
- `private_purchase_requests` — vínculo opcional por `process_type=private_purchase`
- `equipment_purchase_requests` — vínculo opcional por `process_type=equipment_purchase`
- `notifications` — asignación de acciones y menciones

## 5. Frontend asociado
- `/dashboard/comercial/famsheets`
- `/dashboard/comercial/famsheets/dashboard`
- `/dashboard/comercial/famsheets/:id`

## 6. Riesgos detectados
- El módulo depende de tablas nuevas; si la migración 189 no está aplicada, todo el contrato falla.
- La vinculación polimórfica exige validar `process_type` y `process_id` contra tablas reales.
- No existe todavía RLS; la visibilidad depende de RBAC y filtros por owner/rol.
