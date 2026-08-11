# Plan Corregido: Expedientes de Consumibles Integrados con Compras y Business Case

## 1. Objetivo

Implementar un modulo de expedientes de consumibles con subexpedientes por area, pedidos mensuales, control de maximos, excedentes, despacho parcial, pendientes acumulables y notificaciones, sin romper la arquitectura actual de FamSPI y reutilizando lo que ya existe en:

- `business-case`
- `workspace de compras`
- `bc_consumption_items`
- `bc_dispatch_items`
- `SupplyControlTab`
- `dispatch_workspace`

La correccion principal es esta:

- el requerimiento de negocio si justifica una capa propia de expedientes y pedidos
- pero esa capa no debe reemplazar ni duplicar el motor BC existente
- debe integrarse con compras y con Business Case de forma nativa

## 2. Requerimiento funcional consolidado

El modulo debe permitir:

1. Crear expedientes de consumibles por proceso.
2. Crear subexpedientes o tabs por areas como:
   - inmunologia
   - quimica
   - quimica sanguinea
   - y otras que el negocio agregue
3. Permitir al asesor comercial agregar:
   - consumibles
   - calibradores
   - controles
4. Agregar items por dos vias:
   - barra de busqueda
   - seleccion de equipo con expansion de insumos vinculados
5. Guardar presentacion y maximos base:
   - cuanto viene por caja
   - cuantas cajas corresponden
   - cantidad maxima de producto final
6. Bloquear modificacion del expediente una vez registrado.
7. Permitir pedidos mensuales contra el maximo disponible.
8. Mostrar en tiempo real cuanto queda disponible por item.
9. Bloquear pedidos por encima del maximo salvo como excedente.
10. Registrar y controlar excedentes por separado.
11. Notificar por correo a `jefe_operaciones` y `jefe_logistica` al enviar un pedido.
12. Permitir a logistica registrar cantidades enviadas.
13. Mantener pendientes no enviados para el siguiente pedido.
14. Permitir a `jefe_operaciones` ver:
   - faltantes por entregar
   - deficit
   - items que llegaron al maximo
   - excedentes pendientes de aprobacion
15. Permitir a `jefe_operaciones` aprobar o rechazar excedentes.

## 3. Evidencia validada en el proyecto

### 3.1 Codigo real

Se verifico que ya existe base operativa reutilizable:

- `bc_consumption_items` como definicion de items por Business Case
- `bc_dispatch_items` como capa operativa editable
- `bcDispatchWorkspace.service.js`
- `DispatchWorkspaceSection.jsx`
- `SupplyControlTab.jsx`
- resolucion de BC en compras publicas via `extra.auto_business_case_id`
- integracion de compras privadas con `business_case_id`

### 3.2 Neon

Se verifico en Neon:

- existencia de `bc_consumption_items`
- existencia de `bc_dispatch_items`
- existencia de `catalog_consumables`
- existencia de `catalog_equipment_consumables`
- existencia de `equipment_purchase_requests`
- existencia de `private_purchase_requests`
- PK real de clientes: `clients.id`

## 4. Decision arquitectonica final

### 4.1 Si se requiere una capa propia

Con el requerimiento actual, si se justifica una capa propia para:

- expediente principal
- subexpedientes por area
- pedidos mensuales
- lineas solicitadas
- lineas despachadas
- control de excedentes

### 4.2 Lo que no se debe duplicar

No se debe duplicar:

- el catalogo base
- la vinculacion equipo -> consumibles
- la logica de Business Case ya existente
- la proyeccion operativa BC cuando el expediente nazca de compras/BC

### 4.3 Modelo hibrido aprobado

El modulo debe trabajar en dos modos:

#### Modo A: expediente ligado a BC/compras

- nace desde el workspace de compras o desde un Business Case relacionado
- puede importar o sincronizar items base desde `bc_consumption_items`
- puede proyectar o enlazarse con `bc_dispatch_items`

