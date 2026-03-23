[CmdletBinding()]
param(
  [string]$ProjectId = "famspi-sbox",
  [string]$Region = "us-central1",
  [string]$ServiceName = "spi-backend",
  [string]$ImageTag = "manual",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param(
    [string]$Message,
    [int]$PercentComplete
  )

  Write-Progress -Activity "Deploy Backend Cloud Run" -Status $Message -PercentComplete $PercentComplete
  $timestamp = Get-Date -Format "HH:mm:ss"
  Write-Host "[$timestamp] $Message"
}

function Assert-Command {
  param([string]$CommandName)

  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    throw "No se encontro el comando requerido: $CommandName"
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $repoRoot "backend"
$image = "us-central1-docker.pkg.dev/$ProjectId/cloud-run-source-deploy/${ServiceName}:${ImageTag}"

Assert-Command "gcloud"

if (-not (Test-Path (Join-Path $backendPath "Dockerfile"))) {
  throw "No se encontro backend\\Dockerfile. Ejecuta este script desde el repositorio correcto."
}

Push-Location $backendPath
try {
  Write-Step "Validando entorno" 5
  gcloud config set project $ProjectId | Out-Null

  if (-not $SkipBuild) {
    Write-Step "Construyendo imagen $image" 20
    & gcloud builds submit `
      --tag $image `
      --project $ProjectId
  }

  Write-Step "Desplegando servicio $ServiceName" 65

  $deployArgs = @(
    "run", "deploy", $ServiceName,
    "--image", $image,
    "--region", $Region,
    "--project", $ProjectId,
    "--allow-unauthenticated",
    "--memory", "512Mi",
    "--cpu", "1",
    "--set-env-vars", "NODE_ENV=production",
    "--set-env-vars", "DB_SSL=true",
    "--set-env-vars", "FRONTEND_URL=https://fam-spi-front.web.app",
    "--set-env-vars", "GOOGLE_REDIRECT_URI=https://spi-backend-983537733948.us-central1.run.app/api/v1/auth/google/callback",
    "--set-env-vars", "DB_HOST=ep-muddy-sun-ah5um48r-pooler.c-3.us-east-1.aws.neon.tech",
    "--set-env-vars", "DB_PORT=5432",
    "--set-env-vars", "DB_USER=neondb_owner",
    "--set-env-vars", "DB_NAME=FamSPI",
    "--set-env-vars", "GOOGLE_CLIENT_ID=18376271129-1v6irnav4n49298sspaij02qjnigeln3.apps.googleusercontent.com",
    "--set-env-vars", "DRIVE_ROOT_FOLDER_ID=0AILKwXtcdfRFUk9PVA",
    "--set-env-vars", "GMAIL_SERVICE_ACCOUNT_CLIENT_EMAIL=spi-cuenta-servicio@dashboard-spi.iam.gserviceaccount.com",
    "--set-env-vars", "GMAIL_DELEGATED_USER=administrador@fam-project.com",
    "--set-env-vars", "GOOGLE_SUBJECT=administrador@fam-project.com",
    "--set-env-vars", "GSA_KEY_PATH=/secrets/gsa-key.json",
    "--set-env-vars", "EMAIL_NOTIFICATIONS_ENABLED=true",
    "--set-env-vars", "DISABLE_MAIL=false",
    "--set-env-vars", "NOTIFICATION_ASYNC_DISPATCH_ENABLED=false",
    "--set-env-vars", "EMAIL_SUPPRESS_SOURCES=",
    "--set-env-vars", "NOTIFICATION_TIMEZONE=America/Guayaquil",
    "--set-env-vars", "APP_TIMEZONE=America/Guayaquil",
    "--set-env-vars", "TZ=America/Guayaquil",
    "--set-env-vars", "DB_BACKUP_FOLDER_NAME=Backup Base",
    "--set-env-vars", "DB_BACKUP_TIMEZONE=America/Guayaquil",
    "--set-env-vars", "DB_BACKUP_AUTO_ENABLED=false",
    "--set-env-vars", "SYSTEM_MAIL_ADDRESS=administrador@fam-project.com",
    "--set-env-vars", "SYSTEM_MAIL_DELEGATED_USER=administrador@fam-project.com",
    "--set-env-vars", "SYSTEM_MAIL_REPLY_TO=administrador@fam-project.com",
    "--set-env-vars", "SYSTEM_MAIL_NAME=FamSPI Sistema",
    "--set-env-vars", "GMAIL_SERVICE_ACCOUNT_SENDER=administrador@fam-project.com",
    "--set-secrets", "APPLICANTS_API_KEY=APPLICANTS_API_KEY:latest",
    "--set-secrets", "DOC_TEMPLATE_SOLICITUD_1=DOC_TEMPLATE_SOLICITUD_1:latest",
    "--set-secrets", "DOC_TEMPLATE_SOLICITUD_2=DOC_TEMPLATE_SOLICITUD_2:latest",
    "--set-secrets", "DOC_TEMPLATE_SOLICITUD_3=DOC_TEMPLATE_SOLICITUD_3:latest",
    "--set-secrets", "DB_PASSWORD=DB_PASSWORD:latest",
    "--set-secrets", "SECRET_KEY=SECRET_KEY:latest",
    "--set-secrets", "REFRESH_SECRET_KEY=REFRESH_SECRET_KEY:latest",
    "--set-secrets", "GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest",
    "--set-secrets", "SMTP_PASS=SMTP_PASS:latest",
    "--set-secrets", "JOBS_KEY=JOBS_KEY:latest",
    "--set-secrets", "/secrets/gsa-key.json=GSA_KEY_JSON:latest"
  )

  & gcloud @deployArgs

  Write-Step "Verificando revision activa" 90
  $serviceInfo = & gcloud run services describe $ServiceName `
    --region $Region `
    --project $ProjectId `
    --format "value(status.latestReadyRevisionName,status.url)"

  Write-Step "Completado" 100
  Write-Host ""
  Write-Host "Servicio desplegado:"
  Write-Host $serviceInfo
}
finally {
  Pop-Location
  Write-Progress -Activity "Deploy Backend Cloud Run" -Completed
}
