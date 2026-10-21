process.env.DB_HOST = "ep-lucky-bar-aw5wr0cn.c-12.us-east-1.aws.neon.tech";
process.env.DB_USER = "neondb_owner";
process.env.DB_PASSWORD = "npg_rExYDGS14fPO";
process.env.DB_NAME = "neondb";
process.env.DB_SSL = "true";
const db = require("../src/config/db");
(async () => {
  const { rows } = await db.query(
    `SELECT id, fullname, email, role, active, module_access FROM public.users WHERE lower(email) IN ($1,$2)`,
    ["lorena.loaiza@fam-project.com", "lidida.viracocha@fam-project.com"]
  );
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
