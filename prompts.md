# Prompt Pack para `gpt-5.4-mini`

## Uso

Para cada ejecucion:

1. Copia el bloque `Prefijo global`.
2. Debajo pega el prompt de la micro-tarea `MT-XXX`.
3. Ejecuta una sola micro-tarea por chat.
4. No avances a la siguiente si la actual no quedo cerrada.

## Prefijo global

```md
Estas implementando una sola micro-tarea del archivo `plan.md` de FamSPI.

Reglas obligatorias:
- Ejecuta solo esta micro-tarea.
- No toques mas de 1 a 3 archivos.
- No hagas refactor fuera del objetivo.
- No cambies contratos existentes salvo lo pedido.
- Mantener compatibilidad hacia atras.
- No toques `registerRoutes.js`, `app.js` ni `roles.js` salvo bloqueo real.
- Si descubres que hace falta tocar mas de 3 archivos, detente y explica como subdividir.
- Al final responde con:
  - que cambiaste
  - archivos tocados
  - validacion ejecutada
  - riesgos o bloqueos restantes

Validacion:
- Ejecuta solo verificacion minima focalizada del modulo tocado.
```

## Fase 0. Descubrimiento y contrato

### MT-000
```md
Ejecuta la micro-tarea MT-000.

Objetivo:
- Leer la respuesta actual de `getRange` y documentar el payload real.

Archivos permitidos:
- `backend/src/modules/attendance/attendance.controller.js`

Tipo:
- Solo lectura.

Cierre:
- Lista exacta de campos hoy devueltos por `/range`.
```

### MT-001
```md
Ejecuta la micro-tarea MT-001.

Objetivo:
- Identificar columnas reales relacionadas con ubicacion en asistencia.

Archivos permitidos:
- `backend/src/modules/attendance/attendance.controller.js`
- `backend/src/modules/attendance/attendance.utils.js`

Tipo:
- Solo lectura.

Cierre:
- Confirmar existencia de `entry_location`, `lunch_start_location`, `lunch_end_location`, `exit_location`.
```

### MT-002
```md
Ejecuta la micro-tarea MT-002.

Objetivo:
- Identificar formato real de ubicacion y si existe parser reutilizable.

Archivos permitidos:
- `backend/src/modules/attendance/attendance.controller.js`
- `backend/src/modules/viaticos/viaticos.service.js`

Tipo:
- Solo lectura.

Cierre:
- Especificacion corta del parser objetivo para coordenadas.
```

### MT-003
```md
Ejecuta la micro-tarea MT-003.

Objetivo:
- Proponer el contrato objetivo extendido para admin sin romper compatibilidad.

Archivos permitidos:
- `plan.md`
- notas locales de tu analisis actual

Tipo:
- Sin cambios de codigo.

Cierre:
- Bloque JSON de respuesta objetivo con `data`, `summary` y `meta`.
```

### MT-004
```md
Ejecuta la micro-tarea MT-004.

Objetivo:
- Listar roles reales con acceso al reporte en backend.

Archivos permitidos:
- `backend/src/modules/attendance/attendance.auth.js`

Tipo:
- Solo lectura.

Cierre:
- Clasificacion entre acceso global y acceso individual.
```

### MT-005
```md
Ejecuta la micro-tarea MT-005.

Objetivo:
- Listar roles y ruta actual de frontend para no duplicar permisos incorrectamente.

Archivos permitidos:
- `spi_front/src/routes/AppRoutes.jsx`

Tipo:
- Solo lectura.

Cierre:
- Diferencias detectadas entre frontend y backend.
```

## Fase 1. Backend de filtros administrativos

### MT-010
```md
Implementa la micro-tarea MT-010.

Objetivo:
- Crear `backend/src/modules/attendance/attendanceRangeFilters.js`.
- Agregar funcion pura `normalizeAttendanceRangeFilters`.

Archivos permitidos:
- `backend/src/modules/attendance/attendanceRangeFilters.js`

Cierre:
- Soporta `start`, `end`, `status`, `userId`.
```

### MT-011
```md
Implementa la micro-tarea MT-011.

Objetivo:
- Extender el normalizador para `userId=all`.

Archivos permitidos:
- `backend/src/modules/attendance/attendanceRangeFilters.js`

Cierre:
- Devuelve bandera clara para consulta global.
```

### MT-012
```md
Implementa la micro-tarea MT-012.

Objetivo:
- Agregar soporte para `userIds` multipseleccion.

Archivos permitidos:
- `backend/src/modules/attendance/attendanceRangeFilters.js`

Cierre:
- Parsea CSV o array a ids enteros validos.
```

### MT-013
```md
Implementa la micro-tarea MT-013.

Objetivo:
- Agregar soporte para `departmentId`.

Archivos permitidos:
- `backend/src/modules/attendance/attendanceRangeFilters.js`

Cierre:
- `departmentId` queda normalizado a entero o `null`.
```

### MT-014
```md
Implementa la micro-tarea MT-014.

Objetivo:
- Agregar soporte para `onlyDiscrepancies`.

Archivos permitidos:
- `backend/src/modules/attendance/attendanceRangeFilters.js`

Cierre:
- Acepta `1`, `true`, `si`, `yes`.
```

### MT-015
```md
Implementa la micro-tarea MT-015.

Objetivo:
- Agregar soporte para `onlyWithGeo`.

Archivos permitidos:
- `backend/src/modules/attendance/attendanceRangeFilters.js`

Cierre:
- La bandera queda serializada de forma consistente.
```

### MT-016
```md
Implementa la micro-tarea MT-016.

Objetivo:
- Validar que `end >= start`.

Archivos permitidos:
- `backend/src/modules/attendance/attendanceRangeFilters.js`

Cierre:
- Error controlado listo para 400 en controlador.
```

### MT-017
```md
Implementa la micro-tarea MT-017.

Objetivo:
- Calcular `rangeDays` y advertencia si excede 31 dias.

Archivos permitidos:
- `backend/src/modules/attendance/attendanceRangeFilters.js`

Cierre:
- Expone `rangeDays` y `exceedsRecommendedRange`.
```

### MT-018
```md
Implementa la micro-tarea MT-018.

Objetivo:
- Agregar soporte para `quickRange`.

Archivos permitidos:
- `backend/src/modules/attendance/attendanceRangeFilters.js`

Cierre:
- Soporta `today`, `week`, `month`, `year` sin romper filtros manuales.
```

### MT-019
```md
Implementa la micro-tarea MT-019.

Objetivo:
- Fijar timezone operativa `America/Guayaquil` para filtros.

Archivos permitidos:
- `backend/src/modules/attendance/attendanceRangeFilters.js`

Cierre:
- `timezone` estable en metadatos.
```

### MT-020
```md
Implementa la micro-tarea MT-020.

Objetivo:
- Integrar el normalizador en `getRange` sin cambiar aun el SQL.

Archivos permitidos:
- `backend/src/modules/attendance/attendance.controller.js`
- `backend/src/modules/attendance/attendanceRangeFilters.js`

Cierre:
- El endpoint sigue funcionando con filtros actuales.
```

## Fase 2. Backend de consulta enriquecida

### MT-030
```md
Implementa la micro-tarea MT-030.

Objetivo:
- Extraer SQL base de `getRange` a una funcion privada reutilizable.

Archivos permitidos:
- `backend/src/modules/attendance/attendance.controller.js`

Cierre:
- El controlador queda mas legible sin cambiar comportamiento.
```

### MT-031
```md
Implementa la micro-tarea MT-031.

Objetivo:
- Crear `backend/src/modules/attendance/attendanceReports.service.js`.

Archivos permitidos:
- `backend/src/modules/attendance/attendanceReports.service.js`

Cierre:
- Servicio listo para recibir filtros normalizados.
```

### MT-032
```md
Implementa la micro-tarea MT-032.

Objetivo:
- Mover la consulta SQL base al servicio nuevo.

Archivos permitidos:
- `backend/src/modules/attendance/attendance.controller.js`
- `backend/src/modules/attendance/attendanceReports.service.js`

Cierre:
- La respuesta queda igual a la actual.
```

### MT-033
```md
Implementa la micro-tarea MT-033.

Objetivo:
- Soportar filtro por `status` en SQL o postfiltro centralizado estable.

Archivos permitidos:
- `backend/src/modules/attendance/attendanceReports.service.js`

Cierre:
- Soporta `no_entry`, `working`, `lunch_open`, `completed`.
```

### MT-034
```md
Implementa la micro-tarea MT-034.

Objetivo:
- Soportar `userId=all` en el servicio.

Archivos permitidos:
- `backend/src/modules/attendance/attendanceReports.service.js`

Cierre:
- Consulta global segura sin SQL inseguro.
```

### MT-035
```md
Implementa la micro-tarea MT-035.

Objetivo:
- Soportar `userIds` multiusuario en el servicio.

Archivos permitidos:
- `backend/src/modules/attendance/attendanceReports.service.js`

Cierre:
- Usa filtro `IN (...)` parametrizado.
```

### MT-036
```md
Implementa la micro-tarea MT-036.

Objetivo:
- Soportar filtro por departamento.

Archivos permitidos:
- `backend/src/modules/attendance/attendanceReports.service.js`

Cierre:
- Devuelve `department_name`.
```

### MT-037
```md
Implementa la micro-tarea MT-037.

Objetivo:
- Calcular `has_geo` por fila.

Archivos permitidos:
- `backend/src/modules/attendance/attendanceReports.service.js`

Cierre:
- `has_geo` es `true` si al menos un punto geografico es valido.
```

### MT-038
```md
Implementa la micro-tarea MT-038.

Objetivo:
- Crear parser seguro de coordenadas en `attendanceGeo.utils.js`.

Archivos permitidos:
- `backend/src/modules/attendance/attendanceGeo.utils.js`

Cierre:
- Soporta strings `"lat,lng"` y rechaza valores fuera de rango.
```

### MT-039
```md
Implementa la micro-tarea MT-039.

Objetivo:
- Reutilizar el parser para construir `geo_points`.

Archivos permitidos:
- `backend/src/modules/attendance/attendanceReports.service.js`
- `backend/src/modules/attendance/attendanceGeo.utils.js`

Cierre:
- `geo_points` incluye tipo, label, hora, lat y lng.
```

### MT-040
```md
Implementa la micro-tarea MT-040.

Objetivo:
- Agregar `has_discrepancy` por fila.

Archivos permitidos:
- `backend/src/modules/attendance/attendanceReports.service.js`

Cierre:
- La regla queda documentada y aplicada en una sola funcion.
```

