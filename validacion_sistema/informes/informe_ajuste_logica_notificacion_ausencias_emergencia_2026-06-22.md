# Informe de ejecucion
## Ajuste de logica de notificacion general en ausencias por emergencia

Fecha: 2026-06-22

## 1. Hallazgo validado
- El modulo `permisos` enviaba el correo general de no disponibilidad tambien cuando una ausencia de emergencia o urgente recibia aprobacion final mucho tiempo despues de ocurrido el evento operativo.
- En ese escenario, el correo ya no aportaba valor de coordinacion porque la ausencia habia sucedido antes y la aprobacion tardia solo formalizaba administrativamente el caso.
- El comportamiento no correspondia a un fallo tecnico de ejecucion ni a un error de sintaxis; correspondia a una regla de negocio incompleta en la logica de notificacion.

## 2. Regla funcional aplicada
- Si una solicitud de emergencia o del flujo urgente recibe aprobacion final dentro de una ventana operativa util, el correo general de no disponibilidad si debe enviarse.
- Si la aprobacion final llega fuera de esa ventana operativa, el correo general debe omitirse porque ya no cumple una funcion real de coordinacion.
- La ventana aplicada en codigo se fijo en `4` horas.
- Esta regla aplica solo al correo general de no disponibilidad.
- No se elimina la notificacion individual al solicitante ni otras notificaciones del workflow.

## 3. Cambios implementados
- Backend `permisos`:
  - `backend/src/modules/permisos/permisos.service.js`
  - Se centralizo la decision en `sendGeneralUnavailabilityNotification`.
  - Se elimino la omision legacy que bloqueaba correos por el solo hecho de ser emergencia no urgente.
  - Se agrego la funcion `shouldSkipGeneralUnavailabilityMailForLateEmergencyApproval`.
  - La nueva regla compara:
    - `aprobacion_final_at`
    - contra `fecha_inicio_hora`
    - y si no existe, contra `created_at`
  - Si la aprobacion final supera la ventana de `4` horas, el envio general se omite.

## 4. Riesgo controlado
- No se modifico el flujo de aprobacion final.
- No se modifico el estado de la solicitud.
- No se modifico el PDF del permiso.
- No se modificaron las notificaciones individuales al colaborador.
- No se alteraron las notificaciones de autorizacion provisional urgente.
- El ajuste se limito al criterio de envio del correo general de no disponibilidad.

## 5. Clasificacion del cambio
- Tipo de cambio: moderado.
- Justificacion:
  - cambia una regla funcional de comunicacion operativa
  - no cambia schema
  - no cambia contratos API
  - no introduce nueva funcionalidad
  - reduce ruido operativo y evita avisos sin valor temporal

## 6. Validacion ejecutada
- Revision del flujo real en `backend/src/modules/permisos/permisos.service.js`.
- Verificacion del punto de envio del correo general y del camino de aprobacion final.
- Lint del backend sin error de sintaxis:
  - `cd backend && npm run lint -- src/modules/permisos/permisos.service.js`

## 7. Impacto de validacion
- El ajuste debe tratarse como correccion de logica operativa en OQ parcial del modulo `permisos`.
- No exige revalidacion completa del area.
- La evidencia futura debe contemplar al menos dos escenarios:
  - emergencia aprobada dentro de la ventana util -> envia correo general
  - emergencia aprobada fuera de la ventana util -> no envia correo general

## 8. Evidencia documental actualizada
- `validacion_sistema/informes/informe_ajuste_logica_notificacion_ausencias_emergencia_2026-06-22.md`
- `docs/validation/general/14A_control_cambios.md`
