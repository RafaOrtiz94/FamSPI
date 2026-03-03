param(
    [string]$PythonExe = "C:\Users\Departamento de TI\AppData\Local\Python\pythoncore-3.14-64\python.exe",
    [Alias("Input")]
    [string]$InputFile = "FORMATO BC - 15-01-2026 (2).xlsx",
    [string]$OutDir = $PSScriptRoot,
    [ValidateSet("json", "md", "both")]
    [string]$Format = "both",
    [switch]$IncludeEmpty,
    [switch]$Gui,
    [switch]$InstallDeps,
    [switch]$RunTests
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$mapperScript = Join-Path $scriptDir "excel_mapper.py"
$guiScript = Join-Path $scriptDir "mapper_gui.py"
$requirementsFile = Join-Path $scriptDir "requirements.txt"
$testsDir = Join-Path $scriptDir "tests"

if (-not (Test-Path $PythonExe)) {
    Write-Error "Python no encontrado en: $PythonExe"
}

if (-not (Test-Path $mapperScript)) {
    Write-Error "Script no encontrado: $mapperScript"
}

if ($Gui) {
    if (-not (Test-Path $guiScript)) {
        Write-Error "GUI no encontrada: $guiScript"
    }
    Write-Host "[INFO] Abriendo GUI..."
    & $PythonExe $guiScript
    exit $LASTEXITCODE
}

if ($InstallDeps) {
    if (-not (Test-Path $requirementsFile)) {
        Write-Error "Archivo de dependencias no encontrado: $requirementsFile"
    }
    Write-Host "[INFO] Instalando dependencias desde requirements.txt..."
    & $PythonExe -m pip install -r $requirementsFile
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

$mapperArgs = @(
    $mapperScript,
    "--input", $InputFile,
    "--out-dir", $OutDir,
    "--format", $Format
)

if ($IncludeEmpty) {
    $mapperArgs += "--include-empty"
}

Write-Host "[INFO] Ejecutando mapeador..."
& $PythonExe @mapperArgs
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

if ($RunTests) {
    if (-not (Test-Path $testsDir)) {
        Write-Error "Directorio de pruebas no encontrado: $testsDir"
    }
    Write-Host "[INFO] Ejecutando pruebas..."
    & $PythonExe -m unittest discover -s $testsDir -p "test_*.py"
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

Write-Host "[OK] Proceso completado."
