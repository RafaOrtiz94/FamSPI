# clean_deploy.ps1
Write-Host "🧹 Limpiando ambiente y caché..." -ForegroundColor Yellow

# 1. Eliminar variables de entorno que puedan estar en memoria (PowerShell)
Remove-Item Env:\REACT_APP_API_ABSOLUTE_URL -ErrorAction SilentlyContinue
Remove-Item Env:\REACT_APP_API_BASE_URL -ErrorAction SilentlyContinue
Write-Host "✅ Variables de entorno limpiadas (eliminando overrides de consola)."

# 2. Limpiar cache de node y carpeta build
Remove-Item -Path "build" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "node_modules/.cache" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "✅ Carpeta build y caché eliminados."

# 3. Construir
Write-Host "🏗️  Construyendo frontend (tomando variables frescas de .env)..." -ForegroundColor Cyan
$env:CI = "false"
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "🚀 Desplegando a Firebase..." -ForegroundColor Green
    firebase deploy
} else {
    Write-Host "❌ Error en el build. Verifique los logs." -ForegroundColor Red
    exit 1
}
