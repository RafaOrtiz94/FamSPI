/**
 * create_warehouse_coordinator_expediente.js
 *
 * Crea (si no existe) el personnel_request "WAREHOUSE & DISTRIBUTION COORDINATOR"
 * y vincula los aspirantes cuyo cargo coincide (personnel_request_id NULL -> lo enlaza).
 * Version acotada de scripts/create_expedientes_from_applicants.js, solo para este cargo
 * (el generico crearia 71 expedientes nuevos con basura de texto libre de otros postulantes).
 *
 * Uso (apuntando a la base real wispy-moon/neondb, NO al DATABASE_URL de .env que
 * sigue apuntando a la base vieja congelada muddy-sun/FamSPI):
 *
 *   NEON_PW="$(gcloud secrets versions access latest --secret=DB_PASSWORD --project=famspi-sbox)" \
 *   DATABASE_URL="postgresql://neondb_owner:${NEON_PW}@ep-wispy-moon-aqszgsal.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require" \
 *   node backend/scripts/create_warehouse_coordinator_expediente.js
 */

const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = { query: (t, p) => pool.query(t, p) };

const CARGO = "WAREHOUSE & DISTRIBUTION COORDINATOR";
const ADMIN_EMAIL = "administrador@fam-project.com";

(async () => {
  const adminRes = await db.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [ADMIN_EMAIL]);
  if (!adminRes.rows.length) throw new Error("admin not found");
  const requesterId = adminRes.rows[0].id;

  const existing = await db.query(
    `SELECT id FROM personnel_requests
     WHERE UPPER(TRIM(REGEXP_REPLACE(position_title, '\\s+', ' ', 'g'))) = $1 LIMIT 1`,
    [CARGO]
  );
  let requestId;
  if (existing.rows.length) {
    requestId = existing.rows[0].id;
    console.log(`Ya existia: personnel_request #${requestId}`);
  } else {
    const ins = await db.query(
      `INSERT INTO personnel_requests
         (requester_id, position_title, position_type, education_level,
          main_responsibilities, justification, status, urgency_level, priority)
       VALUES
         ($1, $2, 'permanente', 'Bachillerato o Superior',
          'Por definir', 'Expediente generado automáticamente desde postulaciones recibidas.',
          'en_proceso', 'normal', 3)
       RETURNING id, request_number`,
      [requesterId, CARGO]
    );
    requestId = ins.rows[0].id;
    console.log(`Creado: personnel_request #${requestId} (${ins.rows[0].request_number})`);
  }

  const upd = await db.query(
    `UPDATE applicants
     SET personnel_request_id = $1, updated_at = NOW()
     WHERE UPPER(TRIM(REGEXP_REPLACE(profile->'laboral'->>'cargo', '\\s+', ' ', 'g'))) = $2
       AND (personnel_request_id IS NULL OR personnel_request_id = $1)
     RETURNING id, email`,
    [requestId, CARGO]
  );
  console.log(`Aspirantes vinculados: ${upd.rowCount}`);
  console.log(JSON.stringify(upd.rows, null, 2));

  await pool.end();
})().catch((e) => { console.error("ERROR", e.message); process.exit(1); });
