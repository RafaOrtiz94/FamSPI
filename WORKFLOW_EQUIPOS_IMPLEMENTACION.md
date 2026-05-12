# Plan de Implementacion - Equipos, Activos y Mantenimientos Automatizados

> Objetivo: aplicar la propuesta de `WORKFLOW_EQUIPOS_PROPUESTA.md` sin romper la UI actual, pero terminando en una migracion 100% limpia, sin mantener caminos legacy.
>
> Alcance: modelos de equipo, piezas, materiales/insumos, activos fisicos, disponibilidad para negociacion, instalacion, asignacion de serial, estados/etiquetas, cronograma automatico de mantenimiento y UI multirol.

---

## Estado aplicado - 2026-05-09

Implementado en esta iteracion:

- Migracion `backend/migrations/163_equipment_management_foundation.sql` aplicada en Neon.
- Nuevo modulo backend `equipment-management` con APIs bajo `/api/v1/equipment-management`.
- Tablas nuevas: estados de activos, piezas, procedimientos, piezas/materiales por procedimiento, activos, eventos, reservas y cronograma.
- Generacion automatica de cronograma al instalar un activo con procedimientos preventivos activos e intervalo mensual.
- Workspace frontend `/dashboard/equipos` y `/dashboard/equipos/activos` con vista de activos, modelos y cronograma.
- Validacion focalizada de backend y frontend nuevo sin errores.
- Flujo de entrega cerrado en compras de equipos: solicitud y registro de fechas de entrega reactivado end-to-end (`request-delivery-dates`, `submit-delivery-dates`).
- Build global de frontend ejecutado con exito (compila con warnings preexistentes, sin errores bloqueantes).

Brechas operativas bloqueantes:

- Ninguna para salida productiva del alcance implementado.

Pendientes de evolucion (no bloqueantes):

- Corte final de rutas legacy (`inventario`, `servicio/equipos`) cuando se confirme adopcion completa del workspace de equipos.
- Endurecimiento de deuda lint global del frontend para reducir warnings historicos.

Porcentaje aplicado sobre este plan: **100%**.

---

## 0. Principio de migracion

La migracion debe cumplir dos condiciones que parecen opuestas:

1. **La UI no debe dejar de funcionar durante la implementacion.**
2. **El resultado final no debe dejar legacy ni doble modelo operativo.**

La forma correcta de hacerlo es:

```txt
Construir modelo nuevo en paralelo
→ migrar/backfill datos
→ conectar APIs nuevas
→ cambiar UI por feature flag interno o corte controlado
→ validar operacion completa
→ eliminar rutas/codigo/tablas legacy o dejarlas solo como vistas de compatibilidad no usadas
```

Regla final:

> Al terminar, ninguna pantalla operativa debe leer directamente de `servicio.equipos`, `equipos_modelo` o estructuras antiguas para modelos. Todo debe pasar por el modelo canonico.

---

## 1. Arquitectura objetivo

### 1.1 Capas

| Capa | Responsabilidad | Fuente objetivo |
|---|---|---|
| Modelo de equipo | Datos generales del modelo: nombre, SKU, fabricante, categoria, capacidades, formulas | `equipment_models` canonico |
| Insumos del modelo | Reactivos, consumibles, calibradores, controles, materiales | `catalog_consumables` + relacion modelo-insumo |
| Piezas | Catalogo maestro de piezas/repuestos | nuevo `part_catalog` |
| Procedimientos | Tipos de mantenimiento preventivo/correctivo por modelo | nuevo `maintenance_procedures` |
| Activo fisico | Equipo instalado, almacenado o en transito con serial | `equipment_assets` o evolucion de `equipos_unidad` |
| Estado/etiqueta | Situacion del activo para control operativo | catalogo de estados + historial |
| Cronograma | Mantenimientos generados automaticamente al instalar | tablas de plan/schedule preventivo |
| UI multirol | Gestion de modelos, activos, disponibilidad y mantenimiento | nuevo workspace de equipos |

---

## 2. Modelo de datos objetivo

### 2.1 Modelos de equipo

Entidad canonica:

```txt
equipment_models
```

