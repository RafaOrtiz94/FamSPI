const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await client.connect();
  const res = await client.query(
    "SELECT table_name, column_name FROM information_schema.columns WHERE table_name IN ('applicant_pipeline_entries','applicant_stage_results','hiring_salary_proposals') ORDER BY table_name, ordinal_position"
  );
  const tables = {};
  res.rows.forEach(r => {
    if (!tables[r.table_name]) tables[r.table_name] = [];
    tables[r.table_name].push(r.column_name);
  });
  Object.entries(tables).forEach(([t, cols]) => console.log(`\n${t}:\n  ${cols.join(', ')}`));
  await client.end();
})().catch(e => { console.error(e.message); process.exit(1); });
