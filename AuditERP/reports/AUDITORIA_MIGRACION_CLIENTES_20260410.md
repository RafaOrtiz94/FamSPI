# Auditoría de Migración Oracle -> Odoo (Clientes)

- Fecha: 2026-04-10
- Script ejecutado: `migrate_oracle_to_odoo_erp.py`
- Base destino: `OdooFAM`

## Resultado general

La migración de clientes quedó ampliada y aplicada con estos bloques adicionales:

1. Sincronización de clientes por `IDCLIENTE` + `RUC` (incluye fuentes `VEN_BODEDATO`, `DWH_VENTAS`, `CLI_DIRECCION`, `VEN_GRUPOS`).
2. Enriquecimiento de dirección completa (`street`, `street2`, `city`, `state_id`, `country_id`) desde `CLI_DIRECCION` + catálogos geográficos.
3. Asignación de vendedor (`user_id`) desde `VEN_GRUPOS` / `VEN_VENTAS`.
4. Asignación de lista de precios (`specific_property_product_pricelist`) desde `LSPR_LSPR_ID`.
5. Creación idempotente de usuarios vendedores y listas de precio en Odoo.
6. Controles anti-duplicado para `ref`/`vat`.

## Métricas Oracle (fuente)

- `VEN_VENTAS_TOTAL`: 7851
- `VEN_DETAPROD_TOTAL`: 2502
- `CLI_DIRECCION_CLIENTS`: 1645
- `VEN_GRUPOS_CLIENTS`: 1647
- `VEN_GRUPOS_WITH_VENDOR`: 2790
- `VEN_GRUPOS_WITH_LSPR`: 2790

## Métricas Odoo (después de migración)

- `sale_order` `SOERP-*`: 7851
- `sale_order_line` de `SOERP-*`: 2502
- `res_partner` con `ref`: 2445
- `res_partner` con `street`: 1373
- `res_partner` con `city`: 1390
- `res_partner` con `state_id`: 1391
- `res_partner` con `country_id`: 1391
- `res_partner` con `user_id` (vendedor): 1550
- `res_partner` con lista de precio: 1387

## Reconciliación por cliente (IDCLIENTE)

Validación cliente-a-cliente (no solo por total de partner):

- Clientes con vendedor en Oracle y mapeados en Odoo: 2190
  - Faltantes en Odoo: 0
- Clientes con lista de precios en Oracle y mapeados en Odoo: 1647
  - Faltantes en Odoo: 0
- Clientes con dirección (street/city/provincia) en Oracle y mapeados en Odoo: 1625 / 1645
  - Faltantes en Odoo: 0

Nota: el total por `res_partner` es menor que por cliente porque múltiples `IDCLIENTE` pueden consolidarse en un mismo partner por `RUC`.

## Elementos creados para soportar migración comercial

- Usuarios vendedores creados: 29 (`login` tipo `vendor.<codigo>@fam.local`)
- Partners técnicos de vendedores creados: 29 (`ref` tipo `VENDOR-<CODIGO>`)
- Listas de precio ERP creadas: 25 (`[LSPR:<id>]`)

## Integridad y calidad

- Grupos duplicados por `ref`: 0
- Grupos duplicados por `vat`: 0
- Mojibake (`�`) en nombres de partner/producto: 0

## Hallazgo de datos de origen

Persisten múltiples clientes con correo `evelyn.rojas@famproject.com.ec`.
Esto viene del origen Oracle (`CLI_DIRECCION`) y no es un error de Odoo.

## Módulos Odoo

Revisados y ya instalados:

- `contacts`
- `sale_management`
- `sales_team`
- `l10n_ec`, `l10n_ec_sale`, `l10n_ec_stock`

No se requiere activar módulos adicionales para esta fase.
