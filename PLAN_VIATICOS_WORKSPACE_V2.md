# Plan de Implementación — Workspace Viáticos V2

**Fecha:** 2026-06-18  
**Alcance:** Vista del colaborador operacional — desde salidas operacionales hasta resumen consolidado listo para revisión.  
**Fuera de alcance en este plan:** flujo de aprobación financiero (ya implementado y funcional).

---

## Verificación de pendientes técnicos (hallazgos reales del backend)

### Hallazgo 1 — Preview TXT devuelve solo 6 campos, el upload lee 12

`previewSriTxtInvoices` (service.js:3263) construye cada item con solo:
```
supplier_ruc, supplier_name, access_key, issue_date, total, in_trip_date_range
```

`uploadSriTxtInvoices` (service.js:3119) sí lee todas las columnas del TXT:
```
RUC_EMISOR, RAZON_SOCIAL_EMISOR, TIPO_COMPROBANTE, SERIE_COMPROBANTE (→ establishment/emission_point/sequential),
CLAVE_ACCESO, NUMERO_AUTORIZACION, FECHA_AUTORIZACION, FECHA_EMISION,
IDENTIFICACION_RECEPTOR, VALOR_SIN_IMPUESTOS, IVA, IMPORTE_TOTAL
```

**Acción:** El backend debe ampliar `previewSriTxtInvoices` para devolver todos los campos que lee el upload. Sin este cambio, la tabla del wizard no puede mostrar info completa.

---

### Hallazgo 2 — `patchInvoice` (categorización) requiere rol de finanzas

`updateInvoiceClassification` (service.js:2842) llama `assertFinanceApprover`. Un colaborador operacional recibe 403 si intenta categorizar.

**La ruta** `PATCH /viaticos/invoices/:invoiceId` también tiene `requireRole(FINANCE_REVIEWER_ROLES)` en routes.js:51.

**Consecuencia:** El colaborador NO puede categorizar facturas ya guardadas. La categorización debe ocurrir al momento del upload, no después.

**Acción:** Modificar `uploadSriTxtInvoices` para aceptar `categories: { [accessKey]: string }` opcional. Si se pasa, el INSERT guarda la categoría directamente. El frontend envía las categorías junto con el contenido del TXT en un solo request.

---

### Hallazgo 3 — El colaborador no puede enviar su viático a revisión

Hay dos rutas de cambio de estado:

| Ruta | Guard | ¿Puede el colaborador? |
|---|---|---|
| `PATCH /:id/status` | `assertFinanceApprover` | **No** |
| `PATCH /:id/workflow` | `assertOperationalApprover` | **No** (solo jefes) |

`OPERATIONAL_WORKFLOW_STATUSES` sí incluye `pendiente_revision`, pero `assertOperationalApprover` exige roles: `jefe_comercial`, `jefe_tecnico`, `jefe_operaciones`, `jefe_inmediato`, `gerencia_general`, etc. Un `comercial` o `tecnico` no pasa.

**Consecuencia:** Con la implementación actual, el colaborador no tiene endpoint para enviar su propio viático a revisión.

**Acción:** Agregar lógica al service: si el actor es el propio requester del viático (owner), permitirle hacer `workflow_status = 'pendiente_revision'` sin necesidad de ser jefe. Esto puede ir en `updateAllowanceWorkflowOperational` con una condición adicional, o como una nueva función separada `submitAllowanceForReview`.

---

### Hallazgo 4 — No existe `GET /viaticos/:id`

Solo existe `GET /viaticos` (lista filtrada). Para refrescar un allowance individual tras el wizard, hay que llamar `listViaticos()` con el rango de fechas. El resultado ya incluye `ta.*` que contiene `total_sri_invoices`, `total_manual_notes`, `total_purchases_no_invoice`, `total_consolidated`, `deducible_10_percent`.

**Acción:** En el frontend, al refrescar el viático en el paso 4 del wizard, usar `listViaticos` y filtrar por `id`. No se necesita nuevo endpoint.

---

### Hallazgo 5 — No existe documento por factura individual

`addDocument` (`POST /viaticos/:id/documents`) opera a nivel de allowance. No hay endpoint `POST /viaticos/invoices/:invoiceId/document`.

La tabla `travel_allowance_documents` tiene `allowance_id` y `doc_type` pero no `invoice_id`.

**Acción:** El documento de respaldo de cada factura se sube al allowance con `doc_type = 'support'` y el nombre del archivo. No se crea endpoint nuevo. En el wizard, el upload del documento de cada factura llama `addViaticoDocument(allowanceId, { doc_type: 'support', ... })`.

