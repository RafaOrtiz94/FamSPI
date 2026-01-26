Flujo de compras privadas (tecnico)

Alcance
- Describe como funciona hoy el flujo de compras privadas en front-end y back-end, con foco en PrivatePurchases.jsx y servicios conectados.
- Incluye los roles habilitados y los puntos de integracion.

Puntos de entrada en front-end y ruteo por rol
- Workspace de compras y gating por tabs:
  - Archivo: `spi_front/src/modules/shared/purchases-workspace/PurchasesWorkspace.jsx`
  - El tab de compras privadas se muestra para roles: jefe_operaciones, jefe_logistica, backoffice_comercial, gerencia, comercial, jefe_comercial, acp_comercial.
- Ruteo del tab privado por rol:
  - Archivo: `spi_front/src/modules/shared/purchases-workspace/tabs/PrivatePurchasesTab.jsx`
  - Si user.roles incluye `jefe_operaciones` -> `OperacionesPrivatePurchases`.
  - Si no, y user.roles incluye `jefe_logistica` -> `LogisticaPrivatePurchases`.
  - Caso contrario -> `PrivatePurchasesPage` (backoffice/comercial/gerencia/acp).

Comportamiento principal en Backoffice (PrivatePurchases.jsx)
- Archivo: `spi_front/src/modules/backoffice/pages/PrivatePurchases.jsx`
- Logica de deteccion de rol:
  - role viene de `useAuth()` y se normaliza a minusculas.
  - isBackofficeUser: role contiene "backoffice".
  - isAcpUser: role contiene "acp_comercial".
  - isManagerUser: role contiene "gerencia" o "jefe_comercial".
  - isPureCommercial: no es backoffice/manager/acp y role o scope empieza con "comercial".
  - canManageRequests = backoffice O manager O acp.
  - canViewRequests = canManageRequests O comercial puro.
- Carga de datos:
  - Usa `listPrivatePurchases` de `spi_front/src/core/api/privatePurchasesApi.js`.
  - Filtra por estado si se selecciona; la busqueda es local via `filterPrivatePurchaseRequests`.
- Acciones y handlers:
  - Enviar oferta -> `sendPrivatePurchaseOffer(id, { offer_base64, file_name, folder_path })`.
  - Subir oferta firmada -> `uploadPrivateSignedOffer(id, { signed_offer_base64, file_name })`.
  - Registrar cliente -> `registerPrivateClient(id)`.
  - Enviar a ACP -> `forwardPrivatePurchaseToAcp(id)` (tambien usado para "reenviar a gerencia" con payload `to_state`).
  - Rechazo de gerencia -> `uploadPrivateSignedOffer(id, { decision: "reject" })`.
  - Manejo de errores incluye `DOC_ALREADY_EXISTS` y `DOCS_INCOMPLETE_FOR_GERENCIA`.
- Superficie de acciones (logica de botones):
  - Archivo: `spi_front/src/modules/backoffice/pages/PrivatePurchaseActions.jsx`.
  - Acciones Backoffice:
    - pending_backoffice o rejected -> enviar oferta.
    - offer_sent o pending_manager_signature -> subir firmada.
    - offer_signed -> registrar cliente.
    - client_registered -> enviar a ACP.
    - contract_rejected -> reenviar a gerencia.
  - Acciones Gerencia:
    - pending_manager_signature o pending_client_signature -> aprobar (subir firmada) y rechazar.
  - Acciones Comercial puro:
    - pending_client_signature -> subir firma del cliente.

Vistas de Operaciones y Logistica
- Operaciones:
  - Archivo: `spi_front/src/modules/operaciones/pages/OperacionesPrivatePurchases.jsx`
  - Usa `privatePurchasesApi` de `spi_front/src/modules/comercial/api/privatePurchasesApi.js`.
  - Llama `getList`, `getDetail`, `getTimeline`, `requestDeliveryDates`.
- Logistica:
  - Archivo: `spi_front/src/modules/logistica/pages/LogisticaPrivatePurchases.jsx`
  - Usa `privatePurchasesApi` de `spi_front/src/modules/comercial/api/privatePurchasesApi.js`.
  - Llama `listPrivatePurchases`, `getPrivatePurchase`, `getTimeline`, `markDispatchReady`, `generateDeliveryAct`.

Clientes API en front-end (dos variantes)
- Cliente core:
  - Archivo: `spi_front/src/core/api/privatePurchasesApi.js`
  - Endpoints base: `/private-purchases` y helpers para transiciones, registro de cliente, fechas de entrega, etc.
- Cliente del modulo comercial:
  - Archivo: `spi_front/src/modules/comercial/api/privatePurchasesApi.js`
  - Usa endpoints personalizados como `/manager-decision`, `/submit-contract`, `/request-delivery-dates`, `/mark-dispatch-ready`.

