const db = require("../config/db");
const logger = require("../config/logger");

const REQUIRED_TABLES = [
  {
    schema: "public",
    table: "request_types",
    columns: ["id", "code", "title"],
  },
  {
    schema: "public",
    table: "requests",
    columns: ["id", "requester_id", "request_type_id", "payload", "status"],
  },
  {
    schema: "public",
    table: "request_versions",
    columns: ["request_id", "version_number", "payload"],
  },
  {
    schema: "public",
    table: "request_attachments",
    columns: ["request_id", "drive_file_id", "drive_link", "uploaded_by"],
  },
  {
    schema: "public",
    table: "client_requests",
    columns: [
      "id",
      "created_by",
      "status",
      "client_type",
      "data_processing_consent",
      "consent_recipient_email",
      "consent_email_token_id",
      "ruc_cedula",
    ],
    optionalColumns: [
      "consent_capture_method",
      "lopdp_consent_status",
      "consent_evidence_file_id",
    ],
  },
  {
    schema: "public",
    table: "client_request_consents",
    columns: [
      "id",
      "client_request_id",
      "event_type",
      "method",
      "created_at",
    ],
  },
  {
    schema: "public",
    table: "client_request_consent_tokens",
    columns: [
      "id",
      "client_email",
      "code_hash",
      "status",
      "expires_at",
      "used_request_id",
    ],
    optionalColumns: ["verified_at", "verified_by_email", "created_by_email"],
  },
  {
    schema: "auditoria",
    table: "logs",
    columns: ["id", "modulo", "accion", "usuario_email"],
  },
  {
    schema: "servicio",
    table: "cronograma_mantenimientos",
    columns: ["id_mantenimiento", "id_equipo", "tipo", "responsable", "fecha_programada"],
    optionalColumns: [
      "request_id",
      "next_maintenance_date",
      "next_maintenance_status",
      "next_reminder_sent_at",
    ],
  },
];

async function checkTable({ schema, table, columns, optionalColumns = [] }) {
  const identifier = schema ? `${schema}.${table}` : table;

  const exists = await db
    .query("SELECT to_regclass($1)::text AS table_name", [identifier])
    .then((res) => Boolean(res.rows[0]?.table_name))
    .catch((err) => {
      logger.error(
        { err, identifier },
        "❌ Error verificando existencia de tabla"
      );
      return false;
    });

  if (!exists) {
    logger.error(`❌ Tabla faltante: ${identifier}`);
    return;
  }

  const columnsRes = await db
    .query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
      `,
      [schema || "public", table]
    )
    .catch((err) => {
      logger.error(
        { err, identifier },
        "❌ Error leyendo columnas de tabla"
      );
      return { rows: [] };
    });

  const presentColumns = new Set(
    columnsRes?.rows?.map((row) => row.column_name) || []
  );

  const missingColumns = (columns || []).filter(
    (col) => !presentColumns.has(col)
  );
  const missingOptional = (optionalColumns || []).filter(
    (col) => !presentColumns.has(col)
  );

  if (missingColumns.length) {
    logger.error(
      `⚠️ Tabla ${identifier} encontrada pero faltan columnas obligatorias: ${missingColumns.join(
        ", "
      )}`
    );
  } else {
    logger.info(`✅ Tabla ${identifier} OK (${columns.length} columnas clave)`);
  }

  if (missingOptional.length) {
    logger.warn(
      `ℹ️ Tabla ${identifier} sin columnas opcionales: ${missingOptional.join(
        ", "
      )}. Algunas automatizaciones podrían deshabilitarse.`
    );
  }
}

async function checkDbSchema() {
  logger.info("🔍 Iniciando verificación de tablas críticas…");
  for (const tableCheck of REQUIRED_TABLES) {
    try {
      await checkTable(tableCheck);
    } catch (err) {
      logger.error(
        { err, table: tableCheck },
        "❌ Error inesperado revisando tabla"
      );
    }
  }
  logger.info("📋 Verificación de tablas completada");
}

module.exports = { checkDbSchema };
