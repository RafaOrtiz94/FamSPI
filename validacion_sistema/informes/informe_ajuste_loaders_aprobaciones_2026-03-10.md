## Ajuste de loaders en aprobaciones y rechazos

Fecha: 2026-03-10

### Contexto
- En varios flujos de aprobacion y rechazo de talento humano la UI deshabilitaba botones, pero no siempre mostraba una pantalla de carga visible.
- El comportamiento era inconsistente entre permisos, vacaciones, solicitudes de personal, solicitudes de cliente, cronogramas y viaticos.

### Hallazgos verificados
- `spi_front/src/core/ui/UIContext.jsx`
  - el loader global existia, pero no permitia mensajes por accion y no manejaba bien multiples llamadas encadenadas.
- `spi_front/src/modules/shared/solicitudes/components/PermisosStatusWidget.jsx`
  - aprobaciones, rechazos, cancelaciones, revision de matriculas y coordinacion usaban `actionLoading` local sin pantalla global.
- `spi_front/src/modules/shared/solicitudes/components/AprobacionPermisosView.jsx`
  - aprobacion y rechazo no mostraban loader visible.
- `spi_front/src/core/ui/widgets/VacationRequestsWidget.jsx`
  - aprobacion y rechazo no mostraban loader visible.
- `spi_front/src/core/ui/widgets/HRPersonnelRequestsWidget.jsx`
  - aprobacion y rechazo en modal de revision no mostraban loader visible.
- `spi_front/src/modules/talento/components/workspace/PersonnelRequestReview.jsx`
  - aprobacion y rechazo no mostraban loader visible.
- `spi_front/src/modules/backoffice/pages/ClientRequestReview.jsx`
  - aprobacion/rechazo y guardado de checklist de calidad no mostraban pantalla global de carga.
- `spi_front/src/modules/comercial/components/ClientRequestManagement.jsx`
  - aprobacion/rechazo de solicitudes de cliente y carga de detalle no mostraban pantalla global de carga.
- `spi_front/src/modules/comercial/components/schedules/ScheduleApprovalWidget.jsx`
  - aprobacion/rechazo de cronogramas y carga del detalle no mostraban pantalla global de carga.
- `spi_front/src/modules/finanzas/pages/ViaticosWorkspace.jsx`
  - cambios de estado, registro, creacion desde visita, carga documental y generacion de reporte no mostraban pantalla global de carga.

### Cambios aplicados
- `spi_front/src/core/ui/UIContext.jsx`
  - `showLoader` ahora acepta mensaje opcional.
  - el loader global maneja contador de operaciones para no ocultarse antes de tiempo si hay llamadas encadenadas.
- `spi_front/src/modules/shared/solicitudes/components/PermisosStatusWidget.jsx`
  - se añadio loader visible para:
    - aprobar parcial/final
    - rechazar
    - cancelar
    - revisar cancelacion
    - revisar matricula
    - actualizar plan de recuperacion
- `spi_front/src/modules/shared/solicitudes/components/AprobacionPermisosView.jsx`
  - se añadió loader visible para aprobar y rechazar.
- `spi_front/src/core/ui/widgets/VacationRequestsWidget.jsx`
  - se añadió loader visible para aprobar y rechazar vacaciones.
- `spi_front/src/core/ui/widgets/HRPersonnelRequestsWidget.jsx`
  - se añadió loader visible para aprobar y rechazar solicitudes de personal.
- `spi_front/src/modules/talento/components/workspace/PersonnelRequestReview.jsx`
  - se añadió loader visible para aprobar y rechazar desde la vista de revisión.
- `spi_front/src/modules/backoffice/pages/ClientRequestReview.jsx`
  - se añadió loader visible para aprobar, rechazar y guardar checklist de calidad.
- `spi_front/src/modules/comercial/components/ClientRequestManagement.jsx`
  - se añadió loader visible para cargar detalle, aprobar y rechazar solicitudes de cliente.
- `spi_front/src/modules/comercial/components/schedules/ScheduleApprovalWidget.jsx`
  - se añadió loader visible para cargar detalle, aprobar y rechazar cronogramas.
  - se bloquearon botones y cierres de modal mientras la acción está en curso.
- `spi_front/src/modules/finanzas/pages/ViaticosWorkspace.jsx`
  - se añadió loader visible para registrar, guardar, aprobar, rechazar, marcar como pagado, subir soporte y generar reporte de viáticos.

### Validación ejecutada
- `npm --prefix spi_front run build`: correcto con warnings históricos preexistentes del repositorio.

### Resultado esperado
- Las acciones críticas de aprobación, rechazo y procesos afines muestran feedback visual inmediato y bloquean acciones repetidas mientras esperan respuesta del backend.
- El operador ve un mensaje contextual según la operación en curso, en lugar de un bloqueo genérico sin contexto.
