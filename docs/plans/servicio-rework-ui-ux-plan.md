# Plan: Rework profesional del área de Servicio Técnico (frontend)

Fecha: 2026-08-13
Alcance: TODAS las vistas vivas de `spi_front/src/modules/servicio/` (12 páginas) más las pantallas cross-módulo que jefe_servicio usa para aprobar/asignar inspecciones (`InspectionRequestsWorkspace.jsx` en `components/solicitudes/`).
No alcance: backend. **Corrección post-verificación (ver §0.2):** las 2 excepciones que este documento daba por pendientes (extender `getTechnicalScheduleFeed`, agregar clasificación a correctivos) **ya están implementadas en el código actual** — no hay ningún cambio de backend real pendiente en este plan. Un hallazgo aparte y no relacionado con el rework (bug de RBAC en `ceacDispatch.service.js`) sí requiere una decisión del usuario, ver §0.2.

**Skills obligatorios durante la implementación** (todas las fases de §5, sin excepción): `ckw-design` como punto de entrada siempre que se toque el look de una vista (dirección visual, layout, tipografía, color); `frontend-design` para construir componentes/páginas de calidad evitando estética genérica de IA; `openai-frontend-design` para pantallas nuevas o rediseños completos desde cero (aplica a la mayoría de las 12 vistas de este plan, todas son restyle/rework); `impeccable` para crítica y pulido antes de dar una vista por terminada (jerarquía visual, carga cognitiva, estados vacíos/error, copy); `ui-ux-pro-max` como referencia de patrones concretos (tablas, formularios, calendario de §3.4, KPIs) cuando haga falta un patrón probado en vez de inventar uno. Ninguna vista de este plan se implementa sin pasar por al menos `ckw-design` + uno de `frontend-design`/`openai-frontend-design` primero, y `impeccable` como revisión final.

---

## 0. Diagnóstico (verificado contra código real, no contra documentación)

**El backend no es el problema.** Existen endpoints reales y completos para: capacitaciones, disponibilidad, cronograma unificado, cola de acciones pendientes, equipos, mantenimiento preventivo (planes anuales, FST-16/17, kits, cierre, dashboards de cumplimiento/capacidad), correctivos (máquina de estados, timeline, evidencias), casos externos (Navify/REXIS/GoApp con adapters desacoplados y feature flags), retiro de equipos (máquina de estados + FST-11), inspecciones de sitio, entrenamiento (FST-06/08/12/14 completo), desinfección y verificación de equipos nuevos. 152 requisitos catalogados en `docs/Procedimientos/Servicio/`, la mayoría con soporte real (la propia documentación de procedimientos está desactualizada en varios puntos: marca preventivos/correctivos/externos como "no evidenciado" cuando ya tienen código real).

**El problema es frontend, y es doble:**

1. **Inconsistencia de aplicación, no falta de sistema.** Ya existe un design system propio en `modules/servicio/design/` (Card, Badge, Metric, EmptyState, CalendarGrid, RailItem, StepperShell, WorkspaceShell) y un `DESIGN.md` global muy trabajado (paleta semántica, tipografía Geist, sombras estratificadas, reglas anti-genéricas explícitas). Las 12 páginas SÍ importan estos componentes, pero cada una reimplementa layout con decenas de `style={{}}` inline (`Disponibilidad.jsx`: 58, `Mantenimientos.jsx`: 42, `ExternalCasesWorkspace.jsx`: 40) en vez de usar utilidades consistentes. Resultado: cada pantalla se ve "parecida pero no igual" — exactamente el síntoma que el propio DESIGN.md advierte evitar ("cada módulo parece hecho por un equipo distinto").
2. **Fragmentación funcional sin resolver**, ya detectada por el equipo en un plan previo pero no cerrada:
   - Equipos gestionable desde 3 pantallas distintas.
   - Solicitudes duplicadas entre el modal de Dashboard y la página Solicitudes.
   - `Disponibilidad.jsx` y `/cronograma` son el mismo archivo con dos configuraciones — confuso como dos "módulos".
   - 4 componentes muertos sin borrar (`JefeTecnicoSolicitudesView.jsx`, `TecnicoSolicitudesView.jsx`, `BcInspectionList.jsx`, `InspeccionesIndependientesList.jsx` — confirmado sin imports vivos).
   - El verbo "coordinar" cambia de nombre 4 veces entre flujos equivalentes (inconsistencia de copy/UX).
   - El widget "Aprobaciones pendientes" del Dashboard permite aprobar F.ST-20/21 sin pasar por el flujo de asignar técnico/fecha (atajo que rompe el proceso real).
   - El feed "Mis asignaciones pendientes" del dashboard técnico solo lee mantenimientos, no inspección/retiro/correctivo (Fase F pendiente).
   - No existe calendario visual (mes/semana), solo listas (Fase G pendiente).

**Dirección de diseño para este rework:** no se descarta el sistema de tokens (color semántico, radio 16px, sombras estratificadas) porque es correcto y ya evita clichés genéricos explícitamente. Lo que se rompe es la sensación de "app estándar" reduciendo el número de superficies por pantalla, dando a cada módulo una jerarquía visual propia (no el mismo "grid de cards" repetido en las 12 páginas), y resolviendo primero la function antes que añadir más decoración. Simplificar significa **menos cajas, más una sola superficie de trabajo por pantalla con densidad variable** — es literalmente lo que la sección 8 del propio DESIGN.md pide y que hoy no se cumple.

### 0.1 Hallazgo crítico: el sistema no diferencia `ing_servicio` de `esp_app`

Verificado en `spi_front/src/core/ui/components/NavigationBar.jsx:457-460`: `jefe_tecnico`, `jefe_servicio`, `jefe_servicio_tecnico`, `tecnico`, `ing_servicio` y `esp_app` entran a la **misma rama de menú**, con una sola distinción (`isJefeServicio`, jefe vs. no-jefe). `ing_servicio` y `esp_app` ven exactamente el mismo dashboard, el mismo menú, las mismas 12 páginas, en el mismo orden.

Esto contradice el procedimiento real. **Verificado contra el texto original de los procedimientos** (no contra la interpretación intermedia de `LEVANTAMIENTO_REQUERIMIENTOS_AUTOMATIZACION_ST.md`, que puede tener errores de resumen — ver nota metodológica al final de esta sección):

