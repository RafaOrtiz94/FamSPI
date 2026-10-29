# ======================================================
# 🚀 SPI Backend LAN Startup Script
# ======================================================
# Carga .env.lan y inicia el servidor en modo LAN
# ======================================================

Write-Host "🔧 Configurando backend para modo LAN..." -ForegroundColor Cyan

# Verificar si existe .env.lan
$envLanPath = ".\.env.lan"
if (-not (Test-Path $envLanPath)) {
    Write-Host "❌ No se encuentra .env.lan" -ForegroundColor Red
    Write-Host "Crear el archivo .env.lan con la configuración de LAN" -ForegroundColor Yellow
    exit 1
}

# Cargar variables de entorno desde .env.lan
Write-Host "📄 Cargando configuración desde .env.lan..." -ForegroundColor Green
$content = Get-Content $envLanPath -Raw

# Parsear y setear variables de entorno
$lines = $content -split "`n"
foreach ($line in $lines) {
    $line = $line.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
        $parts = $line -split "=", 2
        if ($parts.Length -eq 2) {
            $key = $parts[0].Trim()
            $value = $parts[1].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
            Write-Host "   $key=$value" -ForegroundColor Gray
        }
    }
}

Write-Host "✅ Variables de entorno cargadas" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Iniciando servidor backend..." -ForegroundColor Green
Write-Host "🌐 Modo: LAN con HTTPS" -ForegroundColor Cyan
Write-Host "🔗 URL: https://spi-dev.famproject.com.ec/api/v1" -ForegroundColor Cyan
Write-Host ""

# Ejecutar el servidor
& node --max-http-header-size=16384 src/server.js