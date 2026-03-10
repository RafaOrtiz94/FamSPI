# ===========================================
# DEPLOY BACKEND SANDBOX - Cloud Run + Neon
# Proyecto: famspi-sbox
# Servicio: spi-backend-sandbox
# Región: southamerica-east1
# ===========================================

# Configurar proyecto
gcloud config set project famspi-sbox

# ===========================================
# PASO 1: Crear/Actualizar Secrets
# ===========================================

# Database URL (Neon pooled) - REEMPLAZAR con tu connection string real
"postgresql://[USER]:[PASSWORD]@[HOST]/[DB]?sslmode=require" | gcloud secrets create SBX_DATABASE_URL --data-file=-
# Si ya existe: "postgresql://[USER]:[PASSWORD]@[HOST]/[DB]?sslmode=require" | gcloud secrets versions add SBX_DATABASE_URL --data-file=-

# JWT Secrets - REEMPLAZAR con secrets reales
"tu_jwt_secret_muy_seguro_para_sandbox_aqui_min_32_caracteres" | gcloud secrets create SBX_JWT_SECRET --data-file=-
"tu_refresh_secret_muy_seguro_para_sandbox_aqui_min_32_caracteres" | gcloud secrets create SBX_JWT_REFRESH_SECRET --data-file=-

# ===========================================
# OPCIONAL FULL - Descomentar si necesitas integraciones completas
# ===========================================

# Google OAuth (opcional FULL)
# "tu_google_client_secret_sandbox_real" | gcloud secrets create SBX_GOOGLE_CLIENT_SECRET --data-file=-

# SMTP (opcional FULL)
# "tu_smtp_password_sandbox_real" | gcloud secrets create SBX_SMTP_PASS --data-file=-

# Google Chat (opcional FULL)
# "https://chat.googleapis.com/v1/spaces/XXX/messages?key=XXX&token=XXX" | gcloud secrets create SBX_GCHAT_WEBHOOK_URL --data-file=-

# Gmail Service Account (opcional FULL)
# "spi-sandbox@dashboard-spi.iam.gserviceaccount.com" | gcloud secrets create SBX_GMAIL_SA_EMAIL --data-file=-
# "admin@sandbox.famproject.com.ec" | gcloud secrets create SBX_GMAIL_DELEGATED_USER --data-file=-

# GSA Key JSON (opcional FULL - desde archivo local)
# gcloud secrets create SBX_GSA_KEY_JSON --data-file=./service-account-key.json

# Jobs key para Cloud Scheduler (recomendado si usaras endpoints internos)
# "una_clave_larga_y_unica_para_jobs" | gcloud secrets create SBX_JOBS_KEY --data-file=-

# ===========================================
# PASO 2: Build con Cloud Build
# ===========================================
gcloud builds submit . --tag gcr.io/famspi-sbox/spi-backend-sandbox --dockerfile=backend/Dockerfile

# ===========================================
# PASO 3: Deploy Cloud Run (PERFIL MIN)
# ===========================================
gcloud run deploy spi-backend-sandbox `
    --image gcr.io/famspi-sbox/spi-backend-sandbox `
    --platform managed `
    --region southamerica-east1 `
    --allow-unauthenticated `
    --min-instances 0 `
    --max-instances 1 `
    --concurrency 10 `
    --cpu 1 `
    --memory 512Mi `
    --timeout 300 `
    --update-secrets=DATABASE_URL=SBX_DATABASE_URL:latest `
    --update-secrets=SECRET_KEY=SBX_JWT_SECRET:latest `
    --update-secrets=REFRESH_SECRET_KEY=SBX_JWT_REFRESH_SECRET:latest `
    --update-secrets=JOBS_KEY=SBX_JOBS_KEY:latest `
    --update-secrets=GSA_KEY_JSON=SBX_GSA_KEY_JSON:latest `
    --set-env-vars=NODE_ENV=sandbox `
    --set-env-vars=DB_SSL=true `
    --set-env-vars=DB_SSL_REJECT_UNAUTHORIZED=false `
    --set-env-vars=DB_POOL_MAX=2 `
    --set-env-vars=DB_IDLE_TIMEOUT_MS=10000 `
    --set-env-vars=DB_CONN_TIMEOUT_MS=10000 `
    --set-env-vars=DB_STATEMENT_TIMEOUT_MS=25000 `
    --set-env-vars=FRONTEND_URL=https://spi-sandbox.famproject.com.ec `
    --set-env-vars=ALLOWED_DOMAIN=sandbox.famproject.com.ec `
    --set-env-vars=GOOGLE_SUBJECT=admin@sandbox.famproject.com.ec `
    --set-env-vars=DB_BACKUP_DRIVE_ROOT_FOLDER_ID=[DRIVE_FOLDER_ID_DESTINO_BACKUPS] `
    --set-env-vars=DB_BACKUP_FOLDER_NAME=Backup Base `
    --set-env-vars=DB_BACKUP_TIMEZONE=America/Guayaquil `
    --set-env-vars=TRUST_PROXY=1 `
    --set-env-vars=DISABLE_RATE_LIMIT=false `
    --set-env-vars=RATE_LIMIT_WINDOW_MS=900000 `
    --set-env-vars=RATE_LIMIT_MAX=1000

# ===========================================
# PASO 3.1: Crear Cloud Scheduler para backups
# ===========================================

# Ejemplo:
# $env:PROJECT_ID="famspi-sbox"
# $env:RUN_REGION="southamerica-east1"
# $env:SCHEDULER_LOCATION="southamerica-east1"
# $env:SERVICE_NAME="spi-backend-sandbox"
# $env:JOBS_KEY="[MISMO_VALOR_DE_SBX_JOBS_KEY]"
# bash ./backend/scripts/create_db_backup_scheduler.sh

# ===========================================
# PASO 4: Validación post-deploy
# ===========================================

# Obtener URL del servicio
gcloud run services describe spi-backend-sandbox --region=southamerica-east1 --format="value(status.url)"

# Probar healthcheck (usar la URL obtenida arriba)
# curl -X GET "https://[SERVICE_URL]/"

# Probar endpoint con DB (requiere JWT token)
# curl -X GET "https://[SERVICE_URL]/api/v1/dashboard/comercial/summary" -H "Authorization: Bearer [JWT_TOKEN]"

# Revisar logs por errores
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=spi-backend-sandbox" --limit=20 --format="table(timestamp,severity,textPayload)"

Write-Host "Deploy completado. Verificar logs y funcionalidad antes de continuar."
