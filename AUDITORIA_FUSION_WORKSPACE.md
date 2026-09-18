# Auditoria de fusion: compras publicas + privadas

Fecha: 2026-05-12
Fuente: codigo real frontend/backend (sin suposiciones).

## 1) Rutas y entrada al workspace

- Workspace unificado activo: `/dashboard/purchases/workspace`.
- Rutas legacy privadas redirigidas al workspace:
  - `/dashboard/backoffice/private-purchases`
  - `/dashboard/operaciones/private-purchases`
  - `/dashboard/logistica/private-purchases`
  - `/dashboard/servicio-tecnico/entregas-privadas`
- Evidencia: `spi_front/src/routes/AppRoutes.jsx`.

### Hallazgo
- `operaciones` y `logistica` no estan en `allowedRoles` del workspace (si estan `jefe_operaciones` y `jefe_logistica`).
- Impacto: riesgo de perdida de acceso para parte del flujo operativo legacy.

## 2) Estados legacy privados (catalogo)

Estados declarados en API legacy:
- `pending_commercial`
- `pending_backoffice`
- `offer_sent`
- `pending_manager_signature`
- `pending_client_signature`
- `offer_signed`
- `offer_rejected_by_commercial`
- `price_improvement_requested`
- `client_registration_requested`
- `client_registered`
- `inspection_requested`
- `sent_to_acp`
- `acp_availability_requested`
- `acp_availability_confirmed`
- `acp_availability_rejected`
- `pending_contract_approval`
- `pending_contract_client_signature`
- `contract_available`
- `contract_rejected`
- `delivery_dates_requested`
- `delivery_dates_submitted`
- `calendar_events_created`
- `waiting_dispatch`
- `dispatch_ready`
- `delivery_act_draft_ready`
- `delivery_act_tech_assigned`
- `delivery_act_logistics_signed`
- `delivery_act_generated`
- `delivered_signed`
- `rejected`
- `business_case_in_progress`
- `business_case_under_review`
- `business_case_feasibility_approved`
- `business_case_rejected`

Evidencia: `spi_front/src/core/api/privatePurchasesApi.js`.

## 3) Matriz de cobertura (estado/rol/accion)

Leyenda:
- `OK`: visible + accionable en workspace.
- `PARCIAL`: visible o condicion, pero sin paridad completa legacy.
- `FALTANTE`: no hay accion equivalente en tabs del workspace.

1. `pending_backoffice` | `backoffice_comercial` | enviar a ACP (`send-to-acp`) | **OK** | Tab Comercial.
2. `acp_availability_requested` | `acp_comercial` | enviar correo proveedor (`start-availability`) | **OK** | Tab Disponibilidad.
3. `acp_availability_requested` | `acp_comercial` | registrar respuesta proveedor (`provider-response`) | **OK** | Tab Disponibilidad.
4. `acp_availability_confirmed` | `backoffice_comercial` | enviar oferta (`offer`) | **OK** | Tab Comercial.
5. `offer_sent/pending_client_signature` | `comercial` | subir oferta firmada (`offer/signed`) | **OK** | Tab Comercial.
6. `offer_sent/pending_client_signature` | `comercial` | rechazar oferta (`transition`) | **OK** | Tab Comercial.
7. `offer_rejected_by_commercial` | `jefe_comercial` | aceptar rechazo / pedir mejora (`transition`) | **OK** | Tab Comercial.
8. `offer_signed/client_registration_requested` | `comercial` | registrar cliente (`register-client`) | **OK** | Tab Comercial.
9. `pending_contract_approval` | `gerencia/jefe_comercial` | subir contrato (`submit-contract`) | **OK** | Tab Contrato.
10. `pending_contract_client_signature` | `comercial` | subir contrato firmado cliente (`contract/client-signed`) | **OK** | Tab Contrato.
11. `delivery_dates_requested` | comercial/ops/logistica | solicitar y confirmar fechas | **OK** | Tab Logistica.
12. `received_pending_serial` | logistica/ops | registrar serial | **OK** | Tab Logistica.
13. `supply_control_type != none` | comercial/jefe_comercial/backoffice | solicitar insumos (`delivery-requests`) | **OK** | Tab Control de Insumos.
14. `public` ACP | `acp_comercial` | solicitar proforma / subir proforma / firmada + SOCE | **OK** | Tab ACP Publico.

