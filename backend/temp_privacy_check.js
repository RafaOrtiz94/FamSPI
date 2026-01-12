const { Client } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'FamSPI',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'FamDb',
});

async function runQueries() {
  try {
    await client.connect();
    console.log('✅ Conectado a la base de datos\n');

    console.log('=== TABLAS RELACIONADAS CON LOPDP/PRIVACY ===');
    const privacyTablesQuery = await client.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_name ILIKE '%lopdp%'
         OR table_name ILIKE '%privacy%'
         OR table_name ILIKE '%consent%'
         OR table_name ILIKE '%document%'
         OR table_name ILIKE '%signature%'
         OR table_name ILIKE '%seal%'
      ORDER BY table_schema, table_name;
    `);
    console.table(privacyTablesQuery.rows);

    console.log('\n=== USUARIOS Y ESTADO LOPDP ===');
    const usersLopdpQuery = await client.query(`
      SELECT id, email, fullname, role, lopdp_internal_status, lopdp_internal_signed_at
      FROM users
      ORDER BY id LIMIT 20;
    `);
    console.table(usersLopdpQuery.rows);

    console.log('\n=== USUARIOS SIN ROL (PENDIENTE) ===');
    const usersNoRoleQuery = await client.query(`
      SELECT id, email, fullname, role, department_id, created_at
      FROM users
      WHERE role IS NULL OR role = '' OR role = 'pendiente'
      ORDER BY created_at DESC LIMIT 10;
    `);
    console.table(usersNoRoleQuery.rows);

    console.log('\n=== COLUMNAS DE LA TABLA USERS (LOPDP) ===');
    const usersColsQuery = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
        AND column_name ILIKE '%lopdp%'
      ORDER BY ordinal_position;
    `);
    console.table(usersColsQuery.rows);

    console.log('\n=== VERIFICAR TABLA USER_LOPDP_CONSENTS ===');
    try {
      const consentsQuery = await client.query(`
        SELECT id, user_id, user_email, status, created_at, pdf_file_id, signature_file_id
        FROM user_lopdp_consents
        ORDER BY created_at DESC LIMIT 10;
      `);
      console.table(consentsQuery.rows);
    } catch (e) {
      console.log('Tabla user_lopdp_consents no existe o está vacía');
    }

    console.log('\n=== ROLES EXISTENTES ===');
    const rolesQuery = await client.query(`
      SELECT role, COUNT(*) as total
      FROM users
      GROUP BY role
      ORDER BY total DESC;
    `);
    console.table(rolesQuery.rows);

    console.log('\n=== TABLAS CON DOCUMENTOS/FIRMAS ===');
    const docTablesQuery = await client.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_name ILIKE '%document%'
         OR table_name ILIKE '%signature%'
         OR table_name ILIKE '%sign%'
         OR table_name ILIKE '%file%'
      ORDER BY table_schema, table_name;
    `);
    console.table(docTablesQuery.rows);

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

runQueries();