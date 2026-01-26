// check_user_role.js - Verificar rol del usuario administrador
const db = require('./src/config/db');

async function checkUserRole() {
  console.log('🔍 Verificando rol del usuario administrador@famproject.com.ec');

  try {
    const result = await db.query(
      'SELECT id, email, role, active FROM users WHERE email = $1',
      ['administrador@famproject.com.ec']
    );

    if (result.rows.length === 0) {
      console.log('❌ Usuario no encontrado');
      return;
    }

    const user = result.rows[0];
    console.log('👤 Usuario encontrado:', {
      id: user.id,
      email: user.email,
      role: user.role,
      active: user.active
    });

    // Verificar si tiene rol de asesor comercial (comercial)
    const hasAsesorComercial = user.role && user.role.includes('comercial');
    console.log('🎯 Tiene rol comercial:', hasAsesorComercial);

    if (!hasAsesorComercial) {
      console.log('⚠️  El usuario NO tiene permisos para crear solicitudes privadas');
      console.log('💡 Solución: Actualizar rol del usuario');
    } else {
      console.log('✅ El usuario SÍ tiene permisos para crear solicitudes privadas');
    }

  } catch (error) {
    console.error('❌ Error consultando usuario:', error);
  } finally {
    process.exit(0);
  }
}

checkUserRole();
