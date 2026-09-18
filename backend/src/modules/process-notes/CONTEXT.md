# process-notes

## 1. Descripción

Sistema de notas append-only por proceso (Business Case, compra pública, compra privada). Cualquier usuario con acceso al proceso (mismos roles que ya validan sus módulos respectivos) puede dejar una nota o responder a una existente — nunca editarla ni borrarla, ni siquiera a nivel de base de datos (trigger `trg_process_notes_no_update`). Cada nota encadena su hash SHA-256 con la nota anterior del mismo hilo (mismo patrón que `signature-workflows`), permite mencionar (`@usuario`) a otros participantes, y registra quién la ha leído.

Las notificaciones (mención directa, respuesta a tu nota) se envían por el `notificationManager` ya existente con `source: "process_notes.mention"` / `"process_notes.reply"` — el registro de "a quién se le avisó" queda disponible en la tabla `notifications` estándar, no se duplica en una tabla propia.

También se puede enviar un correo (internos y/o externos, con adjuntos) desde el mismo hilo — queda registrado como una nota tipo `email` (`note_type`/`email_meta`). Cada adjunto se sube además a Drive (carpeta `Notas de proceso/<entityType>/<entityId>`) solo para poder abrirlo desde la nota (`email_meta.attachments[].drive_url`); si esa subida falla, el correo igual se entrega, solo el adjunto queda sin link para abrir después.

## 2. Modelo de datos

- `process_notes`: hilo append-only, `entity_type` (`business_case` | `public_purchase` | `private_purchase`) + `entity_id` identifican el proceso. `parent_note_id` para respuestas. `payload_hash_sha256` / `previous_note_hash_sha256` / `note_hash_sha256` para la cadena de integridad.
- `process_note_reads`: recibos de lectura (`note_id`, `user_id`, `read_at`).

## 3. Endpoints (montados en `/api/v1/process-notes`, todos requieren `verifyToken`)

- `GET /:entityType/:entityId` — lista el hilo completo (incluye quién leyó cada nota).
- `POST /:entityType/:entityId` — crea una nota (`body`, `parent_note_id?`, `mentioned_user_ids?`).
- `POST /:entityType/:entityId/:noteId/read` — marca una nota como leída por el usuario actual.
- `GET /:entityType/mention-candidates?entity_id=` — usuarios mencionables (mismo set de roles con acceso al proceso).

El control de acceso (lectura y escritura) se resuelve por rol, replicando los mismos grupos de rol que cada módulo origen (`equipment-purchases`, `private-purchases`, `business-case`) ya usa en sus propias rutas — ver `ENTITY_ROLES` en `processNotes.service.js`.

## 4. Frontend

`spi_front/src/core/ui/components/ProcessNotesFab.jsx` — botón flotante genérico y reutilizable, recibe `entityType`/`entityId`/`title`. Montado en `BusinessCaseWorkspace.jsx` (para el BC) y `PurchaseExpedienteDetail.jsx` (para el expediente de compra pública/privada downstream) — son hilos independientes por diseño, ya que un Business Case y su expediente de compra son entidades distintas vinculadas por `business_case_id`, no la misma fila.
