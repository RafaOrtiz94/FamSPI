# DOCUMENTO DE DISENO DEL SISTEMA (DS)

## Nombre del modulo
Comercial y Gestion de Clientes

## Arquitectura del modulo
- Capa de presentacion: frontend React o consumidores internos del SPI.
- Capa API: rutas Express bajo prefijos del backend.
- Capa de negocio: controladores y servicios del modulo.
- Capa de persistencia: consultas SQL directas y tablas asociadas.
- Capa transversal: autenticacion, autorizacion, auditoria y notificaciones cuando aplica.

## Componentes del sistema
### Controladores
- `backend/src/modules/requests/requests.controller.js`
- `backend/src/modules/clients/clients.controller.js`
- `backend/src/modules/equipment-purchases/equipmentPurchases.controller.js`
- `backend/src/modules/private-purchases/privatePurchases.controller.js`
- `backend/src/modules/schedules/schedules.controller.js`

### Servicios
- `backend/src/modules/requests/requests.service.js`
- `backend/src/modules/requests/purchaseRequestsFacade.js`
- `backend/src/modules/clients/clients.service.js`
- `backend/src/modules/equipment-purchases/equipmentPurchases.service.js`
- `backend/src/modules/private-purchases/privatePurchases.service.js`
- `backend/src/modules/private-purchases/privatePurchaseStateMachine.js`
- `backend/src/modules/schedules/schedules.service.js`

### Modelos
- Sin ORM; persistencia SQL directa y reglas de flujo en servicios.

### Rutas
- `backend/src/modules/requests/requests.routes.js`
- `backend/src/modules/clients/clients.routes.js`
- `backend/src/modules/equipment-purchases/equipmentPurchases.routes.js`
- `backend/src/modules/private-purchases/privatePurchases.routes.js`
- `backend/src/modules/schedules/schedules.routes.js`

### Componentes de interfaz
- `spi_front/src/modules/comercial/pages/Requests.jsx`
- `spi_front/src/modules/comercial/pages/Clientes.jsx`
- `spi_front/src/modules/comercial/pages/NewClientRequest.jsx`
- `spi_front/src/modules/comercial/pages/EquipmentPurchases.jsx`
- `spi_front/src/modules/comercial/pages/PlanificacionMensual.jsx`
- `spi_front/src/modules/comercial/pages/AprobacionCronogramas.jsx`
- `spi_front/src/modules/backoffice/pages/PrivatePurchases.jsx`
- `spi_front/src/core/api/requestsApi.js`
- `spi_front/src/core/api/clientsApi.js`
- `spi_front/src/core/api/equipmentPurchasesApi.js`
- `spi_front/src/core/api/privatePurchasesApi.js`
- `spi_front/src/core/api/schedulesApi.js`

## Modelo de datos asociado
- `requests`
- `request_types`
- `request_versions`
- `request_attachments`
- `request_approvals`
- `request_status_history`
- `client_requests`
- `client_request_consent_tokens`
- `client_request_consents`
- `client_request_quality_checks`
- `clients`
- `client_assignments`
- `client_visit_logs`
- `prospect_visits`
- `equipment_purchase_requests`
- `equipment_purchase_provider_contacts`
- `private_purchase_requests`
- `private_purchase_state_transitions`
- `purchase_delivery_schedules`
- `visit_schedules`
- `scheduled_visits`

## Interfaces API
### Solicitudes y nuevo cliente
- `POST /api/v1/requests`
- `GET /api/v1/requests`
- `GET /api/v1/requests/:id`
- `PUT /api/v1/requests/:id/resubmit`
- `POST /api/v1/requests/:id/cancel`
- `GET /api/v1/requests/public/consent/:token`
- `POST /api/v1/requests/new-client/consent-token`
- `POST /api/v1/requests/new-client/consent-token/verify`
- `POST /api/v1/requests/new-client`
- `GET /api/v1/requests/new-client/my`
- `GET /api/v1/requests/new-client`
- `GET /api/v1/requests/new-client/summary`
- `GET /api/v1/requests/new-client/:id`
- `PUT /api/v1/requests/new-client/:id/quality-checklist`
- `PUT /api/v1/requests/new-client/:id/process`
- `PUT /api/v1/requests/new-client/:id`

