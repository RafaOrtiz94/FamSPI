# Auditoria Integral Oracle -> Odoo

- Fecha: 2026-04-10 20:22:40
- Oracle tablas funcionales detectadas: 459

## 1) Cobertura Oracle por prefijo

| Prefijo | Tablas | Filas (stats Oracle) |
| --- | ---: | ---: |
| SEG | 30 | 2917694 |
| GEN | 71 | 2067988 |
| ALM | 53 | 328242 |
| CNT | 28 | 282785 |
| SRI | 3 | 279779 |
| VEN | 60 | 180020 |
| AUX | 13 | 55149 |
| COM | 12 | 27448 |
| COB | 8 | 13228 |
| RHH | 60 | 11855 |
| PAG | 5 | 11578 |
| CLI | 75 | 5917 |
| CLIENTE | 1 | 1961 |
| PRT | 40 | 0 |

## 2) Top tablas Oracle por volumen

| Tabla | Filas (stats Oracle) |
| --- | ---: |
| SEG_SESIONES | 2426276 |
| GEN_PERSCONT | 2052227 |
| SEG_EJECUCION | 440922 |
| SRI_DETALOGF | 232217 |
| CNT_DETASIENTO | 159525 |
| ALM_DETAMOVI | 79164 |
| ALM_UBICACION | 78153 |
| VEN_BODEDATO | 57642 |
| ALM_DETALOTE | 56832 |
| SRI_LOGFACTU | 47524 |
| CNT_ASIENTO | 46957 |
| VEN_BODEDATO_BK24012025MF | 45416 |
| VEN_DETAPROF | 36640 |
| AUX_VENTASFAMP | 33465 |
| ALM_TMPDETAMOVI | 31130 |
| CNT_BODEBALA | 25532 |
| CNT_RETENCION | 19659 |
| SEG_ACCEFORM | 18468 |
| CNT_BALAHIST | 17795 |
| SEG_PERMISO | 15538 |

## 3) Estado operativo Odoo

- `account_moves_total`: 0
- `hr_employees_total`: 1
- `partners_customers`: 2064
- `partners_suppliers`: 1293
- `products_lot_tracked`: 1489
- `products_storable`: 1601
- `products_total`: 1672
- `products_with_expiry`: 1489
- `purchase_lines_total`: 9980
- `purchase_orders_poerp`: 9980
- `sales_lines_total`: 2504
- `sales_orders_soerp`: 7851
- `stock_lots`: 7449
- `stock_move_lines_total`: 1
- `stock_moves_total`: 1
- `stock_pickings_total`: 1
- `stock_quants`: 733

## 4) Modulos Odoo requeridos

- `sales_core`: OK
  instalados: contacts, sale_management, sale_stock, stock
  faltantes: -
- `purchase_core`: OK
  instalados: purchase, purchase_stock
  faltantes: -
- `accounting_core`: OK
  instalados: account, stock_account, l10n_ec
  faltantes: -
- `inventory_traceability`: OK
  instalados: stock, l10n_ec_stock
  faltantes: -
- `negotiations_budgeting`: PENDIENTE
  instalados: -
  faltantes: crm, sale_crm
- `collaborators_hr`: OK
  instalados: hr, hr_attendance
  faltantes: -
- `payroll_target`: PENDIENTE
  instalados: -
  faltantes: hr_contract, hr_payroll, l10n_ec_hr_payroll

### Modulos no encontrados en esta distribucion
- `hr_contract`
- `hr_payroll`
- `l10n_ec_hr_payroll`

## 5) Estadisticas de corrida de migracion

- `cleanup`: {"partners_deleted": 0, "product_variants_deleted": 0, "product_templates_deleted": 0}
- `ref_normalize`: {"refs_updated": 0, "partners_merged": 0}
- `partners`: {"source": 1343, "skipped_aux_cliente": 3, "skipped_aux_ventasfamp": 0, "upserted": 1343}
- `suppliers`: {"source": 1293, "warnings": 0, "upserted": 1293}
- `products`: {"source": 759, "skipped": 0, "upserted": 759}
- `client_profiles`: {"loaded": 2196}
- `partner_profile_sync`: {"created": 0, "updated": 2196, "unmapped_clients": 0}
- `suspicious_emails`: {"blocked": 1, "cleared": 0}
- `partner_contacts`: {"candidates_email": 1000, "candidates_phone": 1256, "updated_email": 0, "updated_phone": 0}
- `client_business_profiles`: {"loaded": 2196}
- `sales_users`: {"created_users": 0, "created_partners": 0, "mapped": 29}
- `pricelists`: {"created": 0, "existing": 25, "mapped": 25}
- `partner_business_fields`: {"profiles_total": 2196, "partners_updated": 2196, "missing_partner": 0, "set_city": 1645, "set_street": 1625, "set_state": 1645, "set_country": 1645, "set_vendor": 2190, "set_pricelist": 1647}
- `sales`: {"headers_total": 7851, "orders_upserted": 7851, "order_lines_inserted": 2502, "skipped_no_partner": 0, "skipped_bad_key": 0, "missing_products_created": 0, "missing_partners_created": 0, "orders_with_salesperson": 7737, "orders_with_pricelist": 7738}
- `lots`: {"lot_rows_source": 57503, "lot_upserted": 7416, "products_tracking_updated": 1472, "lot_skipped_no_product": 0, "missing_products_created": 0}
- `stock_quants`: {"inventory_rows_source": 733, "inventory_rows_skipped": 0, "stock_location_used": 5, "quant_upserted": 733, "lots_upserted": 641, "products_updated": 568, "total_quantity_loaded": "22371", "missing_products_created": 0}
- `purchases`: {"headers_total": 9980, "orders_upserted": 9980, "order_lines_inserted": 9980, "missing_incoming_type": false, "missing_supplier_created": 0}
- `partial_delivery`: {"outgoing_picking_types_configured": 1, "incoming_picking_types_configured": 1, "sale_orders_direct_policy": 0, "products_invoice_policy_delivery": 1, "products_lot_tracked_aligned": 1489}
- `partner_postprocess`: {"complete_name_fixed": 14, "commercial_partner_fixed": 1214, "type_fixed": 0, "is_company_fixed": 0, "base_fields_fixed": 3659}
- `business_coverage`: {"source_clients_total": 2196, "source_with_street": 1625, "source_with_city": 1645, "source_with_vendor": 2190, "source_with_pricelist": 1647, "mapped_clients": 2196, "mapped_partners": 1554, "target_partner_coverage": {"partners_in_scope": 1554, "with_street": 1382, "with_city": 1396, "with_state": 1390, "with_country": 1390, "with_vendor": 1550, "with_pricelist": 1387}, "target_sale_order_coverage": {"so_total": 7851, "so_with_user": 7737, "so_with_pricelist": 7738}}
- `oracle_functional_audit`: {"total_tables": 459, "warnings": 0}