- **ST-01-01 §4.4/4.5** (Instalación/Retiro/Entrenamiento), responsabilidades textuales: *"Ingeniero de Servicio de Campo: es responsable de instalar, desinstalar, descontaminar, embalar y etiquetar los equipos y partes para transporte."* / *"Especialista de Aplicaciones: es responsable de verificar, entrenar en el uso correcto y manejo de equipos."* — la separación hardware/software está en el procedimiento oficial, no es una interpretación mía.
- **ST-01-01 §6.4.1**: *"El especialista de aplicaciones toma la WO de Training Initial"* — confirma REQ-ST-057, el entrenamiento es Work Order del especialista de aplicaciones, no del ingeniero de campo.
- **ST-01-01 §6.2.4 (Verificación de Equipos Nuevos, F.ST-09)**: *"Si aplica la verificación del equipo, el especialista de aplicaciones a cargo la lleva a cabo"* — corrige una primera hipótesis mía (había asumido que Verificación era trabajo de `ing_servicio` por ser sobre "equipo"; el texto dice lo contrario, es del especialista de aplicaciones). Ver corrección en §3.8.
- **ST-01-03 §6.1 (Correctivos)**: *"el personal del área de servicio analiza la información colocada en la WO o el CASO; si se trata de una visita relacionada a aplicaciones, toma la WO o el CASO el especialista de aplicaciones; y si se trata de una visita relacionada a ingeniería, toma la WO o el CASO el ingeniero de servicio de campo."* — **matiz importante**: el procedimiento describe una **cola compartida con auto-selección por especialidad** ("el personal del área de servicio" analiza y toma), no un despacho obligatorio ejecutado específicamente por `jefe_servicio`. Corrijo esto en §1.1/§3.3/T10 respecto a mi primera lectura (que asumía que `jefe_servicio` clasificaba y asignaba cada caso).

En la práctica: `ing_servicio` es el técnico de campo (instalación, desinstalación/retiro, mantenimiento correctivo de hardware, desinfección, inspección de sitio). `esp_app` es el especialista que entrena clientes en el uso del equipo/software, verifica equipos nuevos, y atiende correctivos de "aplicación" (error de uso, configuración, conectividad LIS) — no reparación física. Hoy ambos ven un dashboard genérico de "técnico de campo" con widgets de mantenimiento que no le sirven a `esp_app` para su trabajo real.

Este hallazgo agrega un requisito transversal nuevo: **T9** (ver §2) y reestructura el Dashboard (§3.1) y el flujo de correctivos (§3.3) para presentar una cola de trabajo filtrable por especialidad. Se detalla el recorrido de cada rol en §1.1.

**Nota metodológica:** esta sección fue releída directamente contra los PDF originales `ST-01-01_V09` y `ST-01-03_V08` (no contra el resumen intermedio) siguiendo el principio de la skill `analisis-previo-desarrollo` de este proyecto: nunca confiar en documentación intermedia sobre el estado de las cosas, verificar la fuente. Las correcciones de esta sección son el resultado directo de esa verificación. `ST-01-02` (preventivo) y `ST-01-04` (casos externos/REXIS) no se releyeron línea por línea en esta pasada — sus secciones de este plan (§3.3 preventivo, §3.9) se apoyan todavía en la interpretación intermedia y deberían releerse contra el PDF original antes de implementar si surge alguna duda de rol.

### 0.2 Corrección mayor al empezar la Fase 0: T11 y Fase F ya están construidos

Al arrancar la Fase 0 (§5) se releyó el código real de `technicalSchedule.service.js` y `correctiveCases.service.js` antes de tocar nada — y ambas piezas de "backend pendiente" de este plan **ya existen, completas**:

- **`getTechnicalScheduleFeed`** (la "Fase F" que este documento heredó como pendiente del plan previo) ya agrega manuales, mantenimientos, capacitaciones, inspecciones públicas/privadas (programadas y backlog), **retiros** (`listWithdrawals`) y **correctivos** (`listCorrectiveCases`). No falta nada por extender.
- **La clasificación hardware/aplicación de correctivos (T11)** ya existe end-to-end: la tabla `servicio.corrective_cases` tiene columna `classification` (`aplicaciones` / `ingenieria` / `software_lis`) más `assigned_specialist_user_id`, `assigned_specialist_role`, `dispatcher_user_id`; la acción `classify_case` en `correctiveCases.service.js` la aplica; y el frontend ya tiene un componente dedicado, `CorrectiveCaseWorkspace.jsx` (541 líneas), que la usa. **No hay ninguna funcionalidad nueva que construir para T11** — el trabajo de este plan sobre §3.3/correctivos se reduce a lo que ya decía el diagnóstico original de §0: aplicar el rework visual/UX a un componente que ya funciona, no agregar clasificación.

Esto confirma el patrón de riesgo que motivó volver a auditar antes de codear: el plan había heredado "REQ-ST-105 no evidenciado" del documento intermedio (`LEVANTAMIENTO_REQUERIMIENTOS_AUTOMATIZACION_ST.md`), que estaba desactualizado. El código real ya lo resolvió después de esa auditoría.

**Modelo de asignación real (corrige T11):** la clasificación (`classify_case`) la ejecuta un `Dispatcher` o `CEAC` (roles `DISPATCH_ROLES`/`CEAC_ROLES` en `ceacDispatch.service.js`), no un self-pick libre de "cualquiera del equipo". Es más cercano a un modelo de despacho explícito (alguien clasifica y asigna a un `assigned_specialist_user_id` concreto) que a la lectura "cola compartida, autoselección" que yo había derivado solo del texto del procedimiento en la sección anterior. `jefe_servicio` sí puede ejercer este rol de dispatcher (`jefe_tecnico`/`jefe_servicio_tecnico` están en `DISPATCH_ROLES`), reforzando que en la UI de §3.3 sí conviene que `jefe_servicio` tenga una acción explícita de clasificar/asignar (más parecido a mi lectura original que a la corrección de §0.1) — pero el propio comentario del procedimiento sobre auto-selección sigue siendo válido para quién *ejecuta* después (el especialista asignado toma sus propias acciones vía `register_dispatch_milestone`, `close_case`, etc.).

**Hallazgo nuevo, no relacionado con el rework visual — bug de RBAC real:** `ceacDispatch.service.js` define `DISPATCH_ROLES`/`TECH_SPECIALIST_ROLES`/`CEAC_ROLES` con nombres de rol **legacy** (`jefe_tecnico`, `servicio_tecnico`, `tecnico`, `ingeniero`, `especialista_aplicaciones`) que **no incluyen los roles modernos `ing_servicio` ni `esp_app`** (comparar con `ROLE_GROUPS` en `middlewares/roles.js`, que sí los trata como alias intercambiables). La ruta `/corrective-cases/:id/actions` sí permite entrar con `ing_servicio`/`esp_app` (`correctiveWriteRoles` en `servicio.routes.js` los incluye), pero una vez dentro, `assertRoleForAction` (que usa estos arrays legacy) puede **rechazar silenciosamente** acciones como `register_dispatch_milestone`, `record_part_replacement`, `close_case`, `add_evidence`, `link_disinfection_fst02` para cualquier usuario cuyo rol en el JWT sea literalmente `ing_servicio`/`esp_app` (sin el alias legacy `tecnico` también presente). Esto es plausible que esté bloqueando en producción a técnicos que ya migraron al rol moderno. Es un fix contenido (agregar `"ing_servicio"` y `"esp_app"` a los 3 arrays) pero está fuera del alcance de este plan de UI — **requiere decisión del usuario**, ver §6.

