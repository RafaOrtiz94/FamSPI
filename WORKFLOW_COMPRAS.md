# Workflow Integral de Compras → Entrega → Instalación → Entrenamiento

> Documento maestro del proceso comercial-técnico-logístico de FamSPI.
> **Propósito:** Mapear el ciclo completo (compra pública / compra privada / post-llegada) con todos los roles, estados y ramificaciones para identificar fragmentación y diseñar un workspace unificado.
>
> Fuente: análisis directo del código (`backend/src/modules/{private-purchases,equipment-purchases,servicio}`, `spi_front/src/modules/{comercial,backoffice,logistica,servicio,shared/purchases-workspace}`).

---

## 0. Resumen ejecutivo

Hoy el ciclo está repartido en **5 workspaces** y **2 widgets standalone**, cada uno tocando un subconjunto de los mismos estados. Un mismo expediente cambia de pantalla según el rol que lo abra y se rompe la trazabilidad: el comercial no ve la instalación, el técnico no ve el contrato, el jefe técnico salta entre 4 rutas para cerrar un caso.

**Diagnóstico:**
- Estados, datos y reglas existen y son sólidos en backend (state-machine privada, STATUS público, `installationWorkflow` JSONB).
- La fragmentación es **puramente de UI/navegación**.

**Propuesta:** un único **Workspace de Compras** con sub-tabs por fase (no por rol) y secciones condicionales por rol. Los roles ven todo el expediente; sólo cambian las acciones disponibles.

---

## 1. Tipos de compra y requerimiento de Business Case

| Tipo | Requiere BC | Flujo |
|---|---|---|
| **Compra pública** (SERCOP) | ✅ Obligatorio | BC → SOCE (puja/adjudicación) → contrato → logística → técnica → entrenamiento |
| **Compra privada comodato** | ✅ Obligatorio | BC → oferta → contrato → logística → técnica → entrenamiento |
| **Compra privada directa** (`direct_purchase`) | ❌ No requiere | Oferta → contrato → logística → técnica → entrenamiento |
| **Arriendo / Rental** | ❌ No requiere | Oferta → contrato → logística → técnica → entrenamiento |

---

## 2. Business Case — flujo completo

> Aplica a: **compra pública** y **compra privada comodato**.
> State machine: `backend/src/modules/business-case/businessCaseStates.constants.js`.
> UI: `/dashboard/business-case/workspace`.

### Estados y transiciones

| # | Estado | Quién actúa | Acciones disponibles |
|---|---|---|---|
| 1 | `DRAFT_INICIAL` | `comercial` · `acp_comercial` · `backoffice_comercial` · `jefe_comercial` | Llenar secciones: datos generales, equipo, laboratorio, LIS, determinaciones, inversiones |
| 2 | `DATOS_BASE_COMPLETOS` | `jefe_comercial` · `jefe_operaciones` (full); `comercial` (solo determinaciones) | Revisar; enviar a evaluación |
| 3 | `EN_EVALUACION_VIABILIDAD` | `acp_comercial` · `jefe_comercial` | Evaluar viabilidad técnica y financiera |
| — | *(rama)* `OBSERVADO_POR_VIABILIDAD` | `comercial` · `jefe_comercial` | Corregir observaciones en todas las secciones → vuelve a evaluación |
| — | *(rama rechazo)* `cerrado_no_factible` | `acp_comercial` · `jefe_comercial` | BC no viable: requiere propuesta alternativa (venta / alquiler / alquiler con transferencia) → **proceso termina** |
| 4 | `VIABLE` | `jefe_operaciones` (solo inversiones) | Planificar inversiones |
| 5 | `AJUSTES_OPERATIVOS` | `jefe_operaciones` (solo inversiones) | Ajustar plan operacional antes de aprobación final |
| 6 | `CERRADO_PARA_APROBACION` | `gerencia` / `gerencia_general` | Aprobar → **FACTIBLE** / Rechazar → `RECHAZADO_POR_GERENCIA` |
| — | *(terminal)* `RECHAZADO_POR_GERENCIA` | — | Notifica a `jefe_comercial`. BC dead-end. |

### Resultado: FACTIBLE

Cuando `gerencia` aprueba:
- `bc_stage = "factible"` 
- Se reserva inventario.
- Se notifica a `jefe_comercial`.
- Se habilita la creación del expediente de compra (pública o comodato).
- Para comodato: la private purchase ligada pasa a `business_case_feasibility_approved` → avanza a fase de oferta.

---

## 3. Roles del sistema

| Rol | Área | Donde actúa |
|---|---|---|
| `comercial` / `asesor_comercial` | Comercial | Origen de venta, coordinación cliente |
| `acp_comercial` | Comercial backoffice | Gestión proveedor, proformas, contratos |
| `backoffice_comercial` | Comercial backoffice | Ofertas, registro de cliente |
| `jefe_comercial` | Comercial | Aprueba business case, viabilidad comodato |
| `gerencia_general` / `gerencia` | Dirección | Firma proformas/contratos, aprueba compras |
| `bodega` / `almacen` | Operaciones | Registra llegada de equipo |
| `logistica` / `jefe_logistica` | Logística | Despacho, validación de guía, F.ST-14 |
| `servicio_tecnico` / `tecnico` | Técnico | F.ST-20 inspección, F.ST-09 verificación, F.ST-10 entrega, entrenamiento |
| `jefe_tecnico` / `jefe_servicio_tecnico` | Técnico | Asigna técnico, decisión de verificación, cierra casos |
| `jefe_operaciones` | Operaciones | Coordina fechas de entrega |
| `cliente_externo` | Cliente | Firma oferta, firma contrato |

