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
    ["equipment_columns", "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='equipment_models' ORDER BY ordinal_position"],
    ["sample_equipment", "SELECT id, COALESCE(name, model, description, code::text, id::text) AS label, COALESCE(category,'<null>') AS category FROM public.equipment_models ORDER BY id DESC LIMIT 20"],
    ["category_keywords", "SELECT COUNT(*)::int FILTER (WHERE lower(COALESCE(category,'')) LIKE '%chem%') AS chemistry, COUNT(*)::int FILTER (WHERE lower(COALESCE(category,'')) LIKE '%immun%') AS immunology, COUNT(*)::int FILTER (WHERE lower(COALESCE(category,'')) LIKE '%hemat%') AS hematology, COUNT(*)::int FILTER (WHERE lower(COALESCE(category,'')) LIKE '%bgm%' OR lower(COALESCE(category,'')) LIKE '%gaso%' OR lower(COALESCE(category,'')) LIKE '%gasometr%') AS gasometria FROM public.equipment_models"],
    ["consumable_types", "SELECT COALESCE(type,'<null>') AS type, COUNT(*)::int AS total FROM public.catalog_consumables GROUP BY 1 ORDER BY total DESC, type ASC"],
    ["sample_links", "SELECT ec.equipment_id, COALESCE(em.name, em.model, em.description, em.id::text) AS equipment_label, COALESCE(em.category,'<null>') AS category, c.id AS consumable_id, c.name AS consumable_name, c.type AS consumable_type FROM public.catalog_equipment_consumables ec INNER JOIN public.catalog_consumables c ON c.id = ec.consumable_id INNER JOIN public.equipment_models em ON em.id = ec.equipment_id ORDER BY ec.equipment_id DESC, c.name ASC LIMIT 30"],
    ["advisors", "SELECT id, COALESCE(fullname,name,email) AS display_name, email, role, active FROM public.users WHERE lower(COALESCE(role,'')) IN ('comercial','asesor_comercial','analista_comercial') ORDER BY active DESC, display_name ASC LIMIT 50"]
  ];
  for (const [label, sql] of queries) {
    const { rows } = await client.query(sql);
    console.log(`__${label}__`);
    console.log(JSON.stringify(rows, null, 2));
  }
  await client.end();
})().catch(async (err) => { console.error(err); process.exit(1); });
