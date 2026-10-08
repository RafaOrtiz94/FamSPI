# Plan: Flujo unificado de solicitudes de Servicio Técnico

## Objetivo

Reflejar en código el flujo real que describe el negocio:

> Llega una solicitud (comercial, inspección de ambiente, retiro, o cualquier otra que
> maneje servicio) → pasa a **jefe_servicio**, quien coordina: pone fecha, agenda y
> planifica con su equipo quién la va a cumplir → el proceso pasa al **asignado**
> (`ing_servicio`, `jefe_servicio` o `esp_app`) → el asignado tiene un apartado propio
> para cumplirla → todo esto debe sincronizarse con los eventos del Business Case (BC).

Este plan es solo de esta franja del proceso (intake → coordinación → cumplimiento →
sync BC). La reorganización de roles/menú/navegación más amplia se acordó por separado
(propuesta compartida como artifact en la conversación) — este documento es más angosto
y más profundo, específico al flujo de trabajo.

---

## Estado actual real (verificado en código, no supuesto)

| Pieza del flujo descrito | ¿Existe? | Dónde |
|---|---|---|
| Intake con tipos "inspección de ambiente" y "retiro" | ✅ Existe | `requests`/`request_types`: `F.ST-20` (inspección), `F.ST-21` (retiro) — `backend/src/modules/requests/requests.service.js:58-71` |
| Solicitud llega con `jefe_servicio` como aprobador | ✅ Existe | `getRequestApproverRoles()` mapea F.ST-20/21 a `jefe_servicio` y variantes — `requests.service.js:466-482` |
| Endpoint donde jefe_servicio pone fecha + asigna responsable, para F.ST-20 | ✅ Existe (corregido) | **Corrección (2026-08-12):** no había que construirlo — ya existía dentro de `POST /api/v1/approvals/:id/approve` (`approvals.service.js:112`, body `{ assigned_user_id, inspection_date, notes }`), pero tenía 2 bugs reales: el rol literal `jefe_servicio` no estaba en el gate de la ruta (`approvals.routes.js`, solo `jefe_servicio_tecnico`/`jefe_tecnico`) y `assigned_user_id` no validaba rol del asignado (cualquier `user_id` pasaba). Ambos arreglados. Sigue sin cubrir F.ST-21/retiro ni "otras" — eso queda para extender esta misma función. |
| `esp_app` como asignable | ✅ Arreglado en `approvals.service.js` | La validación nueva usa `ROLE_GROUPS.tecnico` (incluye `ing_servicio`, `esp_app`, `jefe_servicio` y alias). Pendiente: `private-purchases`/`equipment-purchases` siguen sin incluirlo en su propia validación — no tocado en este incremento. |
| Apartado de "cumplimiento" para el asignado (marcar completado, subir evidencia) | ⚠️ Existe pero fragmentado | `PATCH /:id/site-inspection` (compras) y `POST /:id/inspection-result` (F.ST-20 genérico) son dos implementaciones **independientes** del mismo concepto — no hay una sola vista "mi trabajo asignado" |
| "Cronograma Técnico" como agenda de asignación | ⚠️ Es de solo lectura | `technicalSchedule.service.js` (`GET /servicio/cronograma/feed`) **agrega** datos de 5 fuentes distintas para mostrarlos en calendario, pero no es donde se asigna — la asignación real pasa en los módulos de compras por separado |
| Retiro (`F.ST-21`) colgado del mismo intake que todo lo demás | ✅ Existe | `withdrawalWorkflow.service.js:473-513` valida `rt.code === 'F.ST-21'` contra la misma tabla `requests` |
| Sincronización con eventos del Business Case | ✅ Existe (corregido) | **Corrección (2026-08-12):** mi búsqueda inicial fue incompleta. `businessCase.controller.js:reviewEnvironmentInspectionRequest` ya inserta en `servicio.cronograma_actividades_tecnicas` (`source_type='inspeccion_bc'`) al coordinar la inspección de ambiente propia del BC — la misma tabla que lee `technicalSchedule.service.js`. Le faltaba validar el rol del asignado (mismo bug que los otros 3 puntos de coordinación); ya arreglado. |