---

## 2. Catálogo de formularios

| Código | Nombre | Quién lo ejecuta | Cuándo |
|---|---|---|---|
| **F.ST-02** | Registro de desinfección de instrumento médico | Técnico | Antes de retiro de equipo / antes de devolver piezas a CU |
| **F.ST-04** | Planificación de entrenamientos | Jefe técnico / técnico | Post-instalación |
| **F.ST-05** | Control de asistencia a entrenamientos | Técnico | Día de entrenamiento |
| **F.ST-07** | Inspección de ambiente en sitio | Técnico | Antes de instalación (válida `ready_for_installation`) |
| **F.ST-09** | Verificación técnica del equipo (cumple/no cumple) | Técnico + Jefe técnico | Post-recepción visual |
| **F.ST-10** | Acta de entrega | Técnico (sube) + Logística (firma) + Gerencia (legaliza) | Cierre de instalación |
| **F.ST-11** | Acta de retiro de equipo | Técnico | Retiro/devolución |
| **F.ST-14** | Recepción visual / inspección de empaque | Técnico | Llegada del equipo |
| **F.ST-19** | Solicitud de mantenimiento | Cliente / comercial | Tipo de request |
| **F.ST-20** | Solicitud de inspección de ambiente | Comercial | Tipo de request previo a F.ST-07 |
| **F.ST-21** | Solicitud de retiro de equipo | Comercial / cliente | Tipo de request previo a F.ST-11 |
| **F.ST-22** | Registro de nuevo cliente | Backoffice comercial | Antes de firma de contrato |

---

## 3. Compra Pública — ciclo completo

> **Contexto:** FamSPI actúa como **proveedor** (no como entidad contratante) en el sistema de contratación pública del Ecuador (SERCOP / SOCE). El proceso tiene dos pistas paralelas que se sincronizan en puntos clave:
> - **Pista interna FamSPI:** verificación de stock, proforma interna, reserva de equipo, Business Case, inspección de sitio.
> - **Pista externa SOCE:** la entidad contratante publica el proceso en el portal; FamSPI participa, presenta oferta, va a la puja o negociación, gana o pierde, recibe adjudicación, firma orden de compra/contrato.
>
> State machine: `backend/src/modules/equipment-purchases/equipmentPurchases.service.js`.
> UI: `EquipmentPurchases.jsx`, `PurchasesWorkspace.jsx?tab=public`, `PurchasesAlbumPage.jsx`.

### Marco legal Ecuador
- **LOSNCP** (Ley Orgánica del Sistema Nacional de Contratación Pública).
- **SERCOP** administra el portal **SOCE** (`compraspublicas.gob.ec`).
- FamSPI debe tener **RUP** (Registro Único de Proveedores) activo para participar.
- La entidad contratante debe tener el ítem en su **PAC** (Plan Anual de Contrataciones) publicado antes del 15 de enero de cada año.

### Tipos de procedimiento (bienes/servicios normalizados, Ecuador 2025)
| Tipo | Cuándo aplica | Observación |
|---|---|---|
| **Catálogo Electrónico** | Cualquier monto (si el bien está en catálogo) | Preferente; sin proceso competitivo |
| **Ínfima Cuantía** | ≤ ~$5 000 | Sin publicación en SOCE |
| **Subasta Inversa Electrónica (SIE)** | Bienes normalizados, > ínfima cuantía | Más común para equipos médicos |
| **Menor Cuantía** | Bienes no normalizados, monto bajo | Invitación directa |
| **Cotización** | Bienes no normalizados, rango medio | ≥ 5 proveedores invitados |
| **Licitación** | Montos mayores | Proceso abierto completo |
| **Régimen Especial** | Fármacos, seguridad, etc. | Reglas propias |

> **Campo faltante en el sistema:** `procedure_type` — el sistema actualmente no registra el tipo de procedimiento.

---

### 3.0 Pre-fase: Business Case (gate de entrada)

La compra pública nace como oportunidad comercial **solo cuando el Business Case es aprobado como factible**. Sin BC factible no se crea expediente.

| # | Acción | Rol (FamSPI) | Salida |
|---|---|---|---|
| 0a | Identificar oportunidad: la entidad contratante publica PAC o convocatoria | `comercial` | Oportunidad detectada |
| 0b | Elaborar Business Case (viabilidad técnica + ROI + análisis de competencia) | `comercial` / `acp_comercial` | BC en revisión |
| 0c | Evaluar y aprobar viabilidad | `jefe_comercial` + `gerencia` | **Factible → inicia proceso** / No factible → cierra |

---

### 3.1 Pista interna — preparación técnica y logística

Corre en **paralelo** a la pista SOCE mientras la entidad contratante lleva adelante su proceso.

