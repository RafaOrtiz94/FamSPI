# skill: audit-security

## Proposito
Cambios de auditoria automatica y seguridad operacional TI.

## Evidencia en codigo
- `backend/src/middlewares/auditMiddleware.js`
- `backend/src/modules/security/security.routes.js`
- `backend/src/modules/audit-prep/auditPrep.service.js`

## Alcance exacto
- `backend/src/middlewares/auditMiddleware.js`
- `backend/src/modules/security/security.routes.js`
- `backend/src/modules/audit-prep/*.js`

## Activar cuando
- Falla registro de auditoria en escrituras.
- Ajustes de endpoints de seguridad TI (offhours logins).
- Ajustes de auditoria preventiva (`audit-prep`).

## No usar cuando
- Cambio es auth JWT/login.
- Cambio es reporteria UI sin tocar backend de auditoria.

## Maximo de archivos por tarea
- 3 archivos.

## Verificacion minima
```bash
cd backend && npm run lint src/middlewares/auditMiddleware.js src/modules/security/ src/modules/audit-prep/
```

## Stop condition
- Si requiere tocar `app.js` y middlewares globales adicionales, detener y dividir.

## Handoff
- Auth -> `.agents/skills/auth-skill.md`
- Frontend reportes -> `.agents/skills/frontend-skill.md`
