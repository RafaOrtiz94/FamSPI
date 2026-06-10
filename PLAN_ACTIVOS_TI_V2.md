# PLAN DE DESARROLLO: MÓDULO ACTIVOS TI V2
**Fecha**: 2026-06-10  
**Objetivo**: Implementar 7 requisitos críticos para control de activos móviles, depreciación y trazabilidad

---

## 📋 REQUISITOS A IMPLEMENTAR

### 1️⃣ NÚMEROS CORPORATIVOS (Móviles solamente)
**Dependencia**: Tabla `ti_corporate_numbers` + Tab en UI  
**Acciones**:
- **BD**: Crear tabla `ti_corporate_numbers` con campos:
  - `id`, `number` (TEXT UNIQUE), `status` (available/assigned/inactive)
  - `assigned_to_user_id` (nullable), `assigned_at` (TIMESTAMPTZ)
  - `asset_id` (BIGINT, FK a ti_assets)
  - `created_at`, `updated_at`
  
- **Lógica Asignación**:
  - Si asignación incluye equipo móvil (type='mobile') → asignar número corporativo seleccionandolo de los disponibles 
  - Si múltiples equipos y al menos 1 móvil → asignar número corporativo seleccionando de los disponibles 
  
- **Tabla Cambios**: `ti_corporate_number_history`
  - `id`, `number_id`, `old_number` (TEXT), `new_number` (TEXT), `changed_at`, `changed_by`
  - Registrar cada cambio de número
  
- **UI Tab**: "Números Corporativos"
  - Listado: número, usuario asignado, equipo, fecha asignación, historial y departamento que ha utilizado.
  - Botón: "Cambiar número" → modal con números disponibles
  - Ver historial de cambios (quién, cuándo, de qué a qué)

---

### 2️⃣ OBSERVACIONES → CARACTERÍSTICAS
**Dependencia**: Renombramiento + FK a asignaciones  
**Acciones**:
- **BD**: 
  - Renombrar columna `observations` → `characteristics` en `ti_asset_actas_items`
  - Agregar `characteristics` también a `ti_asset_assignments` (TEXT)
  
- **Lógica**:
  - Las características se capturan en CADA ASIGNACIÓN (no solo en acta)
  - Permitir editar características durante asignación
  - Mostrar características en historial de asignaciones
  
- **UI**:
  - Modal asignación: campo "Características" (textarea)
  - Historial asignaciones: mostrar características por cada asignación anterior

---

### 3️⃣ ESTADO AUTOMÁTICO SEGÚN ASIGNACIÓN
**Dependencia**: Validación de flujo + Restricciones TI  
**Acciones**:
- **Estados posibles**: `unassigned`, `assigned`, `damaged`, `in_maintenance`, `retired`, `available`
  
- **Transiciones automáticas**:
  ```
  [unassigned/available] → [assigned]  (al asignar usuario)
  [assigned] → [unassigned/available]  (al liberar)
  ```
  
- **Restricciones**:
  - Solo TI puede cambiar a: `damaged`, `in_maintenance`, `retired`, `unassigned`, `available`.
  - Solo pueden asignarse equipos en estado `available` o `unassigned`
  - Si está `damaged`, `in_maintenance`, `retired` → NO se puede asignar
  - Validar en backend y UI: deshabilitar botón "Asignar" si estado no es válido
  
- **UI**:
  - Selector estado: visible solo para TI
  - Mostrar estado con badge:
    - `available` → verde
    - `assigned` → azul
    - `damaged` → rojo
    - `in_maintenance` → ámbar
    - `retired` → gris

---

### 4️⃣ FACTURA Y LETRA DE CAMBIO (Persistencia)
**Dependencia**: Validación carga + FK a asignación  
**Acciones**:
- **BD**:
  - `ti_asset_financial_docs`: agregar columna `assignment_id` (FK opcional a ti_asset_assignments)
  - Factura: `asset_id` NO cambia (liga permanente al equipo)
  - Letra de cambio: `assignment_id` = liga a asignación específica
  