| # | Estado interno | Acción FamSPI | Rol | Salida |
|---|---|---|---|---|
| 1 | `pending_provider_assignment` | Crear expediente (post-BC factible); registrar código SOCE del proceso | `comercial` | Expediente abierto |
| 2 | — | Asignar ACP responsable del proceso | `jefe_comercial` | ACP asignado |
| 3 | `waiting_provider_response` | Verificar disponibilidad del equipo con el fabricante/distribuidor | `acp_comercial` | Disponible / **NO STOCK** |
| 4 | `waiting_proforma` | Solicitar proforma interna (referencia de costo para el BC y la oferta) | `acp_comercial` | Proforma solicitada |
| 5 | `proforma_received` | Reservar stock / confirmar tiempo de importación | `acp_comercial` | Equipo reservado |
| 6 | `waiting_signed_proforma` | Cargar proforma firmada + definir ventana de inspección de sitio (F.ST-20) | `acp_comercial` | Proforma firmada; BC auto-creado; F.ST-20 solicitado |
| 7 | — | **F.ST-07** Inspección técnica del sitio del cliente | `servicio_tecnico` | `ready_for_installation` = sí/no |

**Rama no-stock:** vuelve a `pending_provider_assignment` o cierra con compra alternativa.
**Rama F.ST-07 rechazado:** `inspection_coordination_status` = `rejected` → regresa a coordinación de fechas.

---

### 3.2 Pista externa — proceso SOCE (entidad contratante → FamSPI participa)

Estos pasos ocurren en el portal `compraspublicas.gob.ec`. FamSPI actúa como participante externo.

| # | Etapa SOCE | Actor principal | Qué hace FamSPI | Documento generado |
|---|---|---|---|---|
| A | Publicación de **Convocatoria** y **Pliegos** | Entidad contratante | Revisa pliegos, verifica que puede cumplir especificaciones técnicas | Pliegos (PDF) |
| B | Presentación de **Oferta Técnica** | FamSPI (proveedor) | Sube la oferta técnica en SOCE (cumple specs: sí/no + documentos) | Oferta Técnica |
| C | **Calificación** de ofertas | Entidad contratante | Espera resultado; si no califica → proceso termina | Informe de Calificación |
| D | **Puja** electrónica (SIE) o **Negociación** | FamSPI + otros proveedores | Ingresa al SOCE el día de la subasta; presenta pujas de precio decreciente | Registro de puja SOCE |
| E | **Resultado: GANADO** | SOCE (automático) | FamSPI tiene el precio más bajo válido → se registra `outcome = "won"` | Resultado de puja |
| F | **Resolución de Adjudicación** | Entidad contratante | Recibe la resolución oficial (número + fecha); la registra en el expediente | **Resolución de Adjudicación** (PDF) |
| G | **Orden de Compra** o **Contrato** en SOCE | Entidad contratante + FamSPI | Firma electrónica en portal (SIE) o firma física del contrato (Licitación) | Orden de Compra / Contrato |
| H | **Garantía de Fiel Cumplimiento** | FamSPI | Entrega garantía (5% del valor) a la entidad si aplica | Póliza / depósito |

> **Si el resultado es PERDIDO** (`outcome = "lost"`): expediente se cancela internamente con motivo `"Proceso no adjudicado en portal de compras públicas"`.

---

### 3.3 Convergencia — estado `pending_contract` en el sistema

Los dos tracks se sincronizan aquí. Para poder cargar el contrato (`upload_contract`) el sistema requiere que se cumplan **4 gates simultáneos**:

| Gate | Cómo se valida |
|---|---|
| `public_portal_awarded` | `extra.public_portal_outcome.outcome === "won"` |
| `business_case_resolved_factible` | BC stage = `"factible"` |
| `client_registered` | `client_id` existe (F.ST-22 completado) |
| `inspection_requested` | `inspection_request_id` existe (F.ST-20 solicitado) |

| # | Estado | Acción | Rol | Salida |
|---|---|---|---|---|
| 8 | `pending_contract` | Registrar resultado del portal (ganado/perdido) + número de Resolución de Adjudicación | `acp_comercial` | Outcome registrado |
| 9 | `pending_contract` | Registrar cliente final en sistema (F.ST-22) | `backoffice_comercial` | `client_registered` = ✓ |
| 10 | `pending_contract` | Cargar contrato u Orden de Compra (una vez los 4 gates = ✓) | `acp_comercial` | Contrato disponible |
| 11 | `contract_available` | Solicitar fechas de entrega | `jefe_operaciones` | Fechas solicitadas |
| 12 | `delivery_dates_requested` | Confirmar fechas de entrega | `acp_comercial` | Fechas confirmadas |

---

### 3.4 Fase logística-técnica

Ver sección 3.2 del flujo original → estados `delivery_dates_submitted` → `waiting_dispatch` → `dispatch_ready`.
Después de `dispatch_ready`, el equipo entra a la **Fase técnica común post-arrival** (sección 5 de este documento): F.ST-14 → F.ST-09 → F.ST-10 → Entrenamiento → Cierre.

