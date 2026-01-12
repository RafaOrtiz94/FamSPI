#!/usr/bin/env node

/**
 * Test script for request creation fix
 * Tests the nested payload structure handling
 */

const https = require('https');

const BASE_URL = 'https://spi-dev.famproject.com.ec';
const JWT_TOKEN = process.env.JWT_TOKEN || 'YOUR_JWT_TOKEN_HERE'; // Set this in environment

console.log('🧪 Testing Request Creation Fix...\n');

// Test: POST /api/v1/requests with nested payload structure
console.log('1️⃣ Testing POST /api/v1/requests with nested payload');
const testRequest = {
  request_type_id: 'inspection',
  payload: {
    nombre_cliente: 'Test Client',
    direccion_cliente: 'Test Address',
    persona_contacto: 'Test Contact',
    celular_contacto: '+593999999999',
    fecha_instalacion: '2026-01-15',
    anotaciones: 'Test request from diagnostic script'
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
      console.log(`   Response: ${JSON.stringify(json, null, 2)}\n`);

      if (res.statusCode === 200 || res.statusCode === 201) {
        console.log('✅ SUCCESS: Request created successfully!');
        console.log('   - No more AJV validation errors');
        console.log('   - Nested payload structure handled correctly');
        console.log('   - Required fields (nombre_cliente, etc.) preserved');
      } else if (res.statusCode === 400) {
        console.log('❌ FAILED: Still getting validation errors');
        if (json.message && json.message.includes('AJV')) {
          console.log('   - AJV validation still failing');
          console.log('   - Check that nested payload extraction is working');
        }
      } else if (res.statusCode === 403) {
        console.log('❌ FAILED: Authorization issue (check JWT token/role)');
      } else {
        console.log(`❌ FAILED: Unexpected status ${res.statusCode}`);
      }
    } catch (e) {
      console.log(`   Raw Response: ${data}\n`);
      console.log('❌ FAILED: Could not parse JSON response');
    }

    console.log('\n📋 Expected Results:');
    console.log('   - Status: 200/201 (not 400)');
    console.log('   - No AJV validation errors');
    console.log('   - Request should be created with nested payload data');
    console.log('\n💡 If still failing, check backend logs for detailed AJV errors');
  });
});

req.on('error', (err) => {
  console.error(`   Error: ${err.message}\n`);
});

req.write(JSON.stringify(testRequest));
req.end();

// Instructions
console.log('📝 Instructions:');
console.log('   1. Set JWT_TOKEN environment variable with a valid commercial role token');
console.log('   2. Run: JWT_TOKEN=your_token_here node test_request_creation.js');
console.log('   3. Should see 200/201 status with successful request creation\n');