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

function Invoke-GcloudChecked {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args
  )

  & gcloud @Args
  if ($LASTEXITCODE -ne 0) {
    throw "gcloud fallo (exit $LASTEXITCODE): gcloud $($Args -join ' ')"
  }
}

function Show-CloudRunFailureDiagnostics {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,
    [Parameter(Mandatory = $true)]
    [string]$Region,
    [Parameter(Mandatory = $true)]
    [string]$ServiceName
  )

  try {
    $revision = & gcloud run revisions list `
      --service $ServiceName `
      --region $Region `
      --project $ProjectId `
      --limit 1 `
      --sort-by "~metadata.creationTimestamp" `
      --format "value(metadata.name)"

    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($revision)) {
      Write-Warning "No se pudo resolver la revision mas reciente para diagnostico."
      return
    }

    Write-Host ""
    Write-Host "=== Diagnostico Cloud Run: $revision ==="
    & gcloud logging read `
      "resource.type=cloud_run_revision AND resource.labels.service_name=$ServiceName AND resource.labels.revision_name=$revision" `
      --project $ProjectId `
      --limit 40 `
      --format "value(timestamp,logName,severity,textPayload)"
  }
  catch {
    Write-Warning "No se pudieron obtener logs de diagnostico de Cloud Run: $($_.Exception.Message)"
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
  Invoke-GcloudChecked -Args @("config", "set", "project", $ProjectId)

  if (-not $SkipBuild) {
    Write-Step "Construyendo imagen $image (con cache de capas)" 20
    Invoke-GcloudChecked -Args @(
      "builds", "submit",
      "--config", "cloudbuild.yaml",
      "--substitutions", "_TAG=$ImageTag",
      "--project", $ProjectId
    )
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
    "--max-instances", "3",               # 3 instancias x 8 conexiones = 24 max al pooler Neon
    "--concurrency", "50",                # Máx 50 requests simultáneos por instancia — suficiente para ~40 usuarios de evento
    "--set-env-vars", "NODE_ENV=production",
    "--set-env-vars", "ENABLE_JOBS=true",
    "--set-env-vars", "JOBS_RUN_ON_START=false",
    "--set-env-vars", "JOBS_BOOTSTRAP_STAGGER_MS=20000",
    "--set-env-vars", "DB_POOL_MAX=8",    # 3 instancias x 8 = 24 conexiones al pooler Neon (evento Kick Off ~40 usuarios)
    "--set-env-vars", "DB_POOL_MIN=0",    # 0: sin conexiones calientes -> permite autosuspend de Neon fuera de horario/trafico
    "--set-env-vars", "DB_CONN_TIMEOUT_MS=15000",
    "--set-env-vars", "DB_SSL=true",
    "--set-env-vars", "FRONTEND_URL=https://fam-spi-front.web.app",
    "--set-env-vars", "GOOGLE_REDIRECT_URI=https://spi-backend-983537733948.us-central1.run.app/api/v1/auth/google/callback",
    "--set-env-vars", "DB_HOST=ep-lucky-bar-aw5wr0cn.c-12.us-east-1.aws.neon.tech",  # MIGRACION 2026-08-20 — proyecto nuevo (lucky-bar) para evitar la cuota de compute agotada en wispy-moon/muddy-sun. Endpoint DIRECTO (SIN -pooler): el pooler de Neon no aisla bien el search_path entre conexiones (ver .agents/skills/neon-compute-quota-failover-skill.md)
    "--set-env-vars", "DB_PORT=5432",
    "--set-env-vars", "DB_USER=neondb_owner",
    "--set-env-vars", "DB_NAME=neondb",
    "--set-env-vars", "GOOGLE_CLIENT_ID=18376271129-1v6irnav4n49298sspaij02qjnigeln3.apps.googleusercontent.com",
    "--set-env-vars", "DRIVE_ROOT_FOLDER_ID=0AILKwXtcdfRFUk9PVA",
    "--set-env-vars", "GMAIL_SERVICE_ACCOUNT_CLIENT_EMAIL=spi-cuenta-servicio@dashboard-spi.iam.gserviceaccount.com",
    "--set-env-vars", "GMAIL_DELEGATED_USER=administrador@fam-project.com",
    "--set-env-vars", "GOOGLE_SUBJECT=administrador@fam-project.com",
    "--set-env-vars", "GSA_KEY_PATH=/secrets/gsa-key.json",
    "--set-env-vars", "EMAIL_NOTIFICATIONS_ENABLED=true",
    "--set-env-vars", "NOTIFICATIONS_EMAIL_ENABLED=true",
    "--set-env-vars", "NOTIFICATIONS_PUSH_ENABLED=true",
    "--set-env-vars", "DISABLE_MAIL=false",
    "--set-env-vars", "NOTIFICATION_ASYNC_DISPATCH_ENABLED=true",
    "--set-env-vars", "EMAIL_SUPPRESS_SOURCES=",
    "--set-env-vars", "NOTIFICATION_TIMEZONE=America/Guayaquil",
    "--set-env-vars", "APP_TIMEZONE=America/Guayaquil",
    "--set-env-vars", "TZ=America/Guayaquil",
    "--set-env-vars", "APP_FRONTEND_URL=https://fam-spi-front.web.app",
    "--set-env-vars", "ACCESS_TOKEN_EXPIRES_IN=8h",
    "--set-env-vars", "REFRESH_TOKEN_EXPIRES_IN=30d",
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
    "--set-secrets", "COLLAB_ACTA_HERRAMIENTA_TEMPLATE_ID=COLLAB_ACTA_HERRAMIENTA_TEMPLATE_ID:latest",
    "--set-secrets", "COLLAB_ACTA_HERRAMIENTA_INT_TEMPLATE_ID=COLLAB_ACTA_HERRAMIENTA_INT_TEMPLATE_ID:latest",
    "--set-secrets", "COLLAB_ACTA_HERRAMIENTA_EXT_TEMPLATE_ID=COLLAB_ACTA_HERRAMIENTA_EXT_TEMPLATE_ID:latest",
    "--set-env-vars", "COLLAB_ACTA_EPP_TEMPLATE_ID=17hZiqsespzG-EdoyhHFDL-nLs81LR2T3NHIRitOZVRM",
    "--set-env-vars", "COLLAB_ACTA_ROPA_TEMPLATE_ID=11nKdp8U-B4wKcWcmBcZeaeQEu2nqyB_5BL8wgUK7NKo",
    "--set-env-vars", "COLLAB_ACTA_ROPA_INT_TEMPLATE_ID=11nKdp8U-B4wKcWcmBcZeaeQEu2nqyB_5BL8wgUK7NKo",
    "--set-env-vars", "COLLAB_ACTA_ROPA_EXT_TEMPLATE_ID=1gn3BmysfeS3NzlniNg2NS3IVmzjdLKFrjIK79EMX-70",  # 2026-08-24 — plantilla ropa de trabajo para personal EXTERNO (antes no existia variante, solo caia al template interno)
    "--set-secrets", "TI_ACTA_ENTREGA_TEMPLATE_ID=TI_ACTA_ENTREGA_TEMPLATE_ID:latest",
    "--set-secrets", "TI_ACTA_RETIRO_TEMPLATE_ID=TI_ACTA_RETIRO_TEMPLATE_ID:latest",
    "--set-secrets", "DB_PASSWORD=DB_PASSWORD:latest",
    "--set-secrets", "SECRET_KEY=SECRET_KEY:latest",
    "--set-secrets", "REFRESH_SECRET_KEY=REFRESH_SECRET_KEY:latest",
    "--set-secrets", "GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest",
    "--set-secrets", "GOOGLE_MAPS_SERVER_API_KEY=GOOGLE_MAPS_SERVER_API_KEY:latest",
    "--set-secrets", "WEB_PUSH_PUBLIC_KEY=WEB_PUSH_PUBLIC_KEY:latest",
    "--set-secrets", "WEB_PUSH_PRIVATE_KEY=WEB_PUSH_PRIVATE_KEY:latest",
    "--set-secrets", "WEB_PUSH_SUBJECT=WEB_PUSH_SUBJECT:latest",
    "--set-secrets", "SMTP_PASS=SMTP_PASS:latest",
    "--set-secrets", "JOBS_KEY=JOBS_KEY:latest",
    "--set-secrets", "GCHAT_WEBHOOK_URL_TH=GCHAT_WEBHOOK_URL_TH:latest",  # webhook del Space privado de Talento Humano (alertas de asistencia/regularizacion/teletrabajo van solo por chat)
    "--set-secrets", "/secrets/gsa-key.json=GSA_KEY_JSON:latest"
  )

  try {
    Invoke-GcloudChecked -Args $deployArgs
  }
  catch {
    Show-CloudRunFailureDiagnostics -ProjectId $ProjectId -Region $Region -ServiceName $ServiceName
    throw
  }

  Write-Step "Verificando revision activa" 90
  $serviceInfo = & gcloud run services describe $ServiceName `
    --region $Region `
    --project $ProjectId `
    --format "value(status.latestReadyRevisionName,status.url)"
  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo describir el servicio desplegado"
  }

  Write-Step "Completado" 100
  Write-Host ""
  Write-Host "Servicio desplegado:"
  Write-Host $serviceInfo
}
finally {
  Pop-Location
  Write-Progress -Activity "Deploy Backend Cloud Run" -Completed
}
