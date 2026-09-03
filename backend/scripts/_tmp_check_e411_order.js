process.env.DB_HOST = "ep-lucky-bar-aw5wr0cn.c-12.us-east-1.aws.neon.tech";
process.env.DB_USER = "neondb_owner";
process.env.DB_PASSWORD = "npg_rExYDGS14fPO";
process.env.DB_NAME = "neondb";
process.env.DB_SSL = "true";
const db = require("../src/config/db");
(async () => {
  const { rows } = await db.query(
    `SELECT bci.business_case_id, bci.equipment_id, bci.equipment_name, count(*)
       FROM bc_consumption_items bci
       JOIN servicio.equipos e ON e.id_equipo = bci.equipment_id
      WHERE lower(e.nombre) LIKE '%e411%'
      GROUP BY bci.business_case_id, bci.equipment_id, bci.equipment_name
      ORDER BY count(*) DESC
      LIMIT 10`
  );
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
