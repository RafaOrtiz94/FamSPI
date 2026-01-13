const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'FamDb',
  database: 'FamSPI'
});

async function checkEnumAndRelations() {
  try {
    console.log('=== ENUM STATUS ACTUAL ===');
    const enumResult = await pool.query(`
      select t.typname, e.enumlabel
      from pg_type t join pg_enum e on t.oid=e.enumtypid
      where t.typname ilike '%private%purchase%status%'
      order by 1, e.enumsortorder
    `);
    console.log('Enum results:', enumResult.rows);

    if (enumResult.rows.length === 0) {
      console.log('No enum found, checking column type:');
      const colResult = await pool.query(`
        select column_name, udt_name, data_type
        from information_schema.columns
        where table_name='private_purchase_requests'
        and column_name='status'
      `);
      console.log('Column type:', colResult.rows);
    }

    console.log('\n=== RELACIONES CLIENTE/CONSENTS ===');
    const relations = await pool.query(`
      select
        tc.table_name,
        kcu.column_name,
        ccu.table_name as foreign_table_name,
        ccu.column_name as foreign_column_name
      from information_schema.table_constraints as tc
      join information_schema.key_column_usage as kcu
        on tc.constraint_name = kcu.constraint_name
        and tc.table_schema = kcu.table_schema
      join information_schema.constraint_column_usage as ccu
        on ccu.constraint_name = tc.constraint_name
        and ccu.table_schema = tc.table_schema
      where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_name in ('private_purchase_requests', 'client_request_consents', 'user_lopdp_consents')
    `);
    console.log('Relations:', relations.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkEnumAndRelations();