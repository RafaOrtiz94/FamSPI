require("dotenv").config();

const db = require("../src/config/db");
const clientsService = require("../src/modules/clients/clients.service");

async function main() {
  const role = String(process.env.ODOO_BACKFILL_ROLE || "admin").trim().toLowerCase();
  const email = String(process.env.ODOO_BACKFILL_EMAIL || "odoo_sync@spi.local").trim().toLowerCase();

  await clientsService.syncOdooClientsBackfill({
    user: { role, email },
  });

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int AS total
       FROM client_requests
      WHERE LOWER(COALESCE(external_source, '')) = 'odoo'`,
  );

  const { rows: recentRows } = await db.query(
    `SELECT id, commercial_name, ruc_cedula, client_email, external_id, last_synced_at
       FROM client_requests
      WHERE LOWER(COALESCE(external_source, '')) = 'odoo'
      ORDER BY last_synced_at DESC NULLS LAST, id DESC
      LIMIT 10`,
  );

  console.log("Backfill Odoo clientes completado.");
  console.log(`Total clientes Odoo en SPI: ${countRows[0]?.total || 0}`);
  console.log("Muestra (ultimos 10):");
  recentRows.forEach((row) => {
    console.log(
      `- [${row.id}] ${row.commercial_name || "(sin nombre)"} | RUC: ${row.ruc_cedula || "-"} | email: ${row.client_email || "-"} | external_id: ${row.external_id || "-"} | synced: ${row.last_synced_at || "-"}`,
    );
  });
}

main()
  .catch((error) => {
    console.error("Fallo backfill Odoo clientes:", error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await db.pool.end();
    } catch (_) {
      // ignore pool close error on shutdown
    }
  });
