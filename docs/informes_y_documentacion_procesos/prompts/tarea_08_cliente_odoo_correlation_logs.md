# Tarea 08 — Cliente Odoo + correlación en logs

---INICIO PROMPT TAREA 08---

## Rol

Desarrollador full stack senior en **FamSPI**. Rol base: `prompt_desarrollador_fullstack_integraciones_erp.md`. **Dependencias:** tarea 01 (flag), tarea 07 (opcional pero recomendada para alinear payloads).

## Requisitos que DEBEN quedar cumplidos

- **INT-ODOO-004** — Autenticación vía variables de entorno (`ODOO_URL`, `ODOO_DB`, `ODOO_USER`, `ODOO_API_KEY` o contraseña según estándar del despliegue); **ningún** secreto en código.
- **INT-ODOO-005** — Cada llamada registra duración, `correlation_id`, `event_type` y resultado (éxito/código error) en el logger del proyecto.

## Tarea concreta

1. Implementar módulo `backend/src/modules/integrations/odooClient.js` (ruta alineada al repo) que exponga `callOdoo({ method, params, correlationId })`.
2. Usar el protocolo que acuerde el proyecto (**JSON-RPC** común en Odoo 16/17) con timeout configurable `ODOO_TIMEOUT_MS`.
3. Si `ODOO_INTEGRATION_ENABLED=false`, `callOdoo` debe rechazar de inmediato con error controlado `IntegrationDisabledError` sin red.
4. Añadir prueba unitaria con `nock`/`msw` o mock manual que verifique que se envía header o metadata con `correlationId` (si el protocolo no permite header, incluir en body de log antes/después).

## No hacer

- No invocar Odoo en tests de CI por defecto (solo mocks).
- No persistir contraseñas en logs.

## Entregables

- Cliente + configuración + tests o mock documentado.
- Fragmento de log de ejemplo (anonimizado) en el resumen.

## Checklist de verificación (Definition of Done)

- [ ] Con flag off, ninguna llamada de red ocurre (verificado en test o trace).
- [ ] Con flag on y credenciales falsas en entorno local, el error queda logueado con `correlation_id`.
- [ ] Variables sensibles solo desde `process.env`.
- [ ] Resumen final: **"REQ cumplidos: INT-ODOO-004; INT-ODOO-005."**

---FIN PROMPT TAREA 08---
