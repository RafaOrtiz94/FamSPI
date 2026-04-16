# Tarea 04 — API solicitud de entrega con validación de saldos

---INICIO PROMPT TAREA 04---

## Rol

Desarrollador full stack senior en **FamSPI**. Rol base: `prompt_desarrollador_fullstack_integraciones_erp.md`. **Dependencia:** tarea 03 (tablas máximos) implementada o disponible en la misma rama.

## Requisitos que DEBEN quedar cumplidos

- **REQ-SPI-005** — Entidad `delivery_request` con líneas solicitadas por asesor.
- **REQ-SPI-007** — `delivered_qty` y `remaining` por línea de máximo; actualización transaccional al **confirmar** entrega (en esta tarea: confirmación interna SPI; sin Odoo obligatorio).
- **REQ-SPI-011** — API creación con errores explícitos: `MAX_EXCEEDED`, `ITEM_NOT_ALLOWED`, `CEILING_NOT_ACTIVE`.

## Tarea concreta

1. Tablas `delivery_request` y `delivery_request_line` con FK a `delivery_ceiling` y `delivery_ceiling_line`.
2. Endpoint autenticado `POST /api/v1/delivery-requests` (ajustar prefijo al estándar del repo) que reciba `{ ceilingId, lines: [{ ceilingLineId, requestedQty }] }`.
3. Validar en **transacción**:
   - El `ceiling` está en estado `active`.
   - Para cada línea: `requestedQty > 0` y `requestedQty <= remaining` donde `remaining = max_qty - delivered_qty - sum(open approved requests)` (definir reglas de “open” en comentario y código).
4. Endpoint `POST /api/v1/delivery-requests/:id/confirm-delivery` (interno/logística) que incremente `delivered_qty` en `delivery_ceiling_line` y cierre el request.
5. Respuestas JSON con `{ code, message }` en error usando los códigos anteriores.

## No hacer

- No integrar Odoo en esta tarea.
- No enviar correos.

## Entregables

- Migraciones + rutas + servicio.
- Ejemplo `curl` o JSON de request/response en documentación mínima.

## Checklist de verificación (Definition of Done)

- [ ] Request que excede `remaining` devuelve HTTP 400 con `code: "MAX_EXCEEDED"`.
- [ ] Request con techo `draft` devuelve error acorde (`CEILING_NOT_ACTIVE` o equivalente documentado).
- [ ] Tras `confirm-delivery`, `delivered_qty` sube y un segundo request no puede exceder el nuevo saldo.
- [ ] Resumen final: **"REQ cumplidos: REQ-SPI-005, REQ-SPI-007 (SPI), REQ-SPI-011."**

---FIN PROMPT TAREA 04---
