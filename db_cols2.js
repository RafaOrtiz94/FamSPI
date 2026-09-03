const { Client } = require('pg');
const tables = ['catalog_consumables', 'catalog_equipment_consumables', 'delivery_request', 'delivery_request_line', 'delivery_dispatch', 'delivery_dispatch_line', 'delivery_ceiling', 'delivery_ceiling_line', 'inventory', 'inventory_movements', 'equipment_models'];
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
  for (const t of tables) {
    try {
      const r = await client.query('SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = ' + t + ' ORDER BY ordinal_position');
      console.log('--- ' + t + ' ---');
      console.log(r.rows.map(function(x) { return x.column_name + '(' + x.data_type + ')'; }).join(', '));
    } catch (e) {
      console.log('--- ' + t + ' --- ERROR: ' + e.message);
    }
  }
  await client.end();
})().catch(function(e) { console.error(e.message); process.exit(1); });