**Conclusión clave**: el problema no es solo de UI. La lógica de "jefe_servicio agenda
y asigna" existe **duplicada dos veces** (una por cada tipo de compra) y **no existe en
absoluto** para el resto de tipos de solicitud (F.ST-20 genérico, retiro). Unificar esto
es el trabajo real de este plan, no un simple reordenamiento de menú.

---

## Pregunta abierta antes de poder planear la Fase D (sync BC)

El código de `business-case` **no tiene ningún concepto de "eventos"** (fechas de
instalación, entrega, etc. — grep vacío). Antes de construir la sincronización necesito
que me confirmes: **¿qué es exactamente un "evento del BC"?** ¿Es la fecha de entrega
de un equipo comprado, la fecha de instalación, un hito del workflow de aprobación, o
algo que todavía no existe en ningún lado y hay que crear desde cero? Sin esto no puedo
diseñar la Fase D — sería inventar un modelo de datos que no corresponde a como
realmente funciona el negocio.

---

## Flujo objetivo (estado propuesto)

```
Solicitado
   │  (comercial crea F.ST-19/20/21/22, o servicio genera uno interno)
   ▼
Coordinado          ← jefe_servicio pone fecha + elige asignado (ing_servicio | esp_app | el mismo jefe_servicio)
   │
   ▼
Asignado             ← el asignado ve la solicitud en su apartado "Mi trabajo asignado"
   │
   ▼
En cumplimiento       ← el asignado ejecuta, sube evidencia/checklist
   │
   ▼
Completado            ← (Fase D) dispara/consulta el evento correspondiente del BC si aplica
```

Este es el mismo estado que hoy YA tienen las inspecciones de compras (`registerSiteInspection`)
— la propuesta es generalizar ese patrón probado a **todos** los tipos de solicitud que
maneja servicio, en vez de mantenerlo especial-cased solo para compras.

---

## Fases (poco a poco, cada una independiente y probada)

### Fase A — Endpoint único de coordinación
**✅ A1/A2 hechos (2026-08-12).** No hubo que construir un endpoint nuevo: `POST
/api/v1/approvals/:id/approve` ya era el punto donde jefe_servicio pone fecha + asigna
responsable para F.ST-20. Se arreglaron sus 2 bugs reales:
- `approvals.routes.js` — el gate de `/approve` y `/reject` usaba el array literal
  `["jefe_servicio_tecnico", "jefe_tecnico"]`, que **no incluía el rol `jefe_servicio`
  en sí**. Cambiado a `requireRole(["jefe_servicio"])`, que expande automáticamente a
  todos los alias vía `ROLE_GROUPS` en `middlewares/roles.js` — una sola fuente de
  verdad, ya existía, solo no se estaba usando.
- `approvals.service.js` `approve()` — `assigned_user_id` no validaba el rol del
  usuario asignado (cualquier `user_id` pasaba). Ahora valida contra
  `ROLE_GROUPS.tecnico` (incluye `ing_servicio`, `esp_app`, `jefe_servicio` y alias).
- 6 tests nuevos en `approvals.service.test.js` cubriendo: rechazo de asignado sin rol
  de servicio, aceptación con cada rol válido (`ing_servicio`, `esp_app`,
  `jefe_servicio`, `jefe_tecnico`), y validación de campos requeridos. Suite completa:
  84/84 test suites, 508 tests, 0 fallos.

**✅ A3 hecho (2026-08-12) — extendido a retiro (F.ST-21).** Investigué
`withdrawalWorkflow.service.js` y retiro **ya tenía su propia coordinación** (fecha via
acción `coordinate_withdrawal`) — pero la "asignación" (`open_work_order`) guardaba
`assigned_to`/`assigned_email` como **texto libre sin validar**, sin `user_id` real, sin
notificar a nadie. Es decir: ni siquiera existía el concepto de "usuario asignado" para
retiro, solo una etiqueta de texto.

