const HR_PROFILE_METADATA_PATHS = [
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

const getNestedValue = (source, path) =>
  path.reduce(
    (acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined),
    source,
  );

const setNestedValue = (target, path, value) => {
  let ref = target;
  path.forEach((key, index) => {
    if (index === path.length - 1) {
      ref[key] = value;
      return;
    }

    if (!ref[key] || typeof ref[key] !== "object" || Array.isArray(ref[key])) {
      ref[key] = {};
    }
    ref = ref[key];
  });
};

const splitUserProfileMetadata = (metadata = {}) => {
  const ownMetadata = {};
  const collaboratorMetadata = {};

  Object.entries(metadata || {}).forEach(([key, value]) => {
    if (!HR_PROFILE_METADATA_PATHS.some((path) => path.startsWith(`${key}.`))) {
      ownMetadata[key] = value;
    }
  });

  HR_PROFILE_METADATA_PATHS.forEach((pathKey) => {
    const path = pathKey.split(".");
    const value = getNestedValue(metadata, path);
    if (value !== undefined) {
      setNestedValue(collaboratorMetadata, path, value);
    }
  });

  return {
    ownMetadata,
    collaboratorMetadata,
  };
};

module.exports = {
  splitUserProfileMetadata,
};
