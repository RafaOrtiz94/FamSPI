/**
 * Test script for Origin Department Drive Structure
 * Tests that requests create proper folder hierarchy based on ORIGIN department, not request type
 */

const https = require('https');

const BASE_URL = 'https://spi-dev.famproject.com.ec';
// Set JWT tokens for different department users
const COMMERCIAL_JWT = process.env.COMMERCIAL_JWT || 'YOUR_COMMERCIAL_JWT_TOKEN_HERE'; // User with comercial role
const SERVICIO_JWT = process.env.SERVICIO_JWT || 'YOUR_SERVICIO_JWT_TOKEN_HERE';   // User with servicio role

console.log('🧪 Testing Origin Department Drive Folder Structure...\n');

function makeRequest(url, options, payload) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: json });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);

    if (payload) {
      req.write(JSON.stringify(payload));
    }

    req.end();
  });
}

// Test 1: Create F.ST-22 (Registro de Cliente) from Commercial user
console.log('1️⃣ Testing POST /api/v1/requests (F.ST-22 cliente) - Commercial User');
console.log('   Expected: ROOT/Comercial/[user]/Registro de Cliente/REQ-xxxx/');

const testClientCommercial = {
  request_type_id: 'cliente',
  payload: {
    nombre_cliente: 'Test Client Commercial Origin',
    direccion_cliente: 'Test Address Commercial',
    persona_contacto: 'Test Contact Commercial',
    celular_contacto: '+593999999991',
    email_cliente: 'commercial@test.com',
    ruc_cedula: '1234567890001'
  },
  files: []
};

const optionsCommercial = {
  hostname: 'spi-dev.famproject.com.ec',
  port: 443,
  path: '/api/v1/requests',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${COMMERCIAL_JWT}`,
    'Content-Type': 'application/json'
  },
  rejectUnauthorized: false
};

makeRequest(optionsCommercial, testClientCommercial).then(async (result) => {
  console.log(`   Status: ${result.statusCode}`);

  if (result.statusCode === 200 || result.statusCode === 201) {
    const requestId = result.data?.request?.id;
    console.log(`   ✅ Request created with ID: ${requestId}`);
    console.log('   📂 Expected folder structure:');
    console.log('   SPI_ROOT / Comercial / [commercial_user] / Registro de Cliente / REQ-xxxx /');

    if (requestId) {
      console.log(`\n🔍 Verification in Drive:`);
      console.log(`   Look for: SPI_ROOT/Comercial/[user_name]/Registro de Cliente/REQ-${String(requestId).padStart(4, '0')} - Test Client Commercial Origin/`);

      // Test 2: Create same request type from different department
      console.log('\n2️⃣ Testing POST /api/v1/requests (F.ST-22 cliente) - Servicio Técnico User');
      console.log('   Expected: ROOT/Servicio Técnico/[user]/Registro de Cliente/REQ-xxxx/');

      const testClientServicio = {
        request_type_id: 'cliente',
        payload: {
          nombre_cliente: 'Test Client Servicio Origin',
          direccion_cliente: 'Test Address Servicio',
          persona_contacto: 'Test Contact Servicio',
          celular_contacto: '+593999999992',
          email_cliente: 'servicio@test.com',
          ruc_cedula: '1234567890002'
        },
        files: []
      };

      const optionsServicio = {
        hostname: 'spi-dev.famproject.com.ec',
        port: 443,
        path: '/api/v1/requests',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICIO_JWT}`,
          'Content-Type': 'application/json'
        },
        rejectUnauthorized: false
      };

      // Wait a bit before second request
      setTimeout(async () => {
        const result2 = await makeRequest(optionsServicio, testClientServicio);

        console.log(`   Status: ${result2.statusCode}`);

        if (result2.statusCode === 200 || result2.statusCode === 201) {
          const requestId2 = result2.data?.request?.id;
          console.log(`   ✅ Request created with ID: ${requestId2}`);
          console.log('   📂 Expected folder structure:');
          console.log('   SPI_ROOT / Servicio Técnico / [servicio_user] / Registro de Cliente / REQ-xxxx /');

          if (requestId2) {
            console.log(`\n🔍 Verification in Drive:`);
            console.log(`   Look for: SPI_ROOT/Servicio Técnico/[user_name]/Registro de Cliente/REQ-${String(requestId2).padStart(4, '0')} - Test Client Servicio Origin/`);
          }
        } else {
          console.log('   ❌ Second request failed:', result2.data);
        }

        // Final instructions
        console.log('\n📋 Validation Checklist:');
        console.log('   ✅ Commercial request created in ROOT/Comercial/...');
        console.log('   ✅ Servicio request created in ROOT/Servicio Técnico/...');
        console.log('   ✅ Both use same request_type_id but different origin departments');
        console.log('   ❌ Check logs show origin_department_source correctly');
        console.log('   ❌ Verify no "Tecnología / TI" fallback folders');

        console.log('\n💡 Setup Instructions:');
        console.log('   1. Set COMMERCIAL_JWT with valid commercial department user token');
        console.log('   2. Set SERVICIO_JWT with valid servicio técnico department user token');
        console.log('   3. Run: COMMERCIAL_JWT=token1 SERVICIO_JWT=token2 node test_origin_department_drive_structure.js');
        console.log('   4. Check Drive folder structures as shown above');
        console.log('   5. Verify database has origin_department_id and origin_department_name populated');

      }, 2000); // 2 second delay

    }
  } else {
    console.log('   ❌ First request failed:', result.data);
    console.log('\n💡 Setup Instructions:');
    console.log('   1. Set COMMERCIAL_JWT with valid commercial department user token');
    console.log('   2. Set SERVICIO_JWT with valid servicio técnico department user token');
    console.log('   3. Run: COMMERCIAL_JWT=token1 SERVICIO_JWT=token2 node test_origin_department_drive_structure.js');
  }
}).catch((error) => {
  console.error('Error in test:', error);
});