### MT-041
```md
Implementa la micro-tarea MT-041.

Objetivo:
- Soportar filtro `onlyWithGeo`.

Archivos permitidos:
- `backend/src/modules/attendance/attendanceReports.service.js`

Cierre:
- Solo devuelve filas con `has_geo=true`.
```

### MT-042
```md
Implementa la micro-tarea MT-042.

Objetivo:
- Soportar filtro `onlyDiscrepancies`.

Archivos permitidos:
- `backend/src/modules/attendance/attendanceReports.service.js`

Cierre:
- Solo devuelve filas discrepantes.
```

### MT-043
```md
Implementa la micro-tarea MT-043.

Objetivo:
- Agregar `polyline_points` por fila o por jornada.

Archivos permitidos:
- `backend/src/modules/attendance/attendanceReports.service.js`

Cierre:
- El orden logico es entrada -> almuerzo -> salida.
```

### MT-044
```md
Implementa la micro-tarea MT-044.

Objetivo:
- Enriquecer `summary` con `withGeo`.

Archivos permitidos:
- `backend/src/modules/attendance/attendanceReports.service.js`

Cierre:
- El total es correcto sobre filas filtradas.
```

### MT-045
```md
Implementa la micro-tarea MT-045.

Objetivo:
- Enriquecer `summary` con `withDiscrepancy`.

Archivos permitidos:
- `backend/src/modules/attendance/attendanceReports.service.js`

Cierre:
- El valor es consistente con el dataset devuelto.
```

### MT-046
```md
Implementa la micro-tarea MT-046.

Objetivo:
- Agregar `meta` a la respuesta del endpoint.

Archivos permitidos:
- `backend/src/modules/attendance/attendance.controller.js`

Cierre:
- `meta` incluye `start`, `end`, `timezone` y filtros activos.
```

### MT-047
```md
Implementa la micro-tarea MT-047.

Objetivo:
- Exponer advertencia por rango mayor a 31 dias en `meta`.

Archivos permitidos:
- `backend/src/modules/attendance/attendance.controller.js`

Cierre:
- `meta.warnings` queda listo para el frontend.
```

## Fase 3. Backend de seguridad, auditoria y robustez

### MT-060
```md
Implementa la micro-tarea MT-060.

Objetivo:
- Separar acceso global vs acceso propio en `attendance.auth.js`.

Archivos permitidos:
- `backend/src/modules/attendance/attendance.auth.js`

Cierre:
- Existe helper explicito `hasGlobalAttendanceReportingAccess`.
```

### MT-061
```md
Implementa la micro-tarea MT-061.

Objetivo:
- Usar el helper global en `canAccessAttendanceTarget`.

Archivos permitidos:
- `backend/src/modules/attendance/attendance.auth.js`

Cierre:
- La logica de `all` queda clara y no ambigua.
```

### MT-062
```md
Implementa la micro-tarea MT-062.

Objetivo:
- Mejorar mensaje 403 para consultas sin permiso.

Archivos permitidos:
- `backend/src/modules/attendance/attendance.auth.js`

Cierre:
- El frontend puede distinguir el 403 real con mensaje claro.
```

### MT-063
```md
Implementa la micro-tarea MT-063.

Objetivo:
- Crear `attendanceAudit.service.js` con `logAttendanceReportAccess`.

Archivos permitidos:
- `backend/src/modules/attendance/attendanceAudit.service.js`

Cierre:
- La funcion recibe requester, filtros y resultado.
```

### MT-064
```md
Implementa la micro-tarea MT-064.

Objetivo:
- Registrar auditoria al consultar `/range`.

Archivos permitidos:
- `backend/src/modules/attendance/attendance.controller.js`
- `backend/src/modules/attendance/attendanceAudit.service.js`

Cierre:
- La auditoria incluye `userId`, rango, modo y filtros.
```

### MT-065
```md
Implementa la micro-tarea MT-065.

Objetivo:
- Enriquecer logs de error de `/range`.

Archivos permitidos:
- `backend/src/modules/attendance/attendance.controller.js`

Cierre:
- El log de error incluye requester y rango.
```

### MT-066
```md
Implementa la micro-tarea MT-066.

Objetivo:
- Sanitizar campos de texto antes de enviarlos a InfoWindow.

Archivos permitidos:
- `backend/src/modules/attendance/attendanceReports.service.js`

Cierre:
- Nombres y labels no salen con HTML inseguro.
```

### MT-067
```md
Implementa la micro-tarea MT-067.

Objetivo:
- Aplicar rate limiting especifico al endpoint de reportes si existe patron reutilizable.

Archivos permitidos:
- `backend/src/modules/attendance/attendance.routes.js`
- un helper de middlewares ya existente solo si es estrictamente necesario

Cierre:
- El limitador no afecta clock-in normal.
```

### MT-068
```md
Implementa la micro-tarea MT-068.

Objetivo:
- Revisar y corregir la cola rota al final de `attendance.routes.js` si bloquea trabajo posterior.

Archivos permitidos:
- `backend/src/modules/attendance/attendance.routes.js`

Cierre:
- El archivo queda sintacticamente estable.
```

## Fase 4. Frontend base: desmontar monolito de AsistenciaReportes

