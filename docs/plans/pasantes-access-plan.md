# Plan: Acceso al sistema para usuarios tipo Pasante (sin OAuth)

Fecha: 2026-08-18
Estado: ✅ **Implementado y desplegado a producción** (backend `spi-backend-01090-5ht`, frontend Firebase Hosting). Verificado extremo a extremo contra producción real: login con password temporal, cambio de password obligatorio, cuenta vencida rechazada, rate limiting (5 intentos), `/auth/me` con `module_access`/`dashboard` correctos, job de expiración de cuentas.

Decisiones §8 resueltas de forma autónoma (usuario pidió avanzar sin pausar):
1. Entrega de password temporal: manual — el admin la copia del modal de creación y se la entrega fuera del sistema.
2. Username: opcional en el alta, autogenerado desde el nombre completo (slug + sufijo numérico si hay colisión) si se deja vacío.
3. Duración de pasantía: sin default sugerido, campo obligatorio de fecha libre.
4. Alta de pasantes: mismos roles que ya administran usuarios hoy (`USER_ADMIN_ROLES` existente — TI y Talento Humano, entre otros), sin restricción adicional.

## 0. Requerimiento (verbatim del usuario)

> "el sistema debe poder tener un dashboard, inicio de sesion y acceso a asistencia a usuarios tipo pasantes que tendran varias funciones que se podran ir asignando, limitante a superar no tendran credenciales para acceder por oauth"

Desglosado en 4 piezas:
1. **Dashboard** propio para pasantes.
2. **Inicio de sesión** que no dependa de OAuth de Google.
3. **Acceso a asistencia** (marcar entrada/salida, ver su propio historial).
4. **Funciones asignables progresivamente** — hoy puede ser solo asistencia, mañana se le puede sumar acceso a otro módulo, sin tocar código.

## 1. Diagnóstico del sistema real (verificado contra código, no contra documentación)

Esta sección resume lo que **ya existe y es reutilizable**, y lo que **falta construir**. Es la base de todas las decisiones del plan — cada punto fue confirmado leyendo el código fuente real, no asumido.

### 1.1 Auth hoy es 100% Google OAuth — no hay contraseña en ningún lado

- La tabla `users` **no tiene columna de password**. Los únicos campos de identidad son `google_id` (nullable) y `email`.
- El flujo real: `GET /auth/google` → redirect a Google → `GET /auth/google/callback` → se emite `accessToken`/`refreshToken` (JWT) vía `signAccess`/`signRefresh` en `auth.controller.js`.
- **Ya existe un precedente de login no-OAuth**: `localLogin` (`auth.controller.js:883`, ruta `POST /auth/local`). Pero es un atajo de **sandbox/desarrollo únicamente**:
  - Bloqueado explícitamente si `NODE_ENV === "production"`.
  - Requiere `SANDBOX_AUTH=true` (no está activo en prod).
  - Usa **una sola contraseña compartida** (`SANDBOX_PASSWORD`) para *cualquier* email que ya exista en la tabla `users` — no es un password por usuario, es un bypass de QA.
  - **No es apto para producción tal cual**, pero confirma que la infraestructura de JWT (`signAccess`/`signRefresh`, `createSession`) es completamente independiente de Google y reutilizable.
- El frontend (`Login.jsx`) **ya tiene un formulario de email+password** renderizado condicionalmente (`REACT_APP_SANDBOX_AUTH === "true"`), con su propio `handleSandboxLogin` que llama `sandboxLogin()` y navega igual que el flujo Google. Es decir, **el patrón de UI dual (botón Google + formulario password) ya está construido**, solo apunta al endpoint sandbox.

**Conclusión:** no hay que inventar el mecanismo de JWT ni el patrón de UI — hay que construir el **endpoint de login real por credenciales propias** (uno por pasante, con password hasheado) y desactivar/reemplazar el atajo sandbox por el flujo de producción.

### 1.2 RBAC y control de acceso por módulo — ya soporta exactamente el caso "funciones asignables"

