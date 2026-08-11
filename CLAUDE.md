# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (`/backend`)
```bash
npm run dev          # nodemon + node --max-http-header-size=16384
npm start            # producción
npm test             # jest
npm run lint         # eslint --fix
```

### Frontend (`/spi_front`)
```bash
npm start            # CRA dev server
npm run build        # producción
npm test             # react-scripts test
npm run lint         # eslint src/
```

### Single test (backend)
```bash
npx jest path/to/test.file.js --testNamePattern="nombre del test"
```

## Architecture

### Stack
- **Backend**: Express 5 + PostgreSQL (`pg` pool) + JWT (RS256-ish, `spi-fam-backend` iss / `spi-fam-frontend` aud)
- **Frontend**: React 19 + React Router 7 + TanStack Query + Tailwind 3 + Bootstrap 5
- **Auth**: Google OAuth2 → JWT en headers (`Authorization: Bearer` + `x-refresh-token`). Sin cookies.
- **DB**: Neon (PostgreSQL serverless en cloud). Contraseña via **gcloud Secret Manager** (`DB_PASSWORD`, proyecto `famspi-sbox`). Nunca `.env` local en prod.
- **Storage**: Google Drive (gestionado por `driveClientManager.js`)
- **Deploy**: Google Cloud Run. Jobs internos opcionales por instancia (`JOBS_RUNNER_INSTANCE=true`).

### Request lifecycle (backend)
```
verifyToken → normalizeApiPayloads → moduleAccessGuard → auditMiddleware → route handler
```
- `verifyToken` (`middlewares/auth.js`): valida JWT y expone `req.user`
- `requireRole([ ... ])` (`middlewares/roles.js`): acepta roles individuales o grupos del `ROLE_GROUPS` map. Admin/administrador bypasean todo.
- `moduleAccessGuard` (`middlewares/moduleAccess.js`): verifica acceso de usuario al módulo por `x-app-path` header
- `auditMiddleware`: registra POST/PUT/PATCH/DELETE en `auditoria.logs` automáticamente

### RBAC
`ROLE_GROUPS` en `backend/src/middlewares/roles.js` define alias de grupos. `requireRole(['tecnico'])` expande a todos los roles del grupo. `ext_users: ["ing_servicio_ext", "esp_app_ext"]` — grupo para usuarios externos (definido pero no aplicado en rutas todavía).

### Module structure (backend)
Cada módulo en `backend/src/modules/<nombre>/`:
- `<nombre>.routes.js` — Express router
- `<nombre>.controller.js` — thin controllers (llaman al service)
- `<nombre>.service.js` — lógica de negocio + queries SQL raw
- `CONTEXT.md` — documentación del módulo (endpoints, flujo, riesgos)

Las rutas se montan en `backend/src/routes/registerRoutes.js` vía `mountPrivateRoutes`. Las rutas públicas van en `mountPublicRoutes`.

### Migrations
Archivos SQL numerados en `backend/migrations/`. No hay runner automático; se aplican manualmente. La numeración no es estrictamente secuencial (duplicados de número existen). El último número visible es ~226.

### Frontend structure
```
spi_front/src/
  core/
    auth/           # AuthContext, ProtectedRoute, moduleAccess
    ui/             # layouts, NavigationBar, componentes compartidos
    api/            # funciones de fetch por módulo
  modules/
    <rol>/pages/    # páginas por área funcional
    shared/         # páginas y componentes cross-rol
    ext-users/      # dashboard usuarios externos (ing_servicio_ext / esp_app_ext)
  routes/
    AppRoutes.jsx   # todas las rutas con lazy loading
```

**ProtectedRoute** (`core/auth/ProtectedRoute.jsx`): acepta `allowedRoles[]` y flag `strictRoles`. Sin `strictRoles`, `gerencia` bypasea. Con `strictRoles`, solo los roles explícitos acceden.

**NavigationBar** (`core/ui/components/NavigationBar.jsx`): construye el menú según `scope` del usuario. Externos (`ing_servicio_ext` / `esp_app_ext`) reciben solo `capacitacionesLink + permisosLink`.

**moduleAccess** (frontend): `isPathEnabledForUser` verifica contra `user.module_access[]` del JWT antes de renderizar.

### Background jobs
Schedulers en `backend/src/jobs/`. Solo corren si `ENABLE_JOBS=true` y `IS_JOBS_RUNNER_INSTANCE=true`. Cada job tiene su propio scheduler file con `node-cron`.

### Shared services (transversales)
- `signature-workflows`: motor de firma documental multi-firmante. Usado por permisos, vacaciones, ti-assets, collab-deliveries.
- `notifications`: sistema de notificaciones internas.
- `files` + Drive: almacenamiento de documentos en Google Drive.
- `permisos.service.js` (161 KB) y `vacaciones.service.js` (52 KB) — archivos grandes, tener cuidado al modificar.
