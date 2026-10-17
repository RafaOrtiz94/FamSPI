const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '../../.env');

console.log('--- DIAGNOSIS START ---');
console.log('Checking file:', envPath);

try {
    if (!fs.existsSync(envPath)) {
        console.error('❌ File does not exist.');
        process.exit(1);
    }

    const stats = fs.statSync(envPath);
    console.log('File size:', stats.size, 'bytes');

    const buffer = fs.readFileSync(envPath);
    console.log('First 50 bytes (hex):', buffer.subarray(0, 50).toString('hex'));
    console.log('First 50 chars (utf8):', buffer.subarray(0, 50).toString('utf8'));

    // Check for BOM
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        console.log('⚠️ UTF-8 BOM detected.');
    } else if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
        console.log('⚠️ UTF-16 LE BOM detected.');
    } else if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
        console.log('⚠️ UTF-16 BE BOM detected.');
    }

    const parsed = dotenv.parse(buffer);
    console.log('Dotenv parse result keys:', Object.keys(parsed));
    console.log('GOOGLE_SUBJECT value:', parsed.GOOGLE_SUBJECT);

} catch (err) {
    console.error('Error:', err);
}
console.log('--- DIAGNOSIS END ---');