Arreglado sin romper compatibilidad: `open_work_order` ahora acepta un
`assigned_user_id` opcional — si viene, valida el rol (mismo chequeo
`ROLE_GROUPS.tecnico`) y notifica al asignado real. Si no viene, sigue funcionando
exactamente igual que antes (texto libre, sin romper nada existente). 6 tests nuevos en
`withdrawalWorkflow.assignee.test.js`. Suite completa: 85/85 test suites, 514 tests,
0 fallos.

**Pendiente de A**: el endpoint de coordinación de F.ST-20 (`approvals.service.js`) y
el de retiro (`withdrawalWorkflow.service.js`) siguen siendo dos implementaciones
independientes con su propia validación duplicada — funcionalmente ya consistentes,
pero no comparten código. Unificarlas en una sola función es posible pero no urgente
(bajo riesgo mantenerlas separadas por ahora).

### Fase B — "Mi trabajo asignado" (apartado de cumplimiento)
**Descubrimiento (2026-08-12): ya existía parcialmente.** El cronograma técnico
(`GET /servicio/cronograma/feed?scope=mine`) ya le muestra a `ing_servicio`/`esp_app`
sus actividades asignadas por defecto — gracias a Fase A, ahora escribe correctamente
ahí. `Disponibilidad.jsx` ya lo presenta como una vista real "Mi agenda" (no solo un
calendario genérico), con botón "Abrir origen" por fila. No hubo que construir una
vista nueva. Dos gaps reales encontrados y arreglados:

- **Retiro (F.ST-21) no tenía visibilidad personal en absoluto** — no aparece en el
  cronograma, y `RetiroEquipos.jsx` mostraba todos los retiros sin filtro por asignado
  (el asignado tenía que buscar/escanear la lista completa). Arreglado: checkbox "Solo
  asignados a mí" + badge visual en la fila, usando el `assigned_user_id` que Fase A
  ya empezó a guardar.
- **"Abrir origen" aterrizaba en la pestaña equivocada** para 5 de los 6 tipos de
  inspección (F.ST-20, compra pública/privada, reinspecciones) — todos pasaban por
  `/inspecciones`, un redirect fijo en `AppRoutes.jsx` que descarta el query string, así
  que el asignado siempre caía en "Business Case" sin importar su tipo real. Arreglado:
  `technicalSchedule.service.js`'s `SOURCE_CONFIG` ahora apunta directo a
  `/dashboard/servicio-tecnico/solicitudes?tab=inspeccion&subtab=<correcto>`, y
  `Solicitudes.jsx` lee esos params para abrir la sub-pestaña correcta. 6 tests nuevos
  (`technicalSchedule.sourcePaths.test.js`) evitan que se reintroduzca el path roto.

Suite completa: 86/86 test suites, 522 tests, 0 fallos.

**No se construyó** (evaluado y descartado, no encaja en "poco a poco"): unificar los 3
componentes de "marcar completado" (inspección independiente, inspección de compra,
retiro) en un solo componente compartido. Son formularios con datos y flujos realmente
distintos — forzarlos a compartir código sería más riesgo que beneficio para el
problema real reportado. Quedan como 3 implementaciones separadas pero, con los fixes
de arriba, todas alcanzables desde el apartado correcto.

