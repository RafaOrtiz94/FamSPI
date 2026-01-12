const { Client } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'FamSPI',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'FamDb',
});

async function createTestPendingUser() {
  try {
    await client.connect();
    console.log('✅ Conectado a la base de datos');

    // Crear usuario de prueba con rol 'pendiente' (o actualizar uno existente)
    const result = await client.query(`
      UPDATE users
      SET role = 'pendiente',
          lopdp_internal_status = 'ungranted',
          updated_at = NOW()
      WHERE email = 'emily.sevilla@famproject.com.ec'
      RETURNING id, email, fullname, role, lopdp_internal_status;
    `);

    if (result.rows.length > 0) {
      console.log('✅ Usuario actualizado para prueba:', result.rows[0]);
    } else {
      console.log('❌ No se encontró el usuario para actualizar');
    }

    // Verificar el cambio
    const verify = await client.query(`
      SELECT id, email, fullname, role, lopdp_internal_status
      FROM users
      WHERE role = 'pendiente'
      LIMIT 5;
    `);

    console.log('🔍 Usuarios con rol pendiente:', verify.rows);

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

createTestPendingUser();