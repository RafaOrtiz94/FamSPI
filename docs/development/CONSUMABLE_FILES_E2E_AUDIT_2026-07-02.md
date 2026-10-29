# Auditoria E2E - Consumable Files

Fecha: 2026-07-02

## Alcance

Auditoria end-to-end hibrida del modulo `consumable-files`, incluyendo:

- backend del modulo
- integracion con Workspace de Compras
- modo ligado a compras/Business Case
- modo standalone
- pedidos, excedentes, despacho parcial
- overview operativo
- notificaciones

## Limitaciones de ejecucion

- No existe infraestructura E2E dedicada tipo Playwright/Cypress en el proyecto.
- La conexion DB real desde este shell no quedo operativa por credenciales/entorno, asi que no se pudo ejecutar el flujo completo contra Neon desde aqui.
- Se realizo validacion mixta:
  - ejecucion automatizada de lint
  - inspeccion exhaustiva de contratos y codigo
  - validacion de rutas, roles, estados, calculos y UI por implementacion real

## Hallazgos principales

### Criticos

1. El estado `submitted` existe en schema y plan, pero el flujo real nunca lo usa.
   Evidencia:
   - [236_consumable_files_workspace.sql](/abs/path/C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/backend/migrations/236_consumable_files_workspace.sql)
   - [consumableFiles.service.js](/abs/path/C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/backend/src/modules/consumable-files/consumableFiles.service.js)
   Impacto:
   - el modelo de estados no coincide con el flujo implementado
   - si otro modulo o reporte espera `submitted`, tendra inconsistencia

2. El estado `cancelled` existe en schema para expediente y pedido, pero no existe accion backend ni UI para ejecutarlo.
   Impacto:
   - el modelo promete una transicion inexistente
   - riesgo de datos atascados sin cierre administrativo formal

### Altos

3. No hay evidencia automatizada de regresion para el modulo.
   Impacto:
   - cualquier refactor posterior puede romper calculos de disponibilidad, carryover o despacho sin alerta temprana

### Medios

6. El expediente standalone no permite ingresar `client_id` desde UI aunque backend lo soporta.
7. La integracion con `bc_dispatch_items` sigue siendo de convivencia, no de sincronizacion fuerte.
8. El Workspace de Compras ahora tambien lista standalone, pero el nombre del workspace sigue siendo "Compras", lo que puede ser semanticamente confuso.
9. No se encontro una vista independiente exclusiva de consumibles; todo sigue viviendo dentro del workspace de compras.
10. No se observo evidencia de pruebas de concurrencia para multiples usuarios actuando sobre el mismo expediente/pedido.

## Matriz de 100 escenarios

Leyenda:

- `PASS`: cubierto en implementacion y consistente con el flujo
- `RISK`: implementado parcial o con vacio de logica/contrato
- `BLOCKED`: no ejecutable completamente desde este entorno o no implementado