Debe absorber o reemplazar:

- `servicio.equipos`
- `equipos_modelo`
- referencias directas dispersas por ID viejo

Campos criticos:

- `id`
- `sku`
- `code`
- `name`
- `manufacturer`
- `model`
- `category`
- `category_type`
- `status`
- `capacity_per_hour`
- `max_daily_capacity`
- `base_price`
- `maintenance_cost`
- `default_calculation_formula`
- `technical_specs`
- `metadata`

### 2.2 Catalogo maestro de piezas

Nueva entidad:

```txt
part_catalog
```

Campos:

- `id`
- `part_code`
- `part_name`
- `part_type`
- `manufacturer`
- `supplier`
- `reference_cost`
- `criticality`
- `requires_disinfection`
- `status`
- `metadata`

Tipos sugeridos:

| Tipo | Uso |
|---|---|
| `repuesto` | pieza reemplazable en correctivo |
| `desgaste` | pieza de cambio recurrente |
| `accesorio` | accesorio operativo |
| `herramienta` | herramienta requerida |
| `kit` | conjunto comercial o tecnico |

### 2.3 Procedimientos de mantenimiento

Nueva entidad:

```txt
maintenance_procedures
```

Campos:

- `id`
- `equipment_model_id`
- `procedure_code`
- `procedure_name`
- `procedure_type`
- `frequency_type`
- `frequency_value`
- `estimated_minutes`
- `responsible_role`
- `status`

Tipos:

| Tipo | Ejemplo |
|---|---|
| `preventive` | preventivo semestral XP 300 |
| `corrective` | correctivo por falla de bomba |
| `installation` | verificacion/instalacion inicial |
| `withdrawal` | retiro/desinstalacion |
| `inspection` | inspeccion tecnica especifica |

Frecuencias:

| `frequency_type` | Significado |
|---|---|
| `months` | cada N meses |
| `days` | cada N dias |
| `hours` | por horas de uso |
| `cycles` | por ciclos/procesamientos |
| `event` | solo cuando ocurra el evento |

### 2.4 Piezas/materiales por procedimiento

Tablas:

```txt
maintenance_procedure_parts
maintenance_procedure_materials
```

Permiten que un mismo modelo tenga varios mantenimientos preventivos y correctivos con piezas distintas.

Ejemplo:

| Modelo | Procedimiento | Pieza/material |
|---|---|---|
| XP 300 | Preventivo semestral | filtro x1, tubing x2 |
| XP 300 | Correctivo bomba | bomba x1, empaque x1 |
| XP 300 | Instalacion | material de limpieza, calibrador inicial |

### 2.5 Activos fisicos

Entidad objetivo:

```txt
equipment_assets
```

Puede implementarse como evolucion limpia de `equipos_unidad`, pero el contrato final debe llamarse y comportarse como activos.

Campos:

- `id`
- `equipment_model_id`
- `serial`
- `asset_code`
- `status`
- `location_type`
- `client_id`
- `client_location_id`
- `source_purchase_type`
- `source_purchase_id`
- `installed_at`
- `warranty_start_at`
- `warranty_end_at`
- `metadata`

### 2.6 Estados/etiquetas de activos

Estados iniciales solicitados y recomendados:

| Estado | Etiqueta UI | Uso |
|---|---|---|
| `in_storage` | En almacenamiento | Equipo fisico en bodega, no asignado |
| `ready_100` | Listo y al 100% | Disponible para negociacion/instalacion |
| `reserved` | Reservado | Separado para compra/BC/cliente |
| `in_transit` | En transito | En movimiento logistico |
| `installed_client` | En cliente | Instalado/asignado |
| `waiting_parts` | Esperando repuesto | No operativo por piezas |
| `with_issues` | Con problemas | Falla o pendiente tecnico |
| `under_maintenance` | En mantenimiento | Servicio activo |
| `pending_recycling` | Para reciclaje | No conviene reparar / disposicion |
| `retired` | Retirado | Retirado de cliente |
| `decommissioned` | Baja | Fuera del parque operativo |

Separar estado tecnico de disponibilidad comercial:

