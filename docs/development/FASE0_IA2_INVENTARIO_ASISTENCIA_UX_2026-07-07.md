# Fase 0 (IA-2) — Inventario UX de Asistencia

> Entregable de IA-2 para la Fase 0 del [Plan Maestro](PLAN_MAESTRO_ASISTENCIA_Y_SALIDAS_UX_2026-07-07.md).
> Alcance: `AttendanceWidget.jsx`, `AttendanceAction.jsx`, `MobileShortcuts.jsx`.
> No se modifico codigo en este entregable — solo lectura y documentacion, siguiendo la regla de no-colision (IA-2 no toca backend salvo para documentar dependencias).

## 1. Inventario de pantallas

### 1.1 `AttendanceWidget.jsx` (dashboard, `spi_front/src/core/ui/widgets/`)
Widget persistente en dashboard. Estados internos relevantes (useState):
- `attendance` (registro del dia), `activeException` (salida activa: operacional o inesperada)
- Modales: `widgetModalOpen` (modal principal "Asistencia"), `exceptionModalOpen`, `operationalModalOpen` (fases `start|close`), `exitConfirmOpen` ("Confirmar salida"), `overtimePrompt`, `lateJustificationModalOpen`, `entryRegularizationOpen`
- Herramientas de campo: `showFieldTools`, `fieldVisitType` (`cronograma|prospecto|emergencia`), `selectedFieldAction` (`office_exit|client_entry|client_exit|office_entry`)
- Timeline: `showTimelineDetails`, `recentHistory` (5 dias)
- Reintento: no existe cola offline; `handle()` reintenta ubicacion pero no la operacion en si (ver duplicidad D3)

Titulos de modal detectados: "Asistencia" (principal), "Registrar horas extra", "Justificar atraso", "Solicitar regularizacion de entrada", "Confirmar salida".

Flujo operacional propio (`operationalModalOpen` + `operationalModalPhase`) que **reimplementa** — con su propio estado y validaciones — el mismo ciclo salida/llegada/cierre que ya existe en `AttendanceAction` via deep-link (`salida-oficina → llegada-destino → cierre-viaje`).

### 1.2 `AttendanceAction.jsx` (`spi_front/src/modules/shared/pages/`)
Pantalla de destino de deep-links / iPhone Shortcuts (`/asistencia/marcar/:action?params`). Maquina de estados lineal: `initializing → geolocating → processing → success | error`, mas dos pasos previos opcionales:
- `needsManualClientStep` (falta `client_id`/`prospect_name` en la URL)
- `needsPostVisitDecisionStep` (solo en `cliente-salida`/`salida-cliente` sin `return_to_office` en la URL)
- `requiresOperationalStep` (paso de captura categoria/vehiculo/odometro para `salida-oficina`, `salida-campo`, `entrada-oficina`, `entrada-campo`, `cierre-viaje`)

12 `action` distintos en `ACTION_MAP`, varios con alias duplicados (ver 3.1).

### 1.3 `MobileShortcuts.jsx` (`spi_front/src/modules/shared/pages/`)
Landing de botones grandes para iPhone. Dos secciones: "Jornada" (4 botones fijos) y "Salidas y visitas" (7 botones, filtrados por rol via `FIELD_OPERATION_ROLES`). Cada boton es un `<Link>` directo a `AttendanceAction` (no hay estado de sesion previo, no hay preview de "siguiente paso sugerido" — ver Fase 1 recomendacion 2).

## 2. Duplicidades / inconsistencias detectadas

