# Ambiente de pruebas LOCAL de FamSPI (plan RBAC, Fase 1A).
#
# Todo corre en este equipo y nada apunta a produccion:
#   base      PostgreSQL 17 propio en %LOCALAPPDATA%\FamSPI-staging, puerto 5544
#   backend   http://localhost:8090   (NODE_ENV=staging, sin correo, chat, push, jobs ni Google)
#   frontend  http://localhost:3101
#
# Uso:
#   .\scripts\staging_local.ps1                 # arranca base, backend y frontend (cada uno en su ventana)
#   .\scripts\staging_local.ps1 -Action db      # solo la base
#   .\scripts\staging_local.ps1 -Action backend # solo el backend, en esta ventana
#   .\scripts\staging_local.ps1 -Action frontend
#   .\scripts\staging_local.ps1 -Action status
#   .\scripts\staging_local.ps1 -Action stop    # detiene la base local
#
# Ingreso: boton "Acceso pasantes" del login, usuario prueba.<rol>. La contrasena esta en el
# secreto STAGING_TEST_USERS_PASSWORD (gcloud secrets versions access latest --secret=...).
[CmdletBinding()]
param(
  [ValidateSet("all", "db", "backend", "frontend", "status", "stop")]
  [string]$Action = "all"
)

$ErrorActionPreference = "Stop"

$DbPort = 5544
$BackendPort = 8090
$FrontendPort = 3101
$repoRoot = Split-Path -Parent $PSScriptRoot
$stagingHome = Join-Path $env:LOCALAPPDATA "FamSPI-staging"
$pgBin = "C:\Program Files\PostgreSQL\17\bin"
$pgData = Join-Path $stagingHome "pg17"
$passwordFile = Join-Path $stagingHome "db_password.txt"
$jwtFile = Join-Path $stagingHome "jwt_keys.txt"

function Test-DbUp {
  & "$pgBin\pg_isready.exe" -h localhost -p $DbPort *> $null
  return ($LASTEXITCODE -eq 0)
}

function Start-Db {
  if (-not (Test-Path (Join-Path $pgData "PG_VERSION"))) {
    throw "No existe la instancia local en $pgData. Hay que crearla y cargarla primero (backend/scripts/staging/load_local_staging_db.sh)."
  }
  if (Test-DbUp) { Write-Host "Base local ya esta arriba (puerto $DbPort)."; return }
  Start-Process -FilePath "$pgBin\pg_ctl.exe" -WindowStyle Hidden -ArgumentList @(
    "-D", "`"$pgData`"", "-o", "`"-p $DbPort -c listen_addresses=localhost`"", "-l", "`"$stagingHome\pg17.log`"", "start"
  )
  foreach ($i in 1..20) { if (Test-DbUp) { break }; Start-Sleep -Milliseconds 500 }
  if (-not (Test-DbUp)) { throw "La base local no arranco. Revisa $stagingHome\pg17.log" }
  Write-Host "Base local arriba (puerto $DbPort)."
}

function Get-JwtKeys {
  # Llaves propias del ambiente local: un token de produccion no sirve aqui ni al reves.
  if (-not (Test-Path $jwtFile)) {
    $bytes = New-Object byte[] 96
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $hex = -join ($bytes | ForEach-Object { $_.ToString("x2") })
    Set-Content -Path $jwtFile -Value @($hex.Substring(0, 96), $hex.Substring(96, 96)) -Encoding ascii
  }
  return ,(Get-Content $jwtFile)
}

function Set-BackendEnv {
  $keys = Get-JwtKeys
  $vars = [ordered]@{
    NODE_ENV                    = "staging"
    PORT                        = "$BackendPort"
    DB_HOST                     = "localhost"
    DB_PORT                     = "$DbPort"
    DB_USER                     = "famspi_staging"
    DB_PASSWORD                 = (Get-Content $passwordFile -Raw).Trim()
    DB_NAME                     = "famspi_staging"
    DB_SSL                      = "false"
    SECRET_KEY                  = $keys[0]
    REFRESH_SECRET_KEY          = $keys[1]
    FRONTEND_URL                = "http://localhost:$FrontendPort"
    APP_FRONTEND_URL            = "http://localhost:$FrontendPort"
    # Nada sale del equipo: sin correo, sin chat, sin push, sin jobs.
    DISABLE_MAIL                = "true"
    EMAIL_NOTIFICATIONS_ENABLED = "false"
    NOTIFICATIONS_EMAIL_ENABLED = "false"
    NOTIFICATIONS_PUSH_ENABLED  = "false"
    DISABLE_GCHAT               = "true"
    ENABLE_JOBS                 = "false"
    JOBS_RUN_ON_START           = "false"
    DB_BACKUP_AUTO_ENABLED      = "false"
    # Sin credenciales de Google: Drive, Docs, Gmail y calendario quedan deshabilitados.
    # Debe ser un valor NO vacio: en PowerShell asignar "" borra la variable y dotenv
    # volveria a cargar la ruta real desde backend\.env.
    GSA_KEY_PATH                = "deshabilitado-en-staging-local"
  }
  # dotenv no pisa variables ya definidas, asi que estas mandan sobre backend\.env.
  foreach ($name in $vars.Keys) { Set-Item -Path "Env:$name" -Value $vars[$name] }
}

function Start-Backend {
  Start-Db
  Set-BackendEnv
  Set-Location (Join-Path $repoRoot "backend")
  Write-Host "Backend staging local en http://localhost:$BackendPort"
  & node --max-http-header-size=16384 src/server.js
}

function Start-Frontend {
  $env:PORT = "$FrontendPort"
  $env:BROWSER = "none"
  $env:REACT_APP_API_ABSOLUTE_URL = "http://localhost:$BackendPort"
  $env:REACT_APP_API_BASE_URL = "http://localhost:$BackendPort"
  $env:REACT_APP_LAN_MODE = "false"
  $env:REACT_APP_ENV_LABEL = "STAGING LOCAL"
  Set-Location (Join-Path $repoRoot "spi_front")
  Write-Host "Frontend staging local en http://localhost:$FrontendPort"
  & npm start
}

switch ($Action) {
  "db" { Start-Db }
  "backend" { Start-Backend }
  "frontend" { Start-Frontend }
  "stop" {
    & "$pgBin\pg_ctl.exe" -D $pgData stop -m fast
  }
  "status" {
    $ports = @{ "base ($DbPort)" = $DbPort; "backend ($BackendPort)" = $BackendPort; "frontend ($FrontendPort)" = $FrontendPort }
    foreach ($name in $ports.Keys) {
      $up = [bool](Get-NetTCPConnection -State Listen -LocalPort $ports[$name] -ErrorAction SilentlyContinue)
      Write-Host ("{0,-18} {1}" -f $name, $(if ($up) { "arriba" } else { "detenido" }))
    }
  }
  "all" {
    Start-Db
    $self = $MyInvocation.MyCommand.Path
    Start-Process powershell -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-File", "`"$self`"", "-Action", "backend")
    Start-Process powershell -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-File", "`"$self`"", "-Action", "frontend")
    Write-Host "Abriendo backend (http://localhost:$BackendPort) y frontend (http://localhost:$FrontendPort) en ventanas aparte."
  }
}
