# Nuevo Diseño Visual - LED de Estado

## Cambios Aplicados

### 1. LED/Semáforo de Estado
- **Ubicación**: Esquina superior derecha de cada tarjeta
- **Animación**: Efecto de pulso continuo
- **Colores intensos** según el estado:
  - 🟡 Amber (500) - Esperando respuesta
  - 🔴 Rojo (600) - Sin stock  
  - 🔵 Azul (500) - Solicitando proforma
  - 🟣 Índigo (500) - Proforma recibida
  - 🟣 Púrpura (500) - Esperando proforma firmada
  - 🟠 Naranja (500) - Pendiente contrato
  - 🟢 Verde (500) - Completado

### 2. Reflejo del Color en la Tarjeta
- **Gradiente suave** que refleja el color del LED
- **Borde izquierdo** con color intenso (border-l-4)
- **Sombra** con tinte del color del estado

### 3. Efectos Visuales
- **LED con 3 capas**:
  1. Círculo base con color sólido
  2. Anillo de pulso (animate-ping)
  3. Brillo interno (blur-sm)
  
- **Badge de estado** en la parte inferior con:
  - Fondo del color del estado
  - Icono representativo
  - Texto descriptivo

## Nota
El archivo fue restaurado desde Git debido a errores en el reemplazo.
Se requiere aplicar los cambios manualmente o con un enfoque diferente.

## Próximos Pasos
1. Aplicar cambios al STATUS_CONFIG
2. Actualizar el renderizado de tarjetas con el LED
3. Probar en el navegador
