process.env.DB_HOST = "ep-lucky-bar-aw5wr0cn.c-12.us-east-1.aws.neon.tech";
process.env.DB_USER = "neondb_owner";
process.env.DB_PASSWORD = "npg_rExYDGS14fPO";
process.env.DB_NAME = "neondb";
process.env.DB_SSL = "true";
const db = require("../src/config/db");
const svc = require("../src/modules/business-case/businessCaseOffer.service");
(async () => {
  const { rows } = await db.query(
    `SELECT item_key, item_id, name, item_type, annual_qty, reference_qty, equipment_id, equipment_name
       FROM bc_consumption_items WHERE business_case_id=$1 AND equipment_id=12`,
    ["644460fa-206e-432f-800d-e32ae873ce24"]
  );
  const items = rows.map(r => ({
    item_key: r.item_key, item_id: r.item_id, name: r.name, item_type: String(r.item_type||"").toLowerCase(),
    annual_qty: r.annual_qty===null?null:Number(r.annual_qty), reference_qty: r.reference_qty===null?null:Number(r.reference_qty),
    equipment_id: Number(r.equipment_id), equipment_name: r.equipment_name,
  }));
  const ordered = svc.__testables.orderOfferItemsByBusinessCaseTemplate(items);
  console.log("RESULT-first5|" + JSON.stringify(ordered.slice(0,5).map(i=>i.item_id+"|"+i.name)));
  console.log("RESULT-last5|" + JSON.stringify(ordered.slice(-5).map(i=>i.item_id+"|"+i.name)));
  console.log("RESULT-total|" + ordered.length);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
