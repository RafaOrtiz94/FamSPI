const { Pool } = require("pg");
const { execSync } = require("child_process");

async function getDbPassword() {
  try {
    return execSync(
      'gcloud secrets versions access latest --secret="DB_PASSWORD" --project="famspi-sbox"',
      { encoding: "utf8" }
    ).trim();
  } catch {
    return process.env.DB_PASSWORD || "";
  }
}

async function run() {
  const password = await getDbPassword();
  const pool = new Pool({
    host: "ep-wispy-moon-aqszgsal-pooler.c-8.us-east-1.aws.neon.tech",
    port: 5432,
    user: "neondb_owner",
    password,
    database: "FamSPI",
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    const { rows: users } = await client.query(
      `SELECT id, email, fullname FROM users WHERE LOWER(email) LIKE '%rafael.ortiz%' OR LOWER(fullname) LIKE '%rafael%ortiz%'`
    );
    if (users.length !== 1) {
      console.log("Usuarios encontrados:", users);
      throw new Error(`Se esperaba exactamente 1 usuario, se encontraron ${users.length}`);
    }
    const user = users[0];
    console.log("Usuario:", user);

    const before = await client.query(
      `SELECT * FROM user_attendance_records WHERE user_id = $1 AND date = CURRENT_DATE`,
      [user.id]
    );
    console.log("Registro de hoy ANTES:", before.rows[0] || null);

    if (!before.rows.length) {
      console.log("No hay registro de asistencia hoy para este usuario. Nada que limpiar.");
      return;
    }

    const { rows: updated } = await client.query(
      `UPDATE user_attendance_records
          SET lunch_start_time = NULL,
              lunch_start_location = NULL,
              lunch_start_location_timestamp = NULL,
              lunch_end_time = NULL,
              lunch_end_location = NULL,
              lunch_end_location_timestamp = NULL,
              exit_time = NULL,
              exit_location = NULL,
              exit_location_timestamp = NULL,
              is_overtime = NULL,
              overtime_hours = NULL,
              total_hours = NULL,
              updated_at = NOW()
        WHERE user_id = $1 AND date = CURRENT_DATE
        RETURNING *`,
      [user.id]
    );
    console.log("Registro de hoy DESPUES:", updated[0]);
    console.log("Listo: salida a almuerzo, entrada de almuerzo y salida final quedaron en NULL.");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
