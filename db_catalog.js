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
  const r = await client.query('SELECT id, name, type, units_per_kit, unit_price, status FROM catalog_consumables LIMIT 10');
  console.log(r.rows.map(x => x.id + '|' + x.name + '|' + x.type + '|' + x.units_per_kit + '|' + x.unit_price + '|' + x.status).join('\n'));
  await client.end();
})().catch(function(e) { console.error(e.message); process.exit(1); });
