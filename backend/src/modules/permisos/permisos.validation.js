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

// ---------------------------------------------------------------------------
// Asuntos fortuitos — configuración general por subtipo de calamidad
// Cubre todos los eventos imprevistos que pueden afectar a un colaborador,
// no solo fallecimiento sino cualquier situación que justifique una ausencia
// urgente sin aprobación previa.
// ---------------------------------------------------------------------------
const SUBTIPO_CALAMIDAD_CONFIG = {
  fallecimiento: {
    label: "Fallecimiento de familiar",
    max_dias: 3,
    requires_parentesco: true,
    max_grado_consanguinidad: 2,
    justificantes: ["certificado_defuncion", "documento_parentesco"],
    es_recuperable: false,
    justificante_deadline_days: 5,
    urgent_deadline_extension_days: 3,
  },
  enfermedad_grave_familiar: {
    label: "Enfermedad grave de familiar",
    max_dias: 3,
    requires_parentesco: true,
    max_grado_consanguinidad: 2,
    justificantes: ["certificado_medico", "documento_parentesco"],
    es_recuperable: false,
    justificante_deadline_days: 7,
    urgent_deadline_extension_days: 3,
  },
  accidente_familiar: {
    label: "Accidente de familiar",
    max_dias: 3,
    requires_parentesco: true,
    max_grado_consanguinidad: 3,
    justificantes: ["certificado_medico_familiar", "documento_parentesco"],
    es_recuperable: true,
    justificante_deadline_days: 7,
    urgent_deadline_extension_days: 5,
  },
  accidente_propio: {
    label: "Accidente propio del colaborador",
    max_dias: null,
    requires_parentesco: false,
    max_grado_consanguinidad: null,
    justificantes: ["certificado_medico", "parte_accidente"],
    es_recuperable: false,
    justificante_deadline_days: 7,
    urgent_deadline_extension_days: 5,
  },
  emergencia_medica_propia: {
    label: "Emergencia médica propia del colaborador",
    max_dias: null,
    requires_parentesco: false,
    max_grado_consanguinidad: null,
    justificantes: ["certificado_medico"],
    es_recuperable: false,
    justificante_deadline_days: 5,
    urgent_deadline_extension_days: 3,
  },
  hospitalizacion_familiar: {
    label: "Hospitalización de familiar",
    max_dias: 3,
    requires_parentesco: true,
    max_grado_consanguinidad: 2,
    justificantes: ["certificado_hospitalizacion", "documento_parentesco"],
    es_recuperable: false,
    justificante_deadline_days: 7,
    urgent_deadline_extension_days: 5,
  },
  desastre: {
    label: "Desastre (incendio, robo, desastre natural)",
    max_dias: 3,
    requires_parentesco: false,
    max_grado_consanguinidad: null,
    justificantes: ["evidencia_fotografica", "denuncia_o_informe_oficial"],
    es_recuperable: true,
    justificante_deadline_days: 10,
    urgent_deadline_extension_days: 5,
  },
  accidente: {
    // Alias legacy — accidente genérico, redirige a accidente_familiar
    label: "Accidente de familiar (legacy)",
    max_dias: 3,
    requires_parentesco: false,
    max_grado_consanguinidad: null,
    justificantes: ["certificado_medico_familiar"],
    es_recuperable: true,
    justificante_deadline_days: 7,
    urgent_deadline_extension_days: 5,
  },
  otro: {
    label: "Otro asunto fortuito imprevisto",
    max_dias: null,
    requires_parentesco: false,
    max_grado_consanguinidad: null,
    justificantes: ["evidencia_general"],
    es_recuperable: true,
    justificante_deadline_days: 5,
    urgent_deadline_extension_days: 3,
  },
};

// Parentesco válidos reconocidos para calamidades con vínculo familiar
const PARENTESCO_VALIDOS = new Set([
  "conyuge", "conviviente", "pareja",
  "padre", "madre", "padres",
  "hijo", "hija", "hijos",
  "hermano", "hermana",
  "abuelo", "abuela",
  "nieto", "nieta",
  "suegro", "suegra",
  "yerno", "nuera",
  "tio", "tia",
  "sobrino", "sobrina",
  "primo", "prima",
]);

// Grado de consanguinidad por tipo de parentesco (referencia)
const PARENTESCO_GRADO = {
  conyuge: 1, conviviente: 1, pareja: 1,
  padre: 1, madre: 1, padres: 1,
  hijo: 1, hija: 1, hijos: 1,
  hermano: 2, hermana: 2,
  abuelo: 2, abuela: 2,
  nieto: 2, nieta: 2,
  suegro: 2, suegra: 2,
  yerno: 2, nuera: 2,
  tio: 3, tia: 3,
  sobrino: 3, sobrina: 3,
  primo: 4, prima: 4,
};