---

### Hallazgo 6 — Upload TXT descarta fuera de rango automáticamente en el servidor

`uploadSriTxtInvoices` hace `continue` para las facturas fuera de rango antes del INSERT. El usuario no puede forzar la inclusión de una factura fuera de rango desde el frontend — el servidor las bloquea en todos los casos.

**Consecuencia para el wizard:** Las facturas fuera de rango que se muestren en el preview son informativas (badge "Fuera del rango del viaje") pero no son seleccionables para cargar. El checkbox de selección solo aplica a las `in_range`.

---

## Cambios de backend requeridos (2 cambios, 1 ruta nueva)

### Cambio B-1 — Ampliar `previewSriTxtInvoices`

**Archivo:** `backend/src/modules/viaticos/viaticos.service.js`

Ampliar el objeto `item` que se construye en el loop del preview (línea ~3328) para incluir todos los campos que ya se leen:

```js
const item = {
  supplier_ruc,
  supplier_name,
  receipt_type,
  establishment,          // serieParts[0]
  emission_point,         // serieParts[1]
  sequential,             // serieParts[2]
  access_key,
  authorization_number,
  authorization_date: parseEcDateTime(fechaAutorizacion), // ya existe esta función
  issue_date,
  buyer_id,
  subtotal,
  iva,
  total,
  in_trip_date_range,
};
```

No se cambia la firma de la función ni el endpoint.

---

### Cambio B-2 — Permitir categoría en upload TXT + permitir al requester enviar a revisión

**Archivo:** `backend/src/modules/viaticos/viaticos.service.js`

#### B-2a: Categoría en upload TXT

Modificar la firma de `uploadSriTxtInvoices` para aceptar `categories` opcional:
```js
async function uploadSriTxtInvoices({ allowanceId, actorUser, txtContent, categories = {} })
```

En el INSERT, si `categories[accessKey]` existe y es válida (está en `ALLOWED_EXPENSE_CATEGORIES`), guardar `category` y `category_source = 'requester'` directamente.

Modificar el controller `uploadInvoiceTxt` para leer `req.body.categories` y pasarlo al service.

#### B-2b: Requester puede enviar a revisión

Agregar nueva función `submitAllowanceForReview` que:
- Verifica que el actor sea el `requester_user_id` o `requester_email` del allowance
- Solo permite el cambio `workflow_status = 'pendiente_revision'`
- No requiere rol de jefe ni de finanzas

Nueva ruta en `viaticos.routes.js`:
```js
router.post("/:id/submit-review", controller.submitForReview);
```

Nueva función en `viaticos.controller.js`:
```js
async function submitForReview(req, res) { ... }
```

Nueva función en el service con validación de ownership.

---

## Cambios de frontend (4 pasos)

### Paso 1 — Reestructurar la vista principal: agrupación y selección

**Archivo a modificar:** `spi_front/src/modules/finanzas/pages/ViaticosWorkspace.jsx`

#### 1.1 Agrupación por período

Reemplazar la lista plana `filteredAllowances.map(...)` por una vista agrupada. Selector con dos opciones: **por mes** (default) y **por semana**.

Función pura local (sin nuevo archivo):
```js
function groupAllowancesByPeriod(items, mode) {
  // mode: 'month' | 'week'
  // devuelve [{ key, label, items }]
}
```

Cada grupo se renderiza como un bloque colapsable con encabezado que muestra el período y el conteo de viáticos.

#### 1.2 Selección

Estado `const [selected, setSelected] = useState(new Set())`.

Cada viático tiene `<input type="checkbox">`. El encabezado del grupo tiene checkbox "seleccionar todos del grupo". Deseleccionar todo al cambiar filtro de fecha.

#### 1.3 Botón "Procesar seleccionados"

Aparece en la barra superior cuando `selected.size > 0`. Al hacer click abre el wizard modal pasando el array `allowances.filter(a => selected.has(a.id))`.

Un viático individual también tiene botón "Completar" que abre el wizard con solo ese viático.

#### 1.4 Estado visual por viático

Badge extra basado en datos reales (no en workflow_status):
- Sin facturas y `workflow_status` nulo o `borrador` → `SIN DOCUMENTOS` (amber)
- Tiene facturas (basado en `docs_count > 0` que ya viene en `listAllowances`) → `EN PROGRESO` (blue)
- `workflow_status = 'pendiente_revision'` o posterior → badge del workflow (ya existe en el código)

#### 1.5 Modal del wizard

