# skill: files-documents

## Proposito
Gestionar archivos, Google Drive y documentos plantillados/firmables.

## Evidencia en codigo
- `backend/src/modules/files/file.service.js`
- `backend/src/modules/documents/document.service.js`
- `backend/src/utils/drive.js`

## Alcance exacto
- `backend/src/modules/files/*.js`
- `backend/src/modules/documents/*.js`
- `backend/src/utils/drive.js`

## Activar cuando
- Falla upload/download/delete de archivos.
- Falla creacion de documento desde template o export PDF.
- Falla insercion de firma en tag del documento.

## No usar cuando
- Cambio principal es firma/token de verificacion publica (`signature-skill.md`).
- Cambio principal es permisos de negocio del modulo origen.

## Maximo de archivos por tarea
- 3 archivos.

## Verificacion minima
```bash
cd backend && npm run lint src/modules/files/ src/modules/documents/ src/utils/drive.js
```

## Stop condition
- Si requiere tocar archivos + firma + modulo de negocio en una sola tarea, dividir.

## Handoff
- Firma digital -> `.agents/skills/signature-skill.md`
