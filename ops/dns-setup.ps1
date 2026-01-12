# ======================================================
# 🌐 SPI LAN DNS Setup Script
# ======================================================
# Configura resolución DNS para spi-dev.famproject.com.ec
# en desarrollo LAN
# ======================================================

param(
    [Parameter(Mandatory = $false)]
    [string]$IPAddress = "192.168.100.121",  # IP actual de tu máquina
    [string]$Hostname = "spi-dev.famproject.com.ec"
)

Write-Host "🔧 Configurando DNS para $Hostname -> $IPAddress" -ForegroundColor Cyan
Write-Host ""

# ======================================================
# 📝 Opción 1: Archivo hosts (Más simple)
# ======================================================
Write-Host "📋 Opción 1: Archivo hosts (Recomendado para desarrollo)" -ForegroundColor Yellow
Write-Host "Ubicación: C:\Windows\System32\drivers\etc\hosts" -ForegroundColor White
Write-Host ""
Write-Host "Agregar esta línea:" -ForegroundColor Green
Write-Host "$IPAddress    $Hostname" -ForegroundColor Cyan
Write-Host ""

# Verificar si ya existe la entrada
$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
if (Test-Path $hostsPath) {
    $hostsContent = Get-Content $hostsPath -Raw
    if ($hostsContent -match [regex]::Escape($Hostname)) {
        Write-Host "✅ Ya existe entrada para $Hostname en hosts" -ForegroundColor Green
        $hostsEntry = $hostsContent -split "`n" | Where-Object { $_ -match [regex]::Escape($Hostname) }
        Write-Host "   $hostsEntry" -ForegroundColor Gray
    } else {
        Write-Host "ℹ️  No existe entrada. Agregando..." -ForegroundColor Yellow
        try {
            Add-Content -Path $hostsPath -Value "$IPAddress    $Hostname" -Encoding UTF8
            Write-Host "✅ Agregado exitosamente" -ForegroundColor Green
        } catch {
            Write-Host "❌ Error agregando a hosts: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "Ejecuta como Administrador para modificar hosts" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "❌ No se encuentra archivo hosts" -ForegroundColor Red
}
Write-Host ""

# ======================================================
# 🌐 Opción 2: Acrylic DNS (Más avanzado)
# ======================================================
Write-Host "📋 Opción 2: Acrylic DNS (Para múltiples dispositivos)" -ForegroundColor Yellow
Write-Host "Descargar: https://mayakron.altervista.org/support/acrylic/Home.htm" -ForegroundColor White
Write-Host ""
Write-Host "Configurar AcrylicHosts.txt:" -ForegroundColor Green
Write-Host "$IPAddress    $Hostname" -ForegroundColor Cyan
Write-Host ""
Write-Host "Reiniciar Acrylic DNS después de cambios" -ForegroundColor White
Write-Host ""

# ======================================================
# 🔄 Opción 3: DNS del Router (Más permanente)
# ======================================================
Write-Host "📋 Opción 3: DNS del Router (Recomendado para producción)" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Acceder al panel de administración del router" -ForegroundColor White
Write-Host "2. Ir a Configuración > Red > DNS" -ForegroundColor White
Write-Host "3. Agregar registro A:" -ForegroundColor Green
Write-Host "   Nombre: $Hostname" -ForegroundColor Cyan
Write-Host "   IP: $IPAddress" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  Requiere acceso de administrador al router" -ForegroundColor Yellow
Write-Host ""

# ======================================================
# 🧪 Verificación
# ======================================================
Write-Host "🧪 Verificación:" -ForegroundColor Yellow
Write-Host "Ejecutar: ping $Hostname" -ForegroundColor White
Write-Host ""
Write-Host "Debería responder desde $IPAddress" -ForegroundColor Green
Write-Host ""

# ======================================================
# 📱 Configuración en dispositivos móviles
# ======================================================
Write-Host "📱 Para dispositivos móviles:" -ForegroundColor Yellow
Write-Host "1. Conectar al WiFi de la LAN" -ForegroundColor White
Write-Host "2. Configurar DNS manual:" -ForegroundColor White
Write-Host "   DNS Primario: $IPAddress" -ForegroundColor Cyan
Write-Host "   DNS Secundario: 8.8.8.8" -ForegroundColor Cyan
Write-Host ""
Write-Host "O usar app DNS Changer en Android" -ForegroundColor White
Write-Host ""

Write-Host "🎉 Configuración DNS completada!" -ForegroundColor Green