> En Ecuador, el cierre técnico incluye el **Acta de Recepción Provisional** y eventualmente el **Acta de Recepción Definitiva** emitidos por la entidad contratante. El F.ST-10 interno de FamSPI complementa (no reemplaza) estas actas.

---

### 3.5 Campos faltantes en el sistema (para auditoría SERCOP completa)

| Campo | Descripción | Prioridad |
|---|---|---|
| `procedure_type` | SIE / Cotización / Licitación / Menor Cuantía / Catálogo / Régimen Especial | Alta |
| `soce_process_code` | Código del proceso SOCE (ej. `SIE-HCAM-2025-0042`) | Alta |
| `entidad_contratante_name` | Nombre de la entidad contratante | Alta |
| `entidad_contratante_ruc` | RUC de la entidad contratante | Media |
| `presupuesto_referencial` | Monto máximo publicado en la convocatoria | Alta |
| `oferta_tecnica_submitted_at` | Fecha de presentación de oferta técnica en SOCE | Media |
| `puja_date` | Fecha de la sesión de puja/subasta | Media |
| `puja_final_price` | Precio final ganador | Alta |
| `adjudicacion_resolution_number` | Número de la Resolución de Adjudicación | Alta |
| `adjudicacion_resolution_date` | Fecha de la resolución | Alta |
| `adjudicacion_resolution_file_id` | Archivo de la resolución (Drive) | Alta |
| `orden_compra_number` | Número de Orden de Compra emitida por SOCE | Alta |
| `garantia_fiel_cumplimiento_submitted` | Garantía entregada sí/no | Media |
| `acta_recepcion_provisional_date` | Fecha Acta Recepción Provisional de la entidad | Media |
| `pac_code` | Código del ítem en el PAC de la entidad | Baja |

### 3.2 Fase logística-técnica

| # | Estado | Acción | Rol | Salida |
|---|---|---|---|---|
| 14 | `delivery_dates_submitted` | Marcar equipo arribado | `bodega` / `almacen` | Equipo en bodega |
| 15 | `waiting_dispatch` | Marcar listo para despacho | `logistica` | Despacho listo |
| 16 | `dispatch_ready` | Cerrar entrega / iniciar instalación | `logistica` + `tecnico` | Pasa a fase técnica |
| 17 | `completed` | (terminal) | — | Compra cerrada |

> **Hueco actual:** los estados `dispatch_ready → completed` no tienen un workspace técnico equivalente al de compra privada. F.ST-14, F.ST-09, F.ST-10 y entrenamiento aplican por contrato pero **no hay UI** que los exponga para compra pública. Hay que extender `installationWorkflow` al modelo público o forzar a que pasen por el mismo flujo post-arrival.

### 3.3 Capa adicional: cupos y planes de entrega
- Tablas: `delivery_ceiling`, `public_delivery_plan`, `delivery_request` (migraciones 126-128).
- Estados de plan: `draft` / `approved` / `cancelled`.
- Estados de request: `pending` / `confirmed` / `cancelled`.
- Roles: `comercial` crea, `jefe_comercial` aprueba, `gerencia` visualiza.
- UI: `/dashboard/comercial/delivery-ceilings` (aislado).

> **Observación:** este modelo de cupos vive en paralelo a las columnas `equipment_purchase_requests.delivery_*` (migración 095). Dos modelos para "entrega pública".

---

## 4. Compra Privada — ciclo completo

> Origen: venta directa, alquiler o comodato a cliente privado.
> State machine: `backend/src/modules/private-purchases/privatePurchaseStateMachine.js` + `privatePurchaseStates.constants.js`.
> **Tres tipos de flujo:**
> - `direct_purchase` / `rental` — inician directamente con la oportunidad comercial.
> - `comodato` — **inicia obligatoriamente con Business Case factible** (igual que compra pública). Sin BC aprobado no se avanza a oferta.

### 4.0 Pre-fase: Business Case (solo comodato — gate de entrada)

| # | Estado | Acción | Rol | Salida |
|---|---|---|---|---|
| 0 | `business_case_in_progress` | Construir caso de negocio comodato | `backoffice_comercial` | BC armado |
| — | `business_case_under_review` | Evaluar viabilidad financiera y técnica | `jefe_comercial` | `feasibility_approved` / `rejected` |

> Si el Business Case se rechaza → proceso termina. Puede reabrirse con ajustes.
> Si es aprobado → continúa a fase comercial (oferta).
> `direct_purchase` y `rental` saltan directamente al paso 1 de fase comercial.

### 4.1 Fase comercial

| # | Estado | Acción | Rol | Salida |
|---|---|---|---|---|
| 1 | `pending_commercial` | Crear oportunidad/solicitud | `comercial` | Borrador |
| 2 | `pending_backoffice` | Enviar a backoffice | `comercial` | Asignado a backoffice |
| 3 | `offer_sent` | Enviar oferta al cliente (post-BC en comodato) | `backoffice_comercial` | Oferta emitida |
| 4 | `pending_manager_signature` | Firmar oferta | `gerencia_general` | Oferta firmada por gerencia |
| 5 | `pending_client_signature` | Cliente firma oferta | `cliente_externo` | Oferta firmada |
| 6 | `offer_signed` / `offer_rejected_by_commercial` | Cliente acepta o rechaza | `cliente_externo` | Sigue / loop / fin |

