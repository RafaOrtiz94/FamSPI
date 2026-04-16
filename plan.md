# Plan de Implementacion por Micro-Tareas

## Proyecto
Mapa de Asistencia y Reportes Administrativos para FamSPI

## Objetivo del documento
Este documento divide la implementacion completa en micro-tareas extremadamente pequenas para ejecutar con `gpt-5.4-mini` con bajo riesgo, bajo consumo de contexto y alta trazabilidad.

El objetivo no es solo completar la funcionalidad, sino hacerlo sin romper:

- el flujo actual de reportes RH-09
- el endpoint actual `/api/v1/attendance/range`
- los contratos `{ ok: true|false }`
- los permisos reales de backend
- la navegacion protegida ya existente

## Modulo principal real

- Backend principal: `backend/src/modules/attendance`
- Frontend principal: `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`
- API cliente: `spi_front/src/core/api/attendanceApi.js`
- Ruta frontend existente: `/dashboard/talento-humano/asistencia-reportes`

## Reglas operativas para la IA implementadora

1. Ejecutar solo una micro-tarea por vez.
2. No tocar mas de 1 a 3 archivos por micro-tarea.
3. Si una micro-tarea exige 4+ archivos, detenerse y redividir.
4. No mezclar backend y frontend en la misma micro-tarea salvo un ajuste contractual minimo y seguro.
5. No refactorizar por estetica.
6. No tocar `registerRoutes.js`, `app.js` ni `roles.js` salvo bloqueo real.
7. Validar solo el modulo tocado.
8. No ejecutar suites globales.
9. Mantener compatibilidad hacia atras del endpoint actual.
10. Cada cambio debe dejar el sistema en estado ejecutable.

## Estrategia general

Se divide en 10 fases. Cada fase contiene micro-tareas atomicas. La IA debe completar una micro-tarea, verificarla, y solo entonces avanzar a la siguiente.

- Fase 0: Descubrimiento y contrato
- Fase 1: Backend de filtros
- Fase 2: Backend de seguridad y auditoria
- Fase 3: Backend de performance y enriquecimiento geografico
- Fase 4: Frontend base y refactor del workspace
- Fase 5: Frontend de filtros y persistencia
- Fase 6: Frontend tabla administrativa premium
- Fase 7: Frontend mapa y geovisualizacion
- Fase 8: UX premium y responsive
- Fase 9: Calidad, pruebas y endurecimiento
- Fase 10: Cierre y verificacion final

---

## Fase 0. Descubrimiento y congelacion de contrato

### MT-000
Objetivo: leer la respuesta actual de `getRange` y documentar el payload real.

- Modulo: backend attendance
- Archivos maximos:
  - `backend/src/modules/attendance/attendance.controller.js`
- Entregable:
  - nota de contrato actual
- Cierre:
  - lista exacta de campos hoy devueltos por `/range`

### MT-001
Objetivo: identificar columnas reales relacionadas con ubicacion en asistencia.

- Modulo: backend attendance
- Archivos maximos:
  - `backend/src/modules/attendance/attendance.controller.js`
  - `backend/src/modules/attendance/attendance.utils.js`
- Entregable:
  - tabla de campos geograficos
- Cierre:
  - confirmar existencia de `entry_location`, `lunch_start_location`, `lunch_end_location`, `exit_location`

### MT-002
Objetivo: identificar formato real de ubicacion en base a codigo actual.

- Modulo: backend attendance
- Archivos maximos:
  - `backend/src/modules/attendance/attendance.controller.js`
  - `backend/src/modules/viaticos/viaticos.service.js`
- Entregable:
  - especificacion del parser objetivo para coordenadas
- Cierre:
  - confirmar si ya existe un parser reutilizable

### MT-003
Objetivo: congelar contrato objetivo extendido para admin sin romper compatibilidad.

- Modulo: backend attendance
- Archivos maximos:
  - sin editar codigo
- Entregable:
  - bloque JSON de respuesta objetivo
- Cierre:
  - contrato aprobado para `data`, `summary` y `meta`

### MT-004
Objetivo: listar roles reales con acceso al reporte en backend.

- Modulo: backend attendance
- Archivos maximos:
  - `backend/src/modules/attendance/attendance.auth.js`
- Entregable:
  - lista de roles autorizados
- Cierre:
  - clasificacion entre acceso global y acceso individual

### MT-005
Objetivo: listar roles y ruta actual de frontend para no duplicar permisos incorrectamente.

- Modulo: frontend talento
- Archivos maximos:
  - `spi_front/src/routes/AppRoutes.jsx`
- Entregable:
  - lista de roles frontend y ruta actual
- Cierre:
  - diferencias detectadas entre frontend y backend

---

## Fase 1. Backend de filtros administrativos

### MT-010
Objetivo: crear archivo utilitario para normalizar filtros administrativos.

- Modulo: backend attendance
- Archivos a tocar:
  - nuevo `backend/src/modules/attendance/attendanceRangeFilters.js`
- Entregable:
  - funcion pura `normalizeAttendanceRangeFilters`
- Cierre:
  - soporta `start`, `end`, `status`, `userId`

### MT-011
Objetivo: extender el normalizador para `userId=all`.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendanceRangeFilters.js`
- Entregable:
  - parseo seguro de `all`
- Cierre:
  - devuelve bandera clara para consulta global

### MT-012
Objetivo: agregar soporte para `userIds` multipseleccion.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendanceRangeFilters.js`
- Entregable:
  - parseo de CSV o array a ids enteros validos
- Cierre:
  - ids invalidos son descartados o provocan error controlado

