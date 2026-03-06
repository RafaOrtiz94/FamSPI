# INFORME DE VALIDACION DEL MODULO

## Nombre del modulo
Comercial y Gestion de Clientes

## Descripcion del modulo
Gestiona el ciclo comercial interno: solicitudes corporativas, alta y seguimiento de nuevos clientes, compras publicas/privadas asociadas al proceso comercial y planificacion mensual de visitas.

## Alcance funcional
- Solicitudes generales por rol comercial.
- Flujo de nuevo cliente con consentimiento y checklist.
- Gestion de cartera de clientes, asignaciones y visitas.
- Compras publicas de equipos y su flujo de entrega.
- Compras privadas con transiciones de estado y timeline.
- Cronogramas mensuales de visitas y aprobaciones gerenciales.

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

## Endpoints de API
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

## Tablas de base de datos asociadas
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

## Dependencias con otros modulos
- Autenticacion y Sesiones.
- Usuarios y Perfiles.
- Inventario y Equipos.
- Documentos/Archivos/Firma.
- Notificaciones y Comunicaciones.
- Business Case Comercial.
- Servicio Tecnico y Mantenimientos.

## Controles de seguridad
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

## Riesgos operativos
- Alta complejidad del workflow comercial (riesgo de desalineacion de estado).
- Coexistencia de flujos legacy y V2 en fachada de solicitudes/compras.
- Endpoints de compras privadas sin `requireRole` uniforme en ruta (control desplazado a capa servicio/state machine).
- Dependencia de integraciones Drive/Gmail para continuidad de proceso.

## Posibles escenarios de falla
- Transicion concurrente sobre la misma compra (estado obsoleto).
- Falla al subir contrato/proforma durante cambio de estado.
- Rechazo de registro de cliente en etapa avanzada de compra privada.
- Cronograma aprobado sin visitas completas o con datos inconsistentes.

## Nivel de criticidad
CRITICO

## Prioridad de validacion
MUY ALTA

---

## BASE DOCUMENTAL PARA VALIDACION

## Requerimientos del usuario (URS)
- `URS-COM-001`: El sistema debe permitir crear y gestionar solicitudes comerciales por rol.
- `URS-COM-002`: El sistema debe permitir registrar, revisar y aprobar solicitudes de nuevo cliente.
- `URS-COM-003`: El sistema debe permitir administrar clientes, asignaciones y visitas de seguimiento.
- `URS-COM-004`: El sistema debe permitir ejecutar flujos de compras publicas y privadas con trazabilidad.
- `URS-COM-005`: El sistema debe permitir planificar y aprobar cronogramas comerciales mensuales.

## Requerimientos funcionales
- `RF-COM-001`: Persistir solicitudes y versionamiento en tablas de request.
- `RF-COM-002`: Gestionar consentimiento, checklist y procesamiento de nuevos clientes.
- `RF-COM-003`: Aplicar reglas de acceso por rol en clientes, compras y cronogramas.
- `RF-COM-004`: Registrar transiciones de compra, evidencias y documentos asociados.
- `RF-COM-005`: Exponer metricas y listados para operacion comercial diaria.

## Resumen del diseno tecnico
- Arquitectura REST modular (`requests`, `clients`, `equipment-purchases`, `private-purchases`, `schedules`).
- Persistencia SQL directa con state machine en compras privadas.
- Frontend React por vistas comerciales y workspace de compras.
- Eventos SSE en compras para actualizacion en tiempo real.

## Escenarios de prueba
### Funcionalidad
- Caso: Crear solicitud de nuevo cliente con anexos.
- Resultado esperado: Registro completo en `client_requests` + documentos + estado inicial.

### Seguridad
- Caso: Usuario fuera de rol intenta aprobar cronograma.
- Resultado esperado: `403` sin cambios en `visit_schedules`.

### Manejo de errores
- Caso: Intentar transicion invalida en compra privada.
- Resultado esperado: Error de negocio y estado inalterado.

### Integridad de datos
- Caso: Completar entrega de compra publica.
- Resultado esperado: Estado final consistente + trazabilidad + evidencia documental.

---

## MATRIZ DE TRAZABILIDAD

| Requerimiento | Componente | Prueba |
|---|---|---|
| REQ-COM-001 Solicitudes comerciales | `requests.service.createRequest` | Crear solicitud y validar `requests` + `request_versions` |
| REQ-COM-002 Nuevo cliente | `requests.service.createClientRequest` | Ejecutar flujo token/consentimiento/checklist/proceso |
| REQ-COM-003 Gestion de clientes | `clients.service.updateClient` y `assignClient` | Actualizar cliente y validar asignacion/visitas |
| REQ-COM-004 Compras por workflow | `equipmentPurchases.service` y `privatePurchaseStateMachine` | Avanzar etapas permitidas y rechazar no permitidas |
| REQ-COM-005 Cronogramas | `schedules.service` | Crear, enviar, aprobar y auditar cambios del plan mensual |
