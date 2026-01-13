const { Client } = require('pg');

(async () => {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'FamDb',
    database: 'FamSPI'
  });

  try {
    await client.connect();
    const nowResult = await client.query('SELECT NOW() AS now');
    console.log('NOW:', nowResult.rows[0]);

    const tablesResult = await client.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_name ILIKE '%private%' OR table_name ILIKE '%purchase%'
      ORDER BY table_schema, table_name;
    `);
    console.log('PRIVATE/PURCHASE TABLES:', tablesResult.rows);
  } catch (error) {
    console.error('DB Error:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