### MT-013
Objetivo: agregar soporte para filtro `departmentId`.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendanceRangeFilters.js`
- Entregable:
  - `departmentId` normalizado
- Cierre:
  - tipo entero o null

### MT-014
Objetivo: agregar soporte para `onlyDiscrepancies`.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendanceRangeFilters.js`
- Entregable:
  - bandera booleana normalizada
- Cierre:
  - acepta `1`, `true`, `si`, `yes`

### MT-015
Objetivo: agregar soporte para `onlyWithGeo`.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendanceRangeFilters.js`
- Entregable:
  - bandera booleana normalizada
- Cierre:
  - se serializa de forma consistente

### MT-016
Objetivo: validar que `end >= start`.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendanceRangeFilters.js`
- Entregable:
  - error controlado de rango invalido
- Cierre:
  - el controlador puede responder 400 con mensaje claro

### MT-017
Objetivo: calcular `rangeDays` y advertencia si excede 31 dias.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendanceRangeFilters.js`
- Entregable:
  - propiedad `rangeDays` y `exceedsRecommendedRange`
- Cierre:
  - listo para frontend y logs

### MT-018
Objetivo: agregar soporte para `quickRange`.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendanceRangeFilters.js`
- Entregable:
  - normalizacion de `today`, `week`, `month`, `year`
- Cierre:
  - no rompe filtros manuales

### MT-019
Objetivo: fijar timezone operativa `America/Guayaquil` para filtros.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendanceRangeFilters.js`
- Entregable:
  - `timezone` estable en metadatos
- Cierre:
  - contrato consistente para UTC-5

### MT-020
Objetivo: integrar el normalizador en `getRange` sin cambiar aun el SQL.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendance.controller.js`
  - `backend/src/modules/attendance/attendanceRangeFilters.js`
- Entregable:
  - controlador leyendo filtros normalizados
- Cierre:
  - endpoint sigue funcionando con filtros actuales

---

## Fase 2. Backend de consulta enriquecida

### MT-030
Objetivo: extraer SQL base de `getRange` a una funcion privada reutilizable.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendance.controller.js`
- Entregable:
  - funcion interna claramente delimitada
- Cierre:
  - controlador mas legible sin cambiar comportamiento

### MT-031
Objetivo: crear archivo de servicio de reportes administrativos.

- Modulo: backend attendance
- Archivos a tocar:
  - nuevo `backend/src/modules/attendance/attendanceReports.service.js`
- Entregable:
  - servicio de consulta de rango
- Cierre:
  - preparado para recibir filtros normalizados

### MT-032
Objetivo: mover la consulta SQL base al servicio nuevo.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendance.controller.js`
  - `backend/src/modules/attendance/attendanceReports.service.js`
- Entregable:
  - controller delega al servicio
- Cierre:
  - respuesta igual a la actual

### MT-033
Objetivo: soportar filtro por `status` en SQL o postfiltro centralizado estable.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendanceReports.service.js`
- Entregable:
  - filtro por estado derivado
- Cierre:
  - `no_entry`, `working`, `lunch_open`, `completed`

### MT-034
Objetivo: soportar `userId=all` en el servicio.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendanceReports.service.js`
- Entregable:
  - consulta global segura
- Cierre:
  - no obliga `WHERE a.user_id = ...`

### MT-035
Objetivo: soportar `userIds` multiusuario en el servicio.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendanceReports.service.js`
- Entregable:
  - filtro `IN (...)` parametrizado
- Cierre:
  - sin SQL injection

### MT-036
Objetivo: soportar filtro por departamento.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendanceReports.service.js`
- Entregable:
  - join o filtro por departamento
- Cierre:
  - devuelve `department_name`

### MT-037
Objetivo: calcular `has_geo` por fila.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendanceReports.service.js`
- Entregable:
  - bandera booleana por registro
- Cierre:
  - `true` si al menos un punto geografico es valido

### MT-038
Objetivo: implementar parser seguro de coordenadas.

- Modulo: backend attendance
- Archivos a tocar:
  - nuevo `backend/src/modules/attendance/attendanceGeo.utils.js`
- Entregable:
  - `parseAttendanceLocation`
- Cierre:
  - soporta strings `"lat,lng"` y rechaza valores fuera de rango

### MT-039
Objetivo: reutilizar parser para construir `geo_points`.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendanceReports.service.js`
  - `backend/src/modules/attendance/attendanceGeo.utils.js`
- Entregable:
  - arreglo `geo_points` consistente
- Cierre:
  - incluye tipo, label, hora, lat, lng

### MT-040
Objetivo: agregar `has_discrepancy` por fila.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendanceReports.service.js`
- Entregable:
  - bandera de discrepancia horaria
- Cierre:
  - regla documentada y aplicada en una sola funcion

### MT-041
Objetivo: soportar filtro `onlyWithGeo`.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendanceReports.service.js`
- Entregable:
  - filtro activo por geolocalizacion
- Cierre:
  - solo devuelve filas con `has_geo=true`

### MT-042
Objetivo: soportar filtro `onlyDiscrepancies`.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendanceReports.service.js`
- Entregable:
  - filtro por discrepancia
- Cierre:
  - solo devuelve filas discrepantes

### MT-043
Objetivo: agregar `polyline_points` por fila o por jornada.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendanceReports.service.js`
- Entregable:
  - puntos ordenados de jornada
- Cierre:
  - orden logico entrada -> almuerzo -> salida

### MT-044
Objetivo: enriquecer `summary` con `withGeo`.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendanceReports.service.js`
- Entregable:
  - `summary.withGeo`
- Cierre:
  - total correcto sobre filas filtradas

### MT-045
Objetivo: enriquecer `summary` con `withDiscrepancy`.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendanceReports.service.js`
- Entregable:
  - `summary.withDiscrepancy`
