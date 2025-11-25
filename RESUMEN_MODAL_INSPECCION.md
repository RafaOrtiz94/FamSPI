# Resumen de Implementación - Modal de Inspección de Ambiente

## ✅ Completado

### Backend
1. ✅ **Servicio** (`equipmentPurchases.service.js`):
   - Función `submitSignedProformaWithInspection` agregada
   - Llama a `uploadSignedProforma` 
   - Obtiene datos del cliente desde la base de datos
   - Crea automáticamente solicitud de inspección usando `requests.service`

2. ✅ **Controlador** (`equipmentPurchases.controller.js`):
   - Método `submitSignedProformaWithInspection` agregado
   - Extrae file y parámetros del body
   - Llama al servicio

3. ✅ **Rutas** (`equipmentPurchases.routes.js`):
   - Ruta `POST /:id/submit-signed-proforma-with-inspection` agregada
   - Protegida con `verifyToken` y `requireRole`
   - Usa `multer` para manejar file upload

### Frontend - API
4. ✅ **API** (`equipmentPurchasesApi.js`):
   - Función `submitSignedProformaWithInspection` agregada
   - Maneja FormData con file y parámetros

## ⏳ Pendiente - Frontend UI

### EquipmentPurchaseWidget.jsx

Necesitas modificar este archivo para:

1. **Importar la nueva función API**:
```javascript
import {
  // ... existing imports
  submitSignedProformaWithInspection,
} from "../../../core/api/equipmentPurchasesApi";
```

2. **Agregar estado para el modal**:
```javascript
const [inspectionModal, setInspectionModal] = useState({
  open: false,
  requestId: null,
  file: null,
  minDate: "",
  maxDate: "",
  includesKit: false
});
```

3. **Simplificar la sección `waiting_signed_proforma`** (reemplazar contenido actual):
```javascript
{req.status === "waiting_signed_proforma" && (
  <div className="space-y-2">
    <Button 
      size="sm" 
      fullWidth
      onClick={() => setInspectionModal({
        open: true,
        requestId: req.id,
        file: null,
        minDate: "",
        maxDate: "",
        includesKit: false
      })}
    >
      📄 Subir proforma firmada e inspección
    </Button>
  </div>
)}
```

4. **Crear handler para el modal**:
```javascript
const handleSubmitInspection = async () => {
  const { requestId, file, minDate, maxDate, includesKit } = inspectionModal;
  
  if (!file || !minDate || !maxDate) {
    showToast("Archivo y fechas son obligatorios", "warning");
    return;
  }

  try {
    await submitSignedProformaWithInspection(requestId, {
      file,
      inspection_min_date: minDate,
      inspection_max_date: maxDate,
      includes_starter_kit: includesKit
    });
    
    showToast("Proforma subida e inspección creada exitosamente", "success");
    setInspectionModal({ open: false, requestId: null, file: null, minDate: "", maxDate: "", includesKit: false });
    loadAll();
  } catch (error) {
    console.error(error);
    showToast("Error al procesar la solicitud", "error");
  }
};
```

5. **Agregar Modal al JSX** (antes del cierre del componente):
```javascript
{inspectionModal.open && (
  <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 backdrop-blur-sm">
    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
      <h3 className="text-lg font-semibold mb-4">Solicitud de Inspección de Ambiente</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Proforma firmada <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => setInspectionModal(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
            className="w-full text-sm"
          />
          {inspectionModal.file && (
            <p className="text-xs text-green-600 mt-1">✓ {inspectionModal.file.name}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fecha mínima de inspección <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={inspectionModal.minDate}
            onChange={(e) => setInspectionModal(prev => ({ ...prev, minDate: e.target.value }))}
            className="w-full border rounded-lg p-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fecha máxima de inspección <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={inspectionModal.maxDate}
            onChange={(e) => setInspectionModal(prev => ({ ...prev, maxDate: e.target.value }))}
            className="w-full border rounded-lg p-2"
          />
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={inspectionModal.includesKit}
            onChange={(e) => setInspectionModal(prev => ({ ...prev, includesKit: e.target.checked }))}
          />
          <span className="text-sm text-gray-700">Incluye kit de arranque</span>
        </label>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button 
          variant="ghost" 
          onClick={() => setInspectionModal({ open: false, requestId: null, file: null, minDate: "", maxDate: "", includesKit: false })}
        >
          Cancelar
        </Button>
        <Button onClick={handleSubmitInspection}>
          Crear Solicitud
        </Button>
      </div>
    </div>
  </div>
)}
```

## 🎯 Resumen

- **Backend**: ✅ 100% completado
- **Frontend API**: ✅ 100% completado  
- **Frontend UI**: ⏳ Pendiente - Necesita implementar el modal en `EquipmentPurchaseWidget.jsx`

## 📝 Notas Importantes

1. El backend ya está completamente funcional
2. Al presionar "Crear Solicitud" en el frontend, se:
   - Sube la proforma firmada
   - Crea automáticamente una solicitud de inspección
   - La solicitud de inspección incluye:
     - Cliente de la compra
     - Equipos de la compra
     - Fechas ingresadas
     - Nota sobre kit de arranque
3. La solicitud de inspección aparecerá en el módulo de "Solicitudes" del sistema
