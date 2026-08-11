const db = require("../../config/db");
const logger = require("../../config/logger");
const { logAction } = require("../../utils/audit");
const { HASH_ALGORITHM, computeSha256HexFromBase64 } = require("../../utils/documentHash");
const { ensureFolder, uploadBase64File } = require("../../utils/drive");
const { sheets } = require("../../config/google");

// Hoja de respuestas del formulario de Google de postulantes (talento humano).
// Mismo SPREADSHEET_ID/SHEET_NAME que el Apps Script del formulario (Config.gs) --
// deben apuntar siempre a la misma hoja.
const APPLICANTS_FORM_SPREADSHEET_ID = "1fyPpESJjvqE1_WA-FwxUQ8MHAN4J848h7v7nHKY0yqE";
const APPLICANTS_FORM_SHEET_NAME = "Respuestas de formulario 1";

const metrics = {
  success: 0,
  fail: 0,
  totalMs: 0,
};

const ensureApplicantsTables = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS applicants (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      fullname TEXT,
      profile JSONB DEFAULT '{}'::jsonb,
      status TEXT DEFAULT 'applied',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await db.query(`
    ALTER TABLE applicants
    ADD COLUMN IF NOT EXISTS personnel_request_id INTEGER;
  `);

  // Normalized Tables (New Structure)
  await db.query(`
    CREATE TABLE IF NOT EXISTS applicant_personal_data (
      id SERIAL PRIMARY KEY,
      applicant_id INTEGER UNIQUE REFERENCES applicants(id) ON DELETE CASCADE,
      nombres TEXT,
      apellidos TEXT,
      edad TEXT,
      telefono TEXT,
      cedula TEXT,
      pasaporte TEXT,
      nacionalidad TEXT,
      genero TEXT,
      tipo_sangre TEXT,
      estado_civil TEXT,
      fecha_nacimiento DATE,
      lugar_nacimiento TEXT,
      lugar_residencia TEXT,
      vive_con TEXT,
      dependientes TEXT,
      numero_hijos TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS applicant_licenses (
      id SERIAL PRIMARY KEY,
      applicant_id INTEGER UNIQUE REFERENCES applicants(id) ON DELETE CASCADE,
      tiene_licencia BOOLEAN DEFAULT false,
      tipo_licencia TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS applicant_ethnic_id (
      id SERIAL PRIMARY KEY,
      applicant_id INTEGER UNIQUE REFERENCES applicants(id) ON DELETE CASCADE,
      grupo_etnico TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS applicant_health (
      id SERIAL PRIMARY KEY,
      applicant_id INTEGER UNIQUE REFERENCES applicants(id) ON DELETE CASCADE,
      enfermedad_persistente BOOLEAN DEFAULT false,
      descripcion_enfermedad_persistente TEXT,
      enfermedad_laboral BOOLEAN DEFAULT false,
      descripcion_enfermedad_laboral TEXT,
      medicacion_continua BOOLEAN DEFAULT false,
      cirugia_recent BOOLEAN DEFAULT false,
      discapacidad BOOLEAN DEFAULT false,
      tipo_discapacidad TEXT,
      porcentaje_discapacidad TEXT,
      numero_carnet_discapacidad TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS applicant_education (
      id SERIAL PRIMARY KEY,
      applicant_id INTEGER REFERENCES applicants(id) ON DELETE CASCADE,
      nivel TEXT, -- secundaria | tercer_nivel | cuarto_nivel
      institucion TEXT,
      ciudad_pais TEXT,
      titulo TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS applicant_trainings (
      id SERIAL PRIMARY KEY,
      applicant_id INTEGER REFERENCES applicants(id) ON DELETE CASCADE,
      institucion TEXT,
      tema TEXT,
      ciudad_pais TEXT,
      horas TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS applicant_personal_references (
      id SERIAL PRIMARY KEY,
      applicant_id INTEGER REFERENCES applicants(id) ON DELETE CASCADE,
      nombre TEXT,
      celular TEXT,
      ocupacion TEXT,
      tiempo_conocerlo_anios TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS applicant_work_experience (
      id SERIAL PRIMARY KEY,
      applicant_id INTEGER REFERENCES applicants(id) ON DELETE CASCADE,
      empresa TEXT,
      tiempo_anios TEXT,
      cargo TEXT,
      funciones TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS applicant_work_references (
      id SERIAL PRIMARY KEY,
      applicant_id INTEGER REFERENCES applicants(id) ON DELETE CASCADE,
      empresa TEXT,
      nombre_contacto TEXT,
      celular_contacto TEXT,
      cargo_contacto TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS applicant_documents (
      id SERIAL PRIMARY KEY,
      applicant_id INTEGER REFERENCES applicants(id) ON DELETE CASCADE,
      doc_type TEXT NOT NULL,
      drive_file_id TEXT,
      drive_url TEXT,
      file_name TEXT,
      mime_type TEXT,
      content_hash_sha256 VARCHAR(64),
      hash_algorithm VARCHAR(20) DEFAULT 'SHA-256',
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await db.query(`
    ALTER TABLE applicant_documents
    ADD COLUMN IF NOT EXISTS content_hash_sha256 VARCHAR(64),
    ADD COLUMN IF NOT EXISTS hash_algorithm VARCHAR(20) DEFAULT 'SHA-256';
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS applicant_documents_unique
    ON applicant_documents(applicant_id, doc_type);
  `);
};

const normalizeApplicantPositionText = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\btcis\b/g, "tics")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const resolvePersonnelRequestIdByCargo = async (client, cargo = "") => {
  const normalizedCargo = normalizeApplicantPositionText(cargo);
  if (!normalizedCargo) return null;

  const { rows } = await client.query(
    `
    SELECT id
    FROM personnel_requests
    WHERE TRIM(LOWER(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            TRANSLATE(COALESCE(position_title, ''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'),
            '\\yTCIS\\y',
            'TICS',
            'gi'
          ),
          '[^a-zA-Z0-9]+',
          ' ',
          'g'
        )
      )) = $1
    ORDER BY
      CASE status
        WHEN 'en_proceso' THEN 1
        WHEN 'aprobada' THEN 2
        WHEN 'pendiente' THEN 3
        ELSE 4
      END,
      updated_at DESC NULLS LAST,
      id DESC
    LIMIT 1
    `,
    [normalizedCargo]
  );

  return rows[0]?.id || null;
};

const sanitizePayload = (input, depth = 0) => {
  if (input === null || input === undefined) return undefined;
  if (depth > 10) return undefined;
  if (Array.isArray(input)) {
    const cleaned = input
      .map((item) => sanitizePayload(item, depth + 1))
      .filter((item) => item !== undefined);
    return cleaned.length > 0 ? cleaned : undefined;
  }
  if (typeof input === "object") {
    const output = {};
    Object.keys(input).forEach((key) => {
      if (key === "__proto__" || key === "constructor" || key === "prototype") return;
      const value = sanitizePayload(input[key], depth + 1);
      if (value !== undefined) {
        output[key] = value;
      }
    });
    return Object.keys(output).length > 0 ? output : undefined;
  }
  if (typeof input === "string") {
    const trimmed = input.trim();
    return trimmed === "" ? "" : trimmed;
  }
  return input;
};

const withTimeout = async (promise, ms) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("TIMEOUT")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
};

const normalizeKey = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[?¿()]/g, "")
    .replace(/[^\w]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
};

const buildKeyMap = (payload = {}) => {
  const map = new Map();
  Object.keys(payload).forEach((key) => {
    map.set(normalizeKey(key), payload[key]);
  });
  return map;
};

const pick = (keyMap, candidates = []) => {
  for (const key of candidates) {
    const normalized = normalizeKey(key);
    if (keyMap.has(normalized)) {
      return keyMap.get(normalized);
    }
  }
  return undefined;
};

const normalizeString = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const normalizePhone = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[^\d]/g, "");
};

const stripBinaryLikeFields = (input, depth = 0) => {
  if (input === null || input === undefined) return input;
  if (depth > 12) return undefined;
  if (Array.isArray(input)) {
    return input
      .map((item) => stripBinaryLikeFields(item, depth + 1))
      .filter((item) => item !== undefined);
  }
  if (typeof input === "object") {
    const out = {};
    Object.keys(input).forEach((key) => {
      const normalizedKey = normalizeKey(key);
      if (/base64|archivo_binario|file_content|contenido_binario/.test(normalizedKey)) {
        return;
      }
      const value = stripBinaryLikeFields(input[key], depth + 1);
      if (value !== undefined) out[key] = value;
    });
    return out;
  }
  return input;
};

const parseDate = (value) => {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value).trim();
  if (!raw) return "";
  const iso = new Date(raw);
  if (!Number.isNaN(iso.getTime())) {
    return iso.toISOString().slice(0, 10);
  }
  const match = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (match) {
    const day = match[1].padStart(2, "0");
    const month = match[2].padStart(2, "0");
    let year = match[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }
  return "";
};

const calculateAge = (dateValue) => {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const m = today.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < date.getDate())) {
    age -= 1;
  }
  return age >= 0 ? String(age) : "";
};

const normalizeApplicantPayload = (payload = {}) => {
  const sanitized = sanitizePayload(payload) || {};
  const keyMap = buildKeyMap(sanitized);

  const email =
    pick(keyMap, [
      "direccion_de_correo_electronico",
      "correo_electronico",
      "email",
      "e_mail",
      "mail",
    ]) || "";

  const nombres =
    pick(keyMap, ["nombres", "nombre", "nombres_postulante"]) || "";

  const apellidos =
    pick(keyMap, ["apellidos", "apellido", "apellidos_postulante"]) || "";

  const fullName = normalizeString(`${nombres} ${apellidos}`.trim());

  const telefono =
    pick(keyMap, ["telefono", "telefono_personal", "teléfono"]) || "";
  const celular =
    pick(keyMap, ["celular", "telefono_celular"]) || "";

  const fechaNacimiento =
    pick(keyMap, ["fecha_de_nacimiento", "fecha_nacimiento"]) || "";

  const edad =
    pick(keyMap, ["edad"]) || "";

  return {
    raw: sanitized,
    keyMap,
    email: normalizeString(email).toLowerCase(),
    nombres: normalizeString(nombres),
    apellidos: normalizeString(apellidos),
    fullname: fullName || normalizeString(email),
    telefono: normalizePhone(celular || telefono),
    telefono_raw: normalizeString(celular || telefono),
    fecha_nacimiento: parseDate(fechaNacimiento),
    edad: normalizeString(edad),
  };
};

const mapApplicantToProfile = (payload = {}) => {
  const sanitized = sanitizePayload(payload) || {};
  const keyMap = buildKeyMap(sanitized);
  const normalized = normalizeApplicantPayload(sanitized);

  const puesto = normalizeString(
    pick(keyMap, ["puesto_al_que_aplica", "puesto", "cargo_postulado"])
  );

  const lugarNacimiento = normalizeString(
    pick(keyMap, ["lugar_de_nacimiento_provincia_ciudad", "lugar_de_nacimiento"])
  );

  const residencia = normalizeString(
    pick(keyMap, ["lugar_de_residencia_provincia_ciudad", "lugar_de_residencia"])
  );

  const estadoCivil = normalizeString(
    pick(keyMap, ["estado_civil"])
  );

  const genero = normalizeString(
    pick(keyMap, ["genero"])
  );

  const tipoSangre = normalizeString(
    pick(keyMap, ["tipo_de_sangre", "tipo_sangre"])
  );

  const cedula = normalizeString(
    pick(keyMap, ["cedula_de_ciudadania", "cedula", "c_c"])
  );

  const pasaporte = normalizeString(
    pick(keyMap, ["pasaporte_no", "pasaporte"])
  );

  const universidad = normalizeString(
    pick(keyMap, ["institucion_educativa_universidad", "institucion_universidad"])
  );

  const tituloUniversidad = normalizeString(
    pick(keyMap, ["titulo_recibido_universidad", "titulo_universidad"])
  );

  const universidadCuarto = normalizeString(
    pick(keyMap, ["institucion_educativa_cuarto_nivel", "institucion_cuarto_nivel"])
  );

  const tituloCuarto = normalizeString(
    pick(keyMap, ["titulo_recibido_cuarto_nivel", "titulo_cuarto_nivel"])
  );

  const hijos1 = {
    nombre: normalizeString(
      pick(keyMap, ["nombres_persona_1_hijo", "nombre_primer_hijo_a", "nombre_primer_hijo"])
    ),
    cedula: normalizeString(
      pick(keyMap, ["c_c_primer_hijo_a", "cedula_primer_hijo"])
    ),
    fecha: parseDate(
      pick(keyMap, ["fecha_de_nacimiento_primer_hijo_a", "fecha_nacimiento_primer_hijo"])
    ),
  };

  const hijos2 = {
    nombre: normalizeString(
      pick(keyMap, ["nombres_persona_2_hijo", "nombre_segundo_hijo_a", "nombre_segundo_hijo"])
    ),
    cedula: normalizeString(
      pick(keyMap, ["c_c_segundo_hijo_a", "cedula_segundo_hijo"])
    ),
    fecha: parseDate(
      pick(keyMap, ["fecha_de_nacimiento_segundo_hijo_a", "fecha_nacimiento_segundo_hijo"])
    ),
  };

  const profile = {
    personal: {
      nombres: normalized.nombres,
      apellidos: normalized.apellidos,
      cedula,
      tipo_sangre: tipoSangre,
      genero,
      cuenta_bancaria: "",
      lugar_nacimiento: lugarNacimiento,
      fecha_nacimiento: normalized.fecha_nacimiento,
      edad: normalized.edad || calculateAge(normalized.fecha_nacimiento),
      estado_civil: estadoCivil,
      telefono_personal: normalized.telefono,
      email_personal: normalized.email,
      peso: "",
      estatura: "",
    },
    laboral: {
      estatus_empleado: "",
      residencia,
      fecha_ingreso: "",
      fecha_ingreso_iess: "",
      tipo_contrato: "",
      cargo: puesto,
      area: "",
      seniority: "",
      telefono_celular_famproject: "",
      email_famproject: "",
      fecha_modificacion_cargo: "",
      nuevo_cargo: "",
      fecha_salida: "",
      fecha_salida_iess: "",
      motivo_salida: "",
      observaciones_salida: "",
    },
    estudios: {
      nivel_instruccion: normalizeString(pick(keyMap, ["nivel_instruccion", "posee_formacion_superior_cuarto_nivel"])),
      titulo_tercer_nivel: tituloUniversidad,
      universidad_tercer_nivel: universidad,
      titulo_cuarto_nivel: tituloCuarto,
      universidad_cuarto_nivel: universidadCuarto,
    },
    domicilio: {
      ciudad_domicilio: residencia,
      direccion_domicilio: "",
      ruta_trabajo: "",
      telefono_fijo: "",
    },
    familiar: {
      nombre_conyuge: normalizeString(pick(keyMap, ["nombre_conyuge"])),
      cedula_conyuge: normalizeString(pick(keyMap, ["c_c_conyuge", "cedula_conyuge"])),
      nombre_primer_hijo: hijos1.nombre,
      cedula_primer_hijo: hijos1.cedula,
      fecha_nacimiento_primer_hijo: hijos1.fecha,
      nombre_segundo_hijo: hijos2.nombre,
      cedula_segundo_hijo: hijos2.cedula,
      fecha_nacimiento_segundo_hijo: hijos2.fecha,
    },
    emergencia: {
      persona_contacto: "",
      telefono_contacto: "",
    },
    onboarding: {},
    extra: {
      identificacion: {
        pasaporte: pasaporte,
        nacionalidad: normalizeString(pick(keyMap, ["nacionalidad"])),
      },
      salud: {
        enfermedad_persistente: normalizeString(
          pick(keyMap, ["padece_actualmente_alguna_enfermedad_persistente"])
        ),
        descripcion_enfermedad_persistente: normalizeString(
          pick(keyMap, ["describa_la_enfermedad_persistente"])
        ),
        enfermedad_laboral: normalizeString(
          pick(keyMap, ["padece_o_ha_padecido_alguna_enfermedad_laboral"])
        ),
        descripcion_enfermedad_laboral: normalizeString(
          pick(keyMap, ["describa_la_enfermedad_laboral"])
        ),
        medicacion_continua: normalizeString(
          pick(keyMap, ["toma_actualmente_alguna_medicacion_de_uso_continuo"])
        ),
        cirugia_reciente: normalizeString(
          pick(keyMap, ["ha_sido_sometido_a_alguna_cirugia_en_los_ultimos_seis_meses"])
        ),
        discapacidad: normalizeString(
          pick(keyMap, ["tiene_alguna_discapacidad"])
        ),
        tipo_discapacidad: normalizeString(
          pick(keyMap, ["tipo_de_discapacidad"])
        ),
        porcentaje_discapacidad: normalizeString(
          pick(keyMap, ["porcentaje_de_discapacidad"])
        ),
        numero_carnet: normalizeString(
          pick(keyMap, ["no_carnet", "numero_carnet"])
        ),
        seguro_vida_salud: normalizeString(
          pick(keyMap, ["tiene_seguro_de_vida_o_salud"])
        ),
      },
      experiencia: [
        {
          empresa: normalizeString(pick(keyMap, ["nombre_empresa_1"])),
          tiempo: normalizeString(pick(keyMap, ["tiempo_empresa_1"])),
          cargo: normalizeString(pick(keyMap, ["cargo_empresa_1"])),
          funciones: normalizeString(pick(keyMap, ["funciones_empresa_1"])),
        },
        {
          empresa: normalizeString(pick(keyMap, ["nombre_empresa_2"])),
          tiempo: normalizeString(pick(keyMap, ["tiempo_empresa_2"])),
          cargo: normalizeString(pick(keyMap, ["cargo_empresa_2"])),
          funciones: normalizeString(pick(keyMap, ["funciones_empresa_2"])),
        },
      ].filter((item) => item.empresa || item.cargo || item.funciones),
      referencias: {
        personales: [
          {
            nombre: normalizeString(pick(keyMap, ["nombres_persona_1", "nombres_persona_1_referencia"])),
            celular: normalizeString(pick(keyMap, ["celular_persona_1"])),
            ocupacion: normalizeString(pick(keyMap, ["ocupacion_persona_1"])),
            tiempo_conocer: normalizeString(pick(keyMap, ["tiempo_de_conocerlo_persona_1"])),
          },
          {
            nombre: normalizeString(pick(keyMap, ["nombres_persona_2", "nombres_persona_2_referencia"])),
            celular: normalizeString(pick(keyMap, ["celular_persona_2"])),
            ocupacion: normalizeString(pick(keyMap, ["ocupacion_persona_2"])),
            tiempo_conocer: normalizeString(pick(keyMap, ["tiempo_de_conocerlo_persona_2"])),
          },
        ].filter((item) => item.nombre || item.celular || item.ocupacion),
        laborales: [
          {
            empresa: normalizeString(pick(keyMap, ["empresa_contacto_1"])),
            nombre: normalizeString(pick(keyMap, ["nombre_contacto_1"])),
            celular: normalizeString(pick(keyMap, ["celular_contacto_1"])),
            cargo: normalizeString(pick(keyMap, ["cargo_contacto_1"])),
          },
          {
            empresa: normalizeString(pick(keyMap, ["empresa_contacto_2"])),
            nombre: normalizeString(pick(keyMap, ["nombre_contacto_2"])),
            celular: normalizeString(pick(keyMap, ["celular_contacto_2"])),
            cargo: normalizeString(pick(keyMap, ["cargo_contacto_2"])),
          },
        ].filter((item) => item.empresa || item.nombre || item.celular),
      },
      movilidad: {
        cambia_residencia: normalizeString(
          pick(keyMap, ["estaria_dispuesto_a_cambiar_de_lugar_de_residencia"])
        ),
        acepta_viajar: normalizeString(
          pick(keyMap, ["aceptaria_viajar_eventualmente_fuera_y_dentro_de_la_ciudad"])
        ),
        movilizacion_propia: normalizeString(
          pick(keyMap, ["posee_movilizaciom_propia", "posee_movilizacion_propia"])
        ),
      },
      preguntas_adicionales: {
        medio_conocio_vacante: normalizeString(
          pick(keyMap, ["medio_por_el_que_conocio_de_la_vacante"])
        ),
        vive_con: normalizeString(pick(keyMap, ["vive_con"])),
        personas_dependen: normalizeString(pick(keyMap, ["personas_que_dependen_de_usted"])),
        numero_hijos: normalizeString(pick(keyMap, ["numero_de_hijos"])),
        licencia_manejo: normalizeString(pick(keyMap, ["tiene_licencia_de_manejo"])),
        tipo_licencia: normalizeString(pick(keyMap, ["escoja_tipo_licencia"])),
        auto_identificacion: normalizeString(pick(keyMap, ["auto_identificacion"])),
        aspiracion_salarial: normalizeString(pick(keyMap, ["aspiracion_salarial"])),
        tiempo_incorporacion: normalizeString(pick(keyMap, ["en_cuanto_tiempo_podria_incorporarse"])),
      },
      estudios_adicionales: {
        colegio_institucion: normalizeString(pick(keyMap, ["institucion_educativa_colegio"])),
        colegio_ciudad_pais: normalizeString(pick(keyMap, ["ciudad_pais_colegio"])),
        colegio_titulo: normalizeString(pick(keyMap, ["titulo_recibido_colegio"])),
        capacitaciones: [
          {
            institucion: normalizeString(pick(keyMap, ["institucion_capacitacion_1"])),
            tema: normalizeString(pick(keyMap, ["tema_capacitacion_1"])),
            ciudad_pais: normalizeString(pick(keyMap, ["ciudad_pais_capacitacion_1"])),
            horas: normalizeString(pick(keyMap, ["numero_horas_capacitacion_1"])),
          },
          {
            institucion: normalizeString(pick(keyMap, ["institucion_capacitacion_2"])),
            tema: normalizeString(pick(keyMap, ["tema_capacitacion_2"])),
            ciudad_pais: normalizeString(pick(keyMap, ["ciudad_pais_capacitacion_2"])),
            horas: normalizeString(pick(keyMap, ["numero_horas_capacitacion_2"])),
          },
        ].filter((item) => item.institucion || item.tema),
      },
      formulario_google: stripBinaryLikeFields(sanitized),
    },
  };

  return {
    profile,
    normalized,
    sanitized,
  };
};

const resolveCollaboratorFolder = async (email) => {
  const base =
    process.env.DRIVE_PROFILE_FOLDER_ID ||
    process.env.DRIVE_DOCS_FOLDER_ID ||
    process.env.DRIVE_ROOT_FOLDER_ID ||
    process.env.DRIVE_FOLDER_ID;

  if (!base) return null;

  const usersRoot = await ensureFolder("Usuarios", base);
  const userFolderName = email || "user-na";
  const userFolder = await ensureFolder(userFolderName, usersRoot.id);
  const docsFolder = await ensureFolder("Documentos", userFolder.id);
  return docsFolder.id;
};

const extractCvPayload = (payload = {}) => {
  const keyMap = buildKeyMap(payload);
  const fallbackKey = [...keyMap.keys()].find((k) =>
    /(curriculum|hoja_de_vida|cv)/.test(k) && /(url|link)/.test(k)
  );
  const fallbackBase64Key = [...keyMap.keys()].find((k) =>
    /(curriculum|hoja_de_vida|cv)/.test(k) && /base64/.test(k)
  );
  const fallbackFileNameKey = [...keyMap.keys()].find((k) =>
    /(curriculum|hoja_de_vida|cv)/.test(k) && /(file_name|filename|archivo)/.test(k)
  );
  const fallbackMimeKey = [...keyMap.keys()].find((k) =>
    /(curriculum|hoja_de_vida|cv)/.test(k) && /(mime|content_type)/.test(k)
  );

  const url = pick(keyMap, [
    "curriculum_vitae_url",
    "curriculum_vitae",
    "hoja_de_vida_url",
    "cv_url",
    "curriculum_url",
  ]) || (fallbackKey ? keyMap.get(fallbackKey) : "");
  const base64 = pick(keyMap, ["curriculum_vitae_base64", "cv_base64"]) || (fallbackBase64Key ? keyMap.get(fallbackBase64Key) : "");
  const fileName = pick(keyMap, ["curriculum_vitae_file_name", "cv_file_name"]) || (fallbackFileNameKey ? keyMap.get(fallbackFileNameKey) : "curriculum_vitae.pdf");
  const mime = pick(keyMap, ["curriculum_vitae_mime", "cv_mime"]) || (fallbackMimeKey ? keyMap.get(fallbackMimeKey) : "application/pdf");

  return {
    url: normalizeString(url),
    base64: normalizeString(base64),
    fileName: normalizeString(fileName) || "curriculum_vitae.pdf",
    mime: normalizeString(mime) || "application/pdf",
  };
};

const extractMotivationLetterPayload = (payload = {}) => {
  const keyMap = buildKeyMap(payload);
  const motivationPattern = /(carta.*motivacion|motivacion.*carta|motivation.*letter|cover.*letter)/;
  const fallbackUrlKey = [...keyMap.keys()].find((k) => motivationPattern.test(k) && /(url|link)/.test(k));
  const fallbackBase64Key = [...keyMap.keys()].find((k) => motivationPattern.test(k) && /base64/.test(k));
  const fallbackFileNameKey = [...keyMap.keys()].find((k) => motivationPattern.test(k) && /(file_name|filename|archivo)/.test(k));
  const fallbackMimeKey = [...keyMap.keys()].find((k) => motivationPattern.test(k) && /(mime|content_type)/.test(k));

  const url = pick(keyMap, [
    "carta_de_motivacion_url",
    "carta_motivacion_url",
    "motivation_letter_url",
    "cover_letter_url",
    "carta_de_motivacion_pdf",
    "carta_motivacion_pdf",
  ]) || (fallbackUrlKey ? keyMap.get(fallbackUrlKey) : "");
  const base64 = pick(keyMap, [
    "carta_de_motivacion_base64",
    "carta_motivacion_base64",
    "motivation_letter_base64",
    "cover_letter_base64",
  ]) || (fallbackBase64Key ? keyMap.get(fallbackBase64Key) : "");
  const fileName = pick(keyMap, [
    "carta_de_motivacion_file_name",
    "carta_motivacion_file_name",
    "motivation_letter_file_name",
    "cover_letter_file_name",
  ]) || (fallbackFileNameKey ? keyMap.get(fallbackFileNameKey) : "carta_motivacion.pdf");
  const mime = pick(keyMap, [
    "carta_de_motivacion_mime",
    "carta_motivacion_mime",
    "motivation_letter_mime",
    "cover_letter_mime",
  ]) || (fallbackMimeKey ? keyMap.get(fallbackMimeKey) : "application/pdf");

  return {
    url: normalizeString(url),
    base64: normalizeString(base64),
    fileName: normalizeString(fileName) || "carta_motivacion.pdf",
    mime: normalizeString(mime) || "application/pdf",
  };
};

const upsertApplicantDocument = async (
  client,
  applicantId,
  docType,
  driveFileId,
  driveUrl,
  fileName,
  mime,
  contentHashSha256 = null,
  hashAlgorithm = null
) => {
  const upsertDoc = `
    WITH updated AS (
      UPDATE applicant_documents
      SET drive_file_id = $3,
          drive_url = $4,
          file_name = $5,
          mime_type = $6,
          content_hash_sha256 = COALESCE($7, applicant_documents.content_hash_sha256),
          hash_algorithm = COALESCE($8, applicant_documents.hash_algorithm, 'SHA-256'),
          created_at = NOW()
      WHERE applicant_id = $1 AND doc_type = $2
      RETURNING id
    )
    INSERT INTO applicant_documents (
      applicant_id,
      doc_type,
      drive_file_id,
      drive_url,
      file_name,
      mime_type,
      content_hash_sha256,
      hash_algorithm,
      created_at
    )
    SELECT $1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'SHA-256'), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM updated)
    RETURNING id
  `;
  const values = [applicantId, docType, driveFileId, driveUrl, fileName, mime, contentHashSha256, hashAlgorithm];
  const result = await client.query(upsertDoc, values);
  return result.rows[0] || null;
};

const saveDocuments = async (client, applicantId, applicantEmail, payload = {}) => {
  const docsToPersist = [
    { docType: "HOJA_VIDA", payload: extractCvPayload(payload) },
    { docType: "CARTA_MOTIVACION", payload: extractMotivationLetterPayload(payload) },
  ];

  const savedDocs = [];

  for (const docEntry of docsToPersist) {
    const { docType, payload: docPayload } = docEntry;
    if (!docPayload?.url && !docPayload?.base64) continue;

    let driveFileId = null;
    let driveUrl = docPayload.url || null;
    const contentHashSha256 = computeSha256HexFromBase64(docPayload.base64);
    const hashAlgorithm = contentHashSha256 ? HASH_ALGORITHM : null;

    if (!driveUrl && docPayload.base64) {
      try {
        const folderId = await resolveCollaboratorFolder(applicantEmail);
        if (folderId) {
          const uploaded = await withTimeout(
            uploadBase64File(docPayload.fileName, docPayload.base64, docPayload.mime, folderId),
            10000
          );
          driveFileId = uploaded?.id || null;
          driveUrl = uploaded?.webViewLink || uploaded?.webContentLink || null;
        }
      } catch (err) {
        if (String(err?.message || "") === "TIMEOUT") {
          logger.warn({ docType }, "Timeout subiendo documento de postulante a Drive, se omite");
        } else {
          logger.warn({ err, docType }, "No se pudo subir documento de postulante a Drive");
        }
      }
    }

    if (!driveUrl && !driveFileId) {
      logger.warn({ docType }, "Documento de postulante recibido sin URL o subida a Drive");
      continue;
    }

    const saved = await upsertApplicantDocument(
      client,
      applicantId,
      docType,
      driveFileId,
      driveUrl,
      docPayload.fileName,
      docPayload.mime,
      contentHashSha256,
      hashAlgorithm
    );
    if (saved) savedDocs.push({ ...saved, doc_type: docType, drive_url: driveUrl });
  }

  return savedDocs;
};

const parseBoolean = (value) => {
  if (value === null || value === undefined) return false;
  const str = String(value).toLowerCase().trim();
  return str === "si" || str === "true" || str === "1" || str === "yes";
};

const importApplicant = async (payload = {}, context = {}) => {
  const start = Date.now();
  const { profile, normalized, sanitized } = mapApplicantToProfile(payload);

  if (!normalized.email) {
    const err = new Error("Email es obligatorio");
    err.status = 400;
    throw err;
  }
  if (!normalized.nombres || !normalized.apellidos) {
    const err = new Error("Nombres y apellidos son obligatorios");
    err.status = 400;
    throw err;
  }

  await ensureApplicantsTables();
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    if (!profile.extra) profile.extra = {};
    profile.extra.applicant_source = profile.extra.applicant_source || "google_forms";
    profile.extra.applicant_imported_at =
      profile.extra.applicant_imported_at || new Date().toISOString();

    const keyMap = buildKeyMap(sanitized);

    const statusMapping = {
      postulante: "applied",
      hired: "hired",
      rejected: "rejected",
    };
    const incomingStatus = normalizeString(pick(keyMap, ["estado", "status"])).toLowerCase();
    const finalStatus = statusMapping[incomingStatus] || "applied";
    const resolvedPersonnelRequestId = await resolvePersonnelRequestIdByCargo(
      client,
      profile?.laboral?.cargo
    );

    const applicantUpsert = `
      INSERT INTO applicants (email, fullname, profile, status, personnel_request_id, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (email)
      DO UPDATE SET
        fullname = EXCLUDED.fullname,
        profile = EXCLUDED.profile,
        personnel_request_id = COALESCE(EXCLUDED.personnel_request_id, applicants.personnel_request_id),
        updated_at = NOW()
      RETURNING id, email, fullname
    `;
    const applicantResult = await client.query(applicantUpsert, [
      normalized.email,
      normalized.fullname,
      profile,
      finalStatus,
      resolvedPersonnelRequestId,
    ]);
    const applicantId = applicantResult.rows[0].id;

    // --- New Normalized Table Persistence ---

    // 2. Personal Data
    await client.query(`
      INSERT INTO applicant_personal_data (
        applicant_id, nombres, apellidos, edad, telefono, cedula, pasaporte, nacionalidad, 
        genero, tipo_sangre, estado_civil, fecha_nacimiento, lugar_nacimiento, 
        lugar_residencia, vive_con, dependientes, numero_hijos
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (applicant_id) DO UPDATE SET
        nombres = EXCLUDED.nombres, apellidos = EXCLUDED.apellidos, edad = EXCLUDED.edad,
        telefono = EXCLUDED.telefono, cedula = EXCLUDED.cedula, pasaporte = EXCLUDED.pasaporte,
        nacionalidad = EXCLUDED.nacionalidad, genero = EXCLUDED.genero, tipo_sangre = EXCLUDED.tipo_sangre,
        estado_civil = EXCLUDED.estado_civil, fecha_nacimiento = EXCLUDED.fecha_nacimiento,
        lugar_nacimiento = EXCLUDED.lugar_nacimiento, lugar_residencia = EXCLUDED.lugar_residencia,
        vive_con = EXCLUDED.vive_con, dependientes = EXCLUDED.dependientes, numero_hijos = EXCLUDED.numero_hijos,
        updated_at = NOW()
    `, [
      applicantId,
      normalized.nombres,
      normalized.apellidos,
      normalized.edad || calculateAge(normalized.fecha_nacimiento),
      normalized.telefono,
      profile.personal.cedula,
      profile.extra.identificacion.pasaporte,
      profile.extra.identificacion.nacionalidad,
      profile.personal.genero,
      profile.personal.tipo_sangre,
      profile.personal.estado_civil,
      normalized.fecha_nacimiento || null,
      profile.personal.lugar_nacimiento,
      profile.laboral.residencia,
      profile.extra.preguntas_adicionales.vive_con,
      profile.extra.preguntas_adicionales.personas_dependen,
      profile.extra.preguntas_adicionales.numero_hijos
    ]);

    // 3. Licenses
    await client.query(`
      INSERT INTO applicant_licenses (applicant_id, tiene_licencia, tipo_licencia)
      VALUES ($1, $2, $3)
      ON CONFLICT (applicant_id) DO UPDATE SET
        tiene_licencia = EXCLUDED.tiene_licencia, tipo_licencia = EXCLUDED.tipo_licencia
    `, [
      applicantId,
      parseBoolean(profile.extra.preguntas_adicionales.licencia_manejo),
      profile.extra.preguntas_adicionales.tipo_licencia
    ]);

    // 4. Ethnic ID
    await client.query(`
      INSERT INTO applicant_ethnic_id (applicant_id, grupo_etnico)
      VALUES ($1, $2)
      ON CONFLICT (applicant_id) DO UPDATE SET grupo_etnico = EXCLUDED.grupo_etnico
    `, [applicantId, profile.extra.preguntas_adicionales.auto_identificacion]);

    // 5. Health
    await client.query(`
      INSERT INTO applicant_health (
        applicant_id, enfermedad_persistente, descripcion_enfermedad_persistente,
        enfermedad_laboral, descripcion_enfermedad_laboral, medicacion_continua,
        cirugia_recent, discapacidad, tipo_discapacidad, porcentaje_discapacidad,
        numero_carnet_discapacidad
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (applicant_id) DO UPDATE SET
        enfermedad_persistente = EXCLUDED.enfermedad_persistente,
        descripcion_enfermedad_persistente = EXCLUDED.descripcion_enfermedad_persistente,
        enfermedad_laboral = EXCLUDED.enfermedad_laboral,
        descripcion_enfermedad_laboral = EXCLUDED.descripcion_enfermedad_laboral,
        medicacion_continua = EXCLUDED.medicacion_continua,
        cirugia_recent = EXCLUDED.cirugia_recent,
        discapacidad = EXCLUDED.discapacidad,
        tipo_discapacidad = EXCLUDED.tipo_discapacidad,
        porcentaje_discapacidad = EXCLUDED.porcentaje_discapacidad,
        numero_carnet_discapacidad = EXCLUDED.numero_carnet_discapacidad
    `, [
      applicantId,
      parseBoolean(profile.extra.salud.enfermedad_persistente),
      profile.extra.salud.descripcion_enfermedad_persistente,
      parseBoolean(profile.extra.salud.enfermedad_laboral),
      profile.extra.salud.descripcion_enfermedad_laboral,
      parseBoolean(profile.extra.salud.medicacion_continua),
      parseBoolean(profile.extra.salud.cirugia_recent),
      parseBoolean(profile.extra.salud.discapacidad),
      profile.extra.salud.tipo_discapacidad,
      profile.extra.salud.porcentaje_discapacidad,
      profile.extra.salud.numero_carnet
    ]);

    // 6. Education
    await client.query(`DELETE FROM applicant_education WHERE applicant_id = $1`, [applicantId]);
    const eduLevels = [
      { level: 'secundaria', inst: pick(keyMap, ["institucion_educativa_colegio"]), title: pick(keyMap, ["titulo_recibido_colegio"]), city: pick(keyMap, ["ciudad_pais_colegio"]) },
      { level: 'tercer_nivel', inst: profile.estudios.universidad_tercer_nivel, title: profile.estudios.titulo_tercer_nivel, city: "" },
      { level: 'cuarto_nivel', inst: profile.estudios.universidad_cuarto_nivel, title: profile.estudios.titulo_cuarto_nivel, city: "" }
    ];
    for (const edu of eduLevels) {
      if (edu.inst || edu.title) {
        await client.query(`
          INSERT INTO applicant_education (applicant_id, nivel, institucion, titulo, ciudad_pais)
          VALUES ($1, $2, $3, $4, $5)
        `, [applicantId, edu.level, edu.inst, edu.title, edu.city]);
      }
    }

    // 7. Trainings
    await client.query(`DELETE FROM applicant_trainings WHERE applicant_id = $1`, [applicantId]);
    const trainings = profile.extra.estudios_adicionales?.capacitaciones || [];
    for (const t of trainings) {
      await client.query(`
        INSERT INTO applicant_trainings (applicant_id, institucion, tema, ciudad_pais, horas)
        VALUES ($1, $2, $3, $4, $5)
      `, [applicantId, t.institucion, t.tema, t.ciudad_pais, t.horas]);
    }

    // 8. Personal References
    await client.query(`DELETE FROM applicant_personal_references WHERE applicant_id = $1`, [applicantId]);
    const pRefs = profile.extra.referencias?.personales || [];
    for (const r of pRefs) {
      await client.query(`
        INSERT INTO applicant_personal_references (applicant_id, nombre, celular, ocupacion, tiempo_conocerlo_anios)
        VALUES ($1, $2, $3, $4, $5)
      `, [applicantId, r.nombre, r.celular, r.ocupacion, r.tiempo_conocer]);
    }

    // 9. Work Experience
    await client.query(`DELETE FROM applicant_work_experience WHERE applicant_id = $1`, [applicantId]);
    const exp = profile.extra.experiencia || [];
    for (const e of exp) {
      await client.query(`
        INSERT INTO applicant_work_experience (applicant_id, empresa, tiempo_anios, cargo, funciones)
        VALUES ($1, $2, $3, $4, $5)
      `, [applicantId, e.empresa, e.tiempo, e.cargo, e.funciones]);
    }

    // 10. Work References
    await client.query(`DELETE FROM applicant_work_references WHERE applicant_id = $1`, [applicantId]);
    const wRefs = profile.extra.referencias?.laborales || [];
    for (const r of wRefs) {
      await client.query(`
        INSERT INTO applicant_work_references (applicant_id, empresa, nombre_contacto, celular_contacto, cargo_contacto)
        VALUES ($1, $2, $3, $4, $5)
      `, [applicantId, r.empresa, r.nombre, r.celular, r.cargo]);
    }

    // --- End New Persistence ---

    const docResults = await saveDocuments(client, applicantId, normalized.email, sanitized);

    await client.query("COMMIT");

    metrics.success += 1;
    metrics.totalMs += Date.now() - start;
    const avgMs = metrics.success > 0 ? Math.round(metrics.totalMs / metrics.success) : 0;
    logger.info(
      {
        applicant_id: applicantId,
        email: normalized.email,
        duration_ms: Date.now() - start,
        success_count: metrics.success,
        fail_count: metrics.fail,
        avg_ms: avgMs,
      },
      "APPLICANT_IMPORT ok"
    );
    await logAction({
      usuario_id: null,
      usuario_email: normalized.email,
      rol: "applicant_import",
      modulo: "applicants",
      accion: "APPLICANT_IMPORT",
      descripcion: "Importación de postulante",
      datos_nuevos: { applicant_id: applicantId, email: normalized.email },
      ip: context.ip || null,
      user_agent: context.userAgent || null,
      duracion_ms: Date.now() - start,
      contexto: { auto: true },
    });

    return {
      applicant_id: applicantId,
      email: normalized.email,
      fullname: normalized.fullname,
      document_ids: Array.isArray(docResults) ? docResults.map((d) => d.id).filter(Boolean) : [],
    };
  } catch (err) {
    await client.query("ROLLBACK");
    metrics.fail += 1;
    logger.error({ err, email: normalized.email }, "APPLICANT_IMPORT error");
    await logAction({
      usuario_id: null,
      usuario_email: normalized.email || "anon",
      rol: "applicant_import",
      modulo: "applicants",
      accion: "APPLICANT_IMPORT",
      descripcion: "Importación de postulante fallida",
      datos_nuevos: { email: normalized.email || null },
      ip: context.ip || null,
      user_agent: context.userAgent || null,
      duracion_ms: Date.now() - start,
      contexto: { auto: true },
    });
    throw err;
  } finally {
    client.release();
  }
};

const listApplicants = async ({
  cargo,
  search,
  page = 1,
  pageSize = 25,
} = {}) => {
  await ensureApplicantsTables();
  const offset = (page - 1) * pageSize;
  const params = [];
  let whereClauses = [`(a.status IS NULL OR a.status <> 'hired')`];

  if (cargo) {
    params.push(`%${String(cargo).toLowerCase()}%`);
    // Use applicant_personal_data for position if available, or fallback to profile
    whereClauses.push(`(
      LOWER(a.profile->'laboral'->>'cargo') LIKE $${params.length}
    )`);
  }

  if (search) {
    params.push(`%${String(search).toLowerCase()}%`);
    const idx = params.length;
    whereClauses.push(`(
      LOWER(a.fullname) LIKE $${idx} 
      OR LOWER(a.email) LIKE $${idx}
      OR LOWER(p.cedula) LIKE $${idx}
      OR LOWER(p.nombres) LIKE $${idx}
      OR LOWER(p.apellidos) LIKE $${idx}
    )`);
  }

  const where = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const dataQuery = `
    SELECT 
      a.id, a.email, a.fullname, a.profile, a.personnel_request_id, a.created_at, a.updated_at,
      p.cedula, p.telefono, p.lugar_residencia
    FROM applicants a
    LEFT JOIN applicant_personal_data p ON a.id = p.applicant_id
    ${where}
    ORDER BY a.updated_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;
  const { rows } = await db.query(dataQuery, [...params, pageSize, offset]);

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM applicants a
    LEFT JOIN applicant_personal_data p ON a.id = p.applicant_id
    ${where}
  `;
  const countResult = await db.query(countQuery, params);
  const total = countResult.rows[0]?.total || 0;

  return {
    data: rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
};

const getApplicantById = async (id) => {
  if (!id) return null;
  await ensureApplicantsTables();
  const { rows } = await db.query(
    `
    SELECT 
      a.id, a.email, a.fullname, a.profile, a.personnel_request_id, a.status, a.created_at, a.updated_at,
      p.nombres, p.apellidos, p.edad, p.telefono, p.cedula, p.pasaporte, p.nacionalidad, 
      p.genero, p.tipo_sangre, p.estado_civil, p.fecha_nacimiento, p.lugar_nacimiento, 
      p.lugar_residencia, p.vive_con, p.dependientes, p.numero_hijos,
      l.tiene_licencia, l.tipo_licencia,
      e.grupo_etnico,
      h.enfermedad_persistente, h.descripcion_enfermedad_persistente,
      h.enfermedad_laboral, h.descripcion_enfermedad_laboral, h.medicacion_continua,
      h.cirugia_recent, h.discapacidad, h.tipo_discapacidad, h.porcentaje_discapacidad,
      h.numero_carnet_discapacidad
    FROM applicants a
    LEFT JOIN applicant_personal_data p ON a.id = p.applicant_id
    LEFT JOIN applicant_licenses l ON a.id = l.applicant_id
    LEFT JOIN applicant_ethnic_id e ON a.id = e.applicant_id
    LEFT JOIN applicant_health h ON a.id = h.applicant_id
    WHERE a.id = $1
    LIMIT 1
    `,
    [id]
  );

  if (rows.length === 0) return null;
  const applicant = rows[0];

  // Fetch collections
  const [edu, training, pRefs, exp, wRefs, docs] = await Promise.all([
    db.query(`SELECT * FROM applicant_education WHERE applicant_id = $1`, [id]),
    db.query(`SELECT * FROM applicant_trainings WHERE applicant_id = $1`, [id]),
    db.query(`SELECT * FROM applicant_personal_references WHERE applicant_id = $1`, [id]),
    db.query(`SELECT * FROM applicant_work_experience WHERE applicant_id = $1`, [id]),
    db.query(`SELECT * FROM applicant_work_references WHERE applicant_id = $1`, [id]),
    db.query(
      `SELECT id, doc_type, drive_file_id, drive_url, file_name, mime_type, content_hash_sha256, hash_algorithm, created_at
       FROM applicant_documents
       WHERE applicant_id = $1
       ORDER BY created_at DESC`,
      [id]
    ),
  ]);

  return {
    ...applicant,
    education: edu.rows,
    trainings: training.rows,
    personal_references: pRefs.rows,
    work_experience: exp.rows,
    work_references: wRefs.rows,
    documents: docs.rows,
  };
};

const deleteApplicant = async (id) => {
  if (!id) throw new Error("ID de aspirante requerido");
  await ensureApplicantsTables();
  // ON DELETE CASCADE will handle child tables
  const { rowCount } = await db.query("DELETE FROM applicants WHERE id = $1", [
    id,
  ]);
  return rowCount > 0;
};

// Red de seguridad para cuando el POST /import (disparado externamente por
// Apps Script en cada respuesta del formulario) falla o se pierde: lee la
// hoja de respuestas directamente y da de alta a cualquier postulante cuyo
// email todavia no exista en `applicants`. No reimporta a los que ya
// existen (importApplicant igual seria idempotente por email, pero asi
// evitamos escrituras innecesarias en un sync que puede correr seguido).
const syncApplicantsFromSheet = async (spreadsheetId = APPLICANTS_FORM_SPREADSHEET_ID) => {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetTitles = (meta.data?.sheets || []).map((s) => s?.properties?.title).filter(Boolean);
  const sheetTitle = sheetTitles.includes(APPLICANTS_FORM_SHEET_NAME)
    ? APPLICANTS_FORM_SHEET_NAME
    : sheetTitles[0];
  if (!sheetTitle) {
    const err = new Error("No se pudo leer la hoja de respuestas del formulario.");
    err.status = 502;
    throw err;
  }

  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetTitle}'`,
  });
  const rows = data.values || [];
  if (rows.length < 2) {
    return { totalRows: 0, imported: 0, skipped: 0, errors: [] };
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  await ensureApplicantsTables();
  const { rows: existingRows } = await db.query(`SELECT LOWER(email) AS email FROM applicants`);
  const existingEmails = new Set(existingRows.map((row) => row.email));

  let imported = 0;
  let skipped = 0;
  const errors = [];

  for (const row of dataRows) {
    const payload = {};
    headers.forEach((header, index) => {
      if (header) payload[header] = row[index] ?? "";
    });

    const keyMap = buildKeyMap(payload);
    const email = normalizeString(
      pick(keyMap, [
        "direccion_de_correo_electronico",
        "correo_electronico",
        "email",
        "e_mail",
        "mail",
      ]),
    ).toLowerCase();

    if (!email || existingEmails.has(email)) {
      skipped += 1;
      continue;
    }

    try {
      await importApplicant(payload, { source: "google_sheet_sync" });
      existingEmails.add(email);
      imported += 1;
    } catch (error) {
      errors.push({ email, message: error.message });
    }
  }

  return { totalRows: dataRows.length, imported, skipped, errors };
};

module.exports = {
  importApplicant,
  syncApplicantsFromSheet,
  normalizeApplicantPayload,
  mapApplicantToProfile,
  listApplicants,
  getApplicantById,
  deleteApplicant,
  ensureApplicantsTables,
  // Helpers puros expuestos para pruebas de verificacion.
  calculateAge,
  normalizePhone,
};