| ID | Descripcion | Impacto | Fase sugerida |
|----|---|---|---|
| D1 | El ciclo operacional (salida → destino → cierre) existe **dos veces**: modal propio en `AttendanceWidget` (`operationalModalOpen`) y flujo de pasos en `AttendanceAction` para las mismas acciones (`salida-oficina`, `entrada-oficina`, etc). Validaciones de vehiculo/odometro estan duplicadas con logica ligeramente distinta entre ambos. | Riesgo de que un fix se aplique en un lado y no en el otro (ya paso: la version widget agrega `showFieldTools`/agenda de cronograma que `AttendanceAction` no tiene). | Fase 1 (contrato unico) / Fase 3 |
| D2 | `MobileShortcuts` no usa el "siguiente paso" que ya calcula `AttendanceAction.getNextStepHint` — el usuario ve 11 botones sin jerarquia segun donde esta parado (recomendacion 2, 12). | Confusion sobre que boton tocar si ya tiene una jornada en curso. | Fase 1 / Fase 3 |
| D3 | No existe cola/reintento real ante fallo de red (recomendacion 8): `AttendanceAction` solo reintenta con `window.location.reload()`; `AttendanceWidget.handle()` no reintenta la operacion, solo relanza `getLocationForAction`. | Perdida de contexto ingresado (formularios de salida operacional) si falla el POST. | Fase 3 |
| D4 | Mensajes de error se arman en 3 lugares distintos: `attendanceErrorUtils.js` (mapa por `code`), `resolveFriendlyDuplicateMessage` en `AttendanceAction.jsx` (heuristica por texto de `backendMessage`), y strings inline en `AttendanceWidget.jsx` (`showToast("...")` literal, ~35 ocurrencias). | Mensajes inconsistentes para el mismo error segun se entre por widget o por deep-link. | Fase 0 (IA-1 debe exponer `code` consistente) → Fase 3 |
| D5 | Alias multiples para la misma accion en `ACTION_MAP` (`almuerzo-salida` / `salida-almuerzo` / `almuerzo` todos → `marcarAlmuerzoSalida`; `salida-oficina` y `salida-campo` → logica identica; `retorno-operacional` y `regreso-operacional` → identico) — es intencional para compatibilidad con Shortcuts en espanol (ver `CONTEXT.md` del modulo backend), no es un bug, pero **no hay un mapa central** de labels: los labels se repiten en `AttendanceAction.ACTION_MAP`, `MobileShortcuts.baseShortcuts/fieldShortcuts` y los `getStatusInfo()`/textos del widget. | Si se cambia un label hay que tocarlo en 3 archivos. | Fase 1 (helper/shared map de flujo, recomendacion 1) |
| D6 | `AttendanceAction` no distingue "sesion expirada" de "sin sesion" (recomendacion 4): al fallar por 401 solo pasa por el manejador generico de error (`getAttendanceErrorInfo`) y no preserva la URL exacta del atajo para volver tras login. `AttendanceWidget` si hace `logout()` explicito en 401. | Al perder sesion desde un atajo iPhone, el usuario no vuelve al mismo paso. | Fase 2 |

## 3. Matriz accion → endpoint → pantalla → mensajes → siguiente paso

Fuente: `attendanceApi.js` (nombres de funcion), `AttendanceAction.ACTION_MAP`, `MobileShortcuts` botones, `AttendanceWidget` handlers.

