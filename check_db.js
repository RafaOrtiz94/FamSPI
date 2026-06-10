const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_W12CVSvHJEsA@ep-wispy-moon-aqszgsal-pooler.c-8.us-east-1.aws.neon.tech/FamSPI?sslmode=require&channel_binding=require';

const client = new Client({ connectionString });

async function checkViaticos() {
  try {
    await client.connect();
    console.log('✓ Conectado a la BD\n');

    // 1. Verificar roles de usuarios
    console.log('=== USUARIOS Y ROLES ===');
    const users = await client.query(`
      SELECT id, email, "fullname", role, scope, department
      FROM public.users
      WHERE email IN ('rafael.ortiz@fam-project.com', 'administrador@fam-project.com')
      ORDER BY id
    `);
    console.log(users.rows);

    // 2. Verificar módulos habilitados para cada usuario
    console.log('\n=== MODULOS HABILITADOS POR USUARIO ===');
    for (const user of users.rows) {
      console.log(`\nUsuario: ${user.email} (ID: ${user.id}, Rol: ${user.role})`);
      const modules = await client.query(`
        SELECT module_key, is_enabled, updated_at
        FROM public.user_module_access
        WHERE user_id = $1
        ORDER BY module_key
      `, [user.id]);
      if (modules.rows.length === 0) {
        console.log('  - No tiene módulos registrados');
      } else {
        modules.rows.forEach(m => {
          console.log(`  - ${m.module_key}: ${m.is_enabled ? '✓' : '✗'}`);
        });
      }
    }

    // 3. Verificar si finanzas_viaticos existe en el catálogo
    console.log('\n=== CATALOGO DE MODULOS ===');
    const catalog = await client.query(`
      SELECT module_key, label
      FROM public.modules
      WHERE module_key = 'finanzas_viaticos'
      LIMIT 1
    `);
    if (catalog.rows.length === 0) {
      console.log('⚠ No existe tabla "modules" o "finanzas_viaticos" no está en el catálogo');
    } else {
      console.log(catalog.rows);
    }

    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkViaticos();
