# AGENTS.md — FamSPI Precision Root Agent v4.0

## Objetivo operativo
Este archivo define el comportamiento raíz para trabajar sobre FamSPI con máxima precisión, bajo consumo y cero suposiciones.

El agente raíz NO debe actuar como programador directo por defecto.

Su función principal es:

1. Entender el requerimiento.
2. Identificar el módulo afectado.
3. Leer el CONTEXT.md correspondiente.
4. Seleccionar el skill correcto.
5. Validar evidencia en código y Neon.
6. Ejecutar solo lo necesario.
7. Reportar con claridad.

Flujo obligatorio:

Diagnosticar → Validar contexto → Seleccionar skill → Planificar → Ejecutar → Verificar → Reportar

---

## Principio fundamental

Si algo no está verificado en:

1. CONTEXT.md
2. Código real
3. Neon PostgreSQL

Entonces:

NO EXISTE

---

## Regla crítica de precisión

El agente tiene prohibido asumir.

Prohibido:

- Inventar endpoints.
- Inventar rutas.
- Inventar tablas.
- Inventar columnas.
- Inventar roles.
- Inventar estados.
- Inventar relaciones.
- Inventar payloads.
- Inventar permisos.
- Inventar comportamiento de frontend.
- Basarse en migraciones como fuente principal de DB.
- Cambiar contratos `{ ok: true|false }`.
- Cambiar prefijo `/api/v1/`.
- Hacer refactor global no solicitado.
- Corregir deuda técnica no pedida.
- Tocar archivos globales sin evidencia.

---

## Prioridad de fuentes

Consultar siempre en este orden:

1. `backend/src/modules/<modulo>/CONTEXT.md`
2. Código real del módulo
3. Neon PostgreSQL usando secrets desde GCP Secret Manager
4. Frontend asociado
5. Skills transversales
6. Archivos globales solo si aplica

Si falta `CONTEXT.md`, escribir:

CONTEXT.md no disponible o insuficiente.

Si el `CONTEXT.md` contradice el código, escribir:

CONTEXT.md inconsistente con el código.

Si Neon contradice el `CONTEXT.md`, escribir:

Neon contradice el CONTEXT.md. Neon es la fuente de verdad para DB.

---

## Evidencia base del proyecto

### Backend

- `backend/src/server.js`
- `backend/src/app.js`
- `backend/src/routes/registerRoutes.js`
- `backend/src/routes/publicPaths.js`
- `backend/src/middlewares/roles.js`
- `backend/package.json`

### Frontend

- `spi_front/src/routes/AppRoutes.jsx`
- `spi_front/package.json`

### Módulos backend

- `backend/src/modules/<modulo>/CONTEXT.md`
- `backend/src/modules/<modulo>/AGENTS.md` si existe

### Skills

- `.agents/skills/orchestrator-skill.md`
- `.agents/skills/frontend-skill.md`
- `.agents/skills/notifications-skill.md`
- `.agents/skills/auth-skill.md`
- `.agents/skills/routing-rbac-skill.md`
- `.agents/skills/approvals-skill.md`
- `.agents/skills/audit-security-skill.md`
- `.agents/skills/files-documents-skill.md`
- `.agents/skills/signature-skill.md`
- `.agents/skills/db-migration-skill.md`

---

## Flujo obligatorio del agente raíz

### 1. Leer requerimiento completo

Identificar:

- objetivo real
- módulo principal
- módulos secundarios
- tipo de cambio
- riesgo
- si involucra DB
- si involucra frontend
- si involucra notificaciones
- si involucra aprobaciones
- si involucra auditoría
- si involucra archivos/documentos
- si involucra RBAC o rutas protegidas

---

### 2. Identificar módulo principal

Antes de analizar código, determinar la ruta probable:

`backend/src/modules/<modulo>/`

Luego leer:

`backend/src/modules/<modulo>/CONTEXT.md`

Si no existe, continuar con análisis tradicional, pero marcarlo como riesgo.

---

### 3. Validar contexto mínimo

Antes de implementar, confirmar al menos:

- endpoint real
- service real
- tabla real si aplica
- frontend consumidor si aplica
- permisos/RBAC si aplica

Si no se puede validar, detener.

---

### 4. Clasificar el cambio

Clasificar antes de ejecutar.

#### SIMPLE

Características:

- 1 módulo
- sin DB
- sin frontend
- sin dependencias transversales

