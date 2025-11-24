/**
 * Script para agregar ENCRYPTION_KEY al archivo .env
 * Ejecutar: node add-encryption-key.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envPath = path.join(__dirname, '.env');

// Generar clave de encriptación
const encryptionKey = '8759fbec5525a2a423d964a29f183b849a9389cafe77d4f39054ef16f8e1346ce';

console.log('🔐 Configurando clave de encriptación...\n');
console.log('Clave generada:', encryptionKey);
console.log('\n⚠️  IMPORTANTE: Guarda esta clave en un lugar seguro!\n');

try {
    let envContent = '';

    // Leer contenido existente si el archivo existe
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
        console.log('✓ Archivo .env encontrado');

        // Verificar si ya existe ENCRYPTION_KEY
        if (envContent.includes('ENCRYPTION_KEY=')) {
            console.log('\n⚠️  ENCRYPTION_KEY ya existe en .env');
            console.log('Si deseas reemplazarlo, edita manualmente el archivo .env');
            process.exit(0);
        }
    } else {
        console.log('⚠️  Archivo .env no encontrado, se creará uno nuevo');
    }

    // Agregar la clave de encriptación
    const newLine = `\n# Clave de encriptación AES-256 para datos de clientes\nENCRYPTION_KEY=${encryptionKey}\n`;

    fs.writeFileSync(envPath, envContent + newLine, 'utf8');

    console.log('\n✅ ENCRYPTION_KEY agregada exitosamente al archivo .env');
    console.log('\n📝 Recuerda:');
    console.log('   - NO compartas esta clave');
    console.log('   - NO la subas a repositorios públicos');
    console.log('   - Guarda una copia de respaldo');
    console.log('   - Si pierdes la clave, NO podrás desencriptar los datos');

} catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
}