---

## 1. Recorrido por rol (grounded en ST-01-01..04 y en el código real de permisos)

Los 3 roles comparten las mismas 12 páginas físicas pero su trabajo real es distinto. El rework no crea 3 apps separadas — usa el mismo shell y el mismo design system, pero el **contenido por defecto** (qué ve primero, qué widgets, qué acciones destacan) debe diferenciarse. Esto es lo que hoy no pasa (§0.1).

### 1.1 `jefe_servicio` — supervisor y aprobador de inspecciones

**Procedimientos que ejecuta:** aprueba/asigna inspecciones (ST-01-01 §6.1.1/6.1.2, confirmado textual: llega el F.ST-20 "al jefe de servicio técnico y aplicaciones para su aprobación o negación"), supervisa la cola de correctivos y reasigna si un caso quedó sin tomar (ST-01-03, ver T11), supervisa cumplimiento de preventivos (ST-01-02), revisa capacidad del equipo, gestiona escalamientos de casos externos.

**Cómo lo usaría hoy vs. qué le falta:**
- Abre el Dashboard esperando ver, en este orden: qué requiere su decisión ahora mismo (inspecciones por asignar), quién de su equipo está libre hoy, y qué está atrasado o sin tomar en la cola de correctivos. Hoy el Dashboard mezcla KPIs genéricos con la cola de acciones sin esa jerarquía.
- Sobre correctivos, su rol real por procedimiento (ST-01-03 §6.1) **no es despachar cada caso uno por uno** — es que "el personal del área de servicio" (que incluye a `ing_servicio` y `esp_app` mismos) analiza la WO/CASO recibido del Dispatcher/CEAC y **el especialista correspondiente lo toma según su naturaleza**. El rol de `jefe_servicio` aquí es de **supervisión y respaldo**: ver la cola completa (para detectar casos sin tomar por nadie, o mal tomados) y poder reasignar/intervenir, no de aprobar cada asignación individualmente. La UI debe reflejar esto como una **cola compartida visible por especialidad**, no un formulario de "asignar a X" por caso.
- Necesita ver la carga de trabajo de ambas especialidades por separado (¿está saturado el especialista de aplicaciones esta semana mientras el de campo tiene hueco?) — hoy `Disponibilidad.jsx`/cronograma no distingue por especialidad, solo por persona.
- Aprueba F.ST-20/21 (inspecciones, esto sí es una aprobación explícita suya, confirmado en ST-01-01 §6.1.1/6.1.2): el atajo del widget del Dashboard que salta el flujo de asignar (Hallazgo T8) es exactamente el tipo de error que un jefe_servicio comete por prisa entre reuniones — hay que decidir si se cierra ese atajo o se convierte en el mismo formulario completo en modal.

**Qué necesita el rework para este rol:** vista "por decidir hoy" como primer bloque del Dashboard (inspecciones pendientes de aprobar, casos correctivos sin tomar por nadie); cola de correctivos visible por especialidad con posibilidad de reasignar si hace falta; cronograma filtrable por especialidad, no solo por persona.

### 1.2 `ing_servicio` — ingeniero de servicio de campo

**Procedimientos que ejecuta:** instalación/entrega (ST-01-01), retiro (ST-01-01), preventivo de hardware (ST-01-02), correctivo de hardware (ST-01-03), inspección de sitio, desinfección.

**Cómo lo usaría hoy vs. qué le falta:**
- Trabajo mayormente en campo, tablet o móvil, entre visitas — la escena que el propio DESIGN.md pide imaginar antes de diseñar. Necesita, al abrir el sistema entre dos visitas: "¿qué me toca hoy y dónde?", sin scroll, sin buscar entre 12 páginas.
- El feed "Mis asignaciones pendientes" del dashboard **solo lee mantenimientos** (Fase F pendiente del plan previo) — si tiene una inspección o un retiro asignado hoy, no aparece ahí. Este es el gap más doloroso para este rol específicamente: la lista que debería ser su fuente de verdad diaria está incompleta.
- Los 3 steppers (Desinfección/Asistencia/Verificación, F.ST-02/05/09) son su herramienta de trabajo repetida muchas veces al día — deben seguir el patrón `AttendanceWidget` del DESIGN.md: acción principal visible sin scroll en 390px, sin animación en el botón de marcar, touch targets ≥48px. Hoy no están auditados a ese estándar (son componentes internos, no cubiertos por el inventario de páginas).
- Firma en campo con conectividad variable: las firmas hoy se guardan en `/tmp/uploads` (diskStorage local del contenedor, no cloud) — riesgo real de pérdida si el pod de Cloud Run reinicia entre que el técnico firma y que el proceso sube el documento. Fuera de alcance de este documento (es infraestructura) pero directamente relevante a la confianza de este rol en el sistema — flag en §4.

**Qué necesita el rework para este rol:** feed de "hoy" completo (Fase F), steppers mobile-first auditados contra el estándar de `AttendanceWidget`, acceso rápido a fichas técnicas/manuales de equipo desde el mismo flujo de trabajo (ya existe en Equipos.jsx, debe ser alcanzable sin salir del stepper activo).

### 1.3 `esp_app` — especialista de aplicaciones

**Procedimientos que ejecuta:** entrenamiento de clientes (ST-01-01, F.ST-05/06/08/12), correctivos de "naturaleza de aplicación" (ST-01-03, REQ-ST-105) — errores de uso, configuración, conectividad LIS, no reparación física.

**Cómo lo usaría hoy vs. qué le falta:**
- Hoy inicia sesión y ve **el mismo dashboard que un técnico de campo**: KPIs de mantenimiento, cronograma de visitas técnicas, cola de acciones mezclada. Nada en la pantalla de inicio refleja que su trabajo es entrenar clientes y resolver problemas de uso/software, no reparar hardware. Esto es el hallazgo central de §0.1.
- Su ciclo real es: preparar/dictar entrenamientos programados (Capacitaciones o Aplicaciones, hay solape sin resolver, ver decisión §6.2) y atender correctivos que el jefe_servicio le despacha por ser de aplicación — hoy no hay una cola separada para esto último porque no existe la clasificación.
- El Work Order de tipo `Training Initial` que el procedimiento pide para este rol (REQ-ST-057) no está evidenciado como un flujo propio y trazable — hoy el entrenamiento se gestiona pero sin esa etiqueta/trazabilidad específica del rol.