### Clientes
- `GET /api/v1/clients`
- `GET /api/v1/clients/:id`
- `PUT /api/v1/clients/:id`
- `POST /api/v1/clients/:id/assign`
- `POST /api/v1/clients/:id/visit-status`
- `POST /api/v1/clients/prospect-visit`

### Compras publicas
- `GET /api/v1/equipment-purchases/events`
- `GET /api/v1/equipment-purchases/meta`
- `GET /api/v1/equipment-purchases/stats`
- `GET /api/v1/equipment-purchases`
- `GET /api/v1/equipment-purchases/:id`
- `POST /api/v1/equipment-purchases`
- `POST /api/v1/equipment-purchases/:id/start-availability`
- `POST /api/v1/equipment-purchases/:id/request-proforma`
- `POST /api/v1/equipment-purchases/:id/upload-contract`
- `POST /api/v1/equipment-purchases/:id/request-delivery-dates`
- `POST /api/v1/equipment-purchases/:id/complete-delivery`

### Compras privadas
- `GET /api/v1/private-purchases/events`
- `GET /api/v1/private-purchases`
- `GET /api/v1/private-purchases/:id`
- `POST /api/v1/private-purchases`
- `POST /api/v1/private-purchases/:id/transition`
- `GET /api/v1/private-purchases/:id/transitions`
- `POST /api/v1/private-purchases/:id/start-business-case`
- `POST /api/v1/private-purchases/:id/request-client-registration`
- `POST /api/v1/private-purchases/:id/complete-delivery`
- `GET /api/v1/private-purchases/:id/timeline`

### Cronogramas comerciales
- `GET /api/v1/schedules`
- `GET /api/v1/schedules/pending-approval`
- `GET /api/v1/schedules/team`
- `GET /api/v1/schedules/analytics`
- `GET /api/v1/schedules/approved/current`
- `GET /api/v1/schedules/:id`
- `POST /api/v1/schedules`
- `PUT /api/v1/schedules/:id`
- `DELETE /api/v1/schedules/:id`
- `POST /api/v1/schedules/:id/submit`
- `POST /api/v1/schedules/:id/visits`
- `PUT /api/v1/schedules/:id/visits/:visitId`
- `DELETE /api/v1/schedules/:id/visits/:visitId`
- `POST /api/v1/schedules/:id/approve`
- `POST /api/v1/schedules/:id/reject`

## Dependencias tecnicas
- Autenticacion y Sesiones.
- Usuarios y Perfiles.
- Inventario y Equipos.
- Documentos/Archivos/Firma.
- Notificaciones y Comunicaciones.
- Business Case Comercial.
- Servicio Tecnico y Mantenimientos.

## Controles de seguridad y operacion
### Control de acceso
- JWT obligatorio en rutas privadas.
- `requireRole` explicito en operaciones sensibles de clientes, cronogramas y compras publicas.

### Autenticacion
- Acceso autenticado para todo endpoint no publico.
- Unico endpoint publico del modulo: consentimiento por token.

### Autorizacion
- Reglas por rol comercial, jefaturas, backoffice, gerencia y actores tecnicos.
- Transiciones de compras privadas condicionadas por estado + rol.

### Registro de auditoria
- Registro de acciones en solicitudes y clientes (`logAction`).
- Timeline de eventos para compras privadas/publicas.

### Proteccion de datos
- Validaciones de payload y archivos con `multer`.
- Evidencias en Drive con trazabilidad documental.

## Riesgos tecnicos detectados
- Alta complejidad del workflow comercial (riesgo de desalineacion de estado).
- Coexistencia de flujos legacy y V2 en fachada de solicitudes/compras.
- Endpoints de compras privadas sin `requireRole` uniforme en ruta (control desplazado a capa servicio/state machine).
- Dependencia de integraciones Drive/Gmail para continuidad de proceso.

## Diagrama tecnico
`mermaid
flowchart LR
  UI[Frontend o consumidor] --> API[API COM]
  API --> CTRL[Controladores]
  CTRL --> SVC[Servicios]
  SVC --> DB[(Base de datos)]
  SVC --> EXT[Dependencias externas o modulos transversales]
`
