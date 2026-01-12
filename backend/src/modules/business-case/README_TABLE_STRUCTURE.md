# Guía de Uso: equipment_purchase_requests como Tabla Principal del BC

## 📌 Decisión Arquitectónica

Se decidió **usar `equipment_purchase_requests` como tabla principal** para Business Cases, en lugar de crear una nueva tabla `business_cases`.

### ✅ Ventajas de esta decisión:
- **Sin duplicación**: Reutiliza tabla existente
- **Backward compatibility**: BCs legacy (Google Sheets) siguen funcionando
- **Migración gradual**: Se pueden migrar BCs uno por uno
- **Menos complejidad**: No hay que sincronizar dos tablas

### ⚠️ Cómo evitar confusión:

1. **En el código backend**: Usar siempre la vista `v_business_cases`
2. **En frontend**: Llamarlo "Business Case" (no "Equipment Purchase Request")
3. **Campo discriminador**: `uses_modern_system` y `bc_system_type`

---

## 🏗️ Estructura Actualizada

### Tabla Principal: `equipment_purchase_requests`

```sql
CREATE TABLE equipment_purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Campos originales (legacy + modern)
  client_name TEXT,
  client_id INTEGER REFERENCES clients(id),
  status VARCHAR(50),
  bc_stage VARCHAR(50),
  bc_progress JSONB,
  assigned_to_email TEXT,
  assigned_to_name TEXT,
  drive_folder_id TEXT,
  request_type VARCHAR(50),
  extra JSONB,
  
  -- Campos SOLO para legacy (Google Sheets)
  bc_spreadsheet_id TEXT,        -- NULL para modernos
  bc_spreadsheet_url TEXT,        -- NULL para modernos
  
  -- Campos NUEVOS (diferenciador)
  uses_modern_system BOOLEAN DEFAULT false,     -- KEY FIELD
  bc_system_type VARCHAR(50) DEFAULT 'legacy',  -- 'legacy' o 'modern'
  modern_bc_metadata JSONB DEFAULT '{}',        -- Metadata del sistema moderno
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by INTEGER REFERENCES users(id),
  bc_created_at TIMESTAMPTZ
);
```

### Relaciones (Foreign Keys Agregadas)

```
equipment_purchase_requests (id UUID)
  ↓
  ├─ bc_equipment_selection.business_case_id (FK agregada ✅)
  ├─ bc_determinations.business_case_id (FK agregada ✅)
  ├─ bc_calculations.business_case_id (FK agregada ✅)
  ├─ bc_audit_log.business_case_id (FK agregada ✅)
  └─ equipment_purchase_bc_items.request_id (FK verificada ✅)
```

---

## 📊 Vistas Creadas (Para NO confundirse)

### 1. `v_business_cases` ✅ **USAR ESTA EN CÓDIGO**

Vista que muestra **SOLO Business Cases modernos**:

```sql
SELECT * FROM v_business_cases;
-- Retorna solo BCs con uses_modern_system = true
```

**Uso en backend**:
```javascript
// ✅ CORRECTO: Usar vista
const modernBCs = await db.query('SELECT * FROM v_business_cases WHERE status = $1', ['draft']);

// ❌ EVITAR: Consultar tabla directa sin filtro
const allRequests = await db.query('SELECT * FROM equipment_purchase_requests');
```

### 2. `v_business_cases_legacy`

Vista que muestra **SOLO Business Cases legacy** (Google Sheets):

```sql
SELECT * FROM v_business_cases_legacy;
-- Retorna solo BCs con uses_modern_system = false
```

### 3. `v_business_cases_complete`

Vista que muestra **TODOS los BCs** (modernos y legacy) con detalles completos:

```sql
SELECT * FROM v_business_cases_complete;
-- Útil para dashboards que necesitan ver ambos sistemas
```

---

## 💻 Cómo Usar en el Código Backend

### Ejemplo 1: Crear un BC moderno

