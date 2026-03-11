## Ajuste de validacion de matriculas pendientes

Fecha: 2026-03-10

### Contexto
- La pestaña `Matriculas` permitía aprobar o rechazar matrículas pendientes, pero mostraba información mínima.
- El flujo exigía motivo tanto para aprobar como para rechazar.
- Al enviar una matrícula nueva no había un estado de carga visible durante la subida y registro.

### Hallazgos verificados
- `backend/src/modules/permisos/permisos.service.js`
  - `listPendingStudyEnrollments` devolvía solo `m.*`, sin nombre del solicitante.
  - `reviewStudyEnrollment` obligaba `reason` para cualquier decisión.
- `spi_front/src/modules/shared/solicitudes/components/PermisosStatusWidget.jsx`
  - la cola de pendientes mostraba solo correo, institución y fecha de vencimiento.
  - el modal de revisión pedía motivo también al aprobar.
- `spi_front/src/modules/shared/solicitudes/modals/PermisoVacacionModal.jsx`
  - la carga de matrícula no activaba overlay de proceso.

### Cambios aplicados
- `backend/src/modules/permisos/permisos.service.js`
  - la lista de matrículas pendientes ahora incorpora `user_fullname` desde `users`.
  - el motivo de revisión es obligatorio solo cuando `decision = reject`.
- `spi_front/src/modules/shared/solicitudes/components/PermisosStatusWidget.jsx`
  - cada matrícula pendiente muestra:
    - nombre del solicitante
    - correo
    - institución
    - programa
    - fecha de inicio
    - fecha de vencimiento
  - la acción `Ver matrícula subida` se renderiza con apariencia de botón para conservar coherencia visual con las demás acciones del widget.
  - el modal de revisión replica ese detalle.
  - al aprobar ya no exige motivo; al rechazar sí.
- `spi_front/src/modules/shared/solicitudes/modals/PermisoVacacionModal.jsx`
  - se añadió overlay de carga y bloqueo de cierre mientras se envía una matrícula para validación.

### Validación ejecutada
- Carga de `backend/src/modules/permisos/permisos.service.js`: correcta.
- `npm --prefix spi_front run build`: correcto con warnings históricos preexistentes del repositorio.

### Resultado esperado
- El jefe inmediato ve suficiente contexto para decidir sobre la matrícula sin abrir otros módulos.
- La aprobación de matrícula es más ágil porque no exige motivo.
- El rechazo conserva trazabilidad obligatoria.
- El usuario recibe retroalimentación visual clara mientras la matrícula se está cargando para validación.
