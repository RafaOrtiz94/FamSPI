---
name: db-check-when-needed
description: revisar base de datos solo cuando hay síntomas específicos, con queries mínimas y evidencia clara
---

# SKILL: db-check-when-needed

## Propósito
Revisar BD solo cuando hay síntomas específicos, con queries mínimas y evidencia clara.

## GATE: ¿Aplicar este skill?
**SI** → Si hay errores de datos, APIs inconsistentes, o estados no sincronizados
**NO** → Para revisiones preventivas o cambios menores sin síntomas

## Flujo Corto (5 min)

### 1. Identificar síntoma específico
- ¿Qué error exacto ocurre?
- ¿En qué API/UI se manifiesta?
- ¿Cuándo empezó?

### 2. Query mínima primero
```sql
-- Template: verificar tabla afectada
SELECT COUNT(*) as total FROM {{table_name}};

-- Verificar datos específicos del problema
SELECT {{column_problem}}, COUNT(*) as count
FROM {{table_name}}
WHERE {{condition}}
GROUP BY {{column_problem}};
```

### 3. Validar y documentar
```sql
-- Antes del fix
{{query_before}}

-- Después del fix
{{query_after}}

-- Evidencia: problema solucionado
```

## Plantillas Parametrizables

### Problemas de FK/Constraints
```sql
# Template: verificar FK violations
SELECT ct.{{child_id}} as problematic_id,
       ct.{{child_ref}} as missing_parent
FROM {{child_table}} ct
LEFT JOIN {{parent_table}} pt ON ct.{{child_ref}} = pt.{{parent_id}}
WHERE pt.{{parent_id}} IS NULL
LIMIT 10;
```

### Estados inconsistentes
```sql
# Template: verificar enums válidos
SELECT {{status_column}}, COUNT(*) as count
FROM {{table_name}}
WHERE {{status_column}} NOT IN ({{valid_statuses}})
GROUP BY {{status_column}};
```

### Datos huérfanos
```sql
# Template: encontrar registros huérfanos
SELECT COUNT(*) as orphaned_count
FROM {{child_table}} c
LEFT JOIN {{parent_table}} p ON c.{{foreign_key}} = p.{{primary_key}}
WHERE p.{{primary_key}} IS NULL;
```

## Evidencia Mínima Obligatoria
- ✅ Query que demuestra el problema (antes)
- ✅ Query que confirma la solución (después)
- ✅ Conteo de registros afectados
- ✅ Explicación del impacto del problema

## Límites de Alcance
- NO hacer checks masivos sin síntoma específico
- NO revisar tablas no relacionadas con el problema
- NO ejecutar queries complejas/performance-heavy
- NO crear funciones de monitoreo automático