**Ramas en oferta:**
- `price_improvement_requested` → vuelve a `offer_sent` (mejora de precio).
- Rechazo definitivo por `jefe_comercial` → fin como `offer_rejected_by_commercial`.
- Comodato rechazado en BC → puede reabrir BC con ajustes antes de enviar oferta.

### 4.2 Fase de coordinación pre-contrato

| # | Estado | Acción | Rol | Salida |
|---|---|---|---|---|
| 9 | `client_registration_requested` | Registrar cliente (F.ST-22) | `backoffice_comercial` | Cliente en sistema |
| 10 | `client_registered` | Cliente listo | — | Continúa |
| 11 | `inspection_requested` | Solicitar F.ST-20 + ejecutar F.ST-07 | `servicio_tecnico` | Acta de inspección |
| 12 | `sent_to_acp` | Enviar a ACP para disponibilidad | `backoffice_comercial` | ACP notificado |
| 13 | `acp_availability_requested` | Confirmar disponibilidad con proveedor | `acp_comercial` | `confirmed` / `rejected` |
| 14 | `pending_contract_client_signature` | Cliente firma contrato | `cliente_externo` | Contrato firmado por cliente |

**Rama ACP rechaza (comodato):** vuelve a business case.

### 4.3 Fase de aprobación final

| # | Estado | Acción | Rol | Gate |
|---|---|---|---|---|
| 15 | `pending_contract_approval` | Enviar a gerencia | `backoffice_comercial` | Documentos requeridos |
| 16 | `contract_available` / `contract_rejected` | Aprobar/rechazar contrato | `gerencia_general` | Razón de rechazo obligatoria |

**Gate obligatorio para gerencia** (`_checkRequiredDocumentsForGerencia`):
CLIENT_REGISTRATION · INSPECTION_ACT · LOPDP_APPROVAL · CLIENT_ID · ACP_RESPONSE · OFFER_DOCUMENT · SIGNED_OFFER · CONTRACT_DRAFT · CONTRACT_CLIENT_SIGNED.

### 4.4 Fase logística-técnica (idéntica a las últimas etapas de compra pública)

| # | Estado | Acción | Rol |
|---|---|---|---|
| 17 | `delivery_dates_requested` | Solicitar fechas | `jefe_operaciones` |
| 18 | `delivery_dates_submitted` | Enviar fechas | `jefe_operaciones` |
| 19 | `calendar_events_created` | Crear eventos en Google Calendar | (sistema) |
| 20 | `waiting_dispatch` | Preparar despacho | `jefe_logistica` |
| 21 | `dispatch_ready` | Despacho listo | `jefe_logistica` |

### 4.5 Fase post-arrival (instalación)

| # | Estado | Acción | Rol |
|---|---|---|---|
| 22 | `delivery_act_draft_ready` | Generar borrador del acta | (sistema) |
| 23 | `delivery_act_tech_assigned` | Asignar técnico instalador | `jefe_tecnico` |
| 24 | `delivery_act_logistics_signed` | Firmar acta lado logística | `logistica` |
| 25 | `delivery_act_generated` | Subir acta final | `tecnico` asignado |
| 26 | `delivered_signed` | (terminal) | — |
| 27 | `rejected` | (terminal alterno) | — |

**Sub-flujo `installationWorkflow`** (JSONB en la fila, no son estados principales):

```
dispatch_request
    └─ logistics_validation: pending → validated/rejected
        └─ visual_reception (F.ST-14): pending → pass/fail
            └─ verification_decision (F.ST-09): applies | requires_cu
                ├─ verification_cycle: pending_decision → passed/failed (multi-attempt)
                └─ cu_flow: parts_request, provider_repair_report (si requires_cu)
                    └─ delivery_act (F.ST-10) → final upload
                        └─ training (F.ST-04 + F.ST-05) → certificate
                            └─ closure_gate verifies all blockers resolved
```

**Bloqueos posibles** (`computeInstallationClosureGate`):
DISPATCH_REQUEST_PENDING · LOGISTICS_VALIDATION_PENDING · FST14_PENDING/NOT_APPROVED · SITE_NOT_READY_FOR_INSTALLATION · VERIFICATION_DECISION_PENDING · VERIFICATION_PENDING · EXCEPTION_INCOMPLETE · CU_PARTS_PENDING · CU_PROVIDER_REPORT_PENDING.

---

## 5. Fase técnica común post-arrival (compra pública y privada)

Todo lo siguiente debe correr para CUALQUIER equipo entregado, sin importar si la compra fue pública o privada:

### 5.1 Recepción
1. **Solicitud de despacho** (logística).
2. **Validación logística** de guía vs proforma (`jefe_logistica`).
3. **F.ST-14 — Recepción visual**: `guide_vs_proforma`, `packaging_integrity`, `tilt_indicator`, `handling_indicator`, `serial_match`, `accessories_match`. Pasa o falla.

