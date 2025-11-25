# Instrucciones Finales - Modal de Inspección

## ✅ Backend Completado
Todo el backend está funcionando correctamente.  

## ⚠️ Frontend - Cambios Manuales Requeridos

El archivo `EquipmentPurchaseWidget.jsx` necesita las siguientes modificaciones:

### 1. Agregar al import (línea 11):
```javascript
// Cambiar de:
import {
  createEquipmentPurchase,
  getEquipmentPurchaseMeta,
  listEquipmentPurchases,
  requestProforma,
  reserveEquipment,
  saveProviderResponse,
  uploadContract,
  uploadProforma,
  uploadSignedProforma,
} from "../../../core/api/equipmentPurchasesApi";

// A:
import {
  createEquipmentPurchase,
  getEquipmentPurchaseMeta,
  listEquipmentPurchases,
  requestProforma,
  reserveEquipment,
  saveProviderResponse,
  uploadContract,
  uploadProforma,
  uploadSignedProforma,
  submitSignedProformaWithInspection,  // ← AGREGAR ESTA LÍNEA
} from "../../../core/api/equipmentPurchasesApi";
```

### 2. Agregar estado del modal (después de línea 35):
```javascript
// Después de:
const [inspectionDraft, setInspectionDraft] = useState({});

// Agregar:
const [inspectionModal, setInspectionModal] = useState({
  open: false,
  requestId: null,
  file: null,
  minDate: "",
  maxDate: "",
  includesKit: false
});
```

### 3. Agregar handler (después de la función `handleReserve`, alrededor de línea 169):
```javascript
// Después de handleReserve, agregar:
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
    setInspectionModal({ open: false, requestId: null, file: null, minDate: "", maxDate: "", includesKit:  false });
    loadAll();
  } catch (error) {
    console.error(error);
    showToast("Error al procesar la solicitud", "error");
  }
};
```

### 4. Reemplazar sección `waiting_signed_proforma` (alrededor de línea 300):
```javascript
// REEMPLAZAR TODO EL BLOQUE waiting_signed_proforma:
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

### 5. Agregar Modal (AL FINAL, antes del último `</div>`):
```javascript
// Justo antes de las últimas líneas del archivo, DESPUÉS del modal responseDraft
// y ANTES del cierre final </div> </Card>, agregar:

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
            className="w-full text-sm border rounded p-2"
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
          Cancelar</Button>
        <Button onClick={handleSubmitInspection}>
          Crear Solicitud
        </Button>
      </div>
    </div>
  </div>
)}
```

## 🎯 Resumen Final

**Backend**: ✅ 100% Completado
- Servicio que crea inspección automáticamente
- Controlador configurado
- Ruta proteg ida
- API Frontend lista

**Frontend**: ⏳ Requiere 5 cambios manuales arriba descritos

Una vez realices estos cambios, el flujo completo funcionará:
1. Usuario presiona "Subir proforma firmada e inspección"
2. Se abre modal con formulario
3. Usuario sube archivo y selecciona fechas
4. Al enviar: se sube proforma Y se crea solicitud de inspección automáticamente
5. La solicitud de inspección aparece en el módulo de Solicitudes