#### Modo B: expediente standalone

- aplica a procesos anteriores o legados sin Business Case
- usa el mismo frontend y el mismo flujo de negocio
- pero no depende de BC para existir

## 5. Alcance del modulo

### 5.1 Backend

Se justifica un modulo propio, siempre integrado:

- `backend/src/modules/consumable-files/` o nombre equivalente alineado al proyecto

Responsabilidades:

- expedientes
- subexpedientes
- lineas base
- pedidos
- excedentes
- despacho
- reportes operativos basicos
- notificaciones del flujo

### 5.2 Frontend

La experiencia debe vivir integrada con el workspace de compras y no como una herramienta aislada del ecosistema.

Se acepta:

- una seccion propia dentro de Workspace de Compras
- o una vista dedicada enlazada desde compras

No se acepta:

- una pantalla paralela desconectada del flujo de compras y BC

## 6. Modelo funcional

## 6.1 Expediente principal

Campos minimos esperados:

- `id`
- `origin_type`: `business_case` | `standalone`
- `business_case_id` nullable
- `purchase_request_id` nullable
- `process_code` si aplica
- `process_name`
- `client_id` nullable
- `status`
- `registered_at`
- `created_by`
- `created_at`
- `updated_at`

Reglas:

- si es `business_case`, debe guardar su referencia real
- si es `standalone`, no depende de BC
- una vez registrado, no debe poder modificarse su estructura base

## 6.2 Subexpedientes

Cada expediente debe tener subexpedientes por area.

Reglas:

- tabs predefinidas iniciales:
  - inmunologia
  - quimica
  - quimica_sanguinea
  - otros
- debe poder crecer a mas areas por negocio
- un subexpediente pertenece a un expediente

## 6.3 Lineas base del subexpediente

Cada subexpediente debe soportar lineas con:

- `item_key`
- `item_type`
- `catalog_consumable_id` nullable
- `equipment_id` nullable
- `item_name`
- `presentation_unit`
- `units_per_box`
- `box_qty`
- `max_units`
- `unit_price` nullable
- `source_type`
- `created_by`

Origenes permitidos:

- busqueda de item en catalogo
- expansion desde equipo vinculado

Reglas:

- `max_units = units_per_box * box_qty`
- esta cantidad representa producto total, no cajas
- la presentacion debe quedar resguardada historicamente
- una vez registrado el expediente, las lineas ya no se editan

## 6.4 Pedidos mensuales

Cada expediente puede generar multiples pedidos mensuales.

Campos minimos esperados:

- `expediente_id`
- `period`
- `status`
- `requested_by`
- `submitted_at`
- `approved_at`
- `created_at`
- `updated_at`

Cada pedido debe tener lineas con:

- `base_line_id`
- `requested_units`
- `available_before_request`
- `normal_units`
- `extra_units`
- `extra_status`
- `operations_notes`

## 6.5 Despacho

Logistica debe registrar por linea:

- `sent_units`
- `pending_units`
- `dispatch_date`
- `dispatch_notes`

Regla:

- si se solicitan 8 y se envian 6, el pendiente 2 debe volver a quedar disponible para la siguiente solicitud segun la regla funcional que defina el service

## 7. Reglas de negocio

## 7.1 Calculo del maximo

Para cada linea base:

- `max_units = units_per_box * box_qty`

Ejemplo:

- si vienen 2 por caja
- y se configuran 5 cajas
- el maximo es 10 unidades

## 7.2 Disponible en tiempo real

El disponible visible para pedir debe considerar:

- maximo original
- unidades normales ya solicitadas/aprobadas
- unidades no entregadas que deben arrastrarse al siguiente pedido segun la logica final del service

Formula funcional esperada:

- disponible = maximo base - consumo confirmado del cupo base + pendientes recuperables

La implementacion exacta debe congelarse en service y pruebas.

## 7.3 Excedente

