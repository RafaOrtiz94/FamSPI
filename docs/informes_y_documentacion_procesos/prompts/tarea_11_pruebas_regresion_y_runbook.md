# Tarea 11 — Pruebas de regresión, conciliación mínima y runbook operativo

---INICIO PROMPT TAREA 11---

## Rol

Desarrollador full stack senior / QA técnico en **FamSPI**. Rol base: `prompt_desarrollador_fullstack_integraciones_erp.md`. **Dependencia:** tareas 01–06 como mínimo.

## Requisitos que DEBEN quedar cumplidos

- **REQ-SPI-041** — Automatizar o documentar ejecución: regresión con integración **off** obligatoria.
- **REQ-SPI-042** — Runbook: fallo de Odoo / cola atascada / flag off de emergencia.
- **INT-ODOO-006** — Job o script **mínimo** de conciliación (puede ser solo SPI en v1): comparar conteos `integration_outbox` por estado vs umbral esperado y listar `dead`/`failed`.

## Tarea concreta

1. Añadir script `npm run test:integration-off` o documentar en `package.json` un comando que ejecute la suite principal con `ODOO_INTEGRATION_ENABLED=false` en env (ajustar a estándar del repo).
2. Crear `docs/informes_y_documentacion_procesos/runbook_integracion_odoo.md` con secciones: síntomas, diagnóstico (queries SQL sugeridas), contención (desactivar flag), recuperación (reprocesar outbox), escalamiento.
3. Script `node scripts/integration-reconcile-report.js` que imprima JSON `{ pending, processing, sent, failed, dead, oldestPendingAgeSec }` leyendo `integration_outbox`.

## No hacer

- No exigir Odoo live en CI.

## Entregables

- Comandos en `package.json` o Makefile si existe.
- `runbook_integracion_odoo.md` + script de reporte.

## Checklist de verificación (Definition of Done)

- [ ] El comando de regresión con integración off se ejecutó localmente (o en CI) y el resultado se cita en el resumen.
- [ ] Runbook tiene al menos 4 pasos operativos accionables.
- [ ] Script de conciliación corre contra DB vacía o de dev sin error.
- [ ] Resumen final: **"REQ cumplidos: REQ-SPI-041, REQ-SPI-042; INT-ODOO-006 (mínimo SPI-side)."**

---FIN PROMPT TAREA 11---
