# Tarea 02 — Libro de correspondencia producto SPI ↔ Odoo

---INICIO PROMPT TAREA 02---

## Rol

Desarrollador full stack senior en **FamSPI**. Rol base: `prompt_desarrollador_fullstack_integraciones_erp.md`.

## Requisitos que DEBEN quedar cumplidos

- **REQ-SPI-001** — Libro de correspondencia: código legado / SKU SPI / `product_id` Odoo (entero) / categoría de negocio.
- Apoyo explícito a **INT-ODOO-020** — Debe existir forma de **validar cobertura** (consulta o script) que liste ítems del catálogo SPI (`equipment_models` u otra fuente acordada en código) **sin** fila de correspondencia.

## Tarea concreta

1. Crear migración SQL para tabla `integration_product_map` (nombre puede variar si sigue convención del repo) con columnas mínimas:
   - `id`, `legacy_code` (nullable), `spi_sku` o `spi_equipment_model_id` (según diseño), `odoo_product_id` (NOT NULL cuando fila esté “activa”), `business_category` (enum textual: `equipment`, `reagent`, `determination`, `calibrator`, `control`, `additional_investment`, `service`), `active`, `created_at`, `updated_at`, `notes`.
2. Restricción única razonable (p. ej. único `odoo_product_id` activo por combinación que definas) para evitar duplicados obvios.
3. API **administrativa interna** (autenticada): `GET` listado paginado + `POST`/`PATCH` upsert (solo roles admin o permiso dedicado si ya existe patrón).
4. Script o endpoint `GET /internal/integration/product-map/coverage-report` (o ruta acorde al proyecto) que devuelva JSON: `{ missingInMap: [...], totalMapped, totalSpiItems }` usando la fuente SPI que elijas y documentes.

## No hacer

- No escribir en tablas de Odoo desde SPI en esta tarea.
- No romper migraciones existentes: usar `IF NOT EXISTS` / patrones del repo.

## Entregables

- Migración SQL en `backend/migrations/` (o carpeta que use el proyecto).
- Rutas + servicio + validación (Joi/Zod según el repo).
- Ejemplo de respuesta JSON del reporte de cobertura en comentario o en doc breve.

## Checklist de verificación (Definition of Done)

- [ ] La migración aplica en base limpia sin error (comando documentado en el resumen).
- [ ] CRUD permite crear fila con `business_category=equipment` y `odoo_product_id` numérico.
- [ ] El reporte de cobertura ejecuta contra DB de desarrollo y devuelve estructura JSON estable.
- [ ] Resumen final incluye: **"REQ cumplidos: REQ-SPI-001; INT-ODOO-020 cubierto vía reporte de cobertura."**

---FIN PROMPT TAREA 02---
