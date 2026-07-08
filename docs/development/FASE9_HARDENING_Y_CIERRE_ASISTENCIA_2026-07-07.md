# Fase 9 — Hardening y cierre del Plan Maestro Asistencia

Cierre de las 10 fases del [Plan Maestro](PLAN_MAESTRO_ASISTENCIA_Y_SALIDAS_UX_2026-07-07.md), ejecutado en una sola sesion asumiendo el rol de IA-1 (backend) e IA-2 (frontend). Commits: uno por fase en la rama `codex/task-title-s8unft`.

## Hallazgo de partida

Al iniciar Fase 1 se encontro que el contrato canonico de backend (`flow_kind/current_step/next_step/allowed_actions/context_flags`, `buildCanonicalFlowEnvelope`/`withCanonicalFlow` en `attendance.controller.js`) y varios servicios (`attendanceState.service.js`, `attendanceWorkspace.service.js`) ya estaban implementados en el working tree de una sesion anterior, sin handoff documentado. Fase 1 se redujo a verificar y alinear el vocabulario frontend con las claves reales del backend.

## Estado por fase

| Fase | Estado | Resumen |
|---|---|---|
| 0 | Cerrada | Inventario de estados/botones/mensajes de Widget, AttendanceAction, MobileShortcuts. Matriz accion/endpoint/pantalla. |
| 1 | Cerrada | Contrato canonico backend verificado (ya existia). `attendanceFlowUtils.js`: mapa unico de acciones + `resolveAttendanceFlowStep()`. |
| 2 | Cerrada | `AuthContext` distingue logout manual de expiracion automatica; preserva `returnUrl` exacto via `sessionStorage("redirectTo")`; `handleSessionExpired()` reemplaza el uso indebido de `logout()` en 401 en vivo. |
| 3 | Cerrada (parcial) | Mapa de errores ampliado de 5 a ~15 codigos reales. Retry sin `window.location.reload()`. **Backlog:** confirmacion visual de precision GPS, cola de reintento offline real. |
| 4 | Cerrada | `resolveAttendancePendingActions()` proyecta `canonical_flow`+`late_policy` a bandeja de pendientes, renderizada como badges en el widget. |
| 5 | Cerrada | `AttendanceAction` prioriza clientes de cronograma (antes solo lo hacia el Widget). |
| 6 | Cerrada (parcial) | Recordatorios por tiempo transcurrido (almuerzo/jornada extendida) client-side. **Backlog:** recordatorios push/backend-driven (requieren job + infra de notificaciones, fuera de alcance seguro sin pruebas de extremo a extremo). |
| 7 | Cerrada (parcial) | Aviso "esta salida generara viatico" cuando hay vehiculo personal. **Backlog:** `linkTo` a "mis permisos"/"mis viaticos" — no hay ruta personal confirmada para todos los roles en `AppRoutes.jsx`; requiere decision de producto. |
| 8 | Cerrada | Ayuda contextual breve por accion antes de pedir GPS, combinada con el mapa de errores de Fase 3. |
| 9 | Cerrada | Este documento + hardening de tests (ver abajo). |

## Hardening de tests (hallazgo real, no cosmetico)

`npx jest src/modules/attendance` pasaba **5/36 tests fallando** antes de esta fase (no causados por esta sesion — ya fallaban en el working tree previo). Se investigo la causa raiz de cada uno en vez de silenciarlos:

1. **Bug real corregido** (`attendance.controller.js`): `clockInField` llamaba `schedulesService.findTodayScheduledVisit(...)` sin capturar errores de esquema (`42P01`/`42703`/`42501`). Si la tabla `scheduled_visits` fallaba por cualquier motivo, la marcacion de **entrada a visita de cliente completa fallaba con 500**, contradiciendo el propio comentario del codigo ("si no existe en cronograma, registrar como visita no planificada pero permitir el marcado"). Se envolvio en try/catch siguiendo el mismo patron ya usado en `findActiveTimeOffForMarking`. Corregido en 2 call-sites (match por cliente y por lead).
2. **Tests desactualizados, corregidos** (no se toco produccion): 2 tests mockeaban una secuencia de queries que ya no coincide con el numero real de llamadas a `getActiveExceptionByFlow`/sincronizacion de horario (`registers unexpected return successfully`, `ignores missing schedules table when closing active client visit`). Se agrego un mock de respaldo (`mockResolvedValue` base) y se corrigio el orden de mocks para reflejar el flujo real.

