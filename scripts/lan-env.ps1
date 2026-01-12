param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("frontend", "backend")]
    [string]$Mode
)

Write-Host "Detectando IP LAN para modo $Mode..."

# Función para detectar IP LAN
function Get-LanIPAddress {
    try {
        # Obtener adaptadores de red
        $adapters = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' }

        foreach ($adapter in $adapters) {
            # Ignorar interfaces virtuales (WSL, VirtualBox, Hyper-V, VPN)
            $adapterName = $adapter.Name.ToLower()
            if ($adapterName -match "(wsl|virtual|hvs|vpn|hyper-v|bluetooth)") {
                Write-Host "Ignorando adaptador virtual: $($adapter.Name)"
                continue
            }

            # Obtener configuración IP del adaptador
            $ipConfig = Get-NetIPAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue

            if ($ipConfig -and $ipConfig.IPAddress) {
                $ipAddress = $ipConfig.IPAddress

                # Verificar que sea una IP privada válida (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
                if ($ipAddress -match "^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)") {
                    # Verificar que tenga gateway válido
                    $gateway = Get-NetRoute -InterfaceIndex $adapter.InterfaceIndex -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue
                    if ($gateway -and $gateway.NextHop -notmatch "^(127\.|0\.0\.0\.0)") {
                        Write-Host "IP LAN detectada: $ipAddress (Adaptador: $($adapter.Name))"
                        return $ipAddress
                    }
                }
            }
        }

        Write-Host "No se encontro una IP LAN valida"
        return $null
    }
    catch {
        Write-Host "Error detectando IP: $($_.Exception.Message)"
        return $null
    }
}

# Obtener IP LAN
$lanIP = Get-LanIPAddress

if (-not $lanIP) {
    Write-Host "No se pudo detectar una IP LAN valida. Abortando."
    exit 1
}

Write-Host "IP LAN detectada: $lanIP"

if ($Mode -eq "frontend") {
    # Generar .env.local para frontend
    $envContent = @"
HOST=0.0.0.0
PORT=3001
REACT_APP_LAN_MODE=true
REACT_APP_API_ABSOLUTE_URL=http://$($lanIP):3000/api/v1
WDS_SOCKET_HOST=$($lanIP)
WDS_SOCKET_PORT=3001
REACT_APP_API_URL=http://localhost:3000/api/
REACT_APP_FRONTEND_URL=http://localhost:3001
REACT_APP_API_BASE_URL=http://localhost:3000/api/
"@

    # Verificar si estamos en el directorio spi_front
    if (Test-Path "package.json") {
        # Estamos en spi_front
        $envPath = ".env.local"
        Write-Host "Archivo generado: .env.local"
    } else {
        # Estamos en el directorio raíz
        $envPath = "spi_front\.env.local"
        Write-Host "Archivo generado: spi_front\.env.local"
    }

    $envContent | Out-File -FilePath $envPath -Encoding UTF8 -Force

    Write-Host "Contenido:"
    Write-Host $envContent

    # Ejecutar npm start desde el directorio raíz apuntando a spi_front
    Write-Host "Iniciando frontend..."
    if (Test-Path "package.json") {
        # Estamos en spi_front, ejecutar comando desde directorio raíz
        Set-Location ".."
    }
    # Ahora estamos en el directorio raíz, ejecutar el comando
    & npm run --prefix spi_front start
}
elseif ($Mode -eq "backend") {
    # Para backend, usar variables de entorno en lugar de archivo
    Write-Host "Configurando backend para IP: $lanIP"

    # Establecer variables de entorno para el proceso actual
    $env:HOST = "0.0.0.0"
    $env:PORT = "3000"
    $env:CORS_ORIGINS = "http://$($lanIP):3001,http://localhost:3001"

    Write-Host "Variables de entorno configuradas:"
    Write-Host "   HOST=0.0.0.0"
    Write-Host "   PORT=3000"
    Write-Host "   CORS_ORIGINS=http://$($lanIP):3001,http://localhost:3001"

    # Ejecutar el servidor
    Write-Host "Iniciando backend..."
    # Verificar si estamos en el directorio backend
    if (Test-Path "src/server.js") {
        # Ya estamos en backend
        & node src/server.js
    } else {
        # Estamos en el directorio raíz
        Set-Location "backend"
        & node src/server.js
    }
}

Write-Host "Configuracion LAN completada para $Mode"