- Cierre:
  - valor consistente con dataset devuelto

### MT-046
Objetivo: agregar `meta` a la respuesta del endpoint.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendance.controller.js`
- Entregable:
  - bloque `meta`
- Cierre:
  - incluye `start`, `end`, `timezone`, filtros activos

### MT-047
Objetivo: exponer advertencia por rango mayor a 31 dias en `meta`.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendance.controller.js`
- Entregable:
  - `meta.warnings`
- Cierre:
  - el frontend puede notificar sin recalcular

---

## Fase 3. Backend de seguridad, auditoria y robustez

### MT-060
Objetivo: separar claramente acceso global vs acceso propio en auth.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendance.auth.js`
- Entregable:
  - helper explicito `hasGlobalAttendanceReportingAccess`
- Cierre:
  - roles globales diferenciados

### MT-061
Objetivo: usar helper global en `canAccessAttendanceTarget`.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendance.auth.js`
- Entregable:
  - logica mas clara para `all`
- Cierre:
  - acceso global no depende de suposiciones ambiguas

### MT-062
Objetivo: mejorar mensaje 403 para consultas sin permiso.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendance.auth.js`
- Entregable:
  - mensaje consistente y accionable
- Cierre:
  - frontend puede distinguir 403 real

### MT-063
Objetivo: crear helper de auditoria para consultas de asistencia.

- Modulo: backend attendance
- Archivos a tocar:
  - nuevo `backend/src/modules/attendance/attendanceAudit.service.js`
- Entregable:
  - funcion `logAttendanceReportAccess`
- Cierre:
  - recibe requester, filtros y resultado

### MT-064
Objetivo: registrar auditoria al consultar `/range`.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendance.controller.js`
  - `backend/src/modules/attendance/attendanceAudit.service.js`
- Entregable:
  - logging estructurado por consulta
- Cierre:
  - incluye `userId`, rango, modo y filtros

### MT-065
Objetivo: enriquecer logs de error de `/range`.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendance.controller.js`
- Entregable:
  - contexto en logs
- Cierre:
  - error log incluye requester y rango

### MT-066
Objetivo: sanitizar campos de texto antes de enviarlos a InfoWindow.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendanceReports.service.js`
- Entregable:
  - sanitizacion defensiva minima
- Cierre:
  - nombres y labels no se devuelven con HTML inseguro

### MT-067
Objetivo: aplicar rate limiting especifico al endpoint de reportes si existe patron reutilizable.

- Modulo: backend attendance
- Archivos maximos:
  - `backend/src/modules/attendance/attendance.routes.js`
  - un helper de middlewares ya existente si aplica
- Entregable:
  - limitacion de tasa focalizada
- Cierre:
  - no afecta clock-in normal

### MT-068
Objetivo: revisar y corregir la cola rota al final de `attendance.routes.js` si bloquea trabajo posterior.

- Modulo: backend attendance
- Archivos a tocar:
  - `backend/src/modules/attendance/attendance.routes.js`
- Entregable:
  - archivo sintacticamente estable
- Cierre:
  - rutas finales compilan sin truncado

---

## Fase 4. Frontend base: desmontar monolito de AsistenciaReportes

### MT-080
Objetivo: leer la pagina actual y delimitar secciones reutilizables.

- Modulo: frontend talento
- Archivos maximos:
  - `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`
- Entregable:
  - lista de bloques a extraer
- Cierre:
  - toolbar, summary, table, empty state identificados

### MT-081
Objetivo: crear carpeta `components` para reportes de asistencia.

- Modulo: frontend talento
- Archivos a tocar:
  - nuevos archivos base en `spi_front/src/modules/talento/components/attendance-reports/`
- Entregable:
  - estructura inicial
- Cierre:
  - sin cambiar comportamiento

### MT-082
Objetivo: crear `AttendanceReportsSummaryCards.jsx`.

- Modulo: frontend talento
- Archivos a tocar:
  - nuevo `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsSummaryCards.jsx`
- Entregable:
  - componente puro de KPI cards
- Cierre:
  - recibe props y renderiza sin logica de fetch

### MT-083
Objetivo: mover summary cards fuera de `AsistenciaReportes.jsx`.

- Modulo: frontend talento
- Archivos a tocar:
  - `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`
  - `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsSummaryCards.jsx`
- Entregable:
  - primer componente extraido
- Cierre:
  - UI identica

### MT-084
Objetivo: crear `AttendanceReportsEmptyState.jsx`.

- Modulo: frontend talento
- Archivos a tocar:
  - nuevo `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsEmptyState.jsx`
- Entregable:
  - componente de estado vacio
- Cierre:
  - reemplaza bloque inline

### MT-085
Objetivo: extraer empty state.

- Modulo: frontend talento
- Archivos a tocar:
  - `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`
  - `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsEmptyState.jsx`
- Entregable:
  - pagina mas pequena
- Cierre:
  - mismo comportamiento visual

### MT-086
Objetivo: crear `AttendanceReportsTableView.jsx`.

- Modulo: frontend talento
- Archivos a tocar:
  - nuevo `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsTableView.jsx`
- Entregable:
  - componente puro de tabla
- Cierre:
  - recibe `rows` y callbacks

### MT-087
Objetivo: extraer tabla actual al componente nuevo.

- Modulo: frontend talento
- Archivos a tocar:
  - `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`
  - `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsTableView.jsx`
- Entregable:
  - tabla desacoplada
- Cierre:
  - render actual preservado