### Fase C — Incluir `esp_app` donde falta
**✅ Hecha (2026-08-12).** Encontré algo peor que "falta esp_app": en
`equipmentPurchases.service.js`, `canRegisterSiteInspection`/`canViewInspectionQueue`
usaban listas de tokens (`tecnico, jefe_tecnico, jefe_servicio, jefe_servicio_tecnico`)
que **tampoco cubrían `ing_servicio`** — el rol principal de técnico de campo no podía
ni ver ni registrar inspecciones de compra pública. El matching es por substring
(`role.includes(token)`), y ni "ing_servicio" ni "esp_app" contienen ninguno de esos
tokens. Arreglado en `private-purchases` y `equipment-purchases` (ambos), agregando
`ing_servicio`/`esp_app` a las listas. 16 tests nuevos. Suite: 87/87, 536 tests.

### Fase D — Sync con eventos del BC
**Corrección grande a lo documentado antes (2026-08-12): esto NO estaba bloqueado, y
mi diagnóstico anterior ("no existe ningún concepto de eventos en BC") estaba
incompleto** — no busqué lo suficiente la primera vez. Al revisar Fase C encontré que
`businessCase.controller.js` (`reviewEnvironmentInspectionRequest`, endpoint
`POST /:id/inspection-request/review`) **ya es un cuarto punto de coordinación**
(fecha + técnico asignado), independiente de los otros 3 (F.ST-20, retiro,
private-purchases/equipment-purchases): cuando un BC solicita su propia "inspección de
ambiente" (guardada en `modern_bc_metadata.environment_inspection_request`, no en la
tabla `requests`), al aprobarla se inserta una fila en
`servicio.cronograma_actividades_tecnicas` con `source_type='inspeccion_bc'` — la misma
tabla compartida que ya lee `technicalSchedule.service.js`. Es decir: **el "evento del
BC" que preguntaba es la inspección de ambiente del BC, y ya sincroniza con el
cronograma** — el sync no había que construirlo.

Lo que sí faltaba (mismo bug de los otros 3 puntos): **cero validación de rol en el
usuario asignado** — solo se chequeaba que el `user_id` existiera. Arreglado con el
mismo patrón (`ROLE_GROUPS.tecnico`).

**Sigue abierto**: no puedo confirmar si "evento del BC" para ti significa *solo* esto
(inspección de ambiente) o también otros hitos (fecha de entrega, fecha de instalación)
que no encontré modelados en ningún lado del código de `business-case`. Si es solo la
inspección de ambiente, Fase D ya está resuelta. Si hay más, decime cuáles.

### Fase E — Cronograma como vista, no como sistema aparte
**✅ Ya estaba resuelta, sin tocar código (2026-08-12).** Verifiqué
`getTechnicalScheduleFeed`: hace `SELECT * FROM servicio.cronograma_actividades_tecnicas`
sin filtrar por `source_type` — es genérico. Cualquier fila que se inserte ahí (F.ST-20,
retiro no aplica porque usa su propia tabla, inspección BC) aparece automáticamente en
el feed. No era un placeholder muerto como documenté al principio, era una lectura
genérica que no verifiqué bien la primera vez.

**Las 5 fases del plan original quedan cerradas.**

---

## Extra: menú de servicio-técnico completado (2026-08-12)
Los 4 hallazgos originales del mapeo (§6 del reorg) sobre páginas sin link en el menú
— Aprobaciones, Desinfección, Verificación de Equipos, Casos Externos — se agregaron a
`NavigationBar.jsx`. Cambio puramente aditivo: todas ya eran rutas reales, ruteadas y
con roles asignados, solo faltaba el link. Nada se quitó ni se restringió.

## Extra: walkthrough UX como jefe_servicio / ing_servicio (2026-08-12)
Recorrido persona-por-persona de los flujos reales (no solo lectura de código) para
encontrar fricción real de uso. 7 hallazgos, priorizados; implementados los 3 primeros:

1. **✅ Hecho** — Tiles "Retiros"/"Inspecciones" del dashboard aterrizaban en la pestaña
   equivocada (mismo bug de redirect sin query string que ya se había arreglado para el
   cronograma, pero afectaba también los accesos directos del dashboard). Arreglado en
   `AppRoutes.jsx` (`/inspecciones` → `?tab=inspeccion`, `/retiros` → `?tab=retiro&subtab=compras`).
