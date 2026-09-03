# CONTEXT.md — inventario

## 1. Descripción
Módulo de gestión de inventario de equipos (unidades físicas). Permite consultar inventario completo, listar modelos disponibles, crear unidades desde modelos, capturar seriales, asignar equipos a clientes/sucursales, cambiar estados y registrar movimientos de entrada/salida.

## 2. Endpoints

- **GET /api/v1/inventario/** — `getInventario` — verifyToken — todos autenticados
- **GET /api/v1/inventario/equipos-disponibles** — `getEquiposDisponibles` — verifyToken
- **GET /api/v1/inventario/equipos-cliente/:cliente_id** — `getEquiposPorCliente` — verifyToken
- **GET /api/v1/inventario/modelos** — `listModelos` — verifyToken
- **POST /api/v1/inventario/equipos-unidad** — `createUnidad` — verifyToken, requireRole(INVENTORY_CREATE_ROLES)
  - Roles: `comercial`, `jefe_comercial`, `backoffice_comercial`, `acp_comercial`, `servicio_tecnico`, `tecnico`, `jefe_tecnico`, `jefe_servicio_tecnico`, `operaciones`, `jefe_operaciones`, `logistica`, `jefe_logistica`, `gerencia`, `ti`, `admin_ti`, `admin`
- **POST /api/v1/inventario/equipos-unidad/:id/serial** — `captureSerial` — verifyToken, requireRole(INVENTORY_MUTATION_ROLES)
  - Roles: `servicio_tecnico`, `tecnico`, `jefe_tecnico`, `jefe_servicio_tecnico`, `operaciones`, `jefe_operaciones`, `logistica`, `jefe_logistica`, `finanzas`, `jefe_finanzas`, `gerencia`, `ti`, `admin_ti`, `admin`
- **POST /api/v1/inventario/equipos-unidad/:id/asignar** — `assignUnidad` — verifyToken, requireRole(INVENTORY_MUTATION_ROLES)
- **POST /api/v1/inventario/equipos-unidad/:id/cambiar-estado** — `cambiarEstadoUnidad` — verifyToken, requireRole(INVENTORY_MUTATION_ROLES)
- **POST /api/v1/inventario/movimiento** — `addMovimiento` — verifyToken, requireRole(INVENTORY_MUTATION_ROLES)

## 3. Flujo principal

1. Se crean unidades de inventario desde un modelo base
2. Se captura el serial físico del equipo
3. Se asigna la unidad a un cliente/sucursal
4. Se registran movimientos de entrada y salida de bodega
5. El estado del equipo cambia según su ciclo de vida

## 4. Validaciones
- Dos niveles de roles: creación (amplio) y mutación (restringido a operativos/técnicos)
- Lectura de inventario sin restricción de rol (solo verifyToken)

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `clients`: equipos se asignan a clientes
- `private-purchases`: flujo de compra privada involucra inventario
- `equipment-purchases`: compras de equipos generan nuevas unidades
- `servicio`: mantenimientos referencian equipos del inventario

## 7. Frontend asociado
- No verificado en frontend (probable integración en workspace de servicio técnico o compras)

## 8. Riesgos detectados
- Lectura de inventario completo sin restricción de rol — cualquier usuario autenticado ve el stock
- `inventario.service.js` (11KB) — relativamente pequeño para la complejidad esperada

## 9. Notas técnicas
- Diferente de `equipment-purchases` (que gestiona el proceso de compra) — este módulo gestiona las unidades físicas resultantes
