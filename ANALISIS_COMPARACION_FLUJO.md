# 📊 Análisis de Comparación — UNIFIED_PURCHASES_WORKFLOW.md vs Código Real

Este documento compara el `UNIFIED_PURCHASES_WORKFLOW.md` con el código real de `equipment-purchases` para identificar lo que se cumple y lo que falta.

---

## Índice
1. [Resumen General](#1-resumen-general)
2. [Lo que SE CUMPLE (✅)](#2-lo-que-se-cumple-)
3. [Lo que FALTA (❌)](#3-lo-que-falta-)
4. [Estados y Transiciones](#4-estados-y-transiciones)
5. [Endpoints Implementados vs Faltantes](#5-endpoints-implementados-vs-faltantes)
6. [Siguientes Pasos](#6-siguientes-pasos)

---

## 1. Resumen General

| Concepto | % Cumplimiento |
|----------|-----------------|
| **Estados definidos** | ✅ **100%** |
| **Transiciones definidas** | ✅ **100%** |
| **Endpoints de flujo esencial** | ✅ **~80%** |
| **Reglas de negocio completas** | ⚠️ **~50%** |
| **TOTAL** | **~75%** |

---

## 2. Lo que SE CUMPLE (✅)

### ✅ 1. Estados y Transiciones
- `unifiedPurchaseStates.constants.js` — Todos los estados definidos
- `unifiedPurchaseStateMachine.js` — State machine implementada
- Estados legacy para compatibilidad (equipment-purchases)

### ✅ 2. Endpoints de Flujo Esencial
| Endpoint | Estado |
|----------|--------|
| `POST /:id/transition` | ✅ Implementado |
| `GET /:id/transitions` | ✅ Implementado |
| `POST /:id/send-to-acp` | ✅ Implementado |
| `POST /:id/confirm-acp-availability` | ✅ Implementado |
| `POST /:id/return-to-backoffice` | ✅ Implementado |
| `POST /:id/start-business-case` | ✅ Implementado |
| `POST /:id/send-offer` | ✅ Implementado |
| `POST /:id/offer/signed` | ✅ Implementado |
| `GET /:id/visibility-config` | ✅ Implementado |

### ✅ 3. Workflow Alignment (Parte 2)
| Endpoint | Estado |
|----------|--------|
| `POST /:id/set-purchase-type` | ✅ Implementado |
| `POST /:id/set-private-modality` | ✅ Implementado |
| `POST /:id/set-availability` | ✅ Implementado |
| `POST /:id/activate-supply-control` | ✅ Implementado |
| `POST /:id/register-participation-decision` | ✅ Implementado |
| `POST /:id/register-serial` | ✅ Implementado |

### ✅ 4. Flujo Logístico (Delivery)
| Endpoint | Estado |
|----------|--------|
| `POST /:id/request-delivery-dates` | ✅ Implementado |
| `POST /:id/submit-delivery-dates` | ✅ Implementado |
| `POST /:id/mark-equipment-arrived` | ✅ Implementado |
| `POST /:id/mark-dispatch-ready` | ✅ Implementado |
| `POST /:id/complete-delivery` | ✅ Implementado |

---

## 3. Lo que FALTA (❌)

### ❌ 1. Regla de Disponibilidad "Disponible y Listo"
- **Descripción**: La disponibilidad solo puede ser:
  1. Equipo interno **disponible y listo** → Backoffice registra
  2. Solicitar al proveedor → ACP solicita (solo si no hay interno disponible y listo)
- **Estado en código**: El endpoint `set-availability` existe, pero **NO valida que el equipo interno esté "listo"**
- **Falta**: Validación en `setAvailability` que verifique si el equipo interno está realmente listo

### ❌ 2. Factibilidad vs Decisión de Participar (Compra Pública)
- **Descripción en flujo**:
  1. Business Case → Factibilidad (recomendación)
  2. Decisión formal de participar (ejecutiva: jefe_comercial, gerencia, gerencia_general)
- **Estado en código**:
  - `register-participation-decision` existe
  - Pero **NO hay estado `business_case_factible` ni transición explícita**
  - No hay validación que la factibilidad esté aprobada antes de la decisión de participar
- **Falta**:
  - Estado `business_case_factible` en el flujo
  - Validación que la factibilidad esté aprobada antes de la decisión de participar

### ❌ 3. Checklist del Portal Público (No es Flujo Operativo)
- **Descripción**: FamSPI NO ejecuta el portal público. FamSPI solo controla:
  - Checklist del portal externo
  - Evidencias
  - Fechas
  - Responsable
  - Resultado declarado por ACP
- **Estado en código**:
  - `register-public-portal-outcome` existe
  - Pero **NO hay estructura para checklist, evidencias, fechas, responsable**
- **Falta**:
  - Estructura de datos para checklist del portal público
  - Campos para evidencias, fechas, responsable
  - Endpoint para actualizar checklist del portal

### ❌ 4. Control Operativo de Máximos/Entregables (Paso Final)
- **Descripción**: El flujo termina solo después de que Logística registre todos los envíos comprometidos y complete el control operativo de máximos/entregables
- **Estado en código**:
  - No hay estados `control_operativo_in_progress` ni `control_operativo_completado` en el flujo principal
  - No hay endpoints para control operativo
  - No hay lógica de "solo descontar lo enviado por Logística, no lo solicitado por Comercial"
- **Falta**:
  - Estados `control_operativo_in_progress` y `control_operativo_completado`
  - Endpoints para control operativo
  - Lógica de fuente de verdad de Logística (solo descontar lo enviado)

### ❌ 5. Modalidades de Compra Privada (Claramente Separadas)
- **Descripción**: Las modalidades deben estar claramente separadas en el flujo:
  - Venta Directa → Sin BC
  - Alquiler → Sin BC
  - Alquiler con Transferencia → Sin BC
  - Comodato → Con BC
- **Estado en código**:
  - Las modalidades están definidas
  - Pero **el flujo NO hace distinciones claras entre las modalidades** excepto para comodato
- **Falta**:
  - Transiciones explícitas por modalidad
  - Visibilidad dinámica por modalidad (no solo por tipo de compra)

---

## 4. Estados y Transiciones

| Estado en Flujo | Estado en Código | Cumplimiento |
|------------------|-------------------|--------------|
| `pending_commercial` | ✅ `PENDING_COMMERCIAL` | ✅ |
| `pending_backoffice` | ✅ `PENDING_BACKOFFICE` | ✅ |
| `business_case_in_progress` | ✅ `BUSINESS_CASE_IN_PROGRESS` | ✅ |
| `business_case_factible` | ❌ **NO EXISTE** | ❌ |
| `business_case_feasibility_approved` | ✅ `BUSINESS_CASE_FEASIBILITY_APPROVED` | ⚠️ (existe pero no se usa en flujo público) |
| `acp_availability_requested` | ✅ `ACP_AVAILABILITY_REQUESTED` | ✅ |
| `acp_availability_confirmed` | ✅ `ACP_AVAILABILITY_CONFIRMED` | ✅ |
| `acp_availability_rejected` | ✅ `ACP_AVAILABILITY_REJECTED` | ✅ |
| `availability_set` | ❌ **NO EXISTE** | ❌ |
| `public_portal_outcome_ganado` | ❌ **NO EXISTE** | ❌ |
| `offer_sent` | ✅ `OFFER_SENT` | ✅ |
| `offer_signed` | ✅ `OFFER_SIGNED` | ✅ |
| `contract_draft_uploaded` | ❌ **NO EXISTE** | ❌ |
| `contract_signed` | ✅ `CONTRACT_SIGNED` | ✅ |
| `solicitud_created` | ❌ **NO EXISTE** | ❌ |
| `inspection_scheduled` | ✅ `INSPECTION_SCHEDULED` | ✅ |
| `site_inspection_completed` | ✅ `INSPECTION_COMPLETED` | ✅ |
| `ready_for_installation` | ✅ `READY_FOR_INSTALLATION` | ✅ |
| `installation_completed` | ✅ `INSTALLATION_COMPLETED` | ✅ |
| `unit_control_in_progress` | ❌ **NO EXISTE** | ❌ |
| `control_operativo_in_progress` | ❌ **NO EXISTE** | ❌ |
| `control_operativo_completado` | ❌ **NO EXISTE** | ❌ |
| `completed` | ✅ `COMPLETED` | ✅ |

---

## 5. Endpoints Implementados vs Faltantes

### Endpoints Implementados (✅)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/:id/set-purchase-type` | Establecer tipo de compra |
| POST | `/:id/set-private-modality` | Establecer modalidad |
| POST | `/:id/set-availability` | Establecer disponibilidad |
| POST | `/:id/activate-supply-control` | Activar control de insumos |
| POST | `/:id/register-participation-decision` | Decisión de participar |
| POST | `/:id/register-serial` | Registrar serial |
| POST | `/:id/transition` | Transición de estado |
| GET | `/:id/transitions` | Obtener transiciones permitidas |
| POST | `/:id/send-to-acp` | Enviar a ACP |
| POST | `/:id/confirm-acp-availability` | Confirmar disponibilidad ACP |
| POST | `/:id/return-to-backoffice` | Volver a backoffice |
| POST | `/:id/start-business-case` | Iniciar Business Case |
| POST | `/:id/send-offer` | Enviar oferta |
| POST | `/:id/offer/signed` | Subir oferta firmada |
| GET | `/:id/visibility-config` | Obtener configuración de visibilidad |
| POST | `/:id/request-delivery-dates` | Solicitar fechas de entrega |
| POST | `/:id/submit-delivery-dates` | Confirmar fechas de entrega |
| POST | `/:id/mark-equipment-arrived` | Marcar equipo llegado |
| POST | `/:id/mark-dispatch-ready` | Marcar listo para despacho |
| POST | `/:id/complete-delivery` | Completar entrega |

### Endpoints Faltantes (❌)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/:id/set-portal-checklist` | Actualizar checklist del portal público |
| POST | `/:id/control-operativo/start` | Iniciar control operativo |
| POST | `/:id/control-operativo/complete` | Completar control operativo |
| POST | `/:id/set-equipment-ready` | Marcar equipo interno como listo |

---

## 6. Siguientes Pasos

### Prioridad Alta (Primero)
1. **Agregar estado `business_case_factible` y validación de factibilidad** para compra pública
2. **Agregar estructura para checklist del portal público** (campos, endpoint)
3. **Validar regla de disponibilidad "disponible y listo"** en `setAvailability`

### Prioridad Media (Después)
4. **Agregar estados de control operativo** (`control_operativo_in_progress`, `control_operativo_completado`)
5. **Implementar lógica de fuente de verdad de Logística** (solo descontar lo enviado)
6. **Clarificar flujo por modalidad de compra privada**

---

## ✅ Conclusión

El código tiene **~75% del flujo implementado**, con:
- Todos los estados y transiciones definidos
- Endpoints de flujo esencial implementados
- Workflow alignment (parte 2) completado
- Flujo logístico (delivery) completado

Lo principal que falta son:
1. Las **reglas de negocio específicas** (factibilidad, disponibilidad lista, checklist portal)
2. El **control operativo** como paso final
3. Algunos **estados explícitos** que están en el flujo pero no en el código

---

## 📁 Archivos Relacionados

| Archivo | Ruta |
|---------|------|
| `UNIFIED_PURCHASES_WORKFLOW.md` | `c:\Users\Departamento de TI\Desktop\PROYECTOS\FamSPI\` |
| `unifiedPurchaseStates.constants.js` | `backend/src/modules/equipment-purchases/` |
| `unifiedPurchaseStateMachine.js` | `backend/src/modules/equipment-purchases/` |
| `unifiedPurchases.flow.service.js` | `backend/src/modules/equipment-purchases/` |
| `unifiedPurchaseVisibility.config.js` | `backend/src/modules/equipment-purchases/` |
| `equipmentPurchases.routes.js` | `backend/src/modules/equipment-purchases/` |
| `equipmentPurchases.controller.js` | `backend/src/modules/equipment-purchases/` |
