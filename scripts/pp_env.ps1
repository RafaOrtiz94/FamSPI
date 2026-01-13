# Script PowerShell para pruebas E2E de Private Purchases
# Configuración de entorno y utilidades para pruebas API

# ===========================================
# CONFIGURACIÓN BASE
# ===========================================

# URL base del backend (cambiar según entorno)
$BASE_URL = "http://localhost:3001/api"

# Función para hacer llamadas API
function Invoke-Api {
    param(
        [string]$Method = "GET",
        [string]$Endpoint,
        [object]$Body = $null,
        [hashtable]$Headers = @{}
    )

    $url = "$BASE_URL$Endpoint"

    # Agregar token si existe en variable de entorno
    if ($env:JWT_TOKEN) {
        $Headers["Authorization"] = "Bearer $($env:JWT_TOKEN)"
    }

    $params = @{
        Method  = $Method
        Uri     = $url
        Headers = $Headers
        ContentType = "application/json"
    }

    if ($Body -and ($Method -eq "POST" -or $Method -eq "PUT")) {
        $params.Body = ($Body | ConvertTo-Json -Depth 10)
    }

    try {
        Write-Host "[$Method] $url" -ForegroundColor Cyan
        $response = Invoke-RestMethod @params
        Write-Host "✅ SUCCESS" -ForegroundColor Green
        return @{
            Success = $true
            Data = $response
        }
    }
    catch {
        Write-Host "❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red

        # Intentar parsear respuesta de error
        try {
            $errorResponse = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorResponse)
            $errorText = $reader.ReadToEnd()
            $errorObj = $errorText | ConvertFrom-Json
            Write-Host "Error details: $($errorObj.message)" -ForegroundColor Yellow
        }
        catch {
            Write-Host "Could not parse error response" -ForegroundColor Yellow
        }

        return @{
            Success = $false
            Error = $_.Exception.Message
            StatusCode = $_.Exception.Response.StatusCode.value__
        }
    }
}

# Función para obtener token JWT (si es necesario)
function Get-JwtToken {
    param(
        [string]$Username,
        [string]$Password
    )

    Write-Host "🔐 Getting JWT token for $Username..." -ForegroundColor Yellow

    $loginBody = @{
        username = $Username
        password = $Password
    }

    $result = Invoke-Api -Method POST -Endpoint "/auth/login" -Body $loginBody

    if ($result.Success) {
        $env:JWT_TOKEN = $result.Data.token
        Write-Host "✅ Token obtained and set" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ Failed to get token" -ForegroundColor Red
        return $false
    }
}

# Función para listar compras privadas
function Get-PrivatePurchases {
    param([hashtable]$Filters = @{})

    $queryParams = @()
    foreach ($key in $Filters.Keys) {
        $queryParams += "$key=$($Filters[$key])"
    }

    $endpoint = "/private-purchases"
    if ($queryParams.Count -gt 0) {
        $endpoint += "?" + ($queryParams -join "&")
    }

    Write-Host "📋 Getting private purchases..." -ForegroundColor Blue
    return Invoke-Api -Method GET -Endpoint $endpoint
}

# Función para crear solicitud de compra privada
function New-PrivatePurchase {
    param(
        [object]$PurchaseData
    )

    Write-Host "🛒 Creating private purchase..." -ForegroundColor Blue
    return Invoke-Api -Method POST -Endpoint "/private-purchases" -Body $PurchaseData
}

# Función para marcar despacho listo
function Set-DispatchReady {
    param([string]$PurchaseId)

    Write-Host "🚛 Marking dispatch ready for purchase $PurchaseId..." -ForegroundColor Blue
    return Invoke-Api -Method POST -Endpoint "/private-purchases/$PurchaseId/mark-dispatch-ready"
}

# Función para generar acta de entrega
function New-DeliveryAct {
    param(
        [string]$PurchaseId,
        [string]$ActBase64 = $null,
        [string]$FileName = $null,
        [string]$MimeType = $null
    )

    $body = @{}
    if ($ActBase64) { $body.act_base64 = $ActBase64 }
    if ($FileName) { $body.file_name = $FileName }
    if ($MimeType) { $body.mime_type = $MimeType }

    Write-Host "📄 Generating delivery act for purchase $PurchaseId..." -ForegroundColor Blue
    return Invoke-Api -Method POST -Endpoint "/private-purchases/$PurchaseId/generate-delivery-act" -Body $body
}

# ===========================================
# UTILIDADES DE LOGGING
# ===========================================

function Write-Step {
    param([string]$Message)
    Write-Host "`n🔸 $Message" -ForegroundColor Magenta
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

# ===========================================
# EJEMPLO DE USO
# ===========================================
<#
# Configurar token
Get-JwtToken -Username "jefe_logistica" -Password "password"

# Listar compras
$result = Get-PrivatePurchases
if ($result.Success) {
    Write-Host "Found $($result.Data.data.Count) purchases"
}

# Marcar despacho listo
$result = Set-DispatchReady -PurchaseId "uuid-here"
if ($result.Success) {
    Write-Success "Dispatch marked as ready"
}
#>

Write-Host "🔧 Private Purchases E2E Test Utilities Loaded" -ForegroundColor Cyan
Write-Host "Base URL: $BASE_URL" -ForegroundColor Gray
Write-Host "Use Get-JwtToken to authenticate, then use other functions" -ForegroundColor Gray