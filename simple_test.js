const axios = require('axios');

// Prueba simple de conectividad
async function simpleTest() {
  try {
    console.log('🔗 Probando conexión básica al backend...');

    const response = await axios.get('http://localhost:3000/health', {
      timeout: 5000
    });

    console.log('✅ Backend responde correctamente!');
    console.log('📊 Respuesta:', response.data);

    // Probar endpoint de verificación pública (sin token)
    console.log('\n🔍 Probando verificación pública...');
    try {
      const verifyResponse = await axios.get('http://localhost:3000/api/signature/verificar/test-token', {
        timeout: 5000
      });
      console.log('✅ Endpoint de verificación funciona!');
    } catch (verifyError) {
      if (verifyError.response?.status === 404) {
        console.log('ℹ️  Token de prueba no encontrado (esperado)');
      } else {
        console.log('⚠️  Endpoint de verificación responde con error:', verifyError.response?.status);
      }
    }

    console.log('\n🎉 ¡Sistema operativo! El backend está funcionando correctamente.');

  } catch (error) {
    console.error('❌ Error conectando al backend:', error.message);
    console.log('\n🔧 Verifica:');
    console.log('   • Backend ejecutándose en puerto 3000');
    console.log('   • Conexión de red disponible');
    console.log('   • Sin conflictos de puerto');
  }
}

simpleTest();
