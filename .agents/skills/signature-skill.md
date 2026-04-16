# skill: signature

## Proposito
Resolver firma digital y verificacion publica de documentos firmados.

## Alcance exacto
- `backend/src/modules/signature/signature.controller.js`
- `backend/src/modules/signature/signature.v1.routes.js`
- `backend/src/services/signatures/*`
- `spi_front/src/modules/signature/components/DocumentSigner.jsx`
- `spi_front/src/modules/signature/pages/DocumentVerification.jsx`

## Activar cuando
- Falla proceso de firma o verificacion de token.
- Falla hash/sello del documento firmado.

## No usar cuando
- El documento base se genera mal en `documents` o modulo origen.

## Maximo de archivos por tarea
- 3 archivos.

## Verificacion minima
```bash
cd backend && npm run lint src/modules/signature/
```

## Stop condition
- Si involucra firma + generacion base de documento + permisos de flujo, dividir.

## Handoff
- Documentos/Drive -> `.agents/skills/files-documents-skill.md`