- **Validación**:
  - Factura: solo 1 por equipo (upsert, desactiva anterior si existe)
  - Letra de cambio: nueva por cada asignación (INSERT, sin deletear)
  
- **UI**:
  - Mostrar factura en pestaña "Documentos" (permanente al equipo)
  - Mostrar letras de cambio en historial (1 por asignación)
  - Al asignar → validar que existe factura o permitir subir
  
- **Verificación**:
  - Agregar validación: equipo no puede liberarse si no tiene factura (opcional, según requerimiento)

---

### 5️⃣ FOTOGRAFÍA DE LIBERACIÓN + ACTA DE DEVOLUCIÓN
**Dependencia**: Capturar fotos + Generador acta + Validaciones  
**Acciones**:
- **Flujo Liberación**:
  1. Usuario (TI) inicia "Liberar equipo"
  2. Modal: capturar fotos (cámara o upload)
  3. Validar fotos no vacía
  4. Generar ACTA DE DEVOLUCIÓN (diferente a acta de entrega):
     - Formato: ACTA-D-RT-2026-XXXXXX (RT = retiro/devolución)
     - Incluir: equipo, usuario anterior, fecha, fotos adjunta, estado final
  5. Guardar foto en Google Drive
  6. Cambiar estado equipo a `available`
  7. Crear asignación ficticia de "retiro" con foto
  
- **BD**:
  - Tabla `ti_asset_liberation_photos`:
    - `id`, `asset_id`, `filename`, `drive_url`, `drive_file_id`, `sha256`
    - `liberated_by`, `liberated_at`, `notes`
  
  - Acta retiro: usar mismo `ti_asset_actas` con `tipo='retiro'`
  
- **Validaciones**:
  - Solo si `status='assigned'` → mostrar botón "Liberar"
  - Si `status != 'assigned'` → botón deshabilitado

---

### 6️⃣ LETRA DE CAMBIO VINCULADA AL USUARIO (Visible en UI)
**Dependencia**: FK usuario en letra de cambio  
**Acciones**:
- **BD**:
  - `ti_asset_financial_docs`: agregar `assigned_user_id` (para letras de cambio)
  - Cuando se crea letra de cambio → guardar el user_id asignado
  
- **UI**:
  - Tab "Historial de Asignaciones":
    - Mostrar: Usuario | Fecha asignación | Acta | Letra de cambio (botón descargar)
    - Si letra de cambio existe → link "Descargar PDF"
  
  - Tab "Mis Documentos" (para usuario):
    - Filtrar: letras de cambio donde assigned_user_id = usuario actual
    - Mostrar: equipo, fecha, link descarga

---

### 7️⃣ VALOR Y DEPRECIACIÓN (Financiero)
**Dependencia**: Campo `purchase_value` + Cálculo deprec. + Reporte  
**Acciones**:
- **BD**:
  - Tabla `ti_assets`: agregar columna `purchase_value` (DECIMAL)
  - Agregar columna `value_category` (TEXT: 'asset'/'control_item')
  
- **Lógica Depreciación**:
  ```
  if purchase_value >= 400:
    category = 'asset'
    depreciation_rate = 33.33% / 3 years = 11.11% per year
    annual_depreciation = purchase_value * 0.1111
  else:
    category = 'control_item'
    depreciation_rate = 0% (no depreciation)
  ```
  
- **UI - Crear Equipo** (rol Financiero):
  - Campo: "Valor de compra" (input numérico)
  - Mostrar automáticamente:
    - "Categoría": asset / bien de control
    - "Depreciación anual": $X / year
    - "Valor residual": $X (después de 3 años)
  
- **Reporte de Activo TI**:
  - Mostrar: equipo, usuario actual, acta, fecha asignación, características
  - Agregar columna: "Valor original" | "Depreciación acumulada" | "Valor neto"
  - Tabla histórica: usuario anterior, estado entrega (usado 9/10), estado recepción (nuevo 10/10)

---

## 🗂️ CAMBIOS EN BD (Resumen)

### Tablas Nuevas
- `ti_corporate_numbers` (número corporativo)
- `ti_corporate_number_history` (historial cambios)
- `ti_asset_liberation_photos` (fotos liberación)

