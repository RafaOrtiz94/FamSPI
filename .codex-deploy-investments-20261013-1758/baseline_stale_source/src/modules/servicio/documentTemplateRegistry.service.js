const fs = require("fs");
const path = require("path");
const db = require("../../config/db");

const TEMPLATE_ROOT = path.join(__dirname, "..", "..", "data", "plantillas");

const buildFst05AttendanceContractFields = () => {
  const fields = [
    "Num_Orden",
    "ORDFecha",
    "ORDCliente",
    "ORDEquipo",
    "ORDSerie",
    "ORDResponsable",
  ];

  for (let i = 1; i <= 7; i += 1) {
    fields.push(`Nombres_Apellidos${i}`);
    fields.push(`Cargo${i}`);
    fields.push(`Correo_Electrónico${i}`);
  }

  for (let day = 1; day <= 3; day += 1) {
    fields.push(`Dia_${day}`);
    for (let attendee = 2; attendee <= 7; attendee += 1) {
      fields.push(`Dia_${day}_${attendee}`);
    }
  }

  return fields;
};

const buildFst10ContractFields = () => {
  const fields = [
    "num_acta",
    "nom_cliente",
    "ruc_cedula",
    "dir",
    "tel",
    "fecha_entrega",
    "ob_1",
    "ob_2",
    "ob_3",
    "Des_por",
    "fecha_des",
    "ent_por",
    "fecha_ent",
  ];
  for (let i = 1; i <= 7; i += 1) {
    fields.push(`cod_equipo_${i}`);
    fields.push(`nom_equipo_${i}`);
    fields.push(`cant_equipo_${i}`);
    fields.push(`serie_equipo_${i}`);
  }
  return fields;
};

