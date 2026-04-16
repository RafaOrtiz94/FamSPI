# Informe de análisis: Oracle → Odoo y rol del SPI

- **Última revisión:** 2026-04-11  
- **Alcance:** Migración completa del legado Oracle al ERP Odoo; Oracle deja de ser fuente de verdad. El SPI permanece como plataforma de procesos internos y debe integrarse con Odoo.

---

## 1. Contexto de negocio

La organización necesita:

1. **Descontinuar Oracle** como base operativa y contable de referencia.
2. **Consolidar** clientes, productos, ventas, compras, inventario y contabilidad en **Odoo** (módulos estándar y localización Ecuador según instalación actual).
3. **Mantener el SPI** para flujos propios (comercial, business case, servicio, talento humano, firmas, etc.) sin duplicar innecesariamente el maestro de datos que vivirá en Odoo a mediano plazo.

---

## 2. Estado observado en el repositorio

### 2.1 Migración y auditoría (`AuditERP/`)

- Existe un migrador **reducido** (`migrate_to_odoo.py`): partners, productos desde `AUX_INVENTARIO`, órdenes de venta de muestra. Los productos se insertan como consumibles (`consu`) sin taxonomía fina equipo/reactivo/servicio.
- Existe un migrador **amplio** (`migrate_oracle_to_odoo_erp.py`): partners, proveedores, productos, precios, perfiles de cliente, usuarios de venta, y generación de informe de auditoría al finalizar. Es el candidato principal para una migración “ERP completa” siempre que las fuentes Oracle y el esquema Odoo estén alineados.
- La GUI `audit_gui.py` apoya inventario de tablas Oracle y calidad de datos vía SQL*Plus.
- Informes recientes en `AuditERP/reports/` documentan: productos sin precio/costo en Odoo, auditoría integral de módulos Odoo, duplicados, etc.

### 2.2 SPI (FamSPI)

- Backend PostgreSQL con dominios propios: **clientes**, **business case**, **solicitudes**, **compras privadas/equipment**, **servicio**, **inventario operativo SPI**, etc.
- Catálogo de **equipos** en tablas como `equipment_models` y esquemas de servicio; **no** equivale automáticamente al catálogo de productos Odoo migrado desde Oracle sin un **libro de mapeo** explícito.
- El inventario funcional del código está descrito en `docs/INVENTARIO_SISTEMA_COMPLETO.md`.

### 2.3 Integración documentada (`integracion/`)

- Requerimientos masivos por área (CRM, ventas, compras, contabilidad, plataforma TI) con patrones: colas, idempotencia, contratos versionados, conciliación, seguridad.

---

## 3. Riesgos y brechas principales

| Riesgo | Descripción | Mitigación |
|--------|-------------|------------|
| **Pérdida de integridad referencial** | FK Oracle no reproducidas 1:1 en Odoo | Auditoría previa, orden de carga, validación por conteos y muestreo |
| **Productos mal clasificados** | Todo como `consu` u omisión de tipo almacenable/servicio | Libro maestro de categorías y `product.type` post-migración |
| **Precios y costos incompletos** | Informes muestran códigos sin `list_price` o costo | Reglas de completado desde Oracle + aceptación formal de gaps |
| **Doble fuente de verdad** | SPI y Odoo con códigos distintos para el mismo ítem | Tabla de correspondencia y proceso de sincronización o lectura maestra desde Odoo |
| **Corte operativo** | Oracle apagado antes de validar Odoo + SPI | Plan de convivencia, freeze de datos, rollback documentado |

---

## 4. Principios de arquitectura objetivo

1. **Odoo** es el **ERP maestro** post-corte: productos de venta/compra estándar, partners proveedores/clientes según política, facturación y stock según módulos instalados.
2. **SPI** consume o replica **solo** lo necesario para sus flujos (IDs externos, cantidades máximas por contrato, entregas parciales, etc.), preferiblemente vía **API** y **eventos**, no consultando Oracle tras el apagado.
3. **Migración** es un proyecto **acotado en el tiempo** con entregables: scripts versionados, informes de reconciliación, firma de aceptación y runbooks.

---

## 5. Conclusiones y siguientes pasos recomendados

1. Congelar el **alcance funcional** de la primera ola de migración (qué tablas Oracle y qué modelos Odoo).
2. Ejecutar la **guía de migración** en entorno de **pruebas** y archivar reportes en `AuditERP/reports/` o copia referenciada desde esta carpeta.
3. Implementar en SPI las **nuevas funcionalidades** y la **integración Odoo** según los documentos hermanos, con feature flags hasta validación de negocio.
4. Usar los **prompts** para planificar trabajo con IA de forma repetible y revisable por TI.

---

## 6. Referencias internas

- `AuditERP/README.md`
- `AuditERP/migrate_oracle_to_odoo_erp.py` (configuración al inicio del archivo)
- `docs/INVENTARIO_SISTEMA_COMPLETO.md`
- `integracion/INDEX_REQUERIMIENTOS_SPI_ODOO.md`