- `ROLE_GROUPS` (`middlewares/roles.js`) ya tiene un precedente directo para roles restringidos: `ext_users: ["ing_servicio_ext", "esp_app_ext"]` — "acceso limitado: FamSign, Capacitaciones, Permisos, Vacaciones" (comentario textual en el código).
- Existe una tabla **`user_module_access`** (`module-access/moduleAccess.service.js`) que ya implementa *exactamente* "funciones que se podrán ir asignando":
  - Un catálogo fijo de ~40 módulos (`MODULE_CATALOG`, cada uno con `path_prefixes`).
  - Toggle individual por usuario (`is_enabled` por `user_id` + `module_key`), gestionable hoy desde `/dashboard/ti/modulos` (rol TI).
  - El JWT/perfil del usuario expone `module_access[]`, y `ProtectedRoute.jsx` en frontend llama `isPathEnabledForUser({ pathname, moduleAccess })` antes de renderizar cualquier ruta — si el módulo no está habilitado para ese usuario, redirige a `/unauthorized`, sin importar el rol.
  - Esto **ya es exactamente el mecanismo de "ir asignando funciones"** que pide el requerimiento — no hay que construir nada nuevo aquí, solo dar de alta pasantes como usuarios normales y usar esta tabla.

**Conclusión:** la pieza de "funciones asignables" no requiere desarrollo nuevo — ya existe, funciona hoy para otros roles, y se reutiliza sin cambios.

### 1.3 Asistencia — no depende de cómo se autenticó el usuario

- Revisado `attendance.controller.js`/`attendance.auth.js`: toda la lógica de marcar entrada/salida/almuerzo, excepciones, geolocalización, etc. está indexada por `user_id` (FK a `users.id`) y protegida solo por `verifyToken` (JWT válido) + reglas de rol para *reportería* (no para marcar la propia asistencia, que está abierta a cualquier usuario autenticado).
- **No hay ninguna dependencia de Google** en el módulo de asistencia. Un pasante con un JWT válido emitido por el nuevo login de credenciales propias puede marcar asistencia sin ningún cambio en `attendance.*`.

**Conclusión:** el punto 3 del requerimiento ("acceso a asistencia") se resuelve automáticamente en cuanto el pasante tiene una sesión válida — cero desarrollo adicional en el módulo de asistencia.

### 1.4 Dashboard — ya hay un precedente de dashboard mínimo por rol restringido

- `ExtUserDashboard.jsx` (`modules/ext-users/pages/`) es exactamente el patrón a replicar: header simple, grid de tarjetas de módulos habilitados, aviso de "para otros módulos contacta al administrador". Hoy la lista de módulos está hardcodeada por rol (`ing_servicio_ext`/`esp_app_ext`), no leída dinámicamente de `user_module_access` — para pasantes conviene hacerla dinámica (ver §3.4) ya que la lista de módulos asignados cambiará con el tiempo por diseño del requerimiento.
- `RoleRedirect` (`ProtectedRoute.jsx`) ya tiene un mapa `role → ruta de dashboard` (ej. `ing_servicio_ext: "/dashboard/ext"`) — solo falta agregar la entrada `pasante: "/dashboard/pasante"`.

### 1.5 Provisión de usuarios — ya existe un endpoint admin de alta

- `users.controller.js` (`createUser`, montado en `users.routes.js`) ya es un CRUD admin de usuarios con un set `ALLOWED_USER_ROLES` — no incluye `pasante` todavía, pero el mecanismo (crear fila en `users` con email/rol/departamento sin requerir `google_id`) ya funciona porque `google_id` es nullable.

## 2. Decisión de arquitectura: mecanismo de login sin OAuth

Evalué 3 opciones:

| Opción | Descripción | Veredicto |
|---|---|---|
| **A. Usuario + contraseña propia (bcrypt)** | Cada pasante tiene `username`/email interno + password hasheado individual. Login por formulario, mismo JWT de siempre. | **Recomendada.** Estándar, cada pasante tiene credencial propia y auditable, revocable individualmente, sin fricción operativa (no depende de que alguien escanee un QR o envíe un link cada vez). |
| B. Magic link por email | Se envía un link de un solo uso al correo personal del pasante. | Descartada como mecanismo primario: requiere que el pasante tenga y revise un correo personal confiable cada vez que quiera entrar (fricción alta para marcar asistencia a diario); además ya existe infraestructura de email transaccional (notifications) que se podría reusar, pero no resuelve bien el caso de uso diario de asistencia. |
| C. PIN/código corto + QR de estación fija | Como un kiosco de fichaje. | Descartada como mecanismo *de login al sistema* (el requerimiento pide dashboard completo, no solo un kiosco de marcación) — pero es una buena extensión futura *opcional* solo para el flujo de marcar asistencia desde un dispositivo compartido (ver §7, fuera de alcance v1). |