Acción:

- Usar agente del módulo.
- No usar orchestrator.

---

#### MEDIA

Características:

- backend + DB
- backend + frontend
- frontend + API
- 1 módulo principal con dependencia menor

Acción:

- Usar skill específico.
- Plan corto.
- Validación focalizada.

---

#### COMPLEJA

Características:

- DB + backend + frontend
- cambios de estado
- aprobaciones
- notificaciones
- auditoría
- archivos
- integraciones
- firma

Acción:

- Usar `.agents/skills/orchestrator-skill.md`.

---

#### TRANSVERSAL

Características:

- auth
- JWT
- RBAC
- rutas protegidas
- middleware core
- auditoría global
- contratos compartidos
- `app.js`
- `registerRoutes.js`
- `roles.js`
- `publicPaths.js`
- `AppRoutes.jsx`

Acción:

- Usar skill correspondiente.
- Detener si no está explícitamente solicitado.
- Justificar cada archivo global a modificar.

---

## Router de skills

### Orquestación

Usar:

`.agents/skills/orchestrator-skill.md`

Activar cuando:

- toca 2 o más módulos
- requiere DB + backend + frontend
- afecta cambios de estado sensibles
- involucra approvals + notifications + frontend
- involucra auditoría + documentos + flujo de negocio
- el alcance es ambiguo
- se requiere coordinar varios skills

---

### Frontend

Usar:

`.agents/skills/frontend-skill.md`

Activar cuando:

- pantalla pobre
- formulario
- tabla
- modal
- dashboard
- consumo API
- estados loading/error/empty
- validaciones visuales
- mejora UX/UI
- frontend de una sola área

Regla especial:

El frontend debe entregarse con calidad profesional, no solo funcional.

Toda pantalla debe considerar:

- loading
- empty state
- error state
- success state
- validaciones visibles
- responsive básico
- jerarquía visual
- permisos/roles
- consistencia con diseño existente

---

### Notificaciones

Usar:

`.agents/skills/notifications-skill.md`

Activar cuando:

- no se envía notificación
- plantilla incorrecta
- destinatario incorrecto
- evento incorrecto
- cola de despacho
- retries
- duplicados
- riesgo de spam
- ajuste de destinatarios por tipo de evento

Regla especial:

El skill de notificaciones NO debe cambiar lógica de negocio del módulo origen.

El módulo origen decide cuándo ocurre el evento.

Notifications decide:

- a quién se notifica
- qué plantilla se usa
- cómo se encola
- cómo se despacha
- cómo se evita duplicidad

---

### Auth / JWT

Usar:

`.agents/skills/auth-skill.md`

Activar cuando:

- login
- refresh token
- sesión
- JWT
- expiración
- usuario actual
- autenticación Google
- middleware auth

No usar para permisos de pantallas si el problema es solo frontend.

---

### Routing / RBAC

Usar:

`.agents/skills/routing-rbac-skill.md`

Activar cuando:

- rutas protegidas
- roles
- permisos
- acceso por área
- `roles.js`
- `publicPaths.js`
- `AppRoutes.jsx`
- registro global de rutas
- bloqueo por rol

---

### Aprobaciones

Usar:

`.agents/skills/approvals-skill.md`

Activar cuando:

- solicitudes pendientes
- aprobar
- rechazar
- flujo de aprobación
- aprobadores
- estados de aprobación
- trazabilidad de aprobación

Si además hay notificaciones o frontend, usar orchestrator.

---

### Auditoría y seguridad operacional

Usar:

`.agents/skills/audit-security-skill.md`

Activar cuando:

- logs de auditoría
- trazabilidad
- acciones sensibles
- cumplimiento
- evidencia
- hash
- seguridad operacional
- registro de acciones

---

### Archivos / documentos / Drive

Usar:

`.agents/skills/files-documents-skill.md`

Activar cuando:

- subida de archivos
- descarga
- Google Drive
- documentos generados
- adjuntos
- plantillas documentales
- evidencia documental

---

### Firma digital

Usar:

`.agents/skills/signature-skill.md`

Activar cuando:

- firma
- validación de firma
- documentos firmados
- huella criptográfica
- sellado
- evidencia de integridad

---

### Base de datos / Neon

Usar:

`.agents/skills/db-migration-skill.md`

Activar cuando:

- requiere verificar tablas
- requiere nuevas columnas
- requiere constraints
- requiere índices
- requiere cambios de schema
- requiere validación fuerte en Neon

Regla absoluta:

Neon es la fuente de verdad para DB.

No usar migraciones como fuente principal.

---

## Router de módulos de negocio

Usar el agente o CONTEXT.md del módulo correspondiente.

### Business Case

- `backend/src/modules/business-case/CONTEXT.md`
- `backend/src/modules/business-case/AGENTS.md`

### Compras privadas

- `backend/src/modules/private-purchases/CONTEXT.md`
- `backend/src/modules/private-purchases/AGENTS.md`

### Servicio técnico

- `backend/src/modules/servicio/CONTEXT.md`
- `backend/src/modules/servicio/AGENTS.md`

### Talento humano

- `backend/src/modules/talento_humano/CONTEXT.md`
- `backend/src/modules/talento_humano/AGENTS.md`

### Integraciones

- `backend/src/modules/integrations/CONTEXT.md`
- `backend/src/modules/integrations/AGENTS.md`

### Notificaciones

- `backend/src/modules/notifications/CONTEXT.md`
- `.agents/skills/notifications-skill.md`

---

## Base de datos — regla absoluta

Fuente de verdad:

Neon PostgreSQL

Flujo obligatorio si el cambio toca DB:

1. Obtener secrets desde GCP Secret Manager.
2. Conectarse a Neon.
3. Consultar estructura real.
4. Confirmar tablas, columnas, tipos, relaciones, constraints e índices.
5. Planificar cambios.
6. Ejecutar solo si es necesario y autorizado.
7. Validar resultado.

Prohibido:

- Basarse en migraciones como fuente principal.
- Inventar schema.
- Ejecutar `ALTER`, `DROP`, `DELETE` o `UPDATE` masivo sin autorización.
- Exponer secrets en logs, respuestas o commits.

---

## Reglas API

Mantener:

- prefijo `/api/v1/`
- contrato `{ ok: true|false }` si el módulo ya lo usa
- manejo de errores existente
- middlewares existentes
- RBAC existente
- patrón actual del módulo

Antes de crear un endpoint:

- verificar si ya existe uno similar
- verificar registro en rutas
- verificar permisos
- verificar consumo frontend
- verificar contrato de respuesta

---

## Reglas frontend globales

Antes de tocar frontend:

- leer CONTEXT.md del módulo backend
- identificar área frontend
- identificar servicio API
- identificar ruta
- identificar roles
- revisar pantalla similar ya existente
- respetar patrón visual actual

Prohibido:

- crear pantallas pobres
- crear formularios sin estados
- crear tablas sin empty/loading/error
- duplicar servicios API
- romper navegación
- modificar `AppRoutes.jsx` sin necesidad real
- cambiar UX global sin requerimiento

---

## Reglas de notificaciones globales

Antes de tocar notificaciones:

- confirmar evento real
- confirmar dónde se dispara
- confirmar payload
- confirmar destinatarios
- confirmar plantilla
- confirmar cola si aplica
- confirmar riesgo de duplicidad

Prohibido:

- inventar eventos
- inventar destinatarios
- agregar correos fijos sin justificación
- saltarse cola existente
- enviar spam por jobs recurrentes
- tocar lógica del módulo origen sin handoff

---

## Reglas de bajo consumo para modelos limitados

Para Kilo Code o modelos free:

- Leer primero CONTEXT.md.
- No buscar globalmente si el módulo ya está identificado.
- No analizar archivos no relacionados.
- No repetir lectura de archivos.
- No dividir en micro-tareas ciegas.
- Trabajar por fases funcionales.
- Generar primero diagnóstico.
- Luego plan.
- Luego ejecutar.
- Mantener respuestas estructuradas.
- Detenerse si falta evidencia.

---

## Lectura inteligente

Orden recomendado:

1. CONTEXT.md
2. controller/routes del módulo
3. service principal
4. repository/query si existe
5. Neon si aplica
6. frontend si aplica
7. skill transversal si aplica
8. archivos globales solo si aplica

No hay límite rígido de archivos.

Regla correcta:

- tocar solo los archivos necesarios
- no tocar archivos no relacionados
- justificar si se requieren más de 5 archivos
- usar orchestrator si aparecen varios módulos

---

## Validación

Validación proporcional al cambio.

### Backend

```bash
cd backend && npm run lint