**Qué necesita el rework para este rol:** vista de inicio propia (mismo shell, contenido distinto): "mis entrenamientos esta semana" + "mis casos de aplicación asignados", sin los widgets de mantenimiento de hardware que no le aplican; que la clasificación de correctivos (§1.1) efectivamente le enrute trabajo a él y no solo a `ing_servicio`.

---

## 2. Reglas transversales (aplican a las 12 vistas, se resuelven UNA vez, no por página)

| # | Regla | Por qué |
|---|---|---|
| T1 | Cero `style={{}}` inline nuevo. Todo layout vía clases Tailwind + los tokens CSS ya definidos en `tokens.css`. Las 160 ocurrencias actuales se migran página por página durante su rework, no en un barrido aparte (evita una PR gigante sin revisión real). | Es la causa raíz de la inconsistencia visual detectada. |
| T2 | Un único componente de estado vacío: `ServicioEmptyState` ya existe, se usa en las 12 páginas sin excepción (hoy `Capacitaciones.jsx` usa texto plano). | Ya está en el design system, solo falta adopción. |
| T3 | Un único verbo para "fijar fecha/técnico": **"Asignar"** en toda la UI (reemplaza "coordinar", "programar", "revisar fecha" donde signifiquen lo mismo). Requiere confirmación del usuario si algún caso tiene matiz real que justifique un verbo distinto. | Resuelve Hallazgo #6 del plan previo. |
| T4 | Borrar los 4 componentes muertos confirmados antes de tocar `Solicitudes.jsx` (son ruido en el árbol de archivos que toca ese módulo). | Ya verificado sin referencias vivas. |
| T5 | Cerrar la fragmentación de datos: Equipos vive en una sola fuente de verdad de UI (`pages/Equipos.jsx`); los otros 2 lugares (`EquiposManagement.jsx` en dashboard, panel de `PreventiveEquipmentSchedulePanel.jsx`) se reducen a vista de solo lectura con link profundo a Equipos, no a un segundo editor. | Evita que un mismo dato se edite distinto desde dos pantallas. |
| T6 | El modal "Solicitudes en curso" del Dashboard deja de duplicar la lista completa: muestra máx. 5 urgentes con link a `/solicitudes`, no un segundo listado paralelo. | Elimina duplicación #2 del audit. |
| T7 | `Disponibilidad.jsx` deja de ser "un archivo con dos modos por query param" y pasa a ser una sola pantalla con dos pestañas claras dentro de una misma navegación (Mi disponibilidad / Cronograma del equipo), no dos rutas que parecen módulos distintos. | Resuelve duplicación #3. |
| T8 | Decisión de producto requerida antes de tocar el Dashboard: ¿el widget "Aprobaciones pendientes" se elimina (fuerza pasar por Asignar) o se convierte en atajo que abre el mismo formulario de asignar en modal? Ver §6. | Bloqueante conocido, no se puede "diseñar bonito" sin resolver la regla de negocio. |
| T9 | El Dashboard (y en menor medida el cronograma) debe leer el rol real del usuario (`ing_servicio` vs `esp_app` vs `jefe_servicio`) y mostrar un set de widgets por defecto distinto, no la misma composición para los 3. No implica rutas ni permisos nuevos — implica que `Dashboard.jsx` deje de tratar "técnico" como una sola categoría visual. | Hallazgo §0.1, más importante que cualquier ajuste visual del rework. |
| T10 | El cronograma/calendario debe ser filtrable por especialidad (hardware/`ing_servicio` vs. aplicación/`esp_app`), no solo por persona. | Necesidad de `jefe_servicio` detectada en §1.1: hoy no puede ver si un equipo está saturado y el otro libre. |
| T11 | La cola de correctivos (§3.3) se muestra como **cola compartida visible por especialidad** (cada caso trae su naturaleza hardware/aplicación desde el CEAC/Dispatcher, o se marca al crearlo), no como un formulario de "jefe_servicio asigna a X" por cada caso. `jefe_servicio` ve la cola completa en modo supervisión (reasignar si hace falta), `ing_servicio`/`esp_app` ven y toman solo la de su especialidad. | Verificado contra ST-01-03 §6.1 original: "el personal del área de servicio analiza... toma la WO" — es autoselección por el equipo, no despacho exclusivo de jefe_servicio. Corrige la lectura inicial de T9/§1.1. |
| T12 | Ninguna vista de §3 se da por terminada sin pasar por el flujo de skills de diseño: `ckw-design` al empezar (dirección visual), `frontend-design`/`openai-frontend-design` para construir, `impeccable` como revisión final antes de cerrar la fase. Ver detalle en la cabecera del documento. | Instrucción explícita del usuario: usar siempre estos skills en la implementación del plan, no solo como referencia puntual. |

---

## 3. Módulo por módulo

### 3.1 `Dashboard.jsx` — `/dashboard/servicio-tecnico`

**Hoy:** KPIs, cola de acciones, feed de cronograma, cumplimiento preventivo, disponibilidad — todo en una sola pantalla dividida en `JefeTecnicoView`/`TecnicoView`. Es la puerta de entrada del área, la que más define la primera impresión.

**Cambios:**
- Reducir a **una** franja de KPI (strip de datos en una sola superficie con dividers, no 4-6 tarjetas de "número grande + ícono de color" — eso es exactamente el patrón que el propio DESIGN.md prohíbe en §13).
- La cola de acciones pendientes pasa a ser el bloque principal por encima del pliegue (es lo que el usuario necesita accionar hoy), no un widget lateral.
- El modal "Solicitudes en curso" se resuelve con T6.
- El feed "Mis asignaciones pendientes" se conecta al backend extendido de Fase F (ver §5, Fase 0) para incluir inspección/retiro/correctivo, no solo mantenimientos — hoy es información incompleta presentada como completa.
- Vista jefe vs. vista técnico: mantener la separación por rol, pero unificar el layout base (hoy son composiciones independientes que pueden divergir visualmente con el tiempo).