const TEMPLATE_CATALOG_SEED = [
  {
    document_code: "F.ST-20",
    document_name: "Solicitud de inspeccion de ambiente",
    procedure_code: "ST-01-01",
    version: "V01",
    vigencia: "V01",
    template_candidates: ["F.ST-20_V01_SOLICITUD DE INSPECCION DE AMBIENTE.pdf"],
    field_dictionary: [
      "asesor",
      "fecha",
      "correo",
      "cliente",
      "dir_cliente",
      "pc_cliente",
      "cp_cliente",
      "fecha_ins",
      "req_lis",
      "Acc_extras",
      "obs",
      "equipo_1",
      "equipo_2",
      "equipo_3",
      "equipo_4",
      "e_equipo_1",
      "e_equipo_2",
      "e_equipo_3",
      "e_equipo_4",
    ],
  },
  {
    document_code: "F.ST-02",
    document_name: "Desinfeccion de instrumentos y partes",
    procedure_code: "ST-01-01",
    version: "V04",
    vigencia: "V04",
    template_candidates: [
      "F.ST-02_V04_DESINFECCIÓN DE INSTRUMENTOS Y PARTES NUEVO.pdf",
      "F.ST-02_V04_DESINFECCIàN DE INSTRUMENTOS Y PARTES NUEVO.pdf",
    ],
    field_dictionary: [
      "Fecha",
      "Equipo",
      "Serie",
      "Responsable",
      "parte_repuesto",
      "chk_general",
      "chk_PEO",
      "chk_PEO_1",
      "chk_OP_1",
      "chk_en",
      "chk_en_op",
      "chk_CP",
      "chk_CP_op",
      "chk_lim",
      "chk_cloro",
      "chk_OP_cloro",
      "chk_PS",
      "chk_PS_peo",
      "chk_PS_op",
      "chk_tras",
      "chk_tras_peo",
      "chk_tras_op",
      "chk_CVITE",
      "chk_CVTE",
      "chk_DFD",
      "chk_DFD_peo",
      "chk_DFD_o",
      "chk_DFD_op",
      "chk_CD",
      "chk_CD_peo",
      "chk_CD_op",
      "firma_ing_SC_af_image",
      "adjunto_af_image",
    ],
  },
  {
    document_code: "F.ST-04",
    document_name: "Coordinacion de la fecha de entrenamiento",
    procedure_code: "ST-01-01",
    version: "V03",
    vigencia: "V03",
    template_candidates: ["F.ST-04_V03_COORDINACION DE LA FECHA DE ENTRENAMIENTO.pdf"],
    field_dictionary: [
      "ORDEquipo",
      "ORDSerie",
      "ORDResponsable",
      "ORDCliente",
      "ORDNumero",
      "Fecha_Inicio",
      "Fecha_final",
      "Dias",
      "Horas",
      "Num_P",
      "Obs_1",
      "Obs_2",
      "Obs_3",
      "Obs_4",
      "Firma_af_image",
    ],
  },
  {
    document_code: "F.ST-05",
    document_name: "Lista de asistencia entrenamientos",
    procedure_code: "ST-01-01",
    version: "V03",
    vigencia: "V03",
    template_candidates: ["F.ST-05_V03_LISTA DE ASISTENCIA ENTRENAMIENTOS.pdf"],
    field_dictionary: buildFst05AttendanceContractFields(),
  },
  {
    document_code: "F.ST-09",
    document_name: "Verificacion de equipos nuevos",
    procedure_code: "ST-01-01",
    version: "V03",
    vigencia: "V03",
    template_candidates: ["F.ST-09_V03_VERIFICACIÓN DE EQUIPOS NUEVOS.pdf"],
    field_dictionary: [
      "Fecha",
      "Cliente",
      "Equipo",
      "Serie",
      "RESULTADOS",
      "ANÁLISIS",
      "frima_af_image",
      "anexos_af_image",
    ],
  },
  {
    document_code: "F.ST-10",
    document_name: "Acta de entrega",
    procedure_code: "ST-01-01",
    version: "V04",
    vigencia: "V04",
    template_candidates: ["F.ST-10_V04_ACTA DE ENTREGA.pdf"],
    field_dictionary: buildFst10ContractFields(),
  },
  {
    document_code: "F.ST-14",
    document_name: "Recepcion visual de instalacion / preinstalacion",
    procedure_code: "ST-01-01",
    version: "V01",
    vigencia: "V01",
    template_candidates: [],
    field_dictionary: [
      "fecha_registro",
      "cliente",
      "direccion_cliente",
      "equipo",
      "fecha_requerida_despacho",
      "guia_referencia",
      "proforma_referencia",
      "inspector_tecnico",
      "validador_logistica",
      "guide_vs_proforma",
      "packaging_integrity",
      "tilt_indicator",
      "handling_indicator",
      "serial_match",
      "accessories_match",
      "hallazgos",
      "acciones_derivadas",
      "cadena_custodia",
      "resultado_recepcion",
      "evidencias_fotograficas",
    ],
  },
  {
    document_code: "F.ST-11",
    document_name: "Acta de retiro y desinstalacion de equipos",
    procedure_code: "ST-01-01",
    version: "V01",
    vigencia: "V01",
    template_candidates: [],
    field_dictionary: [
      "fecha_emision",
      "workflow_origen",
      "solicitud_retiro",
      "cliente",
      "equipo",
      "fecha_programada_retiro",
      "contacto_cliente",
      "telefono_contacto",
      "wo_retiro",
      "estado_fst02",
      "fst02_file_id",
      "cambio_partes",
      "notas_cambio_partes",
      "estado_embalaje",
      "bultos_total",
      "detalle_bultos",
      "transportista",
      "guia_tracking",
      "fecha_retiro_ejecutado",
      "observaciones",
      "firma_tecnico",
      "firma_cliente",
      "firma_logistica",
    ],
  },
  {
    document_code: "F.ST-16",
    document_name: "Cronograma anual de mantenimiento preventivo",
    procedure_code: "ST-01-02",
    version: "V01",
    vigencia: "V01",
    template_candidates: [],
    field_dictionary: [
      "plan_year",
      "plan_version",
      "plan_status",
      "plan_title",
      "total_items",
      "completed_items",
      "cancelled_items",
      "executing_items",
      "generated_at",
      "generated_by",
      "items",
      "anexo7_capacity",
    ],
  },
  {
    document_code: "F.ST-17",
    document_name: "Cronograma de mantenimiento preventivo por equipo",
    procedure_code: "ST-01-02",
    version: "V01",
    vigencia: "V01",
    template_candidates: [],
    field_dictionary: [
      "annual_plan_id",
      "plan_year",
      "plan_version",
      "plan_item_id",
      "equipment_id",
      "equipment_name",
      "equipment_serial",
      "client_name",
      "warranty_status",
      "contract_type",
      "planned_date",
      "planned_month",
      "work_order_number",
      "last_execution_at",
      "execution_result",
      "coordination_window",
      "notes",
      "generated_at",
      "generated_by",
    ],
  },
];

