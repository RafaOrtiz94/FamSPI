# CONTEXT.md — world-cup-2026

## ⚠️ LEGACY (2026-08-12): módulo desactivado
El Mundial 2026 terminó. Las rutas están comentadas en `backend/src/routes/registerRoutes.js`
y `spi_front/src/routes/AppRoutes.jsx` — el módulo ya no es alcanzable (ni el portal público,
ni el SSE). Código intacto por si se reutiliza para un evento similar en el futuro.
Para reactivar: descomentar el require + `app.use` en `registerRoutes.js` y el import +
`<Route>` en `AppRoutes.jsx`.

## 1. Descripción
Portal promocional de Famproject Cia. Ltda. para participantes que registran una sola vez sus predicciones del Mundial de Fútbol 2026. Usa la misma base del ecosistema actual, pero aislado en el schema `external_world_cup_2026`.

## 2. Endpoints

Prefijo: `/api/v1/world-cup-2026` (montado en `mountPublicRoutes`, sin JWT global)

- **GET /api/v1/world-cup-2026/public/portal** — `getPublicPortal` — sin autenticación
- **GET /api/v1/world-cup-2026/public/participant** — `getPublicParticipant` — identificación por token persistente
- **GET /api/v1/world-cup-2026/public/live-board** — `getLiveBoard` — ranking y participantes recientes
- **GET /api/v1/world-cup-2026/public/live-stream** — `streamLiveBoard` — SSE público en vivo
- **POST /api/v1/world-cup-2026/public/submissions** — `createPublicSubmission` — sin autenticación, con rate limit por IP

## 3. Flujo principal

1. Cliente externo abre un enlace público del portal
2. Frontend consulta la configuración pública del portal
3. Cliente registra sus datos, documento de identidad, sus 3 marcadores y la tabla final de 4 equipos una sola vez
4. Backend genera `participant_token` y lo devuelve al frontend para identificar al participante en siguientes visitas
5. Backend valida apertura del portal y unicidad por correo/documento
6. El tablero público muestra participantes recientes y ranking calculado contra `official_results`

## 4. Validaciones
- Ruta pública: no requiere JWT
- Rate limit para evitar abuso del formulario
- Participación única por `email_normalized`
- Participación única por `identity_document_normalized`
- `consent_accepted` obligatorio
- Identificación persistente por `participant_token`

## 5. Base de datos
- Fuente de verdad validada en Neon producción
- Schemas existentes al 2026-07-13: `auditoria`, `crm`, `public`, `servicio`, `work_management`
- Schema nuevo previsto: `external_world_cup_2026`
- Tablas nuevas: `portal_config`, `official_results`, `prediction_entries`

## 6. Relaciones
- Sin dependencia funcional con módulos internos de operación
- Comparte únicamente la misma base PostgreSQL

## 7. Frontend asociado
- Ruta pública propuesta: `/predicciones/mundial-2026`
- No debe integrarse al dashboard autenticado

## 8. Riesgos detectados
- El scoring vigente otorga 50 puntos por ganador correcto, 100 por marcador exacto y 50 por cada posicion final correcta
- Los semifinalistas actuales deben mantenerse alineados con FIFA
- Requiere aplicar la migración antes del despliegue
- Si `official_results` no está cargada, el ranking mostrará puntajes parciales en cero

## 9. Notas técnicas
- Mantener contrato `{ ok: true|false }`
- Evitar tocar `publicPaths.js`: la ruta se expone desde `mountPublicRoutes`