### MT-088
Objetivo: crear `AttendanceReportsToolbar.jsx`.

- Modulo: frontend talento
- Archivos a tocar:
  - nuevo `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsToolbar.jsx`
- Entregable:
  - toolbar de filtros actual
- Cierre:
  - solo recibe props, sin fetch

### MT-089
Objetivo: extraer toolbar actual a componente.

- Modulo: frontend talento
- Archivos a tocar:
  - `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`
  - `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsToolbar.jsx`
- Entregable:
  - pagina centrada en estado y composicion
- Cierre:
  - sin perdida funcional

---

## Fase 5. Frontend de filtros, URL y persistencia

### MT-100
Objetivo: crear utilitario de rangos rapidos con `date-fns`.

- Modulo: frontend talento
- Archivos a tocar:
  - nuevo `spi_front/src/modules/talento/utils/attendanceDateRanges.js`
- Entregable:
  - helpers `today`, `thisWeek`, `thisMonth`, `thisYear`
- Cierre:
  - retorna fechas `YYYY-MM-DD`

### MT-101
Objetivo: crear hook `useAttendanceFilters`.

- Modulo: frontend talento
- Archivos a tocar:
  - nuevo `spi_front/src/modules/talento/hooks/useAttendanceFilters.js`
- Entregable:
  - estado central de filtros
- Cierre:
  - maneja `startDate`, `endDate`, `mode`, `view`, `status`, `userIds`

### MT-102
Objetivo: mover el estado base de filtros al hook.

- Modulo: frontend talento
- Archivos a tocar:
  - `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`
  - `spi_front/src/modules/talento/hooks/useAttendanceFilters.js`
- Entregable:
  - pagina delega el estado al hook
- Cierre:
  - comportamiento igual al actual

### MT-103
Objetivo: agregar `clearFilters` al hook.

- Modulo: frontend talento
- Archivos a tocar:
  - `spi_front/src/modules/talento/hooks/useAttendanceFilters.js`
- Entregable:
  - reset total de filtros
- Cierre:
  - deja estado inicial consistente

### MT-104
Objetivo: agregar `applyQuickRange` al hook.

- Modulo: frontend talento
- Archivos a tocar:
  - `spi_front/src/modules/talento/hooks/useAttendanceFilters.js`
  - `spi_front/src/modules/talento/utils/attendanceDateRanges.js`
- Entregable:
  - actualiza `startDate/endDate` y quick filter activo
- Cierre:
  - sincroniza visualmente inputs manuales

### MT-105
Objetivo: persistir filtros en `sessionStorage` o `localStorage`.

- Modulo: frontend talento
- Archivos a tocar:
  - `spi_front/src/modules/talento/hooks/useAttendanceFilters.js`
- Entregable:
  - persistencia basica de sesion
- Cierre:
  - restauracion al recargar

### MT-106
Objetivo: persistir vista `table/map`.

- Modulo: frontend talento
- Archivos a tocar:
  - `spi_front/src/modules/talento/hooks/useAttendanceFilters.js`
- Entregable:
  - storage de vista activa
- Cierre:
  - recuerda ultima vista

### MT-107
Objetivo: sincronizar filtros con query params.

- Modulo: frontend talento
- Archivos a tocar:
  - `spi_front/src/modules/talento/hooks/useAttendanceFilters.js`
- Entregable:
  - lectura y escritura de URL
- Cierre:
  - soporta compartir vistas

### MT-108
Objetivo: resetear filtros al cambiar de modo `official/admin`.

- Modulo: frontend talento
- Archivos a tocar:
  - `spi_front/src/modules/talento/hooks/useAttendanceFilters.js`
- Entregable:
  - estrategia de reset por modo
- Cierre:
  - evita estados invalidos

### MT-109
Objetivo: agregar boton `Limpiar filtros` al toolbar.

- Modulo: frontend talento
- Archivos a tocar:
  - `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsToolbar.jsx`
  - `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`
- Entregable:
  - boton visible y funcional
- Cierre:
  - limpia filtros y URL

### MT-110
Objetivo: agregar chips de filtros rapidos al toolbar.

- Modulo: frontend talento
- Archivos a tocar:
  - `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsToolbar.jsx`
- Entregable:
  - chips `Hoy`, `Esta semana`, `Este mes`, `Este anio`
- Cierre:
  - chip activo es visualmente distinguible

### MT-111
Objetivo: disparar consulta automatica al usar quick filter.

- Modulo: frontend talento
- Archivos a tocar:
  - `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`
- Entregable:
  - quick filter consulta sin boton extra
- Cierre:
  - no dispara doble fetch accidental

### MT-112
Objetivo: mostrar advertencia UI si el rango supera 31 dias.

- Modulo: frontend talento
- Archivos a tocar:
  - `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`
  - `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsToolbar.jsx`
- Entregable:
  - warning visual o toast
- Cierre:
  - no bloquea necesariamente, pero informa

### MT-113
Objetivo: agregar filtro `solo discrepancias`.

- Modulo: frontend talento
- Archivos a tocar:
  - `spi_front/src/modules/talento/hooks/useAttendanceFilters.js`
  - `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsToolbar.jsx`
- Entregable:
  - toggle persistente
- Cierre:
  - viaja al backend

### MT-114
Objetivo: agregar filtro `solo con geolocalizacion`.

- Modulo: frontend talento
- Archivos a tocar:
  - `spi_front/src/modules/talento/hooks/useAttendanceFilters.js`
  - `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsToolbar.jsx`
- Entregable:
  - toggle persistente
- Cierre:
  - viaja al backend

### MT-115
Objetivo: agregar filtro `departmentId`.

