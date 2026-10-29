/**
 * create_expedientes_from_applicants.js
 *
 * Lee los puestos únicos de la tabla `applicants` (profile->'laboral'->>'cargo'),
 * crea un personnel_request por cada puesto normalizado que no exista aún,
 * y vincula cada aspirante a su expediente via applicants.personnel_request_id.
 *
 * Requisito previo: aplicar migration 219_applicants_personnel_request_link.sql
 *
 * Uso:
 *   node backend/scripts/create_expedientes_from_applicants.js
 *   node backend/scripts/create_expedientes_from_applicants.js --dry-run
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

// DATABASE_URL puede venir como: psql 'postgresql://...' — extraer solo la URL
const { Pool } = require("pg");
let connStr = process.env.DATABASE_URL || "";
const matchUrl = connStr.match(/postgresql:\/\/[^\s']+/);
if (matchUrl) connStr = matchUrl[0];
const pool = new Pool({
  connectionString: connStr,
  ssl: { rejectUnauthorized: false },
});
const db = { query: (text, params) => pool.query(text, params) };

const DRY_RUN = process.argv.includes("--dry-run");
const ADMIN_EMAIL = "administrador@fam-project.com";

const normalizarPuesto = (text) =>
  (text || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN — no se escribirá nada ===" : "=== MODO REAL ===");
  console.log("");

  // 1. Obtener requester_id del admin
  const adminRes = await db.query(
    "SELECT id FROM users WHERE email = $1 LIMIT 1",
    [ADMIN_EMAIL]
  );
  if (adminRes.rows.length === 0) {
    console.error(`Usuario administrador no encontrado: ${ADMIN_EMAIL}`);
    process.exit(1);
  }
  const requesterId = adminRes.rows[0].id;
  console.log(`Admin ID: ${requesterId}`);

  // 2. Obtener puestos distintos normalizados con sus aspirantes
  const posRes = await db.query(`
    SELECT
      UPPER(TRIM(REGEXP_REPLACE(profile->'laboral'->>'cargo', '\\s+', ' ', 'g'))) AS puesto_norm,
      array_agg(id ORDER BY created_at) AS applicant_ids,
      COUNT(*) AS total
    FROM applicants
    WHERE profile->'laboral'->>'cargo' IS NOT NULL
      AND TRIM(profile->'laboral'->>'cargo') != ''
    GROUP BY puesto_norm
    ORDER BY total DESC, puesto_norm
  `);

  console.log(`Puestos únicos encontrados: ${posRes.rows.length}`);
  console.log("");

  let creados = 0;
  let existentes = 0;
  let vinculados = 0;
  let omitidos = 0;
  const detalle = [];

  for (const row of posRes.rows) {
    const { puesto_norm, applicant_ids, total } = row;

    if (!puesto_norm || puesto_norm.length < 2) {
      console.log(`  SKIP vacío — ${total} aspirantes sin puesto`);
      omitidos++;
      continue;
    }

    // 3. ¿Ya existe un personnel_request con este título?
    const existeRes = await db.query(
      `SELECT id, request_number
       FROM personnel_requests
       WHERE UPPER(TRIM(REGEXP_REPLACE(position_title, '\\s+', ' ', 'g'))) = $1
       LIMIT 1`,
      [puesto_norm]
    );

    let requestId;
    let label;

    if (existeRes.rows.length > 0) {
      requestId = existeRes.rows[0].id;
      label = `${existeRes.rows[0].request_number} (ya existía)`;
      existentes++;
    } else {
      // 4. Crear el expediente
      if (!DRY_RUN) {
        const insRes = await db.query(
          `INSERT INTO personnel_requests
             (requester_id, position_title, position_type, education_level,
              main_responsibilities, justification, status, urgency_level, priority)
           VALUES
             ($1, $2, 'permanente', 'Bachillerato o Superior',
              'Por definir', 'Expediente generado automáticamente desde postulaciones recibidas.',
              'en_proceso', 'normal', 3)
           RETURNING id, request_number`,
          [requesterId, puesto_norm]
        );
        requestId = insRes.rows[0].id;
        label = `${insRes.rows[0].request_number} (NUEVO)`;
      } else {
        requestId = null;
        label = "NUEVO (dry-run)";
      }
      creados++;
    }

    // 5. Vincular aspirantes → expediente
    let rowsUpdated = 0;
    if (!DRY_RUN && requestId) {
      const updRes = await db.query(
        `UPDATE applicants
         SET personnel_request_id = $1, updated_at = NOW()
         WHERE id = ANY($2)
           AND (personnel_request_id IS NULL OR personnel_request_id = $1)
         RETURNING id`,
        [requestId, applicant_ids]
      );
      rowsUpdated = updRes.rowCount;
      vinculados += rowsUpdated;
    }

    const line = `  [${String(total).padStart(3)} aspirantes]  ${label}  →  "${puesto_norm}"`;
    console.log(line);
    detalle.push({ puesto: puesto_norm, total, label, vinculados: rowsUpdated });
  }

  console.log("");
  console.log("════════════════════════════════════════════");
  console.log(`  Expedientes creados   : ${creados}`);
  console.log(`  Expedientes existentes: ${existentes}`);
  console.log(`  Aspirantes vinculados : ${vinculados}`);
  console.log(`  Puestos omitidos      : ${omitidos}`);
  console.log("════════════════════════════════════════════");

  if (DRY_RUN) {
    console.log("\nEjecuta sin --dry-run para aplicar los cambios.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Error fatal:", err.message || err);
  process.exit(1);
});