Rutas en back-end y gates por rol
- Archivo: `backend/src/modules/private-purchases/privatePurchases.routes.js`
- Todas las rutas requieren autenticacion: `verifyToken`.
- Gates por endpoint (requireRole):
  - POST `/private-purchases` -> asesor_comercial
  - PUT `/private-purchases/:id/client-registration` -> backoffice_comercial
  - PUT `/private-purchases/:id/delivery-dates` -> jefe_operaciones
  - POST `/private-purchases/:id/ready-for-delivery` -> jefe_logistica
  - POST `/private-purchases/:id/complete-delivery` -> jefe_logistica
- Sin gate explicito:
  - GET `/private-purchases` (listar)
  - GET `/private-purchases/:id` (detalle)
  - POST `/private-purchases/:id/transition` (state machine valida transiciones)
  - POST `/private-purchases/:id/cancel`
  - GET `/private-purchases/:id/timeline`
  - GET `/private-purchases/by-role/:role` (el servicio valida rol)

Servicios en back-end y state machine
- Servicio:
  - Archivo: `backend/src/modules/private-purchases/privatePurchases.service.js`
  - Crea solicitudes y valida:
    - el usuario debe tener rol que contenga "comercial".
    - client data es obligatoria, al menos 1 equipo con id.
    - offer_kind debe ser venta, prestamo o comodato.
    - evita duplicados en 24 horas por creador + cliente.
  - Transiciones automaticas en ciertas operaciones:
    - updateClientRegistration -> transicion a CLIENT_REGISTERED.
    - setDeliveryDates -> transicion a DELIVERY_DATES_SET y opcion de crear evento de calendario.
    - markReadyForDelivery -> transicion a READY_FOR_DELIVERY.
    - completeDelivery -> transicion a DELIVERED.
  - Notificaciones asincronas para eventos clave.
- State machine:
  - Archivo: `backend/src/modules/private-purchases/privatePurchaseStateMachine.js`
  - Valida transiciones con `PRIVATE_PURCHASE_TRANSITIONS`.
  - Exige motivo para contract_rejected.
  - Bloquea envio a pending_contract_approval si faltan docs:
    - client_registered_at
    - client_snapshot.acta_registro_file_id
    - lopdp_approved_at
    - signed_offer_file_id
    - contract_file_id
  - Persiste transiciones en `private_purchase_state_transitions` si existe la tabla.

Brechas e inconsistencias (riesgos actuales)
- El front-end llama endpoints no definidos en `privatePurchases.routes.js`:
  - `/private-purchases/:id/offer`
  - `/private-purchases/:id/offer/signed`
  - `/private-purchases/:id/register-client`
  - `/private-purchases/:id/send-to-acp`
  - `/private-purchases/:id/manager-decision`
  - `/private-purchases/:id/request-delivery-dates`
  - `/private-purchases/:id/mark-dispatch-ready`
  - `/private-purchases/:id/generate-delivery-act`
  - `/private-purchases/:id/submit-contract`
- Diferencias de estados:
  - FE incluye `pending_manager_signature`, `pending_client_signature`, `sent_to_acp`, `rejected`.
  - BE usa `pending_contract_approval`, `contract_rejected`, `ready_for_delivery`, etc.
- Diferencias de campos de documentos:
  - FE usa `offer_document_id` y `offer_signed_document_id`.
  - BE valida `signed_offer_file_id` y `contract_file_id`.

Lista de archivos (referencias clave)
- Front-end:
  - `spi_front/src/modules/backoffice/pages/PrivatePurchases.jsx`
  - `spi_front/src/modules/backoffice/pages/PrivatePurchaseActions.jsx`
  - `spi_front/src/modules/shared/constants/privatePurchaseConstants.js`
  - `spi_front/src/core/api/privatePurchasesApi.js`
  - `spi_front/src/modules/comercial/api/privatePurchasesApi.js`
  - `spi_front/src/modules/operaciones/pages/OperacionesPrivatePurchases.jsx`
  - `spi_front/src/modules/logistica/pages/LogisticaPrivatePurchases.jsx`
  - `spi_front/src/modules/shared/purchases-workspace/tabs/PrivatePurchasesTab.jsx`
  - `spi_front/src/modules/shared/purchases-workspace/PurchasesWorkspace.jsx`
- Back-end:
  - `backend/src/modules/private-purchases/privatePurchases.routes.js`
  - `backend/src/modules/private-purchases/privatePurchases.controller.js`
  - `backend/src/modules/private-purchases/privatePurchases.service.js`
  - `backend/src/modules/private-purchases/privatePurchaseStateMachine.js`
  - `backend/src/modules/private-purchases/privatePurchaseStates.constants.js`
