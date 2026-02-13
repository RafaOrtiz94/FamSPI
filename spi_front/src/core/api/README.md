# Sistema de Actualizaciones Automáticas

## 🎯 Descripción
Sistema inteligente de actualizaciones automáticas que mantiene la UI sincronizada con el backend sin generar loops infinitos ni sobrecargar el servidor.

## 📋 Características

### ✅ **Actualizaciones Automáticas**
- Polling cada 30 segundos para datos frescos
- Eventos en tiempo real cuando cambian datos críticos
- Cache inteligente para reducir requests
- Sin loops infinitos

### ✅ **Optimización de Performance**
- Cache de 30 segundos para evitar requests duplicados
- Debounce de 1 segundo para eventos consecutivos
- Auto-limpieza de cache antiguo
- Suscripción selectiva por componente

### ✅ **Gestión Inteligente de Recursos**
- Inicio automático al hacer login
- Detención automática al hacer logout
- Limpieza automática de timers
- Gestión de memoria eficiente

## 🚀 Uso Básico

### 1. Importar el Hook
```javascript
import { useAutoUpdate } from "../../api/index";
```

### 2. Usar en Componentes
```javascript
const MyComponent = () => {
  const [data, setData] = useState([]);

  // Actualización automática cada 30s
  useAutoUpdate(() => {
    loadFreshData();
  }, []); // dependencies

  const loadFreshData = async () => {
    const freshData = await apiCall();
    setData(freshData);
  };

  return <div>{/* UI */}</div>;
};
```

## 🔧 API Reference

### `useAutoUpdate(callback, dependencies)`
Hook personalizado para actualizaciones automáticas.

**Parámetros:**
- `callback`: Función a ejecutar cuando hay actualizaciones
- `dependencies`: Array de dependencias (como en useEffect)

**Ejemplo:**
```javascript
useAutoUpdate(() => {
  // Código de actualización
  refreshData();
}, [userId]); // Se ejecuta cuando userId cambia
```

### `startAutoUpdates()`
Inicia el sistema de polling automático (30s).

### `stopAutoUpdates()`
Detiene el sistema de polling automático.

### `eventEmitter`
Instancia del EventEmitter para eventos personalizados.

## 🎨 Ejemplos de Implementación

### AttendanceWidget
```javascript
// Actualización automática de asistencia
useAutoUpdate(() => {
  loadAttendance();
  fetchException();
}, []);
```

### ClientRequestWidget
```javascript
// Actualización automática de solicitudes
useAutoUpdate(() => {
  if (user) {
    loadMyRequests();
  }
}, [user]);
```


### Para Usuarios
- ✅ **Sin recargas manuales**: UI siempre actualizada
- ✅ **Experiencia fluida**: Cambios aparecen automáticamente
- ✅ **Tiempo real**: Notificaciones instantáneas

### Para Desarrolladores
- ✅ **Sin loops**: Sistema inteligente evita ciclos infinitos
- ✅ **Performance**: Cache y debouncing optimizan recursos
- ✅ **Mantenible**: Código limpio y reutilizable
- ✅ **Escalable**: Fácil agregar nuevos componentes

### Para el Sistema
- ✅ **Menos carga**: Cache reduce requests al servidor
- ✅ **Eficiencia**: Solo actualiza lo necesario
- ✅ **Estabilidad**: Gestión automática de recursos

## 🚨 Consideraciones Importantes

### Evitar Loops
- ✅ **Debouncing**: Eventos consecutivos se agrupan
- ✅ **Cache**: Evita requests duplicados
- ✅ **Condicionales**: Verificar estado antes de actualizar

### Performance
- ✅ **Polling moderado**: 30 segundos es suficiente
- ✅ **Cache agresivo**: 30 segundos de validez
- ✅ **Limpieza automática**: Recursos se liberan correctamente

### Manejo de Errores
- ✅ **Try/catch**: Envolver callbacks en bloques try/catch
- ✅ **Fallbacks**: Mostrar datos antiguos si falla la actualización
- ✅ **Logging**: Registrar errores para debugging

## 🔧 Configuración Avanzada

### Personalizar Intervalos
```javascript
// En api/index.js
const UPDATE_INTERVAL = 60000; // 1 minuto
const CACHE_DURATION = 60000; // 1 minuto
```

### Eventos Personalizados
```javascript
// Emitir evento personalizado
eventEmitter.emit('custom-event', data);

// Suscribirse a evento personalizado
useAutoUpdate(() => {
  // Manejar evento personalizado
}, []);
```

### Cache Personalizado
```javascript
// Cache por endpoint específico
const cachedResponse = getCachedResponse(`GET:/api/users/${userId}`);
```

## 🧪 Testing

### Verificar Actualizaciones
1. Abrir múltiples pestañas del mismo componente
2. Realizar cambios en una pestaña
3. Verificar que otras pestañas se actualizan automáticamente

### Verificar Performance
1. Monitorear network tab en DevTools
2. Verificar que no hay requests duplicados
3. Confirmar cache está funcionando

### Verificar Sin Loops
1. Dejar componente abierto por tiempo prolongado
2. Verificar que no hay aumento anormal de requests
3. Confirmar que CPU y memoria se mantienen estables

---

## 📚 Más Información

- **Documentación API**: `src/core/api/`
- **Ejemplos**: Ver AttendanceWidget y ClientRequestWidget
- **Configuración**: Variables en `src/core/api/index.js`

---

*Sistema implementado para optimizar la experiencia de usuario sin comprometer la performance del sistema.*