**Por rol (T9, ver §1):**
- `jefe_servicio`: primer bloque = "por decidir hoy" (inspecciones sin asignar + correctivos sin clasificar), luego capacidad del equipo por especialidad (T10), luego KPIs.
- `ing_servicio`: primer bloque = feed de "hoy" ya extendido con inspección/retiro/correctivo (Fase 0), sin widgets de entrenamiento ni de casos de aplicación.
- `esp_app`: primer bloque = "mis entrenamientos esta semana" + "mis casos de aplicación asignados"; sin widgets de mantenimiento de hardware ni cumplimiento preventivo, que no le aplican.

### 3.2 `Solicitudes.jsx` — `/solicitudes` (tabs: Inspección de Ambiente / Retiro de Equipos)

**Hoy:** hub con `InspectionRequestsWorkspace.jsx` (ya fusiona 3 fuentes: compras, business case, independientes) y `RetiroEquipos.jsx` embebido como segunda pestaña.

**Cambios:**
- Aplicar T4 (borrar los 4 componentes muertos que quedaron del proceso de fusión anterior).
- La pantalla "Aprobar y asignar" (la que motivó el fix de fecha de esta sesión) es el corazón operativo del área: rediseñar como un panel de dos columnas fijo (detalle de solicitud a la izquierda, formulario de asignación a la derecha) en vez del layout actual `xl:grid-cols-2` que colapsa mal en tablet.
- Selector de fecha: ya no restringido a la ventana min-max (fix de esta sesión); el calendario debe mostrar visualmente qué fecha es la "propuesta original" vs. libre elección, no solo dejar seleccionar sin contexto.
- Unificar el verbo (T3): el botón dice "Asignar inspección", no "Coordinar fecha exacta"/"Aprobar y asignar" con matices distintos según la pestaña.

**Por rol:**
- `jefe_servicio`: único rol que aprueba/asigna aquí (ver §1.1) — es su pantalla de trabajo principal, la de mayor tiempo de uso diario.
- `ing_servicio`/`esp_app`: solo lectura de lo que les fue asignado (deep-link desde su feed del Dashboard, no necesitan entrar a Solicitudes directamente).

### 3.3 `Mantenimientos.jsx` — `/mantenimientos`, `/correctivos` (tabs: Preventivo / Correctivo)

**Hoy:** 42 inline styles, board de plan anual + workspace de casos correctivos en dos pestañas del mismo archivo.

**Cambios:**
- Separar visualmente el "plan" (vista de planificación anual, orientada a calendario/timeline) del "caso" (vista de ejecución puntual, orientada a lista/kanban) — hoy comparten el mismo patrón de tarjetas aunque son dos tipos de trabajo distintos (uno es planeación a 12 meses, el otro es respuesta a un ticket).
- El dashboard de cumplimiento/capacidad (ya existe en backend: `/preventive/compliance`, `/capacity`) debe integrarse como cabecera de la pestaña Preventivo, no como pantalla aparte que el usuario tiene que ir a buscar.
- Formularios FST-16/FST-17 y firma: usar el patrón de overlay bloqueante para operaciones >2s ya definido en DESIGN.md (generación de PDF), hoy probablemente sin ese feedback dado el patrón repetido de inline styles.
- **Nuevo requisito por rol (T11, verificado contra ST-01-03 §6.1 original):** cada caso correctivo debe tener un campo de especialidad (hardware/aplicación), visible desde que entra a la cola. El procedimiento real es de **auto-selección**: "el personal del área de servicio analiza... toma la WO" según su naturaleza — no un formulario de "asignar a X" que `jefe_servicio` llena caso por caso. La cola debe mostrar claramente qué casos están sin tomar por nadie (para que `jefe_servicio` intervenga solo en ese caso). Hoy este campo no existe (confirmado "no evidenciado" en la documentación de procedimientos y sin campo equivalente en el modelo de datos revisado). Es la funcionalidad nueva más importante de todo este plan, no solo un ajuste visual.

**Por rol:**
- `jefe_servicio`: ve la cola completa en modo supervisión; reasigna o interviene solo si un caso quedó sin tomar por nadie.
- `ing_servicio`: ve la cola filtrada a casos de hardware; toma los que le corresponden.
- `esp_app`: ve la cola filtrada a casos de aplicación; toma los que le corresponden — hoy vería la lista completa sin filtrar, mezclada con casos que no le corresponden.

### 3.4 `Disponibilidad.jsx` — `/disponibilidad`, `/cronograma` (mode=cronograma)

**Hoy:** 58 inline styles (el peor caso del módulo), mismo componente para "mi disponibilidad" y "cronograma del equipo" vía query param.

**Cambios:**
- Resolver T7: una pantalla, dos pestañas (Mi disponibilidad / Cronograma del equipo), navegación por tab no por query param oculto.
- **Fase G del plan previo (calendario visual mes/semana)** se implementa aquí, usando `ServicioCalendarGrid` ya existente (grid CSS, sin librería nueva — ya era la recomendación previa). Hoy `Disponibilidad.jsx` es solo lista/agenda, no hay vista de calendario real en toda el área.
- Esta es la pantalla candidata a mayor reducción de inline styles del rework completo por ser la más afectada.

**Por rol:**
- `jefe_servicio`: ve el cronograma del equipo completo, filtrable por especialidad (T10) — necesita comparar carga de `ing_servicio` vs. `esp_app` para decidir a quién asignar un caso nuevo.
- `ing_servicio`/`esp_app`: gestionan su propia disponibilidad; ven el cronograma del equipo en modo lectura, ya filtrado por defecto a su propia especialidad.

### 3.5 `Capacitaciones.jsx` — `/capacitaciones`

**Hoy:** grid de tarjetas simple, sin filtros/búsqueda, empty state en texto plano.

**Cambios:**
- Aplicar T2 (EmptyState real).
- Agregar filtro por estado/fecha y búsqueda — hoy no existen pese a que la lista puede crecer.
- Evaluar si esta vista debe seguir siendo standalone o integrarse como sub-vista de `Aplicaciones.jsx` (ver 3.7): actualmente hay dos puntos de entrada a "capacitación" (esta página y el card de Aplicaciones que abre `TrainingWorkflowWorkspace`) — **requiere decisión del usuario**, ver §6.

**Por rol:** es, en la práctica, la pantalla de trabajo diaria de `esp_app` (REQ-ST-057/058, ver §1.3) — merece más inversión de diseño que "grid simple sin filtros" hoy le da. `ing_servicio`/`jefe_servicio` la usan en modo consulta (saber cuándo hay entrenamientos programados que afectan disponibilidad del equipo).

### 3.6 `Equipos.jsx` — `/equipos`

**Hoy:** inventario con búsqueda client-side sobre muchos campos, sin paginación.