- Modulo: frontend talento
- Archivos maximos:
  - hook de filtros
  - toolbar
  - api de departamentos si se requiere leer opciones
- Entregable:
  - select de departamento
- Cierre:
  - solo si existe fuente reutilizable de departamentos

### MT-116
Objetivo: agregar soporte multiusuario al estado de filtros.

- Modulo: frontend talento
- Archivos a tocar:
  - `spi_front/src/modules/talento/hooks/useAttendanceFilters.js`
- Entregable:
  - `selectedUserIds`
- Cierre:
  - mantiene compatibilidad con usuario unico

### MT-117
Objetivo: extender `attendanceApi.getAttendanceRange` para query avanzada.

- Modulo: frontend api
- Archivos a tocar:
  - `spi_front/src/core/api/attendanceApi.js`
- Entregable:
  - serializacion de nuevos params
- Cierre:
  - sigue soportando llamadas antiguas

### MT-118
Objetivo: agregar busqueda predictiva de usuario si existe componente reutilizable.

- Modulo: frontend talento
- Archivos maximos:
  - toolbar
  - componente select reutilizable si ya existe
- Entregable:
  - selector mas usable
- Cierre:
  - no rompe modo actual

---

## Fase 6. Frontend de datos: React Query y control de peticiones

### MT-130
Objetivo: crear hook `useAttendanceReportsQuery`.

- Modulo: frontend talento
- Archivos a tocar:
  - nuevo `spi_front/src/modules/talento/hooks/useAttendanceReportsQuery.js`
- Entregable:
  - hook con React Query
- Cierre:
  - `queryKey` basada en filtros

### MT-131
Objetivo: mover el fetch manual de `handleConsultRange` al hook.

- Modulo: frontend talento
- Archivos a tocar:
  - `spi_front/src/modules/talento/hooks/useAttendanceReportsQuery.js`
  - `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`
- Entregable:
  - consulta desacoplada
- Cierre:
  - mismo resultado funcional

### MT-132
Objetivo: soportar cancelacion de requests con AbortController.

- Modulo: frontend api
- Archivos a tocar:
  - `spi_front/src/core/api/attendanceApi.js`
  - `spi_front/src/modules/talento/hooks/useAttendanceReportsQuery.js`
- Entregable:
  - cancelacion al cambiar filtros rapidamente
- Cierre:
  - sin race conditions visibles

### MT-133
Objetivo: usar `enabled` y `keepPreviousData` o patron equivalente.

- Modulo: frontend talento
- Archivos a tocar:
  - `spi_front/src/modules/talento/hooks/useAttendanceReportsQuery.js`
- Entregable:
  - UX mas fluida al refiltrar
- Cierre:
  - la tabla no parpadea innecesariamente

### MT-134
Objetivo: exponer `isInitialLoading`, `isRefetching`, `isError`, `warning`.

- Modulo: frontend talento
- Archivos a tocar:
  - `spi_front/src/modules/talento/hooks/useAttendanceReportsQuery.js`
- Entregable:
  - estados finos de carga
- Cierre:
  - la pagina diferencia primera carga vs recarga

### MT-135
Objetivo: deshabilitar boton consultar mientras hay carga.

- Modulo: frontend talento
- Archivos a tocar:
  - `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsToolbar.jsx`
  - `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`
- Entregable:
  - boton bloqueado correctamente
- Cierre:
  - cumple RF-010

### MT-136
Objetivo: agregar spinner administrativo especifico.

- Modulo: frontend talento
- Archivos a tocar:
  - nuevo `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsLoadingState.jsx`
  - pagina principal
- Entregable:
  - loading state dedicado
- Cierre:
  - cumple RF-011

---

## Fase 7. Frontend tabla administrativa premium

### MT-150
Objetivo: mejorar tabla para mostrar avatar o inicial.

- Modulo: frontend talento
- Archivos a tocar:
  - `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsTableView.jsx`
- Entregable:
  - identificacion visual del colaborador
- Cierre:
  - fallback por inicial

### MT-151
Objetivo: mostrar indicador visual de geolocalizacion por fila.

- Modulo: frontend talento
- Archivos a tocar:
  - `AttendanceReportsTableView.jsx`
- Entregable:
  - badge o icono `con geo`
- Cierre:
  - basado en `has_geo`

### MT-152
Objetivo: mostrar indicador visual de discrepancia por fila.

- Modulo: frontend talento
- Archivos a tocar:
  - `AttendanceReportsTableView.jsx`
- Entregable:
  - badge o icono `discrepancia`
- Cierre:
  - basado en `has_discrepancy`

### MT-153
Objetivo: agregar accion `Ver perfil diario`.

- Modulo: frontend talento
- Archivos maximos:
  - tabla
  - pagina principal
  - util de navegacion si hace falta
- Entregable:
  - link o boton por fila
- Cierre:
  - navega a contexto diario del usuario

### MT-154
Objetivo: agregar accion `Ver en mapa`.

- Modulo: frontend talento
- Archivos a tocar:
  - `AttendanceReportsTableView.jsx`
  - pagina principal
- Entregable:
  - salto de tabla a mapa
- Cierre:
  - cambia vista y enfoca seleccion

### MT-155
Objetivo: agregar ordenamiento local basico por fecha y horas.

- Modulo: frontend talento
- Archivos a tocar:
  - `AttendanceReportsTableView.jsx`
- Entregable:
  - sort simple
- Cierre:
  - sin libreria pesada

### MT-156
Objetivo: personalizar scroll para tablas largas.

- Modulo: frontend talento
- Archivos maximos:
  - tabla
  - stylesheet/util global si ya existe