### MT-080
```md
Ejecuta la micro-tarea MT-080.

Objetivo:
- Leer `AsistenciaReportes.jsx` y delimitar secciones reutilizables.

Archivos permitidos:
- `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`

Tipo:
- Solo lectura.

Cierre:
- Lista de bloques a extraer: toolbar, summary, table, empty state.
```

### MT-081
```md
Implementa la micro-tarea MT-081.

Objetivo:
- Crear carpeta y archivos base para `attendance-reports`.

Archivos permitidos:
- archivos nuevos en `spi_front/src/modules/talento/components/attendance-reports/`

Cierre:
- La estructura inicial queda creada sin cambiar comportamiento.
```

### MT-082
```md
Implementa la micro-tarea MT-082.

Objetivo:
- Crear `AttendanceReportsSummaryCards.jsx`.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsSummaryCards.jsx`

Cierre:
- Es un componente puro de KPI cards.
```

### MT-083
```md
Implementa la micro-tarea MT-083.

Objetivo:
- Mover summary cards fuera de `AsistenciaReportes.jsx`.

Archivos permitidos:
- `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsSummaryCards.jsx`

Cierre:
- La UI sigue identica.
```

### MT-084
```md
Implementa la micro-tarea MT-084.

Objetivo:
- Crear `AttendanceReportsEmptyState.jsx`.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsEmptyState.jsx`

Cierre:
- Reemplaza el bloque inline actual.
```

### MT-085
```md
Implementa la micro-tarea MT-085.

Objetivo:
- Extraer el empty state a su componente.

Archivos permitidos:
- `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsEmptyState.jsx`

Cierre:
- La pagina queda mas pequena y el comportamiento visual no cambia.
```

### MT-086
```md
Implementa la micro-tarea MT-086.

Objetivo:
- Crear `AttendanceReportsTableView.jsx`.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsTableView.jsx`

Cierre:
- Recibe `rows` y callbacks.
```

### MT-087
```md
Implementa la micro-tarea MT-087.

Objetivo:
- Extraer la tabla actual al componente nuevo.

Archivos permitidos:
- `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsTableView.jsx`

Cierre:
- El render actual se preserva.
```

### MT-088
```md
Implementa la micro-tarea MT-088.

Objetivo:
- Crear `AttendanceReportsToolbar.jsx`.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsToolbar.jsx`

Cierre:
- Es un componente de presentacion sin fetch.
```

### MT-089
```md
Implementa la micro-tarea MT-089.

Objetivo:
- Extraer el toolbar actual a su componente.

Archivos permitidos:
- `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsToolbar.jsx`

Cierre:
- La pagina queda enfocada en estado y composicion.
```

## Fase 5. Frontend de filtros, URL y persistencia

### MT-100
```md
Implementa la micro-tarea MT-100.

Objetivo:
- Crear `attendanceDateRanges.js` con helpers de rangos rapidos.

Archivos permitidos:
- `spi_front/src/modules/talento/utils/attendanceDateRanges.js`

Cierre:
- Expone `today`, `thisWeek`, `thisMonth`, `thisYear` en formato `YYYY-MM-DD`.
```

### MT-101
```md
Implementa la micro-tarea MT-101.

Objetivo:
- Crear hook `useAttendanceFilters`.

Archivos permitidos:
- `spi_front/src/modules/talento/hooks/useAttendanceFilters.js`

Cierre:
- Maneja `startDate`, `endDate`, `mode`, `view`, `status`, `userIds`.
```

### MT-102
```md
Implementa la micro-tarea MT-102.

Objetivo:
- Mover el estado base de filtros al hook nuevo.

Archivos permitidos:
- `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`
- `spi_front/src/modules/talento/hooks/useAttendanceFilters.js`

Cierre:
- El comportamiento sigue igual al actual.
```

### MT-103
```md
Implementa la micro-tarea MT-103.

Objetivo:
- Agregar `clearFilters` al hook.

Archivos permitidos:
- `spi_front/src/modules/talento/hooks/useAttendanceFilters.js`

Cierre:
- El reset deja un estado inicial consistente.
```

### MT-104
```md
Implementa la micro-tarea MT-104.

Objetivo:
- Agregar `applyQuickRange` al hook.

Archivos permitidos:
- `spi_front/src/modules/talento/hooks/useAttendanceFilters.js`
- `spi_front/src/modules/talento/utils/attendanceDateRanges.js`

Cierre:
- Actualiza fechas y quick filter activo.
```

### MT-105
```md
Implementa la micro-tarea MT-105.

Objetivo:
- Persistir filtros en storage.

Archivos permitidos:
- `spi_front/src/modules/talento/hooks/useAttendanceFilters.js`

Cierre:
- Los filtros se restauran al recargar.
```

### MT-106
```md
Implementa la micro-tarea MT-106.

Objetivo:
- Persistir vista `table/map`.

Archivos permitidos:
- `spi_front/src/modules/talento/hooks/useAttendanceFilters.js`

Cierre:
- La vista activa se recuerda entre recargas.
```

### MT-107
```md
Implementa la micro-tarea MT-107.

Objetivo:
- Sincronizar filtros con query params.

Archivos permitidos:
- `spi_front/src/modules/talento/hooks/useAttendanceFilters.js`

Cierre:
- Soporta lectura y escritura de URL para compartir vistas.
```

