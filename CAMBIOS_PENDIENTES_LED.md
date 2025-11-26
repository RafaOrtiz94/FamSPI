# Cambios Pendientes - Diseño LED y Tipo de Producto

## ✅ COMPLETADO
1. **STATUS_CONFIG** - Configuración de colores para LED y tarjetas

## 📝 PENDIENTE - Aplicar Manualmente

### 1. Actualizar el Estado del Formulario (Línea ~34)

**Cambiar:**
```javascript
const [form, setForm] = useState({ clientId: "", providerEmail: "", equipmentIds: [], notes: "" });
```

**Por:**
```javascript
const [form, setForm] = useState({ clientId: "", providerEmail: "", equipment: [], notes: "" });
```

### 2. Actualizar toggleEquipment (Línea ~72)

**Cambiar:**
```javascript
const toggleEquipment = (id) => {
  setForm((prev) => {
    const exists = prev.equipmentIds.includes(id);
    return {
      ...prev,
      equipmentIds: exists
        ? prev.equipmentIds.filter((x) => x !== id)
        : [...prev.equipmentIds, id],
    };
  });
};
```

**Por:**
```javascript
const toggleEquipment = (id) => {
  setForm((prev) => {
    const exists = prev.equipment.find((eq) => eq.id === id);
    return {
      ...prev,
      equipment: exists
        ? prev.equipment.filter((x) => x.id !== id)
        : [...prev.equipment, { id, type: "new" }],
    };
  });
};

const updateEquipmentType = (id, type) => {
  setForm((prev) => ({
    ...prev,
    equipment: prev.equipment.map((eq) => 
      eq.id === id ? { ...eq, type } : eq
    ),
  }));
};
```

### 3. Actualizar handleCreate (Línea ~84)

**Cambiar:**
```javascript
if (!form.clientId || !form.providerEmail || !form.equipmentIds.length) {
  showToast("Cliente, proveedor y equipos son obligatorios", "warning");
  return;
}
// ...
const equipmentPayload = meta.equipment
  .filter((eq) => form.equipmentIds.includes(eq.id))
  .map((eq) => ({ id: eq.id, name: eq.name, sku: eq.sku, serial: eq.serial }));
```

**Por:**
```javascript
if (!form.clientId || !form.providerEmail || !form.equipment.length) {
  showToast("Cliente, proveedor y equipos son obligatorios", "warning");
  return;
}
// ...
const equipmentPayload = form.equipment.map((formEq) => {
  const eq = meta.equipment.find((e) => e.id === formEq.id);
  return { 
    id: eq.id, 
    name: eq.name, 
    sku: eq.sku, 
    serial: eq.serial,
    type: formEq.type 
  };
});
```

Y también cambiar:
```javascript
setForm({ clientId: "", providerEmail: "", equipmentIds: [], notes: "" });
```

Por:
```javascript
setForm({ clientId: "", providerEmail: "", equipment: [], notes: "" });
```

### 4. Actualizar la Lista de Equipos en el Formulario (Línea ~230)

**Cambiar:**
```javascript
<div className="grid grid-cols-1 md:grid-cols-3 gap-2 max-h-48 overflow-auto border rounded-lg p-3">
  {meta.equipment.map((eq) => (
    <label key={eq.id} className="flex items-start gap-2 text-sm text-gray-700">
      <input
        type="checkbox"
        checked={form.equipmentIds.includes(eq.id)}
        onChange={() => toggleEquipment(eq.id)}
      />
      <div>
        <p className="font-medium">{eq.name}</p>
        <p className="text-xs text-gray-500">SKU: {eq.sku} {eq.serial ? `| Serie ${eq.serial}` : ""}</p>
      </div>
    </label>
  ))}
</div>
```

**Por:**
```javascript
<div className="grid grid-cols-1 gap-3 max-h-64 overflow-auto border rounded-lg p-3">
  {meta.equipment.map((eq) => {
    const selected = form.equipment.find((e) => e.id === eq.id);
    return (
      <div key={eq.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${selected ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'}`}>
        <input
          type="checkbox"
          checked={!!selected}
          onChange={() => toggleEquipment(eq.id)}
          className="w-4 h-4"
        />
        <div className="flex-1">
          <p className="font-medium text-sm">{eq.name}</p>
          <p className="text-xs text-gray-500">SKU: {eq.sku} {eq.serial ? `| Serie ${eq.serial}` : ""}</p>
        </div>
        {selected && (
          <div className="flex gap-2">
            <button
              onClick={() => updateEquipmentType(eq.id, "new")}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-all ${
                selected.type === "new" 
                  ? 'bg-green-500 text-white shadow-md' 
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              Nuevo
            </button>
            <button
              onClick={() => updateEquipmentType(eq.id, "cu")}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-all ${
                selected.type === "cu" 
                  ? 'bg-blue-500 text-white shadow-md' 
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              CU
            </button>
          </div>
        )}
      </div>
    );
  })}
</div>
```

### 5. Actualizar el Renderizado de Tarjetas con LED (Línea ~270)

Buscar donde dice:
```javascript
{requests.map((req) => (
  <tr key={req.id} className="border-b">
```

Y reemplazar toda la sección de la tabla por tarjetas con LED. Ver archivo `EJEMPLO_TARJETA_LED.md` para el código completo.

## Resumen
- ✅ STATUS_CONFIG aplicado
- ⏳ Cambios de formulario pendientes
- ⏳ Tarjetas con LED pendientes

Aplica estos cambios manualmente o avísame si quieres que continúe con los reemplazos.
