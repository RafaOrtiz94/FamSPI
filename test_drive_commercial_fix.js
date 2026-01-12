#!/usr/bin/env node

/**
 * Test script for Commercial Drive folder structure fix
 * Tests that requests from Commercial module create proper folder hierarchy
 */

const https = require('https');

const BASE_URL = 'https://spi-dev.famproject.com.ec';
const JWT_TOKEN = process.env.JWT_TOKEN || 'YOUR_JWT_TOKEN_HERE'; // Set this in environment

console.log('🧪 Testing Commercial Drive Folder Structure Fix...\n');

// Test: POST /api/v1/requests with inspection type from commercial user
console.log('1️⃣ Testing POST /api/v1/requests (F.ST-20 inspection) - Commercial User');
const testRequest = {
  request_type_id: 'inspection',
  payload: {
    nombre_cliente: 'Test Client Drive',
    direccion_cliente: 'Test Address Drive',
    persona_contacto: 'Test Contact Drive',
    celular_contacto: '+593999999999',
    fecha_instalacion: '2026-01-15',
    anotaciones: 'Test request for Drive folder structure verification'
  },
  files: []
};

const options = {
  hostname: 'spi-dev.famproject.com.ec',
  port: 443,
  path: '/api/v1/requests',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${JWT_TOKEN}`,
    'Content-Type': 'application/json'
  },
  rejectUnauthorized: false
};

const req = https.request(options, (res) => {
  console.log(`   Status: ${res.statusCode}`);

  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log(`   Response:`, JSON.stringify(json, null, 2));

      if (res.statusCode === 200 || res.statusCode === 201) {
        console.log('\n✅ SUCCESS: Request created successfully!');
        console.log('   - Should have created folder structure:');
        console.log('   - <ROOT> / Comercial / <user> / Inspección de Ambiente / REQ-xxxxx / (docs)');

        const requestId = json.request?.id;
        if (requestId) {
          console.log(`\n📂 To verify in Drive:`);
          console.log(`   1. Go to spi-dev.famproject.com.ec Drive`);
          console.log(`   2. Look for folder: SPI_ROOT / Comercial / [user_name] / Inspección de Ambiente / REQ-${String(requestId).padStart(4, '0')} /`);
          console.log(`   3. Should contain: F.ST-20-REQ-${String(requestId).padStart(4, '0')}.pdf`);

          console.log(`\n🔍 Expected folder structure:`);
          console.log(`   📁 SPI_ROOT (main Drive root)`);
          console.log(`   ├── 📁 Comercial`);
          console.log(`   │   ├── 📁 [user_display_name or email prefix]`);
          console.log(`   │   │   ├── 📁 Inspección de Ambiente`);
          console.log(`   │   │   │   ├── 📁 REQ-${String(requestId).padStart(4, '0')} (client_name)`);
          console.log(`   │   │   │   │   ├── 📄 F.ST-20-REQ-${String(requestId).padStart(4, '0')}.pdf`);
          console.log(`   │   │   │   │   └── 📄 (other documents)`);
        }

        console.log('\n📋 Verification checklist:');
        console.log('   ✅ "Comercial" folder exists at root level');
        console.log('   ✅ User folder exists within "Comercial"');
        console.log('   ✅ "Inspección de Ambiente" folder exists within user folder');
        console.log('   ✅ REQ-xxxx folder exists with client name');
        console.log('   ✅ PDF document generated in REQ-xxxx folder');
        console.log('   ❌ NO "Tecnología / TI" folder should be used');

      } else if (res.statusCode === 400) {
        console.log('\n❌ FAILED: Validation error - check AJV schema');
        if (json.message && json.message.includes('AJV')) {
          console.log('   - AJV validation failed - may need nested payload fix');
        }
      } else if (res.statusCode === 403) {
        console.log('\n❌ FAILED: Authorization issue');
        console.log('   - Check JWT token has "comercial" role');
        console.log('   - User must have commercial permissions');
      } else if (res.statusCode === 401) {
        console.log('\n❌ FAILED: Authentication issue');
        console.log('   - Set JWT_TOKEN environment variable');
        console.log('   - Token must be valid and not expired');
      } else {
        console.log(`\n❌ FAILED: Unexpected status ${res.statusCode}`);
      }
    } catch (e) {
      console.log(`   Raw Response: ${data}`);
      console.log('\n❌ FAILED: Could not parse JSON response');
    }

    console.log('\n💡 Instructions:');
    console.log('   1. Set JWT_TOKEN with valid commercial user token');
    console.log('   2. Run: JWT_TOKEN=your_token node test_drive_commercial_fix.js');
    console.log('   3. Check Drive folder structure as shown above');
    console.log('   4. Verify NO documents went to "Tecnología / TI"');
  });
});

req.on('error', (err) => {
  console.error(`   Error: ${err.message}`);
});

req.write(JSON.stringify(testRequest));
req.end();

// Test 2: Also test F.ST-21 (retiro) to ensure both work
console.log('\n2️⃣ Testing POST /api/v1/requests (F.ST-21 retiro) - Commercial User');
const testRequest2 = {
  request_type_id: 'retiro',
  payload: {
    nombre_cliente: 'Test Client Retiro',
    direccion_cliente: 'Test Address Retiro',
    persona_contacto: 'Test Contact Retiro',
    celular_contacto: '+593999999998',
    fecha_instalacion: '2026-01-16',
    anotaciones: 'Test retiro request for Drive folder verification',
    equipos: [{
      unidad_id: 1,
      serial: 'TEST123',
      estado: 'activo'
    }]
  },
  files: []
};

setTimeout(() => {
  const req2 = https.request(options, (res2) => {
    console.log(`   Status: ${res2.statusCode}`);
    let data2 = '';
    res2.on('data', (chunk) => data2 += chunk);
    res2.on('end', () => {
      try {
        const json2 = JSON.parse(data2);
        console.log(`   Response:`, json2.message || 'Created');

        if (res2.statusCode === 200 || res2.statusCode === 201) {
          const requestId2 = json2.request?.id;
          console.log(`   ✅ F.ST-21 request created - check folder: ... / Retiro de Equipo / REQ-${String(requestId2 || 0).padStart(4, '0')} /`);
        }
      } catch (e) {
        console.log(`   Raw Response: ${data2}`);
      }
    });
  });

  req2.on('error', (err) => {
    console.error(`   Error: ${err.message}`);
  });

  req2.write(JSON.stringify(testRequest2));
  req2.end();
}, 1000);