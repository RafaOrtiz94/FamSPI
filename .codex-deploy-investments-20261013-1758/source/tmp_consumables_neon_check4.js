const { Client } = require("pg");
(async () => {
  const client = new Client({
    host: "ep-wispy-moon-aqszgsal-pooler.c-8.us-east-1.aws.neon.tech",
    user: "neondb_owner",
    password: "npg_W12CVSvHJEsA",
    database: "FamSPI",
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const queries = [
    ["cec_columns", "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='catalog_equipment_consumables' ORDER BY ordinal_position"],
    ["cec_sample", "SELECT * FROM public.catalog_equipment_consumables LIMIT 10"],
    ["join_counts", "SELECT (SELECT COUNT(*) FROM public.catalog_equipment_consumables) AS total_links, (SELECT COUNT(*) FROM public.catalog_equipment_consumables ec INNER JOIN public.catalog_consumables c ON c.id = ec.consumable_id) AS join_consumables, (SELECT COUNT(*) FROM public.catalog_equipment_consumables ec INNER JOIN public.equipment_models em ON em.id = ec.equipment_id) AS join_equipment, (SELECT COUNT(*) FROM public.catalog_equipment_consumables ec INNER JOIN public.catalog_consumables c ON c.id = ec.consumable_id INNER JOIN public.equipment_models em ON em.id = ec.equipment_id) AS join_both"],
    ["cec_distinct_equipment", "SELECT equipment_id, COUNT(*)::int AS total FROM public.catalog_equipment_consumables GROUP BY equipment_id ORDER BY total DESC, equipment_id ASC LIMIT 20"],
    ["cec_distinct_consumables", "SELECT consumable_id, COUNT(*)::int AS total FROM public.catalog_equipment_consumables GROUP BY consumable_id ORDER BY total DESC, consumable_id ASC LIMIT 20"]
  ];
  for (const [label, sql] of queries) {
    const { rows } = await client.query(sql);
    console.log(`__${label}__`);
    console.log(JSON.stringify(rows, null, 2));
  }
  await client.end();
})().catch(async (err) => { console.error(err); process.exit(1); });