function validatePermisoEstudios(horas) {
  if (Number(horas) > 3) {
    throw new Error("El permiso por estudios no puede exceder 3 horas");
  }
  return { valid: true, justificantes_requeridos: [], es_recuperable: true };
}

async function validatePermisoPersonal({ user_email, duracion_horas, fecha_inicio }) {
  if (Number(duracion_horas) > 2) {
    throw new Error("El permiso por asuntos personales no puede exceder 2 horas");
  }
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
        AND status NOT IN ('rejected', 'cancelled')`,
    [user_email, inicioSemana, finSemana]
  );
  const totalHoras = parseFloat(rows[0]?.total || 0) + parseFloat(duracion_horas || 0);
  if (totalHoras > 2) {
    throw new Error(`Ya has usado ${rows[0]?.total || 0} horas esta semana. Máximo permitido: 2 horas semanales`);
  }
  return { valid: true, justificantes_requeridos: [], es_recuperable: true };
}

function validatePermisoSalud({ duracion_dias, duracion_horas, fecha_inicio, fecha_fin, subtipo_salud }) {
  if (!fecha_inicio || !fecha_fin) {
    throw new Error("Las fechas de inicio y fin son obligatorias para el permiso de salud");
  }

  const start = new Date(fecha_inicio);
  const end = new Date(fecha_fin);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Las fechas de inicio o fin no son validas");
  }
  if (end < start) {
    throw new Error("La fecha de fin no puede ser anterior a la fecha de inicio");
  }

  const normalizedSubtype = String(subtipo_salud || "").trim().toLowerCase();
  if (!normalizedSubtype) {
    throw new Error("Debes indicar el subtipo de permiso por salud");
  }
  if (!["enfermedad_certificada", "atencion_medica_familiar"].includes(normalizedSubtype)) {
    throw new Error("Subtipo de permiso por salud no válido");
  }

  const horasNum = Number(duracion_horas || 0);
  const diasNumInput = Number(duracion_dias || 0);
  const hasHoras = Number.isFinite(horasNum) && horasNum > 0;
  const hasDiasInput = Number.isFinite(diasNumInput) && diasNumInput > 0;

  let diasNum = diasNumInput;

  if (!hasHoras && !hasDiasInput) {
    const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
    diasNum = diff >= 0 ? diff + 1 : 0;
  } else if (hasHoras && !hasDiasInput) {
    diasNum = 0;
  }

  if (!hasHoras && !(Number.isFinite(diasNum) && diasNum > 0)) {
    throw new Error("Debe indicar horas o dias para el permiso de salud");
  }

  if (diasNum > 0 && diasNum < 4) {
    return {
      valid: true,
      justificantes_requeridos: ["certificado_medico"],
      requiere_tramite_iess: false,
      es_recuperable: normalizedSubtype === "atencion_medica_familiar",
    };
  }

  if (diasNum >= 4) {
    return {
      valid: true,
      justificantes_requeridos: ["certificado_medico_iess"],
      requiere_tramite_iess: true,
      es_recuperable: normalizedSubtype === "atencion_medica_familiar",
      mensaje: "Debe realizar tramite de subsidios en el IESS",
    };
  }

  return {
    valid: true,
    justificantes_requeridos: ["certificado_medico"],
    requiere_tramite_iess: false,
    es_recuperable: normalizedSubtype === "atencion_medica_familiar",
  };
}

function validatePermisoCalamidad({
  subtipo_calamidad,
  duracion_dias,
  duracion_horas,
  fecha_inicio,
  fecha_fin,
  calamidad_parentesco,
  calamidad_grado_consanguinidad,
  is_urgent = false,
}) {
  if (!fecha_inicio || !fecha_fin) {
    throw new Error("Las fechas de inicio y fin son obligatorias para el permiso por calamidad");
  }

  const start = new Date(fecha_inicio);
  const end = new Date(fecha_fin);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Las fechas de inicio o fin no son válidas para el permiso por calamidad");
  }
  if (end < start) {
    throw new Error("La fecha de fin no puede ser anterior a la fecha de inicio");
  }

  const horasNum = Number(duracion_horas || 0);
  const diasNumInput = Number(duracion_dias || 0);
  const hasHoras = Number.isFinite(horasNum) && horasNum > 0;
  const hasDiasInput = Number.isFinite(diasNumInput) && diasNumInput > 0;
  let diasNum = diasNumInput;

  if (!hasHoras && !hasDiasInput) {
    const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
    diasNum = diff >= 0 ? diff + 1 : 0;
  } else if (hasHoras && !hasDiasInput) {
    diasNum = 0;
  }

  if (!hasHoras && !(Number.isFinite(diasNum) && diasNum > 0)) {
    throw new Error("Debe indicar horas o días para el permiso por calamidad");
  }

  const normalized = String(subtipo_calamidad || "").trim().toLowerCase();
  if (!normalized) {
    throw new Error("Debe indicar el tipo de asunto fortuito (subtipo_calamidad)");
  }

  const config = SUBTIPO_CALAMIDAD_CONFIG[normalized];
  if (!config) {
    const validKeys = Object.keys(SUBTIPO_CALAMIDAD_CONFIG).join(", ");
    throw new Error(`Subtipo de calamidad no reconocido: '${normalized}'. Valores válidos: ${validKeys}`);
  }

  // Duration limit per subtype (urgent requests may exceed the normal limit exceptionally)
  if (config.max_dias !== null && diasNum > config.max_dias && !is_urgent) {
    throw new Error(`${config.label}: máximo ${config.max_dias} día(s) permitido(s).`);
  }
  if (config.max_dias !== null && diasNum > config.max_dias && is_urgent) {
    // Urgent cases can exceed the limit but a warning is attached
  }

  // Parentesco validation when the subtype involves a family member
  const parentescoRaw = String(calamidad_parentesco || "").trim().toLowerCase();
  const gradoInput = Number(calamidad_grado_consanguinidad);

  if (config.requires_parentesco) {
    if (!parentescoRaw) {
      throw new Error(
        `El tipo de calamidad '${config.label}' requiere indicar el parentesco con el familiar afectado.`
      );
    }
    if (!PARENTESCO_VALIDOS.has(parentescoRaw)) {
      throw new Error(
        `Parentesco '${calamidad_parentesco}' no reconocido. Valores aceptados: ${Array.from(PARENTESCO_VALIDOS).join(", ")}.`
      );
    }
    // Derive grado from parentesco if not provided
    const derivedGrado = PARENTESCO_GRADO[parentescoRaw] ?? null;
    const effectiveGrado = Number.isFinite(gradoInput) && gradoInput > 0 ? gradoInput : derivedGrado;

    if (
      config.max_grado_consanguinidad !== null &&
      effectiveGrado !== null &&
      effectiveGrado > config.max_grado_consanguinidad
    ) {
      throw new Error(
        `El parentesco '${parentescoRaw}' (${effectiveGrado}º grado) excede el grado máximo cubierto por '${config.label}' (${config.max_grado_consanguinidad}º grado).`
      );
    }
  }

  const deadlineDays = is_urgent
    ? config.justificante_deadline_days + (config.urgent_deadline_extension_days || 0)
    : config.justificante_deadline_days;

  const warnings = [];
  if (is_urgent && config.max_dias !== null && diasNum > config.max_dias) {
    warnings.push(
      `Duración (${diasNum} día(s)) supera el límite habitual de ${config.max_dias} día(s) para '${config.label}'. Requiere justificación adicional.`
    );
  }

  return {
    valid: true,
    justificantes_requeridos: config.justificantes,
    es_recuperable: config.es_recuperable,
    justificante_deadline_days: deadlineDays,
    subtipo_label: config.label,
    requires_parentesco: config.requires_parentesco,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

async function validatePermisoRequest(data) {
  const { tipo_permiso, duracion_horas, duracion_dias, fecha_inicio, fecha_fin } = data;
  switch (tipo_permiso) {
    case "estudios":
      return validatePermisoEstudios(duracion_horas);
    case "personal":
      return validatePermisoPersonal({ user_email: data.user_email, duracion_horas, fecha_inicio });
    case "salud":
      return validatePermisoSalud({ duracion_dias, duracion_horas, fecha_inicio, fecha_fin, subtipo_salud: data.subtipo_salud });
    case "calamidad":
      return validatePermisoCalamidad({
        subtipo_calamidad: data.subtipo_calamidad,
        duracion_dias,
        duracion_horas,
        fecha_inicio,
        fecha_fin,
        calamidad_parentesco: data.calamidad_parentesco,
        calamidad_grado_consanguinidad: data.calamidad_grado_consanguinidad,
        is_urgent: Boolean(data.is_urgent),
      });
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
  SUBTIPO_CALAMIDAD_CONFIG,
  PARENTESCO_VALIDOS,
  PARENTESCO_GRADO,
  getStartOfWeek,
  getEndOfWeek,
};
