# Plan de Migración Oracle → Odoo

## Objetivo
Ejecutar la migración completa de datos desde Oracle hacia Odoo siguiendo el plan de micro-tareas.

## Estado: Plan Creado - Listo para Ejecución

## Ubicación de Archivos

### Scripts de Migración
| Script | Ruta | Uso |
|--------|------|-----|
| Principal | `AuditERP/migrate_oracle_to_odoo_erp.py` | Migración ERP extendida |
| Legado | `AuditERP/migrate_to_odoo.py` | Pruebas rápidas |
| Auditoría | `AuditERP/audit_gui.py` | Inventario de tablas |

### Configuración Actual
```python
ORACLE_CONN = "SYSTEM/FamDb@XE"
POSTGRES_CONFIG = {
    "host": "localhost",
    "port": 5433,
    "user": "postgres",
    "password": "FamDb",
    "dbname": "OdooFAM",
}
```

## Micro-Tareas Principales

### Fase 1: Auditoría Oracle
- [ ] MIGR-01-T01: Ejecutar auditoríaOracle
- [ ] MIGR-01-T02: Documentar estructura
- [ ] MIGR-01-T03: Identificar tablas sin datos

### Fase 2: Prerrequisitos
- [ ] MIGR-02-T01: Verificar SQL*Plus
- [ ] MIGR-02-T02: Verificar Python + psycopg2
- [ ] MIGR-02-T03: Verificar conexión PostgreSQL
- [ ] MIGR-02-T04: Configurar credenciales
- [ ] MIGR-02-T05: Crear backup Odoo

### Fases 3-5: Migración Datos Principales
- Partners y Contactos
- Productos y Catálogo  
- Inventory y Stock

### Fases 6-9: Procesos de Negocio
- Pedidos y Ventas
- Compras
- Contabilidad

### Fases 10-11: Validaciones
- Comparar conteos
- Muestreo funcional
- Generar informe

### Fases 12-13: Corte
- Validar integración SPI→Odoo
- Backup final Oracle
- Runbook "Solo Odoo + SPI"

## Informes de Auditoría Existentes
- `AuditERP/reports/AUDITORIA_INTEGRAL_ODOO_20260410_204403.md`
- `AuditERP/reports/AUDITORIA_INTEGRAL_ODOO_20260410_204125.md`

## Estadísticas de Migración (última ejecución)
- **Productos migrados**: 1672
- **Precios de venta**: 2740 → 1606 actualizados
- **Precios de costo**: 1585 → 1441 actualizados

## Siguiente Paso
Ejecutar primera micro-tarea: MIGR-01-T01 (Auditoría Oracle)