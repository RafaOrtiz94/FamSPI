const { Pool } = require("pg");

async function run() {
  const actaCode = "ACTA-COL-2026-000018";
  const pool = new Pool({
    host: process.env.DB_HOST || "ep-wispy-moon-aqszgsal-pooler.c-8.us-east-1.aws.neon.tech",
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || "neondb_owner",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "FamSPI",
    ssl: String(process.env.DB_SSL || "true") === "true"
      ? { rejectUnauthorized: String(process.env.DB_SSL_REJECT_UNAUTHORIZED || "false") === "true" }
      : undefined,
  });

  try {
    const acta = await pool.query(`
      SELECT *
      FROM public.collab_delivery_actas
      WHERE acta_code = $1
      ORDER BY id
    `, [actaCode]);

    const actaRow = acta.rows[0] || null;
    if (!actaRow) {
      console.log(JSON.stringify({ acta: null }, null, 2));
      return;
    }

    const deps = await pool.query(`
      SELECT 'acta_items' AS table_name, COUNT(*)::int AS total
      FROM public.collab_delivery_actas_items
      WHERE acta_id = $1
      UNION ALL
      SELECT 'deliveries', COUNT(*)::int
      FROM public.collab_deliveries
      WHERE session_id = $2
      UNION ALL
      SELECT 'delivery_events', COUNT(*)::int
      FROM public.collab_delivery_events
      WHERE delivery_id IN (
        SELECT id FROM public.collab_deliveries WHERE session_id = $2
      )
      UNION ALL
      SELECT 'delivery_docs', COUNT(*)::int
      FROM public.collab_delivery_docs
      WHERE delivery_id IN (
        SELECT id FROM public.collab_deliveries WHERE session_id = $2
      )
      UNION ALL
      SELECT 'sessions', COUNT(*)::int
      FROM public.collab_delivery_sessions
      WHERE id = $2
      UNION ALL
      SELECT 'signature_workflows', COUNT(*)::int
      FROM public.signature_workflows
      WHERE source_module = 'collab_deliveries'
        AND (
          source_entity_id = $1
          OR source_entity_id = $2
        )
    `, [actaRow.id, actaRow.session_id]);

    const deliveries = await pool.query(`
      SELECT id, user_id, catalog_item_id, status, session_id, delivery_date
      FROM public.collab_deliveries
      WHERE session_id = $1
      ORDER BY id
    `, [actaRow.session_id]);

    const session = await pool.query(`
      SELECT *
      FROM public.collab_delivery_sessions
      WHERE id = $1
    `, [actaRow.session_id]);

    console.log(JSON.stringify({
      acta: actaRow,
      session: session.rows[0] || null,
      deliveries: deliveries.rows,
      dependencies: deps.rows,
    }, null, 2));
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
