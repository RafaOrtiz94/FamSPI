# 🔐 OAuth Google LAN - SPI Development Setup
> Guía completa para configurar OAuth Google funcional en LAN sin usar localhost

## 📋 Información General

- **Hostname**: `spi-dev.famproject.com.ec`
- **Frontend**: `https://spi-dev.famproject.com.ec/` (puerto 443)
- **Backend**: `https://spi-dev.famproject.com.ec/api/v1` (puerto 3000)
- **IP actual**: `192.168.100.121` (puede cambiar)
- **Reverse Proxy**: Caddy con TLS local
- **DNS**: Configurado via hosts file o router

## 📁 Archivos Creados/Modificados

### Backend
- `backend/.env.lan` - Configuración OAuth LAN
- `backend/start-lan.ps1` - Script para cargar .env.lan
- `backend/package.json` - Comando `start:lan` actualizado

### Frontend
- `spi_front/.env.lan` - Configuración API HTTPS
- `spi_front/package.json` - Comando `start:lan` (ya existía)

### Ops/Infrastructure
- `ops/Caddyfile` - Configuración reverse proxy HTTPS
- `ops/dns-setup.ps1` - Script configuración DNS
- `ops/README-OAUTH-LAN.md` - Esta documentación

## 🚀 Inicio Rápido

### Paso 1: Instalar mkcert y configurar certificados

```bash
# Instalar mkcert (si no lo tienes)
choco install mkcert
# o descargar desde: https://github.com/FiloSottile/mkcert/releases

# Instalar CA local
mkcert -install

# Generar certificado para el hostname
mkdir ops\certs
mkcert -cert-file ops\certs\spi-dev.famproject.com.ec.pem -key-file ops\certs\spi-dev.famproject.com.ec-key.pem spi-dev.famproject.com.ec
```

### Paso 2: Configurar DNS en LAN

```bash
# Ejecutar script de configuración DNS
powershell -ExecutionPolicy Bypass -File ops\dns-setup.ps1
```

**Opciones disponibles:**
1. **Archivo hosts** (recomendado): Agrega entrada en `C:\Windows\System32\drivers\etc\hosts`
2. **Acrylic DNS**: Para múltiples dispositivos
3. **Router DNS**: Para configuración permanente

### Paso 3: Instalar y configurar Caddy

```bash
# Descargar Caddy para Windows
# https://caddyserver.com/download

# Crear directorio para logs
mkdir ops\logs

# Ejecutar Caddy con la configuración
caddy run --config ops\Caddyfile
```

### Paso 4: Configurar Google Cloud Console

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Seleccionar tu proyecto OAuth
3. Ir a "APIs & Services" > "Credentials"
4. Editar el "OAuth 2.0 Client ID" (Web application)

**Authorized JavaScript origins:**
```
https://spi-dev.famproject.com.ec
```

**Authorized redirect URIs:**
```
https://spi-dev.famproject.com.ec/api/v1/auth/google/callback
https://spi-dev.famproject.com.ec/api/v1/gmail/auth/callback
```

### Paso 5: Configurar credenciales

```bash
# Editar backend/.env.lan
code backend\.env.lan

# Agregar tus credenciales de Google:
GOOGLE_CLIENT_ID=tu_google_client_id_aqui
GOOGLE_CLIENT_SECRET=tu_google_client_secret_aqui
```

### Paso 6: Iniciar servicios

**Terminal 1 - Backend:**
```bash
cd backend
npm run start:lan
```

**Terminal 2 - Frontend:**
```bash
cd spi_front
npm run start:lan
```

### Paso 7: Verificar funcionamiento

1. Abrir `https://spi-dev.famproject.com.ec` en el navegador
2. Intentar login con Google
3. Verificar que el callback funciona correctamente

## 🔧 Configuración Detallada

### Certificados TLS (mkcert)

```bash
# Instalar mkcert
choco install mkcert

# Instalar Certificate Authority local
mkcert -install

# Generar certificado para el dominio
mkcert -cert-file ops\certs\spi-dev.famproject.com.ec.pem -key-file ops\certs\spi-dev.famproject.com.ec-key.pem spi-dev.famproject.com.ec

# Verificar certificado
openssl x509 -in ops\certs\spi-dev.famproject.com.ec.pem -text -noout
```

**Nota**: Si cambias de máquina, debes regenerar los certificados.

### Configuración DNS

#### Opción 1: Archivo hosts (Más simple)

```bash
# Editar C:\Windows\System32\drivers\etc\hosts (como administrador)
notepad C:\Windows\System32\drivers\etc\hosts

# Agregar línea:
192.168.100.121    spi-dev.famproject.com.ec
```

#### Opción 2: Acrylic DNS (Para múltiples dispositivos)

```bash
# Descargar Acrylic DNS
# https://mayakron.altervista.org/support/acrylic/Home.htm

# Configurar AcrylicHosts.txt:
192.168.100.121    spi-dev.famproject.com.ec

# Reiniciar Acrylic DNS
```

#### Opción 3: DNS del Router (Más permanente)

1. Acceder al panel de administración del router
2. Ir a Configuración > Red > DNS
3. Agregar registro A:
   - Nombre: `spi-dev.famproject.com.ec`
   - IP: `192.168.100.121`

### Configuración Caddy

El archivo `ops/Caddyfile` ya está configurado. Solo ejecuta:

```bash
# Desde el directorio raíz del proyecto
caddy run --config ops\Caddyfile
```