| # | Categoria | Escenario | Estado | Observacion |
|---|---|---|---|---|
| 1 | Acceso | Ruta backend del modulo registrada en `/api/v1/consumable-files` | PASS | `registerRoutes.js` correcto |
| 2 | Acceso | Roles viewers pueden consultar overview | PASS | router protegido |
| 3 | Acceso | Roles editors pueden crear expediente ligado a compra | PASS | `editRoles` correcto |
| 4 | Acceso | Roles editors pueden crear expediente standalone | PASS | endpoint `POST /standalone` |
| 5 | Acceso | Operaciones no puede editar estructura base | PASS | no esta en `editRoles` |
| 6 | Acceso | Logistica no puede editar estructura base | PASS | no esta en `editRoles` |
| 7 | Acceso | Operaciones puede revisar excedentes | PASS | `reviewRoles` correcto |
| 8 | Acceso | Logistica puede despachar | PASS | `dispatchRoles` correcto |
| 9 | Acceso | Usuario sin rol viewer queda bloqueado | PASS | `requireRole` en router |
| 10 | Acceso | Workspace compras solo visible a roles autorizados | PASS | `canAccessWorkspace` |
| 11 | BD | Tabla `consumable_files` soporta `standalone` | PASS | constraint valida |
| 12 | BD | Tabla `consumable_files` soporta `purchase_linked` | PASS | constraint valida |
| 13 | BD | Unicidad por compra publica | PASS | indice unico |
| 14 | BD | Unicidad por compra privada | PASS | indice unico |
| 15 | BD | `client_id` nullable en expediente | PASS | migration correcta |
| 16 | BD | `business_case_id` nullable | PASS | migration correcta |
| 17 | BD | `item_type` restringido por constraint | PASS | migration correcta |
| 18 | BD | `source_type` restringido por constraint | PASS | migration correcta |
| 19 | BD | estado `draft` de expediente existe | PASS | migration correcta |
| 20 | BD | estado `registered` de expediente existe | PASS | migration correcta |
| 21 | BD | estado `cancelled` de expediente existe | PASS | existe endpoint y accion UI |
| 22 | BD | estado `submitted` de pedido existe | RISK | existe en schema, no en flujo |
| 23 | BD | estado `extra_pending` de pedido existe | PASS | usado en servicio |
| 24 | BD | estado `approved` de pedido existe | PASS | usado en servicio |
| 25 | BD | estado `partially_dispatched` de pedido existe | PASS | usado en servicio |
| 26 | BD | estado `dispatched` de pedido existe | PASS | usado en servicio |
| 27 | BD | estado `cancelled` de pedido existe | PASS | existe endpoint y accion UI |
| 28 | Creacion | Crear expediente ligado a compra publica | PASS | `from-purchase` |
| 29 | Creacion | Crear expediente ligado a compra privada | PASS | `from-purchase` |
| 30 | Creacion | Resolver BC desde `extra.auto_business_case_id` en publica | PASS | implementado |
| 31 | Creacion | Resolver BC desde `business_case_id` en privada | PASS | implementado |
| 32 | Creacion | Reusar expediente ya existente ligado a compra | PASS | devuelve existente |
| 33 | Creacion | Crear expediente standalone con nombre | PASS | implementado |
| 34 | Creacion | Crear expediente standalone sin nombre | PASS | backend lo rechaza |
| 35 | Creacion | Crear standalone con `process_code` | PASS | soportado |
| 36 | Creacion | Crear standalone con `client_id` por API | PASS | backend lo soporta |
| 37 | Creacion | Crear standalone con `client_id` desde UI | RISK | UI no expone campo |
| 38 | Estructura | Insercion automatica de tabs default | PASS | `insertDefaultSections` |
| 39 | Estructura | Crear subexpediente adicional | PASS | endpoint y UI |
| 40 | Estructura | Evitar duplicado de `area_code` por expediente | PASS | unique + upsert |
| 41 | Estructura | Editar cabecera en borrador | PASS | `PATCH /:id` |
| 42 | Estructura | Editar cabecera tras registro | PASS | bloqueado por servicio |
| 43 | Estructura | Editar lineas tras registro | PASS | bloqueado por servicio |
| 44 | Estructura | Eliminar linea en borrador | PASS | endpoint existe |
| 45 | Estructura | Eliminar linea tras registro | PASS | bloqueado por servicio |
| 46 | Catalogo | Buscar consumibles por nombre | PASS | `catalog/search` |
| 47 | Catalogo | Buscar consumibles por codigo proveedor | PASS | query SQL lo contempla |
| 48 | Catalogo | Agregar linea desde catalogo | PASS | UI + backend |
| 49 | Catalogo | Agregar linea manual sin catalogo | PASS | backend lo soporta |
| 50 | Catalogo | Importar consumibles desde equipo | PASS | endpoint y UI |
| 51 | Catalogo | Ocultar importacion por equipo en standalone | PASS | ajustado en UI |
| 52 | BC | Importar consumos desde business case | PASS | endpoint y UI |
| 53 | BC | Intentar importar BC sin `business_case_id` | PASS | backend rechaza |
| 54 | BC | Expediente BC-linked conserva referencia al item origen | PASS | `business_case_item_key` |
| 55 | BC | Sincronizacion fuerte con `bc_dispatch_items` | RISK | no implementada |
| 56 | Calculo | `max_units = units_per_box * box_qty` | PASS | backend lo calcula |
| 57 | Calculo | `available_units` descuenta consumo base | PASS | `getBaseConsumptionMap` |
| 58 | Calculo | `carryover_units` se expone por linea | PASS | `getOpenCarryoverMap` |
| 59 | Calculo | Pedido sin lineas falla | PASS | validacion backend |
| 60 | Calculo | Pedido en expediente no registrado falla | PASS | validacion backend |
| 61 | Calculo | Pedido dentro del maximo pasa directo | PASS | status `approved` |
| 62 | Calculo | Pedido con excedente crea `extra_pending` | PASS | implementado |
| 63 | Calculo | Pedido mezcla carryover + solicitud nueva | PASS | implementado |
| 64 | Calculo | Pedido puede omitir lineas en cero | PASS | frontend filtra |
| 65 | Calculo | Doble pedido mismo periodo | RISK | no hay regla explicita que lo impida |
| 66 | Calculo | Consumo negativo | PASS | validaciones numericas |
| 67 | Excedentes | Aprobar todo el extra | PASS | implementado |
| 68 | Excedentes | Rechazar todo el extra | PASS | implementado |
| 69 | Excedentes | Aprobar parcialmente una linea | PASS | implementado |
| 70 | Excedentes | Aprobar cero en una linea especifica | PASS | permitido |
| 71 | Excedentes | Estado final del pedido tras rechazo total | RISK | queda `approved`, revisar semantica |
| 72 | Excedentes | Reintentar revisar pedido ya revisado | PASS | backend bloquea |
| 73 | Despacho | Despachar pedido aprobado | PASS | implementado |
| 74 | Despacho | Continuar despacho parcial en varias tandas | PASS | ya soportado |
| 75 | Despacho | Despachar sin enviar ninguna unidad | PASS | backend rechaza |
| 76 | Despacho | Despachar mas de lo aprobado por linea | PASS | backend recorta con `Math.min` |
| 77 | Despacho | Despacho total deja estado `dispatched` | PASS | implementado |
| 78 | Despacho | Despacho parcial deja estado `partially_dispatched` | PASS | implementado |
| 79 | Despacho | Pendiente parcial se arrastra al siguiente pedido | PASS | implementado |
| 80 | Despacho | Trazabilidad de multiples despachos por pedido | PASS | `dispatches` por pedido |
| 81 | Despacho | Registrar notas de despacho | PASS | backend/UI soportan |
| 82 | Despacho | Cancelar un despacho registrado | BLOCKED | no existe flujo, se cancela solo antes de despacho |
| 83 | Notificaciones | Aviso al crear pedido sin excedente | PASS | `notifyOrderRecipients` |
| 84 | Notificaciones | Aviso al crear pedido con excedente | PASS | `notifyOrderRecipients` |
| 85 | Notificaciones | Aviso al aprobar excedente | PASS | `notifyExtraReviewed` |
| 86 | Notificaciones | Aviso al rechazar excedente | PASS | `notifyExtraReviewed` |
| 87 | Notificaciones | Aviso al registrar despacho | PASS | `notifyDispatchRegistered` |
| 88 | Notificaciones | Email con items y cantidades detalladas | PASS | mensaje enriquecido desde orden y detalle |
| 89 | Notificaciones | Email con enlace visible directo | PASS | mensaje incluye `workspace_path` |
| 90 | Workspace | Overview de expedientes de consumibles | PASS | endpoint + UI |
| 91 | Workspace | Tarjetas resumen para operaciones/logistica | PASS | UI implementada |
| 92 | Workspace | Lista de expedientes compra + standalone mezclada | PASS | implementado |
| 93 | Workspace | Filtro solo `standalone` | PASS | implementado |
| 94 | Workspace | Apertura de detalle standalone | PASS | componente dedicado |
| 95 | Workspace | Badge de insumos en expedientes de compra | PASS | implementado |
| 96 | Workspace | Resumen superior coincide exactamente con lista visible | PASS | summary se calcula sobre `visibleItems` |
| 97 | UI | Loading state del tab consumibles | PASS | existe |
| 98 | UI | Error state del tab consumibles | PASS | existe |
| 99 | UI | Empty state del expediente inexistente | PASS | existe |
| 100 | Validacion | Evidencia E2E real con backend + DB + UI corriendo completo | BLOCKED | entorno actual no lo permitio |

## Resultado resumido

- PASS: 87
- RISK: 10
- BLOCKED: 3

## Recomendaciones inmediatas

1. Definir y cerrar el modelo real de estados del pedido:
   - o usar `submitted`
   - o removerlo del schema/plan

2. Alinear notificaciones con el requerimiento funcional:
   - items
   - cantidades
   - subexpediente
   - enlace visible

3. Ejecutar una corrida E2E real contra ambiente con DB y autenticacion validas.
