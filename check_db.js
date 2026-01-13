const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'FamDb',
  database: 'FamSPI'
});

async function checkDB() {
  try {
    await client.connect();
    console.log('Conectado a BD FamSPI');

    // Listar tablas
    const res = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('Tablas relacionadas con compras públicas/privadas:');
    res.rows.forEach(row => {
      const name = row.table_name;
      if (name.includes('purchase') || name.includes('request') || name.includes('equipment') || name.includes('private') || name.includes('public')) {
        console.log(`- ${name}`);
      }
    });

    // Ver keys de private_purchase_requests si existe
    const privateRes = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'private_purchase_requests'
      ORDER BY ordinal_position
    `);

    if (privateRes.rows.length > 0) {
      console.log('\nColumnas de private_purchase_requests:');
      privateRes.rows.forEach(col => {
        console.log(`- ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
      });
    }

    // Ver equipment_purchases
    const equipRes = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'equipment_purchases'
      ORDER BY ordinal_position
    `);

    if (equipRes.rows.length > 0) {
      console.log('\nColumnas de equipment_purchases:');
      equipRes.rows.forEach(col => {
        console.log(`- ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
      });
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkDB();