@echo off
echo ============================================
echo 🚀 INICIANDO SISTEMA SPI-DEV (LAN TESTING)
echo ============================================
echo.

echo 📦 PASO 1: Construyendo frontend...
echo.
cd spi_front
call npm run build:spi-dev
if %errorlevel% neq 0 (
    echo ❌ Error al construir el frontend
    pause
    exit /b 1
)
cd ..
echo ✅ Frontend construido correctamente
echo.

echo 🖥️ PASO 2: Iniciando backend en modo SPI-DEV...
echo.
start "SPI-DEV Backend" cmd /k "cd backend && npm run start:spi-dev"
timeout /t 5 /nobreak > nul
echo ✅ Backend iniciado en segundo plano
echo.

echo 🌐 PASO 3: Iniciando Caddy server...
echo.
call .\caddy.exe run --config ops\Caddyfile
echo ✅ Sistema SPI-DEV listo!
echo.

echo ============================================
echo 🎯 ACCESO A LA APLICACIÓN:
echo ============================================
echo 🔗 https://spi-dev.famproject.com.ec
echo.
echo 📋 Verificar que funciona:
echo - Backend: curl http://localhost:3000/api/v1/health
echo - Frontend: curl -I https://spi-dev.famproject.com.ec/
echo - OAuth: Probar login desde otro equipo en LAN
echo ============================================

pause
