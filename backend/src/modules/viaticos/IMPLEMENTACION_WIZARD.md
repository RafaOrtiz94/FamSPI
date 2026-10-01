# Plan de Implementación - Wizard de Viáticos

## Objetivo
Reformar el workspace de viáticos con flujo tipo wizard de 4 pasos para registro y procesamiento de viáticos desde salidas operacionales.

---

## Paso 1: Carga de Facturas TXT (SRI)

### Estado Actual
- Endpoint existente: `POST /api/v1/viaticos/:id/invoices/txt`
- Controller: `uploadInvoiceTxt` (viaticos.controller.js:288-304)
- Service: `uploadSriTxtInvoices` (viaticos.service.js:3119-3260)

### Funcionalidad Actual
- Parsea TXT tab-delimited del SRI
- Filtra facturas fuera de rango del viaje
- Inserta en `travel_allowance_invoices`
- Retorna: `loaded`, `skipped`, `errors`, `items`

### Requisitos del Paso 1
1. Mostrar **todas** las facturas del TXT sin excepción (incluso las descartadas)
2. Cada factura debe mostrar:
   - `supplier_ruc` - RUC del proveedor
   - `supplier_name` - Razón social
   - `access_key` - Clave de acceso
   - `issue_date` - Fecha emisión
   - `total` - Total factura
   - `establishment`, `emission_point`, `sequential` - Serie
   - `in_trip_date_range` - ¿En rango del viaje?
3. Permitir selección múltiple para eliminación antes de cargar
4. Mantener datos originales en memoria para categorización posterior

### Acciones Backend
- Endpoint actual solo filtra y descarta. Necesario:
  - Crear endpoint temporal `/api/v1/viaticos/:id/invoices/txt/preview` para previsualizar
  - O modificar `uploadSriTxtInvoices` para retornar también `out_of_range_items`

---

## Paso 2: Categorización de Facturas

### Estado Actual
- Endpoint existente: `PATCH /api/v1/viaticos/invoices/:invoiceId`
- Controller: `patchInvoice` (viaticos.controller.js:158-172)
- Service: `updateInvoiceClassification` (viaticos.service.js:2842-2893)

### Categorías Permitidas (ALLOWED_EXPENSE_CATEGORIES)
- combustible
- alimentacion
- hospedaje
- transporte
- movilidad
- materiales

### Requisitos del Paso 2
1. Clasificar todas las facturas cargadas
2. Campo `category` obligatorio antes de aprobar viático
3. Mostrar estado de clasificación (pendiente/clasificado)
4. Permite edición masiva o individual

---

## Paso 3: Subida de Documentos de Facturas

### Estado Actual
- Endpoint existente: `POST /api/v1/viaticos/:id/documents`
- Controller: `addDocument` (viaticos.controller.js:261-273)
- Service: `createAllowanceDocument` (viaticos.service.js:1770-1868)

### Tipos de Documento (ALLOWED_DOC_TYPES)
- invoice
- liquidation
- support

### Requisitos del Paso 3
1. Adjuntar documento respaldo a CADA factura
2. Necesario mapear `document_id` → `invoice_id`
3. Actualmente `document_id` opcional en `travel_allowance_invoices`
4. Guardar en Drive (via `uploadBase64File`)

### Inconsistencia Detectada
- `createAllowanceDocument` insert con `document_id` como FK nullable
- No hay endpoint para enlazar documento a factura existente

---

## Paso 4: Notas de Venta Manual y Compras sin Factura

### Estado Actual
- Notas manuales: `POST /api/v1/viaticos/:id/invoices/manual`
- Compras sin factura: `POST /api/v1/viaticos/:id/purchases-no-invoice`

### Requisitos del Paso 4
1. Sección para múltiples notas de venta
2. Sección para múltiples compras sin factura
3. Validación: ambas opcionales, pero requieren monto > 0

---

## Diseño del Wizard de 4 Pasos

### Flujo de Usuario
**Usuario con rol (comercial/tecnico/servicio_tecnico/etc)** accede a `/dashboard/finanzas/viaticos`:
1. Ve sus salidas operacionales como candidatos
2. Selecciona una salida para iniciar wizard
3. Completa 4 pasos secuencialmente
4. El viático se crea/actualiza al finalizar

### Paso 1: Carga de Facturas TXT (SRI)
**Endpoint actual**: `POST /api/v1/viaticos/:id/invoices/txt`
**Cambio requerido**: Previsualizar antes de guardar

