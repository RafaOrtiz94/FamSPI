@echo off
echo Iniciando Caddy server para SPI-DEV...
echo Verificando que el build del frontend existe...

if not exist "..\spi_front\build\index.html" (
    echo ERROR: Build del frontend no encontrado. Ejecuta primero:
    echo cd spi_front && npm run build:spi-dev
    pause
    exit /b 1
)

echo Build encontrado. Iniciando Caddy...
..\caddy.exe run --config Caddyfile

pause