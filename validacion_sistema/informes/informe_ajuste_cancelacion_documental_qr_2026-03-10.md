## Ajuste de cancelacion documental y trazabilidad QR

Fecha: 2026-03-10

### Contexto
- Una solicitud aprobada en `permisos` generaba F.RH-10 y constancia legal con token QR.
- Si luego la solicitud era cancelada, el estado en base se actualizaba pero la evidencia legal ya generada no reflejaba la cancelacion.
- La vista publica de verificacion por token no mostraba motivo, fechas ni actor de cancelacion y ademas interpretaba `cancelled` como estado en proceso.

### Hallazgos verificados
- `backend/src/modules/permisos/permisos.service.js`
  - la cancelacion actualizaba `status`, `cancelled_at`, `cancellation_*`, pero no regeneraba `pdf_generado_url` ni `pdf_validacion_legal_url`.
  - `attachWorkflowSignatures` ocultaba token y PDF legal para solicitudes `cancelled`, igual que para `rejected`.
- `backend/src/utils/legalVerificationView.js`
  - no contemplaba el estado `cancelled`.
  - no renderizaba detalle de cancelacion.
- `backend/src/modules/permisos/permisos.pdf.js`
  - generaba F.RH-10 y constancia legal solo con trazabilidad de aprobacion.
- `backend/src/modules/vacaciones/vacaciones.service.js`
  - mantenia el mismo vacio de trazabilidad en la verificacion publica por token al cancelar.

### Cambios aplicados
- `backend/src/modules/permisos/permisos.service.js`
  - se agrego regeneracion de evidencia legal cuando la cancelacion es aprobada o ejecutada directamente por el jefe inmediato.
  - se preserva el token legal existente para mantener trazabilidad del QR.
  - las solicitudes `cancelled` ya no ocultan por defecto token ni URLs legales.
  - la consulta publica por token ahora expone estructura de cancelacion con modalidad, fecha/hora, motivo y actor resolutor.
- `backend/src/modules/permisos/permisos.pdf.js`
  - el F.RH-10 regenerado incluye marca visible `CANCELADO`.
  - el bloque FamSign y la constancia legal incorporan la cronologia de cancelacion.
  - los archivos nuevos se nombran con sufijo `CANCELADO/CANCELADA`.
- `backend/src/utils/legalVerificationView.js`
  - la verificacion publica reconoce `Cancelado` como estado valido.
  - muestra modalidad de cancelacion, fecha solicitud, solicitante, motivo, actor que aprobo/ejecuto y fecha de resolucion.
- `backend/src/modules/vacaciones/vacaciones.service.js`
  - se regenera la constancia legal al cancelar y la verificacion publica por token refleja la trazabilidad de cancelacion.
- `spi_front/src/modules/shared/solicitudes/components/PermisosStatusWidget.jsx`
  - una solicitud `cancelled` sigue mostrando F.RH-10 y validacion legal.
- `spi_front/src/modules/shared/solicitudes/components/AprobacionPermisosView.jsx`
  - las descargas identifican si el documento disponible ya corresponde a una version cancelada.

### Validacion ejecutada
- Carga de `backend/src/modules/permisos/permisos.service.js`: correcta.
- Carga de `backend/src/modules/vacaciones/vacaciones.service.js`: correcta.
- Render HTML de verificacion legal con estado `cancelled`: correcto.
- `npm --prefix spi_front run build`: correcto con warnings historicos preexistentes del repositorio.

### Resultado esperado
- Si una cancelacion es aprobada o ejecutada directamente, el sistema actualiza la evidencia documental visible en SPI.
- El QR del documento sigue resolviendo el mismo token, pero ahora informa que la solicitud fue cancelada y muestra la trazabilidad solicitada.