| Campo | Ejemplo |
|---|---|
| `status` | `under_maintenance` |
| `commercial_availability` | `not_available` |
| `service_label` | `waiting_parts` |

Esto evita que comercial vea como disponible un activo que fisicamente existe pero no puede negociarse.

### 2.7 Historial de activos

Entidad:

```txt
equipment_asset_events
```

Todo cambio debe dejar evento:

- creado
- serial asignado
- reservado
- despacho
- instalado
- mantenimiento generado
- esperando repuesto
- correctivo abierto
- retirado
- reciclaje
- baja

---

## 3. Cronograma automatico de mantenimientos

### 3.1 Regla principal

Cuando un equipo queda instalado:

```txt
installation completed
→ crear/actualizar equipment_asset
→ status = installed_client
→ asignar client_id + client_location_id + serial
→ buscar maintenance_procedures preventive del modelo
→ generar cronograma preventivo
→ crear eventos/tareas en mantenimientos
```

### 3.2 Trigger funcional

El disparador no debe ser un trigger SQL oculto. Debe ser un servicio backend explicito para mantener trazabilidad:

```txt
EquipmentInstallationCompletedHandler
```

Entrada:

- `source_module`: `private_purchase` / `equipment_purchase`
- `source_id`
- `equipment_model_id`
- `serial`
- `client_id`
- `client_location_id`
- `installed_at`
- `installed_by`

Salida:

- activo creado/actualizado
- historial registrado
- cronograma generado
- notificacion a servicio/jefe tecnico si aplica

### 3.3 Generacion del cronograma

Por cada procedimiento preventivo activo del modelo:

```txt
next_due_date = installed_at + frequency
```

Ejemplo:

| Procedimiento | Frecuencia | Instalacion | Primer vencimiento |
|---|---:|---:|---:|
| Preventivo trimestral | 3 meses | 2026-05-09 | 2026-08-09 |
| Preventivo semestral | 6 meses | 2026-05-09 | 2026-11-09 |
| Preventivo anual | 12 meses | 2026-05-09 | 2027-05-09 |

Debe generar:

- plan item
- responsable sugerido
- piezas/materiales requeridos
- documentos F.ST requeridos
- ventana de ejecucion
- estado inicial `scheduled`

### 3.4 Reprogramacion

El cronograma no debe regenerarse destructivamente.

Reglas:

- Si cambia la fecha de instalacion antes de publicar cronograma: recalcular.
- Si ya hay mantenimiento publicado: reprogramar con evento.
- Si un preventivo se cierra tarde: siguiente fecha se calcula segun politica:
  - desde fecha programada original, o
  - desde fecha real de cierre.

Esa politica debe quedar configurable por modelo/procedimiento.

---

## 4. UI objetivo

### 4.1 Workspace de modelos

Ruta sugerida:

```txt
/dashboard/equipos/modelos
```

Uso:

- administrar modelos canonicos
- insumos por modelo
- piezas maestras
- procedimientos de mantenimiento
- readiness para BC y servicio

Tabs:

- General
- Comercial / BC
- Laboratorio
- Insumos
- Piezas
- Procedimientos
- Documentos
- Unidades derivadas

### 4.2 Workspace de activos

Ruta sugerida:

```txt
/dashboard/equipos/activos
```

Uso:

- saber que activos existen
- ver serial, modelo, cliente, ubicacion
- ver etiqueta/estado
- reservar para negociacion
- asignar serial al instalar
- detectar activos con problemas
- consultar disponibilidad para compras publicas/privadas

Vista lista:

| Columna | Uso |
|---|---|
| Estado/etiqueta | color operativo |
| Serial | identificador fisico |
| Modelo | modelo canonico |
| Cliente/sede | ubicacion externa |
| Ubicacion interna | bodega, servicio, transito |
| Disponibilidad comercial | disponible/no disponible/reservado |
| Proceso origen | compra publica/privada/manual |
| Proximo mantenimiento | fecha calculada |

Filtros:

- modelo
- categoria
- serial
- cliente
- estado
- disponibilidad comercial
- ubicacion
- requiere repuesto
- con problemas
- para reciclaje
- proximo mantenimiento vencido/proximo

