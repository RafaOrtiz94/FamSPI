# Plan de Micro-Tareas: Migración Oracle → Odoo

> **NOTA DE OPERACIÓN:** Este plan sigue el mismo patrón del módulo de calidad. Cada tarea debe ejecutarse tocando maximo 3 archivos.

## 1. Inventario y Análisis de Origen (Oracle)

### Fase 1: Auditoría de tablas Oracle
- [ ] `MIGR-01-T01`: Ejecutar auditoríaOracle con `audit_gui.py` para identificar tablas de negocio y relacionadas para realizar la migracion a la base de odoo 
- [ ] `MIGR-01-T02`: Documentar estructura de tablas Oracle (SCHEMA, FK, índices)
- [ ] `MIGR-01-T03`: Identificar tablas sin datos relevantes para migration

### Fase 2: Análisis de datos Oracle
- [ ] `MIGR-01-T04`: Obtener conteos de partners/clientes en Oracle
- [ ] `MIGR-01-T05`: Obtener conteos de productos en Oracle  
- [ ] `MIGR-01-T06`: Obtener conteos de pedidos/órdenes de venta en Oracle

## 2. Configuración del Entorno

### Fase 3: Prerrequisitos
- [ ] `MIGR-02-T01`: Verificar Oracle SQL*Plus disponible en PATH
- [ ] `MIGR-02-T02`: Verificar Python 3.10+ con psycopg2-binary
- [ ] `MIGR-02-T03`: Verificar conexión PostgreSQL a Odoo
- [ ] `MIGR-02-T04`:	Configurar credenciales en migrate_oracle_to_odoo_erp.py
- [ ] `MIGR-02-T05`:	Crear backup de base Odoo con pg_dump

## 3. Migración de Datos Principales

### Fase 4: Partners y Contactos
- [ ] `MIGR-03-T01`: Migrar clientes (res.partner con customer_rank)
- [ ] `MIGR-03-T02`: Migrar proveedores (res.partner con supplier_rank)
- [ ] `MIGR-03-T03`: Migrar contactos y direcciones
- [ ] `MIGR-03-T04`: Validar conteos post-migración partners

### Fase 5: Productos y Catálogo
- [ ] `MIGR-04-T01`: Migrar productos (product.product + product.template)
- [ ] `MIGR-04-T02`: Migrar categorías de productos
- [ ] `MIGR-04-T03`: Migrar precios de venta (product.pricelist)
- [ ] `MIGR-04-T04`: Migrar precios de compra
- [ ] `MIGR-04-T05`: Validar productos sin precios (generar informe)

### Fase 6: Inventory y Stock
- [ ] `MIGR-05-T01`: Migrar ubicaciones de almacén (stock.location)
- [ ] `MIGR-05-T02`: Migrar lotes de inventario
- [ ] `MIGR-05-T03`: Migrar cuantidades en stock (stock.quant)
- [ ] `MIGR-05-T04`: Validar stock por ubicación

## 4. Procesos de Negocio

### Fase 7: Pedidos y Ventas
- [ ] `MIGR-06-T01`: Migrar órdenes de venta (sale.order)
- [ ] `MIGR-06-T02`: Migrar líneas de venta (sale.order.line)
- [ ] `MIGR-06-T03`: Migrar presupuestos/quotations
- [ ] `MIGR-06-T04`: Validar estado de pedidos

### Fase 8: Compras
- [ ] `MIGR-07-T01`: Migrar órdenes de compra (purchase.order)
- [ ] `MIGR-07-T02`: Migrar líneas de compra (purchase.order.line)
- [ ] `MIGR-07-T03`: Migrar recibos de entrada (stock.picking)

### Fase 9: Contabilidad
- [ ] `MIGR-08-T01`: Migrar account.journal (diarios)
- [ ] `MIGR-08-T02`: Migrar account.move (asientos contables)
- [ ] `MIGR-08-T03`: Migrar account.move.line
- [ ] `MIGR-08-T04`: Validar impuestos (l10n_ec si aplica)

## 5. Validaciones y Normalización

### Fase 10: Validaciones Post-Migración
- [ ] `MIGR-09-T01`: Comparar conteos Oracle vs Odoo
- [ ] `MIGR-09-T02`: Verificar muestreo funcional (partners, productos, pedidos)
- [ ] `MIGR-09-T03`: Validar clasificación de productos (equipos/reactivos/servicios)
- [ ] `MIGR-09-T04`: Generar informe de migración Markdown

### Fase 11: Normalización Post-Migración
- [ ] `MIGR-10-T01`: Normalizar códigos de referencia
- [ ] `MIGR-10-T02`: Estandarizar monedas y formatos
- [ ] `MIGR-10-T03`: Aplicar constraints UNIQUE faltantes
- [ ] `MIGR-10-T04`: Limpiar datos huérfanos

## 6. Corte y Cierre

### Fase 12: Preparación para Corte
- [ ] `MIGR-11-T01`: Validar integración SPI -> Odoo funcionando
- [ ] `MIGR-11-T02`: Crear backup final de Oracle (solo lectura)
- [ ] `MIGR-11-T03`: Documentar runbook "Solo Odoo + SPI"

### Fase 13: Procedimientos Post-Corte (Futuro)
- [ ] `MIGR-12-T01`: Script de re-migración laboratorio
- [ ] `MIGR-12-T02`: Procedimiento de recovery

## Notas de Configuración Importantes

### Parámetros Críticos para Odoo
- **host**: localhost (o IP del servidor Odoo)
- **port**: 5433 (puerto PostgreSQL de Odoo)
- **user**: postgres
- **password**: FamDb
- **dbname**: OdooFAM

### Tablas Clave para Mapeo
| Entidad Oracle | Tabla Odoo | Campo Clave |
|---------------|-----------|-------------|
| Clientes | res.partner | customer_rank > 0 |
| Proveedores | res.partner | supplier_rank > 0 |
| Productos | product.product | default_code (referencia) |
| Pedidos | sale.order | name, state |
| Productos | product.template | type (consumable/service/product) |

### Estados de Pedidos para Mapeo
| Oracle | Odoo |
|--------|------|
| 0-Open | draft |
| 1-Partial | sent |
| 2-Confirmed | sale |
| 3-Processing | partial |
| 4-Done | done |
| 5-Cancelled | cancel |

## Archivos de Referencia
- Script principal: `AuditERP/migrate_oracle_to_odoo_erp.py`
- Script mínimo: `AuditERP/migrate_to_odoo.py`
- Auditoría: `AuditERP/audit_gui.py`

## Criterios de Éxito
- Conteo de partners: +/- 5% vs Oracle
- Conteo de productos: +/- 2% vs Oracle
- Pedidos migrados: Estado correcto validado
- Productos sin precio: Generar informe para revisión manual