### 5.2 Verificación
4. **F.ST-09 — Decisión de verificación**: ¿aplica verificación o requiere flujo CU?
   - `applies`: verificación directa, multi-intento hasta pasar.
   - `requires_cu`: equipo no cumple, entra a flujo de partes.
5. **F.ST-07 — Inspección de sitio**: debe estar `ready_for_installation` antes de continuar.

### 5.3 Flujo CU (cuando aplica)
6. Solicitud de **partes**: `not_required`/`pending`/`requested`/`received`.
7. **Reporte de reparación del proveedor**: archivo obligatorio.
8. **F.ST-02 desinfección** antes de devolver piezas (gating).
9. Re-verificación.

### 5.4 Cierre
10. **F.ST-10 — Acta de entrega**: técnico sube → logística firma → gerencia legaliza. PDF a partir de `F.ST-10_V04_ACTA DE ENTREGA.pdf`.
11. **Entrenamiento**:
    - **F.ST-04** planificación.
    - **F.ST-05** asistencia (hasta 7 asistentes).
    - Certificado de entrenamiento.
    - Conformidad y evaluación.
12. **Closure gate**: cierra el expediente.

### 5.5 Adyacentes (mismo módulo, flujos independientes)
- **F.ST-11 retiros**: `/dashboard/servicio-tecnico/retiros`.
- **Casos correctivos**: `CorrectiveCaseWorkspace.jsx`.
- **Mantenimiento preventivo**: `PreventiveAnnualPlanBoard.jsx`.

---

## 6. Mapa de fragmentación actual

| Fase | Workspace actual | Archivo | Roles que lo ven |
|---|---|---|---|
| Compra pública (todo) | `/dashboard/comercial/equipment-purchases` | `comercial/pages/EquipmentPurchases.jsx` | comercial |
| Compra pública/privada (listado) | `/dashboard/purchases/workspace` | `shared/purchases-workspace/PurchasesWorkspace.jsx` | comercial, backoffice, jefe |
| Compra privada (full) | `/dashboard/backoffice/private-purchases` | `backoffice/pages/PrivatePurchases.jsx` (~3000 líneas) | backoffice, comercial |
| Compra privada vista logística | `/dashboard/logistica/private-purchases` | `logistica/pages/LogisticaPrivatePurchases.jsx` | logística |
| Entregas privadas (post-arrival) | `/dashboard/servicio-tecnico/entregas-privadas` | `servicio/pages/PrivatePurchaseDeliveries.jsx` | jefe_tecnico, tecnico |
| Procedimiento técnico (F.ST-20/07) | `/dashboard/servicio-tecnico/workspace-procedimiento` | `servicio/pages/TechnicalProcedureWorkspace.jsx` | técnico (público + privado) |
| Cupos y planes públicos | `/dashboard/comercial/delivery-ceilings` | módulo separado | comercial, jefe_comercial |
| Álbum gerencia | `/dashboard/gerencia/compras-album` | `gerencia/PurchasesAlbumPage.jsx` | gerencia |
| Entrenamiento | `/dashboard/servicio-tecnico/aplicaciones` | `TrainingWorkflowWorkspace.jsx` | técnico |
| Asistencia entrenamiento | `/dashboard/servicio-tecnico/asistencia` | módulo separado | técnico |
| Desinfección | `/dashboard/servicio-tecnico/desinfeccion` | `DesinfeccionStepper.jsx` | técnico |

**Problemas concretos:**

1. **Duplicado puro:** `TecnicoPrivatePurchases.jsx` es solo un `<Navigate>` a `entregas-privadas`. Dead code, ya removido del navbar pero el archivo y la ruta siguen.
2. **Logística vs servicio dividen el mismo expediente:** los estados `delivery_act_*` se renderizan en `LogisticaPrivatePurchases.jsx` (líneas 46-55) y `PrivatePurchaseDeliveries.jsx` (líneas 29-36) con botones distintos por rol. Mismo dato, dos pantallas.
3. **Backoffice tiene un workspace divergente:** `PrivatePurchases.jsx` (3000 líneas) y `PrivatePurchasesTab.jsx` son dos UIs sobre la misma state-machine. Mantener ambas es deuda permanente.
4. **Compra pública no tiene workspace post-arrival:** F.ST-14/F.ST-09/F.ST-10/entrenamiento solo existen en UI para compra privada. Los equipos de compra pública también requieren estos formularios pero hoy no los hay.
5. **`TechnicalProcedureWorkspace` aplica a ambas** pero está fuera del workspace de compras: el técnico salta a otra ruta para hacer F.ST-20/F.ST-07.
6. **Entrenamiento desconectado de la compra que lo originó:** no hay link directo desde `PrivatePurchaseDeliveries` al training del mismo expediente.
7. **Duplicado en navbar:** hasta 4 entradas distintas (`Workspace de compras`, `Compras privadas`, `Compras públicas`, `Entregas privadas`) según el rol, todas hacia el mismo ciclo.
8. **Dos modelos de "entrega pública":** `delivery_ceiling/public_delivery_plan` paralelo a `equipment_purchase_requests.delivery_*`.

---

## 7. Propuesta — Workspace unificado de compras

> Una sola ruta: `/dashboard/compras` (o el actual `/dashboard/purchases/workspace`) reemplaza todas las anteriores.

