# Informe de ejecucion
## Ajuste del widget de aprobacion de permisos y vacaciones

Fecha: 2026-03-10

## 1. Hallazgo validado
- La pestana `Aprobar` de `PermisosStatusWidget` mezclaba bloques distintos sin una cola unica:
  - pendientes de aprobacion
  - solicitudes aprobadas
  - cancelaciones pendientes
  - matriculas de estudios pendientes
- Las solicitudes aprobadas se mostraban sin filtrar si realmente estaban pendientes de coordinacion o si aun podian cancelarse.
- El orden visual dependia del bloque de origen, no de una prioridad cronologica unica.

## 2. Regla funcional aplicada
- La pestana `Aprobar` debe mostrar solo:
  - pendientes de aprobacion
  - pendientes de aprobar cancelacion
  - pendientes de coordinacion
  - solicitudes aprobadas que aun se pueden cancelar
- La cola debe mostrarse de la mas reciente a la mas antigua.
- Las matriculas de estudios pendientes no deben mezclarse en `Aprobar`; quedan en una pestana independiente.

## 3. Cambios implementados
- `spi_front/src/modules/shared/solicitudes/components/PermisosStatusWidget.jsx`
  - se construyo una cola unica `approvalQueue`
  - se filtro `pendientesAprobadas` para incluir solo coordinacion pendiente o cancelacion posible
  - se ordeno la cola por recencia operativa usando `cancellation_requested_at`, `recovery_plan_updated_at`, aprobaciones y marcas de actualizacion
  - se movieron las matriculas de estudios a la pestana `Matriculas`
  - se corrigio la logica de acciones de coordinacion/cancelacion para aprobadores asignados por rol, no solo por `approver_user_id`

## 4. Riesgo controlado
- No se altero el backend del flujo de aprobacion.
- No se cambiaron estados ni reglas de negocio de permisos o vacaciones.
- Se preservo la revision de matriculas, separandola del flujo de aprobacion principal para no perder funcionalidad.

## 5. Validacion ejecutada
- Build de frontend completado correctamente.
- Persisten warnings historicos de lint del proyecto no relacionados con este ajuste.

## 6. Evidencia documental actualizada
- `validacion_sistema/DDS/DDS_area_02_talento_humano.md`
- `validacion_sistema/informes/informe_ajuste_widget_aprobacion_permisos_vacaciones_2026-03-10.md`
