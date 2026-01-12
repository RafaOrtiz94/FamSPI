#!/usr/bin/env node

/**
 * Test script for SPI-DEV fixes
 * Tests both 404 on notifications/unread-count and 403 on POST requests
 */

const https = require('https');
const http = require('http');

const BASE_URL = 'https://spi-dev.famproject.com.ec';
const JWT_TOKEN = process.env.JWT_TOKEN || 'YOUR_JWT_TOKEN_HERE'; // Set this in environment

console.log('🧪 Testing SPI-DEV fixes...\n');

// Test 1: Notifications unread-count endpoint
console.log('1️⃣ Testing GET /api/v1/notifications/unread-count');
const options1 = {
  hostname: 'spi-dev.famproject.com.ec',
  port: 443,
  path: '/api/v1/notifications/unread-count',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${JWT_TOKEN}`,
    'Content-Type': 'application/json'
  },
  rejectUnauthorized: false // For self-signed certs in dev
};

const req1 = https.request(options1, (res) => {
  console.log(`   Status: ${res.statusCode}`);
  console.log(`   Headers:`, {
    'x-backend-instance': res.headers['x-backend-instance'],
    'x-forwarded-by': res.headers['x-forwarded-by']
  });

  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log(`   Response: ${JSON.stringify(json, null, 2)}\n`);
    } catch (e) {
      console.log(`   Raw Response: ${data}\n`);
    }

    // Test 2: POST /api/v1/requests
    console.log('2️⃣ Testing POST /api/v1/requests');
    const testRequest = {
      request_type_id: 'inspection',
      nombre_cliente: 'Test Client',
      direccion_cliente: 'Test Address',
      persona_contacto: 'Test Contact',
      celular_contacto: '+593999999999',
      fecha_instalacion: '2026-01-15',
      anotaciones: 'Test request from diagnostic script'
    };

    const options2 = {
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

    const req2 = https.request(options2, (res2) => {
      console.log(`   Status: ${res2.statusCode}`);
      console.log(`   Headers:`, {
        'x-backend-instance': res2.headers['x-backend-instance'],
        'x-forwarded-by': res2.headers['x-forwarded-by']
      });

      let data2 = '';
      res2.on('data', (chunk) => data2 += chunk);
      res2.on('end', () => {
        try {
          const json2 = JSON.parse(data2);
          console.log(`   Response: ${JSON.stringify(json2, null, 2)}\n`);
        } catch (e) {
          console.log(`   Raw Response: ${data2}\n`);
        }

        console.log('✅ Test completed. Check results above.');
        console.log('\n📋 Expected Results:');
        console.log('   - Notifications: 200 OK + X-Backend-Instance header');
        console.log('   - POST Requests: 200/201 OK (not 403)');
        console.log('   - Headers should show backend identification');
      });
    });

    req2.on('error', (err) => {
      console.error(`   Error: ${err.message}\n`);
    });

    req2.write(JSON.stringify(testRequest));
    req2.end();
  });
});

req1.on('error', (err) => {
  console.error(`   Error: ${err.message}\n`);
});

req1.end();

// Instructions
console.log('📝 Instructions:');
console.log('   1. Set JWT_TOKEN environment variable with a valid commercial role token');
console.log('   2. Run: JWT_TOKEN=your_token_here node test_spi_dev_fixes.js');
console.log('   3. Check that both endpoints return 200 and include identification headers\n');