# Guía de Integración: Notas Manuales y Compras sin Factura en Viáticos

## Componentes Creados

1. **ConsolidatedSummary.jsx** - Resumen de totales consolidados + deducible 10%
2. **ManualNoteForm.jsx** - Formulario para crear notas de venta manual
3. **ManualNotesTable.jsx** - Tabla de notas manuales creadas
4. **PurchaseNoInvoiceForm.jsx** - Formulario para compras sin factura
5. **PurchaseNoInvoiceTable.jsx** - Tabla de compras sin factura con aprobación dual

## Ubicación de Componentes

Todos en: `spi_front/src/modules/finanzas/components/viaticos/`

## Cómo integrar en ViaticosWorkspace.jsx

### 1. Importar componentes

```javascript
import ConsolidatedSummary from '../components/viaticos/ConsolidatedSummary';
import ManualNoteForm from '../components/viaticos/ManualNoteForm';
import ManualNotesTable from '../components/viaticos/ManualNotesTable';
import PurchaseNoInvoiceForm from '../components/viaticos/PurchaseNoInvoiceForm';
import PurchaseNoInvoiceTable from '../components/viaticos/PurchaseNoInvoiceTable';
import { createManualNote, listManualNotes, createPurchaseNoInvoice, listPurchasesNoInvoice, approvePurchaseNoInvoice } from '../../../core/api/viaticosApi';
```

### 2. Agregar estado para notas y compras

```javascript
const [manualNotes, setManualNotes] = useState([]);
const [purchasesNoInvoice, setPurchasesNoInvoice] = useState([]);
const [expandedViatic, setExpandedViatic] = useState(null);
```

### 3. Cargar datos al abrir un viático

```javascript
const loadManualNotes = async (allowanceId) => {
  try {
    const data = await listManualNotes(allowanceId);
    setManualNotes(data);
  } catch (error) {
    console.error('Error cargando notas:', error);
  }
};

const loadPurchasesNoInvoice = async (allowanceId) => {
  try {
    const data = await listPurchasesNoInvoice(allowanceId);
    setPurchasesNoInvoice(data);
  } catch (error) {
    console.error('Error cargando compras:', error);
  }
};

useEffect(() => {
  if (expandedViatic) {
    loadManualNotes(expandedViatic.id);
    loadPurchasesNoInvoice(expandedViatic.id);
  }
}, [expandedViatic?.id]);
```

### 4. Manejadores de formularios

```javascript
const handleCreateManualNote = async (payload) => {
  try {
    await createManualNote(expandedViatic.id, payload);
    setUI({ showToast: true, toast: { type: 'success', message: 'Nota agregada' } });
    await loadManualNotes(expandedViatic.id);
    // Recargar allowance para actualizar totales
    await loadAllowances();
  } catch (error) {
    setUI({ showToast: true, toast: { type: 'error', message: error.message } });
  }
};

const handleCreatePurchaseNoInvoice = async (payload) => {
  try {
    await createPurchaseNoInvoice(expandedViatic.id, payload);
    setUI({ showToast: true, toast: { type: 'success', message: 'Compra agregada' } });
    await loadPurchasesNoInvoice(expandedViatic.id);
    await loadAllowances();
  } catch (error) {
    setUI({ showToast: true, toast: { type: 'error', message: error.message } });
  }
};

const handleApprovePurchase = async (purchaseId, approvedBy) => {
  try {
    await approvePurchaseNoInvoice(purchaseId, { approved_by: approvedBy });
    setUI({ showToast: true, toast: { type: 'success', message: 'Aprobación registrada' } });
    await loadPurchasesNoInvoice(expandedViatic.id);
    await loadAllowances();
  } catch (error) {
    setUI({ showToast: true, toast: { type: 'error', message: error.message } });
  }
};
```

### 5. Render en la página

Dentro de la sección expandida del viático, agregar:

```jsx
{/* Resumen consolidado */}
<ConsolidatedSummary allowance={expandedViatic} />

{/* Notas de Venta Manual */}
<Section title="Notas de Venta Manual" defaultOpen={false}>
  <ManualNoteForm
    allowance={expandedViatic}
    onSubmit={handleCreateManualNote}
    loading={false}
    destination={expandedViatic.city}
  />
  <ManualNotesTable
    notes={manualNotes}
    isFinance={isFinanceUser(user)}
    isRequester={user?.email === expandedViatic.requester_email}
  />
</Section>

{/* Compras sin Factura */}
<Section title="Compras sin Factura" defaultOpen={false}>
  <PurchaseNoInvoiceForm
    onSubmit={handleCreatePurchaseNoInvoice}
    loading={false}
  />
  <PurchaseNoInvoiceTable
    purchases={purchasesNoInvoice}
    isFinance={isFinanceUser(user)}
    isTalento={isTalentoUser(user)}
    onApprove={handleApprovePurchase}
  />
</Section>
```

## Funciones Auxiliares a Agregar

```javascript
const isFinanceUser = (user) => {
  const roles = [user?.scope, user?.role, ...(user?.roles || [])]
    .flatMap((r) => String(r || '').split(','))
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
  return ['finanzas', 'financiero', 'jefe_finanzas', 'jefe_financiero'].some(r => roles.includes(r));
};

const isTalentoUser = (user) => {
  const roles = [user?.scope, user?.role, ...(user?.roles || [])]
    .flatMap((r) => String(r || '').split(','))
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
  return ['talento_humano', 'jefe_talento_humano'].some(r => roles.includes(r));
};
```

## Estado de Totales

Los campos `total_consolidated` y `deducible_10_percent` se actualizan automáticamente en el backend cuando:
- Se agrega una nota manual
- Se agrega una compra sin factura
- Se aprueba/rechaza una compra
- Se modifica una factura SRI

## Testing

Prueba con estos usuarios:
- **Colaborador TI**: puede crear notas y compras (actualmente rafal.ortiz@fam-project.com)
- **Finanzas**: puede revisar y aprobar (finanzas@fam-project.com o similar)
- **Talento**: puede revibar y aprobar compras (talento@fam-project.com o similar)

## Notas Importantes

- Los componentes siguen DESIGN.md 100%
- Validación lado cliente + backend
- Soporte para upload de documentos
- Totales consolidados en tiempo real
- Deducible 10% informativo (no afecta el monto a pagar)
