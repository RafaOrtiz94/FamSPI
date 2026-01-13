const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'FamDb',
  database: 'FamSPI'
});

async function checkBaseline() {
  try {
    console.log('=== PASO 1.1 - CONFIRMAR ENUM ===');
    const enumResult = await pool.query(`
      select t.typname, e.enumlabel
      from pg_type t join pg_enum e on t.oid=e.enumtypid
      where t.typname='private_purchase_status_enum'
      order by e.enumsortorder
    `);
    console.log('Estados del enum:', enumResult.rows.map(r => r.enumlabel));

    console.log('\n=== PASO 1.2 - CONFIRMAR TABLA SCHEDULES ===');
    const tableResult = await pool.query(`
      select table_name from information_schema.tables
      where table_schema='public' and table_name in ('purchase_delivery_schedules')
    `);
    console.log('Tabla existe:', tableResult.rows.length > 0 ? 'SÍ' : 'NO');

    console.log('\n=== PASO 1.3 - CAMPOS DE APROBACIÓN EN CLIENT_REQUESTS ===');
    const clientColumns = await pool.query(`
      select column_name, data_type, is_nullable
      from information_schema.columns
      where table_name='client_requests'
      and table_schema='public'
      order by ordinal_position
    `);
    console.log('Campos client_requests:', clientColumns.rows);

    console.log('\n=== PASO 1.4 - CONSENTS LOPDP ===');
    const consentsTables = await pool.query(`
      select table_name from information_schema.tables
      where table_schema='public' and table_name in ('user_lopdp_consents','client_request_consents')
    `);
    console.log('Tablas de consents:', consentsTables.rows.map(r => r.table_name));

    // Campos de user_lopdp_consents
    if (consentsTables.rows.some(r => r.table_name === 'user_lopdp_consents')) {
      const userConsents = await pool.query(`
        select column_name, data_type, is_nullable
        from information_schema.columns
        where table_name='user_lopdp_consents'
        and table_schema='public'
        order by ordinal_position
      `);
      console.log('Campos user_lopdp_consents:', userConsents.rows);
    }

    // Campos de client_request_consents
    if (consentsTables.rows.some(r => r.table_name === 'client_request_consents')) {
      const clientConsents = await pool.query(`
        select column_name, data_type, is_nullable
        from information_schema.columns
        where table_name='client_request_consents'
        and table_schema='public'
        order by ordinal_position
      `);
      console.log('Campos client_request_consents:', clientConsents.rows);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkBaseline();