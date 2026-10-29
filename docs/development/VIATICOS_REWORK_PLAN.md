# Plan de Rework: Módulo Viáticos

**Fecha:** 2026-06-25  
**Estado:** Pendiente de implementación  
**Alcance:** Rework completo del flujo de viáticos por salidas operacionales — clasificación, wizard multi-salida, vistas de revisión separadas por rol, correcciones, reportes y cierre con comprobante.

---

## Contexto: Brecha entre lo que existe y lo que se requiere

### Lo que existe hoy

| Elemento | Estado actual |
|---|---|
| `travel_allowances` con `outside_labor_area`, `workflow_status`, `requires_finance_approval`, `requires_talento_approval` | Existe, pero la clasificación es opcional y no bloquea el wizard |
| `travel_allowance_invoices` con `category`, `expense_mode` | Existe. Validado en submit |
| Wizard (`ViaticosWizard.jsx`) | Itera una salida a la vez, no agrupa el mes |
| `notes` en `travel_allowances` | Existe como campo genérico. No hay campo dedicado para observación de revisor |
| `observado` como `workflow_status` | Existe pero no hay flujo claro de corrección con observación |
| `buildFinanceSummaryReport` | Solo para finanzas. No es por usuario ni incluye estados enviado/rechazado/pagado |
| Vista de revisión | Una sola vista. Talento y finanzas ven lo mismo |
| Comprobante de pago | No existe. No hay columnas ni UI para subirlo |

### Lo que se requiere

1. **Clasificación obligatoria**: cada salida debe marcarse dentro/fuera del área antes de habilitar el wizard. Las que están *dentro* no generan viático. Las de *fuera* se agrupan.
2. **Wizard multi-salida**: todas las salidas "fuera del área" del mes se procesan en un solo wizard unificado. El TXT del SRI se contrasta contra todos los rangos de fecha del grupo.
3. **Vistas de revisión separadas**: talento_humano solo ve efectivo + notas manuales + compras sin factura. financiero solo ve pagos con tarjeta.
4. **Correcciones estructuradas**: el revisor escribe una observación, el usuario declarante la ve y puede editar y reenviar.
5. **Reporte descargable por usuario**: envíos, rechazos, procesados/pagados, por mes o año.
6. **Comprobante de pago**: talento_humano sube el comprobante una vez realizado el pago. El viático queda cerrado.

---

## Fase 1: Modelo de datos + clasificación obligatoria

**Objetivo**: Asegurar que la clasificación dentro/fuera del área sea un paso obligatorio y explícito antes de acceder al wizard. Agregar las columnas faltantes para el flujo nuevo.

### 1.1 Migración de base de datos

Archivo: `backend/migrations/228_viaticos_rework.sql`

```sql
-- Observación del revisor (talento o finanzas) al solicitar corrección
ALTER TABLE travel_allowances
  ADD COLUMN IF NOT EXISTS reviewer_observation TEXT,
  ADD COLUMN IF NOT EXISTS reviewer_observation_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewer_observation_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Comprobante de pago (subido por talento_humano)
ALTER TABLE travel_allowances
  ADD COLUMN IF NOT EXISTS payment_receipt_drive_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_receipt_drive_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_receipt_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_receipt_uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Factura: observación del revisor al rechazar/marcar para corrección
ALTER TABLE travel_allowance_invoices
  ADD COLUMN IF NOT EXISTS reviewer_note TEXT;
```

### 1.2 Backend: endpoint de observación/corrección

**Nuevo endpoint**: `PATCH /viaticos/:id/request-correction`  
**Roles**: `talento_humano`, `jefe_talento_humano`, `finanzas`, `financiero`, `jefe_finanzas`, `jefe_financiero`  
**Payload**: `{ observation: string }`  
**Lógica**:
- Guarda `reviewer_observation`, `reviewer_observation_at`, `reviewer_observation_by`
- Cambia `workflow_status` a `observado`
- Notifica al declarante por email/notificación interna con la observación

**Nuevo endpoint**: `PATCH /viaticos/invoices/:invoiceId/reviewer-note`  
**Roles**: mismos revisores  
**Payload**: `{ note: string, action: "flag" | "reject" }`  
- Guarda `reviewer_note` en la factura
- Si `action = "reject"`: cambia `status` de la factura a `rechazada`

### 1.3 Backend: `ensureSchema` actualizado

Agregar los nuevos campos en la función `ensureSchema` del service para que se apliquen en ambientes nuevos.