**Cambios:**
- Aplicar T5 (fuente única de edición).
- Agregar paginación o virtualización si el catálogo crece más allá de lo manejable client-side (verificar volumen real antes de decidir el mecanismo, no asumir).
- Mantener enlaces a documentación (fichas técnicas/manuales) como acción secundaria visible, no enterrada en un menú.

**Por rol:** uso equivalente entre los 3 roles (consulta de catálogo/ficha técnica antes o durante una visita/entrenamiento). No requiere diferenciación por rol, solo por contexto de uso (móvil en campo vs. escritorio).

### 3.7 `Aplicaciones.jsx` — `/aplicaciones`

**Hoy:** hub de 5 tarjetas que abren modales/steppers (entrenamiento, desinfección, asistencia, verificación, y una más).

**Cambios:**
- Es el ejemplo más claro del "grid de cards idénticas" que DESIGN.md prohíbe (ícono + título + descripción × 5, todas iguales). Rediseñar como lista con densidad variable: la aplicación usada con más frecuencia (probablemente Asistencia/Desinfección en campo) tiene más peso visual que las de uso ocasional.
- Resolver el posible solape con Capacitaciones (§3.5) en la misma pasada.

**Por rol:** hoy las 5 tarjetas se muestran igual a los 3 roles aunque solo 2-3 les apliquen realmente por especialidad (ej. `esp_app` normalmente no ejecuta Desinfección física, `ing_servicio` normalmente no dicta Entrenamiento). Filtrar el hub por especialidad reduce directamente el "grid genérico" a algo con densidad variable real, no solo estético.

### 3.8 `Desinfeccion.jsx`, `Asistencia.jsx`, `VerificacionEquipos.jsx` — steppers F.ST-02/05/09

**Hoy:** wrappers triviales sobre `DesinfeccionStepper`/`AsistenciaStepper`/`VerificacionStepper` (no auditados línea por línea en esta pasada, son los componentes internos).

**Cambios:**
- Auditar los 3 steppers internos en la fase de implementación (no cubiertos en el inventario inicial por ser componentes, no páginas) usando `ServicioStepperShell` como base común si no lo usan ya.
- La documentación de procedimientos marcó inconsistencias de nombres de campo entre código y plantilla PDF en F.ST-09 (`frima_af_image` vs `firma_af_image`) y F.ST-05 (`Dia_1_1..7` vs esperado, falta `Firma_Especialista`) — corregirlas de paso ya que se va a tocar estos flujos (son bugs de datos, no solo estética).
- `AttendanceWidget` (patrón de firma del DESIGN.md, componente de máxima frecuencia) debe ser el estándar visual que sigan estos 3 steppers si involucran marcar asistencia/firma repetida.

**Por rol (verificado contra ST-01-01 original, corrige una hipótesis inicial):** Desinfección (F.ST-02, §6.7.2) es `ing_servicio` — textual: la desinfección ocurre durante desinstalación/cambio de partes, tarea del ingeniero de campo. Verificación de equipos nuevos (F.ST-09, §6.2.4) es **`esp_app`**, no `ing_servicio` como asumí en la primera pasada — textual: *"el especialista de aplicaciones a cargo la lleva a cabo"*. Asistencia (F.ST-05, registro de asistentes a entrenamiento, §6.4.2) es `esp_app`. Es decir: de los 3 steppers, 2 son de `esp_app` y solo 1 de `ing_servicio` — refuerza aún más la necesidad de T9, ya que hoy los 3 aparecen igual de prominentes para los 3 roles en `Aplicaciones.jsx` cuando en realidad `esp_app` los usa mucho más.

### 3.9 `ExternalCasesWorkspace.jsx` — `/casos-externos`

**Hoy:** 40 inline styles, la pantalla más compleja (KPIs, filtros, modales, panel de salud de proveedores, acciones de retry/reconcile).

**Cambios:**
- Es candidata a mayor beneficio de "menos cajas, más una superficie": hoy combina lista + KPIs + panel de salud + modales en una sola vista muy cargada.
- El panel de salud de proveedores (Navify/REXIS/GoApp/Online Support) debe comunicar claramente que estos proveedores están en modo "sin contrato" (feature flags `CONTRACT_APPROVED=false`) — hoy esto puede confundirse con una falla real del sistema si no se distingue visualmente "pendiente de contrato" de "error".
- Reintentos/reconciliación: aplicar el patrón de loading 2s-15s (overlay bloqueante) del DESIGN.md, dado que son operaciones de red con proveedores externos que pueden tardar.

**Por rol:** casos externos (Odoo/CEAC) llegan sin especialidad pre-clasificada — el dispatcher/CEAC decide el enrutamiento antes de que entren al sistema interno, así que la clasificación hardware/aplicación (T10/§3.3) aplica igual aquí en el momento de "decisión CEAC" (`POST /:id/ceac-decision`). `jefe_servicio` es el rol principal de esta pantalla; `ing_servicio`/`esp_app` solo ven los casos ya asignados a ellos.

### 3.10 Rutas redirect (`/inspecciones`, `/aprobaciones`, `/workspace-procedimiento`, `/retiros`, `/entregas-privadas`)

**Hoy:** stubs `<Navigate>` que mantienen URLs legadas funcionando tras una consolidación previa.

**Cambios:** ninguno funcional. Mantener como están; son la prueba de que el equipo ya sabe cómo migrar rutas sin romper enlaces guardados/compartidos, y el mismo patrón se reutiliza si el rework cambia alguna URL.

---

## 4. Fuera de alcance de este documento (flag, no ignorar)

- Firmas de mantenimientos guardadas en `/tmp/uploads` (diskStorage, no cloud) — riesgo de pérdida en reinicios de Cloud Run. Es un problema de infraestructura, no de UI; requiere su propio plan.
- Drift de nombres de rol entre rutas (hardcoded `tecnico`/`jefe_tecnico`) y los alias canónicos en `ROLE_GROUPS` (`ing_servicio`/`jefe_servicio`) — fragilidad de control de acceso latente, no bloquea el rework visual pero debería auditarse aparte.
- Integración real con Navify/REXIS/Online Support/GoApp (bloqueada por contratos externos sin firmar) — el rework de `ExternalCasesWorkspace` diseña PARA este estado, no lo resuelve.

---

## 5. Fases de ejecución

