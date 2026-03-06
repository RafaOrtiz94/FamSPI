# INFORME DE VALIDACION DEL MODULO

## Nombre del modulo
Solicitudes Internas y Flujos de Compra

## Descripcion del modulo
Orquesta los flujos internos de solicitudes corporativas y compras tecnicas (publicas y privadas), incluyendo alta, validaciones, aprobaciones por rol, gestion documental, transiciones de estado y seguimiento operativo.

## Alcance funcional
- Solicitudes internas generales (`requests`).
- Flujo de nuevo cliente (consentimiento, revision, aprobacion/rechazo).
- Compras publicas de equipos (`equipment-purchases`).
- Compras privadas con maquina de estados (`private-purchases`).
- Registro de adjuntos, documentos y evidencia de proceso.

## Componentes del sistema
### Controladores
- `backend/src/modules/requests/requests.controller.js`
- `backend/src/modules/equipment-purchases/equipmentPurchases.controller.js`
- `backend/src/modules/private-purchases/privatePurchases.controller.js`

### Servicios
- `backend/src/modules/requests/requests.service.js`
- `backend/src/modules/requests/purchaseRequestsFacade.js`
- `backend/src/modules/equipment-purchases/equipmentPurchases.service.js`
- `backend/src/modules/private-purchases/privatePurchases.service.js`
- `backend/src/modules/private-purchases/privatePurchaseStateMachine.js`

### Modelos
- Sin ORM; SQL directo + reglas de estado por codigo.

### Rutas
- `backend/src/modules/requests/requests.routes.js`
- `backend/src/modules/equipment-purchases/equipmentPurchases.routes.js`
- `backend/src/modules/private-purchases/privatePurchases.routes.js`

### Componentes de interfaz
- `spi_front/src/core/api/requestsApi.js`
- `spi_front/src/core/api/equipmentPurchasesApi.js`
- `spi_front/src/core/api/privatePurchasesApi.js`
- `spi_front/src/modules/shared/purchases-workspace/PurchasesWorkspace.jsx`
- `spi_front/src/modules/comercial/pages/EquipmentPurchases.jsx`
- `spi_front/src/modules/backoffice/pages/PrivatePurchases.jsx`
- `spi_front/src/modules/comercial/pages/NewClientRequest.jsx`

## Endpoints de API
### Solicitudes generales
- `POST /api/v1/requests`
- `GET /api/v1/requests`
- `GET /api/v1/requests/:id`
- `PUT /api/v1/requests/:id/resubmit`
- `POST /api/v1/requests/:id/cancel`

### Nuevo cliente
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

### Compras publicas
- `GET /api/v1/equipment-purchases/events`
- `GET /api/v1/equipment-purchases/meta`
- `GET /api/v1/equipment-purchases/provider-contacts`
- `GET /api/v1/equipment-purchases/stats`
- `GET /api/v1/equipment-purchases/technical-schedule`
- `GET /api/v1/equipment-purchases`
- `GET /api/v1/equipment-purchases/:id`
- `POST /api/v1/equipment-purchases`
- Endpoints de workflow confirmados en rutas:
- `POST /api/v1/equipment-purchases/provider-contacts`
- `POST /api/v1/equipment-purchases/:id/start-availability`
- `POST /api/v1/equipment-purchases/:id/provider-response`
- `PATCH /api/v1/equipment-purchases/:id/public-portal-outcome`
- `PATCH /api/v1/equipment-purchases/:id/checklist`
- `POST /api/v1/equipment-purchases/:id/request-proforma`
- `POST /api/v1/equipment-purchases/:id/upload-proforma`
- `POST /api/v1/equipment-purchases/:id/reserve`
- `POST /api/v1/equipment-purchases/:id/upload-signed-proforma`
- `POST /api/v1/equipment-purchases/:id/upload-contract`
- `POST /api/v1/equipment-purchases/:id/request-delivery-dates`
- `POST /api/v1/equipment-purchases/:id/submit-delivery-dates`
- `POST /api/v1/equipment-purchases/:id/mark-equipment-arrived`
- `POST /api/v1/equipment-purchases/:id/mark-dispatch-ready`
- `POST /api/v1/equipment-purchases/:id/complete-delivery`
- `POST /api/v1/equipment-purchases/:id/renew-reservation`
- `POST /api/v1/equipment-purchases/:id/cancel-order`
- `POST /api/v1/equipment-purchases/:id/submit-signed-proforma-with-inspection`
- `POST /api/v1/equipment-purchases/:id/request-inspection`
- `PATCH /api/v1/equipment-purchases/:id/coordinate-inspection-date`
- `PATCH /api/v1/equipment-purchases/:id/review-inspection-date`
- `PATCH /api/v1/equipment-purchases/:id/site-inspection`