**Decisión: Opción A.** Cada pasante recibe un `username` (no tiene que ser un email real — puede ser `pasante.nombre` o similar) y una contraseña inicial generada por el administrador que lo da de alta, con cambio obligatorio en el primer login.

## 3. Cambios de backend

### 3.1 Modelo de datos — nuevas columnas en `users`

```sql
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'google', -- 'google' | 'local'
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS account_expires_at TIMESTAMPTZ; -- fin de pasantía, null = sin vencimiento
```

Notas de diseño:
- `auth_provider` permite distinguir en `/auth/me`, logs y auditoría quién entra por Google vs. por credencial propia, sin adivinar por la presencia de `google_id`.
- `account_expires_at` es clave: **las pasantías tienen fecha de fin conocida**. Sin esto, cuentas de ex-pasantes quedan activas indefinidamente — riesgo de seguridad real, no hipotético (mismo patrón de "cuentas huérfanas" que ya se maneja para colaboradores vía `offboarding_requested` en la misma tabla).
- `password_hash` nunca se expone en ningún `SELECT *` existente — auditar los queries de `users.controller.js`/`auth.controller.js` que hacen `SELECT *` y reemplazarlos por listas explícitas de columnas si los hay (evitar fuga accidental del hash al frontend).

### 3.2 Nuevo endpoint de login: `POST /auth/local-login` (reemplaza el uso de `/auth/local` en producción)

- Diferente del `localLogin` sandbox existente (ese se deja intacto para QA, pero **nunca** se habilita en prod — cero relación con el flujo real de pasantes).
- Body: `{ username, password }`.
- Lógica:
  1. Buscar `users` por `username` (case-insensitive), `active = true`, `auth_provider = 'local'`.
  2. Si `account_expires_at` está en el pasado → 403 `ACCOUNT_EXPIRED` (mensaje claro, no simplemente "credenciales inválidas" — un administrador debe poder distinguir "venció la pasantía" de "contraseña mal escrita" al revisar logs).
  3. `bcrypt.compare(password, password_hash)`.
  4. Rate limiting por `username` + IP (ver §5.2 — reusar patrón existente si hay uno para `/auth/refresh` o similar; si no existe, es la primera vez que se necesita en este módulo y hay que construirlo mínimo: contador en memoria o tabla, bloqueo temporal tras N intentos fallidos).
  5. Si `must_change_password === true` → emitir un JWT de **alcance reducido** (`scope: "password_reset_required"`) que solo permite golpear `POST /auth/change-password`, nada más. Esto evita el patrón inseguro de "dejar pasar con password default y confiar en que el usuario la cambie por las buenas".
  6. Si todo ok → mismo `signAccess`/`signRefresh`/`createSession` que ya usa `googleCallback`, con el perfil incluyendo `module_access` (igual que hace `me()` hoy).
- Reutiliza `session.repository.js` sin cambios.

### 3.3 Endpoint: `POST /auth/change-password`
- Requiere JWT válido (normal o de alcance reducido).
- Body: `{ currentPassword?, newPassword }` (`currentPassword` opcional solo en el flujo de primer cambio obligatorio, donde el JWT ya probó identidad).
- Valida longitud mínima/complejidad básica, hashea con bcrypt, limpia `must_change_password`.

### 3.4 Rol `pasante` + RBAC

- Agregar a `ROLE_GROUPS` (`middlewares/roles.js`):
  ```js
  pasante: ["pasante"],
  ```
  Deliberadamente **sin** agregarlo a ningún grupo amplio existente (`tecnico`, `comercial`, etc.) — un pasante no hereda permisos de ningún área por default, todo se asigna explícitamente vía `user_module_access` (§1.2).
- Agregar `"pasante"` a `ALLOWED_USER_ROLES` en `users.routes.js` y `users.controller.js`.
- Default de módulos al crear un pasante: **solo** `talento_asistencia`-equivalente de auto-servicio (marcar su propia asistencia) — en la práctica esto no es un módulo de `MODULE_CATALOG` con guard propio hoy (marcar asistencia no está detrás de `moduleAccessGuard`, está abierto a cualquier autenticado, ver §1.3), así que el pasante recién creado ya puede marcar asistencia sin asignar nada. Los módulos adicionales ("funciones que se podrán ir asignando") se activan uno por uno desde `/dashboard/ti/modulos`, exactamente como hoy se hace para cualquier otro usuario.

