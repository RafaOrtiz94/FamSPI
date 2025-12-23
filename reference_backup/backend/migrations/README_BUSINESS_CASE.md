# Business Case Database Migrations

## Migraciones Creadas

### 016_business_case_core_tables.sql
Crea la tabla principal `equipment_purchase_requests` con soporte para:
- Business Cases públicos (licitaciones)
- Business Cases privados (comodatos y ventas)
- Campos de configuración: duración, costo de equipo, margen objetivo
- Modos de cálculo: mensual o anual
- Vistas: `v_business_cases`, `v_business_cases_public`, `v_business_cases_private`

### 017_bc_equipment_selection.sql
Tabla para selección de equipos:
- Relación con `servicio.equipos`
- Soporte para múltiples equipos
- Flag de equipo primario
- Cantidad de equipos

### 018_bc_determinations.sql
Tabla para determinaciones:
- Relación con `catalog_determinations`
- Cantidades mensuales (BCs públicos)
- Cantidades anuales (BCs privados)
- Campos calculados: consumo y costo
- Constraint: no duplicados por BC

### 019_bc_investments.sql
Tabla para inversiones adicionales:
- Tipos: única, recurrente mensual, recurrente anual
- Categorías: instalación, capacitación, transporte, mantenimiento
- Montos y notas

### 020_bc_calculations.sql
Tabla para resultados de cálculos:
- Cálculos mensuales (públicos)
- Cálculos anuales (privados)
- Métricas de utilización de equipo
- Cálculos de rentabilidad: ROI, margen, payback
- Warnings y recomendaciones automáticas
- Versionado de cálculos

## Aplicar Migraciones

```bash
# Opción 1: Aplicar con script Node.js
cd backend/migrations
node apply-business-case-migrations.js

# Opción 2: Aplicar manualmente con psql
psql -U postgres -d famspi_db -f 016_business_case_core_tables.sql
psql -U postgres -d famspi_db -f 017_bc_equipment_selection.sql
psql -U postgres -d famspi_db -f 018_bc_determinations.sql
psql -U postgres -d famspi_db -f 019_bc_investments.sql
psql -U postgres -d famspi_db -f 020_bc_calculations.sql
```

## Rollback

```bash
# ADVERTENCIA: Esto eliminará TODOS los datos de Business Case
psql -U postgres -d famspi_db -f rollback_business_case.sql
```

## Verificación

Después de aplicar las migraciones, verifica que las tablas se crearon correctamente:

```sql
-- Listar tablas creadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'bc_%' 
  OR table_name = 'equipment_purchase_requests'
ORDER BY table_name;

-- Verificar vistas
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public' 
  AND table_name LIKE '%business_case%';

-- Verificar constraints
SELECT 
  tc.table_name, 
  tc.constraint_name, 
  tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
  AND tc.table_name IN (
    'equipment_purchase_requests',
    'bc_equipment_selection',
    'bc_determinations',
    'bc_investments',
    'bc_calculations'
  )
ORDER BY tc.table_name, tc.constraint_type;
```

## Próximos Pasos

Una vez aplicadas las migraciones:
1. ✅ Actualizar servicios backend
2. ✅ Crear controladores y rutas
3. ✅ Actualizar frontend (wizard)
4. ✅ Crear tests