**Datos del TXT a mostrar**:
- `supplier_ruc` - RUC del proveedor
- `supplier_name` - Razón social
- `access_key` - Clave de acceso (49 dígitos)
- `issue_date` - Fecha emisión
- `total` - Total factura
- `establishment` - Establecimiento
- `emission_point` - Punto de emisión
- `sequential` - Secuencial
- `in_trip_date_range` - Indicador si está en rango

**Acciones**:
- Checkbox selección múltiple
- Botón "Cargar seleccionadas"
- Botón "Cargar todas"
- Preview de facturas descartadas (fuera de rango)

### Paso 2: Categorización de Facturas
**Endpoint actual**: `PATCH /api/v1/viaticos/invoices/:invoiceId`

**Tabla con facturas cargadas**:
- Columna: Estado (pendiente_clasificacion/clasificada)
- Select: Categoría (combustible, alimentacion, hospedaje, transporte, movilidad, materiales)
- Checkbox: Incluir en ATS
- Acción: Guardar categoría individual

**Validación**: Todas las facturas deben tener categoría asignada para avanzar

### Paso 3: Documentos de Facturas
**Endpoint actual**: `POST /api/v1/viaticos/:id/documents`

**Por cada factura**:
- Botón "Adjuntar documento" (PDF/imagen)
- Preview del archivo adjunto
- Enlace a Drive

**Requisito**: Cada factura con estado "clasificada" debe tener documento opcional

### Paso 4: Notas Manuales y Compras sin Factura
**Endpoints actuales**:
- `POST /api/v1/viaticos/:id/invoices/manual` - Notas de venta
- `POST /api/v1/viaticos/:id/purchases-no-invoice` - Compras sin factura

**Formulario dinámico**:
- Sección de notas (agregar múltiples)
- Sección de compras sin factura (agregar múltiples)
- Botón "Agregar otro" en cada sección

**Submit final**:
- Validar que se completaron todos los pasos
- Actualizar estado a "listo_para_finanzas" o mantener "pendiente"

---

## Endpoints Backend a Verificar/Corregir

### Schema Confirmado en Migrations
**Migración 200** (`200_viaticos_manual_notes_purchases_no_invoice.sql`) crea:
- Tabla `travel_allowance_purchases_no_invoice` con columnas: `id`, `allowance_id`, `description`, `total`, `purchase_date`, `justification`, `file_id`, `status`, `approved_by_finance`, `approved_by_talento`, `approved_at`, `created_at`, `updated_at`
- Columnas en `travel_allowance_invoices`: `document_type`, `subtotal_12`, `subtotal_0`, `document_state`, `drive_file_id`, `drive_link`, `file_name`, `establishment`, `emission_point`, `sequential`
- Columnas en `travel_allowances`: `total_sri_invoices`, `total_manual_notes`, `total_purchases_no_invoice`, `total_consolidated`, `deducible_10_percent`

**Issue detectado**: `ensureSchema()` en viaticos.service.js NO incluye las tablas migradas. Esto puede causar inconsistencia si la migración no se ejecutó.

### Endpoints Nuevos Requeridos
1. `POST /api/v1/viaticos/:id/invoices/txt/preview` - Previsualizar sin guardar
2. `POST /api/v1/viaticos/:id/invoices/:invoiceId/document` - Adjuntar doc a factura
3. `GET /api/v1/viaticos/:id/summary` - Obtener resumen para wizard (viene en ViaticosWorkspace)

---

## Prioridad de Implementación

### Sprint 1: Backend
1. Agregar endpoint `/preview` para TXT
2. Agregar endpoint `/document` para adjuntar a factura
3. Verificar schema ejecutando migration 200

### Sprint 2: Frontend - Paso 1-2
1. Componente `InvoiceUploadStep.jsx` - Preview + selección
2. Componente `InvoiceCategorizeStep.jsx` - Tabla con selects
3. Integración en `ViaticosWorkspace.jsx`

### Sprint 3: Frontend - Paso 3-4
1. Componente `DocumentsStep.jsx` - Upload por factura
2. Componente `AdditionalExpensesStep.jsx` - Notas + compras
3. Wizard container y navegación

### Sprint 4: Testing
1. Verificar flujo end-to-end
2. Tests de schema en Neon
3. Tests de permisos/RBAC