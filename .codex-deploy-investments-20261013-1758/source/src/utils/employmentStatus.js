/**
 * backend/src/utils/employmentStatus.js
 * --------------------------------------
 * Estado laboral del colaborador (collaborator_profiles.profile->laboral->
 * estatus_empleado). Valores "pasivos" -- cuentan como no-activo para
 * cualquier listado que deba separar activos de desvinculados. "pasante" NO
 * esta aqui: un pasante cuenta como activo (aparece en asistencia, permisos,
 * etc.), solo se distingue por la etiqueta del propio valor.
 *
 * Compartido por collaborators.service.js, permisos.service.js y
 * attendanceWorkspace.service.js para no tener 3 copias del mismo set.
 */
const PASSIVE_EMPLOYMENT_STATUSES = ["pasivo", "desvinculado", "inactivo"];

module.exports = { PASSIVE_EMPLOYMENT_STATUSES };
