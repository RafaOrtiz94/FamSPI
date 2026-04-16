# Runbook: libro de correspondencia producto SPI <-> Odoo

- Ultima revision: 2026-04-11
- Objetivo: administrar la tabla `integration_product_map` y validar cobertura del catalogo SPI post-migracion.

---

## 1. Migracion SQL

- Archivo: `backend/migrations/125_integration_product_map.sql`
- Crea tabla `public.integration_product_map` con:
  - `legacy_code`
  - `spi_sku`
  - `spi_equipment_model_id`
  - `odoo_product_id`
  - `business_category`
  - `active`
  - `notes`
  - timestamps
- Incluye checks de categoria y regla `active=true => odoo_product_id requerido`.
- Incluye indices unicos parciales para evitar duplicados activos obvios.

---

## 2. Endpoints administrativos

Rutas montadas:
- `/api/v1/integrations/product-map`
- `/internal/integration/product-map` (alias interno autenticado)

Operaciones:
- `GET /api/v1/integrations/product-map?page=1&limit=25`
- `POST /api/v1/integrations/product-map` (upsert por `id` o referencia SPI)
- `PATCH /api/v1/integrations/product-map/:id`
- `GET /internal/integration/product-map/coverage-report`

---

## 3. Ejemplo de respuesta del reporte de cobertura

`GET /internal/integration/product-map/coverage-report`

```json
{
  "ok": true,
  "data": {
    "missingInMap": [
      {
        "spi_equipment_model_id": 11,
        "legacy_code": "LEG-011",
        "spi_sku": "SPI-011",
        "spi_item_name": "Equipo sin map 1",
        "spi_item_status": "operativo"
      }
    ],
    "totalMapped": 149,
    "totalSpiItems": 163,
    "missingCount": 14,
    "missingLimit": 200,
    "missingOffset": 0
  }
}
```

Fuente SPI usada para cobertura: `public.equipment_models`.


