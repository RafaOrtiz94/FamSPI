/**
 * Script para probar la autorización de Gmail
 * Ejecutar: node test-gmail-auth.js
 */

require('dotenv').config();
const gmailService = require('./src/services/gmail.service');

async function testGmailAuth() {
    console.log('\n🔍 Verificando configuración de Gmail API...\n');

    // 1. Verificar variables de entorno
    console.log('1️⃣ Variables de entorno:');
    console.log('  GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ Configurado' : '❌ Falta');
    console.log('  GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✅ Configurado' : '❌ Falta');
    console.log('  GMAIL_REDIRECT_URI:', process.env.GMAIL_REDIRECT_URI || '⚠️  No configurado (se usará BACKEND_URL)');
    console.log('  BACKEND_URL:', process.env.BACKEND_URL || '⚠️  No configurado');

    // 2. Generar URL de autorización de prueba
    console.log('\n2️⃣ Generando URL de autorización de prueba...');
    try {
        const authUrl = gmailService.getAuthUrl('test@example.com');
        console.log('✅ URL generada correctamente');
        console.log('\n📋 Para autorizar tu cuenta, abre esta URL en tu navegador:');
        console.log('\n' + authUrl + '\n');
        console.log('⚠️  IMPORTANTE: Esta URL es solo de prueba. Para autorizar tu cuenta real,');
        console.log('   usa el endpoint /api/v1/gmail/auth/url con tu token de usuario.\n');
    } catch (error) {
        console.error('❌ Error generando URL:', error.message);
    }

    // 3. Verificar si ya hay tokens (requiere user ID)
    console.log('3️⃣ Para verificar si tu cuenta está autorizada, ejecuta:');
    console.log('   curl -H "Authorization: Bearer TU_TOKEN" \\');
    console.log('        http://localhost:3000/api/v1/gmail/auth/status\n');

    console.log('📚 Documentación completa en: COMO_AUTORIZAR_GMAIL.md\n');

    process.exit(0);
}

testGmailAuth().catch(err => {
    console.error('\n❌ Error:', err);
    process.exit(1);
});
