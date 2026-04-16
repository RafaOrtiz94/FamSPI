# Tarea 10 — Hooks en private-purchases / equipment-purchases (solo con flag)

---INICIO PROMPT TAREA 10---

## Rol

Desarrollador full stack senior en **FamSPI**. Rol base: `prompt_desarrollador_fullstack_integraciones_erp.md`. **Dependencias:** tarea 01, tarea 06.

## Requisitos que DEBEN quedar cumplidos

- **REQ-SPI-013** — Enlaces y eventos desde flujos de compra existentes **sin** alterar respuestas JSON ni códigos HTTP cuando integración está **desactivada**.

## Tarea concreta

1. Localizar en `privatePurchases.service.js` y `equipmentPurchases.service.js` (o equivalentes) **un** punto estable post-commit exitoso (p. ej. tras actualización de estado que ya exista).
2. Invocar `enqueueIntegrationEvent` solo si `isOdooIntegrationEnabled()` es true, con `event_type` acotado (`private_purchase.status_changed` / `equipment_purchase.status_changed`) y payload mínimo `{ id, status, business_case_id }`.
3. Añadir prueba o verificación manual: comparar respuesta de endpoint clave antes/después del cambio con flag off (debe ser idéntica en cuerpo y status).

## No hacer

- No cambiar validaciones de negocio actuales de compras.
- No añadir await de red Odoo en el request path.

## Entregables

- Diff acotado en los servicios + posible helper `integrations/hooks.js`.
- Nota en comentario de código: “REQ-SPI-013: no await externo”.

## Checklist de verificación (Definition of Done)

- [ ] Con flag off, tests existentes del módulo de compras pasan (o lista de tests ejecutados).
- [ ] Con flag on, al menos un flujo inserta fila en `integration_outbox` (demostrado con query o log).
- [ ] No hay cambio en el schema de respuesta de los endpoints afectados con flag off (mencionar endpoints verificados en el resumen).
- [ ] Resumen final: **"REQ cumplidos: REQ-SPI-013."**

---FIN PROMPT TAREA 10---