### 1.4 Frontend: paso de clasificación como puerta de entrada

**Archivo**: `spi_front/src/modules/finanzas/pages/ViaticosWorkspace.jsx`

**Cambio en la vista del declarante (no finanzas)**:

El panel derecho del mes (vista de expedientes por mes) muestra una sección de "Salidas pendientes de clasificar" separada de las ya clasificadas:

```
Expediente — Junio 2026
┌─────────────────────────────────────────────────────┐
│ [!] 3 salidas pendientes de clasificar              │
│ Debes indicar si cada salida estuvo dentro o fuera  │
│ del área laboral antes de continuar.                │
│                                                      │
│ Salida 15 jun  Descripción  [Dentro] [Fuera] [OK]   │
│ Salida 18 jun  Descripción  [Dentro] [Fuera] [OK]   │
│ Salida 22 jun  Descripción  [Dentro] [Fuera] [OK]   │
└─────────────────────────────────────────────────────┘

│ 2 salidas fuera del área → [Abrir wizard del mes]   │
│ 1 salida dentro del área → Cubierta por viático fijo│
```

**Reglas de UI**:
- "Abrir wizard del mes" solo se habilita cuando TODAS las salidas del mes están clasificadas y hay al menos una "fuera del área"
- Las salidas "dentro del área" quedan marcadas como `decision_type = 'covered_fixed'` con `workflow_status = 'cerrado'` automáticamente (no generan gasto)
- Si todas son "dentro del área": expediente queda verde/cerrado sin wizard

**Entregables Fase 1**:
- [ ] `migrations/228_viaticos_rework.sql`
- [ ] `PATCH /viaticos/:id/request-correction` (backend)
- [ ] `PATCH /viaticos/invoices/:invoiceId/reviewer-note` (backend)
- [ ] UI de clasificación obligatoria en el panel del mes del declarante
- [ ] Botón "Abrir wizard del mes" habilitado solo cuando todo clasificado + hay salidas fuera del área

---

## Fase 2: Rework del wizard — multi-salida unificado

**Objetivo**: El wizard deja de procesar una salida a la vez. Recibe TODAS las salidas "fuera del área" del mes y trabaja con ellas como un grupo unificado. El TXT del SRI se contrasta contra todos los rangos de fecha de todas las salidas del grupo.

### 2.1 Modelo conceptual del wizard nuevo

```
Wizard del mes — Junio 2026 (3 salidas fuera del área)

Paso 1: Cargar TXT del SRI
  → Rango de validación: 01/06 — 30/06 (abarca todos los rangos)
  → Se muestran TODAS las facturas del TXT
  → Cada factura se vincula al viatico cuyo rango de fechas la contiene

Paso 2: Clasificar cada factura
  → Por cada factura: Concepto (dropdown) + Modo (Con tarjeta / Sin tarjeta)
  → Facturas fuera de rango de todas las salidas → marcadas como "fuera de rango"
  → No se puede avanzar si hay facturas sin clasificar

Paso 3: Notas de venta / Compras sin factura
  → Formulario permite elegir a qué salida operacional pertenece cada nota/compra
  → Campo: Salida (dropdown con las del mes) + Monto + Descripción + Justificación

Paso 4: Resumen y envío
  → Totales por modo (tarjeta / efectivo)
  → Desglose por salida
  → Botón "Enviar a revisión"
```

### 2.2 Backend: cambios en `submitAllowanceForReview`

Actualmente solo acepta un `allowanceId`. Necesita una variante que acepte múltiples:

**Nuevo endpoint**: `POST /viaticos/submit-month`  
**Payload**: `{ allowance_ids: number[] }`  
**Lógica**:
- Valida que todos los IDs pertenezcan al mismo usuario y mismo mes
- Valida que todas las facturas tengan `category` y `expense_mode`
- Por cada allowance: calcula `requires_finance_approval` (tiene facturas `with_card`) y `requires_talento_approval` (tiene facturas `without_card`, notas, compras sin factura)
- Actualiza `workflow_status` de cada uno según corresponda
- Envía una sola notificación agrupada al revisor (no una por salida)

### 2.3 Frontend: refactor de `ViaticosWizard.jsx`

**Cambio principal**: el wizard recibe `allowances[]` (ya lo hace hoy) pero cambia la lógica interna:

