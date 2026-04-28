# CONTEXT.md — delivery-ceilings

## 1. Descripción
Módulo de topes de entrega (límites de capacidad de entrega por período). Solo expone un endpoint de lectura para consultar los topes configurados. Usado por el flujo comercial para planificar entregas.

## 2. Endpoints

Prefijo: `/api/v1/delivery-ceilings`

- **GET /api/v1/delivery-ceilings/** — `listDeliveryCeilings` — verifyToken, requireRole(DELIVERY_CEILING_READ_ROLES)
  - Roles: `comercial`, `backoffice_comercial`, `acp_comercial`, `jefe_comercial`, `gerencia`, `gerencia_general`, `jefe_operaciones`, `operaciones`, `jefe_logistica`, `jefe_tecnico`, `jefe_servicio_tecnico`, `tecnico`, `servicio_tecnico`

## 3. Flujo principal

1. Sistema consulta topes de entrega disponibles
2. Comercial/Operaciones usa los topes para planificar fechas de entrega

## 4. Validaciones
- Solo lectura — no hay endpoints de escritura en las rutas
- Acceso amplio pero solo para roles operativos

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `business-case`: `deliveryCeiling.service.js` dentro de business-case módulo indica relación
- `equipment-purchases`/`private-purchases`: planificación de entregas

## 7. Frontend asociado
- `/dashboard/comercial/delivery-ceilings` → `DeliveryCeilingsPage`

## 8. Riesgos detectados
- Solo 1 endpoint — funcionalidad muy limitada visible desde las rutas
- `deliveryCeilings.service.js` (7KB) puede contener más lógica no expuesta via API

## 9. Notas técnicas
- Módulo de catálogo/configuración — los topes son configurados externamente
