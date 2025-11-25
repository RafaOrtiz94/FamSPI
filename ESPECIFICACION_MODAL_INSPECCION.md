# Especificación: Modal de Inspección de Ambiente para Proforma Firmada

## Resumen
Modificar el flujo de "Subir proforma firmada" para que en lugar de tener los campos de fechas de inspección directamente en la tarjeta, se abra un modal que permita:
1. Subir el archivo de proforma firmada
2. Ingresar las fechas de inspección (mínima y máxima)
3. Marcar si incluye kit de arranque
4. Crear automáticamente una solicitud de inspección de ambiente con los datos de la solicitud de compra

## Flujo Actual
1. El usuario ve la tarjeta con estado `waiting_signed_proforma`
2. Dentro de la tarjeta hay un FileUpload, 2 inputs de fecha, un checkbox y un botón "Subir firmada"
3Al presionar "Subir firmada" solo se sube el archivo

## Flujo Propuesto
1. El usuario ve la tarjeta con estado `waiting_signed_proforma`
2. La tarjeta solo tiene botones: "Renovar", "Cancelar" y "📄 Subir proforma firmada"
3. Al presionar "Subir proforma firmada" se abre un modal titulado "Solicitud de Inspección de Ambiente"
4. El modal contiene:
   - FileUpload para proforma firmada (requerido)
   - Input de fecha mínima de inspección (requerido)
   - Input de fecha máxima de inspección (requerido)
   - Checkbox "Incluye kit de arranque"
   - Botones: "Cancelar" y "Crear Solicitud"
5. Al presionar "Crear Solicitud":
   - Sube la proforma firmada
   - Crea automáticamente una solicitud de inspección de ambiente con:
     * Cliente de la solicitud de compra
     * Equipos de la solicitud de compra
     * Las fechas ingresadas como fecha de instalación y fecha tope
     * Nota si incluye kit de arranque

## Cambios Necesarios

### Frontend (`EquipmentPurchaseWidget.jsx`)
1. Agregar estado para el modal de inspección:
   ```js
   const [inspectionModal, setInspectionModal] = useState({ 
     open: false, 
     requestId: null, 
     file: null, 
     minDate: "", 
     maxDate: "", 
     includesKit: false 
   });
   ```

2. Simplificar la sección `waiting_signed_proforma` en la tarjeta
3. Crear componente de modal con formulario completo
4. Agregar handler `handleSubmitInspection` que llame a un nuevo endpoint

### Backend
1. Crear nuevo endpoint: `POST /equipment-purchases/:id/submit-signed-proforma-with-inspection`
2. Este endpoint debe:
   - Subir la proforma firmada (igual que antes)
   - Extraer datos del cliente y equipos de la solicitud de compra
   - Crear automáticamente una solicitud de inspección usando `createRequest` del módulo `requests`
   - Retornar confirmación

### API (`equipmentPurchasesApi.js`)
1. Agregar función:
   ```js
   export const submitSignedProformaWithInspection = async (id, data) => { ... }
   ```

## Datos para la Solicitud de Inspección Automática
- **nombre_cliente**: De la solicitud de compra
- **direccion_cliente**: De la solicitud de compra (o del cliente asociado)
- **persona_contacto**: Del cliente asociado
- **celular_contacto**: Del cliente asociado  
- **fecha_instalacion**: La fecha mínima ingresada
- **fecha_tope_instalacion**: La fecha máxima ingresada
- **equipos**: Array de equipos de la solicitud con su estado (nuevo/cu)
- **anotaciones**: Texto que indique si incluye kit de arranque
- **requiere_lis**: false (por defecto)

## Próximos Pasos
1. ✅ Restaurar archivo a estado limpio
2. ⏳ Modificar frontend con modal
3. ⏳ Crear endpoint backend
4. ⏳ Integrar con módulo de requests
5. ⏳ Probar flujo completo
