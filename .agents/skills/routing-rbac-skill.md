# skill: routing-rbac

## Proposito
Controlar rutas protegidas y coherencia de roles entre backend y frontend.

## Evidencia en codigo
- Backend RBAC: `backend/src/middlewares/roles.js`
- Public paths: `backend/src/routes/publicPaths.js`
- Router API: `backend/src/routes/registerRoutes.js`
- Router UI por rol: `spi_front/src/routes/AppRoutes.jsx`

## Alcance exacto
- `backend/src/middlewares/roles.js`
- `backend/src/routes/publicPaths.js`
- `spi_front/src/routes/AppRoutes.jsx`

## Activar cuando
- Hay 403 por `requireRole`.
- Se agrega/ajusta rol permitido en ruta protegida.
- Se requiere abrir/cerrar una ruta publica JWT.

## No usar cuando
- El problema es token/login/refresh (`auth-skill.md`).
- El problema es logica de negocio de un modulo.

## Maximo de archivos por tarea
- 3 archivos.

## Verificacion minima
```bash
cd backend && npm run lint src/middlewares/roles.js src/routes/publicPaths.js
cd spi_front && npm run lint src/routes/AppRoutes.jsx
```

## Stop condition
- Si requiere editar >3 grupos de roles o >5 rutas en una sola tarea, dividir.

## Handoff
- Auth token/session -> `.agents/skills/auth-skill.md`