### Compras privadas
- `GET /api/v1/private-purchases/events`
- `GET /api/v1/private-purchases`
- `GET /api/v1/private-purchases/mine`
- `GET /api/v1/private-purchases/by-role/:role`
- `GET /api/v1/private-purchases/:id`
- `POST /api/v1/private-purchases`
- Endpoints de workflow confirmados en rutas:
- `POST /api/v1/private-purchases/:id/transition`
- `GET /api/v1/private-purchases/:id/transitions`
- `POST /api/v1/private-purchases/:id/validate-transition`
- `POST /api/v1/private-purchases/:id/offer`
- `POST /api/v1/private-purchases/:id/offer/signed`
- `POST /api/v1/private-purchases/:id/send-to-acp`
- `POST /api/v1/private-purchases/:id/start-availability`
- `POST /api/v1/private-purchases/:id/start-business-case`
- `POST /api/v1/private-purchases/:id/provider-response`
- `POST /api/v1/private-purchases/:id/submit-contract`
- `POST /api/v1/private-purchases/:id/contract/client-signed`
- `POST /api/v1/private-purchases/:id/inspection-request`
- `PATCH /api/v1/private-purchases/:id/coordinate-inspection-date`
- `PATCH /api/v1/private-purchases/:id/review-inspection-date`
- `POST /api/v1/private-purchases/:id/delivery-guides`
- `POST /api/v1/private-purchases/:id/request-delivery-dates`
- `POST /api/v1/private-purchases/:id/submit-delivery-dates`
- `GET /api/v1/private-purchases/:id/documents`
- `POST /api/v1/private-purchases/:id/request-client-registration`
- `POST /api/v1/private-purchases/:id/register-client`
- `GET /api/v1/private-purchases/:id/check-client-approval`
- `PUT /api/v1/private-purchases/:id/client-registration`
- `PUT /api/v1/private-purchases/:id/delivery-dates`
- `POST /api/v1/private-purchases/:id/ready-for-delivery`
- `POST /api/v1/private-purchases/:id/complete-delivery`
- `POST /api/v1/private-purchases/:id/cancel`
- `POST /api/v1/private-purchases/:id/operations-details`
- `POST /api/v1/private-purchases/:id/mark-equipment-arrived`
- `POST /api/v1/private-purchases/:id/delivery-act`
- `POST /api/v1/private-purchases/:id/delivery-act/assign`
- `POST /api/v1/private-purchases/:id/delivery-act/finalize`
- `POST /api/v1/private-purchases/:id/dispatch-details`
- `GET /api/v1/private-purchases/stats/:role`
- `GET /api/v1/private-purchases/:id/timeline`

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
- `equipment_purchase_requests`
- `equipment_purchase_provider_contacts`
- `private_purchase_requests`
- `purchase_delivery_schedules`
- `purchase_corrections`

## Dependencias con otros modulos
- Clientes (aprobacion/registro de cliente).
- Inventario (captura serial, cambios de estado, asignaciones).
- Documentos/Archivos (evidencias y plantillas).
- Notificaciones (correo/chat y notificacion interna).
- Business Case (gating de factibilidad en flujos de compra).
- Servicio Tecnico/Operaciones/Logistica (aprobaciones y coordinacion).

## Controles de seguridad
### Control de acceso
- JWT obligatorio en todos los submodulos.
- `equipment-purchases` aplica `requireRole` de forma explicita por endpoint.
- `requests` aplica `requireRole` en operaciones sensibles y lectura por perfiles autorizados.
- `private-purchases` combina control de autenticacion de ruta con validaciones de rol/estado en controlador y state machine.