### 7.1 Estructura de UI

```
Workspace de Compras
├── Header con filtros: tipo (pública/privada/todos), estado, responsable, cliente
├── Lista lateral de expedientes (cards con estado actual + bloqueo activo)
└── Detalle del expediente seleccionado
    ├── Sub-tab 1: COMERCIAL
    │   ├── Datos del cliente, equipo, proveedor
    │   ├── Oferta / proforma / business case
    │   └── Acciones de comercial / acp / backoffice / jefe_comercial / gerencia
    ├── Sub-tab 2: CONTRATO
    │   ├── Documentos (gate de gerencia visible)
    │   ├── Firma cliente / gerencia
    │   └── Acciones de backoffice / cliente / gerencia
    ├── Sub-tab 3: LOGÍSTICA
    │   ├── Fechas de entrega
    │   ├── Despacho
    │   ├── F.ST-14 recepción visual
    │   └── Acciones de jefe_operaciones / logística
    ├── Sub-tab 4: TÉCNICA
    │   ├── F.ST-07 inspección sitio
    │   ├── F.ST-09 decisión + verificación + flujo CU
    │   ├── F.ST-02 desinfección si aplica
    │   ├── F.ST-10 acta de entrega
    │   └── Acciones de jefe_tecnico / tecnico / logistica / gerencia
    ├── Sub-tab 5: ENTRENAMIENTO
    │   ├── F.ST-04 planificación
    │   ├── F.ST-05 asistencia
    │   ├── Conformidad / evaluación / certificado
    │   └── Acciones de jefe_tecnico / tecnico
    └── Sub-tab 6: TIMELINE / AUDITORÍA
        └── Historial completo, bloqueos activos, eventos
```

**Reglas:**
- **Todos los roles ven todas las sub-tabs** (transparencia y trazabilidad).
- **Las acciones se gatean por rol** dentro de cada sub-tab.
- Las sub-tabs muestran un badge: `pendiente`, `en curso`, `bloqueado`, `completado`, `n/a`.
- El expediente público o privado usa la misma estructura; la sub-tab Comercial cambia su contenido según el tipo.

### 7.2 Navbar — limpieza

**Mantener:**
- `Workspace de Compras` (CRITICAL para comercial, backoffice, logística, técnico).
- `Cupos públicos` (sólo comercial / jefe_comercial — fase de planificación, no expediente).
- `Álbum gerencia` (gerencia).

**Eliminar del navbar:**
- `Compras privadas` (varias variantes por rol).
- `Compras públicas` standalone.
- `Entregas privadas` standalone.
- `Workspace procedimiento` (se integra como sub-tab Técnica).
- Adyacentes (retiros, mantenimiento preventivo, casos correctivos) **siguen en navbar técnico** porque son flujos independientes, no parte del expediente de compra.

### 7.3 Migración de código

| Acción | Archivos |
|---|---|
| Borrar | `servicio/pages/TecnicoPrivatePurchases.jsx`, ruta dead en `AppRoutes.jsx:345` |
| Mover a sub-tab Comercial | lógica de `backoffice/pages/PrivatePurchases.jsx`, `comercial/pages/EquipmentPurchases.jsx`, `EquipmentPurchaseWidget.jsx` |
| Mover a sub-tab Logística | `logistica/pages/LogisticaPrivatePurchases.jsx` parte logística, `InstallationReceptionStepper` (F.ST-14) |
| Mover a sub-tab Técnica | `PrivatePurchaseDeliveries.jsx`, `TechnicalProcedureWorkspace.jsx`, `VerificacionStepper`, `VerificationResultPanel`, `DeliveryActPanel`, `SiteInspectionStepper`, `DesinfeccionStepper` (cuando es gating de CU) |
| Mover a sub-tab Entrenamiento | `servicio/components/TrainingWorkflowWorkspace.jsx`, `EntrenamientoStepper`, `AsistenciaStepper`, `TrainingConformityStepper`, `TrainingEvaluationStepper`, `TrainingCertificatePanel` (todos en `servicio/components/`) |
| Crear | wrapper post-arrival para compra **pública** (`installationWorkflow` ya existe en backend; falta UI) |

### 7.4 Backend — sin cambios estructurales

La state-machine privada y los STATUS públicos quedan intactos. `installationWorkflow` ya soporta ambos. Lo único que requiere extender es:
- Conectar `equipment_purchase_requests` al pipeline `installationWorkflow` ya existente para que la compra pública también arranque F.ST-14/F.ST-09/F.ST-10/entrenamiento.
- Consolidar `delivery_ceiling`/`public_delivery_plan` y `equipment_purchase_requests.delivery_*` en un solo modelo (decisión pendiente).

---

## 8. Cambios sugeridos por fase

> Este es el bloque que debe editarse para ajustar la implementación. Cada cambio se etiqueta para referencia rápida.

### CHG-01 — Borrar duplicados puros
- Eliminar `spi_front/src/modules/servicio/pages/TecnicoPrivatePurchases.jsx`.
- Limpiar la ruta correspondiente en `AppRoutes.jsx`.
- Confirmar que ningún navbar/dashboard la referencia.

