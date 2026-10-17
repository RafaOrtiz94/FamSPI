"use strict";
const { Client } = require("pg");

async function main() {
  const client = new Client({
    host: "ep-wispy-moon-aqszgsal.c-8.us-east-1.aws.neon.tech", // directo, sin -pooler
    port: 5432,
    user: "neondb_owner",
    password: "npg_W12CVSvHJEsA",
    database: "neondb",
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const before = await client.query(`
    SELECT uar.id, uar.user_id, u.fullname, u.email, uar.entry_time, uar.entry_location
    FROM user_attendance_records uar
    JOIN users u ON u.id = uar.user_id
    WHERE uar.date = CURRENT_DATE
    ORDER BY uar.user_id
  `);
  console.log(`Filas de HOY (${before.rows.length}):`, JSON.stringify(before.rows, null, 2));

  // La constraint chk_uar_entry_location_required exige entry_location no
  // vacio si entry_time no es null -- por eso hay que asignar ubicacion
  // ANTES de poner la hora, para los 3 que no tenian ninguna.
  // Ubicacion habitual = la mas reciente entre viernes/jueves/miercoles
  // (07/06/05-ago). Veronica: patron estable (oficina). Galo y Andres:
  // ubicacion distinta cada dia (roles de campo) -- se usa la mas reciente
  // disponible como mejor aproximacion, no como "ubicacion habitual" real.
  const fallbackLocations = [
    { userId: 25, location: "-1.2763617,-78.6344317" }, // Veronica Medina, viernes 07-ago
    { userId: 28, location: "-2.890415771786447,-78.99241864777561" }, // Galo Leon, viernes 07-ago
    { userId: 40, location: "-2.8907506564531924,-79.02699922264242" }, // Andres Piedra, viernes 07-ago
  ];
  for (const { userId, location } of fallbackLocations) {
    await client.query(
      `UPDATE user_attendance_records
       SET entry_location = $2, entry_location_source = 'gps', updated_at = NOW()
       WHERE user_id = $1 AND date = CURRENT_DATE`,
      [userId, location],
    );
  }

  // 9:00am Ecuador (UTC-5) = 14:00:00 UTC del mismo dia. No se toca
  // entry_location de los que ya la tenian.
  const result = await client.query(`
    UPDATE user_attendance_records
    SET entry_time = (date::date + TIME '14:00:00') AT TIME ZONE 'UTC',
        updated_at = NOW()
    WHERE date = CURRENT_DATE
    RETURNING id, user_id, entry_time, entry_location
  `);
  console.log(`\nActualizadas: ${result.rowCount}`);
  console.log(JSON.stringify(result.rows, null, 2));

  await client.end();
}
main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
