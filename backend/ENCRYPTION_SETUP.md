# Configuración de Encriptación

## Agregar al archivo .env del backend:

```env
# Clave de encriptación AES-256 (64 caracteres hexadecimales)
ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

## Generar una clave segura:

Puedes generar una clave aleatoria ejecutando este comando en Node.js:

```javascript
const crypto = require('crypto');
console.log(crypto.randomBytes(32).toString('hex'));
```

O en PowerShell:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## ⚠️ IMPORTANTE:
- La clave DEBE tener exactamente 64 caracteres hexadecimales (0-9, a-f)
- NUNCA compartas esta clave
- NUNCA la subas a repositorios públicos
- Si cambias la clave, los datos ya encriptados NO podrán desencriptarse
- Guarda una copia de respaldo segura de esta clave
