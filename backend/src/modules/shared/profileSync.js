const PROFILE_SYNC_KEYS = [
  "personal.telefono_personal",
  "personal.email_personal",
  "personal.estado_civil",
  "personal.genero",
  "personal.tipo_sangre",
  "personal.lugar_nacimiento",
  "personal.fecha_nacimiento",
  "domicilio.ciudad_domicilio",
  "domicilio.direccion_domicilio",
  "domicilio.telefono_fijo",
  "emergencia.persona_contacto",
  "emergencia.telefono_contacto",
  "estudios.nivel_instruccion",
  "estudios.titulo_tercer_nivel",
  "estudios.universidad_tercer_nivel",
  "estudios.titulo_cuarto_nivel",
  "estudios.universidad_cuarto_nivel",
  "laboral.fecha_ingreso",
  "laboral.cargo",
  "laboral.area",
  "laboral.telefono_celular_famproject",
  "laboral.email_famproject",
];

const getNestedValue = (source, path) => {
  if (!source) return undefined;
  return path.reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), source);
};

const setNestedValue = (target, path, value) => {
  let ref = target;
  path.forEach((key, index) => {
    if (index === path.length - 1) {
      ref[key] = value;
      return;
    }

    if (!ref[key] || typeof ref[key] !== "object") {
      ref[key] = {};
    }
    ref = ref[key];
  });
};

const collectNestedFields = (source = {}, keys = PROFILE_SYNC_KEYS) => {
  const result = {};
  keys.forEach((key) => {
    const path = key.split(".");
    const value = getNestedValue(source, path);
    if (value !== undefined) {
      setNestedValue(result, path, value);
    }
  });
  return result;
};

const applyNestedFields = (target = {}, source = {}, keys = PROFILE_SYNC_KEYS) => {
  const next = { ...(target || {}) };
  keys.forEach((key) => {
    const path = key.split(".");
    const incoming = getNestedValue(source, path);
    if (incoming !== undefined) {
      setNestedValue(next, path, incoming);
    }
  });
  return next;
};

module.exports = {
  PROFILE_SYNC_KEYS,
  getNestedValue,
  setNestedValue,
  collectNestedFields,
  applyNestedFields,
};