### Tablas Modificadas
- `ti_assets`: agregar `purchase_value`, `value_category`
- `ti_asset_actas_items`: renombrar `observations` → `characteristics`
- `ti_asset_assignments`: agregar `characteristics`
- `ti_asset_financial_docs`: agregar `assignment_id`, `assigned_user_id`

---

## 🎨 COMPONENTES UI (Basados en DESIGN.md)

### Nuevos Tabs
1. **Números Corporativos** (en TI Assets)
   - Tabla con badge status (disponible=verde, asignado=azul)
   - Botón "Cambiar número"
   - Link "Ver historial de cambios"

2. **Historial de Asignaciones** (en Asset detail)
   - Tabla: usuario | fecha | acta | letra de cambio | características | estado
   - Badge estado: used 9/10, new 10/10 (amarillo/verde)

### Modales Nuevos
1. **Modal Cambio de Número Corporativo**
   - Select: números disponibles
   - Motivo del cambio (textarea)
   - Botones: Cancelar | Cambiar

2. **Modal Liberación de Equipo**
   - Captura foto (input file + preview)
   - Notas (textarea)
   - Botones: Cancelar | Generar acta y liberar

### Validaciones UI
- Botón "Asignar" deshabilitado si `status != 'available'`
- Botón "Liberar" deshabilitado si `status != 'assigned'`
- Mostrar características editables durante asignación
- Mostrar letras de cambio solo en historial (no crear nueva manualmente)

---

## 📊 REPORTE DE ACTIVO TI (Ampliado)

```
ENCABEZADO
├─ Nombre equipo | Serial | Estado
├─ Valor original | Depreciación acumulada | Valor neto
├─ Fecha creación | Última asignación | Acta actual

SECCIÓN: ASIGNACIÓN ACTUAL
├─ Usuario | Fecha asignación | Acta-ET-2026-XXXXXX
├─ Número corporativo (si móvil)
├─ Letra de cambio: link descargar

SECCIÓN: HISTORIAL DE ASIGNACIONES (tabla)
├─ #  | Usuario Anterior | Fecha | Acta | Características | Estado Entrega | Estado Recepción
├─ 1  | User1 | 2026-01-15 | ACTA-ET-2026-000001 | Sin rayones | Nuevo 10/10 | -
├─ 2  | User2 | 2026-03-20 | ACTA-ET-2026-000002 | Rayón en esquina | Usado 9/10 | Usado 8/10
├─ ... (más asignaciones)
```

---

## ✅ ORDEN DE IMPLEMENTACIÓN (Recomendado)

1. **Fase 1 - Base de datos**: Crear tablas nuevas + alterar existentes
2. **Fase 2 - Números corporativos**: Servicio + API + Tab UI
3. **Fase 3 - Depreciación**: Campo valor + cálculo + reporte
4. **Fase 4 - Estados automáticos**: Validaciones + transiciones
5. **Fase 5 - Documentos**: Factura + Letra cambio (persistencia)
6. **Fase 6 - Liberación**: Foto + Acta retiro
7. **Fase 7 - UI completa**: Historial asignaciones + características

---

## 🎯 SKILLS A USAR

- **PostgreSQL**: Crear tablas + FKs + índices
- **Express**: Nuevas rutas + servicios + validaciones
- **React**: Nuevos tabs + modales + tablas
- **pdf-lib**: Generar ACTA-RT (acta de retiro)
- **Google Drive**: Subir fotos de liberación
- **Validación**: Estados + transiciones + roles

---

## 📌 NOTAS IMPORTANTES

- **Características vs Observaciones**: Las características son datos del EQUIPO capturados en CADA asignación
- **Números corporativos**: Solo para móviles, con historial de cambios e informacion de que usuario tuvo antes y ahora
- **Estados automáticos**: No se pueden asignar equipos si no están en estado "disponible"
- **Depreciación**: $400+ = 33.33% en 3 años; <$400 = no deprecia (bien de control)
- **Letras de cambio**: Nueva por cada asignación diferente, visible en historial y perfil usuario
- **Foto liberación**: Obligatoria, genera acta de devolución automáticamente