### CHG-02 — Unificar UI logística-técnica
- Fusionar `LogisticaPrivatePurchases.jsx` y `PrivatePurchaseDeliveries.jsx` en una sola pantalla (sub-tab Logística + sub-tab Técnica del workspace unificado).
- Mismas acciones, gateadas por rol.

### CHG-03 — Compra pública con post-arrival
- Conectar `equipment_purchase_requests` al `installationWorkflow`.
- Surgir las mismas sub-tabs Técnica + Entrenamiento para expedientes públicos.

### CHG-04 — Migrar backoffice a workspace unificado
- Reemplazar `backoffice/pages/PrivatePurchases.jsx` y `backoffice/pages/PrivatePurchaseActions.jsx` por las sub-tabs Comercial y Contrato del workspace.
- Mantener temporalmente la ruta como redirect hacia el workspace.
- `PrivatePurchaseActions.jsx` contiene las acciones por estado; migrar esa lógica a `ActionGate` dentro de cada sub-tab.

### CHG-05 — Embebido del procedimiento técnico
- Integrar `TechnicalProcedureWorkspace.jsx` como sub-tab Técnica.
- Eliminar la ruta `/dashboard/servicio-tecnico/workspace-procedimiento` del navbar (mantener como deep-link interno).

### CHG-06 — Entrenamiento dentro del expediente
- Mostrar el sub-flujo F.ST-04/F.ST-05/certificado dentro de la sub-tab Entrenamiento del expediente, no en una ruta independiente.
- Mantener `/dashboard/servicio-tecnico/aplicaciones` solo como vista de gestión global (lista de entrenamientos pendientes/programados).

### CHG-07 — Limpieza de navbar
- Quitar entradas duplicadas: `Compras privadas`, `Compras públicas`, `Entregas privadas`, `Workspace procedimiento`.
- Conservar: `Workspace de Compras`, `Cupos públicos`, `Álbum gerencia`.

### CHG-08 — Consolidación del modelo público de entregas (decisión pendiente)
- Decidir si `delivery_ceiling`/`public_delivery_plan` reemplaza a `equipment_purchase_requests.delivery_*` o viceversa.
- No se ejecuta hasta que se defina.

### CHG-09 — Timeline unificado
- Sub-tab Timeline/Auditoría que muestra todos los eventos del expediente (cambios de estado, subida de documentos, firmas, bloqueos resueltos).
- Fuente: tabla de auditoría existente + state-machine notifications.

### CHG-10 — Campos SERCOP en compra pública
- Agregar 15 campos a `equipment_purchase_requests` para auditoría legal completa del proceso SERCOP.
- Ver sección 3.5 para la lista completa con prioridades.
- Incluye: `procedure_type`, `soce_process_code`, `entidad_contratante_name`, `adjudicacion_resolution_number`, `orden_compra_number`, `puja_final_price`, entre otros.

---

## 9. Archivos confirmados en codebase (verificado 2026-05-09)

| Ruta confirmada | Estado |
|---|---|
| `servicio/pages/TecnicoPrivatePurchases.jsx` | Existe — eliminar (CHG-01) |
| `servicio/pages/PrivatePurchaseDeliveries.jsx` | Existe — migrar a sub-tab Técnica (CHG-02) |
| `servicio/pages/TechnicalProcedureWorkspace.jsx` | Existe — embeber en sub-tab Técnica (CHG-05) |
| `logistica/pages/LogisticaPrivatePurchases.jsx` | Existe — migrar a sub-tab Logística (CHG-02) |
| `backoffice/pages/PrivatePurchases.jsx` | Existe — migrar a workspace (CHG-04) |
| `backoffice/pages/PrivatePurchaseActions.jsx` | Existe — migrar lógica de acciones a ActionGate (CHG-04) |
| `servicio/components/TrainingWorkflowWorkspace.jsx` | Existe — embeber en sub-tab Entrenamiento (CHG-06) |
| `servicio/components/EntrenamientoStepper.jsx` | Existe — sub-tab Entrenamiento |
| `servicio/components/AsistenciaStepper.jsx` | Existe — sub-tab Entrenamiento |
| `shared/purchases-workspace/PurchasesWorkspace.jsx` | Existe — base del workspace unificado |
| `comercial/pages/EquipmentPurchases.jsx` | Existe — migrar pista SOCE a sub-tab Comercial |
| `gerencia/PurchasesAlbumPage.jsx` | Existe — conservar standalone |

---

## 9. Cómo usar este documento

1. Revisa secciones **3, 4 y 5** para validar que el flujo descrito coincide con lo que se debe ejecutar en operación.
2. Si encuentras un paso, rol o ramificación faltante o incorrecta, anótalo en el bloque correspondiente.
3. Revisa la sección **8** y marca cada CHG con:
   - ✅ aprobado tal cual
   - ✏️ ajustar (describe el ajuste)
   - ❌ no hacer
   - ➕ agregar nuevo CHG
4. Una vez consensuado el documento, los cambios se ejecutan en el código en el orden propuesto (CHG-01 → CHG-09).

---

*Última actualización: 2026-05-08. Generado a partir de inspección directa del repo `FamSPI`.*
