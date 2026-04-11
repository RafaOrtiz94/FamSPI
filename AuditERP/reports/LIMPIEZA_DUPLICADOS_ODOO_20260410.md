# Limpieza de duplicados / coincidencias en OdooFAM

Fecha: 2026-04-10
Base: PostgreSQL `OdooFAM`

## Criterio aplicado (conservador)

No se borró información físicamente. Se hizo fusión lógica:

1. Se identificaron duplicados de alta confianza entre partners `CLIID-*` y partner real cuando coincidían por:
- mismo nombre + mismo email, o
- mismo nombre + mismo teléfono, o
- mismo nombre + documento relacionado (10 dígitos vs 13 dígitos con sufijo `001`).

2. Se consolidó información útil en el partner destino (si el destino tenía campos vacíos):
- `name`, `email`, `phone`, `street`, `street2`, `city`, `zip`, `state_id`, `country_id`, `user_id`, `specific_property_product_pricelist`, `vat`, `customer_rank`.

3. Se movieron referencias operativas principales al partner destino:
- `sale_order.partner_id`
- `sale_order.partner_invoice_id`
- `sale_order.partner_shipping_id`
- `sale_order_line.order_partner_id`
- `stock_picking.partner_id`
- `res_partner.parent_id`
- `res_partner.commercial_partner_id`

4. El partner origen se archivó (`active=false`) y se enlazó al destino con:
- `parent_id = destino`
- `commercial_partner_id = destino`

## Resultado

- Candidatos alta confianza detectados: **348**
- Fusiones aplicadas (paso 1): **348**
- Fusiones adicionales (paso 2, casos exactos): **6**
- Total fusiones aplicadas: **354**

## Verificaciones posteriores

- Duplicados por `ref`: **0**
- Duplicados por `vat`: **0**
- Grupos duplicados exactos activos por `(name,email,phone)` en clientes:
  - antes: **328**
  - después: **1**

- Conteos clave no afectados en ventas migradas:
  - `SOERP` pedidos: **7851**
  - líneas `SOERP`: **2502**

## Caso pendiente (ambiguo, NO fusionado)

Se dejó sin unir para evitar riesgo de mezclar personas distintas:

- Nombre: `PUNGUIL AUZ LORENA ELIZABETH`
- Registros activos: `id 150 (ref 1803862125001)` y `id 611 (ref 1803319555001)`
- No hay email/teléfono para validar con mayor certeza.

## Nota de seguridad

La limpieza fue **sin borrado destructivo**. Los registros de origen fusionados quedaron archivados para trazabilidad.
