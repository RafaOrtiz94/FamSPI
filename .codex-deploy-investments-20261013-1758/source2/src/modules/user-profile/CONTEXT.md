# CONTEXT.md — user-profile

## 1. Descripción
Módulo de perfil personal de usuario. Permite a cada usuario ver, crear y actualizar su propio perfil (foto de avatar, datos personales). La foto se almacena en Google Drive o como fallback en data URI. Solo el usuario autenticado puede gestionar su propio perfil (sin diferenciar roles).

## 2. Endpoints

Prefijo: `/api/v1/user-profile`

- **GET /api/v1/user-profile/** — `getMine` — verifyToken
- **POST /api/v1/user-profile/** — `createMine` — verifyToken, multer.single('avatar')
- **PUT /api/v1/user-profile/** — `updateMine` — verifyToken, multer.single('avatar')

**Restricciones de archivo:**
- Tipos permitidos: `image/png`, `image/jpeg`, `image/webp`
- Tamaño máximo: 2MB

## 3. Flujo principal

1. Usuario sube/actualiza su foto de perfil
2. `userProfile.service.js` sube el binario a Google Drive
3. Si Drive falla, genera fallback como data URI
4. El avatar está disponible en `/user-profile/`

## 4. Validaciones
- MIME type validado en el router (`image/png`, `image/jpeg`, `image/webp`)
- Límite de 2MB aplicado en multer
- Error handler dedicado en el router para errores de archivo

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `users`: el perfil extiende los datos del usuario del sistema
- Google Drive: almacenamiento del avatar

## 7. Frontend asociado
- No verificado en frontend (integración probable en layout global/navbar)

## 8. Riesgos detectados
- Sin multer para `GET` (correcto) — sin riesgo
- El fallback a data URI puede producir respuestas grandes si Drive no está disponible
- `userProfile.service.js` (15KB) — moderado, depende de la API de Drive

## 9. Notas técnicas
- `multer.memoryStorage()` requerido porque el service consume `file.buffer` directamente
- Perfil personal exclusivo — sin acceso de admin a perfiles de otros usuarios