- Entregable:
  - scrollbar custom
- Cierre:
  - no rompe otras tablas

### MT-157
Objetivo: animar contadores de resumen.

- Modulo: frontend talento
- Archivos a tocar:
  - `AttendanceReportsSummaryCards.jsx`
- Entregable:
  - count-up discreto
- Cierre:
  - no impacta performance

### MT-158
Objetivo: agregar skeleton de primera carga para summary y tabla.

- Modulo: frontend talento
- Archivos a tocar:
  - summary cards
  - loading state
  - tabla
- Entregable:
  - skeleton en primera carga
- Cierre:
  - cumple RU-138

---

## Fase 8. Frontend de vista mapa

### MT-170
Objetivo: crear utilitario frontend de geodatos.

- Modulo: frontend talento
- Archivos a tocar:
  - nuevo `spi_front/src/modules/talento/utils/attendanceGeo.js`
- Entregable:
  - helpers para centro, bounds, jitter y transformacion a markers
- Cierre:
  - funciones puras testeables

### MT-171
Objetivo: crear componente base `AttendanceMapView.jsx`.

- Modulo: frontend talento
- Archivos a tocar:
  - nuevo `spi_front/src/modules/talento/components/attendance-reports/AttendanceMapView.jsx`
- Entregable:
  - contenedor vacio con placeholder
- Cierre:
  - no se renderiza aun por defecto

### MT-172
Objetivo: lazy load del mapa desde la pagina principal.

- Modulo: frontend talento
- Archivos a tocar:
  - `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`
- Entregable:
  - `React.lazy` para mapa
- Cierre:
  - cumple RT-192

### MT-173
Objetivo: agregar switch de vista `Tabla / Mapa`.

- Modulo: frontend talento
- Archivos a tocar:
  - pagina principal
  - toolbar o tabs component
- Entregable:
  - control de vista persistente
- Cierre:
  - no pierde filtros

### MT-174
Objetivo: validar existencia de API key antes de intentar cargar mapa.

- Modulo: frontend talento
- Archivos a tocar:
  - `AttendanceMapView.jsx`
- Entregable:
  - fallback claro si falta key
- Cierre:
  - no rompe la pagina

### MT-175
Objetivo: cargar Google Maps con `@react-google-maps/api`.

- Modulo: frontend talento
- Archivos a tocar:
  - `AttendanceMapView.jsx`
- Entregable:
  - mapa renderizado
- Cierre:
  - centrado inicial funcional

### MT-176
Objetivo: transformar `geo_points` a marcadores.

- Modulo: frontend talento
- Archivos a tocar:
  - `attendanceGeo.js`
  - `AttendanceMapView.jsx`
- Entregable:
  - lista estable de markers
- Cierre:
  - colores por tipo de evento

### MT-177
Objetivo: usar `MarkerF` en lugar de `Marker`.

- Modulo: frontend talento
- Archivos a tocar:
  - `AttendanceMapView.jsx`
- Entregable:
  - compatibilidad React 19
- Cierre:
  - cumple RM-076

### MT-178
Objetivo: agregar colores por tipo de marca.

- Modulo: frontend talento
- Archivos a tocar:
  - `AttendanceMapView.jsx`
- Entregable:
  - entrada verde, almuerzo amarillo, salida rojo
- Cierre:
  - visualmente consistente

### MT-179
Objetivo: mostrar inicial o avatar en marcador si es viable sin complejidad excesiva.

- Modulo: frontend talento
- Archivos a tocar:
  - `AttendanceMapView.jsx`
- Entregable:
  - marker label usable
- Cierre:
  - identificacion rapida del colaborador

### MT-180
Objetivo: abrir InfoWindow al hacer click.

- Modulo: frontend talento
- Archivos a tocar:
  - `AttendanceMapView.jsx`
- Entregable:
  - InfoWindow funcional
- Cierre:
  - muestra nombre, hora, tipo y fecha

### MT-181
Objetivo: agregar link en InfoWindow a perfil diario.

- Modulo: frontend talento
- Archivos a tocar:
  - `AttendanceMapView.jsx`
- Entregable:
  - accion navegable
- Cierre:
  - cumple RM-068

### MT-182
Objetivo: centrar mapa por promedio de coordenadas validas.

- Modulo: frontend talento
- Archivos a tocar:
  - `attendanceGeo.js`
  - `AttendanceMapView.jsx`
- Entregable:
  - auto-centering
- Cierre:
  - cumple RM-062

### MT-183
Objetivo: ajustar zoom al seleccionar un usuario unico.

- Modulo: frontend talento
- Archivos a tocar:
  - `AttendanceMapView.jsx`
- Entregable:
  - zoom contextual
- Cierre:
  - cumple RM-073

### MT-184
Objetivo: agregar boton `Restablecer vista`.

- Modulo: frontend talento
- Archivos a tocar:
  - `AttendanceMapView.jsx`
- Entregable:
  - reset center y zoom
- Cierre:
  - cumple RM-078

### MT-185
Objetivo: desactivar `scroll-to-zoom` por defecto.

- Modulo: frontend talento
- Archivos a tocar:
  - `AttendanceMapView.jsx`
- Entregable:
  - gesture handling seguro
- Cierre:
  - cumple RM-077

### MT-186
Objetivo: agregar controles `satellite` y `standard`.

- Modulo: frontend talento
- Archivos a tocar:
  - `AttendanceMapView.jsx`
- Entregable:
  - toggle de tipo de mapa
- Cierre:
  - cumple RM-069

### MT-187
Objetivo: agregar control fullscreen.

