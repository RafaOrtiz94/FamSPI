const db = require("../src/config/db");

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
    CREATE TABLE IF NOT EXISTS applicant_documents (
      id SERIAL PRIMARY KEY,
      applicant_id INTEGER REFERENCES applicants(id) ON DELETE CASCADE,
      doc_type TEXT NOT NULL,
      drive_file_id TEXT,
      drive_url TEXT,
      file_name TEXT,
      mime_type TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS applicant_documents_unique
    ON applicant_documents(applicant_id, doc_type);
  `);
};

const DELETE_FROM_USERS = String(process.env.DELETE_FROM_USERS || "").toLowerCase() === "true";

const run = async () => {
  await ensureApplicantsTables();

  const { rows: candidates } = await db.query(`
    SELECT u.id AS user_id, u.email, u.fullname, cp.profile
    FROM users u
    JOIN collaborator_profiles cp ON cp.user_id = u.id
    WHERE (cp.profile->'extra'->>'applicant_source' = 'google_forms'
      OR (cp.profile->'extra' ? 'preguntas_adicionales'))
  `);

  if (candidates.length === 0) {
    console.log("No hay aspirantes en users para migrar.");
    return;
  }

  for (const row of candidates) {
    const { rows: inserted } = await db.query(
      `
      INSERT INTO applicants (email, fullname, profile, status, updated_at)
      VALUES ($1, $2, $3, 'applied', NOW())
      ON CONFLICT (email)
      DO UPDATE SET fullname = EXCLUDED.fullname, profile = EXCLUDED.profile, updated_at = NOW()
      RETURNING id
      `,
      [row.email, row.fullname, row.profile || {}]
    );
    const applicantId = inserted[0]?.id;

    if (applicantId) {
      await db.query(
        `
        INSERT INTO applicant_documents (applicant_id, doc_type, drive_file_id, drive_url, file_name, mime_type, created_at)
        SELECT $1, doc_type, drive_file_id, drive_url, file_name, mime_type, created_at
        FROM collaborator_documents
        WHERE user_id = $2
        ON CONFLICT (applicant_id, doc_type)
        DO UPDATE SET
          drive_file_id = EXCLUDED.drive_file_id,
          drive_url = EXCLUDED.drive_url,
          file_name = EXCLUDED.file_name,
          mime_type = EXCLUDED.mime_type,
          created_at = EXCLUDED.created_at
        `,
        [applicantId, row.user_id]
      );
    }
  }

  if (DELETE_FROM_USERS) {
    const userIds = candidates.map((row) => row.user_id);
    await db.query(`DELETE FROM collaborator_documents WHERE user_id = ANY($1::int[])`, [userIds]);
    await db.query(`DELETE FROM collaborator_profiles WHERE user_id = ANY($1::int[])`, [userIds]);
    await db.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [userIds]);
    console.log(`Migrados y eliminados ${userIds.length} aspirantes de users.`);
  } else {
    console.log(`Migrados ${candidates.length} aspirantes a tabla applicants (sin borrar users).`);
  }
};

run()
  .catch((err) => {
    console.error("Error migrando aspirantes:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await db.pool.end();
    } catch (err) {
      console.error("Error cerrando pool:", err);
    }
  });
