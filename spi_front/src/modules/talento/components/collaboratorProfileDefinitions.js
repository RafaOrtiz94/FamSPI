import { COUNTRY_LOCATIONS } from "../../comercial/constants/locationOptions";

const dedupeByNormalizedValue = (values = []) => {
  const map = new Map();
  values.forEach((value) => {
    const label = String(value || "").trim();
    if (!label) return;
    const key = label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (!map.has(key)) map.set(key, label);
  });
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "es"));
};

const buildEcuadorCityOptions = () => {
  const provinces = COUNTRY_LOCATIONS?.Ecuador?.provinces || {};
  const allCities = Object.values(provinces).flatMap((cities) =>
    Array.isArray(cities) ? cities : [],
  );
  return dedupeByNormalizedValue(allCities);
};

export const ECUADOR_CITY_OPTIONS = buildEcuadorCityOptions();

export const BLOOD_TYPE_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export const MARITAL_STATUS_OPTIONS = [
  "SOLTERO/A",
  "CASADO/A",
  "DIVORCIADO/A",
  "VIUDO/A",
  "UNION LIBRE",
];

export const CONTRACT_TYPE_OPTIONS = [
  "INDEFINIDO",
  "A PLAZO FIJO",
  "POR OBRA DETERMINADA",
  "EVENTUAL",
  "POR HONORARIOS",
  "PRESTACION DE SERVICIOS PROFESIONALES",
];

export const CARGO_OPTIONS = [
  "GERENTE GENERAL",
  "DIRECTOR/A COMERCIAL",
  "JEFE COMERCIAL",
  "JEFE TECNICO",
  "JEFE DE LOGISTICA",
  "JEFE DE TALENTO HUMANO",
  "COORDINADOR/A COMERCIAL",
  "COORDINADOR/A DE LOGISTICA",
  "COORDINADOR/A DE OPERACIONES",
  "COORDINADOR/A DE TALENTO HUMANO",
  "ANALISTA COMERCIAL",
  "ANALISTA ADMINISTRATIVO",
  "ANALISTA DE LOGISTICA",
  "TECNICO DE CAMPO",
  "ESPECIALISTA DE APLICACIONES",
  "INGENIERO DE SERVICIO",
  "INGENIERO DE TICS",
  "AUXILIAR ADMINISTRATIVO",
  "ASISTENTE COMERCIAL",
  "ASISTENTE LOGISTICO",
  "MENSAJERO/REPARTIDOR",
  "CONDUCTOR",
  "DIGITADOR",
  "PASANTE",
  "OTRO",
];

export const AREA_OPTIONS = [
  "GERENCIA",
  "COMERCIAL",
  "LOGISTICA",
  "SERVICIO TECNICO",
  "OPERACIONES",
  "TALENTO HUMANO",
  "FINANCIERO",
  "TECNOLOGIA (TI)",
  "ADMINISTRATIVO",
  "CALIDAD",
];

export const GENDER_OPTIONS = ["MASCULINO", "FEMENINO"];
export const EMPLOYEE_STATUS_OPTIONS = ["ACTIVO", "PASIVO"];
export const EDUCATION_LEVEL_OPTIONS = [
  "BASICA",
  "BACHILLERATO",
  "TECNICO",
  "TECNOLOGICO",
  "TERCER NIVEL",
  "CUARTO NIVEL",
  "POSTGRADO",
  "DOCTORADO",
];
export const MOBILIZATION_OPTIONS = [
  "AUTO PROPIO",
  "AUTO COMPARTIDO",
  "MOTOCICLETA",
  "BUS",
  "TAXI",
  "APLICACION MOVIL",
  "BICICLETA",
  "CAMINANDO",
  "OTRO",
];