### Autenticacion
- Usuario autenticado requerido para acciones privadas.

### Autorizacion
- Reglas por rol y estado de workflow.
- Validaciones de transicion en maquina de estados.

### Registro de auditoria
- `logAction` en operaciones de solicitudes y cliente.
- Timeline de compras privadas/publicas.

### Proteccion de datos
- Validaciones AJV/Joi en payloads clave.
- Manejo de adjuntos con `multer` y persistencia en Drive.

## Riesgos operativos
- Alta complejidad de estados incrementa riesgo de transiciones invalidas.
- Modo mixto legacy/V2 en `purchaseRequestsFacade` puede producir inconsistencias de fuente de verdad.
- Dependencia de integraciones Google (Drive/Gmail/Calendar) puede bloquear pasos criticos.
- En `private-purchases` existen endpoints sin `requireRole` explicito en ruta, trasladando control al servicio/estado (riesgo de configuracion inconsistente).

## Posibles escenarios de falla
- Solicitud en estado obsoleto (stale state) al intentar accion concurrente.
- Falla en subida de contrato/proforma durante transicion.
- Cliente no aprobado al intentar avanzar compra privada.

## Nivel de criticidad
CRITICO

## Prioridad de validacion
MUY ALTA

---

## BASE DOCUMENTAL PARA VALIDACION

## Requerimientos del usuario (URS)
- `URS-PED-001`: Crear y seguir solicitudes internas de punta a punta.
- `URS-PED-002`: Gestionar aprobaciones por rol y estado.
- `URS-PED-003`: Adjuntar documentos y trazabilidad de expediente.
- `URS-PED-004`: Coordinar inspecciones, disponibilidad y entregas.
- `URS-PED-005`: Mantener integridad del flujo sin saltos de estado.

## Requerimientos funcionales
- `RF-PED-001`: Persistir solicitudes con versionamiento.
- `RF-PED-002`: Soportar flujo de consentimiento LOPDP para nuevos clientes.
- `RF-PED-003`: Restringir acciones por rol en cada etapa.
- `RF-PED-004`: Registrar transiciones y evidencia documental.
- `RF-PED-005`: Integrar notificaciones y tareas asincronas por eventos de flujo.

## Resumen del diseño tecnico
- Orquestacion REST por modulos (`requests`, `equipment-purchases`, `private-purchases`).
- Persistencia SQL directa y contratos de estado en codigo.
- Frontend con workspace unificado de compras y tabs por rol.
- Eventos SSE para actualizacion en tiempo real de vistas de compras.

## Escenarios de prueba
### Funcionalidad
- Caso: Creacion de solicitud de nuevo cliente con anexos.
- Resultado esperado: registro en `client_requests` con estado inicial y enlaces de evidencia.

### Seguridad
- Caso: Usuario fuera de rol intenta `upload-contract`.
- Resultado esperado: `403` y sin cambio de estado.

### Manejo de errores
- Caso: transicion no valida en compra privada.
- Resultado esperado: error de negocio y estado inalterado.

### Integridad de datos
- Caso: completar entrega de compra publica.
- Resultado esperado: estado final consistente + timeline + documentos asociados.

---

## MATRIZ DE TRAZABILIDAD

| Requerimiento | Componente | Prueba |
|---|---|---|
| REQ-PED-001 Solicitudes versionadas | `requests.service.createRequest` | Crear solicitud y verificar `request_versions` |
| REQ-PED-002 Consentimiento cliente | `requests.service.sendConsentEmailToken` + `grantConsent` | Flujo token->validacion->consentimiento |
| REQ-PED-003 Control por rol | `*.routes.js` + `requireRole` | Ejecutar acciones con rol permitido/denegado |
| REQ-PED-004 Workflow de compra publica | `equipmentPurchases.service` | Avanzar por etapas proforma->contrato->entrega |
| REQ-PED-005 Workflow de compra privada | `privatePurchaseStateMachine` | Validar transiciones y rechazo de salto de estado |