**Paso 1 — TXT multi-salida**:
- `wideRangeForGroup(allowances)`: calcula `startDate = min(visit_date)`, `endDate = max(visit_date) + 3 días` de todas las salidas del grupo
- Se llama a `uploadViaticoInvoicesTxt` en cada allowance del grupo en paralelo con el mismo TXT
- Las facturas que caen en el rango de un allowance específico se vinculan automáticamente a ese allowance
- Facturas que no caen en ningún rango quedan marcadas como "fuera de rango" — el usuario puede asignarlas manualmente a la salida más cercana

**Paso 2 — Clasificación unificada**:
- Se muestra la tabla unificada de TODAS las facturas de TODAS las salidas
- Columna adicional: "Salida" (fecha de la salida a la que pertenece)
- Por fila: concepto (dropdown EXPENSE_CATEGORIES) + modo (Con tarjeta / Sin tarjeta)
- No se puede avanzar al paso 3 si alguna factura no tiene ambos campos completos
- Validación inline: resalta en rojo las filas incompletas

**Paso 3 — Notas y compras**:
- Formulario tiene campo "Salida operacional" (select entre las del mes)
- Las notas/compras existentes se cargan de todas las salidas del grupo
- Se muestran agrupadas por salida

**Paso 4 — Resumen y envío**:
- Totales consolidados por modo
- Desglose por salida (colapsable)
- Botón "Enviar a revisión del mes" → llama a `POST /viaticos/submit-month`
- Una vez enviado: muestra qué va a talento y qué va a financiero

### 2.4 `viaticosApi.js` nuevas funciones

```js
export const submitViaticoMonth = async (allowanceIds) => {
  const { data } = await api.post("/viaticos/submit-month", { allowance_ids: allowanceIds });
  return data?.data || data;
};
```

**Entregables Fase 2**:
- [ ] `POST /viaticos/submit-month` (backend)
- [ ] `submitViaticoMonth` en `viaticosApi.js`
- [ ] Refactor de `ViaticosWizard.jsx`: Paso 1 multi-salida
- [ ] Refactor de `ViaticosWizard.jsx`: Paso 2 clasificación unificada con validación inline
- [ ] Refactor de `ViaticosWizard.jsx`: Paso 3 notas/compras con selector de salida
- [ ] Refactor de `ViaticosWizard.jsx`: Paso 4 resumen multi-salida + submit unificado

---

## Fase 3: Vistas de revisión separadas + correcciones + reportes

**Objetivo**: Talento humano y financiero tienen vistas completamente distintas que solo muestran lo que les corresponde revisar. Ambos pueden solicitar correcciones con observación. El declarante puede ver la observación y reenviar. Se agrega descarga de reporte por usuario.

### 3.1 Backend: consultas filtradas por rol

**Nuevo endpoint**: `GET /viaticos/review/talento`  
**Roles**: `talento_humano`, `jefe_talento_humano`  
**Filtro**: Solo trae allowances donde `requires_talento_approval = true` y `talento_approval_status = 'pending'` o `= 'not_required'` (pero `workflow_status` esté en revisión)  
**Datos retornados**: El allowance completo + facturas `without_card` + todas las notas manuales + todas las compras sin factura. NO incluye facturas `with_card`.

**Nuevo endpoint**: `GET /viaticos/review/finance`  
**Roles**: `finanzas`, `financiero`, `jefe_finanzas`, `jefe_financiero`  
**Filtro**: Solo trae allowances donde `requires_finance_approval = true` y `finance_approval_status = 'pending'`  
**Datos retornados**: El allowance completo + solo facturas `with_card`. NO incluye efectivo, notas ni compras.

### 3.2 Backend: reporte por usuario

**Endpoint existente a extender**: `GET /viaticos/reports/summary`  
**Nuevos parámetros**: `group_by=usuario`, `period_type=month|year`, `period=2026-06|2026`  
**Nueva columna en query**: `status` breakdown (enviados, rechazados, aprobados, pagados)

**Nuevo endpoint**: `GET /viaticos/reports/user-export`  
**Roles**: todos los revisores  
**Formato**: JSON que el frontend convierte a CSV descargable  
**Payload query**: `requester_email`, `start_date`, `end_date`  
**Datos**: por allowance → estado, monto, fecha, salidas vinculadas, facturas total, facturas rechazadas

### 3.3 Frontend: workspace de talento_humano

**Archivo nuevo**: `spi_front/src/modules/talento/pages/ViaticosRevisionTalento.jsx`  
(o como tab dentro del workspace existente con condicional de rol)

