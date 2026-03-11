# Informe de ejecucion
## Ajuste de multiples matriculas activas para permisos por estudios

Fecha: 2026-03-10

## 1. Hallazgo validado
- El backend de `permisos_estudios_matriculas` mantenia un indice unico parcial por `user_id` cuando `status = 'active'`.
- Al aprobar una nueva matricula, el servicio expiraba automaticamente las matriculas activas anteriores del colaborador.
- En el modal `PermisoVacacionModal`, el formulario para cargar matriculas adicionales solo se mostraba cuando no existia ninguna matricula activa.

## 2. Regla funcional aplicada
- Un colaborador puede tener una o mas matriculas activas al mismo tiempo.
- El sistema debe permitir registrar nuevas matriculas aunque ya existan activas.
- En permisos por estudios, el colaborador debe poder escoger cualquiera de sus matriculas activas vigentes.
- La vigencia sigue determinada por `valid_from` y `valid_until`; al vencer, la matricula debe pasar a `expired`.

## 3. Cambios implementados
- Backend:
  - `backend/src/modules/permisos/permisos.service.js`
  - se elimina el indice unico parcial `ux_permisos_matriculas_active_user`
  - aprobar una matricula ya no expira automaticamente otras matriculas activas del mismo usuario
  - al consultar matriculas del usuario o resolver una matricula vigente, se expiran automaticamente las activas cuyo `valid_until` ya quedo en el pasado
- Frontend:
  - `spi_front/src/modules/shared/solicitudes/modals/PermisoVacacionModal.jsx`
  - el formulario para subir matriculas queda disponible aunque el usuario ya tenga matriculas activas
  - se mantiene el selector de matriculas activas para escoger la que se usara en la solicitud
  - se ajustan los mensajes cuando existen matriculas pendientes y al menos una activa

## 4. Riesgo controlado
- No se modifico la validacion que exige seleccionar una matricula activa para solicitar permiso por estudios.
- No se cambiaron los roles ni el flujo de revision de matriculas.
- La API `GET /estudios/matricula/activa` sigue devolviendo una matricula vigente representativa; la seleccion completa en UI sigue resolviendose con `GET /estudios/matriculas`.

## 5. Validacion ejecutada
- Carga del servicio backend de permisos sin error.
- Build de frontend completado correctamente.
- Persisten warnings historicos de lint del proyecto no asociados a este ajuste.

## 6. Evidencia documental actualizada
- `validacion_sistema/URS/URS_propuesta_modulo_permisos.md`
- `validacion_sistema/DDS/DDS_area_02_talento_humano.md`
- `validacion_sistema/informes/informe_ajuste_multiples_matriculas_activas_2026-03-10.md`
