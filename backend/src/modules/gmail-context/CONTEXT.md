# gmail-context

## Descripcion

Registro idempotente de comunicaciones abiertas desde Gmail Workspace. No crea
clientes ni procesos; mantiene una comunicacion pendiente hasta que su creador
o un rol administrativo existente la vincula manualmente a un proceso.

## Endpoints

Prefijo: `/api/v1/gmail-context`, todos con `verifyToken`.

- `POST /communications`: registra metadatos del correo sin adjuntos binarios.
- `GET /communications`: lista propias comunicaciones; administradores existentes
  pueden consultar todas.
- `GET /search/clients`: reutiliza el scoping real de `clients`.
- `GET /search/processes`: consulta procesos admitidos por `process-notes`.
- `POST /communications/:id/link`: escribe una nota de correo entrante
  append-only en el proceso y evita duplicados por `source_communication_id`.

## Base de datos

- `gmail_context_communications`: migracion `295_gmail_context_communications.sql`.
- `process_notes.source_communication_id`: referencia idempotente al origen.

No se aceptan adjuntos en esta primera capa: el almacenamiento seguro se
implementa por separado y no reutiliza enlaces publicos de Drive.

## Canal Add-on

El mismo contrato se expone bajo `/api/v1/gmail-context/addon`, pero no usa el
JWT de navegador. Valida un ID token Google contra el audience exacto definido
en `GMAIL_CONTEXT_ADDON_AUDIENCE`, resuelve un usuario SPI activo por correo y
solo entonces ejecuta el servicio. Si el audience no esta configurado, responde
`503 GMAIL_CONTEXT_ADDON_NOT_CONFIGURED` y no acepta datos.
