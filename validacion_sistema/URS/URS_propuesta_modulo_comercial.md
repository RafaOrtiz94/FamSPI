# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Comercial

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Comercial del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Comercial para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Comercial.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Usuario autenticado del proceso interno

## 5. Descripcion general del modulo
El modulo Comercial se implementa principalmente en backend/src/modules/comercial y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- No se detectaron endpoints HTTP directos; el modulo opera principalmente como componente interno de soporte.
- [Funcionalidad detectada en el sistema] La logica principal se ejecuta sin persistencia SQL explicita dentro del modulo, actuando como orquestador/integrador.

### Endpoints de API detectados
- No se detectaron endpoints directos del modulo (componente de soporte interno).

### Componentes del sistema
- No se detectaron componentes de codigo estructurados en el modulo.

### Componentes frontend relacionados
- spi_front\src\modules\comercial\api\privatePurchasesApi.js
- spi_front\src\modules\comercial\components\ACPClientRequestsWidget.jsx
- spi_front\src\modules\comercial\components\ACPClientSummaryWidget.jsx
- spi_front\src\modules\comercial\components\ActionCreateCard.jsx
- spi_front\src\modules\comercial\components\BackofficeClientRequestsKpiWidget.jsx
- spi_front\src\modules\comercial\components\BusinessCasePicker.jsx
- spi_front\src\modules\comercial\components\ClientManagementActionCard.jsx
- spi_front\src\modules\comercial\components\ClientRequestManagement.jsx
- spi_front\src\modules\comercial\components\CreateRequestModal.jsx
- spi_front\src\modules\comercial\components\dashboard\ACPComercialView.jsx
- spi_front\src\modules\comercial\components\dashboard\BackofficeView.jsx
- spi_front\src\modules\comercial\components\dashboard\ComercialView.jsx

### Tablas/entidades de datos detectadas
- No se detectaron tablas SQL explicitas dentro del modulo.

## 7. Requerimientos funcionales de alto nivel
- REQ-COME-001: [Funcionalidad detectada en el sistema] El modulo Comercial incluye logica interna adicional en servicios/controladores no expuesta completamente por contratos funcionales formales.
- REQ-COME-002: El sistema debe garantizar ejecucion consistente de la logica de negocio del modulo Comercial en escenarios nominales y de error.

## 8. Requerimientos no funcionales
- RNF-COME-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-COME-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-COME-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-COME-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-COME-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-COME-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-COME-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-COME-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-COME-001: Las operaciones del modulo deben ejecutarse solo por actores autenticados con permisos efectivos del contexto.
- RN-COME-002: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- El modulo opera con acoplamiento interno minimo; no se detectaron dependencias directas explicitas hacia otros modulos de negocio.