- Modulo: frontend talento
- Archivos a tocar:
  - `AttendanceMapView.jsx`
- Entregable:
  - pantalla completa
- Cierre:
  - cumple RM-074

### MT-188
Objetivo: agregar animacion de entrada de marcadores.

- Modulo: frontend talento
- Archivos a tocar:
  - `AttendanceMapView.jsx`
- Entregable:
  - drop animation o equivalente compatible
- Cierre:
  - cumple RM-070

### MT-189
Objetivo: agregar polilineas por jornada.

- Modulo: frontend talento
- Archivos a tocar:
  - `AttendanceMapView.jsx`
  - `attendanceGeo.js`
- Entregable:
  - lineas de secuencia diaria
- Cierre:
  - cumple RM-071 y RM-072

### MT-190
Objetivo: agregar `MarkerClusterer` para 50+ marcadores.

- Modulo: frontend talento
- Archivos a tocar:
  - `AttendanceMapView.jsx`
- Entregable:
  - clusterizacion basica
- Cierre:
  - cumple RM-065

### MT-191
Objetivo: aplicar jitter a coordenadas identicas.

- Modulo: frontend talento
- Archivos a tocar:
  - `attendanceGeo.js`
  - `AttendanceMapView.jsx`
- Entregable:
  - markers solapados visibles
- Cierre:
  - cumple RT-195

### MT-192
Objetivo: agregar resize observer para el contenedor del mapa.

- Modulo: frontend talento
- Archivos a tocar:
  - `AttendanceMapView.jsx`
- Entregable:
  - mapa responde a cambios de tamano
- Cierre:
  - cumple RM-075

### MT-193
Objetivo: agregar modo degradado para demasiados puntos.

- Modulo: frontend talento
- Archivos a tocar:
  - `AttendanceMapView.jsx`
- Entregable:
  - render mas ligero para 200+ markers
- Cierre:
  - cumple parcialmente RT-185

### MT-194
Objetivo: evaluar heatmap opcional y aislarlo en un toggle.

- Modulo: frontend talento
- Archivos maximos:
  - `AttendanceMapView.jsx`
  - util de mapa si aplica
- Entregable:
  - toggle de heatmap o nota tecnica de bloqueo real
- Cierre:
  - no romper mapa base

---

## Fase 9. UX premium, animaciones y responsive

### MT-210
Objetivo: aplicar encabezado con gradiente y tono premium a la pagina.

- Modulo: frontend talento
- Archivos a tocar:
  - `AsistenciaReportes.jsx`
- Entregable:
  - hero/header mas fuerte
- Cierre:
  - mantiene lenguaje visual del repo

### MT-211
Objetivo: aplicar glassmorphism a paneles de filtro sobre mapa.

- Modulo: frontend talento
- Archivos a tocar:
  - toolbar
  - mapa
- Entregable:
  - panel de control premium
- Cierre:
  - cumple RU-121 sin sobrecargar

### MT-212
Objetivo: agregar transicion `AnimatePresence` entre tabla y mapa.

- Modulo: frontend talento
- Archivos a tocar:
  - pagina principal
- Entregable:
  - cambio de vista animado
- Cierre:
  - cumple RU-123

### MT-213
Objetivo: agregar microinteracciones a quick filters y botones.

- Modulo: frontend talento
- Archivos a tocar:
  - toolbar
  - botones relevantes
- Entregable:
  - hover, press, focus states
- Cierre:
  - cumple RU-125

### MT-214
Objetivo: agregar progress bar superior durante recargas.

- Modulo: frontend talento
- Archivos a tocar:
  - pagina principal
- Entregable:
  - indicador lineal superior
- Cierre:
  - cumple RU-134

### MT-215
Objetivo: agregar tooltips a iconos sin texto.

- Modulo: frontend talento
- Archivos a tocar:
  - toolbar
  - mapa
  - tabla si aplica
- Entregable:
  - tooltips claros
- Cierre:
  - cumple RU-132

### MT-216
Objetivo: agregar toast de error mas fino para 401 y 403.

- Modulo: frontend talento
- Archivos a tocar:
  - pagina principal
- Entregable:
  - mensajes elegantes de permisos
- Cierre:
  - cumple RT-182

### MT-217
Objetivo: activar modo oscuro por `prefers-color-scheme` si el sistema de tema del repo lo permite.

- Modulo: frontend talento
- Archivos maximos:
  - pagina principal
  - estilos locales necesarios
- Entregable:
  - dark mode parcial o completo
- Cierre:
  - no rompe contraste

### MT-218
Objetivo: adaptar quick filters a carrusel horizontal en mobile.

- Modulo: frontend talento
- Archivos a tocar:
  - toolbar
- Entregable:
  - scroll horizontal en pequenos anchos
- Cierre:
  - cumple RU-136

### MT-219
Objetivo: hacer que el mapa ocupe viewport util en mobile.

- Modulo: frontend talento
- Archivos a tocar:
  - mapa
  - pagina principal
- Entregable:
  - alto responsive
- Cierre:
  - cumple RU-137

### MT-220
Objetivo: mejorar accesibilidad de contraste y foco visible.

- Modulo: frontend talento
- Archivos a tocar:
  - toolbar
  - tabla
  - mapa
- Entregable:
  - mejoras WCAG basicas
- Cierre:
  - contraste y focus states aceptables

---

## Fase 10. Pruebas y endurecimiento

### MT-230
Objetivo: crear pruebas unitarias para rangos rapidos frontend.

- Modulo: frontend talento
- Archivos a tocar:
  - nuevo test para `attendanceDateRanges.js`
- Entregable:
  - test de `Hoy`, `Semana`, `Mes`, `Anio`