2. ⏳ Pendiente — Widget "Aprobaciones pendientes" del dashboard deja aprobar F.ST-20/21
   sin asignar técnico ni fecha, duplicando (mal) el flujo completo. Requiere decidir si
   se quita la acción del widget o se redirige al panel completo — no se tocó, es más
   delicado que un fix aditivo.
3. **✅ Hecho** — `InspectionRequestsWorkspace.jsx` no tenía filtro "asignado a mí" (sí lo
   tenía `RetiroEquipos.jsx` desde la Fase B). Portado el mismo patrón (checkbox + badge).
   Nota: solo aplica a los orígenes `bc`/`compras` — el origen `independientes` (F.ST-20
   nativo) no trae el `assigned_user_id` de vuelta al frontend hoy, así que el checkbox
   se oculta ahí en vez de mostrar un filtro que nunca encontraría nada.
4. **✅ Hecho** — "Retiro → Independientes" era un callejón sin salida permanente (un
   componente que siempre mostraba "vacío", nunca datos reales — estructuralmente
   imposible de poblar, porque todo retiro cuelga de `request_type_id` en la misma tabla
   `requests`, no hay flujo de creación independiente). Se quitó el sub-tab.
5. ⏳ Pendiente — 4 componentes muertos sin usar (`JefeTecnicoSolicitudesView.jsx`,
   `TecnicoSolicitudesView.jsx`, `BcInspectionList.jsx`, `InspeccionesIndependientesList.jsx`).
6. ⏳ Pendiente — el verbo de "coordinar" cambia 4 veces entre los mismos flujos.
7. ⏳ Pendiente — "Mis asignaciones pendientes" del dashboard del técnico solo muestra
   mantenimientos pese al nombre genérico.

---

## Qué NO cambia con este plan
- Los tipos de solicitud (F.ST-19/20/21/22) siguen siendo los mismos — no se renombran.
- El intake sigue siendo `requests`/`request_types` — no se crea una tabla paralela.
- Retiro sigue colgado de `request_type_id`, sin cambios en `withdrawalWorkflow.service.js`.

---

## Extra: limpieza de código muerto (2026-08-12)
Auditoría completa de servicio técnico vs. el catálogo `REQ-ST-001..152` (ver
`docs/Procedimientos/Servicio/`). Hallazgo principal: la documentación de requerimientos
está desactualizada — preventivos, correctivos y casos externos (REXIS/Navify/GoApp) YA
tienen soporte real de código (`preventivePlanning.service.js`, `correctiveCases.service.js`,
`externalCases.service.js` + adapters), pese a que el documento los marcaba "no
evidenciado". No se necesita construir esos 3 SOP desde cero.

Borrado confirmado (cero imports vivos, verificado con grep antes y después):
`TechnicalProcedureWorkspace.jsx` (1258 líneas, sin ruta que lo renderizara),
`SiteInspectionStepper.jsx` y `SiteInspectionSummaryCard.jsx` (solo usados por el
anterior), `components/Capacitaciones.jsx` (219 líneas, sin ningún import).

`RetiroEquipos.jsx` restilizado al mismo patrón rail+panel de
`InspectionRequestsWorkspace.jsx` (antes tabla+detalle) — mismo lenguaje visual dentro
de `Solicitudes.jsx`, sin tocar lógica/handlers.

## Fase F — Cerrar los pendientes #2 y #7 de la sección anterior: "Mis pendientes" real
Los dos pendientes de la sección "walkthrough UX" siguen abiertos y son la base de lo
que jefe_servicio/ing_servicio/esp_app necesitan ver en un solo lugar:

- **#7**: el dashboard del técnico dice "Mis asignaciones pendientes" pero solo lee
  mantenimientos — no inspección, no retiro, no correctivos.
