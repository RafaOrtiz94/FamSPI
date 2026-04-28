# CONTEXT.md — files

## 1. Descripción
Módulo de gestión de archivos genéricos asociados a solicitudes. Permite subir, listar, obtener metadatos, descargar y eliminar archivos. Los archivos se almacenan en disco (`/tmp`) y se sirven como stream.

## 2. Endpoints

Prefijo: `/api/v1/files`

- **POST /api/v1/files/upload/:requestId** — `uploadFiles` — verifyToken, requireRole(`tecnico`, `comercial`, `gerencia`), multer.array('files'), diskStorage(`/tmp`)
- **GET /api/v1/files/by-request/:requestId** — `listByRequest` — verifyToken, requireRole(`tecnico`, `comercial`, `gerencia`)
- **GET /api/v1/files/:fileId/metadata** — `getMetadata` — verifyToken
- **GET /api/v1/files/:fileId/download** — `downloadFile` — verifyToken (stream)
- **DELETE /api/v1/files/:fileId** — `deleteFile` — verifyToken, requireRole(`gerencia`, `admin`)

## 3. Flujo principal

1. Técnico/Comercial sube archivos vinculados a una solicitud
2. Se listan los archivos de una solicitud
3. Se descarga un archivo como stream
4. Gerencia o admin elimina archivos cuando es necesario

## 4. Validaciones
- `diskStorage` con destino `/tmp` — almacenamiento local temporal
- Eliminación solo por gerencia/admin

## 5. Base de datos
- No verificado en DB (probable tabla de metadatos de archivos)

## 6. Relaciones
- `requests`: archivos asociados a solicitudes
- `request-id` como identificador de agrupación de archivos

## 7. Frontend asociado
- No verificado en frontend (uso desde múltiples módulos)

## 8. Riesgos detectados
- **Crítico**: `diskStorage` en `/tmp` — archivos se pierden al reiniciar el servidor (Cloud Run/contenedores)
- Sin validación de tipo de archivo MIME en las rutas
- Sin límite de tamaño visible en la configuración de multer

## 9. Notas técnicas
- Diferente de archivos de Drive (user-profile, permisos) — este módulo usa disco local
- `file.service.js` (5KB): lógica de gestión de archivos