export const defaultProfile = {
  personal: {
    nombres: "",
    apellidos: "",
    cedula: "",
    ruc: "",
    tipo_sangre: "",
    genero: "",
    cuenta_bancaria: "",
    lugar_nacimiento: "",
    fecha_nacimiento: "",
    edad: "",
    estado_civil: "",
    telefono_personal: "",
    email_personal: "",
    peso: "",
    estatura: "",
  },
  laboral: {
    estatus_empleado: "",
    residencia: "",
    fecha_ingreso: "",
    fecha_ingreso_iess: "",
    tipo_contrato: "",
    cargo: "",
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
  familiar: {
    nombre_conyuge: "",
    cedula_conyuge: "",
    nombre_primer_hijo: "",
    cedula_primer_hijo: "",
    fecha_nacimiento_primer_hijo: "",
    nombre_segundo_hijo: "",
    cedula_segundo_hijo: "",
    fecha_nacimiento_segundo_hijo: "",
    hijos: [],
  },
  domicilio: {
    ciudad_domicilio: "",
    direccion_domicilio: "",
    ruta_trabajo: "",
    movilizacion: "",
    telefono_fijo: "",
  },
  emergencia: {
    persona_contacto: "",
    parentesco_contacto: "",
    telefono_contacto: "",
    contactos: [],
  },
  estudios: {
    nivel_instruccion: "",
    titulo_tercer_nivel: "",
    universidad_tercer_nivel: "",
    titulo_cuarto_nivel: "",
    universidad_cuarto_nivel: "",
  },
  onboarding: {
    firma_digital: false,
    cuenta_internacional: false,
    correo_corporativo: false,
    accesos_bitrix: false,
    accesos_silver: false,
    credenciales_roche: false,
    acceso_links_interes: false,
    plan_celular: false,
    celular_entregado: false,
    computadora_entregada: false,
    uniformes_entregados: false,
    epp_entregados: false,
    herramientas_trabajo_entregadas: false,
    logistica_entregada: false,
    ropa_retirada: false,
    epp_retirado: false,
    herramientas_trabajo_retiradas: false,
    logistica_retirada: false,
    ti_retirado: false,
    seguro_medico_vida: false,
    tarjetas_presentacion: false,
    credencial_entregada: false,
    salida_equipos: false,
    salida_cuentas: false,
    salida_sri: false,
    liquidacion: false,
    notificar_salida_equipo_fam: false,
    entrevista_salida: false,
    carta_despido: false,
    acta_descargo_herramientas: false,
    acta_entrega_equipos_comunicacion: false,
    aviso_salida_iess: false,
    liquidacion_mdt_finiquito: false,
    eliminacion_accesos_sistemas: false,
    revision_medica_salida: false,
    acta_descargo_uniformes: false,
    cambio_estado_activo_pasivo: false,
    documentacion_personal_desvinculado: false,
    firma_roles_pago_pendientes: false,
    offboarding_requested: false,
    offboarding_request_code: "",
    offboarding_request_reason: "",
    offboarding_requested_at: "",
    offboarding_requested_by: "",
    offboarding_cancelled_at: "",
    offboarding_cancelled_by: "",
    locked_sections: [],
    manual_unlocked_sections: [],
  },
};

export const profileSections = [
  {
    key: "personal",
    title: "Datos personales",
    fields: [
      { key: "nombres", label: "NOMBRES", required: true },
      { key: "apellidos", label: "APELLIDOS", required: true },
      {
        key: "cedula",
        label: "NUMERO DE CEDULA",
        mask: "cedula",
        inputMode: "numeric",
        pattern: "[0-9]*",
        maxLength: 10,
        required: true,
      },
      {
        key: "ruc",
        label: "RUC",
        mask: "ruc",
        inputMode: "numeric",
        pattern: "[0-9]*",
        maxLength: 13,
      },
      {
        key: "tipo_sangre",
        label: "TIPO DE SANGRE",
        type: "select",
        options: BLOOD_TYPE_OPTIONS,
        placeholder: "Selecciona tipo de sangre",
      },
      {
        key: "genero",
        label: "GENERO",
        type: "select",
        options: GENDER_OPTIONS,
        placeholder: "Selecciona genero",
      },
      { key: "cuenta_bancaria", label: "CUENTA BANCARIA" },
      { key: "lugar_nacimiento", label: "LUGAR DE NACIMIENTO" },
      {
        key: "fecha_nacimiento",
        label: "FECHA DE NACIMIENTO",
        type: "date",
        required: true,
      },
      { key: "edad", label: "EDAD", readOnly: true },
      {
        key: "estado_civil",
        label: "ESTADO CIVIL",
        type: "select",
        options: MARITAL_STATUS_OPTIONS,
        placeholder: "Selecciona estado civil",
      },
      {
        key: "telefono_personal",
        label: "TELEFONO PERSONAL",
        mask: "phone",
        inputMode: "tel",
        pattern: "[0-9+\\-() ]*",
        maxLength: 15,
      },
      {
        key: "email_personal",
        label: "EMAIL PERSONAL",
        type: "email",
        required: true,
      },
      { key: "peso", label: "PESO" },
      { key: "estatura", label: "ESTATURA" },
    ],
  },
  {
    key: "laboral",
    title: "Datos laborales",
    fields: [
      {
        key: "estatus_empleado",
        label: "ESTATUS EMPLEADO",
        type: "select",
        options: EMPLOYEE_STATUS_OPTIONS,
        placeholder: "Selecciona estatus",
      },
      {
        key: "residencia",
        label: "RESIDENCIA",
        type: "select",
        options: ECUADOR_CITY_OPTIONS,
        placeholder: "Selecciona ciudad de residencia",
      },
      { key: "fecha_ingreso", label: "FECHA DE INGRESO", type: "date" },
      {
        key: "fecha_ingreso_iess",
        label: "FECHA DE INGRESO IESS",
        type: "date",
      },
      {
        key: "tipo_contrato",
        label: "TIPO DE CONTRATO",
        type: "select",
        options: CONTRACT_TYPE_OPTIONS,
        placeholder: "Selecciona tipo de contrato",
      },
      {
        key: "cargo",
        label: "CARGO",
        type: "select",
        options: CARGO_OPTIONS,
        placeholder: "Selecciona cargo",
      },
      {
        key: "area",
        label: "AREA",
        type: "select",
        options: AREA_OPTIONS,
        placeholder: "Selecciona area",
      },
      { key: "seniority", label: "NIVEL DE SENIORITY" },
      {
        key: "telefono_celular_famproject",
        label: "TELEFONO CELULAR (PLAN FAMPROJECT)",
        mask: "phone",
        inputMode: "tel",
        pattern: "[0-9+\\-() ]*",
        maxLength: 15,
      },
      { key: "email_famproject", label: "EMAIL FAMPROJECT", type: "email" },
      {
        key: "fecha_modificacion_cargo",
        label: "FECHA DE MODIFICACION DEL CARGO",
        type: "date",
        allowNA: true,
        placeholder: "dd/mm/aaaa o N/A",
      },
      {
        key: "nuevo_cargo",
        label: "NUEVO CARGO",
        allowNA: true,
        placeholder: "N/A",
      },
      {
        key: "fecha_salida",
        label: "FECHA DE SALIDA",
        type: "date",
        allowNA: true,
        placeholder: "dd/mm/aaaa o N/A",
      },
      {
        key: "fecha_salida_iess",
        label: "FECHA DE SALIDA IESS",
        type: "date",
        allowNA: true,
        placeholder: "dd/mm/aaaa o N/A",
      },
      {
        key: "motivo_salida",
        label: "MOTIVO DE SALIDA",
        allowNA: true,
        placeholder: "N/A",
      },
      {
        key: "observaciones_salida",
        label: "OBSERVACIONES DE SALIDA",
        allowNA: true,
        placeholder: "N/A",
        multiline: true,
        rows: 4,
        fullWidth: true,
      },
    ],
  },
  {
    key: "familiar",
    title: "Datos familiares",
    fields: [
      {
        key: "nombre_conyuge",
        label: "NOMBRE CONYUGE",
        allowNA: true,
        placeholder: "N/A",
      },
      {
        key: "cedula_conyuge",
        label: "C.C. CONYUGE",
        mask: "cedula",
        inputMode: "numeric",
        pattern: "[0-9]*",
        maxLength: 10,
        allowNA: true,
        placeholder: "N/A",
      },
    ],
  },
  {
    key: "domicilio",
    title: "Datos de domicilio",
    fields: [
      {
        key: "ciudad_domicilio",
        label: "CIUDAD DOMICILIO",
        type: "select",
        options: ECUADOR_CITY_OPTIONS,
        placeholder: "Selecciona ciudad de domicilio",
      },
      {
        key: "direccion_domicilio",
        label: "DIRECCION DOMICILIO",
        multiline: true,
        rows: 3,
        fullWidth: true,
      },
      {
        key: "ruta_trabajo",
        label: "RUTA PARA LLEGAR AL TRABAJO",
        multiline: true,
        rows: 3,
        fullWidth: true,
      },
      {
        key: "movilizacion",
        label: "MOVILIZACION",
        type: "select",
        options: MOBILIZATION_OPTIONS,
        placeholder: "Selecciona tipo de movilizacion",
      },
      {
        key: "telefono_fijo",
        label: "TELEFONO FIJO",
        mask: "phone",
        inputMode: "tel",
        pattern: "[0-9+\\-() ]*",
        maxLength: 15,
        allowNA: true,
        placeholder: "N/A",
      },
    ],
  },
  {
    key: "emergencia",
    title: "Contacto de emergencia",
    fields: [
      { key: "persona_contacto", label: "PERSONA DE CONTACTO" },
      { key: "parentesco_contacto", label: "PARENTESCO" },
      {
        key: "telefono_contacto",
        label: "NUMERO DE TELEFONO",
        mask: "phone",
        inputMode: "tel",
        pattern: "[0-9+\\-() ]*",
        maxLength: 15,
      },
    ],
  },
  {
    key: "estudios",
    title: "Estudios",
    fields: [
      {
        key: "nivel_instruccion",
        label: "NIVEL DE INSTRUCCION",
        type: "select",
        options: EDUCATION_LEVEL_OPTIONS,
        placeholder: "Selecciona nivel de instruccion",
      },
    ],
  },
];

export const applicantProfileSections = [
  {
    key: "personal",
    title: "Datos personales",
    fields: [
      { key: "nombres", label: "NOMBRES", required: true },
      { key: "apellidos", label: "APELLIDOS", required: true },
      {
        key: "cedula",
        label: "NUMERO DE CEDULA",
        mask: "cedula",
        inputMode: "numeric",
        pattern: "[0-9]*",
        maxLength: 10,
        required: true,
      },
      {
        key: "ruc",
        label: "RUC",
        mask: "ruc",
        inputMode: "numeric",
        pattern: "[0-9]*",
        maxLength: 13,
      },
      {
        key: "tipo_sangre",
        label: "TIPO DE SANGRE",
        type: "select",
        options: BLOOD_TYPE_OPTIONS,
        placeholder: "Selecciona tipo de sangre",
      },
      {
        key: "genero",
        label: "GENERO",
        type: "select",
        options: GENDER_OPTIONS,
        placeholder: "Selecciona genero",
      },
      { key: "lugar_nacimiento", label: "LUGAR DE NACIMIENTO" },
      {
        key: "fecha_nacimiento",
        label: "FECHA DE NACIMIENTO",
        type: "date",
        required: true,
      },
      { key: "edad", label: "EDAD", readOnly: true },
      {
        key: "estado_civil",
        label: "ESTADO CIVIL",
        type: "select",
        options: MARITAL_STATUS_OPTIONS,
        placeholder: "Selecciona estado civil",
      },
      {
        key: "telefono_personal",
        label: "TELEFONO PERSONAL",
        mask: "phone",
        inputMode: "tel",
        pattern: "[0-9+\\-() ]*",
        maxLength: 15,
      },
      {
        key: "email_personal",
        label: "EMAIL PERSONAL",
        type: "email",
        required: true,
      },
    ],
  },
  {
    key: "laboral",
    title: "Datos laborales",
    fields: [
      {
        key: "cargo",
        label: "CARGO",
        type: "select",
        options: CARGO_OPTIONS,
        placeholder: "Selecciona cargo",
      },
      {
        key: "residencia",
        label: "RESIDENCIA",
        type: "select",
        options: ECUADOR_CITY_OPTIONS,
        placeholder: "Selecciona ciudad de residencia",
      },
    ],
  },
  {
    key: "familiar",
    title: "Datos familiares",
    fields: [
      {
        key: "nombre_conyuge",
        label: "NOMBRE CONYUGE",
        allowNA: true,
        placeholder: "N/A",
      },
      {
        key: "cedula_conyuge",
        label: "C.C. CONYUGE",
        mask: "cedula",
        inputMode: "numeric",
        pattern: "[0-9]*",
        maxLength: 10,
        allowNA: true,
        placeholder: "N/A",
      },
    ],
  },
  {
    key: "domicilio",
    title: "Datos de domicilio",
    fields: [
      {
        key: "ciudad_domicilio",
        label: "CIUDAD DOMICILIO",
        type: "select",
        options: ECUADOR_CITY_OPTIONS,
        placeholder: "Selecciona ciudad de domicilio",
      },
      {
        key: "direccion_domicilio",
        label: "DIRECCION DOMICILIO",
        multiline: true,
        rows: 3,
        fullWidth: true,
      },
      {
        key: "movilizacion",
        label: "MOVILIZACION",
        type: "select",
        options: MOBILIZATION_OPTIONS,
        placeholder: "Selecciona tipo de movilizacion",
      },
      {
        key: "telefono_fijo",
        label: "TELEFONO FIJO",
        mask: "phone",
        inputMode: "tel",
        pattern: "[0-9+\\-() ]*",
        maxLength: 15,
        allowNA: true,
        placeholder: "N/A",
      },
    ],
  },
  {
    key: "emergencia",
    title: "Contacto de emergencia",
    fields: [
      { key: "persona_contacto", label: "PERSONA DE CONTACTO" },
      { key: "parentesco_contacto", label: "PARENTESCO" },
      {
        key: "telefono_contacto",
        label: "NUMERO DE TELEFONO",
        mask: "phone",
        inputMode: "tel",
        pattern: "[0-9+\\-() ]*",
        maxLength: 15,
      },
    ],
  },
  {
    key: "estudios",
    title: "Estudios",
    fields: [
      {
        key: "nivel_instruccion",
        label: "NIVEL DE INSTRUCCION",
        type: "select",
        options: EDUCATION_LEVEL_OPTIONS,
        placeholder: "Selecciona nivel de instruccion",
      },
    ],
  },
];

export const documentTypes = [
  { key: "IDENTITY_DOCUMENT", label: "Documento de Identidad", ownerArea: "profile", group: "profile" },
  {
    key: "PASSPORT",
    label: "Pasaporte (cuando aplique)",
    ownerArea: "profile",
    group: "profile",
  },
  {
    key: "VOTING_CERTIFICATE",
    label: "Certificado de votacion",
    ownerArea: "profile",
    group: "profile",
  },
  { key: "UTILITY_BILL", label: "Servicio basico domicilio", ownerArea: "profile", group: "profile" },
  { key: "MARRIAGE_CERTIFICATE", label: "Acta de matrimonio", ownerArea: "profile", group: "profile" },
  {
    key: "CHILD_BIRTH_CERTIFICATE",
    label: "Partida de nacimiento (hijos)",
    ownerArea: "profile",
    group: "profile",
  },
  {
    key: "SENESCYT_RECORD",
    label: "Registro SENESCYT",
    ownerArea: "profile",
    group: "profile",
  },
  { key: "CURRICULUM_VITAE", label: "Curriculum vitae", ownerArea: "profile", group: "profile" },
  {
    key: "LABOR_CERTIFICATE",
    label: "Certificados laborales",
    ownerArea: "talento_humano",
    group: "talento_humano",
  },
  { key: "CONTRACT_FAM", label: "Contrato FAM", ownerArea: "talento_humano", group: "contracts" },
  { key: "CONTRACT_MDT", label: "Contrato MDT", ownerArea: "talento_humano", group: "contracts" },
  { key: "IESS_ENTRY_NOTICE", label: "IESS, aviso de entrada", ownerArea: "talento_humano", group: "talento_humano" },
  { key: "PERSONNEL_ACTION", label: "Accion del personal", ownerArea: "talento_humano", group: "induction" },
  { key: "INDUCTION_REGISTRY", label: "Registro de induccion", ownerArea: "talento_humano", group: "induction" },
  { key: "SIGNATURE_CONTROL", label: "Control de firmas", ownerArea: "talento_humano", group: "induction" },
  {
    key: "CONFIDENTIALITY_AGREEMENT",
    label: "Convenio de confidencialidad",
    ownerArea: "talento_humano",
    group: "talento_humano",
  },
  {
    key: "LOPDP_CONSENT",
    label: "Consentimiento LOPDP",
    ownerArea: "talento_humano",
    group: "talento_humano",
  },
  {
    key: "IMAGE_USE_AUTHORIZATION",
    label: "Autorizacion de uso de imagen",
    ownerArea: "talento_humano",
    group: "talento_humano",
  },
  {
    key: "PAYROLL_DISCOUNT_AUTHORIZATION",
    label: "Autorizacion de descuentos en roles",
    ownerArea: "financiero",
    group: "financiero",
  },
  {
    key: "TENTH_ACCUMULATION_FORM",
    label: "Acumulacion / Mensualizacion decimos y fondos de reserva",
    ownerArea: "talento_humano",
    group: "talento_humano",
  },
  {
    key: "HR_RESUME",
    label: "Hoja de vida",
    ownerArea: "talento_humano",
    group: "talento_humano",
  },
  {
    key: "DELIVERY_COMMUNICATION_TOOLS",
    label: "Acta de entrega de herramientas de comunicacion",
    ownerArea: "automatico",
    group: "automatico",
    sourceChannel: "integracion",
  },
  {
    key: "DELIVERY_LOGISTICS_TOOLS",
    label: "Acta de entrega de herramientas de logistica",
    ownerArea: "automatico",
    group: "automatico",
    sourceChannel: "integracion",
  },
  {
    key: "DELIVERY_WORK_TOOLS",
    label: "Acta de entrega de herramientas de trabajo",
    ownerArea: "automatico",
    group: "automatico",
    sourceChannel: "integracion",
  },
  {
    key: "DELIVERY_WORK_CLOTHES",
    label: "Acta de entrega de ropa de trabajo",
    ownerArea: "automatico",
    group: "automatico",
    sourceChannel: "integracion",
  },
  {
    key: "DELIVERY_EPP",
    label: "Acta de entrega de EPP",
    ownerArea: "automatico",
    group: "automatico",
    sourceChannel: "integracion",
  },
];

export const checklistSections = [
  {
    title: "Checklist de documentos",
    items: [
      {
        label: "Documento de Identidad",
        type: "doc",
        docType: "IDENTITY_DOCUMENT",
      },
      {
        label: "Pasaporte (cuando aplique)",
        type: "doc",
        docType: "PASSPORT",
      },
      {
        label: "Certificado de votacion",
        type: "doc",
        docType: "VOTING_CERTIFICATE",
      },
      {
        label: "Servicio basico domicilio",
        type: "doc",
        docType: "UTILITY_BILL",
      },
      {
        label: "Acta de matrimonio (cuando aplique)",
        type: "doc",
        docType: "MARRIAGE_CERTIFICATE",
      },
      {
        label: "Partida de nacimiento hijos (cuando aplique)",
        type: "doc",
        docType: "CHILD_BIRTH_CERTIFICATE",
      },
      {
        label: "Registro SENESCYT",
        type: "doc",
        docType: "SENESCYT_RECORD",
      },
      {
        label: "Curriculum vitae",
        type: "doc",
        docType: "CURRICULUM_VITAE",
      },
      { label: "Firma digital", type: "flag", flagKey: "firma_digital" },
      {
        label: "Apertura de cuenta de ahorros (Banco Internacional)",
        type: "flag",
        flagKey: "cuenta_internacional",
      },
    ],
  },
  {
    title: "Ingreso a Famproject",
    items: [
      {
        label: "Certificados laborales",
        type: "doc",
        docType: "LABOR_CERTIFICATE",
      },
      {
        label: "Contrato FAM",
        type: "doc",
        docType: "CONTRACT_FAM",
      },
      {
        label: "Contrato MDT",
        type: "doc",
        docType: "CONTRACT_MDT",
      },
      {
        label: "IESS, aviso de entrada",
        type: "doc",
        docType: "IESS_ENTRY_NOTICE",
      },
      {
        label: "Accion del personal",
        type: "doc",
        docType: "PERSONNEL_ACTION",
      },
      {
        label: "Registro de induccion",
        type: "doc",
        docType: "INDUCTION_REGISTRY",
      },
      {
        label: "Control de firmas",
        type: "doc",
        docType: "SIGNATURE_CONTROL",
      },
      {
        label: "Convenio de confidencialidad",
        type: "doc",
        docType: "CONFIDENTIALITY_AGREEMENT",
      },
      {
        label: "Consentimiento LOPDP",
        type: "doc",
        docType: "LOPDP_CONSENT",
      },
      {
        label: "Autorizacion de uso de imagen",
        type: "doc",
        docType: "IMAGE_USE_AUTHORIZATION",
      },
      {
        label: "Autorizacion de descuentos en roles",
        type: "doc",
        docType: "PAYROLL_DISCOUNT_AUTHORIZATION",
      },
      {
        label: "Acumulacion / Mensualizacion decimos y fondos de reserva",
        type: "doc",
        docType: "TENTH_ACCUMULATION_FORM",
      },
      {
        label: "Hoja de vida",
        type: "doc",
        docType: "HR_RESUME",
      },
      {
        label: "Entrega de tarjetas de presentacion",
        type: "flag",
        flagKey: "tarjetas_presentacion",
      },
      {
        label: "Entrega de credencial",
        type: "flag",
        flagKey: "credencial_entregada",
      },
    ],
  },
  {
    title: "Actas automáticas",
    items: [
      {
        label: "Acta de entrega de herramientas de comunicacion",
        type: "doc",
        docType: "DELIVERY_COMMUNICATION_TOOLS",
      },
      {
        label: "Acta de entrega de herramientas de logistica",
        type: "doc",
        docType: "DELIVERY_LOGISTICS_TOOLS",
      },
      {
        label: "Acta de entrega de herramientas de trabajo",
        type: "doc",
        docType: "DELIVERY_WORK_TOOLS",
      },
      {
        label: "Acta de entrega de ropa de trabajo",
        type: "doc",
        docType: "DELIVERY_WORK_CLOTHES",
      },
      {
        label: "Acta de entrega de EPP",
        type: "doc",
        docType: "DELIVERY_EPP",
      },
    ],
  },
  {
    title: "Registro tecnologia",
    items: [
      {
        label: "Correo corporativo, contrasena y firma",
        type: "flag",
        flagKey: "correo_corporativo",
      },
      {
        label: "Usuario y accesos Bitrix (CRM)",
        type: "flag",
        flagKey: "accesos_bitrix",
      },
      {
        label: "Usuario y accesos Silver ERP",
        type: "flag",
        flagKey: "accesos_silver",
      },
      {
        label: "Credenciales Roche (cuando aplique)",
        type: "flag",
        flagKey: "credenciales_roche",
      },
      {
        label: "Acceso a links de interes",
        type: "flag",
        flagKey: "acceso_links_interes",
      },
    ],
  },
  {
    title: "Beneficios",
    items: [
      {
        label: "Plan celular (cuando aplique)",
        type: "flag",
        flagKey: "plan_celular",
      },
      {
        label: "Celular entregado (cuando aplique)",
        type: "flag",
        flagKey: "celular_entregado",
      },
      {
        label: "Computadora entregada",
        type: "flag",
        flagKey: "computadora_entregada",
      },
      {
        label: "Seguro de atención médica y de vida",
        type: "flag",
        flagKey: "seguro_medico_vida",
      },
    ],
  },
  {
    title: "Entregas de dotación",
    items: [
      {
        label: "Ropa de trabajo entregada",
        type: "flag",
        flagKey: "uniformes_entregados",
      },
      {
        label: "EPP entregado",
        type: "flag",
        flagKey: "epp_entregados",
      },
      {
        label: "Herramientas de trabajo entregadas",
        type: "flag",
        flagKey: "herramientas_trabajo_entregadas",
      },
      {
        label: "Herramientas de logística entregadas",
        type: "flag",
        flagKey: "logistica_entregada",
      },
      {
        label: "Herramientas de comunicación entregadas (acta TI)",
        type: "flag",
        flagKey: "acta_entrega_equipos_comunicacion",
      },
    ],
  },
  {
    title: "Retiros de dotación",
    items: [
      {
        label: "Ropa de trabajo retirada",
        type: "flag",
        flagKey: "ropa_retirada",
      },
      {
        label: "EPP retirado",
        type: "flag",
        flagKey: "epp_retirado",
      },
      {
        label: "Herramientas de trabajo retiradas",
        type: "flag",
        flagKey: "herramientas_trabajo_retiradas",
      },
      {
        label: "Herramientas de logística retiradas",
        type: "flag",
        flagKey: "logistica_retirada",
      },
      {
        label: "Herramientas de comunicación retiradas (TI)",
        type: "flag",
        flagKey: "ti_retirado",
      },
    ],
  },
  {
    title: "Salida / Desvinculacion",
    items: [
      {
        label: "Notificar la salida por correo al equipo FAM",
        type: "flag",
        flagKey: "notificar_salida_equipo_fam",
      },
      {
        label: "Realizar entrevista de salida",
        type: "flag",
        flagKey: "entrevista_salida",
      },
      {
        label: "Entregar carta de despido",
        type: "flag",
        flagKey: "carta_despido",
      },
      {
        label: "Firmar actas de descargo de herramientas de trabajo",
        type: "flag",
        flagKey: "acta_descargo_herramientas",
      },
      {
        label: "Firmar actas de entrega de equipos de comunicacion",
        type: "flag",
        flagKey: "acta_entrega_equipos_comunicacion",
      },
      {
        label: "Realizar y firmar aviso de salida de IESS",
        type: "flag",
        flagKey: "aviso_salida_iess",
      },
      {
        label: "Calcular liquidacion en MDT y firmar acta de finiquito",
        type: "flag",
        flagKey: "liquidacion_mdt_finiquito",
      },
      {
        label:
          "Gestionar eliminacion de usuario CRM, SPI, ERP (si aplica) y Workspace de Google",
        type: "flag",
        flagKey: "eliminacion_accesos_sistemas",
      },
      {
        label: "Gestionar revision medica de salida",
        type: "flag",
        flagKey: "revision_medica_salida",
      },
      {
        label: "Firmar acta de descargo de uniformes",
        type: "flag",
        flagKey: "acta_descargo_uniformes",
      },
      {
        label: "Cambiar estado de ACTIVO a PASIVO",
        type: "flag",
        flagKey: "cambio_estado_activo_pasivo",
      },
      {
        label: "Colocar documentacion en carpeta personal desvinculado",
        type: "flag",
        flagKey: "documentacion_personal_desvinculado",
      },
      {
        label: "Gestionar la firma de roles de pago pendientes",
        type: "flag",
        flagKey: "firma_roles_pago_pendientes",
      },
    ],
  },
];
