# Informes y documentación de procesos

Documentación operativa para la **salida definitiva de Oracle como fuente de datos** y la **adopción de Odoo** como ERP, con el **SPI** como sistema de procesos internos integrado.

## Contenido de esta carpeta

| Documento | Propósito |
|-----------|-----------|
| [informe_de_analisis.md](./informe_de_analisis.md) | Análisis de situación, riesgos, alcance y decisiones técnicas. |
| [guia_ejecucion_migracion_oracle_odoo.md](./guia_ejecucion_migracion_oracle_odoo.md) | Pasos específicos para ejecutar y validar la migración Oracle → Odoo. |
| [requerimientos_spi_nuevas_funcionalidades.md](./requerimientos_spi_nuevas_funcionalidades.md) | Nuevas funcionalidades y cambios de modelo en el SPI. |
| [requerimientos_integracion_odoo.md](./requerimientos_integracion_odoo.md) | Requisitos de integración SPI ↔ Odoo (API, datos, operación). |
| [prompts/](./prompts/) | Instrucciones para IA: rol base, migración, integración y **[tareas concretas con checklist de cierre de REQ](./prompts/INDICE_TAREAS_CIERRE_REQUISITOS.md)**. |
| [contracts/](./contracts/) | Contratos OpenAPI (artefacto esperado tras **tarea 07**). |

## Relación con otras carpetas del repositorio

- **`AuditERP/`**: scripts de auditoría Oracle (`audit_gui.py`), migración (`migrate_to_odoo.py`, `migrate_oracle_to_odoo_erp.py`, `migrate_lots.py`) e informes generados en `AuditERP/reports/`.
- **`integracion/`**: paquete histórico de requerimientos SPI–Odoo por área (referencia; puede consolidarse con `requerimientos_integracion_odoo.md`).
- **`docs/INVENTARIO_SISTEMA_COMPLETO.md`**: mapa de módulos SPI actuales.

## Mantenimiento

Actualizar la **fecha de revisión** en cada documento cuando cambien procesos, versiones de Odoo o rutas de despliegue.
