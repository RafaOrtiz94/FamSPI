# Runbook API: delivery requests (SPI)

## Objetivo
Registrar solicitudes de entrega parcial sobre un `delivery_ceiling` activo y confirmar entrega interna en SPI, sin dependencia de Odoo.

## Regla de saldo usada por backend
`remaining = max_quantity - delivered_qty - sum(open requests)`

- `open requests` en esta version: estados `pending`.
- `confirmed` ya impacta `delivered_qty`.
- `cancelled` no reserva saldo.
- `asOfDate` (opcional) define la fecha a evaluar contra tramos de plan publico; si no se envía, usa fecha actual del servidor.

## Endpoint crear solicitud
`POST /api/v1/delivery-requests`

### Request JSON
```json
{
  "ceilingId": 101,
  "asOfDate": "2026-04-12",
  "lines": [
    { "ceilingLineId": 501, "requestedQty": 2.5 },
    { "ceilingLineId": 502, "requestedQty": 1 }
  ],
  "notes": "Entrega parcial semana 1"
}
```

### Curl ejemplo
```bash
curl -X POST "http://localhost:8080/api/v1/delivery-requests" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"ceilingId":101,"lines":[{"ceilingLineId":501,"requestedQty":2.5}]}'
```

### Errores esperados
- `400 { "code": "CEILING_NOT_ACTIVE", "message": "El delivery_ceiling no esta activo" }`
- `400 { "code": "ITEM_NOT_ALLOWED", "message": "Una o mas lineas no pertenecen al delivery_ceiling activo" }`
- `400 { "code": "MAX_EXCEEDED", "message": "La cantidad solicitada excede el saldo disponible" }`
- `400 { "code": "PUBLIC_PLAN_NOT_APPROVED", "message": "No existe plan de entrega publico aprobado" }`
- `400 { "code": "OUTSIDE_DELIVERY_WINDOW", "message": "No existe tramo vigente para una o mas lineas solicitadas" }`
- `400 { "code": "TRANCHE_MAX_EXCEEDED", "message": "La cantidad solicitada excede el maximo permitido para el tramo vigente" }`

## API minima de plan publico (analista)

### Crear plan draft
`POST /api/v1/public-delivery-plans`

```json
{
  "deliveryCeilingId": 101,
  "notes": "Plan de entregas Q2"
}
```

### Agregar tramo
`POST /api/v1/public-delivery-plans/:id/lines`

```json
{
  "deliveryCeilingLineId": 501,
  "scheduledStart": "2026-04-01",
  "scheduledEnd": "2026-04-30",
  "maxQtyTranche": 4
}
```

### Aprobar plan
`POST /api/v1/public-delivery-plans/:id/status`

```json
{
  "toStatus": "approved",
  "reason": "Aprobacion analista compras publicas"
}
```

## Endpoint confirmar entrega
`POST /api/v1/delivery-requests/:id/confirm-delivery`

### Curl ejemplo
```bash
curl -X POST "http://localhost:8080/api/v1/delivery-requests/77/confirm-delivery" \
  -H "Authorization: Bearer <TOKEN>"
```

### Efecto
1. Cambia `delivery_request.status` a `confirmed`.
2. Incrementa `delivery_ceiling_line.delivered_qty` por cada linea del request.
3. Recalcula saldo disponible para solicitudes futuras por la formula anterior.
