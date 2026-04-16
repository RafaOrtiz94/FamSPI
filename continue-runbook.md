# Runbook de Continuidad

## Objetivo
Este archivo permite trabajar con una IA en modo secuencial. La idea es:

1. Inicias una sola vez con el `Prompt de arranque`.
2. Luego, en ese mismo chat, solo escribes `continua`.
3. La IA debe leer este archivo, `prompts.md` y `plan.md`.
4. Debe ejecutar solo la micro-tarea actual.
5. Al terminar, debe actualizar este archivo con el siguiente estado.

## Archivos fuente

- Plan maestro: `plan.md`
- Prompts por micro-tarea: `prompts.md`
- Estado de continuidad: `continue-runbook.md`

## Prompt de arranque

Pega esto una sola vez al abrir un chat nuevo:

```md
Trabaja en modo secuencial con el repo FamSPI.

Instrucciones permanentes para este chat:
- Lee `continue-runbook.md`, `prompts.md` y `plan.md` antes de ejecutar.
- Usa siempre el `Prefijo global` de `prompts.md`.
- Cuando yo escriba `continua`, debes:
  1. leer `continue-runbook.md`
  2. identificar `CURRENT_MT`
  3. buscar en `prompts.md` el prompt exacto de esa micro-tarea
  4. ejecutar solo esa micro-tarea
  5. actualizar `continue-runbook.md`
- No avances dos micro-tareas en una sola respuesta.
- Si la micro-tarea requiere mas de 3 archivos, no la implementes completa: subdividela y actualiza este runbook.
- Al terminar cada micro-tarea, actualiza:
  - `LAST_COMPLETED_MT`
  - `CURRENT_MT`
  - `RUN_STATUS`
  - `LAST_RESULT`
  - `LAST_UPDATED`
```

## Protocolo cuando el usuario diga `continua`

La IA debe hacer exactamente esto:

1. Abrir `continue-runbook.md`.
2. Leer `CURRENT_MT`.
3. Abrir `prompts.md`.
4. Tomar el `Prefijo global`.
5. Tomar el bloque de prompt de `CURRENT_MT`.
6. Ejecutar solo esa micro-tarea.
7. Actualizar este archivo:
   - mover `CURRENT_MT` a la siguiente micro-tarea del orden
   - registrar el resultado
   - si hubo bloqueo, dejar `CURRENT_MT` sin avanzar y marcar `RUN_STATUS: blocked`

## Orden de micro-tareas

La secuencia valida es esta:

- `MT-000` a `MT-005`
- `MT-010` a `MT-020`
- `MT-030` a `MT-047`
- `MT-060` a `MT-068`
- `MT-080` a `MT-089`
- `MT-100` a `MT-118`
- `MT-130` a `MT-136`
- `MT-150` a `MT-158`
- `MT-170` a `MT-194`
- `MT-210` a `MT-220`
- `MT-230` a `MT-243`

Regla:

- Dentro de cada bloque, la siguiente micro-tarea es la numericamente siguiente.
- Al terminar un bloque, se salta al inicio del siguiente bloque.

## Estado actual

- `CURRENT_MT`: `MT-132`
- `LAST_COMPLETED_MT`: `MT-131`
- `RUN_STATUS`: `ready`
- `LAST_RESULT`: fetch manual movido a useAttendanceReportsQuery con refetch y mismo comportamiento visible
- `LAST_UPDATED`: `2026-04-16`

## Registro corto

Usa este formato y agrega una linea por micro-tarea terminada o bloqueada:

```md
- 2026-04-16 | MT-000 | completed | contrato actual documentado
- 2026-04-16 | MT-001 | blocked | requiere revisar parser compartido antes de continuar
```

## Reglas de actualizacion

Si la micro-tarea termina bien:

- `LAST_COMPLETED_MT` = micro-tarea ejecutada
- `CURRENT_MT` = siguiente micro-tarea
- `RUN_STATUS` = `ready`
- `LAST_RESULT` = resumen corto del resultado

Si la micro-tarea queda bloqueada:

- `LAST_COMPLETED_MT` no cambia
- `CURRENT_MT` no cambia
- `RUN_STATUS` = `blocked`
- `LAST_RESULT` = motivo exacto del bloqueo

Si ya no quedan micro-tareas:

- `RUN_STATUS` = `done`
- `CURRENT_MT` = `none`
- `LAST_RESULT` = `plan completo`

## Registro