### Cobertura parcial (sin paridad completa)

1. `inspection_requested` y coordinacion/revision de fecha | tecnico/jefe_tecnico/acp/comercial | **PARCIAL**
   - Hay acciones tecnicas base en Tab Tecnica (`F.ST-07/F.ST-14/F.ST-09`).
   - No esta replicado todo el flujo legacy de coordinacion/revision exacta por estado como en widgets legacy.

2. `contract_rejected` reenvio a gerencia | backoffice | **PARCIAL**
   - Se cubren transiciones comerciales principales.
   - Falta UI explicita de reenvio detallado con validacion documental legacy.

3. Timeline de auditoria por evento y bloqueador | todos | **PARCIAL**
   - El tab timeline ya renderiza eventos.
   - No hay normalizacion completa por tipo de evento legacy ni panel de bloqueos equivalente 1:1.

## 4) Faltantes de paridad detectados

1. Estados `delivery_act_*` (`delivery_act_draft_ready`, `delivery_act_tech_assigned`, `delivery_act_logistics_signed`, `delivery_act_generated`) no tienen flujo equivalente completo en workspace unificado.
   - Legacy tenia manejo detallado de acta, asignacion tecnico, firma logistica y cierre de acta.
   - Evidencia legacy: `OperacionesPrivatePurchases.jsx`, `LogisticaPrivatePurchases.jsx`, `PrivatePurchaseDeliveries.jsx`.

2. `calendar_events_created` sin paso explicito equivalente en tabs.

3. Estados de BC legacy (`business_case_under_review`, `business_case_feasibility_approved`, `business_case_rejected`) sin modelado explicito en el flujo del expediente unificado (solo enlace al workspace BC).

4. Paridad ACP publico avanzada pero no total frente a `EquipmentPurchaseWidget` + `RequestActions`:
   - Falta replicar todo el arbol legacy basado en `checklist_state` y estados intermedios (`pending_provider_assignment`, `waiting_provider_response`, `waiting_signed_proforma`, `pending_contract`) en una sola UX equivalente.

## 5) Vistas por rol legacy vs fusion

1. `backoffice_comercial`: mayormente cubierto (Comercial, Disponibilidad, Contrato).
2. `acp_comercial`: mayormente cubierto (Disponibilidad + ACP publico).
3. `comercial`: mayormente cubierto (oferta firmada, rechazo, cliente, contrato cliente, insumos).
4. `jefe_comercial/gerencia`: cubierto en acciones de decision y contrato.
5. `operaciones/logistica`: cubierto en logistica base, **no** en flujo completo `delivery_act_*`.
6. `tecnico/jefe_tecnico`: cubierto en acciones tecnicas base, **parcial** en coordinacion/revision legacy completa.

## 6) Conclusion

La fusion esta funcional para el flujo principal, pero **no** tiene paridad 100% con el modulo anterior.

Paridad estimada:
- Flujo comercial + disponibilidad + contrato + insumos: alta.
- Flujo tecnico/logistico avanzado de actas (`delivery_act_*`): incompleto.
- RBAC de acceso al workspace: requiere ajuste.
- ACP publico: funcional, pero no 1:1 con toda la logica legacy por estado/checklist.

## 7) Cierre recomendado (orden)

1. Ajustar `allowedRoles` del workspace para incluir `operaciones` y `logistica`.
2. Migrar flujo `delivery_act_*` al workspace (operaciones + logistica + servicio tecnico).
3. Completar paridad ACP publico por `checklist_state` y estados intermedios legacy.
4. Normalizar timeline para tipificar eventos legacy y bloqueos activos.