El wizard se abre en un modal `<dialog>` o `<div>` superpuesto. El estado del modal se maneja en la workspace con `const [wizardAllowances, setWizardAllowances] = useState(null)`. Cuando `wizardAllowances` no es null, se renderiza `<ViaticosWizard allowances={wizardAllowances} onClose={...} onComplete={...} />`.

**Lo que NO cambia en este paso:** sección de candidatos (salidas operacionales), controles de filtro de fecha, buscadores, bloque de acciones de finanzas.

---

### Paso 2 — Reescribir ViaticosWizard: Paso 1 — TXT con datos completos y categoría por fila

**Archivo a modificar:** `spi_front/src/modules/finanzas/components/viaticos/ViaticosWizard.jsx`  
**Cambio de API:** `viaticosApi.js` — agregar parámetro `categories` a `uploadViaticoInvoicesTxt`.

**Props del wizard reformado:**
```js
// allowances: array de allowance objects (uno o varios)
// onClose: () => void
// onComplete: (processedIds: number[]) => void
ViaticosWizard({ allowances, onClose, onComplete })
```

El wizard procesa un viático a la vez. Indicador de progreso: "Viático 1 de 3 — Ambato 2026-06-05".

**4 pasos internos (igual que antes pero funcionales):**
1. Facturas SRI (TXT)
2. Notas de venta manual
3. Compras sin factura
4. Resumen y envío

#### Paso 1 del wizard — TXT

**Flujo:**
1. Input file → leer como texto → llamar `previewViaticoInvoicesTxt(allowanceId, txtContent)`.
2. Mostrar tabla con **todos** los campos del preview (con B-1 aplicado):

   | Col | Campo |
   |---|---|
   | Checkbox | selección |
   | Proveedor | `supplier_name` |
   | RUC | `supplier_ruc` |
   | Tipo | `receipt_type` |
   | Número | `establishment-emission_point-sequential` |
   | Emisión | `issue_date` |
   | Autorización | `authorization_date` |
   | Receptor | `buyer_id` |
   | Subtotal | `subtotal` |
   | IVA | `iva` |
   | Total | `total` |
   | Rango | badge En viaje / Fuera |
   | Categoría | `<select>` por fila |
   | Documento | `<input type="file">` compacto por fila |

3. Facturas fuera de rango (`in_trip_date_range: false`): visibles, opacidad reducida, checkbox deshabilitado, badge "Fuera del rango". No se pueden seleccionar.
4. Estado local de cada fila en el wizard:
   ```js
   const [invoiceRows, setInvoiceRows] = useState([]);
   // cada row: { ...previewFields, selected: bool, category: '', file: null }
   ```
5. Validación para avanzar: al menos una fila seleccionada + todas las seleccionadas tienen categoría. Si hay fila seleccionada sin categoría: bloquear "Siguiente", resaltar filas problemáticas.
6. Al hacer click "Cargar facturas":
   - Construir `categories = { [accessKey]: category }` de las filas seleccionadas.
   - Llamar `uploadViaticoInvoicesTxt(allowanceId, txtContent, categories)` — un solo request.
   - Por cada fila seleccionada que tenga `file`: llamar `addViaticoDocument(allowanceId, { doc_type: 'support', file_base64, file_name })`.
   - En éxito: avanzar al paso 2.
7. Botón "Saltar" disponible si el allowance ya tiene facturas cargadas (`docs_count > 0`).

**Cambio en `viaticosApi.js`:**
```js
export const uploadViaticoInvoicesTxt = async (viaticoId, txtContent, categories = {}) => {
  const { data } = await api.post(`/viaticos/${viaticoId}/invoices/txt`, {
    txt_content: txtContent,
    categories,
  });
  return data?.data || data;
};
```

---

### Paso 3 — Wizard Pasos 2 y 3: notas manuales y compras conectadas al API real

**Archivo a modificar:** `ViaticosWizard.jsx`  
**Archivos sin cambios:** `ManualNoteForm.jsx`, `ManualNotesTable.jsx`, `PurchaseNoInvoiceForm.jsx`, `PurchaseNoInvoiceTable.jsx`.

**Paso 2 del wizard — Notas de venta manual**

Estado interno:
```js
const [manualNotes, setManualNotes] = useState([]);
const [notesLoading, setNotesLoading] = useState(false);
```

Al entrar al paso (efecto condicionado al step): llamar `listManualNotes(currentAllowanceId)` y poblar `manualNotes`.

`onSubmit` de `ManualNoteForm`:
1. Llamar `createManualNote(allowanceId, payload)` — API real.
2. Refrescar con `listManualNotes(allowanceId)`.
3. Toast "Nota agregada".