**Layout**:
```
Panel izquierdo: Lista de declarantes con pendientes
Panel derecho: Expediente del declarante seleccionado
  → Tab: Efectivo (facturas without_card)
  → Tab: Notas de venta
  → Tab: Compras sin factura
  → Por factura/nota/compra: [Rechazar con nota] [Aprobar]
  → Footer: [Solicitar corrección ✏️] [Aprobar todo el mes ✓]
```

**Flujo de corrección**:
1. Revisor hace clic en "Solicitar corrección"
2. Modal: textarea para escribir la observación
3. POST `/viaticos/:id/request-correction` → `workflow_status = observado`
4. El declarante ve el badge "Observado" en su expediente + el texto de la observación
5. El declarante edita y reenvía desde el wizard (modo "Corregir")
6. El workflow vuelve a `pendiente_aprobacion_talento`

### 3.4 Frontend: workspace de financiero

**El `ViaticosMonthBatchModal` existente** se adapta:
- En el tab Facturas: filtra para mostrar SOLO facturas `with_card`
- En el tab Resumen: muestra solo las salidas que tienen `requires_finance_approval = true`
- Se elimina el tab "Notas" y "Anticipos" de la vista de financiero (no les corresponde)
- Nuevo tab: "Observaciones" → si el allowance está en `observado`, muestra el texto

### 3.5 Frontend: corrección visible para el declarante

En el panel del expediente del mes (vista declarante):
- Si cualquier salida del mes tiene `workflow_status = observado`: badge ambar en el expediente
- Al abrir el expediente: banner con la observación del revisor
- Botón "Corregir con wizard" → abre el wizard en modo corrección (el wizard recibe el grupo de salidas observadas)
- En modo corrección: el wizard empieza en el paso donde hay cambios requeridos (detectado por las notas de revisor en facturas)

### 3.6 Frontend: reporte descargable

En el header de la vista finanzas y talento:
- Botón "Descargar reporte"
- Modal de filtros: usuario (autocomplete), período (mes o año), estados a incluir
- Descarga CSV con columnas: Usuario, Fecha salida, Estado, Monto solicitado, Monto aprobado, Facturas total, Rechazadas, Modo pago, Fecha pago

**Entregables Fase 3**:
- [ ] `GET /viaticos/review/talento` (backend)
- [ ] `GET /viaticos/review/finance` (backend)
- [ ] `GET /viaticos/reports/user-export` (backend)
- [ ] Vista de revisión Talento Humano con tabs efectivo/notas/compras
- [ ] Modal de solicitud de corrección con observación (talento y finanzas)
- [ ] Banner de observación en vista del declarante
- [ ] Wizard modo corrección (permite reenviar salidas en estado `observado`)
- [ ] Reporte descargable en CSV (modal de filtros + download)

---

## Fase 4: Pago y cierre con comprobante

**Objetivo**: El pago batch del mes (ya implementado) queda como está. Se agrega la capacidad de que talento_humano suba el comprobante de pago una vez realizado. El viático queda en estado `cerrado`.

### 4.1 Backend: endpoint de comprobante de pago

**Nuevo endpoint**: `POST /viaticos/batch-receipt`  
**Roles**: `talento_humano`, `jefe_talento_humano`  
**Payload**: `{ allowance_ids: number[], file_base64: string, file_name: string }`  
**Lógica**:
- Valida que todos los IDs estén en `status = 'paid'`
- Sube el archivo a Google Drive (carpeta de comprobantes de viáticos)
- Guarda `payment_receipt_drive_url`, `payment_receipt_drive_id`, `payment_receipt_uploaded_at`, `payment_receipt_uploaded_by` en cada allowance
- Cambia `workflow_status` a `cerrado` en todos
- Notifica al declarante: "Tu viático del mes X está cerrado. Comprobante disponible."

**Nuevo endpoint**: `GET /viaticos/:id/receipt`  
**Roles**: el propio declarante, talento, finanzas  
**Retorna**: `{ drive_url, uploaded_at, uploaded_by_name }`

### 4.2 Frontend: UI de cierre en vista Talento

En el `ViaticosMonthBatchModal` cuando todas las salidas del mes están `status = 'paid'` y `workflow_status` no es `cerrado`:

```
┌─────────────────────────────────────────────────────┐
│ Mes pagado — pendiente de comprobante               │
│                                                      │
│ [📎 Subir comprobante de pago]                      │
│                                                      │
│ El comprobante cerrará el expediente del mes.        │
└─────────────────────────────────────────────────────┘
```

