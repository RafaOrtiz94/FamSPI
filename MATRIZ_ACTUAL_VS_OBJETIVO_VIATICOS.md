# Matriz Actual vs Objetivo del Módulo de Viáticos

## 1. Estado de la auditoría

Fecha de auditoría:

- 2026-06-29

Fuente usada:

- `backend/src/modules/viaticos/CONTEXT.md`
- `backend/src/modules/attendance/CONTEXT.md`
- código real backend
- código real frontend

Limitación:

- Neon no fue verificado en esta fase
- el modelo DB aquí descrito proviene de `ensureSchema()` y del código real

Conclusión de contexto:

- `backend/src/modules/viaticos/CONTEXT.md` está inconsistente con el código
- `backend/src/modules/attendance/CONTEXT.md` también quedó desalineado con el estado actual del flujo operativo

## 2. Resumen ejecutivo

El sistema actual ya tiene una base funcional útil:

- usa `attendance_exceptions` como fuente candidata de salidas operacionales
- soporta clasificación `dentro/fuera del área`
- soporta `expense_mode` con tarjeta / sin tarjeta
- tiene colas separadas de talento y finanzas
- tiene anticipo
- tiene observaciones
- tiene cierre con comprobante

Pero todavía no está alineado al objetivo definido porque:

- no existe modelo formal de expediente padre e hijos
- el flujo actual sigue centrado en `travel_allowances` como unidad principal
- el estado del padre no existe como entidad de negocio
- la anulación por vencimiento no existe
- la separación visual y funcional de `dentro del área` / `anulados` / `padre parcial` es incompleta
- aún existen endpoints y lógica heredada de salidas imprevistas
- la visibilidad del revisor sigue siendo por segmento, no por hijo formal persistido

## 3. Matriz de hallazgos

### 3.1 Origen del flujo

Objetivo:

- el único origen formal del viático debe ser una salida operacional registrada en asistencia

Actual:

- `listVisitCandidates` ya mezcla varios orígenes:
  - `client_visit_logs`
  - `prospect_visits`
  - `attendance_exceptions`
- evidencia:
  - [viaticos.service.js](C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/backend/src/modules/viaticos/viaticos.service.js)
  - búsquedas sobre `client_visit`, `prospect_visit`, `operational_exit`

Brecha:

- el sistema no está restringido al origen único requerido

Acción requerida:

- aislar o desactivar como origen procesable todo lo que no sea `attendance_exceptions`

### 3.2 Flujo operativo en asistencia

Objetivo:

- la salida operacional es el origen estándar
- las salidas imprevistas ya no deben formar parte del diseño objetivo

Actual:

- siguen existiendo aliases y controladores de `unexpected`
- evidencia:
  - [attendance.routes.js](C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/backend/src/modules/attendance/attendance.routes.js)
  - endpoints:
    - `/marcar/salida-imprevista`
    - `/marcar/regreso-imprevisto`
    - `/marcar/entrada-imprevista`
    - `/marcar/llegada-imprevista`
    - `/marcar/retorno-imprevisto`

Brecha:

- la capa de asistencia mantiene rutas y flujos heredados que contradicen el objetivo

Acción requerida:

- retirar de UI los caminos heredados
- definir si backend los mantiene por compatibilidad o si se deprecian formalmente

### 3.3 Datos operativos de vehículo personal

Objetivo:

- para salida con vehículo personal deben existir:
  - km inicial
  - km final
  - fotos de kilometraje
- debe verse en talento y finanzas

Actual:

- backend de asistencia ya guarda:
  - `uses_personal_vehicle`
  - `odometer_start_km`
  - `odometer_end_km`
  - `odometer_start_photo_drive_*`
  - `odometer_end_photo_drive_*`
- evidencia:
  - `attendance.controller.js`
  - `clockOutOperational`
  - `clockInOperational`

- frontend de viáticos ya lo muestra en parte
  - `OperationalVehicleEvidence`
  - [ViaticosDeclarant.jsx](C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/spi_front/src/modules/finanzas/pages/ViaticosDeclarant.jsx)

Brecha:

- está soportado técnicamente, pero no consolidado como regla completa del flujo objetivo

Acción requerida:

- convertirlo en requisito explícito
- validar visibilidad equivalente en talento y finanzas

### 3.4 Clasificación inicial dentro/fuera del área

Objetivo:

- el colaborador clasifica `dentro del área` o `fuera del área`
- `dentro del área` queda en sección separada
- `fuera del área` entra a viáticos

Actual:

- el frontend ya tiene clasificación operativa de candidato
- evidencia:
  - [ViaticosDeclarant.jsx](C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/spi_front/src/modules/finanzas/pages/ViaticosDeclarant.jsx)
  - `StepContentClasificar`
  - `outside_labor_area`

- además ya existe visual de “dentro del área”
  - `insideItems`
  - copy: `sin accion requerida`

Brecha:

- la clasificación existe, pero no está modelada como destino funcional completo
- no existe sección formal de anulados
- el modelo sigue centrado en el mes, no en estados padre formalizados

Acción requerida:

- fijar persistencia y secciones explícitas:
  - dentro del área
  - anulados para viáticos
  - sin procesar
  - parcial
  - liquidado total

### 3.5 Modelo padre/hijos

Objetivo:

- expediente padre
- hijos `con tarjeta` y `sin tarjeta`
- estados del padre:
  - sin procesar
  - parcial
  - liquidado total

Actual:

- no existe entidad formal de padre/hijo
- el sistema actual usa:
  - `travel_allowances` como registro principal
  - `expense_mode` para dividir revisiones
  - agregados calculados `total_with_card` y `total_without_card`

Evidencia:

- [viaticos.service.js](C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/backend/src/modules/viaticos/viaticos.service.js)
- columnas:
  - `total_with_card`
  - `total_without_card`
  - `requires_finance_approval`
  - `requires_talento_approval`

Brecha:

- la división existe a nivel de cálculo
- no existe a nivel de expediente hijo formal

Acción requerida:

- decidir en Fase 2 si:
  - se amplía `travel_allowances` con jerarquía padre/hijo
  - o se crea tabla formal de subexpedientes

### 3.6 Clasificación manual de comprobantes

Objetivo:

- el colaborador clasifica manualmente cada comprobante como `con tarjeta` o `sin tarjeta`
- revisor no reclasifica

Actual:

- ya existe `expense_mode`
- se captura en:
  - facturas TXT/XML
  - notas manuales
  - compras sin factura

Evidencia:

- `ManualNoteForm.jsx`
- `PurchaseNoInvoiceForm.jsx`
- `ViaticosWizard.jsx`
- `travel_allowance_invoices.expense_mode`
- `travel_allowance_purchases_no_invoice.expense_mode`

Brecha:

- la clasificación manual sí existe
- falta convertirla en creadora automática de hijos formales

Acción requerida:

- enganchar creación o actualización de subexpedientes al momento de clasificar comprobantes

### 3.7 Revisión separada por talento y finanzas

Objetivo:

- talento humano ve solo el hijo `sin tarjeta`
- finanzas ve solo el hijo `con tarjeta`

Actual:

- existen colas separadas por segmento:
  - `/review/talento`
  - `/review/finance`
- el filtrado se apoya en:
  - `requires_talento_approval`
  - `requires_finance_approval`
  - `total_with_card`
  - `total_without_card`

Evidencia:

- [viaticos.routes.js](C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/backend/src/modules/viaticos/viaticos.routes.js)
- [ViaticosRevisionTalento.jsx](C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/spi_front/src/modules/finanzas/pages/ViaticosRevisionTalento.jsx)
- [ViaticosRevisionFinanzas.jsx](C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/spi_front/src/modules/finanzas/pages/ViaticosRevisionFinanzas.jsx)

Brecha:

- la separación existe por cola
- no por hijo persistido como entidad

Acción requerida:

- migrar de segmentación calculada a segmentación por subexpediente real

### 3.8 Estados actuales

Objetivo de hijos:

- borrador
- enviado
- en revisión
- aprobado
- rechazado
- liquidado

Objetivo del padre:

- sin procesar
- parcial
- liquidado total

Actual:

- `travel_allowances.workflow_status` usa un catálogo amplio y mezclado:
  - `borrador`
  - `pendiente_revision`
  - `pendiente_aprobacion_talento`
  - `pendiente_aprobacion_financiera`
  - `pendiente_aprobacion_mixta`
  - `observado`
  - `aprobado_jefe`
  - `pendiente_financiero`
  - `aprobado_financiero`
  - `aprobado_talento_humano`
  - `aprobado_mixto`
  - `listo_pago`
  - `pagado`
  - `cerrado`
  - otros

Brecha:

- el catálogo actual mezcla:
  - estado del expediente
  - estado de revisión
  - estado de pago
  - estado de cierre

Acción requerida:

- separar semánticamente:
  - estado del padre
  - estado del hijo
  - estado del anticipo
  - trazabilidad de observaciones

### 3.9 Rechazo y observaciones

Objetivo:

- devolver a borrador
- conservar historial
- excluir comprobante rechazado de la liquidación activa

Actual:

- existe `reviewer_observation`
- existe `requestCorrection`
- existe `reviewer_note` en factura
- existe rechazo de factura

Brecha:

- hoy la observación está principalmente en cabecera y factura
- no existe historial estructurado de observaciones
- no existe trazabilidad formal separada de rechazados reusables por padre/hijo

Acción requerida:

- modelar historial de observaciones
- modelar trazabilidad de comprobantes rechazados

### 3.10 Plazo y anulación

Objetivo:

- cierre del mes
- gracia fija de 7 días del mes siguiente
- anular:
  - salidas sin procesar
  - hijos en borrador
- no anular hijos ya enviados

Actual:

- no existe evidencia de lógica de vencimiento por cierre de mes y 7 días
- tampoco existe estado formal de anulado por vencimiento

Brecha:

- el sistema actual no implementa la regla temporal objetivo

Acción requerida:

- introducir cálculo de vencimiento
- introducir anulación visible
- introducir sección separada de anulados

### 3.11 Anticipos

Objetivo:

- el anticipo vive en el padre
- el sistema descuenta solo desde `desembolsado`
- evidencia obligatoria del desembolso

Actual:

- existe flujo de anticipos:
  - `pending_approval`
  - `approved`
  - `disbursed`
  - `applied`
  - `rejected`
- el anticipo está vinculado a `allowance_id`

Brecha:

- como no existe padre formal, hoy el anticipo vive sobre `travel_allowances`
- el campo `applied` está orientado a liquidación de anticipo, no al padre global objetivo
- no está resuelto como saldo global de expediente padre

Acción requerida:

- relocalizar semánticamente el anticipo al padre
- recalcular impacto sobre hijos liquidados

### 3.12 Saldo global

Objetivo:

- cálculo automático
- inmutable
- visible a colaborador, finanzas y talento

Actual:

- no existe entidad o bloque formal de saldo global del padre
- sí hay lógica parcial en anticipos y totales por allowance

Brecha:

- el saldo global del padre no existe como objeto funcional consolidado

Acción requerida:

- crear cálculo de saldo global sobre padre
- integrar:
  - total hijos liquidados
  - anticipo desembolsado
  - resultado final

### 3.13 Documentos finales por hijo

Objetivo:

- documento automático por cada hijo liquidado

Actual:

- existe cierre con comprobante de pago de expediente
- existe `payment_receipt_drive_url`
- existe `/batch-receipt`

Brecha:

- el documento actual corresponde al cierre del expediente actual
- no a documento automático por cada hijo liquidado

Acción requerida:

- rediseñar generación documental para el nuevo modelo hijo

## 4. Matriz de pantallas actuales

### Frontend actual confirmado

- `ViaticosWorkspace`
  - enruta por rol
- `ViaticosDeclarant`
  - vista del colaborador y supervisor
- `ViaticosRevisionTalento`
  - vista talento
- `ViaticosRevisionFinanzas`
  - vista finanzas
- `ViaticosWizard`
  - carga y clasificación de gastos

### Desalineaciones visuales/funcionales

- no hay secciones formales para:
  - anulados para viáticos
  - expedientes padre `sin procesar`
  - expedientes padre `parcial`
  - expedientes padre `liquidado total`
- se sigue operando en gran parte sobre salidas/meses, no sobre padre/hijos formales

## 5. Riesgos inmediatos antes de corregir

- intentar meter padre/hijos encima de `travel_allowances` sin diseño de datos explícito
- romper colas actuales de talento y finanzas
- duplicar lógica entre wizard mensual e individual
- dejar inconsistencias entre anticipo actual y saldo global objetivo

## 6. Cierre de Fase 1

Entregables logrados:

- matriz de endpoints reales
- matriz de vistas y roles
- matriz de estructuras lógicas actuales
- identificación de brechas contra el objetivo

Fase siguiente recomendada:

- Fase 2: diseño del modelo de datos objetivo padre/hijos/trazabilidad/anticipo

