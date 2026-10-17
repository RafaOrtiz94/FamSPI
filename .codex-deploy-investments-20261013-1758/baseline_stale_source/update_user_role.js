// update_user_role.js - Actualizar rol del usuario administrador para incluir asesor_comercial
const db = require('./src/config/db');

async function updateUserRole() {
  console.log('🔧 Actualizando rol del usuario administrador@famproject.com.ec');

  try {
    // Actualizar rol para incluir asesor_comercial
    const result = await db.query(
      'UPDATE users SET role = $1 WHERE email = $2 RETURNING id, email, role',
      [['comercial', 'asesor_comercial'], 'administrador@famproject.com.ec']
    );

    if (result.rows.length === 0) {
      console.log('❌ Usuario no encontrado');
      return;
    }

    const user = result.rows[0];
    console.log('✅ Usuario actualizado:', {
      id: user.id,
      email: user.email,
      role: user.role
    });

    // Verificar si ahora tiene permisos
    const hasAsesorComercial = user.role && user.role.includes('asesor_comercial');
    console.log('🎯 Ahora tiene rol asesor_comercial:', hasAsesorComercial);

    if (hasAsesorComercial) {
      console.log('✅ El usuario ahora SÍ tiene permisos para crear solicitudes privadas');
    } else {
      console.log('❌ Error: El usuario aún no tiene permisos');
    }

  } catch (error) {
    console.error('❌ Error actualizando usuario:', error);
  } finally {
    process.exit(0);
  }
}

updateUserRole();
