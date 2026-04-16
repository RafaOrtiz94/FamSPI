# Prompts para IA programadora

Archivos `.md` en esta carpeta están pensados para **copiar y pegar** (o adjuntar) como instrucciones de sistema o de tarea en herramientas de IA asistida, con rol y contexto explícitos.

## Archivos

| Archivo | Uso |
|---------|-----|
| [prompt_desarrollador_fullstack_integraciones_erp.md](./prompt_desarrollador_fullstack_integraciones_erp.md) | Rol base + directrices para implementar migración, SPI y Odoo. |
| [prompt_migracion_oracle_odoo.md](./prompt_migracion_oracle_odoo.md) | Tareas centradas en scripts y validación Oracle → Odoo. |
| [prompt_integracion_spi_odoo_maximos_entregas.md](./prompt_integracion_spi_odoo_maximos_entregas.md) | Máximos, entregas parciales, compras privadas/públicas y API. |
| [**INDICE_TAREAS_CIERRE_REQUISITOS.md**](./INDICE_TAREAS_CIERRE_REQUISITOS.md) | **Índice de tareas concretas** con entregable = requisitos cumplidos (checklist verificable). |
| [tarea_01_feature_flag_integracion.md](./tarea_01_feature_flag_integracion.md) … [tarea_11_pruebas_regresion_y_runbook.md](./tarea_11_pruebas_regresion_y_runbook.md) | Una tarea por archivo; copiar el bloque `INICIO/FIN` íntegro. |

## Cómo usarlos

1. Para trabajo **por entregable cerrado**: abrir [INDICE_TAREAS_CIERRE_REQUISITOS.md](./INDICE_TAREAS_CIERRE_REQUISITOS.md), elegir **una** `tarea_XX_*.md`, adjuntar rol base y el documento de requisitos correspondiente.  
2. Exigir en la respuesta de la IA el **relleno de la checklist** y la frase literal de cierre de requisitos indicada en el prompt.  
3. Para trabajo genérico: copiar `prompt_desarrollador_*` y los informes de `docs/informes_y_documentacion_procesos/`.

## Mantenimiento

Al cambiar stack (versión Odoo, rutas de scripts, política de flags), actualizar el prompt para evitar respuestas desalineadas.
