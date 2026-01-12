const db = require("../../config/db");

function getStartOfWeek(dateStr) {
  const date = new Date(dateStr);
  const diff = date.getDay();
  const start = new Date(date);
  start.setDate(date.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function getEndOfWeek(dateStr) {
  const date = new Date(dateStr);
  const diff = 6 - date.getDay();
  const end = new Date(date);
  end.setDate(date.getDate() + diff);
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}

function validatePermisoEstudios(horas) {
  if (Number(horas) > 3) {
    throw new Error("El permiso por estudios no puede exceder 3 horas");
  }
  return { valid: true, justificantes_requeridos: ["certificado_institucion"], es_recuperable: true };
}

async function validatePermisoPersonal({ user_email, duracion_horas, fecha_inicio }) {
  if (!fecha_inicio) {
    throw new Error("La fecha de inicio es obligatoria para validar el permiso personal");
  }
  const inicioSemana = getStartOfWeek(fecha_inicio);
  const finSemana = getEndOfWeek(fecha_inicio);
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(duracion_horas), 0) as total
       FROM permisos_vacaciones
      WHERE user_email = $1
        AND tipo_permiso = 'personal'
        AND fecha_inicio >= $2
        AND fecha_inicio <= $3
        AND status != 'rejected'`,
    [user_email, inicioSemana, finSemana]
  );
  const totalHoras = parseFloat(rows[0]?.total || 0) + parseFloat(duracion_horas || 0);
  if (totalHoras > 2) {
    throw new Error(`Ya has usado ${rows[0]?.total || 0} horas esta semana. Máximo permitido: 2 horas semanales`);
  }
  return { valid: true, justificantes_requeridos: ["evidencia_general"], es_recuperable: false };
}

function validatePermisoSalud(dias) {
  const diasNum = Number(dias || 0);
  if (diasNum < 4) {
    return { valid: true, justificantes_requeridos: ["certificado_medico"], requiere_tramite_iess: false };
  }
  return {
    valid: true,
    justificantes_requeridos: ["certificado_medico_iess"],
    requiere_tramite_iess: true,
    mensaje: "Debe realizar trámite de subsidios en el IESS",
  };
}

function validatePermisoCalamidad({ subtipo_calamidad, duracion_dias }) {
  const diasNum = Number(duracion_dias || 0);
  switch (subtipo_calamidad) {
    case "fallecimiento":
      if (diasNum > 3) {
        throw new Error("Permiso por fallecimiento: máximo 3 días");
      }
      return { valid: true, justificantes_requeridos: ["certificado_defuncion", "documento_parentesco"] };
    case "accidente":
      return { valid: true, justificantes_requeridos: ["certificado_medico_familiar"] };
    case "desastre":
      return { valid: true, justificantes_requeridos: ["evidencia_fotografica"] };
    default:
      throw new Error("Subtipo de calamidad no válido");
  }
}

async function validatePermisoRequest(data) {
  const { tipo_permiso, duracion_horas, duracion_dias, fecha_inicio } = data;
  switch (tipo_permiso) {
    case "estudios":
      return validatePermisoEstudios(duracion_horas);
    case "personal":
      return validatePermisoPersonal({ user_email: data.user_email, duracion_horas, fecha_inicio });
    case "salud":
      return validatePermisoSalud(duracion_dias);
    case "calamidad":
      return validatePermisoCalamidad({ subtipo_calamidad: data.subtipo_calamidad, duracion_dias });
    default:
      throw new Error("Tipo de permiso no válido");
  }
}

module.exports = {
  validatePermisoRequest,
  validatePermisoEstudios,
  validatePermisoPersonal,
  validatePermisoSalud,
  validatePermisoCalamidad,
  getStartOfWeek,
  getEndOfWeek,
};
