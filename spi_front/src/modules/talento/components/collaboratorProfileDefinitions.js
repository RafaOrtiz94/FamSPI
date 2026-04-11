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
      { key: "tipo_sangre", label: "TIPO DE SANGRE" },
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
      { key: "estado_civil", label: "ESTADO CIVIL" },
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
      { key: "tipo_contrato", label: "TIPO DE CONTRATO" },
      { key: "cargo", label: "CARGO" },
      { key: "area", label: "AREA" },
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
      { key: "titulo_tercer_nivel", label: "TITULO DE TERCER NIVEL" },
      { key: "universidad_tercer_nivel", label: "UNIVERSIDAD (TERCER NIVEL)" },
      { key: "titulo_cuarto_nivel", label: "TITULO DE CUARTO NIVEL" },
      { key: "universidad_cuarto_nivel", label: "UNIVERSIDAD (CUARTO NIVEL)" },
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
      { key: "tipo_sangre", label: "TIPO DE SANGRE" },
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
      { key: "estado_civil", label: "ESTADO CIVIL" },
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
      { key: "cargo", label: "CARGO" },
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
      { key: "titulo_tercer_nivel", label: "TITULO DE TERCER NIVEL" },
      { key: "universidad_tercer_nivel", label: "UNIVERSIDAD (TERCER NIVEL)" },
      { key: "titulo_cuarto_nivel", label: "TITULO DE CUARTO NIVEL" },
      { key: "universidad_cuarto_nivel", label: "UNIVERSIDAD (CUARTO NIVEL)" },
    ],
  },
];

export const documentTypes = [
  { key: "CEDULA_COLOR", label: "Copia a color de la cedula de ciudadania" },
  {
    key: "PASAPORTE_NOTARIADO",
    label: "Copia certificada y notariada del pasaporte (cuando aplique)",
  },
  { key: "PASAPORTE_COLOR", label: "Copia a color de pasaporte" },
  {
    key: "CERTIFICADO_VOTACION_COLOR",
    label: "Copia a color de certificado de votacion",
  },
  { key: "SERVICIO_BASICO", label: "Copia de servicio basico" },
  { key: "CARNET_TIPO_SANGRE", label: "Copia del carnet de tipo de sangre" },
  { key: "ACTA_MATRIMONIO", label: "Copia de acta de matrimonio" },
  { key: "CERTIFICADO_NACIMIENTO", label: "Certificado de nacimiento" },
  {
    key: "CERTIFICADO_NACIMIENTO_HIJOS",
    label: "Certificado de nacimiento hijos",
  },
  { key: "FOTO_CARNET", label: "Foto tamano carnet" },
  { key: "TITULOS_CURSOS", label: "Copia de titulos profesionales y cursos" },
  {
    key: "CERTIFICADO_TRABAJO_ANTERIOR",
    label: "Copia de certificado de trabajo anterior",
  },
  { key: "HISTORIAL_IESS", label: "Historial Laboral del IESS" },
  { key: "CONTRATO_TRABAJO", label: "Contrato de trabajo" },
  { key: "CRONOGRAMA_INDUCCION", label: "Cronograma de induccion" },
  {
    key: "AUTORIZACION_DESCUENTOS",
    label: "Autorizacion de descuentos en roles",
  },
  { key: "ACTA_BIENES", label: "Acta de bienes asignados" },
  { key: "CONVENIO_CONFIDENCIALIDAD", label: "Convenio de confidencialidad" },
  { key: "ALCANCE_LOPDP", label: "Alcance LOPDP" },
  {
    key: "COMPROMISO_NO_DISCRIMINACION",
    label: "Compromiso de erradicacion de discriminacion",
  },
  { key: "INGRESO_IESS", label: "Aviso de Entrada IESS" },
  {
    key: "FORMATO_DECIMOS",
    label: "Acumulacion/ Mensualizacion decimos y fondos de reserva",
  },
  { key: "OFERTA_SALARIO", label: "Oferta de salario firmada" },
  { key: "HOJA_VIDA", label: "Hoja de vida" },
  { key: "CARTA_MOTIVACION", label: "Carta de motivacion" },
];

export const checklistSections = [
  {
    title: "Checklist de documentos",
    items: [
      {
        label: "Copia a color de la cedula de ciudadania",
        type: "doc",
        docType: "CEDULA_COLOR",
      },
      {
        label: "Copia certificada notariada del pasaporte (cuando aplique)",
        type: "doc",
        docType: "PASAPORTE_NOTARIADO",
      },
      {
        label: "Copia a color del certificado de votacion",
        type: "doc",
        docType: "CERTIFICADO_VOTACION_COLOR",
      },
      {
        label: "Copia de servicio basico",
        type: "doc",
        docType: "SERVICIO_BASICO",
      },
      {
        label: "Copia del carnet de tipo de sangre",
        type: "doc",
        docType: "CARNET_TIPO_SANGRE",
      },
      {
        label: "Copia del acta de matrimonio (cuando aplique)",
        type: "doc",
        docType: "ACTA_MATRIMONIO",
      },
      {
        label: "Certificado de nacimiento hijos (cuando aplique)",
        type: "doc",
        docType: "CERTIFICADO_NACIMIENTO_HIJOS",
      },
      {
        label: "Foto tamano carnet digital",
        type: "doc",
        docType: "FOTO_CARNET",
      },
      {
        label: "Copia de titulos profesionales y cursos",
        type: "doc",
        docType: "TITULOS_CURSOS",
      },
      {
        label: "Copia simple del certificado de trabajo anterior",
        type: "doc",
        docType: "CERTIFICADO_TRABAJO_ANTERIOR",
      },
      {
        label: "Historial laboral obtenido del IESS",
        type: "doc",
        docType: "HISTORIAL_IESS",
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
        label: "Cronograma de induccion",
        type: "doc",
        docType: "CRONOGRAMA_INDUCCION",
      },
      {
        label: "Autorizacion de descuentos en roles",
        type: "doc",
        docType: "AUTORIZACION_DESCUENTOS",
      },
      {
        label: "Acta de bienes asignados",
        type: "doc",
        docType: "ACTA_BIENES",
      },
      {
        label: "Contrato de trabajo (doble cara)",
        type: "doc",
        docType: "CONTRATO_TRABAJO",
      },
      {
        label: "Convenio de confidencialidad",
        type: "doc",
        docType: "CONVENIO_CONFIDENCIALIDAD",
      },
      {
        label: "Alcance LOPDP",
        type: "doc",
        docType: "ALCANCE_LOPDP",
      },
      {
        label: "Compromiso de no discriminacion, violencia y acoso",
        type: "doc",
        docType: "COMPROMISO_NO_DISCRIMINACION",
      },
      {
        label: "Aviso de Entrada IESS",
        type: "doc",
        docType: "INGRESO_IESS",
      },
      {
        label: "Acumulacion/ Mensualizacion decimos y fondos de reserva",
        type: "doc",
        docType: "FORMATO_DECIMOS",
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
      {
        label: "Oferta de salario firmada",
        type: "doc",
        docType: "OFERTA_SALARIO",
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
        label: "Entrega de uniformes (cuando aplique)",
        type: "flag",
        flagKey: "uniformes_entregados",
      },
      {
        label: "Seguro de atención médica y de vida",
        type: "flag",
        flagKey: "seguro_medico_vida",
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
