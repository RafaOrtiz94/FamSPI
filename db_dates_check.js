const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'FamSPI',
  user: 'postgres',
  password: 'FamDb',
});

async function runQueries() {
  try {
    await client.connect();
    console.log('✅ Conectado a la base de datos FamSPI\n');

    // Listar columnas de tipo fecha/hora
    console.log('=== COLUMNAS DE TIPO FECHA/HORA ===');
    const dateColumnsQuery = await client.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND data_type IN ('date', 'timestamp without time zone', 'timestamp with time zone', 'time', 'time without time zone', 'time with time zone')
      ORDER BY table_name, column_name;
    `);

    console.table(dateColumnsQuery.rows);

    // Obtener ejemplos de valores para tablas relevantes
    const relevantTables = ['requests', 'clients', 'bc_master', 'equipment_purchases', 'business_case'];
    console.log('\n=== EJEMPLOS DE VALORES REALES ===');

    for (const table of relevantTables) {
      const columns = dateColumnsQuery.rows.filter(r => r.table_name === table);
      if (columns.length === 0) continue;

      console.log(`\n📊 Tabla: ${table}`);
      try {
        const exampleQuery = await client.query(`
          SELECT ${columns.map(c => c.column_name).join(', ')}
          FROM ${table}
          ORDER BY id DESC
          LIMIT 5;
        `);
        console.table(exampleQuery.rows);
      } catch (err) {
        console.log(`❌ Error obteniendo ejemplos: ${err.message}`);
      }
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

runQueries();