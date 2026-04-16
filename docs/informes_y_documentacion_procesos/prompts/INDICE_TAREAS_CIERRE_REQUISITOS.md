# Índice: tareas concretas para IA (cierre de requisitos)

Cada archivo `tarea_XX_*.md` es un **prompt listo para copiar**. El **entregable válido** es que la IA deje **evidencia verificable** de cada ítem del checklist; solo entonces se consideran **cumplidos** los requisitos indicados en ese prompt.

## Uso recomendado

1. Adjuntar `prompt_desarrollador_fullstack_integraciones_erp.md` como rol base.  
2. Copiar **un** archivo `tarea_XX_*.md` completo como mensaje de tarea.  
3. Exigir al final de la sesión: **diff en repo**, **comandos ejecutados**, **checklist marcada**.

## Mapa tarea → requisitos cerrados

| Archivo | Requisitos que deben quedar cumplidos al cerrar la tarea |
|---------|-----------------------------------------------------------|
| [tarea_01_feature_flag_integracion.md](./tarea_01_feature_flag_integracion.md) | Principio feature flags (doc. REQ-SPI); **INT-ODOO-007** (degradación) en comportamiento documentado + código |
| [tarea_02_libro_correspondencia_productos.md](./tarea_02_libro_correspondencia_productos.md) | **REQ-SPI-001**; apoyo a **INT-ODOO-020** |
| [tarea_03_modelo_datos_maximos_y_lineas.md](./tarea_03_modelo_datos_maximos_y_lineas.md) | **REQ-SPI-002**, **REQ-SPI-003**, **REQ-SPI-031**, **REQ-SPI-040** |
| [tarea_04_api_solicitud_entrega_validada.md](./tarea_04_api_solicitud_entrega_validada.md) | **REQ-SPI-005**, **REQ-SPI-007** (lógica saldo), **REQ-SPI-011** |
| [tarea_05_plan_entregas_compras_publicas.md](./tarea_05_plan_entregas_compras_publicas.md) | **REQ-SPI-006**; extiende **REQ-SPI-011** (errores de plan) |
| [tarea_06_outbox_eventos_integracion.md](./tarea_06_outbox_eventos_integracion.md) | **REQ-SPI-012**; **INT-ODOO-002**, **INT-ODOO-003** |
| [tarea_07_contrato_openapi_v1.md](./tarea_07_contrato_openapi_v1.md) | **INT-ODOO-001**, **INT-ODOO-008** |
| [tarea_08_cliente_odoo_correlation_logs.md](./tarea_08_cliente_odoo_correlation_logs.md) | **INT-ODOO-004** (secretos fuera de repo); **INT-ODOO-005** |
| [tarea_09_ui_maximos_y_solicitud_entrega.md](./tarea_09_ui_maximos_y_solicitud_entrega.md) | **REQ-SPI-020**, **REQ-SPI-021**, **REQ-SPI-030** (mínimo) |
| [tarea_10_hooks_compras_feature_flag.md](./tarea_10_hooks_compras_feature_flag.md) | **REQ-SPI-013** |
| [tarea_11_pruebas_regresion_y_runbook.md](./tarea_11_pruebas_regresion_y_runbook.md) | **REQ-SPI-041**, **REQ-SPI-042**; **INT-ODOO-006** (job o script de conciliación mínimo) |

## Orden sugerido de implementación

`01` → `02` → `03` → `04` → `05` → `06` → `07` → `08` → `09` → `10` → `11`

Las tareas **04** y **05** dependen de **03**; **06**–**08** pueden paralelizarse tras **03** si se acuerdan contratos.