**Características del proxy:**
- HTTPS automático con certificado local
- Redirección HTTP → HTTPS
- WebSocket support para React HMR
- Health check endpoint: `https://spi-dev.famproject.com.ec/health`
- Logs en `ops/logs/caddy.log`

### Configuración Google Console

1. Ir a https://console.cloud.google.com/
2. Seleccionar proyecto
3. APIs & Services > Credentials
4. Editar OAuth 2.0 Client ID

**Configuración requerida:**

```
Authorized JavaScript origins:
https://spi-dev.famproject.com.ec

Authorized redirect URIs:
https://spi-dev.famproject.com.ec/api/v1/auth/google/callback
https://spi-dev.famproject.com.ec/api/v1/gmail/auth/callback
```

## 📱 Configuración en Dispositivos Móviles

### Android
1. Conectar al WiFi de la LAN
2. Configuración WiFi > Modificar red
3. Avanzado > Configuración IP > Estático
4. DNS: `192.168.100.121`

**O usar app DNS Changer:**
- Instalar "DNS Changer" desde Play Store
- Configurar DNS: `192.168.100.121`

### iOS
1. Configuración > WiFi > Nombre de red
2. DNS: `192.168.100.121`

### Confiar certificado local

**Windows:**
```bash
# Ejecutar como administrador
certlm.msc
# Importar ops\certs\spi-dev.famproject.com.ec.pem a "Trusted Root Certification Authorities"
```

**Android:**
- Abrir certificado en navegador
- Instalar certificado
- Configurar como CA raíz

**iOS:**
- Enviar certificado por email
- Abrir adjunto e instalar
- Configuración > General > Información > Confianza en certificados

## 🔄 Cambios de IP LAN

Cuando cambie tu IP LAN (ej: 192.168.100.121 → 192.168.100.122):

1. **Actualizar DNS:**
```bash
# Ejecutar script de actualización
powershell -ExecutionPolicy Bypass -File ops\dns-setup.ps1 -IPAddress "192.168.100.122"
```

2. **Reiniciar servicios:**
```bash
# Reiniciar Caddy si es necesario
# Los servicios de Node.js se reinician automáticamente
```

## 🧪 Verificación End-to-End

### Checklist técnico:

- [ ] `https://spi-dev.famproject.com.ec` carga correctamente
- [ ] `https://spi-dev.famproject.com.ec/api/v1/health` responde OK
- [ ] Login Google redirige correctamente
- [ ] Callback URL coincide exactamente con Google Console
- [ ] No hay errores CORS en logs del backend
- [ ] WebSocket funciona (React HMR)

### Comandos de verificación:

```bash
# Verificar DNS
nslookup spi-dev.famproject.com.ec

# Verificar conectividad HTTPS
curl -I https://spi-dev.famproject.com.ec

# Verificar API
curl https://spi-dev.famproject.com.ec/api/v1/health
```

## 🚨 Troubleshooting

### redirect_uri_mismatch
```
Error: redirect_uri_mismatch
```
**Solución:**
- Verificar que la URL en Google Console sea exactamente:
  `https://spi-dev.famproject.com.ec/api/v1/auth/google/callback`
- Asegurarse de que no haya espacios o caracteres extra

### Certificado no confiable
```
NET::ERR_CERT_AUTHORITY_INVALID
```
**Solución:**
- Ejecutar `mkcert -install` para instalar CA local
- Reiniciar navegador
- Para móviles: Instalar certificado como CA raíz

### CORS bloqueado
```
Access to XMLHttpRequest has been blocked by CORS policy
```
**Solución:**
- Verificar que Caddy esté ejecutándose
- Verificar que el origin `https://spi-dev.famproject.com.ec` esté en CORS_ORIGINS
- Revisar logs de Caddy: `ops/logs/caddy.log`

### WebSockets no funcionan
```
WebSocket connection failed
```
**Solución:**
- Verificar configuración WebSocket en Caddyfile
- Verificar que React esté configurado con WDS_SOCKET_HOST correcto

### DNS no resuelve
```
ERR_NAME_NOT_RESOLVED
```
**Solución:**
- Verificar entrada en hosts file
- Reiniciar navegador y/o DNS cache: `ipconfig /flushdns`
- Verificar que Acrylic esté ejecutándose (si aplica)

## 🔙 Rollback a Modo Local

Para volver al desarrollo local sin HTTPS:

```bash
# Frontend (sin proxy)
cd spi_front
npm start

# Backend (sin proxy)
cd backend
npm start
```

**URLs locales:**
- Frontend: `http://localhost:3001`
- Backend: `http://localhost:3000/api/v1`

**No tocar:** Los archivos `.env.lan` se mantienen separados.

## 📞 Soporte

Si encuentras problemas:

1. Verificar logs de Caddy: `ops/logs/caddy.log`
2. Verificar logs del backend: Consola donde ejecutas `npm run start:lan`
3. Verificar configuración DNS: `ping spi-dev.famproject.com.ec`
4. Verificar certificados: `openssl verify ops/certs/spi-dev.famproject.com.ec.pem`

## 🎯 Resumen

✅ **Hostname HTTPS**: `spi-dev.famproject.com.ec`
✅ **OAuth Google funcional** en LAN
✅ **Reverse proxy Caddy** con TLS local
✅ **DNS configurable** (hosts/router/Acrylic)
✅ **Certificados mkcert** locales
✅ **Configuración móvil** incluida
✅ **Rollback seguro** a localhost

¡OAuth Google ahora funciona perfectamente en tu LAN! 🚀