### MT-108
```md
Implementa la micro-tarea MT-108.

Objetivo:
- Resetear filtros al cambiar de modo `official/admin`.

Archivos permitidos:
- `spi_front/src/modules/talento/hooks/useAttendanceFilters.js`

Cierre:
- Evita estados invalidos al cambiar de modo.
```

### MT-109
```md
Implementa la micro-tarea MT-109.

Objetivo:
- Agregar boton `Limpiar filtros` al toolbar.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsToolbar.jsx`
- `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`

Cierre:
- Limpia filtros y URL.
```

### MT-110
```md
Implementa la micro-tarea MT-110.

Objetivo:
- Agregar chips de filtros rapidos al toolbar.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsToolbar.jsx`

Cierre:
- Los chips `Hoy`, `Esta semana`, `Este mes`, `Este anio` son visualmente distinguibles.
```

### MT-111
```md
Implementa la micro-tarea MT-111.

Objetivo:
- Disparar consulta automatica al usar quick filter.

Archivos permitidos:
- `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`

Cierre:
- No dispara doble fetch accidental.
```

### MT-112
```md
Implementa la micro-tarea MT-112.

Objetivo:
- Mostrar advertencia UI si el rango supera 31 dias.

Archivos permitidos:
- `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsToolbar.jsx`

Cierre:
- El warning informa sin romper el flujo.
```

### MT-113
```md
Implementa la micro-tarea MT-113.

Objetivo:
- Agregar filtro `solo discrepancias`.

Archivos permitidos:
- `spi_front/src/modules/talento/hooks/useAttendanceFilters.js`
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsToolbar.jsx`

Cierre:
- El toggle persiste y viaja al backend.
```

### MT-114
```md
Implementa la micro-tarea MT-114.

Objetivo:
- Agregar filtro `solo con geolocalizacion`.

Archivos permitidos:
- `spi_front/src/modules/talento/hooks/useAttendanceFilters.js`
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsToolbar.jsx`

Cierre:
- El toggle persiste y viaja al backend.
```

### MT-115
```md
Implementa la micro-tarea MT-115.

Objetivo:
- Agregar filtro `departmentId` si existe fuente reutilizable de departamentos.

Archivos permitidos:
- `spi_front/src/modules/talento/hooks/useAttendanceFilters.js`
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsToolbar.jsx`
- api de departamentos solo si es estrictamente necesario

Cierre:
- El select de departamento queda funcional o se documenta el bloqueo real.
```

### MT-116
```md
Implementa la micro-tarea MT-116.

Objetivo:
- Agregar soporte multiusuario al estado de filtros.

Archivos permitidos:
- `spi_front/src/modules/talento/hooks/useAttendanceFilters.js`

Cierre:
- `selectedUserIds` mantiene compatibilidad con usuario unico.
```

### MT-117
```md
Implementa la micro-tarea MT-117.

Objetivo:
- Extender `attendanceApi.getAttendanceRange` para query avanzada.

Archivos permitidos:
- `spi_front/src/core/api/attendanceApi.js`

Cierre:
- Sigue soportando llamadas antiguas.
```

### MT-118
```md
Implementa la micro-tarea MT-118.

Objetivo:
- Agregar busqueda predictiva de usuario si existe componente reutilizable.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsToolbar.jsx`
- componente select reutilizable solo si ya existe

Cierre:
- El selector mejora sin romper el modo actual.
```

## Fase 6. Frontend de datos: React Query y control de peticiones

### MT-130
```md
Implementa la micro-tarea MT-130.

Objetivo:
- Crear hook `useAttendanceReportsQuery`.

Archivos permitidos:
- `spi_front/src/modules/talento/hooks/useAttendanceReportsQuery.js`

Cierre:
- Usa `queryKey` basada en filtros.
```

### MT-131
```md
Implementa la micro-tarea MT-131.

Objetivo:
- Mover el fetch manual de `handleConsultRange` al hook.

Archivos permitidos:
- `spi_front/src/modules/talento/hooks/useAttendanceReportsQuery.js`
- `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`

Cierre:
- El resultado funcional es el mismo.
```

### MT-132
```md
Implementa la micro-tarea MT-132.

Objetivo:
- Soportar cancelacion de requests con AbortController.

Archivos permitidos:
- `spi_front/src/core/api/attendanceApi.js`
- `spi_front/src/modules/talento/hooks/useAttendanceReportsQuery.js`

Cierre:
- No quedan race conditions visibles.
```

### MT-133
```md
Implementa la micro-tarea MT-133.

Objetivo:
- Usar `enabled` y `keepPreviousData` o patron equivalente.

Archivos permitidos:
- `spi_front/src/modules/talento/hooks/useAttendanceReportsQuery.js`

Cierre:
- La tabla no parpadea innecesariamente.
```

### MT-134
```md
Implementa la micro-tarea MT-134.

Objetivo:
- Exponer `isInitialLoading`, `isRefetching`, `isError`, `warning`.

Archivos permitidos:
- `spi_front/src/modules/talento/hooks/useAttendanceReportsQuery.js`

Cierre:
- La pagina diferencia primera carga vs recarga.
```

### MT-135
```md
Implementa la micro-tarea MT-135.

Objetivo:
- Deshabilitar boton consultar mientras hay carga.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsToolbar.jsx`
- `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`