- 2026-04-16 | MT-000 | completed | contrato actual documentado: ok, total, filteredTotal, status, summary y data
- 2026-04-16 | MT-001 | completed | ubicaciones detectadas: entry, lunch_start, lunch_end, exit, start, arrival, departure y return
- 2026-04-16 | MT-002 | completed | parser detectado en viaticos: parseLocationPoint('lat,lng') con trim y Number
- 2026-04-16 | MT-003 | completed | contrato objetivo admin definido sin cambios de codigo
- 2026-04-16 | MT-004 | completed | permisos de reporting confirmados en backend con acceso global condicionado por allowAll
- 2026-04-16 | MT-005 | completed | ruta /dashboard/talento-humano/asistencia-reportes protegida por roles de talento humano, finanzas, gerencia, director y admin
- 2026-04-16 | MT-010 | completed | normalizeAttendanceRangeFilters creado en attendanceRangeFilters.js
- 2026-04-16 | MT-011 | completed | userId=all marcado como isGlobalScope en el normalizador
- 2026-04-16 | MT-012 | completed | userIds soporta CSV o array y retorna ids unicos positivos
- 2026-04-16 | MT-013 | completed | departmentId soporta normalizacion numerica positiva dentro del contrato del normalizador
- 2026-04-16 | MT-014 | completed | onlyDiscrepancies soporta booleanos flexibles en el normalizador
- 2026-04-16 | MT-015 | completed | onlyWithGeo soporta booleanos flexibles en el normalizador
- 2026-04-16 | MT-016 | completed | dateRangeError expone END_BEFORE_START cuando end es menor que start
- 2026-04-16 | MT-017 | completed | rangeDays y exceedsRecommendedRange quedan disponibles en el normalizador
- 2026-04-16 | MT-018 | completed | quickRange normalizado a today, week, month y year con aliases en espanol
- 2026-04-16 | MT-019 | completed | timezone fija America/Guayaquil queda incluida en el contrato normalizado
- 2026-04-16 | MT-020 | completed | getRange ahora consume el normalizador y rechaza rangos invertidos sin cambiar el SQL
- 2026-04-16 | MT-030 | completed | la SQL base de getRange ahora se construye en un helper privado del controlador
- 2026-04-16 | MT-031 | completed | attendanceReports.service.js creado con buildAttendanceRangeQuery listo para filtros normalizados
- 2026-04-16 | MT-032 | completed | getRange ahora reutiliza buildAttendanceRangeQuery desde attendanceReports.service.js
- 2026-04-16 | MT-033 | completed | attendanceReports.service.js centraliza y normaliza filtro por status con helper reutilizable
- 2026-04-16 | MT-034 | completed | buildAttendanceRangeQuery marca consultas globales seguras cuando el admin no filtra por usuario
- 2026-04-16 | MT-035 | completed | buildAttendanceRangeQuery soporta userIds con filtro IN parametrizado
- 2026-04-16 | MT-036 | completed | buildAttendanceRangeQuery ahora soporta departmentId parametrizado
- 2026-04-16 | MT-037 | completed | attendanceReports.service.js ahora deriva has_geo desde las ubicaciones disponibles
- 2026-04-16 | MT-038 | completed | attendanceGeo.utils.js creado con parseCoordinatePair que valida rango geografico
- 2026-04-16 | MT-039 | completed | attendanceReports.service.js ahora construye geo_points con tipo, label, hora, lat y lng
- 2026-04-16 | MT-040 | completed | attendanceReports.service.js ahora calcula has_discrepancy por fila con regla centralizada
- 2026-04-16 | MT-041 | completed | attendanceReports.service.js ahora filtra rows por onlyWithGeo usando has_geo
- 2026-04-16 | MT-042 | completed | attendanceReports.service.js ahora filtra rows por onlyDiscrepancies usando has_discrepancy
- 2026-04-16 | MT-043 | completed | attendanceReports.service.js ahora construye polyline_points en el orden entrada, almuerzo y salida
- 2026-04-16 | MT-044 | completed | attendanceReports.service.js ahora resume withGeo y withDiscrepancy en el summary filtrado
- 2026-04-16 | MT-045 | completed | attendanceReports.service.js mantiene summary consistente con el dataset filtrado final
- 2026-04-16 | MT-046 | completed | getRange ahora agrega meta con filtros normalizados y warnings de rango
- 2026-04-16 | MT-047 | completed | getRange expone meta.warnings y exceedsRecommendedRange para rangos mayores a 31 dias
- 2026-04-16 | MT-060 | completed | attendance.auth.js ahora expone hasGlobalAttendanceReportingAccess para permisos globales
- 2026-04-16 | MT-061 | completed | canAccessAttendanceTarget usa hasGlobalAttendanceReportingAccess de forma explicita para all y otros targets
- 2026-04-16 | MT-062 | completed | attendance.auth.js devuelve code ATTENDANCE_REPORTS_FORBIDDEN para 403 de reportes
- 2026-04-16 | MT-063 | completed | attendanceAudit.service.js creado con logAttendanceReportAccess para auditar accesos al reporte
- 2026-04-16 | MT-064 | completed | getRange ahora registra auditoria con filtros y resultado resumido
- 2026-04-16 | MT-065 | completed | getRange ahora enriquece el log de error con requester y rango
- 2026-04-16 | MT-066 | completed | attendanceReports.service.js sanitiza fullname, email, department_name y labels del mapa
- 2026-04-16 | MT-067 | completed | attendance.routes.js agrega rate limit especifico a /range y corrige el cierre del modulo
- 2026-04-16 | MT-068 | completed | attendance.routes.js queda sintacticamente estable con la cola final corregida
- 2026-04-16 | MT-080 | completed | AsistenciaReportes.jsx se delimita en toolbar, summary, table y empty state
- 2026-04-16 | MT-081 | completed | estructura base de attendance-reports creada con shell, constantes e indice
- 2026-04-16 | MT-082 | completed | AttendanceReportsSummaryCards.jsx creado como componente puro de KPI cards
- 2026-04-16 | MT-083 | completed | summary cards movidas fuera de AsistenciaReportes.jsx sin cambiar la UI
- 2026-04-16 | MT-084 | completed | empty state movido fuera de AsistenciaReportes.jsx sin cambiar la UI
- 2026-04-16 | MT-085 | completed | empty state extraido de AsistenciaReportes.jsx sin cambio visual
- 2026-04-16 | MT-086 | completed | AttendanceReportsTableView.jsx creado como componente puro con rows y callbacks
- 2026-04-16 | MT-087 | completed | tabla extraida y conectada sin cambiar el render visible
- 2026-04-16 | MT-088 | completed | AttendanceReportsToolbar.jsx creado como componente de presentacion sin fetch
- 2026-04-16 | MT-089 | completed | toolbar extraido y conectado sin cambiar el comportamiento
- 2026-04-16 | MT-100 | completed | attendanceDateRanges.js creado con helpers today, thisWeek, thisMonth y thisYear
- 2026-04-16 | MT-101 | completed | useAttendanceFilters creado con estado base de filtros y setters
- 2026-04-16 | MT-102 | completed | estado base de filtros movido al hook sin cambiar el comportamiento
- 2026-04-16 | MT-103 | completed | clearFilters agregado al hook con reset consistente
- 2026-04-16 | MT-104 | completed | applyQuickRange agregado al hook con quickRange activo
- 2026-04-16 | MT-105 | completed | filtros persistidos en localStorage y restaurados al recargar
- 2026-04-16 | MT-106 | completed | vista table/map incluida en la persistencia del hook
- 2026-04-16 | MT-107 | completed | filtros sincronizados con query params para compartir vistas
- 2026-04-16 | MT-108 | completed | filtros reseteados al cambiar de modo para evitar estados invalidos
- 2026-04-16 | MT-109 | completed | boton limpiar filtros agregado al toolbar y conectado al hook
- 2026-04-16 | MT-110 | completed | chips rapidos agregados visualmente al toolbar
- 2026-04-16 | MT-111 | completed | quick filters disparan consulta automatica sin doble fetch manual
- 2026-04-16 | MT-112 | completed | warning UI agregado para rangos mayores a 31 dias
- 2026-04-16 | MT-113 | completed | toggle solo discrepancias agregado y persistido en el hook
- 2026-04-16 | MT-114 | completed | toggle solo geolocalizacion agregado y persistido en el hook
- 2026-04-16 | MT-115 | completed | filtro departmentId agregado con select funcional y persistencia
- 2026-04-16 | MT-116 | completed | soporte multiusuario expuesto con alias compatible selectedUserIds
- 2026-04-16 | MT-117 | completed | attendanceApi.getAttendanceRange soporta query avanzada y firma antigua
- 2026-04-16 | MT-118 | completed | SearchableSelect reutilizable creado e integrado al AttendanceReportsToolbar
- 2026-04-16 | MT-130 | completed | useAttendanceReportsQuery creado con queryKey basada en filtros
- 2026-04-16 | MT-131 | completed | fetch manual movido a useAttendanceReportsQuery con refetch