const resolveTemplatePath = (candidates = []) => {
  for (const fileName of candidates) {
    const absolutePath = path.join(TEMPLATE_ROOT, fileName);
    if (fs.existsSync(absolutePath)) {
      return absolutePath;
    }
  }
  return candidates.length ? path.join(TEMPLATE_ROOT, candidates[0]) : null;
};

const normalizeDictionary = (fields = []) =>
  Array.from(
    new Set(
      (Array.isArray(fields) ? fields : [])
        .map((item) => String(item || "").trim())
        .filter(Boolean),
    ),
  );

const ensureDocumentTemplateCatalogTable = async () => {
  await db.query(`CREATE SCHEMA IF NOT EXISTS servicio`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.document_template_catalog (
      document_code TEXT PRIMARY KEY,
      document_name TEXT NOT NULL,
      procedure_code TEXT NOT NULL,
      version TEXT,
      vigencia TEXT,
      template_path TEXT,
      template_candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
      field_dictionary JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
};

const seedDocumentTemplateCatalog = async () => {
  await ensureDocumentTemplateCatalogTable();
  for (const item of TEMPLATE_CATALOG_SEED) {
    const templatePath = resolveTemplatePath(item.template_candidates);
    const normalizedDictionary = normalizeDictionary(item.field_dictionary);
    const metadata = {
      source: "servicio.documentTemplateRegistry.service.seed",
      updated_at_seed: new Date().toISOString(),
      contract_type: "service_field_contract",
    };
     
    await db.query(
      `
        INSERT INTO servicio.document_template_catalog (
          document_code, document_name, procedure_code, version, vigencia,
          template_path, template_candidates, field_dictionary, is_active, metadata, created_at, updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,TRUE,$9::jsonb,now(),now())
        ON CONFLICT (document_code) DO UPDATE
          SET document_name = EXCLUDED.document_name,
              procedure_code = EXCLUDED.procedure_code,
              version = EXCLUDED.version,
              vigencia = EXCLUDED.vigencia,
              template_path = EXCLUDED.template_path,
              template_candidates = EXCLUDED.template_candidates,
              field_dictionary = EXCLUDED.field_dictionary,
              metadata = COALESCE(servicio.document_template_catalog.metadata, '{}'::jsonb) || EXCLUDED.metadata,
              updated_at = now()
      `,
      [
        item.document_code,
        item.document_name,
        item.procedure_code,
        item.version || null,
        item.vigencia || null,
        templatePath,
        JSON.stringify(item.template_candidates || []),
        JSON.stringify(normalizedDictionary),
        JSON.stringify(metadata),
      ],
    );
  }
};

const listDocumentTemplateCatalog = async ({ includeInactive = false } = {}) => {
  await seedDocumentTemplateCatalog();
  const params = [];
  const where = [];
  if (!includeInactive) {
    params.push(true);
    where.push(`is_active = $${params.length}`);
  }

  const query = `
    SELECT
      document_code,
      document_name,
      procedure_code,
      version,
      vigencia,
      template_path,
      template_candidates,
      field_dictionary,
      is_active,
      metadata,
      created_at,
      updated_at
    FROM servicio.document_template_catalog
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY document_code ASC
  `;

  const { rows } = await db.query(query, params);
  return rows;
};

const getDocumentTemplateByCode = async (documentCode) => {
  await seedDocumentTemplateCatalog();
  const normalizedCode = String(documentCode || "").trim().toUpperCase();
  if (!normalizedCode) return null;

  const { rows } = await db.query(
    `
      SELECT
        document_code,
        document_name,
        procedure_code,
        version,
        vigencia,
        template_path,
        template_candidates,
        field_dictionary,
        is_active,
        metadata,
        created_at,
        updated_at
      FROM servicio.document_template_catalog
      WHERE document_code = $1
      LIMIT 1
    `,
    [normalizedCode],
  );
  return rows[0] || null;
};

module.exports = {
  ensureDocumentTemplateCatalogTable,
  seedDocumentTemplateCatalog,
  listDocumentTemplateCatalog,
  getDocumentTemplateByCode,
};
