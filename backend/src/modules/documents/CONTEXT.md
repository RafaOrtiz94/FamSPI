# CONTEXT.md — documents

## 1. Descripción
Módulo de gestión de documentos genéricos (no específicos de módulo). Provee CRUD básico de documentos del sistema.

## 2. Endpoints

- No verificado en código de rutas (documents.routes.js tiene 1139 bytes — no se leyó el contenido)

## 3. Flujo principal
- No verificado en código

## 4. Validaciones
- No verificado en código

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `files`: módulo complementario para almacenamiento físico de archivos
- `requests`: solicitudes pueden tener documentos adjuntos

## 7. Frontend asociado
- `/documents` → `DocumentsPage`

## 8. Riesgos detectados
- No se leyó el contenido de `documents.routes.js` — documentar al acceder

## 9. Notas técnicas
- `document.service.js` (11KB) contiene lógica principal
- Diferente de `files` (que gestiona almacenamiento físico en Drive/disco)