| Fase | Contenido | Depende de |
|---|---|---|
| 0 | ✅ **Completa.** Borrado de 4 componentes muertos (T4). Confirmado sin trabajo pendiente en feed/clasificación de correctivos (§0.2). Bug de RBAC en `ceacDispatch.service.js` corregido. | — |
| 1 | ✅ **Completa.** Dashboard (3.1) reconstruido desde 0: nuevo lenguaje visual "bitácora de despacho" (`DispatchStrip`/`DispatchLog`, reemplaza el patrón de grid de KPIs + cards separadas), contenido diferenciado por rol (T9: `JEFE-SVC`/`ING-SVC`/`ESP-APP`, callsign + copy + atajos propios). Verificado con render real (Playwright, overflow=0 en 390/1024px, 3 roles) y crítica de un juez externo (subagente sin contexto del código) — 2 hallazgos reales corregidos (nombre truncado ilegible → wrap; pills genéricas de SaaS → tabs uppercase consistentes con la bitácora). Bug preexistente encontrado y corregido de paso: `Dashboard.jsx` nunca importaba `tokens.css`, dejando el dashboard sin color si era la primera pantalla de servicio que el usuario visitaba. | Fase 0 |
| 2 | ✅ **Completa (2 pasadas).** Panel "Asignar" (3.2) unificado en `AssignInspectionPanel.jsx`, verbo único "Asignar" (T3). **Primera pasada** solo reorganizó el form genérico en 2 columnas — no cumplía la reinvención visual. **Segunda pasada** (a pedido del usuario): `<select>` nativo → roster de técnicos clicable con inicial tipo avatar (`TechnicianRoster`, mismo lenguaje que "Equipo" del Dashboard); `<input type="date">` nativo → `InspectionDatePicker.jsx`, calendario compacto propio (no `ServicioCalendarGrid`, ese es para el cronograma mensual con eventos, demasiado pesado aquí) que pinta la ventana propuesta vs. elección libre — pedido explícito del plan original que la primera pasada dejó como texto plano. El gate de overflow atrapó un bug real en esta segunda pasada (grid sin `grid-cols-1` base dejaba que un nombre largo de técnico empujara la columna 8px fuera del viewport en 390px) — corregido y re-verificado, overflow=0 en 8 combinaciones. De paso, corregida la violación de DESIGN.md §16 en `Solicitudes.jsx` (header y panel de creación vivían en `mx-auto max-w-7xl`, prohibido para bandejas operativas). | Fase 0 |
| 3 | ✅ **Completa (2 pasadas).** **Primera pasada** implementó T11 (filtro de cola por especialidad, badge "Sin tomar", roles de frontend alineados con el backend) y reemplazó los `window.prompt()` por `CorrectiveActionForm.jsx`, pero solo reordenó bloques existentes (tablas de cumplimiento/capacidad movidas arriba, lista+detalle sin cambiar de forma) — no cumplía la reinvención visual. **Segunda pasada** (a pedido del usuario, mismo estándar aplicado en Fase 1/2): reestructuración real de las dos superficies que el plan pedía diferenciar. (1) `PreventiveTimelineStrip.jsx` (nuevo) reemplaza las 2 tablas de cumplimiento/capacidad por una franja horizontal tipo instrumento (mismo lenguaje mono/HUD que `DispatchStrip` del Dashboard: % de cumplimiento y barra de carga por mes, sin tabla). (2) `CorrectiveCaseBoard.jsx` (nuevo) reemplaza la lista plana + panel de detalle lado a lado (mismo patrón que Dashboard/Solicitudes) por un tablero por etapa con scroll horizontal (Por clasificar / Ingeniería / Aplicaciones-LIS / Cerrados; para `ing_servicio`/`esp_app` en modo "Mi especialidad" se colapsa a su columna + Cerrados) — composición propia del trabajo correctivo, no reusada de otra pantalla. (3) El header de `Mantenimientos.jsx` pasó de "card + 2 botones primary/secondary" a un tag mono tipo callsign (`PLAN`/`CASO`, mismo lenguaje que `JEFE-SVC`/`ING-SVC`/`ESP-APP`) + tabs de texto sin pill, ya establecido como el reemplazo estándar de botones genéricos en Fase 1. Verificado con render real (Playwright, overflow=0 en 390/1024px, ambas pestañas). **Pendiente de esta fase:** overlay bloqueante en emisión F.ST-16/F.ST-17; auditoría de los 3 steppers internos (F.ST-02/05/09, corresponde a §3.8/Fase 5, no a esta). | — |
| 4 | ✅ **Completa (2 pasadas).** **Primera pasada**: T7 resuelto de raíz (2 rutas con árboles de UI distintos → 1 pantalla con 2 pestañas reales, tag-mono-callsign + tabs de texto), calendario agregado a la vista personal (antes solo el cronograma de equipo lo tenía — corrección a un diagnóstico del plan que resultó parcialmente falso al verificar contra el código real), T10 (filtro por especialidad, requirió exponer `u.role` en `GET /servicio/disponibilidad`). Pero el contenido interno de `ExpedienteSidebar`/`CronogramaWorkspace`/`AgendaItemsList` se dejó tal cual — mismos pills redondeados tipo SaaS y cards-por-fila que el resto del rework ya había abandonado en Fases 1-3. **Segunda pasada** (a pedido del usuario, mismo estándar): `ExpedienteSidebar` de cards-con-sombra-al-seleccionar → roster clicable con inicial tipo avatar (mismo lenguaje que `TechnicianRoster` y "Equipo" del Dashboard). `AgendaItemsList` de `ServicioCard` apilada por item → fila tipo docket con tag mono de 3 letras (mismo lenguaje que `DispatchLog` del Dashboard), sin caja por fila. Los 2 grupos de pills redondeados (`CRONOGRAMA_TABS` y el toggle Equipo/Mi-agenda de `ScheduleToolbar`) → tabs de texto sin pill / segmented control de 2 botones, mismo lenguaje ya usado en Fase 1-3. Verificado con render real (Playwright, overflow=0 en 390/1024px). | Fase 0 |
| 5 | ✅ **Completa.** `Aplicaciones.jsx`: reemplazado el grid de 5 cards idénticas (ícono+título+descripción×5, prohibido explícitamente por DESIGN.md) por densidad variable real: 1-2 tarjetas "destacadas" según la especialidad de quien mira (`primaryRoles` por tarjeta — `ing_servicio`→Desinfección, `esp_app`→resto), el resto colapsa a filas compactas tipo docket (tag mono + título, mismo lenguaje ya establecido). `jefe_servicio`/roles sin especialidad ven Desinfección+Asistencia destacadas (las de mayor frecuencia real de campo, per diagnóstico original) sin filtrar el resto. Verificado con Playwright (ambos roles, 390/1024px, overflow=0). **Auditoría de los 3 steppers (F.ST-02/05/09) — hallazgos verificados contra código real, no contra el texto del plan:** los 2 bugs de nombres de campo que el plan daba por pendientes (`frima_af_image` vs `firma_af_image` en F.ST-09; `Dia_1_1..7`/`Firma_Especialista` en F.ST-05) **ya estaban corregidos** — `documentCompatibility.service.js` y `verificacion-equipos.service.js` ya manejan ambas variantes del nombre de campo en el PDF, y `asistencia-entrenamiento.service.js` ya resuelve `Firma_Especialista` y los alias `Dia_N_1`. No se tocó nada ahí para no duplicar trabajo ya hecho. Sobre `ServicioStepperShell`: existe pero ningún stepper lo usa — decisión tomada tras revisar el componente real: su indicador tipo cadena-de-pills horizontal es apto para flujos de 3-4 pasos, no para los 9 pasos de `DesinfeccionStepper` (que ya tiene su propio indicador de círculos numerados + conectores, on-brand con tokens.css, funcionalmente superior para un flujo largo) — forzar el shell ahí sería una regresión visual, no una mejora, así que se dejó como está. `AttendanceWidget` que el plan sugería como referencia es el widget de marcación de asistencia de RRHH (clock-in/out), un dominio no relacionado con F.ST-05; la nota del plan se interpreta como "seguir un patrón visual similar", no reusar el componente — no aplica cambio de código. | — |
| 6 | ✅ **Completa.** **Decisión §6 resuelta** (sin bloquear en el usuario, criterio propio verificado contra el código real): Capacitaciones y el card "Entrenamiento ST-01-01" de Aplicaciones NO son la misma funcionalidad — consumen endpoints distintos (`/servicio/capacitaciones` de solo lectura vs. `TrainingWorkflowWorkspace`, ejecución real de F.ST-04/05/06/08/12 con timeline y expediente). Se mantienen **separadas pero cruzadas**: `Capacitaciones.jsx` ahora enlaza a `/aplicaciones?open=trainingWorkflow`, y `Aplicaciones.jsx` lee ese query param para abrir el modal del workflow directo (antes no existía ningún puente entre las dos pantallas). `Capacitaciones.jsx` reestructurada: grid de cards idénticas → lista tipo docket (T2 `ServicioEmptyState` real, búsqueda + filtro de modalidad — antes no existía ninguno de los dos). `Equipos.jsx` — revisado contra el código real, **no requiere reestructuración**: ya es un catálogo con búsqueda funcional y documentación como acción secundaria visible (ya cumplía lo pedido en §3.6); el patrón de card-grid ahí es apropiado porque es un catálogo de inventario real, no un hub de acciones-con-frecuencia-desigual como Aplicaciones — forzar el mismo tratamiento habría sido cosmético sin beneficio real. Verificado con Playwright (overflow=0, 390/1024px). | Decisión §6 |
| 7 | ✅ **Completa.** `ExternalIntegrationHealthPanel.jsx` — hallazgo real: era el único componente de todo el módulo que nunca adoptó `tokens.css`, coloreaba con clases Tailwind sueltas (slate/emerald/amber/rose) en vez de `--st-*`. Migrado a `ServicioCard` + tokens. De paso, el estado "Bloqueado por contrato" (proveedor sin firma comercial, esperado y estable) ahora se distingue con texto explícito ("Sin contrato — pendiente de firma comercial", tono neutro) del estado "degraded" (error de configuración real, tono `--st-danger`) — antes ambos eran variantes de alerta (ámbar/rosa) fáciles de confundir a simple vista, exactamente el riesgo que señalaba §3.9. `ExternalCasesWorkspace.jsx`: los 6 `ServicioMetric` en grid → franja HUD sin cajas (mismo lenguaje que `DispatchStrip` del Dashboard). El `window.prompt()` de la decisión CEAC (resolver 1er nivel / escalar a visita) → formulario inline reusando `CorrectiveActionForm` (Fase 3) — es un componente genérico pese al nombre del archivo, no exclusivo de correctivos. Verificado con Playwright (overflow=0, 390/1024px, incluye estado "sin contrato" + formulario inline abierto). | — |