Cierre:
- Cumple RF-010.
```

### MT-136
```md
Implementa la micro-tarea MT-136.

Objetivo:
- Agregar spinner administrativo especifico.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsLoadingState.jsx`
- `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`

Cierre:
- Cumple RF-011.
```

## Fase 7. Frontend tabla administrativa premium

### MT-150
```md
Implementa la micro-tarea MT-150.

Objetivo:
- Mejorar tabla para mostrar avatar o inicial.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsTableView.jsx`

Cierre:
- Tiene fallback por inicial.
```

### MT-151
```md
Implementa la micro-tarea MT-151.

Objetivo:
- Mostrar indicador visual de geolocalizacion por fila.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsTableView.jsx`

Cierre:
- Se basa en `has_geo`.
```

### MT-152
```md
Implementa la micro-tarea MT-152.

Objetivo:
- Mostrar indicador visual de discrepancia por fila.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsTableView.jsx`

Cierre:
- Se basa en `has_discrepancy`.
```

### MT-153
```md
Implementa la micro-tarea MT-153.

Objetivo:
- Agregar accion `Ver perfil diario`.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsTableView.jsx`
- `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`
- util de navegacion solo si es estrictamente necesario

Cierre:
- Navega a contexto diario del usuario.
```

### MT-154
```md
Implementa la micro-tarea MT-154.

Objetivo:
- Agregar accion `Ver en mapa`.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsTableView.jsx`
- `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`

Cierre:
- Cambia de vista y enfoca seleccion.
```

### MT-155
```md
Implementa la micro-tarea MT-155.

Objetivo:
- Agregar ordenamiento local basico por fecha y horas.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsTableView.jsx`

Cierre:
- No usa libreria pesada.
```

### MT-156
```md
Implementa la micro-tarea MT-156.

Objetivo:
- Personalizar scroll para tablas largas.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsTableView.jsx`
- stylesheet o util global solo si ya existe

Cierre:
- No rompe otras tablas.
```

### MT-157
```md
Implementa la micro-tarea MT-157.

Objetivo:
- Animar contadores de resumen.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsSummaryCards.jsx`

Cierre:
- El count-up es discreto y no afecta performance.
```

### MT-158
```md
Implementa la micro-tarea MT-158.

Objetivo:
- Agregar skeleton de primera carga para summary y tabla.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsSummaryCards.jsx`
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsLoadingState.jsx`
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsTableView.jsx`

Cierre:
- Cumple RU-138.
```

## Fase 8. Frontend de vista mapa

### MT-170
```md
Implementa la micro-tarea MT-170.

Objetivo:
- Crear `attendanceGeo.js` con helpers para centro, bounds, jitter y transformacion a markers.

Archivos permitidos:
- `spi_front/src/modules/talento/utils/attendanceGeo.js`

Cierre:
- Las funciones son puras y testeables.
```

### MT-171
```md
Implementa la micro-tarea MT-171.

Objetivo:
- Crear componente base `AttendanceMapView.jsx`.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceMapView.jsx`

Cierre:
- Hay placeholder y aun no se renderiza por defecto.
```

### MT-172
```md
Implementa la micro-tarea MT-172.

Objetivo:
- Hacer lazy load del mapa desde la pagina principal.

Archivos permitidos:
- `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`

Cierre:
- Cumple RT-192.
```

### MT-173
```md
Implementa la micro-tarea MT-173.

Objetivo:
- Agregar switch de vista `Tabla / Mapa`.

Archivos permitidos:
- `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`
- toolbar o tabs component solo si ya existe

Cierre:
- La vista persiste y no pierde filtros.
```

### MT-174
```md
Implementa la micro-tarea MT-174.

Objetivo:
- Validar existencia de API key antes de cargar mapa.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceMapView.jsx`

Cierre:
- Hay fallback claro si falta key.
```

### MT-175
```md
Implementa la micro-tarea MT-175.

Objetivo:
- Cargar Google Maps con `@react-google-maps/api`.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceMapView.jsx`

Cierre:
- El mapa renderiza y centra de forma funcional.
```

### MT-176
```md
Implementa la micro-tarea MT-176.

Objetivo:
- Transformar `geo_points` a marcadores.

Archivos permitidos:
- `spi_front/src/modules/talento/utils/attendanceGeo.js`
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceMapView.jsx`

Cierre:
- La lista de markers es estable y coloreada por tipo.
```

### MT-177
```md
Implementa la micro-tarea MT-177.

Objetivo:
- Usar `MarkerF` en lugar de `Marker`.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceMapView.jsx`

Cierre:
- Cumple RM-076.
```

### MT-178
```md
Implementa la micro-tarea MT-178.

Objetivo:
- Agregar colores por tipo de marca.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceMapView.jsx`

Cierre:
- Entrada verde, almuerzo amarillo, salida rojo.
```

### MT-179
```md
Implementa la micro-tarea MT-179.

Objetivo:
- Mostrar inicial o avatar en marcador si es viable sin complejidad excesiva.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceMapView.jsx`

Cierre:
- Hay identificacion rapida del colaborador.
```

### MT-180
```md
Implementa la micro-tarea MT-180.

Objetivo:
- Abrir InfoWindow al hacer click.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceMapView.jsx`

Cierre:
- Muestra nombre, hora, tipo y fecha.
```

### MT-181
```md
Implementa la micro-tarea MT-181.

