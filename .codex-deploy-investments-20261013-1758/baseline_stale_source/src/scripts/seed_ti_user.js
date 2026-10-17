#!/usr/bin/env node

/**
 * SEED TI USER: Create a TI user for Security Center testing (SANDBOX ONLY)
 * Uses the SAME DB config as the backend application
 */

const db = require('../config/db');
const logger = require('../config/logger');

async function seedTIUser() {
  try {
    console.log('🌱 SEED TI USER: Creating TI user for Security Center testing\n');
    console.log('⏰ Timestamp:', new Date().toISOString(), '\n');

    // 1. List current users to choose a candidate
    console.log('1) Usuarios actuales (elige uno para convertir a TI):');
    const usersQuery = await db.query('SELECT id, email, fullname, role FROM users ORDER BY id LIMIT 10;');
    console.table(usersQuery.rows);

    if (usersQuery.rows.length === 0) {
      console.log('❌ No hay usuarios registrados. No se puede crear usuario TI.');
      return;
    }

    // Choose the first user as candidate (in real scenario, user would specify)
    const candidateUser = usersQuery.rows[0];
    console.log(`\n2) Candidato seleccionado: ${candidateUser.email} (ID: ${candidateUser.id})`);

    // 3. Update role to 'ti'
    console.log('\n3) Actualizando role a TI...');
    const updateQuery = await db.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, fullname, role;',
      ['ti', candidateUser.id]
    );

    if (updateQuery.rows.length > 0) {
      console.log('✅ Usuario actualizado exitosamente:');
      console.table(updateQuery.rows);

      // 4. Verify the change
      console.log('\n4) Verificación final:');
      const verifyQuery = await db.query('SELECT id, email, fullname, role FROM users WHERE id = $1;', [candidateUser.id]);
      console.table(verifyQuery.rows);

      console.log('\n✅ SEED COMPLETADO - Usuario TI creado para testing del Security Center');
      console.log('⚠️  IMPORTANTE: Esto es solo para SANDBOX. NO ejecutar en producción.');
    } else {
      console.log('❌ No se pudo actualizar el usuario');
    }

  } catch (err) {
    console.error('❌ SEED ERROR:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

// Run the seed
seedTIUser().then(() => {
  console.log('\n🏁 Seed execution finished');
  process.exit(0);
}).catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});