```javascript
// backend/src/modules/business-case/businessCase.service.js

async function createBusinessCase({ clientName, clientId, userId }) {
  const query = `
    INSERT INTO equipment_purchase_requests (
      client_name,
      client_id,
      status,
      bc_stage,
      uses_modern_system,    -- ⭐ IMPORTANTE
      bc_system_type,        -- ⭐ IMPORTANTE
      request_type,
      created_by
    ) VALUES ($1, $2, $3, $4, true, 'modern', 'business_case', $5)
    RETURNING id AS business_case_id, *
  `;
  
  const result = await db.query(query, [
    clientName,
    clientId,
    'draft',
    'pending_comercial',
    userId
  ]);
  
  return result.rows[0];
}
```

### Ejemplo 2: Obtener BCs modernos

```javascript
async function listModernBusinessCases(filters = {}) {
  // ✅ Usar la vista
  const query = `
    SELECT * FROM v_business_cases
    WHERE status = COALESCE($1, status)
    ORDER BY created_at DESC
  `;
  
  const result = await db.query(query, [filters.status]);
  return result.rows;
}
```

### Ejemplo 3: Obtener un BC completo

```javascript
async function getBusinessCaseById(businessCaseId) {
  const query = `
    SELECT * FROM v_business_cases_complete
    WHERE business_case_id = $1
  `;
  
  const result = await db.query(query, [businessCaseId]);
  
  if (!result.rows.length) {
    throw new Error('Business Case no encontrado');
  }
  
  const bc = result.rows[0];
  
  // Validar que sea moderno
  if (bc.bc_system_type !== 'modern') {
    throw new Error('Este Business Case usa el sistema legacy (Google Sheets)');
  }
  
  return bc;
}
```

### Ejemplo 4: Migrar BC legacy a moderno

```javascript
async function migrateLegacyToModern(businessCaseId) {
  // Usar función SQL creada
  const query = `SELECT * FROM migrate_legacy_bc_to_modern($1)`;
  const result = await db.query(query, [businessCaseId]);
  
  const { success, message } = result.rows[0];
  
  if (!success) {
    throw new Error(message);
  }
  
  return { success: true, message };
}
```

---

## 🎨 Cómo Mostrar en el Frontend

### En la UI, NUNCA mostrar "Equipment Purchase Request"

```jsx
// ❌ EVITAR
<h1>Equipment Purchase Request #{bc.id}</h1>

// ✅ CORRECTO
<h1>Business Case #{bc.id}</h1>
<h2>Cliente: {bc.client_name}</h2>
```

### En rutas y navegación

```javascript
// ✅ Rutas claras
/api/v1/business-case
/api/v1/business-case/:id
/business-case/new
/business-case/:id/edit

// ❌ EVITAR rutas confusas
/api/v1/equipment-purchase-requests
```

---

## 🔄 Backward Compatibility (Convivencia de Sistemas)

### Cómo conviven ambos sistemas:

```
┌─────────────────────────────────────────┐
│  equipment_purchase_requests            │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────┐  ┌─────────────────┐ │
│  │ LEGACY       │  │ MODERN          │ │
│  │ (Sheets)     │  │ (Nuevo Sistema) │ │
│  ├──────────────┤  ├─────────────────┤ │
│  │ uses_modern  │  │ uses_modern     │ │
│  │ = false      │  │ = true          │ │
│  │              │  │                 │ │
│  │ bc_spreadsh  │  │ bc_equipment_   │ │
│  │ eet_id ✅    │  │ selection ✅    │ │
│  │              │  │                 │ │
│  │              │  │ bc_determinat   │ │
│  │              │  │ ions ✅         │ │
│  │              │  │                 │ │
│  │              │  │ bc_calculations │ │
│  │              │  │ ✅              │ │
│  └──────────────┘  └─────────────────┘ │
└─────────────────────────────────────────┘
```

### Estrategia de Migración Gradual