**Resultado:** `2 failed, 34 passed` (antes: `5 failed, 31 passed`).

### Los 2 tests que siguen fallando — requieren decision de negocio, no se tocaron

- `closes operational trip without closing regular day before 18:00`: el controller ahora cierra la jornada normal al cerrar una salida operacional `outside_office` incluso antes de las 18:00 (el test espera que NO la cierre). Existe un campo nuevo `closure_type` que sugiere una regla mas granular fue introducida sin actualizar este test. **No se adivino la regla correcta** — requiere que alguien con contexto de negocio confirme cual es el comportamiento esperado.
- `blocks lunch start when there is no entry`: el controller ya no bloquea con 400 la salida a almuerzo sin entrada previa — en su lugar crea un registro `entry_pending_regularization` y continua. Esto coincide con el flujo de regularizacion que ya existe en `AttendanceWidget` (`entryRegularizationOpen`), asi que probablemente es un cambio de comportamiento **intencional** de una sesion anterior, pero el test nunca fue actualizado para reflejarlo. **No se reescribio el test** porque asumir la intencion correcta del mensaje/status esperado es una decision de producto.

## Riesgos abiertos / backlog explicito

- Los dos tests de arriba deben resolverse por alguien con contexto de negocio (¿test desactualizado o bug real?).
- `AttendanceWidget.jsx` (3500+ lineas) no fue rediseñado estructuralmente — se hicieron adiciones puntuales (bandeja de pendientes, `handleSessionExpired`) sin tocar su logica operacional duplicada frente a `AttendanceAction` (hallazgo D1 de Fase 0). Unificar ambos flujos en un solo componente/hook queda pendiente y es la pieza de mayor riesgo/esfuerzo restante del plan.
- No hay cola de reintento offline real (Fase 3) ni recordatorios push server-side (Fase 6): ambos requieren infraestructura nueva (service worker / jobs de notificaciones) que no se implemento sin poder probarla end-to-end.
- No fue posible verificar el esquema real de Neon ni ejecutar pruebas E2E en un iPhone real — todo el trabajo fue verificado con lint, `node -c`, y la suite de Jest existente.
- El working tree tenia (y tiene) ~80 archivos modificados sin commitear de trabajo previo no relacionado a este plan; cada commit de fase se limito a los archivos tocados por esa fase, pero en archivos grandes (`AttendanceWidget.jsx`, `AttendanceAction.jsx`) el diff de git mezcla ese trabajo previo con los cambios propios de esta sesion (declarado en cada mensaje de commit).

## Definicion de terminado — verificacion contra el plan original

- ✅ Marcar desde iPhone: MobileShortcuts + AttendanceAction comparten vocabulario y ayuda contextual.
- ✅ Sesion no rompe continuidad del atajo: `returnUrl` exacto preservado en expiracion automatica.
- ⚠️ Flujo visible coincide con logica real backend: coincide donde el backend ya expone `canonical_flow`; el Widget aun tiene logica operacional propia no unificada (backlog).
- ⚠️ Permisos/salidas/viaticos como una sola experiencia: aviso de viatico agregado; enlaces directos a los modulos personales quedan pendientes de ruta.
- ✅ Dashboard con estado actual + pendientes: bandeja de pendientes en el widget.
- ✅ Ayudas y errores claros: mapa de errores completo + ayuda contextual por accion.
- ⚠️ Las dos entradas (widget/deep-link) se comportan de forma consistente: mejorado (vocabulario compartido), no unificado estructuralmente.