Si el comercial necesita mas del maximo:

- el exceso no bloquea el flujo
- pero debe quedar separado como `extra_units`
- el extra debe requerir decision de `jefe_operaciones`

Estados esperados del extra:

- `pending`
- `approved`
- `rejected`

## 7.4 Inmutabilidad del expediente

Una vez registrado:

- no se puede editar encabezado
- no se pueden editar subexpedientes
- no se pueden editar lineas base

Si se requiere un ajuste estructural, debe hacerse por un nuevo expediente o por una accion administrativa definida explicitamente.

## 7.5 Pendientes por despacho parcial

Si logistica no puede enviar todo:

- el sistema debe registrar lo enviado
- debe dejar trazabilidad del faltante
- el faltante debe aparecer al comercial como parte de la necesidad del siguiente pedido

## 8. Integracion con Business Case

## 8.1 Casos que deben integrarse

Cuando el expediente venga de un proceso nuevo ligado a compras o BC:

- debe poder enlazarse con el Business Case real
- debe poder importar consumibles base si ya existen en `bc_consumption_items`
- debe poder reflejar su estado operativo en conjunto con `bc_dispatch_items`

## 8.2 Regla tecnica

No se debe copiar ciegamente toda la informacion de BC si puede resolverse por referencia.

Se permite copiar snapshot historico solo cuando haga falta congelar datos para el expediente.

## 8.3 Compras publicas

La vinculacion real debe resolver primero:

- `extra.auto_business_case_id`

No asumir que `equipment_purchase_requests.business_case_id` es la fuente principal.

## 8.4 Compras privadas

Debe respetar el flujo real del modulo:

- `business_case_id`
- o el enlace vigente confirmado por codigo

## 9. Integracion con Workspace de Compras

La UI debe quedar alineada al flujo del usuario:

1. compras genera o enlaza el proceso
2. expediente de consumibles queda accesible desde ese contexto
3. el comercial gestiona:
   - estructura del expediente
   - pedidos mensuales
4. operaciones y logistica gestionan:
   - aprobacion de extras
   - despacho
   - deficit

Puntos de integracion ya existentes:

- [PurchasesWorkspace.jsx](/C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/spi_front/src/modules/shared/purchases-workspace/PurchasesWorkspace.jsx)
- [SupplyControlTab.jsx](/C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/spi_front/src/modules/shared/purchases-workspace/expediente/tabs/SupplyControlTab.jsx)

## 10. Integracion con UI comercial y operativa

Se requieren al menos estas vistas:

### 10.1 Vista comercial

- listado de expedientes
- detalle del expediente
- tabs por area
- buscador de items
- selector de equipo
- resumen de maximos
- historial de pedidos
- disponible en tiempo real
- formulario de nuevo pedido

### 10.2 Vista de jefe_operaciones

- bandeja de pedidos enviados
- aprobacion/rechazo de extras
- dashboard de deficit
- dashboard de faltantes
- dashboard de items maximizados

### 10.3 Vista de jefe_logistica

- detalle del pedido
- carga de cantidades enviadas
- visibilidad de pendientes
- historial de despachos

## 11. Propuesta de datos

## 11.1 Tablas propias justificadas

Con el requerimiento actual, si se justifican tablas propias para:

- expediente header
- subexpedientes
- lineas base
- pedidos
- lineas de pedido
- eventos o lineas de despacho

Nombres sugeridos:

- `consumable_files`
- `consumable_file_sections`
- `consumable_file_lines`
- `consumable_orders`
- `consumable_order_lines`
- `consumable_dispatch_lines`

## 11.2 Reglas de modelado obligatorias

- FK cliente hacia `clients.id`
- referencias reales a BC cuando apliquen
- referencias reales a compra cuando apliquen
- snapshot historico de presentacion y maximos en la linea base
- no duplicar catalogos maestros

## 11.3 Integracion con BC operativo