Objetivo:
- Agregar link en InfoWindow a perfil diario.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceMapView.jsx`

Cierre:
- Cumple RM-068.
```

### MT-182
```md
Implementa la micro-tarea MT-182.

Objetivo:
- Centrar mapa por promedio de coordenadas validas.

Archivos permitidos:
- `spi_front/src/modules/talento/utils/attendanceGeo.js`
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceMapView.jsx`

Cierre:
- Cumple RM-062.
```

### MT-183
```md
Implementa la micro-tarea MT-183.

Objetivo:
- Ajustar zoom al seleccionar un usuario unico.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceMapView.jsx`

Cierre:
- Cumple RM-073.
```

### MT-184
```md
Implementa la micro-tarea MT-184.

Objetivo:
- Agregar boton `Restablecer vista`.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceMapView.jsx`

Cierre:
- Cumple RM-078.
```

### MT-185
```md
Implementa la micro-tarea MT-185.

Objetivo:
- Desactivar `scroll-to-zoom` por defecto.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceMapView.jsx`

Cierre:
- Cumple RM-077.
```

### MT-186
```md
Implementa la micro-tarea MT-186.

Objetivo:
- Agregar controles `satellite` y `standard`.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceMapView.jsx`

Cierre:
- Cumple RM-069.
```

### MT-187
```md
Implementa la micro-tarea MT-187.

Objetivo:
- Agregar control fullscreen.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceMapView.jsx`

Cierre:
- Cumple RM-074.
```

### MT-188
```md
Implementa la micro-tarea MT-188.

Objetivo:
- Agregar animacion de entrada de marcadores.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceMapView.jsx`

Cierre:
- Cumple RM-070.
```

### MT-189
```md
Implementa la micro-tarea MT-189.

Objetivo:
- Agregar polilineas por jornada.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceMapView.jsx`
- `spi_front/src/modules/talento/utils/attendanceGeo.js`

Cierre:
- Cumple RM-071 y RM-072.
```

### MT-190
```md
Implementa la micro-tarea MT-190.

Objetivo:
- Agregar `MarkerClusterer` para 50+ marcadores.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceMapView.jsx`

Cierre:
- Cumple RM-065.
```

### MT-191
```md
Implementa la micro-tarea MT-191.

Objetivo:
- Aplicar jitter a coordenadas identicas.

Archivos permitidos:
- `spi_front/src/modules/talento/utils/attendanceGeo.js`
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceMapView.jsx`

Cierre:
- Cumple RT-195.
```

### MT-192
```md
Implementa la micro-tarea MT-192.

Objetivo:
- Agregar resize observer para el contenedor del mapa.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceMapView.jsx`

Cierre:
- Cumple RM-075.
```

### MT-193
```md
Implementa la micro-tarea MT-193.

Objetivo:
- Agregar modo degradado para demasiados puntos.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceMapView.jsx`

Cierre:
- Hay render mas ligero para 200+ markers.
```

### MT-194
```md
Implementa la micro-tarea MT-194.

Objetivo:
- Evaluar heatmap opcional y aislarlo en un toggle.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceMapView.jsx`
- util de mapa solo si es estrictamente necesario

Cierre:
- Se implementa el toggle o se documenta un bloqueo real sin romper el mapa base.
```

## Fase 9. UX premium, animaciones y responsive

### MT-210
```md
Implementa la micro-tarea MT-210.

Objetivo:
- Aplicar encabezado con gradiente y tono premium a la pagina.

Archivos permitidos:
- `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`

Cierre:
- El lenguaje visual sigue alineado al repo.
```

### MT-211
```md
Implementa la micro-tarea MT-211.

Objetivo:
- Aplicar glassmorphism a paneles de filtro sobre mapa.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsToolbar.jsx`
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceMapView.jsx`

Cierre:
- Cumple RU-121 sin sobrecargar la UI.
```

### MT-212
```md
Implementa la micro-tarea MT-212.

Objetivo:
- Agregar transicion `AnimatePresence` entre tabla y mapa.

Archivos permitidos:
- `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`

Cierre:
- Cumple RU-123.
```

### MT-213
```md
Implementa la micro-tarea MT-213.

Objetivo:
- Agregar microinteracciones a quick filters y botones.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsToolbar.jsx`
- otros botones relevantes solo si ya estan dentro del mismo modulo

Cierre:
- Cumple RU-125.
```

### MT-214
```md
Implementa la micro-tarea MT-214.

Objetivo:
- Agregar progress bar superior durante recargas.

Archivos permitidos:
- `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`

Cierre:
- Cumple RU-134.
```

### MT-215
```md
Implementa la micro-tarea MT-215.

Objetivo:
- Agregar tooltips a iconos sin texto.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsToolbar.jsx`
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceMapView.jsx`
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsTableView.jsx`

Cierre:
- Cumple RU-132.
```

### MT-216
```md
Implementa la micro-tarea MT-216.

Objetivo:
- Agregar toast de error mas fino para 401 y 403.

Archivos permitidos:
- `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`

Cierre:
- Cumple RT-182.
```

### MT-217
```md
Implementa la micro-tarea MT-217.

Objetivo:
- Activar modo oscuro por `prefers-color-scheme` si el sistema del repo lo permite.

