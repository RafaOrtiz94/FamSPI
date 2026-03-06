# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Inventario

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Inventario del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Inventario para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Inventario.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Servicios/integraciones externas del modulo
- Usuario autenticado del proceso interno

## 5. Descripcion general del modulo
El modulo Inventario se implementa principalmente en backend/src/modules/inventario y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: GET /.
- Operacion API detectada: GET /equipos-cliente/:cliente_id.
- Operacion API detectada: GET /equipos-disponibles.
- Operacion API detectada: GET /modelos.
- Operacion API detectada: POST /equipos-unidad.
- Operacion API detectada: POST /equipos-unidad/:id/asignar.
- Operacion API detectada: POST /equipos-unidad/:id/cambiar-estado.
- Operacion API detectada: POST /equipos-unidad/:id/serial.
- Operacion API detectada: POST /movimiento.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: public.equipos_historial, public.equipos_modelo, public.equipos_unidad, public.inventory_movements, public.v_inventario_completo.

### Endpoints de API detectados
- GET /
- GET /equipos-cliente/:cliente_id
- GET /equipos-disponibles
- GET /modelos
- POST /equipos-unidad
- POST /equipos-unidad/:id/asignar
- POST /equipos-unidad/:id/cambiar-estado
- POST /equipos-unidad/:id/serial
- POST /movimiento

### Componentes del sistema
- backend\src\modules\inventario\inventario.controller.js
- backend\src\modules\inventario\inventario.routes.js
- backend\src\modules\inventario\inventario.service.js

### Componentes frontend relacionados
- spi_front\src\core\api\inventarioApi.js

### Tablas/entidades de datos detectadas
- public.equipos_historial
- public.equipos_modelo
- public.equipos_unidad
- public.inventory_movements
- public.v_inventario_completo

## 7. Requerimientos funcionales de alto nivel
- REQ-INVE-001: El sistema debe permitir consultar y listar informacion operativa del modulo Inventario segun los permisos del actor.
- REQ-INVE-002: El sistema debe permitir registrar nuevas operaciones/transacciones del modulo Inventario con validaciones de entrada.
- REQ-INVE-003: El sistema debe interoperar con integraciones externas del modulo Inventario: Eventos en tiempo real.
- REQ-INVE-004: [Funcionalidad detectada en el sistema] El modulo Inventario incluye logica interna adicional en servicios/controladores no expuesta completamente por contratos funcionales formales.
- REQ-INVE-005: El sistema debe garantizar ejecucion consistente de la logica de negocio del modulo Inventario en escenarios nominales y de error.

## 8. Requerimientos no funcionales
- RNF-INVE-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-INVE-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-INVE-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-INVE-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-INVE-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-INVE-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-INVE-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-INVE-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-INVE-001: Las operaciones del modulo deben ejecutarse solo por actores autenticados con permisos efectivos del contexto.
- RN-INVE-002: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-INVE-003: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-INVE-004: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- El modulo opera con acoplamiento interno minimo; no se detectaron dependencias directas explicitas hacia otros modulos de negocio.
- Integraciones externas detectadas: Eventos en tiempo real.

