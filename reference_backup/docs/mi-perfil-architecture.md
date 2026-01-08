# Módulo "Mi Perfil" — Arquitectura y entregables

## 1. Arquitectura de alto nivel
- **Identidad vs Perfil**: la identidad sigue en el IdP/OAuth (tabla `users`), mientras que el perfil interno se aísla en la nueva tabla `user_profile` con metadatos y preferencias de UI.
- **API versionada**: nuevas rutas bajo `/api/v1/users/me/profile` sirven el perfil del usuario autenticado; sólo operan sobre `req.user.id` y aplican `verifyToken` + auditoría.
- **Carga de imagen segura**: subida en memoria con `multer` (2 MB máx) y whitelist de MIME (`png`, `jpeg`, `webp`); almacenamiento en Drive usando credenciales existentes y carpeta configurada (`DRIVE_PROFILE_PHOTOS_FOLDER_ID | DRIVE_PROFILE_FOLDER_ID | DRIVE_DOCS_FOLDER_ID`).
- **Auditoría y RBAC**: cada creación/actualización registra auditoría (`modulo: user-profile`) con antes/después; las rutas son privadas y respetan el flujo JWT/RBAC existente sin tocar autenticación/OAuth.
- **Front no invasivo**: página "Mi Perfil" consume las nuevas APIs, no modifica el login OAuth ni tablas de usuario; usa preferencia de tema sólo desde el perfil y mantiene la navegación existente.

## 2. Nuevo esquema de base de datos
- **Tabla `user_profile`**
  - `id SERIAL PRIMARY KEY`
  - `user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE`
  - `avatar_url TEXT`
  - `avatar_drive_id TEXT`
  - `metadata JSONB DEFAULT '{}'::jsonb` (campos internos: teléfono, extensión, cargo, ubicación, notas internas, etc.)
  - `preferences JSONB DEFAULT '{}'::jsonb` (tema, idioma, densidad, flags de notificación)
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ DEFAULT NOW()`

## 3. Endpoints REST (/api/v1/users/me/profile)
- `GET /` — devuelve `{ identity, profile }` para el usuario autenticado.
- `POST /` — crea el perfil si no existe; acepta `metadata`, `preferences` y `avatar` (multipart opcional).
- `PUT /` — actualiza metadatos/preferencias y reemplaza avatar de forma opcional; mergea claves permitidas y bloquea campos IdP (email, fullname, domain, oauth ids).
- Validaciones: MIME permitido, tamaño ≤ 2 MB, carpeta de Drive obligatoria; errores 400/500 informativos.

## 4. Frontend (estructura de componentes)
- Nuevo cliente API `core/api/userProfileApi.js` (fetch/update del perfil, soporta JSON o multipart).
- Página `modules/profile/MyProfilePage.jsx` dentro del layout existente; muestra identidad en solo lectura, formulario de metadatos internos, preferencias de UI y carga/previa de avatar.
- Navegación: enlace "Mi Perfil" añadido a la barra principal; el encabezado sigue usando OAuth actual sin cambios.
- Persistencia de tema: se respeta la preferencia guardada y se sincroniza con el `UIContext` de forma opcional.

## 5. Archivos/módulos que **no** se deben tocar
- Flujo OAuth y rutas en `backend/src/modules/auth/*`.
- Tabla y controlador `users` existentes (`backend/src/modules/users/*`).
- Middlewares de autenticación/refresh y manejo de tokens (`backend/src/middlewares/auth.js`, `spi_front/src/core/api/authApi.js`).
- Layouts y rutas públicas (`spi_front/src/core/layout/PublicLayout`, `spi_front/src/routes/AppRoutes.jsx` fuera de la nueva ruta agregada).

## 6. Notas de despliegue seguro
- Ejecutar la migración `018_user_profile.sql` antes de subir código.
- Configurar una carpeta de Drive para avatares (`DRIVE_PROFILE_PHOTOS_FOLDER_ID` recomendado) y validar credenciales de la service account.
- Revisar límites de Nginx/ingress para permitir multipart de hasta 2 MB.
- No es necesario reintegrar flujos OAuth; basta con `pm2 restart`/`docker restart` del backend y un build habitual del frontend.
- Verificar que el rol del usuario en el JWT siga siendo emitido por el IdP; las rutas de perfil dependen de `req.user.id`.