- Cierre:
  - cubre bordes principales

### MT-231
Objetivo: crear pruebas unitarias backend para normalizador de filtros.

- Modulo: backend attendance
- Archivos a tocar:
  - nuevo test para `attendanceRangeFilters.js`
- Entregable:
  - pruebas de parseo y validacion
- Cierre:
  - cubre fechas invalidas, all, userIds

### MT-232
Objetivo: crear pruebas unitarias backend para parser de ubicacion.

- Modulo: backend attendance
- Archivos a tocar:
  - nuevo test para `attendanceGeo.utils.js`
- Entregable:
  - casos validos e invalidos
- Cierre:
  - cubre strings corruptos y fuera de rango

### MT-233
Objetivo: crear pruebas backend de permisos de acceso.

- Modulo: backend attendance
- Archivos a tocar:
  - test para `attendance.auth.js`
- Entregable:
  - cobertura de acceso propio y global
- Cierre:
  - cubre 403 y allowAll

### MT-234
Objetivo: crear prueba frontend para persistencia de filtros.

- Modulo: frontend talento
- Archivos a tocar:
  - test del hook `useAttendanceFilters`
- Entregable:
  - storage + URL sync
- Cierre:
  - restaura filtros correctamente

### MT-235
Objetivo: crear prueba frontend de cambio de modo y reset.

- Modulo: frontend talento
- Archivos a tocar:
  - test de `useAttendanceFilters`
- Entregable:
  - reset por modo
- Cierre:
  - no deja `all` en modo oficial

### MT-236
Objetivo: crear prueba frontend de empty state y loading state.

- Modulo: frontend talento
- Archivos a tocar:
  - test de pagina o componentes
- Entregable:
  - cobertura visual minima
- Cierre:
  - diferencia primera carga vs sin datos

### MT-237
Objetivo: ejecutar lint focalizado del backend attendance.

- Modulo: backend attendance
- Entregable:
  - lint sin errores en archivos tocados
- Cierre:
  - corregido o documentado

### MT-238
Objetivo: ejecutar lint focalizado del frontend talento reportes.

- Modulo: frontend talento
- Entregable:
  - lint sin errores en archivos tocados
- Cierre:
  - corregido o documentado

### MT-239
Objetivo: validacion manual del flujo `official` para confirmar no regresion.

- Modulo: frontend talento + backend attendance
- Entregable:
  - checklist RH-09 intacto
- Cierre:
  - PDF mensual y anual siguen operativos

### MT-240
Objetivo: validacion manual de permisos.

- Casos:
  - usuario normal solo se ve a si mismo
  - finanzas puede ver global
  - talento humano puede ver global
  - gerencia puede ver global
  - usuario sin permiso recibe 403 elegante
- Cierre:
  - matriz de acceso validada

### MT-241
Objetivo: validacion manual de mapa.

- Casos:
  - sin API key
  - con API key
  - sin datos
  - 1 usuario
  - todos los usuarios
  - coordenadas repetidas
- Cierre:
  - mapa estable y sin bloqueo visual

### MT-242
Objetivo: validacion manual responsive.

- Casos:
  - mobile
  - tablet
  - desktop
- Cierre:
  - filtros y mapa siguen usables

### MT-243
Objetivo: validacion de performance con dataset grande.

- Meta:
  - 10,000 registros
- Cierre:
  - tabla o mapa entra en modo degradado aceptable

---

## Orden maestro recomendado para ejecucion real

Este es el orden recomendado para otra IA:

1. MT-000 a MT-005
2. MT-010 a MT-020
3. MT-030 a MT-047
4. MT-060 a MT-068
5. MT-080 a MT-089
6. MT-100 a MT-118
7. MT-130 a MT-136
8. MT-150 a MT-158
9. MT-170 a MT-194
10. MT-210 a MT-220
11. MT-230 a MT-243

## Regla de corte por fase

La IA debe detenerse al final de cada fase y re-evaluar:

- si hubo desbordamiento de scope
- si algun contrato real del repo contradice el plan
- si aparecio una dependencia de otro modulo
- si una micro-tarea exigio mas de 3 archivos y necesita subdivision

## Criterios de perfeccion para `gpt-5.4-mini`

Para aumentar precision:

1. Cada prompt debe mencionar una sola micro-tarea.
2. El prompt debe incluir archivos exactos permitidos.
3. El prompt debe prohibir refactor fuera del objetivo.
4. El prompt debe exigir verificacion minima focalizada.
5. El prompt debe pedir compatibilidad hacia atras.
6. El prompt debe exigir respuesta final con:
   - que cambio
   - archivos tocados
   - validacion hecha
   - riesgos restantes

## Plantilla recomendada de prompt por micro-tarea

```md
Implementa la micro-tarea MT-XXX del plan de asistencia.

Restricciones:
- Toca solo estos archivos: [...]
- No hagas refactor fuera del objetivo.
- No cambies contratos existentes salvo lo pedido.
- Mantener compatibilidad hacia atras.
- Si descubres que requiere mas de 3 archivos, detente y explica como subdividir.

Objetivo:
- [...]

Criterio de cierre:
- [...]

Validacion:
- Ejecuta solo verificacion minima focalizada del modulo tocado.
```

## Resultado esperado final

Al completar todas las micro-tareas, FamSPI tendra:

- filtros rapidos y avanzados
- consulta administrativa robusta
- tabla premium de asistencia
- mapa interactivo con geolocalizacion
- permisos endurecidos
- auditoria de acceso
- persistencia de filtros y vista
- experiencia responsive y moderna
- base modular para seguir cubriendo requerimientos adicionales
