# run_migrations.ps1
# Script para ejecutar migraciones en Neon usando secretos de gcloud

$PROJECT_ID = "famspi-sbox"
$DB_HOST = "ep-muddy-sun-ah5um48r-pooler.c-3.us-east-1.aws.neon.tech"
$DB_PORT = "5432"
$DB_USER = "neondb_owner"
$DB_NAME = "FamSPI"

Write-Host "Obteniendo contrasena de base de datos desde Secret Manager..."
$DB_PASSWORD = gcloud secrets versions access latest --secret="DB_PASSWORD" --project=$PROJECT_ID

if ($LASTEXITCODE -ne 0) {
    Write-Host "No se pudo obtener la contrasena de gcloud."
    exit 1
}

Write-Host "Configurando entorno para conexion a Neon..."
$env:DB_HOST = $DB_HOST
$env:DB_PORT = $DB_PORT
$env:DB_USER = $DB_USER
$env:DB_PASSWORD = $DB_PASSWORD
$env:DB_NAME = $DB_NAME
$env:DB_SSL = "true"
$env:DB_SSL_REJECT_UNAUTHORIZED = "false"

Write-Host "Ejecutando script de migracion..."
node migrate_justification.js

if ($LASTEXITCODE -eq 0) {
    Write-Host "Proceso finalizado con exito."
} else {
    Write-Host "El proceso de migracion fallo."
}