- Input de archivo (PDF, imagen)
- Confirmar → llama a `POST /viaticos/batch-receipt`
- Una vez subido: badge "Cerrado" verde en el expediente

### 4.3 Frontend: vista del declarante — comprobante

En el expediente del mes, cuando el estado es `cerrado`:
- Badge "Cerrado" verde
- Link "Ver comprobante de pago" → abre Drive URL en nueva pestaña

### 4.4 `viaticosApi.js` nuevas funciones

```js
export const uploadBatchReceipt = async (payload) => {
  const { data } = await api.post("/viaticos/batch-receipt", payload);
  return data?.data || data;
};

export const getViaticoReceipt = async (viaticoId) => {
  const { data } = await api.get(`/viaticos/${viaticoId}/receipt`);
  return data?.data || data;
};
```

**Entregables Fase 4**:
- [ ] `POST /viaticos/batch-receipt` (backend)
- [ ] `GET /viaticos/:id/receipt` (backend)
- [ ] `uploadBatchReceipt`, `getViaticoReceipt` en `viaticosApi.js`
- [ ] UI de subida de comprobante en vista Talento (batch modal)
- [ ] Comprobante visible para el declarante en el expediente cerrado

---

## Mapa de flujo completo post-rework

```
DECLARANTE
  │
  ▼
[Expediente del mes] — vista por mes en ViaticosWorkspace
  │
  ├─ Salidas sin clasificar → [Clasificar cada una: Dentro / Fuera]
  │     └─ Dentro del área → workflow_status = cerrado automático
  │     └─ Fuera del área → se agrupan
  │
  ▼
[Abrir wizard del mes] — todas las salidas fuera del área juntas
  │
  ├─ Paso 1: Cargar TXT del SRI → facturas vinculadas a cada salida por rango
  ├─ Paso 2: Clasificar cada factura → concepto + (con tarjeta / sin tarjeta)
  ├─ Paso 3: Notas de venta + compras sin factura por salida
  └─ Paso 4: Resumen → [Enviar a revisión del mes]
                              │
                              ├─► TALENTO HUMANO
                              │     ve: efectivo + notas + compras
                              │     puede: aprobar, rechazar factura, solicitar corrección
                              │
                              └─► FINANCIERO
                                    ve: solo facturas con tarjeta
                                    puede: aprobar, rechazar factura, solicitar corrección

Si corrección solicitada:
  ▼
DECLARANTE recibe observación → abre wizard en modo "Corregir" → reenvía
  ▼
(Ciclo de revisión se repite hasta aprobación)

Una vez ambos roles aprueban:
  ▼
FINANCIERO → [Pagar mes completo] → batchPayViaticos(ids) — transacción atómica
  ▼
TALENTO HUMANO → [Subir comprobante] → uploadBatchReceipt
  ▼
Estado final: workflow_status = cerrado — expediente completo
```

---

## Dependencias entre fases

```
Fase 1 (migración + clasificación) → requerida para Fase 2
Fase 2 (wizard multi-salida)        → requerida para Fase 3
Fase 3 (vistas revisión)            → requerida para Fase 4
Fase 4 (comprobante)                → independiente una vez que pago batch existe
```

## Archivos principales afectados

| Archivo | Fases |
|---|---|
| `backend/migrations/228_viaticos_rework.sql` | 1 |
| `backend/src/modules/viaticos/viaticos.service.js` | 1, 2, 3, 4 |
| `backend/src/modules/viaticos/viaticos.controller.js` | 1, 2, 3, 4 |
| `backend/src/modules/viaticos/viaticos.routes.js` | 1, 2, 3, 4 |
| `spi_front/src/core/api/viaticosApi.js` | 2, 4 |
| `spi_front/src/modules/finanzas/pages/ViaticosWorkspace.jsx` | 1, 3 |
| `spi_front/src/modules/finanzas/components/viaticos/ViaticosWizard.jsx` | 2, 3 |
| `spi_front/src/modules/finanzas/pages/ViaticosMonthBatchModal` (inline) | 3, 4 |

## Lo que NO cambia

- Tabla `travel_allowances` estructura base (solo se agregan columnas)
- Endpoint `PATCH /:id/approve-segment` — sigue siendo por salida individual
- Endpoint `POST /viaticos/batch-pay` — recién implementado, sin cambios
- `ViaticosMonthBatchModal` — se adapta pero la estructura base se mantiene
- `buildFinanceSummaryReport` — se extiende, no se reemplaza
