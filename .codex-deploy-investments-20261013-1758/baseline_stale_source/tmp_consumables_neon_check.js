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
    ["equipment_categories", "SELECT COALESCE(category,'<null>') AS category, COUNT(*)::int AS total FROM public.equipment_models GROUP BY 1 ORDER BY total DESC, category ASC LIMIT 30"],
    ["linked_consumables", "SELECT COUNT(*)::int AS total FROM public.catalog_equipment_consumables"],
    ["sample_equipment", "SELECT id, COALESCE(name, model, equipment_name, description, 'sin_nombre') AS label, COALESCE(category,'<null>') AS category FROM public.equipment_models ORDER BY id DESC LIMIT 20"],
    ["consumable_type_breakdown", "SELECT COALESCE(type,'<null>') AS type, COUNT(*)::int AS total FROM public.catalog_consumables GROUP BY 1 ORDER BY total DESC, type ASC"],
    ["category_keywords", "SELECT COUNT(*)::int FILTER (WHERE lower(COALESCE(category,'')) LIKE '%quim%') AS quimica, COUNT(*)::int FILTER (WHERE lower(COALESCE(category,'')) LIKE '%inmun%') AS inmunologia, COUNT(*)::int FILTER (WHERE lower(COALESCE(category,'')) LIKE '%hemat%') AS hematologia, COUNT(*)::int FILTER (WHERE lower(COALESCE(category,'')) LIKE '%gaso%' OR lower(COALESCE(category,'')) LIKE '%gasometr%') AS gasometria FROM public.equipment_models"],
    ["advisors", "SELECT id, COALESCE(fullname,name,email) AS display_name, email, role, active FROM public.users WHERE lower(COALESCE(role,'')) IN ('comercial','asesor_comercial','analista_comercial') ORDER BY active DESC, display_name ASC LIMIT 50"]
  ];
  for (const [label, sql] of queries) {
    const { rows } = await client.query(sql);
    console.log(`__${label}__`);
    console.log(JSON.stringify(rows, null, 2));
  }
  await client.end();
})().catch(async (err) => { console.error(err); process.exit(1); });
