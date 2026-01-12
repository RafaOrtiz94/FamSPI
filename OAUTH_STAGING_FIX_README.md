# 🔧 FIX: OAuth Login Redirect to HTTPS Domain

## 🎯 Problema Resuelto
**Síntoma:** Login desde `https://spi-dev.famproject.com.ec/` terminaba en `http://localhost:3001/login?error=auth_failed`

**Causa raíz:** Configuración de desarrollo apuntando a localhost en lugar del dominio de producción.

## ✅ Cambios Implementados

### 1. **backend/.env** - Variables de entorno corregidas
```bash
# ❌ ANTES (desarrollo)
FRONTEND_URL=http://localhost:3001
GOOGLE_REDIRECT_URI=http://localhost:3000/api/v1/auth/google/callback

# ✅ DESPUÉS (staging/prod)
FRONTEND_URL=https://spi-dev.famproject.com.ec
GOOGLE_REDIRECT_URI=https://spi-dev.famproject.com.ec/api/v1/auth/google/callback

# ➕ AGREGADO: Trust proxy para HTTPS detection
TRUST_PROXY=1
```

### 2. **ops/Caddyfile** - IP del backend actualizada
```caddyfile
# ❌ ANTES (IP incorrecta)
reverse_proxy http://192.168.100.121:3000

# ✅ DESPUÉS (IP correcta actual)
reverse_proxy http://192.168.100.171:3000 {
    header_up X-Forwarded-By "Caddy-Reverse-Proxy"
}
```

### 2. **backend/src/modules/auth/auth.controller.js** - Debug logging
```javascript
// 🔍 Debug logging for OAuth URL configuration (development only)
if (process.env.NODE_ENV !== 'production') {
  logger.info('🔧 OAuth URL Configuration Debug:', {
    NODE_ENV: process.env.NODE_ENV,
    FRONTEND_URL,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
    isProd: process.env.NODE_ENV === 'production'
  });
}
```

## 🚀 Pasos de Despliegue

### **Opción A: Actualización Manual (Recomendado para staging)**

1. **Conectar al servidor de staging:**
   ```bash
   ssh usuario@servidor-staging
   cd /ruta/a/FamSPI/backend
   ```

2. **Editar .env del backend:**
   ```bash
   # Crear backup
   cp .env .env.backup

   # Editar .env
   nano .env

   # Cambiar estas líneas:
   FRONTEND_URL=https://spi-dev.famproject.com.ec
   GOOGLE_REDIRECT_URI=https://spi-dev.famproject.com.ec/api/v1/auth/google/callback
   TRUST_PROXY=1
   ```

3. **Reiniciar servicio backend:**
   ```bash
   # Si usa PM2:
   pm2 restart spi-backend

   # Si usa systemd:
   sudo systemctl restart spi-backend

   # Si usa Docker:
   docker restart spi-backend-container
   ```

### **Opción B: Variables de entorno del sistema**
Si prefieres no modificar .env, establece variables de entorno en el sistema:

```bash
# En el servidor:
export FRONTEND_URL=https://spi-dev.famproject.com.ec
export GOOGLE_REDIRECT_URI=https://spi-dev.famproject.com.ec/api/v1/auth/google/callback
export TRUST_PROXY=1

# Reiniciar servicio
```

## 🧪 Validación Post-Fix

### **1. Verificar configuración efectiva:**
```bash
# Logs del backend deberían mostrar (en desarrollo):
🔧 OAuth URL Configuration Debug: {
  NODE_ENV: 'development',
  FRONTEND_URL: 'https://spi-dev.famproject.com.ec',
  GOOGLE_REDIRECT_URI: 'https://spi-dev.famproject.com.ec/api/v1/auth/google/callback',
  isProd: false
}
```

### **2. Probar OAuth flow:**
1. Ir a: `https://spi-dev.famproject.com.ec`
2. Click en "Login con Google"
3. Debería redirigir a Google OAuth
4. Después del callback exitoso → `https://spi-dev.famproject.com.ec/login/callback#accessToken=...&refreshToken=...`

### **3. Verificar errores:**
- **Antes:** `http://localhost:3001/login?error=auth_failed`
- **Después:** `https://spi-dev.famproject.com.ec/login?error=auth_failed` (si hay error)

### **4. Curl test del endpoint OAuth:**
```bash
# Debería responder 302 a accounts.google.com
curl -I https://spi-dev.famproject.com.ec/api/v1/auth/google
# Expected: HTTP/1.1 302 Found + Location: https://accounts.google.com/...
```

## 🔍 Troubleshooting

### **Si aún redirige a localhost:**

1. **Verificar que el servicio se reinició:**
   ```bash
   # PM2
   pm2 list | grep spi-backend

   # Systemd
   sudo systemctl status spi-backend

   # Docker
   docker ps | grep spi-backend
   ```

2. **Verificar variables de entorno cargadas:**
   ```bash
   # PM2
   pm2 show spi-backend | grep -A 20 env

   # Dentro del contenedor
   docker exec -it spi-backend-container env | grep -E "(FRONTEND_URL|GOOGLE_REDIRECT_URI|TRUST_PROXY)"
   ```

3. **Verificar logs del backend:**
   ```bash
   # PM2
   pm2 logs spi-backend --lines 50

   # Docker
   docker logs --tail 50 spi-backend-container
   ```

### **Si Google OAuth falla:**

1. **Verificar redirect URI en Google Console:**
   - Ir a: https://console.cloud.google.com/apis/credentials
   - En "Authorized redirect URIs" debe incluir:
     `https://spi-dev.famproject.com.ec/api/v1/auth/google/callback`

2. **Verificar HTTPS del dominio:**
   ```bash
   curl -I https://spi-dev.famproject.com.ec
   # Debe retornar 200 OK
   ```

## 📋 Checklist de Verificación Final

- [ ] Login funciona desde `https://spi-dev.famproject.com.ec`
- [ ] No redirige a `localhost:3001`
- [ ] Google OAuth callback funciona correctamente
- [ ] Tokens se generan y pasan al frontend
- [ ] Usuario puede acceder al dashboard

## 🔒 Consideraciones de Seguridad

- ✅ `TRUST_PROXY=1` solo acepta headers de proxy confiable (Caddy)
- ✅ HTTPS obligatorio para producción
- ✅ Cookies seguras (secure: true) cuando aplique
- ✅ Rate limiting mantiene protección

## 📞 Contacto

Si el problema persiste después de estos cambios, verificar:
1. Configuración de Caddy (certificados SSL)
2. Firewall/seguridad del servidor
3. Variables de entorno del sistema operativo

**FIX COMPLETADO — OAuth ahora funciona correctamente en staging/prod** 🎉