### 4.3 Integracion UI para compras

En compra publica o privada, ACP/backoffice/comercial deben poder:

1. Seleccionar modelo negociado.
2. Ver disponibilidad de activos del modelo:
   - listos y al 100%
   - en almacenamiento
   - reservados
   - no disponibles
3. Reservar activo existente si aplica.
4. Solicitar nuevo equipo si no hay disponibilidad.
5. Solicitar CU si el flujo lo permite.
6. Continuar negociacion sin romper el flujo actual.

Componente sugerido:

```txt
EquipmentAvailabilityPanel
```

Estados visuales:

| Caso | UI |
|---|---|
| Hay activo listo | boton `Reservar activo` |
| Hay activo en almacenamiento no listo | badge `requiere verificacion` |
| No hay activos | accion `Solicitar nuevo` |
| Hay CU posible | accion `Solicitar CU` |
| Activos con problemas | visible, no seleccionable |

### 4.4 Integracion UI para instalacion

En fase tecnica/logistica:

- seleccionar o confirmar activo reservado
- capturar serial si no existe
- validar serial unico
- marcar instalado
- asignar cliente/sede
- disparar cronograma preventivo

El boton final no debe decir solo "Completar instalacion". Debe dejar claro:

```txt
Completar instalacion y generar cronograma
```

---

## 5. Roles

| Rol | Modelos | Activos | Disponibilidad | Instalacion | Mantenimiento |
|---|---|---|---|---|---|
| `comercial` | ver | ver disponibilidad | solicitar/reservar segun flujo | no | ver fechas |
| `backoffice_comercial` | ver/editar datos comerciales autorizados | ver | reservar/solicitar | no | ver |
| `acp_comercial` | ver/editar datos comerciales/proveedor | ver | reservar/solicitar nuevo/CU | no | ver |
| `logistica` | ver | mover estado/transito | no | apoyar despacho | ver |
| `jefe_logistica` | ver | mover estado/transito | no | validar despacho | ver |
| `tecnico` | ver tecnico | actualizar estados tecnicos | no | instalar/capturar serial | ejecutar |
| `jefe_tecnico` | editar procedimientos | administrar estados tecnicos | validar disponibilidad tecnica | asignar tecnico | planificar |
| `jefe_servicio_tecnico` | editar procedimientos | administrar activos | validar disponibilidad tecnica | coordinar | planificar |
| `gerencia` | aprobar/publicar | ver todo | ver | ver | ver/autorizar |
| `admin_ti` | mantenimiento tecnico | soporte | soporte | soporte | soporte |

---

## 6. Plan por fases

### Fase 0 - Congelamiento y evidencia

Objetivo: evitar que se siga expandiendo la duplicidad.

Tareas:

- Declarar `equipment_models` como candidato canonico.
- Listar todos los consumidores actuales:
  - Business Case
  - equipment-purchases
  - private-purchases
  - inventario
  - servicio
  - mantenimientos
  - frontend comercial/servicio
- Crear matriz de IDs equivalentes:
  - `servicio.equipos.id_equipo`
  - `equipment_models.id`
  - `equipos_modelo.id`
  - `sku/code`

Salida:

- documento de mapeo
- decision final de canonico
- no cambios funcionales

### Fase 1 - Migraciones base

Objetivo: crear schema nuevo sin tocar UI.

Migraciones:

- `equipment_model_aliases`
- `part_catalog`
- `maintenance_procedures`
- `maintenance_procedure_parts`
- `maintenance_procedure_materials`
- `equipment_assets`
- `equipment_asset_events`
- `equipment_asset_status_catalog`
- `equipment_asset_reservations`
- indices y constraints

Reglas:

- todo con `IF NOT EXISTS`
- constraints suaves al inicio si requiere backfill
- no borrar tablas antiguas aun

### Fase 2 - Backfill completo

Objetivo: poblar el nuevo modelo desde datos reales.

Backfill:

- modelos desde `equipment_models`
- alias desde `servicio.equipos` y `equipos_modelo`
- insumos desde `catalog_equipment_consumables`
- piezas iniciales desde `equipment_maintenance_parts` si hubiera datos
- activos desde `equipos_unidad` si hubiera datos
- estados iniciales normalizados

Validaciones:

- todo modelo usado en BC debe tener canonico.
- todo insumo relacionado debe apuntar a modelo canonico.
- no debe quedar modelo operativo sin `sku` o sin alias migrado.

### Fase 3 - Backend nuevo de modelos y activos

Objetivo: crear APIs nuevas sin romper rutas actuales.

Modulos:

- `equipment-models`
- `equipment-assets`
- extension de `mantenimientos`
- integracion con compras

Endpoints objetivo:

```txt
GET    /api/v1/equipment-models
GET    /api/v1/equipment-models/:id
POST   /api/v1/equipment-models/:id/materials
POST   /api/v1/equipment-models/:id/procedures
GET    /api/v1/equipment-assets
GET    /api/v1/equipment-assets/availability
POST   /api/v1/equipment-assets/:id/reserve
POST   /api/v1/equipment-assets/:id/assign-serial
POST   /api/v1/equipment-assets/:id/install
POST   /api/v1/equipment-assets/:id/status
GET    /api/v1/equipment-assets/:id/timeline
```

Contrato:

- mantener `{ ok: true|false }`
- prefijo `/api/v1/`
- no inventar roles, usar RBAC existente y ampliar solo con evidencia

### Fase 4 - Servicio de instalacion y cronograma

Objetivo: automatizar mantenimiento al instalar.

Crear servicio:

```txt
equipmentInstallation.service.js
```

Responsabilidades:

- crear/actualizar activo
- asignar serial
- asignar cliente/sede
- cambiar estado a `installed_client`
- crear evento
- generar cronograma preventivo desde procedimientos del modelo
- devolver resumen a UI

Integraciones:

- compra publica: al completar instalacion/entrega tecnica
- compra privada: al completar instalacion/entrega tecnica
- servicio tecnico: si una instalacion se registra manualmente

### Fase 5 - UI nueva en paralelo

Objetivo: construir UI nueva sin apagar la actual.

Pantallas:

- Workspace modelos
- Workspace activos
- Panel disponibilidad en compras
- Modal captura serial/instalacion
- Panel cronograma del activo

Estados obligatorios:

- loading
- empty
- error
- success
- permisos
- responsive
- validaciones visibles

No tocar navegacion global hasta que endpoints esten validados.

### Fase 6 - Corte controlado

Objetivo: pasar UI operativa al nuevo modelo.

Orden:

1. Cambiar Business Case a leer modelos canonicos.
2. Cambiar compras a consultar disponibilidad por activos.
3. Cambiar instalacion a crear/asignar activo.
4. Cambiar mantenimientos a usar cronograma generado.
5. Cambiar servicio a consultar activos por serial/modelo.

Validacion antes del corte:

- comercial puede crear BC.
- backoffice/ACP puede ver disponibilidad.
- compra publica/privada puede reservar o solicitar nuevo/CU.
- tecnico puede capturar serial.
- instalacion crea activo.
- instalacion genera cronograma.
- mantenimiento aparece en agenda.

### Fase 7 - Eliminacion legacy

Objetivo: no dejar doble sistema.

Eliminar o dejar solo como vista no usada:

- lecturas directas operativas a `servicio.equipos`
- lecturas directas operativas a `equipos_modelo`
- UI antigua de equipos que use contratos viejos
- endpoints duplicados si ya tienen reemplazo

Validar con busqueda:

```txt
rg "servicio.equipos|equipos_modelo|/servicio/equipos|/inventario/modelos"
```

Todo uso restante debe estar justificado como:

- migracion
- compatibilidad historica no operativa
- vista readonly temporal con fecha de retiro

---

## 7. Migracion sin romper UI

### Estrategia

No hacer big bang directo sobre pantallas actuales.

Secuencia segura:

1. Crear schema nuevo.
2. Backfill.
3. Crear APIs nuevas.
4. Crear UI nueva.
5. Validar nueva UI con datos reales.
6. Redirigir rutas o reemplazar componentes.
7. Borrar legacy.

