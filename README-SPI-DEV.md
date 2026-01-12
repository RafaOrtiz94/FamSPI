# 🚀 SPI-DEV: Sistema de Pruebas LAN con OAuth Google

## 📋 Descripción
Configuración completa para ejecutar SPI en modo pruebas LAN con dominio HTTPS, compatible con OAuth Google multiusuario.

## 🛠️ Requisitos Previos

### 1. Certificados SSL (ya generados)
- `ops/certs/spi-dev.famproject.com.ec.pem`
- `ops/certs/spi-dev.famproject.com.ec-key.pem`

### 2. Ejecutables
- `caddy.exe` en la raíz del proyecto
- Node.js y npm instalados

### 3. DNS Local (opcional)
```bash
# Agregar a C:\Windows\System32\drivers\etc\hosts
192.168.100.121    spi-dev.famproject.com.ec
```

## 🚀 Inicio Rápido

### Opción A: Script Maestro (Recomendado)
```bash
# Desde la raíz del proyecto
./start-spi-dev.bat
```

### Opción B: Pasos Manuales
```bash
# 1. Construir frontend
cd spi_front
npm run build:spi-dev
cd ..

# 2. Iniciar backend (terminal 1)
cd backend
npm run start:spi-dev

# 3. Iniciar Caddy (terminal 2)
.\caddy.exe run --config ops\Caddyfile
```

## 🔗 Acceso a la Aplicación

**URL Principal:** `https://spi-dev.famproject.com.ec`

**Verificaciones:**
- Backend: `curl http://localhost:3000/api/v1/health`
- Frontend: `curl -I https://spi-dev.famproject.com.ec/`
- API: Las llamadas `/api/*` se redirigen al backend

## 🔐 Configuración OAuth Google

### Google Cloud Console - Authorized JavaScript origins:
```
http://localhost:3001
https://spi-dev.famproject.com.ec
```

### Google Cloud Console - Authorized redirect URIs:
```
http://localhost:3000/api/v1/auth/google/callback
https://spi-dev.famproject.com.ec/api/v1/auth/google/callback
http://localhost:3000/api/v1/gmail/auth/callback
https://spi-dev.famproject.com.ec/api/v1/gmail/auth/callback
```

## 🏗️ Arquitectura

```
Equipos LAN ──── HTTPS ──── Caddy ──── HTTP ──── Backend
                    │           │
                 SSL/TLS    API Proxy
                 Static     /api/* → :3000
                 Files      Static → build/
```

## 📁 Archivos de Configuración

### Backend
- `backend/.env.spi-dev` - Variables para modo pruebas
- `backend/package.json` - Script `start:spi-dev`

### Frontend
- `spi_front/.env.production.local` - API absoluta para build
- `spi_front/package.json` - Script `build:spi-dev`

### Servidor
- `ops/Caddyfile` - Configuración HTTPS + proxy
- `ops/start-caddy.bat` - Script de inicio con validaciones

### Scripts Maestros
- `start-spi-dev.bat` - Inicio completo automatizado

## 🔧 Solución de Problemas

### Caddy no inicia
```bash
# Verificar que existe
ls -la .\caddy.exe

# Verificar build
ls -la spi_front/build/index.html

# Verificar certificados
ls -la ops/certs/

# Ejecutar manualmente
.\caddy.exe run --config ops\Caddyfile
```

### Errores de conexión
```bash
# Verificar backend
curl http://localhost:3000/api/v1/health

# Verificar frontend
curl -k https://spi-dev.famproject.com.ec/
```

### OAuth no funciona
- Verificar que las URLs en Google Console coincidan exactamente
- Verificar que el dominio `spi-dev.famproject.com.ec` sea accesible desde otros equipos

## 🎯 Características

✅ **OAuth Google funcional** en HTTPS
✅ **Pruebas multiusuario** desde equipos LAN
✅ **Sin problemas WebSocket** (build estático)
✅ **API proxy automático** `/api/*` → backend
✅ **Configuración automática** con scripts
✅ **Compatible con desarrollo local** (no interfiere)

## 📞 Soporte

Si hay problemas:
1. Verificar logs de Caddy en la terminal
2. Verificar logs del backend
3. Confirmar que todos los archivos existen
4. Probar desde otro equipo en la red LAN4. Probar desde otro equipo en la red LAN
