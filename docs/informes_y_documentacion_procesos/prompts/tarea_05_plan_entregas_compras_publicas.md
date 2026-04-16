# Tarea 05 — Plan de entregas (compras públicas) y validación en solicitud

---INICIO PROMPT TAREA 05---

## Rol

Desarrollador full stack senior en **FamSPI**. Rol base: `prompt_desarrollador_fullstack_integraciones_erp.md`. **Dependencias:** tarea 03 y 04.

## Requisitos que DEBEN quedar cumplidos

- **REQ-SPI-006** — Entidad plan de entregas por analista: tramos, ventana/fecha, cantidades por línea de máximo, estado aprobación.
- Extensión de **REQ-SPI-011** — Nuevo código de error `PUBLIC_PLAN_NOT_APPROVED` o `OUTSIDE_DELIVERY_WINDOW`.

## Tarea concreta

1. Tablas `public_delivery_plan` (cabecera ligada a `delivery_ceiling_id` con `purchase_type=public`) y `public_delivery_plan_line` (referencia `delivery_ceiling_line_id`, `scheduled_start`, `scheduled_end`, `max_qty_tranche`).
2. Estados plan: `draft`, `approved`, `cancelled`.
3. Al crear `delivery_request` cuando `ceiling.purchase_type === 'public'`:
   - Exigir plan `approved` que cubra la fecha actual (o fecha enviada en payload `asOfDate` opcional).
   - Cada línea solicitada debe cumplir `requestedQty <= min(remaining, max_qty_tranche aplicable al tramo)`.
4. Si no hay tramo válido, responder 400 con código estable documentado.

## No hacer

- No implementar UI completa del analista (solo API en esta tarea, salvo que el repo exija mínimo; si añades UI mínima, decláralo en entregables).

## Entregables

- Migraciones + servicios + ajuste del flujo de creación de `delivery_request` de tarea 04.
- Matriz de casos en tabla Markdown en el resumen (caso dentro de ventana / fuera / plan draft).

## Checklist de verificación (Definition of Done)

- [ ] Compra pública sin plan aprobado → rechazo con código documentado.
- [ ] Con plan aprobado y tramo vigente, solicitud válida pasa validación previa igual que privada respecto a `remaining`.
- [ ] Solicitud con cantidad mayor al tranche permitido falla con código específico.
- [ ] Resumen final: **"REQ cumplidos: REQ-SPI-006; REQ-SPI-011 extendido."**

---FIN PROMPT TAREA 05---