**Opción 1: Migración Manual por BC**
```javascript
// En la UI, mostrar botón "Migrar a Nuevo Sistema"
// Solo para BCs legacy que lo permitan
if (bc.bc_system_type === 'legacy' && bc.status === 'draft') {
  // Mostrar botón
  <Button onClick={() => migrateLegacyToModern(bc.id)}>
    Migrar a Nuevo Sistema
  </Button>
}
```

**Opción 2: Mantener Legacy Indefinidamente**
```javascript
// BCs legacy continúan funcionando con Google Sheets
// BCs nuevos siempre usan sistema moderno
// Coexisten sin problemas
```

---

## 📝 Queries SQL Útiles

### Contar BCs por tipo de sistema

```sql
SELECT 
  bc_system_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'completed') as completed
FROM equipment_purchase_requests
GROUP BY bc_system_type;
```

### Ver todos los BCs modernos activos

```sql
SELECT 
  business_case_id,
  client_name,
  status,
  equipment_code,
  total_monthly_tests,
  total_monthly_cost
FROM v_business_cases_complete
WHERE bc_system_type = 'modern'
  AND status IN ('draft', 'pending_approval')
ORDER BY created_at DESC;
```

### Listar BCs legacy que se podrían migrar

```sql
SELECT 
  id,
  client_name,
  status,
  bc_created_at
FROM v_business_cases_legacy
WHERE status = 'draft'  -- Solo drafts se pueden migrar fácilmente
ORDER BY bc_created_at DESC;
```

---

## 🚨 Validaciones Importantes

### En Backend: Validar tipo antes de usar tablas modernas

```javascript
async function addDetermination(businessCaseId, determinationId, quantity) {
  // Validar que es un BC moderno
  const bcCheck = await db.query(
    `SELECT uses_modern_system FROM equipment_purchase_requests WHERE id = $1`,
    [businessCaseId]
  );
  
  if (!bcCheck.rows[0]?.uses_modern_system) {
    throw new Error('Este Business Case usa el sistema legacy y no soporta esta funcionalidad');
  }
  
  // Continuar con la lógica...
}
```

### Trigger Automático: Previene inconsistencias

El trigger `validate_bc_system_consistency` ya instalado previene:
- BCs modernos con `bc_spreadsheet_id` no NULL
- Inconsistencias entre `uses_modern_system` y `bc_system_type`

---

## 🎯 Resumen: Cómo NO Confundirse

| ❌ EVITAR | ✅ HACER |
|-----------|----------|
| Llamarlo "Equipment Purchase Request" en UI | Llamarlo "Business Case" |
| Consultar `equipment_purchase_requests` directamente | Usar vista `v_business_cases` |
| Mezclar rutas `/equipment-purchase` | Usar rutas `/business-case` |
| Asumir que todos los registros son modernos | Validar `uses_modern_system = true` |
| Crear nueva tabla `business_cases` | Usar la tabla existente con discriminador |

---

## 📚 Referencias Rápidas

**Campos clave**:
- `id` → UUID del Business Case (usar como `business_case_id`)
- `uses_modern_system` → `true` para modernos, `false` para legacy
- `bc_system_type` → `'modern'` o `'legacy'`

**Vistas principales**:
- `v_business_cases` → Solo modernos (USAR EN CÓDIGO)
- `v_business_cases_complete` → Todos con detalles

**Funciones útiles**:
- `mark_business_case_as_modern(uuid)` → Marca como moderno
- `migrate_legacy_bc_to_modern(uuid)` → Migra de legacy a moderno

---

## ✅ Conclusión

Con esta configuración:
- ✅ Se usa tabla existente (`equipment_purchase_requests`)
- ✅ No hay confusión (vistas con nombres claros)
- ✅ Backward compatibility (legacy sigue funcionando)
- ✅ Foreign keys correctas
- ✅ Validaciones automáticas (triggers)
- ✅ Migración gradual posible
