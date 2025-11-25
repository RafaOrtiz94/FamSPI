# Implementación de Selección de Tipo de Equipo Individual

## Resumen
Se ha implementado un sistema de selección de tipo de equipo **individual** que permite al usuario especificar si cada equipo es **Nuevo** o **CU** (usado/reacondicionado) al crear una solicitud de compra en el dashboard ACP Comercial.

## Cambios Realizados

### Frontend

1. **Modificaciones en `EquipmentPurchaseWidget.jsx`**
   - **Nuevo sistema de selección de equipos**:
     - Dropdown para agregar equipos
     - Cards individuales para cada equipo seleccionado
     - Botones toggle para seleccionar tipo (Nuevo/CU) por equipo
     - Botón de eliminar para cada equipo
   
   - **Estado actualizado**:
     - `form.equipment` ahora es un array de objetos: `[{ id, type }]`
     - Cada equipo tiene su propio tipo independiente
   
   - **Tabla de solicitudes mejorada**:
     - Badges de tipo junto a cada equipo
     - Colores distintivos:
       - **Violeta (N)**: Equipo Nuevo
       - **Cyan (CU)**: Equipo CU

2. **Componente `EquipmentTypeModal.jsx`**
   - Ya no se utiliza (puede eliminarse)

### Backend

1. **Modificaciones en `equipmentPurchases.service.js`**
   - La función `createRequest` ahora:
     - Agrupa equipos por tipo para el email
     - Muestra secciones separadas para "Equipos Nuevos" y "Equipos CU"
     - Cada equipo en el array tiene su campo `type`

2. **Modificaciones en `equipmentPurchases.controller.js`**
   - Se eliminó el parámetro global `equipment_type`
   - Los tipos ahora vienen en el array de equipos

### Base de Datos

- La columna `equipment_type` se mantiene por compatibilidad
- El tipo real de cada equipo se almacena en el campo JSONB `equipment`
- Cada equipo tiene su propio campo `type` dentro del JSON

## Flujo de Usuario

1. El usuario ACP Comercial llena el formulario de solicitud de compra:
   - Selecciona cliente
   - Ingresa email del proveedor
   - **Agrega equipos uno por uno** usando el dropdown

2. Para cada equipo agregado:
   - Aparece una card con la información del equipo
   - El usuario puede seleccionar el tipo:
     - 📦 **Nuevo**: Botón violeta
     - 🔄 **CU**: Botón cyan
   - Por defecto, cada equipo se marca como "Nuevo"
   - Puede eliminar el equipo con el botón ✕

3. Agrega notas opcionales

4. Al hacer clic en "Enviar correo de disponibilidad":
   - La solicitud se crea inmediatamente
   - El correo se envía al proveedor con equipos agrupados por tipo

5. En la tabla de solicitudes:
   - Cada equipo muestra su badge de tipo (N o CU)

## Ejemplo de Email Generado

```html
<h2>Solicitud de disponibilidad</h2>
<p>Cliente: <strong>Empresa XYZ</strong></p>
<p>Equipos requeridos:</p>

<p><strong>Equipos Nuevos:</strong></p>
<p>
• Laptop Dell Latitude 5420<br>
• Monitor LG 24"
</p>

<p><strong>Equipos CU (Usados/Reacondicionados):</strong></p>
<p>
• Impresora HP LaserJet Pro<br>
• Teclado Logitech K380
</p>

<p>Notas: Urgente para nuevo empleado</p>
```

## Características Visuales

- **Cards de equipos** con diseño moderno
- **Botones toggle** con estados activo/inactivo
- **Badges compactos** en la tabla (N/CU)
- **Colores consistentes**:
  - Violeta para equipos nuevos
  - Cyan para equipos CU
- **Diseño responsive** que funciona en móviles y desktop

## Ventajas de esta Implementación

1. ✅ **Mayor flexibilidad**: Permite mezclar equipos nuevos y CU en una misma solicitud
2. ✅ **Más intuitivo**: El usuario ve y controla el tipo de cada equipo individualmente
3. ✅ **Mejor organización**: El email agrupa automáticamente por tipo
4. ✅ **Información clara**: Los badges en la tabla muestran el tipo de cada equipo
5. ✅ **Sin modales**: Flujo más directo sin interrupciones

## Notas Técnicas

- El campo `type` en cada equipo acepta valores: `'new'` o `'cu'`
- Valor por defecto: `'new'`
- El tipo se almacena en el array JSONB de equipos
- Compatible con solicitudes existentes
- La columna `equipment_type` se mantiene por compatibilidad pero ya no se usa activamente

## Migración de Datos

No se requiere migración adicional. Las solicitudes existentes seguirán funcionando normalmente.
