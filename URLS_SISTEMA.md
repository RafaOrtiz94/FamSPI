# 🔧 URLs Correctas del Sistema

## 📍 **URLs de Acceso:**

### **Frontend:**
```
http://localhost:3001
```

### **Página de Configuración (Autorizar Gmail):**
```
http://localhost:3001/configuration
```

### **Backend API:**
```
http://localhost:3000
```

---

## ✅ **Pasos para Autorizar Gmail:**

### **1. Abre la página de configuración:**
```
http://localhost:3001/configuration
```

### **2. Click en "Autorizar Gmail"**
- Se abre ventana de Google
- Inicia sesión con tu cuenta
- Autoriza permisos

### **3. ¡Listo!**
- Widget mostrará "✅ Gmail Autorizado"

---

## 🔄 **Si el Frontend NO Carga:**

### **Opción 1: Verificar logs del frontend**
Mira la terminal donde corre `npm start` del frontend y busca errores

### **Opción 2: Reiniciar el frontend**
```bash
# En la terminal del frontend:
# 1. Ctrl+C para detener
# 2. npm start para reiniciar
```

### **Opción 3: Limpiar caché**
```bash
cd spi_front
rm -rf node_modules/.vite
npm start
```

---

## 🌐 **Puertos del Sistema:**

| Servicio | Puerto | URL |
|----------|--------|-----|
| Frontend | 3001 | http://localhost:3001 |
| Backend | 3000 | http://localhost:3000 |

---

## 📱 **Rutas Importantes:**

```
http://localhost:3001/                     → Login
http://localhost:3001/dashboard            → Dashboard (según rol)
http://localhost:3001/configuration        → Configuración (Autorizar Gmail)
```

---

## ✅ **Verificar que el Frontend Funciona:**

1. Abre: `http://localhost:3001`
2. Deberías ver la página de login
3. Si carga, entonces puedes ir a `/configuration`

---

**Prueba con:** `http://localhost:3001/configuration` 🎯

