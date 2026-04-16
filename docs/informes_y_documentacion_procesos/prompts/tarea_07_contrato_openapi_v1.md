# Tarea 07 — Contrato OpenAPI v1 para payloads de integración

---INICIO PROMPT TAREA 07---

## Rol

Desarrollador full stack senior en **FamSPI**. Rol base: `prompt_desarrollador_fullstack_integraciones_erp.md`.

## Requisitos que DEBEN quedar cumplidos

- **INT-ODOO-001** — Contrato versionado (`v1`) para familias de mensaje salientes desde SPI hacia el conector Odoo.
- **INT-ODOO-008** — Base para pruebas de contrato (archivo validable en CI).

## Tarea concreta

1. Crear `docs/informes_y_documentacion_procesos/contracts/spi-odoo-messages-v1.openapi.yaml` (o `.json`) que defina **al menos** tres schemas:
   - `CeilingActivatedV1` — snapshot mínimo de techo activo + líneas (ids SPI, cantidades, odoo_product_id opcional).
   - `DeliveryRequestApprovedV1` — request confirmado listo para reflejo en Odoo.
   - `IntegrationErrorEnvelopeV1` — error normalizado para logs/consumidor.
2. Cada payload debe incluir `schemaVersion: "1.0"` y `correlationId` requeridos.
3. Añadir script npm opcional `npm run lint:openapi` usando `@redocly/cli` o `swagger-cli validate` **solo si** se puede añadir devDependency sin romper el proyecto; si no, documentar comando manual de validación.

## No hacer

- No implementar el servidor Odoo aquí.

## Entregables

- Archivo OpenAPI en repo.
- README corto `contracts/README.md` explicando versionado y deprecación.

## Checklist de verificación (Definition of Done)

- [ ] El archivo OpenAPI es sintácticamente válido (comando de validación documentado y ejecutado una vez).
- [ ] Los tres schemas están referenciados y tienen ejemplos `example:` mínimos.
- [ ] Resumen final: **"REQ cumplidos: INT-ODOO-001; INT-ODOO-008 (artefacto de contrato v1)."**

---FIN PROMPT TAREA 07---