| Accion (UI) | `action` deep-link | Funcion API | Endpoint backend (alias `/asistencia/marcar/...`) | Pantalla(s) origen | Mensaje exito | Mensaje error tipico | Siguiente paso (`getNextStepHint`) |
|---|---|---|---|---|---|---|---|
| Marcar entrada | `entrada` | `marcarEntrada` / `clockIn` | `POST /clock-in` | Widget, MobileShortcuts, AttendanceAction | "Entrada registrada correctamente." | 401/409/422 (GPS) via `getAttendanceErrorInfo` | "Continúa con salida a almuerzo cuando corresponda." |
| Salida almuerzo | `almuerzo-salida` \| `salida-almuerzo` \| `almuerzo` | `marcarAlmuerzoSalida` / `clockOutLunch` | `POST /clock-out-lunch` | Widget, MobileShortcuts, AttendanceAction | idem | idem | "Continúa con entrada de almuerzo cuando regreses." |
| Entrada almuerzo | `almuerzo-entrada` \| `entrada-almuerzo` | `marcarAlmuerzoEntrada` / `clockInLunch` | `POST /clock-in-lunch` | Widget, MobileShortcuts, AttendanceAction | idem | idem | "Continúa con salida final al cerrar tu jornada." |
| Salida final | `salida` \| `salida-final` | `marcarSalida` / `clockOut` | `POST /clock-out` | Widget, MobileShortcuts, AttendanceAction | idem | idem | "Tu jornada ya está cerrada." |
| Salida operacional (nueva salida/visita) | `salida-oficina` \| `salida-campo` | `marcarSalidaOficina` | `POST /marcar/salida-oficina` (o `/salida-campo`) | Widget (modal propio), MobileShortcuts, AttendanceAction (paso categoria+vehiculo) | "Salida operacional registrada." | "No tienes una salida de oficina activa..."; "Ya tienes una operacion de campo activa." | "Continúa con llegada a destino y luego entrada oficina para cerrar." |
| Llegada a destino | `llegada-destino` | `marcarLlegadaDestino` | `POST /marcar/llegada-destino` | Widget, MobileShortcuts, AttendanceAction | "Llegada a destino registrada." | "No tienes una salida operacional activa." | "Continúa con salida/entrada de cliente o cierre de viaje." |
| Entrada cliente | `cliente-entrada` \| `entrada-cliente` | `marcarVisitaEntrada` | `POST /marcar/visita-entrada` (alias `/cliente-entrada`) | Widget (field tools), MobileShortcuts (solo roles con campo), AttendanceAction (requiere `client_id`/`prospect_name`, si faltan → paso manual) | "Entrada de cliente registrada correctamente." | `NO_ACTIVE_VISIT`, falta cliente/prospecto | "Continúa con salida de cliente al terminar la visita." |
| Salida cliente | `cliente-salida` \| `salida-cliente` | `marcarVisitaSalida` | `POST /marcar/visita-salida` (alias `/cliente-salida`) | Widget, MobileShortcuts, AttendanceAction (paso extra: decidir `continue_operation` vs `return_to_office` si no viene en la URL) | "Salida de cliente registrada correctamente." | `NO_ACTIVE_VISIT` → se resuelve como exito silencioso ("ya estaba cerrada") | "Visita cerrada correctamente." |
| Retorno operacional | `retorno-operacional` \| `regreso-operacional` | `updateExceptionStatus("RETURNING")` | `POST /exception/status` | Widget, MobileShortcuts, AttendanceAction | via `successMsg` generico | "No tienes una salida operacional activa." | "Continúa con entrada oficina para cerrar el ciclo operacional." |
| Cierre operacional (entrada oficina) | `entrada-oficina` \| `entrada-campo` | `marcarEntradaOficina` | `POST /marcar/entrada-oficina` (o `/entrada-campo`) | Widget, MobileShortcuts, AttendanceAction (paso odometro final si aplica) | "No se pudo cerrar la salida operacional." / exito generico | requiere `ensureExceptionFlow("operational")` — error si la excepcion activa es "inesperada" | "Ciclo operacional cerrado correctamente." |
| Cierre de viaje (fuera de oficina) | `cierre-viaje` | `marcarCierreViaje` | `POST /marcar/cierre-viaje` | Widget (via `openOperationalModal("close")` tras cerrar destino), MobileShortcuts, AttendanceAction | "No se pudo cerrar el viaje." / exito generico | idem `ensureExceptionFlow` | "Viaje cerrado correctamente." |
| Salida inesperada (excepcion) | *(sin deep-link directo, solo Widget)* | `registerException` | `POST /exception` | Widget (`exceptionModalOpen`) | contextual (`successMsg` por caso) | "La salida activa actual es operacional..." | N/A — no tiene alias en `ACTION_MAP` |
| Horas extra | *(sin deep-link)* | `markOvertime` | `POST /overtime` | Widget (modal "Registrar horas extra") | "Horas extra registradas correctamente." | "Debes registrar la razon de las horas extra." | N/A |
| Justificar atraso | *(sin deep-link)* | `justifyLateArrival` | `POST /late-justification` | Widget (modal "Justificar atraso") | "Justificación de atraso registrada." | "Describe una justificación de al menos 8 caracteres." | N/A |
| Regularizacion de entrada | *(sin deep-link)* | `requestEntryRegularization` | *(no confirmado — requiere verificacion IA-1)* | Widget (modal "Solicitar regularizacion de entrada") | "Solicitud enviada a Talento Humano." | "Describe el motivo con al menos 8 caracteres." | N/A |

