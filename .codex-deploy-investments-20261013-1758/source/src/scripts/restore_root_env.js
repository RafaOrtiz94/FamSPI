const fs = require('fs');
const path = require('path');

const envContent = `# --- SERVER CONFIG ---
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# --- DATABASE ---
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=
DB_NAME=spi_fam
DB_POOL_MAX=20
DB_SSL=false

# --- GOOGLE AUTH & DRIVE ---
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/v1/auth/google/callback
GOOGLE_SUBJECT=
GSA_KEY_PATH=
ENABLE_GOOGLE_SELF_TEST=false

# --- EMAIL (GMAIL/SMTP) ---
GMAIL_DEFAULT_USER_ID=
SYSTEM_MAIL_ADDRESS=administrador@fam-project.com
SYSTEM_MAIL_DELEGATED_USER=administrador@fam-project.com
SYSTEM_MAIL_REPLY_TO=administrador@fam-project.com
SYSTEM_MAIL_NAME=FamSPI Sistema
SMTP_FROM=
SMTP_USER=
SMTP_FROM_NAME=SPI System
GMAIL_SERVICE_ACCOUNT_SENDER=administrador@fam-project.com

# --- SECURITY ---
JWT_SECRET=please_set_this_secret
`;

try {
    // Target backend root .env
    const envPath = path.join(__dirname, '../../.env');
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('.env file written successfully to:', envPath);
} catch (err) {
    console.error('Error writing .env:', err);
}
