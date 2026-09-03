const { Client } = require('pg');
const client = new Client({
  host: 'ep-wispy-moon-aqszgsal-pooler.c-8.us-east-1.aws.neon.tech',
  port: 5432,
  user: 'neondb_owner',
  password: process.env.DB_PASSWORD,
  database: 'FamSPI',
  ssl: { rejectUnauthorized: false }
});
(async () => {
  await client.connect();
  const r = await client.query("SELECT id, email, name, role FROM users WHERE role IN ('jefe_operaciones', 'jefe_logistica', 'asesor_comercial', 'comercial') ORDER BY role, name");
  console.log(r.rows.map(x => x.id + '|' + x.email + '|' + x.role + '|' + x.name).join('\n'));
  await client.end();
})().catch(function(e) { console.error(e.message); process.exit(1); });