Archivos permitidos:
- `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`
- estilos locales necesarios solo si son estrictamente necesarios

Cierre:
- No rompe contraste.
```

### MT-218
```md
Implementa la micro-tarea MT-218.

Objetivo:
- Adaptar quick filters a carrusel horizontal en mobile.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsToolbar.jsx`

Cierre:
- Cumple RU-136.
```

### MT-219
```md
Implementa la micro-tarea MT-219.

Objetivo:
- Hacer que el mapa ocupe viewport util en mobile.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceMapView.jsx`
- `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`

Cierre:
- Cumple RU-137.
```

### MT-220
```md
Implementa la micro-tarea MT-220.

Objetivo:
- Mejorar accesibilidad de contraste y foco visible.

Archivos permitidos:
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsToolbar.jsx`
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceReportsTableView.jsx`
- `spi_front/src/modules/talento/components/attendance-reports/AttendanceMapView.jsx`

Cierre:
- Contraste y focus states aceptables.
```

## Fase 10. Pruebas y endurecimiento

### MT-230
```md
Implementa la micro-tarea MT-230.

Objetivo:
- Crear pruebas unitarias para rangos rapidos frontend.

Archivos permitidos:
- test nuevo para `attendanceDateRanges.js`

Cierre:
- Cubre `Hoy`, `Semana`, `Mes`, `Anio`.
```

### MT-231
```md
Implementa la micro-tarea MT-231.

Objetivo:
- Crear pruebas unitarias backend para normalizador de filtros.

Archivos permitidos:
- test nuevo para `attendanceRangeFilters.js`

Cierre:
- Cubre fechas invalidas, `all` y `userIds`.
```

### MT-232
```md
Implementa la micro-tarea MT-232.

Objetivo:
- Crear pruebas unitarias backend para parser de ubicacion.

Archivos permitidos:
- test nuevo para `attendanceGeo.utils.js`

Cierre:
- Cubre strings corruptos y fuera de rango.
```

### MT-233
```md
Implementa la micro-tarea MT-233.

Objetivo:
- Crear pruebas backend de permisos de acceso.

Archivos permitidos:
- test para `attendance.auth.js`

Cierre:
- Cubre acceso propio, global, 403 y `allowAll`.
```

### MT-234
```md
Implementa la micro-tarea MT-234.

Objetivo:
- Crear prueba frontend para persistencia de filtros.

Archivos permitidos:
- test del hook `useAttendanceFilters`

Cierre:
- Cubre storage y URL sync.
```

### MT-235
```md
Implementa la micro-tarea MT-235.

Objetivo:
- Crear prueba frontend de cambio de modo y reset.

Archivos permitidos:
- test de `useAttendanceFilters`

Cierre:
- Confirma que `all` no queda en modo oficial.
```

### MT-236
```md
Implementa la micro-tarea MT-236.

Objetivo:
- Crear prueba frontend de empty state y loading state.

Archivos permitidos:
- test de pagina o componentes del modulo

Cierre:
- Distingue primera carga vs sin datos.
```

### MT-237
```md
Ejecuta la micro-tarea MT-237.

Objetivo:
- Ejecutar lint focalizado del backend attendance.

Archivos permitidos:
- solo archivos tocados del modulo attendance

Tipo:
- Validacion focalizada.

Cierre:
- Lint sin errores o con observaciones documentadas.
```

### MT-238
```md
Ejecuta la micro-tarea MT-238.

Objetivo:
- Ejecutar lint focalizado del frontend de reportes.

Archivos permitidos:
- solo archivos tocados del modulo de reportes

Tipo:
- Validacion focalizada.

Cierre:
- Lint sin errores o con observaciones documentadas.
```

### MT-239
```md
Ejecuta la micro-tarea MT-239.

Objetivo:
- Validar manualmente que el flujo `official` no regrese.

Archivos permitidos:
- los necesarios para inspeccion del flujo RH-09

Tipo:
- Validacion manual.

Cierre:
- PDF mensual y anual siguen operativos.
```

### MT-240
```md
Ejecuta la micro-tarea MT-240.

Objetivo:
- Validar manualmente permisos.

Casos:
- usuario normal solo se ve a si mismo
- finanzas puede ver global
- talento humano puede ver global
- gerencia puede ver global
- usuario sin permiso recibe 403 elegante

Tipo:
- Validacion manual.

Cierre:
- Matriz de acceso validada.
```

### MT-241
```md
Ejecuta la micro-tarea MT-241.

Objetivo:
- Validar manualmente el mapa.

Casos:
- sin API key
- con API key
- sin datos
- 1 usuario
- todos los usuarios
- coordenadas repetidas

Tipo:
- Validacion manual.

Cierre:
- El mapa queda estable y sin bloqueo visual.
```

### MT-242
```md
Ejecuta la micro-tarea MT-242.

Objetivo:
- Validar manualmente responsive.

Casos:
- mobile
- tablet
- desktop

Tipo:
- Validacion manual.

Cierre:
- Filtros y mapa siguen usables.
```

### MT-243
```md
Ejecuta la micro-tarea MT-243.

Objetivo:
- Validar performance con dataset grande.

Meta:
- 10,000 registros

Tipo:
- Validacion manual o tecnica controlada.

Cierre:
- La tabla o el mapa entra en modo degradado aceptable.
```

## Orden recomendado

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