- **#2**: el widget "Aprobaciones pendientes" del dashboard deja aprobar F.ST-20/21 sin
  pasar por el panel completo de asignación de técnico/fecha.

**Verificado antes de proponer solución** (regla de la skill `analisis-previo-desarrollo`):
`technicalSchedule.service.js`'s `SOURCE_CONFIG` hoy cubre `manual`, `actividad_tecnica`,
`mantenimiento`, `capacitacion` y 5 variantes de inspección — **no cubre retiro (F.ST-21,
vive en `servicio.withdrawal_workflows`, tabla separada) ni correctivos (viven en
`correctiveCases.service.js`, tabla propia)**. Antes de poder armar un "Mis pendientes"
de verdad completo, el feed unificado tiene que aprender a leer esas dos fuentes también
— si no, el widget mentiría por omisión igual que el dashboard actual.

Pasos:
1. Backend — extender `getTechnicalScheduleFeed` (`technicalSchedule.service.js`) para
   unionar también filas de `servicio.withdrawal_workflows` (retiro, con su
   `assigned_user_id` ya real desde Fase A) y de casos correctivos abiertos asignados a
   un técnico (`correctiveCases.service.js`). Reutilizar `SOURCE_CONFIG` — agregar
   entradas `retiro` y `correctivo` con su `path` real (`/solicitudes?tab=retiro...`,
   `/mantenimientos?tab=corrective`). No se toca el esquema de las tablas origen, solo
   el `SELECT`/`UNION` del feed.
2. Frontend — en el dashboard del técnico (donde vive el pendiente #7), reemplazar la
   lectura "solo mantenimientos" por el feed ya extendido con `scope=mine`, agrupado por
   categoría con conteo (inspección / retiro / correctivo / mantenimiento /
   capacitación) y deep-link real a cada uno (mismo patrón que ya usa `Disponibilidad.jsx`).
3. Frontend — en el widget "Aprobaciones pendientes" (pendiente #2), decidir entre quitar
   la acción de aprobar-sin-asignar o redirigirla al panel completo de coordinación —
   esto es una decisión de producto, no solo técnica, así que se confirma con
   `AskUserQuestion` antes de tocarlo cuando llegue el turno de esta fase.

## Fase G — Calendario visual real (mes/semana)
**Verificado**: `Disponibilidad.jsx` hoy es una vista de **agenda/lista** (filas
ordenadas por fecha), no una grilla de calendario — no hay componente de mes/semana, no
hay librería de calendario. El pedido de "calendario visual donde estén todas las
actividades" es un gap real, no algo que ya exista con otro nombre.

Pasos:
1. Depende de la Fase F: el calendario debe leer el mismo feed ya extendido con retiro y
   correctivos — si se construye antes, seria un calendario visualmente lindo pero
   incompleto (mismo problema que el dashboard actual).
2. Frontend — agregar una vista de grilla (mes, con toggle a semana) dentro de
   `Disponibilidad.jsx` como pestaña alternativa a la agenda actual (no reemplazo: la
   lista sigue sirviendo para escanear rápido, la grilla sirve para ver huecos/densidad
   por día). Sin librería nueva de calendario — un grid CSS con `SCHEDULE_BADGES` ya
   existente por categoría (inspección/mantenimiento/retiro/correctivo/capacitación/manual)
   es suficiente para el volumen de datos de este cronograma; evita sumar una dependencia
   nueva para lo que un `grid-cols-7` con eventos por celda ya resuelve.
3. Reutilizar `scope=mine|team` que el feed ya soporta, así jefe_servicio ve el
   calendario de todo el equipo y ing_servicio/esp_app ven el suyo, sin pantallas
   separadas.

## Orden recomendado
Fase F (backend del feed) → Fase F (dashboard "Mis pendientes") → Fase G (calendario
visual, depende del feed ya extendido) → Fase F punto 3 (decisión de producto sobre
aprobaciones, puede ir en paralelo por ser independiente).
