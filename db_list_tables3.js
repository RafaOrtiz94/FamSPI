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
  const r = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`);
  console.log(r.rows.map(x => x.table_name).join('\n'));
  await client.end();
})().catch(e => { console.error(e.message); process.exit(1); });