Si el expediente es BC-linked:

- puede guardar referencia a `bc_dispatch_items` o a la linea BC origen
- no debe reemplazar `bc_dispatch_items`
- debe convivir con esa capa

## 12. Estados

## 12.1 Expediente

Estados minimos:

- `draft`
- `registered`
- `cancelled`

## 12.2 Pedido

Estados minimos:

- `draft`
- `submitted`
- `extra_pending`
- `approved`
- `partially_dispatched`
- `dispatched`
- `cancelled`

## 12.3 Extra

Estados minimos:

- `pending`
- `approved`
- `rejected`

Nota:

Estos estados deben validarse contra contratos y UI existente antes de congelarlos en implementacion.

## 13. Notificaciones

Se requieren notificaciones por correo a:

- `jefe_operaciones`
- `jefe_logistica`

al enviar pedido.

Contenido esperado:

- proceso
- cliente si aplica
- area o subexpediente si aplica
- items solicitados
- cantidades
- extras detectados
- enlace directo al pedido

Eventos minimos:

- pedido enviado
- extra solicitado
- extra aprobado
- extra rechazado
- despacho registrado

Regla:

- la logica de cuando se dispara nace del modulo origen
- el sistema de notificaciones solo orquesta destinatarios y plantilla

## 14. Plan de ejecucion

### Fase 1. Cierre de arquitectura y mapa de integracion

Objetivo:

- definir el enlace exacto entre expediente, compras y BC

Tareas:

- cerrar contrato de `origin_type`
- cerrar referencias a BC y compra
- definir donde vive el punto de entrada UI
- validar roles exactos existentes

### Fase 2. Diseno de BD

Objetivo:

- crear modelo de datos propio sin duplicar catalogos ni BC

Tareas:

- definir tablas
- definir FKs reales
- definir indices
- definir snapshots historicos
- definir estrategia de referencias a BC-linked

### Fase 3. Backend del modulo

Objetivo:

- implementar CRUD de expedientes y pedidos

Tareas:

- expedientes
- subexpedientes
- lineas base
- pedidos
- extras
- despacho
- calculo de disponible
- arrastre de pendientes

### Fase 4. Integracion con compras y BC

Objetivo:

- conectar el nuevo modulo al flujo existente

Tareas:

- resolver enlace con `extra.auto_business_case_id`
- resolver enlace con compras privadas
- integrar `SupplyControlTab`
- exponer acceso desde workspace

### Fase 5. Frontend

Objetivo:

- entregar UX clara y alineada a `DESIGN.md`

Tareas:

- listado y detalle de expedientes
- tabs por area
- buscador de insumos
- selector por equipo
- resumen de maximos/disponibles
- pedidos mensuales
- vista operativa
- vista logistica
- loading/empty/error/success
- responsive

### Fase 6. Notificaciones

Objetivo:

- disparar correos correctos sin duplicidad

Tareas:

- plantillas
- destinatarios
- enlaces al sistema
- payload de pedido y extra

### Fase 7. Validacion

Objetivo:

- probar el flujo end to end

Casos minimos:

1. crear expediente standalone
2. crear expediente ligado a compras/BC
3. agregar items por busqueda
4. agregar items por equipo
5. registrar expediente y bloquear edicion
6. crear pedido dentro del maximo
7. crear pedido con excedente
8. aprobar y rechazar excedente
9. despacho parcial
10. verificar arrastre de pendiente al siguiente pedido
11. verificar dashboard operativo
12. verificar correos

## 15. Riesgos controlados

### Riesgo 1

Duplicar la capa operativa ya existente en BC.

Mitigacion:

- usar referencias e integracion, no reemplazo

### Riesgo 2

Romper compras publicas por usar un enlace de BC equivocado.

Mitigacion:

- respetar `extra.auto_business_case_id`

### Riesgo 3

Congelar mal la formula de disponible y pendientes.

Mitigacion:

- cubrir con casos de prueba del flujo mensual y despacho parcial

## 16. Decision final

Con este requerimiento, el plan correcto es un modelo hibrido:

1. modulo propio de expedientes y pedidos de consumibles
2. integrado a Workspace de Compras
3. enlazable con Business Case
4. reutilizando catalogos y piezas BC existentes
5. sin crear una duplicacion ciega del motor actual

## 17. Estado actual del plan

Fecha de corte: 2026-07-02

### 17.1 Completado

- Fase 1. Cierre de arquitectura y mapa de integracion
  - resuelto `origin_type` para expedientes ligados a compra
  - resuelta referencia a BC en compras publicas via `extra.auto_business_case_id`
  - resuelta referencia a BC en compras privadas via `business_case_id`
  - punto de entrada UI integrado al Workspace de Compras en el tab `insumos`

- Fase 2. Diseno de BD
  - definidas tablas propias:
    - `consumable_files`
    - `consumable_file_sections`
    - `consumable_file_lines`
    - `consumable_orders`
    - `consumable_order_lines`
    - `consumable_dispatch_lines`
  - implementada migracion `backend/migrations/236_consumable_files_workspace.sql`

- Fase 3. Backend del modulo
  - CRUD funcional para expediente ligado a compra
  - creacion de expediente standalone
  - creacion de subexpedientes
  - lineas base manuales por catalogo
  - importacion por equipo
  - importacion desde `bc_consumption_items`
  - registro y bloqueo estructural del expediente
  - creacion de pedidos mensuales
  - control de excedentes por linea
  - aprobacion/rechazo de excedentes
  - despacho parcial y multiple por pedido
  - arrastre de pendientes al siguiente pedido
  - overview operativo para workspace

- Fase 4. Integracion con compras y BC
  - integrado al detalle de expediente de compras
  - reemplazo funcional del tab `insumos` hacia `ConsumableFilesTab`
  - integracion BC -> consumibles desde expediente
  - resumen operativo visible desde `PurchasesWorkspace`

- Fase 5. Frontend
  - vista comercial del expediente implementada
  - apertura y gestion de expedientes standalone dentro del mismo workspace
  - tabs por area dinamicos
  - buscador de insumos
  - selector por equipo
  - resumen de maximos y disponibles
  - formulario de pedido mensual
  - historial de pedidos
  - vista operativa dentro del expediente para operaciones y logistica
  - estados loading, empty y error en el tab

- Fase 6. Notificaciones
  - pedido enviado
  - excedente aprobado
  - excedente rechazado
  - despacho registrado
  - payload con `workspace_path` para trazabilidad

### 17.2 Parcial

- Fase 5. Frontend
  - existe vista operativa integrada en compras, pero no existe aun una pantalla independiente dedicada solo a consumibles fuera del expediente de compra

- Fase 6. Notificaciones
  - se usan notificaciones reales via `notificationManager`
  - no se construyo una plantilla documental o visual dedicada; se usa `customTitle/customMessage`

### 17.3 Pendiente

- Integracion explicita con `bc_dispatch_items`
  - hoy existe convivencia e importacion desde BC
  - no existe sincronizacion bidireccional ni referencia operativa fuerte contra `bc_dispatch_items`

- Fase 7. Validacion end to end
  - no se ejecutaron pruebas E2E completas del flujo
  - no se dejo evidencia de corrida completa con datos de prueba cerrando todos los casos del plan

- Despliegue y aplicacion de migracion
  - no se deja confirmado en este plan que la migracion `236` haya sido aplicada en el ambiente objetivo
  - no se deja confirmado deploy backend/frontend posterior a estos cambios

### 17.4 Estado global

- Backend: funcional para modo ligado a compras/BC
- Frontend: funcional dentro de Workspace de Compras
- Notificaciones: funcionales
- Standalone: funcional
- E2E formal: pendiente
- Deploy final: no verificado en este plan