### 3.5 Endpoint de alta de pasante (extiende `createUser` existente)

- Reusar `users.controller.js::createUser`, agregando:
  - Si `role === "pasante"`: generar `username` (si no se especifica, derivar de nombre + secuencial), generar password temporal aleatoria segura, hashear, `auth_provider = 'local'`, `must_change_password = true`.
  - Devolver la password temporal **una sola vez** en la respuesta del endpoint (nunca se vuelve a poder leer) para que el administrador se la entregue al pasante por un canal fuera de banda (no email automático a menos que se decida lo contrario, ver Decisión pendiente #1 en §8).
  - Requiere `account_expires_at` en el payload — **obligatorio** para rol `pasante` (rechazar con 400 si no viene), justamente para forzar que quien da de alta piense en la fecha de fin desde el día uno.

## 4. Cambios de frontend

### 4.1 `Login.jsx` — dual-mode ya no gated por `REACT_APP_SANDBOX_AUTH`

- El formulario usuario/contraseña pasa de "solo visible en sandbox" a **siempre visible**, con copy distinto ("¿Eres pasante? Ingresa con tu usuario y contraseña" vs. el botón Google para el resto de la organización) — dos caminos claramente separados en la misma pantalla, no un mismo formulario ambiguo.
- Nuevo API client `localLogin(username, password)` en `core/api/authApi.js` apuntando a `/auth/local-login` (el real, no el sandbox `sandboxLogin` existente que se deja intacto para QA).
- Manejar la respuesta de alcance reducido (`must_change_password`): si el login devuelve ese estado, redirigir a una pantalla `/cambiar-password` en vez de al dashboard.

### 4.2 Nueva pantalla `/cambiar-password`
- Formulario simple: nueva contraseña + confirmación. Llama `POST /auth/change-password`. Al éxito, redirige a `/dashboard` (ya con JWT completo tras el cambio, o forzando un nuevo login — a decidir en implementación, cualquiera de las dos es válida).

### 4.3 `AuthContext` 
- Confirmar que `login()`/el manejo de tokens no asume implícitamente un flujo Google (revisar si hay lógica atada a `google_id` o al callback de OAuth en el contexto — por lo visto en `Login.jsx`, `sandboxLogin`/`googleLogin` ya conviven, así que el contexto ya es agnóstico; validar en implementación, no asumir).

### 4.4 `ProtectedRoute.jsx` / `RoleRedirect`
- Agregar `pasante: "/dashboard/pasante"` al mapa de `roleRoutes`.
- Nada más cambia aquí — `hasPermission`/`moduleEnabled` ya funcionan por rol y por `module_access` sin modificación.

### 4.5 Nuevo `PasanteDashboard.jsx` (`modules/pasantes/pages/`)
- Mismo patrón que `ExtUserDashboard.jsx` (§1.4), pero **dinámico**: en vez de una lista de módulos hardcodeada, lee `user.module_access[]` (ya viene en el JWT/perfil) y renderiza una tarjeta por cada módulo habilitado presente en `MODULE_CATALOG` (necesita exponer el catálogo — o al menos label/path — al frontend; hoy `MODULE_CATALOG` vive solo en backend, revisar si ya hay un endpoint que lo exponga vía `getGlobalModuleStatusForUser`/`listUserModuleAccess` o si hace falta uno nuevo de solo lectura para el propio usuario).
- Tarjeta de asistencia **siempre visible** (no depende de `module_access`, ya que marcar asistencia está abierto a cualquier autenticado — §1.3), como acceso principal/destacado igual que "Firma Digital" lo es en `ExtUserDashboard`.
- Mensaje de "sin módulos asignados aún" (empty state) para pasantes recién creados que aún no tienen nada activado más allá de asistencia.

## 5. Seguridad

### 5.1 Hash de contraseñas
- `bcryptjs` (ya es dependencia del backend, confirmado en `package.json`, actualmente sin uso — primera vez que se necesita). Costo de hash 10-12 rounds.

### 5.2 Rate limiting / fuerza bruta
- No se encontró ningún rate limiter existente en el módulo `auth` (ni siquiera en `/auth/refresh`, que el propio `CONTEXT.md` del módulo marca como riesgo). Para el login por contraseña esto es más crítico que para OAuth (ahí Google absorbe el riesgo de fuerza bruta). Implementar bloqueo temporal simple (ej. 5 intentos fallidos → bloqueo 15 min, por `username`) — no requiere infraestructura nueva, un contador en memoria por instancia es suficiente dado el volumen esperado de pasantes (bajo), documentando la limitación de que no es distribuido entre instancias de Cloud Run (aceptable a esta escala).

### 5.3 Expiración de cuenta
- Job (o chequeo inline en el login) que rechaza login si `account_expires_at < now()`. Adicionalmente, un scheduler diario que **desactiva** (`active = false`) cuentas de pasante vencidas hace más de N días, siguiendo el mismo patrón de los schedulers ya existentes en `backend/src/jobs/` (`ENABLE_JOBS`/`IS_JOBS_RUNNER_INSTANCE`, ya cubierto extensamente en este mismo proyecto — reusar el patrón, no inventar uno nuevo).

### 5.4 `password_hash` nunca sale del backend
- Auditar (en implementación) cualquier `SELECT * FROM users` en el código para asegurarse de que no se serialice `password_hash` accidentalmente al frontend en ninguna respuesta JSON.

### 5.5 LOPDP
- El flujo de aceptación interna de LOPDP (`lopdp_internal_status`, chequeado en `ProtectedRoute`) aplica igual a pasantes — no requiere cambios, ya es agnóstico del método de login (revisar únicamente si el copy de la pantalla de aceptación asume "cuenta corporativa Google", ajustar texto si es necesario).

## 6. Fases de ejecución propuestas

| Fase | Contenido | Depende de |
|---|---|---|
| 0 | Migración SQL (§3.1) + `pasante` en `ROLE_GROUPS`/`ALLOWED_USER_ROLES` | — |
| 1 | Backend: `POST /auth/local-login`, `POST /auth/change-password`, rate limiting básico | Fase 0 |
| 2 | Backend: alta de pasante en `createUser` (username + password temporal + `account_expires_at` obligatorio) | Fase 0 |
| 3 | Frontend: `Login.jsx` dual-mode real, pantalla `/cambiar-password`, ajustes `AuthContext`/`ProtectedRoute`/`RoleRedirect` | Fase 1 |
| 4 | Frontend: `PasanteDashboard.jsx` dinámico por `module_access` | Fase 2 |
| 5 | Scheduler de expiración de cuentas vencidas | Fase 1, 2 |
| 6 | UI admin: extender `/dashboard/ti/modulos` (o el panel de creación de usuarios de RRHH) con un formulario específico "Nuevo pasante" que capture username/expiración y muestre la password temporal una sola vez | Fase 2 |

Cada fase es desplegable por separado; ninguna requiere big-bang.

## 7. Fuera de alcance de este plan (flag, no ignorar)

- Kiosco de fichaje por PIN/QR compartido (Opción C descartada en §2) — si a futuro se necesita marcar asistencia desde un dispositivo compartido sin login individual, es un requerimiento distinto que se planifica aparte.
- Notificación automática por email/SMS de la password temporal al pasante — depende de la Decisión pendiente #1 (§8); si se aprueba, es una extensión menor sobre el sistema de notificaciones ya existente (`notifications.service.js`), no un desarrollo nuevo grande.
- Self-service de "olvidé mi contraseña" para pasantes — v1 asume que el administrador la resetea manualmente (mismo costo operativo que resetear cualquier password, bajo volumen esperado). Si el volumen de pasantes crece, se planifica aparte.

## 8. Decisiones que necesito del usuario antes de implementar

1. **Entrega de la password temporal**: ¿el administrador se la comunica manualmente (verbal/WhatsApp/impresa) al pasante, o debe enviarse automáticamente a un correo personal que se capture en el alta? (afecta si hace falta un campo `personal_email` en el formulario de alta y una integración con notifications).
2. **`username` del pasante**: ¿debe seguir un formato específico (ej. `pasante.nombre.apellido`) o lo genera el sistema libremente? ¿Puede el pasante mismo elegirlo en su primer login, o lo fija el administrador?
3. **Duración por defecto de una pasantía**: ¿hay un valor típico (3 meses, 6 meses) que sirva de default sugerido en el formulario de alta, o siempre se ingresa manualmente sin sugerencia?
4. **¿Quién puede dar de alta pasantes?** ¿Solo TI (como hoy gestiona `user_module_access`), o también Talento Humano (dueño natural del ciclo de vida de una pasantía)? Afecta qué rol se agrega a `requireRole([...])` en la ruta de creación.