**Nota:** las acciones sin deep-link (`registerException`, `markOvertime`, `justifyLateArrival`, `requestEntryRegularization`) solo son accesibles desde el Widget de dashboard — no existen como atajo iPhone. Es una brecha real frente a la recomendacion 5 ("vista movil realmente optimizada") si el usuario opera 100% desde el telefono via Shortcuts.

## 4. Codigos/estados HTTP observados desde el frontend (para contraste con IA-1)

Deducido de `attendanceErrorUtils.js` y manejo inline en ambos componentes — **no verificado contra el controller real**, es lo que el frontend ya asume hoy:

- `401` → sesion expirada (Widget hace logout automatico; AttendanceAction no)
- `403` → sin permisos para la operacion
- `404` + `code=NO_ACTIVE_VISIT` → visita ya cerrada / no habia visita activa (tratado como exito silencioso)
- `404` + `code=NO_ACTIVE_OPERATIONAL` → posible cierre duplicado (tratado como "ya estaba cerrada")
- `409` → conflicto de marca duplicada; ambos componentes intentan "recuperar" recargando el estado (`resolveAttendanceConflict` / `resolveExceptionConflict` en Widget; mensaje amistoso en Action)
- `422` → GPS requerido / precision baja (`LOCATION_REQUIRED_RETRY`, `LOCATION_ACCURACY_LOW`) — **no** dispara recuperacion de conflicto, solo muestra el mensaje
- `>=500` → error de servidor generico

Estos codigos y sus nombres reales deben ser confirmados por IA-1 contra `attendance.controller.js` en su propio entregable de Fase 0 (pendiente).

## 5. Criterio de salida (lado IA-2)

- [x] Estados visuales de los 3 componentes inventariados
- [x] Duplicidades y decisiones inconsistentes documentadas (D1–D6)
- [x] Botones visibles por flujo documentados
- [x] Matriz accion/endpoint/pantalla/mensajes/siguiente paso levantada
- [ ] **Pendiente de IA-1**: matriz de errores `401/409/422/500` confirmada contra el controller real, y nombres reales de estados en `attendance_exceptions` / `user_attendance_records` — sin esto, Fase 1 (contrato canonico) no puede cerrarse del todo.

## Handoff Fase 0 (IA-2)
- Estado: inventario frontend completo, sin cambios de codigo.
- Archivos leidos (sin modificar): `AttendanceWidget.jsx`, `AttendanceAction.jsx`, `MobileShortcuts.jsx`, `attendanceErrorUtils.js`, `attendanceFlowUtils.js`, `backend/src/modules/attendance/CONTEXT.md`.
- Contratos: ninguno nuevo (fase de solo lectura).
- Riesgos: D1 (logica operacional duplicada widget/deep-link) es el mayor riesgo para Fase 1 — cualquier contrato canonico debe forzar que ambos consuman la misma fuente.
- Pendientes para IA-1: confirmar codigos de error reales, nombres de estado en Neon, y exponer `flow_kind/current_step/next_step/allowed_actions` (Fase 1) partiendo de la matriz de la seccion 3.