`onUpdate` y `onDelete` de `ManualNotesTable`: iguales que en la workspace actual.

Paso opcional. "Siguiente" siempre habilitado.

**Paso 3 del wizard — Compras sin factura**

Idéntico al paso de notas:
- Al entrar: `listPurchasesNoInvoice(allowanceId)`.
- `onSubmit`: `createPurchaseNoInvoice(allowanceId, payload)`.
- Refrescar tras cada creación.
- Paso opcional.

**Persistencia entre pasos:** usar `display: none` / `visibility: hidden` en lugar de `&&` en el renderizado condicional para no destruir el estado del formulario al navegar.

**Múltiples viáticos:** Al completar el paso 3 del viático `i`, mostrar "Continuar con siguiente viático (i+1 de N)". El wizard resetea `invoiceRows`, `manualNotes`, `purchases` y apunta al siguiente `allowanceId` del array.

---

### Paso 4 — Wizard Paso 4: resumen consolidado y envío a revisión

**Archivo a modificar:** `ViaticosWizard.jsx`, `ViaticosWorkspace.jsx`  
**Archivo a agregar en API:** función `submitViaticoForReview` en `viaticosApi.js`.

#### Paso 4 del wizard — Resumen

Al entrar al paso 4: llamar `listViaticos({ start_date, end_date })` (el rango actual de la workspace) y filtrar por `id === currentAllowanceId` para obtener el allowance fresco con totales consolidados. Renderizar `<ConsolidatedSummary allowance={freshAllowance} />`.

Debajo del resumen, contadores simples:
- `N facturas SRI` (de `listViaticoInvoices` ya cargada)
- `N notas manuales`
- `N compras sin factura`

#### Botón "Enviar para revisión"

Llama al nuevo endpoint `POST /viaticos/:id/submit-review` (cambio B-2b).

```js
export const submitViaticoForReview = async (viaticoId) => {
  const { data } = await api.post(`/viaticos/${viaticoId}/submit-review`);
  return data?.data || data;
};
```

Visible siempre en el paso 4. Si el viático ya está en `pendiente_revision` o posterior, mostrar badge "Ya enviado" en lugar del botón.

#### Resumen de lote

Si el wizard procesó más de un viático, al completar el último se muestra pantalla de confirmación:
```
✓ 3 viáticos procesados

  Ambato   2026-06-05   4 facturas   $120.00   ✓ Enviado
  Riobamba 2026-06-10   2 facturas    $45.00   ✓ Enviado
  Latacunga 2026-06-15  0 facturas     $0.00   ⚠ Sin facturas
```

#### Callback de cierre

`onComplete(processedIds)` en la workspace:
1. Cerrar modal wizard.
2. Limpiar `selected`.
3. Llamar `loadData()`.

---

## Tabla de archivos a tocar

| Archivo | Paso | Tipo |
|---|---|---|
| `backend/src/modules/viaticos/viaticos.service.js` | B-1, B-2a, B-2b | Modificar 2 funciones, agregar 1 función |
| `backend/src/modules/viaticos/viaticos.controller.js` | B-2a, B-2b | Modificar 1 función, agregar 1 función |
| `backend/src/modules/viaticos/viaticos.routes.js` | B-2b | Agregar 1 ruta |
| `spi_front/src/core/api/viaticosApi.js` | Paso 2, Paso 4 | Modificar 1 función, agregar 1 función |
| `spi_front/src/modules/finanzas/pages/ViaticosWorkspace.jsx` | Paso 1, Paso 4 | Refactor sección lista + apertura modal wizard |
| `spi_front/src/modules/finanzas/components/viaticos/ViaticosWizard.jsx` | Paso 2, 3, 4 | Reescritura completa |
| `ManualNoteForm.jsx` | — | Sin cambios |
| `ManualNotesTable.jsx` | — | Sin cambios |
| `PurchaseNoInvoiceForm.jsx` | — | Sin cambios |
| `PurchaseNoInvoiceTable.jsx` | — | Sin cambios |
| `ConsolidatedSummary.jsx` | — | Sin cambios |

## Orden de implementación

```
B-1 → B-2a → B-2b   (backend primero, sin dependencias entre sí)
     ↓
Paso 1 (workspace agrupada + selección + modal vacío)
     ↓
Paso 2 (wizard reescrito — TXT completo + categoría + doc)
     ↓
Paso 3 (wizard — notas + compras conectadas al API)
     ↓
Paso 4 (wizard — resumen + submit-review)
```