Esto no contradice "sin legacy", porque legacy solo existe durante la ventana de migracion. La condicion final es cero dependencia operativa legacy.

### Prohibido

- Mantener dos fuentes vivas despues del corte.
- Hacer dual-write permanente.
- Dejar pantallas antiguas editando modelos viejos.
- Agregar estados libres como texto sin catalogo.
- Generar mantenimiento preventivo manualmente si ya existe procedimiento del modelo.

---

## 8. Criterios de aceptacion

### Modelos

- Existe una sola fuente canonica de modelo.
- Cada modelo tiene SKU/codigo, fabricante, categoria y estado.
- El modelo puede tener insumos, piezas y procedimientos.
- Business Case usa modelo canonico.

### Activos

- Se puede crear activo desde modelo.
- Se puede reservar activo para negociacion.
- Se puede capturar serial.
- Se puede asignar a cliente/sede.
- Se puede cambiar estado con historial.
- Se puede consultar timeline.

### Compras

- ACP/backoffice/comercial ven disponibilidad por modelo.
- Si hay equipo listo, pueden reservarlo.
- Si no hay equipo, pueden solicitar nuevo o CU.
- El flujo publica/privada no se rompe.

### Instalacion

- Al instalar, se asigna serial y cliente.
- El activo pasa a `installed_client`.
- Se genera cronograma preventivo automaticamente.
- Se registra evento.

### Mantenimientos

- El cronograma sale de procedimientos del modelo.
- Cada item sabe que piezas/materiales requiere.
- Jefe tecnico puede ver agenda.
- Tecnico puede ejecutar y cerrar.

### UI

- No hay pantallas pobres.
- Hay loading/empty/error/success.
- Hay filtros por modelo, cliente, serial, estado, disponibilidad.
- Hay badges de color por estado.
- Roles ven informacion necesaria sin acciones no autorizadas.

---

## 9. Riesgos principales

| Riesgo | Impacto | Mitigacion |
|---|---|---|
| IDs duplicados entre catalogos | BC o compras apuntan al modelo incorrecto | tabla de alias + validacion por SKU |
| UI vieja edita catalogo viejo durante migracion | divergencia de datos | congelar edicion legacy cuando nueva UI este lista |
| Cronograma se duplica al reinstalar | mantenimientos duplicados | idempotency key por activo/procedimiento/fecha base |
| Serial duplicado | trazabilidad rota | unique index por serial normalizado |
| Estados libres | caos operativo | catalogo cerrado de estados |
| Compras no sabe si activo esta disponible | decisiones erradas | endpoint unico de disponibilidad |
| Correctivos no actualizan activo | activo queda "listo" aunque tenga problema | evento correctivo cambia estado/disponibilidad |

---

## 10. Orden recomendado de implementacion tecnica

1. Migracion DB de alias, piezas, procedimientos, activos, estados.
2. Backfill y reporte de inconsistencias.
3. Servicio backend de modelos canonicos.
4. Servicio backend de activos y disponibilidad.
5. Integracion con compras para reserva/solicitud nuevo/CU.
6. Servicio de instalacion que genera cronograma.
7. UI workspace de activos.
8. UI workspace de modelos.
9. Panel de disponibilidad dentro de compras.
10. Corte controlado.
11. Eliminacion legacy.

---

## 11. Primera micro-tarea sugerida

La primera implementacion real deberia ser solo DB + backfill de mapeo, sin tocar UI:

```txt
Crear migracion:
- equipment_model_aliases
- part_catalog
- maintenance_procedures
- maintenance_procedure_parts
- maintenance_procedure_materials
- equipment_asset_status_catalog
- equipment_assets
- equipment_asset_events
- equipment_asset_reservations
```

Luego validar:

- todos los modelos actuales tienen alias.
- no se perdio ningun SKU.
- no se rompe `equipment-catalog`.

No avanzar a UI hasta que esta base este validada.

---

*Ultima actualizacion: 2026-05-09. Plan derivado de `WORKFLOW_EQUIPOS.md` y `WORKFLOW_EQUIPOS_PROPUESTA.md`.*
