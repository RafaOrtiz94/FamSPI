# SPI-DEV: entorno de pruebas LAN con OAuth Google

## Descripcion
Configuracion para ejecutar SPI en modo pruebas LAN con HTTPS y OAuth Google multiusuario.

## Requisitos previos
- Certificados SSL en ops/certs/
- caddy.exe en la raiz del proyecto
- Node.js y npm instalados

## Inicio rapido
Opcion A:
- ejecutar start-spi-dev.bat

Opcion B:
- construir frontend con npm run build:spi-dev dentro de spi_front
- iniciar backend con npm run start:spi-dev dentro de backend
- iniciar Caddy con caddy.exe run --config ops/Caddyfile

## Acceso
- URL principal: https://spi-dev.famproject.com.ec
- Backend: http://localhost:3000/api/v1/health
- Frontend: https://spi-dev.famproject.com.ec/

## OAuth Google
Authorized JavaScript origins:
- http://localhost:3001
- https://spi-dev.famproject.com.ec

Authorized redirect URIs:
- http://localhost:3000/api/v1/auth/google/callback
- https://spi-dev.famproject.com.ec/api/v1/auth/google/callback
- http://localhost:3000/api/v1/gmail/auth/callback
- https://spi-dev.famproject.com.ec/api/v1/gmail/auth/callback

## Archivos relevantes
- backend/.env.spi-dev
- spi_front/.env.production.local
- ops/Caddyfile
- ops/start-caddy.bat
- start-spi-dev.bat