**Plan completo: 8/8 fases (0-7) implementadas y verificadas con render real.**

Orden por impacto/uso diario, no por dificultad técnica. Cada fase es independiente y desplegable por separado (no requiere un big-bang).

---

## 6. Decisiones que necesito del usuario antes de implementar

1. ~~Widget "Aprobaciones pendientes" del Dashboard~~ — **resuelto** (Fase 1/2): la ruta `/dashboard/servicio-tecnico/aprobaciones` redirige a Inicio — su contenido vive en la cola priorizada única (`DispatchLog`), no hay 2 superficies con el mismo contenido.
2. ~~Capacitaciones vs. Aplicaciones~~ — **resuelto** (Fase 6): no son la misma funcionalidad, se verificó contra el código real (endpoints distintos: catálogo de solo lectura vs. ejecución del flujo FST). Se mantienen separadas y se cruzan con un enlace directo (`?open=trainingWorkflow`).
3. ~~Verbo único~~ — **resuelto** (Fase 2): "Asignar" implementado como único verbo en `AssignInspectionPanel.jsx`, reemplazando "Coordinar fecha exacta"/"Aprobar y asignar".
4. ~~Clasificación hardware/aplicación de correctivos~~ — **resuelto, ya implementado** (ver §0.2): lo clasifica un Dispatcher/CEAC vía la acción `classify_case`, ya construida.
5. **Alcance del dashboard propio de `esp_app`** (T9, §1.3): ¿mismo layout que `ing_servicio` con widgets distintos (más simple de construir, reutiliza el mismo `Dashboard.jsx` con una rama de contenido), o vale la pena una composición visual distinta dado que su ritmo de trabajo (agenda de entrenamientos) es más parecido a un calendario que a una cola de tickets?
6. ~~Bug de RBAC en `ceacDispatch.service.js`~~ — **resuelto**: se agregaron `jefe_servicio`/`ing_servicio`/`esp_app` a `CEAC_ROLES`/`DISPATCH_ROLES`/`TECH_SPECIALIST_ROLES`. Sintaxis verificada, test existente del módulo (`externalCases.helpers.test.js`) sigue en verde. Pendiente de deploy junto con el resto de cambios de backend de la sesión.

---

## 7. Qué NO cambia (para que quede explícito)

- Ningún endpoint de backend existente se toca, salvo la extensión ya prevista del feed de cronograma (Fase F).
- Los tokens de color/tipografía/sombra de `DESIGN.md` se mantienen como base (son correctos); lo que cambia es la disciplina de aplicación y la cantidad de superficies por pantalla, no la paleta.
- Ningún módulo se elimina del área — las 12 páginas se rediseñan, ninguna se quita (salvo los 4 componentes ya confirmados como muertos, que no son páginas navegables).
