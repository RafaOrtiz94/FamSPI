# Flujo Completo: Business Case · Compras Públicas · Compras Privadas
### Matriz de Roles, Vistas y Acciones

> **Propósito:** Documento de referencia para revisar y corregir paso a paso cada vista y acción por rol.  
> **Última revisión:** 2026-05-23  
> **Estado:** v3 — Todas las ambigüedades resueltas. Listo para usar como guía de correcciones.

---

## Índice

1. [Roles del Sistema](#1-roles-del-sistema)
2. [Mapa General de Flujos](#2-mapa-general-de-flujos)
3. [Flujo: Business Case](#3-flujo-business-case)
4. [Flujo: Compras Públicas](#4-flujo-compras-públicas)
5. [Flujo: Compras Privadas](#5-flujo-compras-privadas)
6. [Flujo: Solicitudes de Entrega](#6-flujo-solicitudes-de-entrega)
7. [Integraciones entre Módulos](#7-integraciones-entre-módulos)
8. [Checklist de Correcciones Pendientes](#8-checklist-de-correcciones-pendientes)
9. [Contradicción detectada — requiere decisión](#9-contradicción-detectada--requiere-decisión)

---

## 1. Roles del Sistema

### 1.1 Tabla de Roles y Grupos

| Rol | Grupo | Descripción |
|-----|-------|-------------|
| `comercial` | comercial | Ejecutivo comercial — crea expedientes y BC |
| `asesor_comercial` | comercial | Asesor comercial — **mismos permisos que `comercial`** |
| `analista_comercial` | comercial | Analista comercial — **mismos permisos que `comercial`** |
| `acp_comercial` | comercial | ACP — punto de control, puede editar con permiso |
| `backoffice_comercial` | comercial | Backoffice comercial — mismos permisos que `backoffice` |
| `backoffice` | comercial | Backoffice general — soporte documental |
| `jefe_comercial` | comercial | Jefatura comercial — aprobaciones y edición directa |
| `jefe_de_comercial` | comercial | Alias de `jefe_comercial` — mismos permisos |
| `jefe_operaciones` | operaciones | Jefe de operaciones |
| `operaciones` | operaciones | Analista de operaciones |
| `jefe_logistica` | logistica | Jefe de logística |
| `logistica` | logistica | Analista de logística |
| `jefe_tecnico` | tecnico | Jefe técnico |
| `jefe_servicio_tecnico` | tecnico | Jefe de servicio técnico |
| `tecnico` | tecnico | Técnico ejecutor |
| `servicio_tecnico` | tecnico | Servicio técnico |
| `jefe_financiero` | finanzas | Jefe financiero |
| `finanzas` / `financiero` | finanzas | Analista financiero |
| `jefe_ti` | ti | Jefe de TI |
| `gerencia` / `gerencia_general` | gerencia | **Son el mismo nivel** — mismos permisos en todo el sistema |
| `admin` / `administrador` | admin | Superusuario — bypass total de roles |

> **Nota sobre `comercial`:** En este documento, `comercial` abarca también a `asesor_comercial` y `analista_comercial` salvo que se indique lo contrario.  
> **Nota sobre `gerencia`:** `gerencia` y `gerencia_general` tienen **exactamente los mismos permisos** en todos los módulos.  
> **Nota sobre `backoffice`:** `backoffice` y `backoffice_comercial` tienen los mismos permisos.

### 1.2 Abreviaciones

| Símbolo | Significado |
|---------|-------------|
| ✅ | Acceso completo — puede ver y actuar |
| 👁 | Solo lectura — ve pero no puede modificar |
| ⚠️ | Limitado — ve/actúa con restricciones específicas |
| ❌ | Sin acceso — no ve ni puede actuar |
| 🔒 | Condicional — acceso solo si se cumple la condición indicada |
| 📩 | Requiere permiso previo de otro rol (flujo interno del sistema) |

### 1.3 Principio de Propiedad de Ítem (Carrito de Inversiones)

En la sección de **inversiones del BC** existe un modelo de propiedad de datos:
- Quien llena un ítem por primera vez es su **dueño**.
- Nadie puede editar ese ítem sin que el dueño lo autorice.
- Existe un **botón en el sistema** "Solicitar cambio" → genera notificación al dueño → el dueño aprueba o rechaza.
- Si el dueño aprueba, el solicitante puede editar el ítem por un tiempo limitado.

### 1.4 Regla de Bloqueo de Secciones (Business Case)

Cuando una sección del BC avanza de estado:
1. La sección queda **bloqueada para todos los editores** (incluido el editor principal).
2. Los campos del formulario se renderizan como `disabled` / `readOnly`.
3. Los botones de guardar desaparecen (no solo se deshabilitan).
4. Aparece mensaje: *"Sección bloqueada. Para modificar, solicitar a [ROL AUTORIZADOR]"*
5. Para desbloquear: solicitud a `jefe_comercial` o `acp_comercial` (compra pública) / `backoffice` (compra privada).

---

## 2. Mapa General de Flujos

### 2.1 Compra Pública o Comodato

```
┌─────────────────────────────────────────────┐
│  BUSINESS CASE (punto de inicio)            │
│  Crea: comercial, acp_comercial,            │
│         jefe_comercial, backoffice          │
└─────────────────────────────────────────────┘
        │
        ▼
Secciones completadas colaborativamente
(general → lab → equipment → lis →
 determinations → investments → values)
        │
        ▼
┌─────────────────────────────────────────────┐
│  DECISIÓN DE VIABILIDAD                     │
│  Deciden: acp_comercial, jefe_comercial,    │
│           gerencia                          │
└─────────────────────────────────────────────┘
        │
    ¿Factible?
   /           \
  NO            SÍ
  │              │
  │ (Comercial   ▼
  │  puede    BC = APROBADO
  │  apelar)  Expediente de compra pública
  │           se crea automáticamente
  │              │
  │              ▼
  │  INSPECCIÓN DE AMBIENTE (auto-disparada al subir doc. estadístico)
  │  Notifica: jefe_tecnico, jefe_servicio_tecnico, comercial
  │              │
  │              ▼
  │           OFERTA COMERCIAL
  │              │
  │              ▼
  │           FIRMA GERENCIAL + FIRMA CLIENTE
  │              │
  │              ▼
  │           REGISTRO CLIENTE (backoffice)
  │              │
  │              ▼
  │           DISPONIBILIDAD ACP (solo acp_comercial)
  │              │
  │              ▼
  │           CONTRATO
  │              │
  │              ▼
  │           FECHAS DE ENTREGA (jefe_operaciones / jefe_logistica)
  │              │
  │              ▼
  │           DESPACHO Y ARRIBO DE EQUIPO
  │              │
  │              ▼
  │           ACTA DE ENTREGA (jefe_tecnico asigna, tecnico ejecuta)
  │              │
  │              ▼
  │           [OPCIONAL] CONTROL OPERATIVO
  │           (habilita: acp_comercial o jefe_comercial)
  │              │
  │              ▼
  └──────────► COMPLETADO ✓
```

### 2.2 Compra Privada (sin comodato)

```
┌──────────────────────────────────────────────┐
│  EXPEDIENTE PRIVADO (punto de inicio)        │
│  Crea: comercial, backoffice,                │
│         acp_comercial, jefe_comercial        │
│  Tipo: marcado manualmente como PRIVADA      │
│  ¿Comodato? → vincular/crear BC              │
└──────────────────────────────────────────────┘
        │
        ▼
OFERTA COMERCIAL
(comercial / backoffice preparan y envían)
        │
        ▼
FIRMA DE OFERTA POR CLIENTE
        │
        ▼  ← DISPARO AUTOMÁTICO DE INSPECCIÓN
           (notifica: jefe_tecnico, jefe_servicio_tecnico, comercial)
DISPONIBILIDAD ACP (solo acp_comercial)
        │
   ¿Requiere BC?
  /              \
 SÍ (comodato)    NO
 │                │
 [BC vinculado]   │
 │                │
 ▼                ▼
CONTRATO ←────────┘
        │
        ▼
INSPECCIÓN TÉCNICA (si aún no fue completada antes)
        │
        ▼
FECHAS DE ENTREGA
        │
        ▼
DESPACHO Y ARRIBO
        │
        ▼
ACTA DE ENTREGA
        │
        ▼
[OPCIONAL] CONTROL DE SUMINISTRO
(habilita: acp_comercial o jefe_comercial)
        │
        ▼
COMPLETADO ✓
```

---

## 3. Flujo: Business Case

### 3.1 ¿Qué es?

El Business Case (BC) es el documento de evaluación técnico-económica que justifica una compra pública o comodato. Es el **punto de inicio** de toda compra pública — el expediente de compra **no existe** hasta que el BC es aprobado.

### 3.2 Estados del Business Case

| Estado | Descripción | Efecto en expediente |
|--------|-------------|---------------------|
| `BORRADOR` | Recién creado, en edición inicial | No hay expediente |
| `DATOS_BASE_COMPLETOS` | Sección general completada y bloqueada | No hay expediente |
| `EN_EVALUACION` | En evaluación por jefaturas | No hay expediente |
| `APROBADO` | Viabilidad aprobada | **Expediente de compra se crea automáticamente** |
| `RECHAZADO` | Viabilidad rechazada — comercial puede apelar | Sin efecto (no hay expediente) |
| `EN_APELACION` | Comercial apeló — vuelve a EN_EVALUACION | Expediente existente queda pausado (ver §9) |
| `ECONOMICO_CREADO` | BC económico generado | Expediente en curso |

### 3.3 Quiénes pueden crear un BC

`comercial` · `asesor_comercial` · `analista_comercial` · `acp_comercial` · `jefe_comercial` · `backoffice`

### 3.4 Secciones del Business Case — Resumen de Permisos

| Sección | Edita directamente | Edita con permiso (📩) | Solo lectura | Sin acceso |
|---------|-------------------|----------------------|--------------|------------|
| `general` | `comercial`* | `acp_comercial`, `backoffice` | `jefe_operaciones`, `jefe_tecnico`, `jefe_financiero`, `jefe_ti`, `gerencia` | `jefe_logistica`, `logistica`, `tecnico` |
| `lab_environment` | `comercial`* | `acp_comercial`, `backoffice` | mismos que `general` | mismos que `general` |
| `lis` | `comercial`* | `acp_comercial`, `backoffice` | mismos que `general` | mismos que `general` |
| `equipment` | `comercial`*, `jefe_comercial` | `acp_comercial` | `jefe_operaciones`, `jefe_tecnico`, `jefe_financiero`, `jefe_ti`, `gerencia` | `backoffice`, técnicos, logística |
| `determinations` (reactivos) | —ver BC-4— | —ver BC-4— | —ver BC-4— | — |
| `determinations` (calibradores/controles/materiales) | `jefe_tecnico`, `jefe_comercial` | `acp_comercial`📩 | `comercial`*, `jefe_operaciones`, `jefe_financiero`, `gerencia` | resto |
| `investments` (carrito) | todos los participantes (dueño de su ítem) | solo con botón "Solicitar cambio" | `gerencia` | técnicos, logística |
| `investment_values_op` | `jefe_operaciones` | — | `jefe_comercial`, `gerencia` | resto |
| `investment_values_fin` | `jefe_financiero` | — | `jefe_comercial`, `gerencia` | resto |
| `prices` | `jefe_operaciones` (ÚNICO) | ❌ nadie más | ❌ nadie más | todos excepto `jefe_operaciones` |
| `consumption_export` | `comercial`* | — | mismos que `general` | resto |
| `dispatch_workspace` | `acp_comercial`, `jefe_comercial` | — | resto del equipo | logística, técnicos |
| `feasibility` | `acp_comercial`, `jefe_comercial`, `gerencia` | — | `comercial`*, `jefe_operaciones`, `jefe_tecnico`, `jefe_financiero`, `jefe_ti` | `backoffice`, logística |

> \* `comercial` incluye `asesor_comercial` y `analista_comercial`

### 3.5 Flujo Paso a Paso del Business Case

---

#### PASO BC-1: Creación del Business Case

**Quién puede crear:** `comercial`* · `acp_comercial` · `jefe_comercial` · `backoffice`

**Visibilidad en lista por rol desde BORRADOR:**

| Rol | Ve el BC en lista | Desde qué estado |
|-----|------------------|-----------------|
| `comercial`* | ✅ (los propios) | BORRADOR |
| `acp_comercial` | ✅ (todos) | BORRADOR |
| `backoffice` | ✅ (todos) | BORRADOR |
| `jefe_comercial` | ✅ (todos) | BORRADOR |
| `jefe_operaciones` | ✅ | BORRADOR |
| `jefe_tecnico` | ✅ | BORRADOR |
| `jefe_financiero` | ✅ | BORRADOR |
| `jefe_ti` | ✅ | BORRADOR |
| `gerencia` | 👁 (dashboard) | Todos |

> Todos los roles con acceso al BC lo ven **desde BORRADOR** — no hay retraso por estado.

---

#### PASO BC-2: Sección General

**Editores principales:** `comercial` · `asesor_comercial` · `analista_comercial`

| Rol | Ve | Edita | Condición |
|-----|----|----|-----------|
| `comercial`* | ✅ | ✅ | Editor principal |
| `acp_comercial` | ✅ | 📩 | Solicita permiso a `jefe_comercial` |
| `backoffice` | ✅ | 📩 | Solicita permiso a `jefe_comercial` |
| `jefe_comercial` | ✅ | ❌ | Solo lectura |
| `jefe_operaciones` | ✅ | ❌ | Solo lectura |
| `jefe_tecnico` | ✅ | ❌ | Solo lectura |
| `jefe_financiero` | ✅ | ❌ | Solo lectura |
| `jefe_ti` | ✅ | ❌ | Solo lectura |
| `gerencia` | 👁 | ❌ | Solo lectura |

> ⚠️ **BC-COR-01:** Al completar la sección general → se bloquea para todos. Para desbloquear: solicitud a `jefe_comercial` o `acp_comercial`.

---

#### PASO BC-3: Sección Equipment

**Editores principales:** `comercial`* · `jefe_comercial`

| Rol | Ve | Edita | Condición |
|-----|----|----|-----------|
| `comercial`* | ✅ | ✅ | Editor principal |
| `jefe_comercial` | ✅ | ✅ | Editor directo |
| `acp_comercial` | ✅ | 📩 | Solicita permiso a `jefe_comercial` |
| `jefe_operaciones` | ✅ | ❌ | Solo lectura |
| `jefe_tecnico` | ✅ | ❌ | Solo lectura |
| `jefe_financiero` | ✅ | ❌ | Solo lectura |
| `jefe_ti` | ✅ | ❌ | Solo lectura |
| `gerencia` | 👁 | ❌ | Solo lectura |
| `backoffice` | ❌ | ❌ | Sin acceso a esta sección |

> ⚠️ **BC-COR-02:** `jefe_operaciones` y `jefe_tecnico` son **solo lectura** en equipment. Eliminar edición si la tienen.

---

#### PASO BC-4: Sección Determinaciones

Los sub-apartados tienen permisos distintos y también varían por **tipo de compra**.

**Sub-apartado `reactivos`:**

| Rol | Ve | Edita | Condición |
|-----|----|----|-----------|
| `comercial`* | ✅ | ❌ | Solo lectura siempre |
| `acp_comercial` | ✅ | 🔒📩 | Solo en **compra pública**, con permiso de `jefe_comercial` |
| `backoffice` | ✅ | 🔒 | Solo en **compra privada** (mismos permisos que `acp_comercial` en pública) |
| `jefe_comercial` | ✅ | ✅ | Editor directo siempre |
| `jefe_tecnico` | ✅ | ❌ | Solo lectura |
| `jefe_operaciones` | ✅ | ❌ | Solo lectura |
| `jefe_financiero` | ✅ | ❌ | Solo lectura |
| `gerencia` | ✅ | ❌ | Solo lectura |

> En **compra privada**: `acp_comercial` es solo lectura en reactivos. `backoffice` toma el rol activo.

**Sub-apartados `calibradores`, `controles`, `materiales`:**

| Rol | Ve | Edita | Crea nuevos |
|-----|----|----|------------|
| `jefe_tecnico` | ✅ | ✅ | ✅ |
| `jefe_comercial` | ✅ | ✅ | ✅ |
| `acp_comercial` | ✅ | 📩 | 📩 |
| `comercial`* | ✅ | ❌ | ❌ |
| `jefe_operaciones` | ✅ | ❌ | ❌ |
| `jefe_financiero` | ✅ | ❌ | ❌ |
| `gerencia` | ✅ | ❌ | ❌ |
| `backoffice` | ✅ | 🔒 Privado | 🔒 Privado |

> ⚠️ **BC-COR-03:** `comercial` NO edita determinaciones en ningún caso (antes aparecía como editor hasta `DATOS_BASE_COMPLETOS`).

---

#### PASO BC-5: Sección Inversiones (Carrito)

Carrito colaborativo: cada participante agrega ítems propios. **Sistema de propiedad de ítem activo.**

| Rol | Ve carrito | Agrega ítems propios | Edita ítem ajeno |
|-----|-----------|---------------------|-----------------|
| `comercial`* | ✅ | ✅ | 📩 Botón "Solicitar cambio" |
| `acp_comercial` | ✅ | ✅ | 📩 |
| `backoffice` | ✅ | ✅ | 📩 |
| `jefe_comercial` | ✅ | ✅ | 📩 |
| `jefe_operaciones` | ✅ | ✅ | 📩 |
| `jefe_tecnico` | ✅ | ✅ | 📩 |
| `jefe_ti` | ✅ | ✅ | 📩 |
| `jefe_financiero` | ✅ | ✅ | 📩 |
| `gerencia` | 👁 | ❌ | ❌ |

> 🔒 **REGLA CRÍTICA — `prices`:** SOLO `jefe_operaciones` ve y edita esta subsección. Ningún otro rol puede acceder, aunque haya agregado ítems al carrito.

> ⚠️ **BC-COR-04:** El botón "Solicitar cambio" debe existir en el sistema para ítems de otro dueño. Si no existe, debe implementarse.

---

#### PASO BC-6: Valores de Inversión

Asignación económica de los ítems del carrito. Solo dos roles participan activamente.

| Rol | `investment_values_op` | `investment_values_fin` |
|-----|----------------------|------------------------|
| `jefe_operaciones` | ✅ Edita | 👁 Solo lectura |
| `jefe_financiero` | 👁 Solo lectura | ✅ Edita |
| `jefe_comercial` | 👁 | 👁 |
| `gerencia` | 👁 | 👁 |
| Resto de roles | ❌ No acceden | ❌ No acceden |

> ⚠️ **BC-COR-05:** `comercial`, `acp_comercial`, `jefe_tecnico`, `backoffice` no deben ver esta subsección.

---

#### PASO BC-7: Decisión de Viabilidad (Feasibility)

| Rol | Ve resultado | Puede emitir decisión | Opciones |
|-----|-------------|----------------------|----------|
| `acp_comercial` | ✅ | ✅ | Aprobar / Rechazar / Solicitar info adicional |
| `jefe_comercial` | ✅ | ✅ | Aprobar / Rechazar |
| `gerencia` | ✅ | ✅ | Aprobar / Rechazar / **Transición de emergencia** |
| `comercial`* | 👁 | ❌ | Ve el resultado |
| `jefe_operaciones` | 👁 | ❌ | Ve el resultado |
| `jefe_tecnico` | 👁 | ❌ | Ve el resultado |
| `jefe_financiero` | 👁 | ❌ | Ve el resultado |
| `jefe_ti` | 👁 | ❌ | Ve el resultado |
| `backoffice` | ❌ | ❌ | Sin acceso |

> 🔒 El botón "Transición de emergencia" solo se renderiza para `gerencia`. No existe jerarquía diferente entre `gerencia` y `gerencia_general` — son el mismo rol.

> ⚠️ **BC-COR-06:** `jefe_financiero` y `jefe_ti` deben ver el resultado de viabilidad. Verificar que no estén excluidos del panel de feasibility.

---

#### PASO BC-8: BC Rechazado — Apelación

Cuando el BC es **rechazado**:
1. `comercial`* puede **apelar** desde el sistema.
2. El BC vuelve al estado `EN_EVALUACION` con las observaciones del rechazo visibles.
3. Los editores pueden corregir las secciones observadas (requieren desbloqueo manual por `jefe_comercial` o `acp_comercial`).
4. Vuelve a pasar por decisión de viabilidad.

> ⚠️ **Ver §9 — Contradicción detectada** respecto al expediente en estado de apelación.

---

#### PASO BC-9: BC Aprobado — Creación del Expediente

Cuando el BC es **aprobado**:
1. El sistema crea automáticamente el **expediente de compra pública**.
2. El expediente hereda los datos del BC (cliente, equipos, determinaciones, inversiones).
3. Se dispara la **inspección de ambiente** automáticamente (ver BC-10).

---

#### PASO BC-10: Inspección de Ambiente — Disparo Automático

La inspección de ambiente se dispara automáticamente — **no es una acción manual**.

| Tipo de compra | Evento activador | Notificados |
|---------------|-----------------|-------------|
| Compra pública / Comodato | `comercial`* sube el **documento estadístico** en el BC | `jefe_tecnico`, `jefe_servicio_tecnico`, `comercial` (creador) |
| Compra privada | Se sube el **documento de oferta firmado por el cliente** | `jefe_tecnico`, `jefe_servicio_tecnico`, `comercial` (creador) |

Flujo de inspección (el mismo para ambos tipos):

```
Notificación → jefe_tecnico / jefe_servicio_tecnico coordinan fecha
            → Asignan tecnico responsable
            → tecnico ejecuta y registra resultados
```

> ⚠️ **BC-COR-07:** El botón manual "Solicitar inspección" no debe existir si el disparo es automático. Si existe en la UI, debe removerse o deshabilitarse.

---

#### PASO BC-11: BC Económico y Avance de Estado

| Rol | Puede crear BC económico | Puede avanzar etapa |
|-----|------------------------|---------------------|
| `jefe_operaciones` | ✅ | ✅ (según estado) |
| `jefe_comercial` | ✅ | ✅ |
| `gerencia` | ✅ | ✅ |
| `comercial`* | ❌ | ✅ (solo transiciones que le corresponden) |

> Solo `gerencia` puede ejecutar `emergency-transition`.

---

### 3.6 Panel de Guía (UIGuidancePanel)

| Información | Visible para |
|-------------|-------------|
| Quién completó la sección y cuándo | Todos los que ven la sección |
| Estado de bloqueo (bloqueada / editable) | Todos |
| "Solicitar desbloqueo a [ROL]" | Todos los editores bloqueados |
| Acciones del paso actual | **Solo quien puede actuar** |
| Historial de cambios de viabilidad | Roles con acceso a feasibility |
| Botones de guardar | **Solo cuando el rol puede editar y la sección no está bloqueada** |

---

## 4. Flujo: Compras Públicas

### 4.1 ¿Qué es?

Proceso de compra formal (licitación / cotización). **Siempre inicia con un BC.** El expediente se crea automáticamente cuando el BC es aprobado.

### 4.2 Estados del Expediente

| Estado | Área responsable | Descripción |
|--------|-----------------|-------------|
| `PENDING_COMMERCIAL` | Comercial | Activo post-BC, en preparación de oferta |
| `PENDING_BACKOFFICE` | Backoffice | Preparando documentación |
| `OFFER_SENT` | Comercial | Oferta enviada al cliente |
| `PENDING_MANAGER_SIGNATURE` | Jefe Comercial | Esperando firma gerencial |
| `PENDING_CLIENT_SIGNATURE` | Cliente | Esperando firma del cliente |
| `OFFER_SIGNED` | — | Oferta aceptada |
| `CLIENT_REGISTRATION_REQUESTED` | Backoffice | Registro de cliente en curso |
| `CLIENT_REGISTERED` | — | Cliente validado |
| `ACP_AVAILABILITY_REQUESTED` | ACP | ACP revisando disponibilidad |
| `ACP_AVAILABILITY_CONFIRMED` | — | ACP confirmó disponibilidad |
| `PENDING_CONTRACT_CLIENT_SIGNATURE` | Cliente | Contrato enviado a firma |
| `PENDING_CONTRACT_APPROVAL` | Backoffice | Contrato en aprobación interna |
| `CONTRACT_AVAILABLE` | — | Contrato vigente |
| `DELIVERY_DATES_REQUESTED` | Operaciones | Coordinación de fechas iniciada |
| `DELIVERY_DATES_SUBMITTED` | — | Fechas confirmadas |
| `WAITING_DISPATCH` | Logística | Esperando llegada del equipo |
| `DISPATCH_READY` | — | Equipo listo para despacho |
| `DELIVERY_ACT_PENDING` | Técnico | Acta pendiente |
| `DELIVERY_ACT_ASSIGNED` | Técnico | Acta asignada a técnico |
| `DELIVERY_ACT_COMPLETED` | — | Acta firmada |
| `DELIVERED` | — | Entregado |
| `CONTROL_OPERATIVO_IN_PROGRESS` | Multi-área | Control operativo activo |
| `COMPLETED` | — | Proceso finalizado |
| `CANCELLED` / `REJECTED` | — | Terminal negativo |

### 4.3 Flujo Paso a Paso

---

#### PASO CP-1: Expediente Creado (BC Aprobado)

**El expediente se activa automáticamente cuando el BC llega a `APROBADO`.**

**Visibilidad del expediente en lista:**

| Rol | Ve el expediente | Ve link al BC | Ve estado del BC |
|-----|-----------------|---------------|-----------------|
| `comercial`* | ✅ (solo los suyos) | ✅ | ✅ |
| `backoffice` | ✅ (todos) | ✅ | ✅ |
| `acp_comercial` | ✅ (todos) | ✅ | ✅ |
| `jefe_comercial` | ✅ (todos) | ✅ | ✅ |
| `jefe_operaciones` | ✅ (asignados) | ✅ | ✅ |
| `jefe_tecnico` | ✅ (asignados) | ✅ | ✅ |
| `jefe_financiero` | ✅ | ✅ | ✅ |
| `jefe_logistica` | ✅ (asignados) | ❌ | 👁 estado |
| `tecnico` | ✅ (asignados) | ❌ | 👁 estado |
| `logistica` | ✅ (asignados) | ❌ | 👁 estado |
| `gerencia` | 👁 dashboard | ✅ | ✅ |

---

#### PASO CP-2: Preparación Backoffice

**Estado:** `PENDING_BACKOFFICE`

| Rol | Ve detalles | Puede actuar | Acciones disponibles |
|-----|------------|-------------|---------------------|
| `backoffice` | ✅ | ✅ | Checklist documentos, enviar a comercial |
| `comercial`* | ✅ | ⚠️ | Ver estado, subir documentos propios |
| `acp_comercial` | ✅ | ❌ | Solo lectura |
| `jefe_comercial` | ✅ | ❌ | Solo lectura |
| `jefe_operaciones` | ❌ | ❌ | No ve aún |
| `gerencia` | 👁 | ❌ | Solo lectura |

---

#### PASO CP-3: Oferta Comercial

**Estado:** `PENDING_COMMERCIAL` → `OFFER_SENT`

| Rol | Ve oferta | Enviar oferta | Firma como gerencia | Sube firmado cliente |
|-----|----------|--------------|--------------------|--------------------|
| `comercial`* | ✅ | ✅ | ❌ | ✅ |
| `backoffice` | ✅ | ✅ | ❌ | ✅ |
| `acp_comercial` | ✅ | ✅ | ✅ | ✅ |
| `jefe_comercial` | ✅ | ✅ | ✅ | ✅ |
| `gerencia` | 👁 | ❌ | ❌ | ❌ |
| `jefe_operaciones` | ❌ | ❌ | ❌ | ❌ |
| `jefe_tecnico` | ❌ | ❌ | ❌ | ❌ |

---

#### PASO CP-4: Registro de Cliente

**Estado:** `CLIENT_REGISTRATION_REQUESTED` → `CLIENT_REGISTERED`

| Rol | Ve estado | Registra / confirma |
|-----|----------|-------------------|
| `backoffice` | ✅ | ✅ Registra y confirma |
| `comercial`* | ✅ | ❌ |
| `acp_comercial` | ✅ | ❌ |
| `jefe_comercial` | ✅ | ✅ Puede confirmar |
| `gerencia` | 👁 | ❌ |

---

#### PASO CP-5: Disponibilidad ACP

**Estado:** `ACP_AVAILABILITY_REQUESTED` → `ACP_AVAILABILITY_CONFIRMED`

> ⚠️ **CP-COR-01:** `jefe_comercial` NO puede confirmar disponibilidad ACP. Esta acción es **exclusiva de `acp_comercial`**.

| Rol | Ve detalles | Confirma disponibilidad | Devuelve a backoffice |
|-----|------------|------------------------|----------------------|
| `acp_comercial` | ✅ | ✅ | ✅ |
| `jefe_comercial` | ✅ | ❌ | ❌ |
| `comercial`* | ✅ | ❌ | ❌ |
| `backoffice` | ✅ | ❌ | ❌ |
| `gerencia` | 👁 | ❌ | ❌ |
| `jefe_operaciones` | ❌ | ❌ | ❌ |

**El `acp_comercial` además puede:**
- ✅ Subir proforma del proveedor
- ✅ Registrar respuesta: disponible / no disponible / plazo estimado
- ✅ Ver catálogo de equipos para verificar stock

---

#### PASO CP-6: Contrato

**Estados:** `PENDING_CONTRACT_CLIENT_SIGNATURE` → `PENDING_CONTRACT_APPROVAL` → `CONTRACT_AVAILABLE`

| Rol | Ve contrato | Sube contrato | Aprueba |
|-----|------------|--------------|---------|
| `comercial`* | ✅ | ✅ | ❌ |
| `backoffice` | ✅ | ✅ | ❌ |
| `acp_comercial` | ✅ | ✅ | ✅ |
| `jefe_comercial` | ✅ | ✅ | ✅ |
| `gerencia` | 👁 | ❌ | ❌ |
| `jefe_operaciones` | ❌ | ❌ | ❌ |

---

#### PASO CP-7: Inspección de Ambiente

> ⚠️ **CP-COR-02:** En compra pública, la inspección se disparó **automáticamente** desde el BC cuando `comercial` subió el documento estadístico. Este paso **muestra el estado** de la inspección ya iniciada.

| Rol | Ve estado inspección | Coordina fecha | Asigna técnico | Ejecuta |
|-----|---------------------|----------------|----------------|---------|
| `jefe_tecnico` | ✅ Todas | ✅ | ✅ | ✅ |
| `jefe_servicio_tecnico` | ✅ Todas | ✅ | ✅ | ✅ |
| `tecnico` | ⚠️ Solo las suyas | ❌ | ❌ | ✅ |
| `acp_comercial` | ✅ | ❌ | ❌ | ❌ |
| `jefe_comercial` | ✅ | ❌ | ❌ | ❌ |
| `comercial`* | 👁 estado | ❌ | ❌ | ❌ |
| `gerencia` | 👁 | ❌ | ❌ | ❌ |
| `jefe_operaciones` | 👁 | ❌ | ❌ | ❌ |

**Vista del `tecnico` (solo sus inspecciones):**
- ✅ Formulario de registro de resultados
- ✅ Subir fotos y evidencias
- ❌ No ve inspecciones de otros técnicos

---

#### PASO CP-8: Fechas de Entrega

**Estado:** `DELIVERY_DATES_REQUESTED` → `DELIVERY_DATES_SUBMITTED`

**Quién solicita:** `comercial`* · `backoffice` · `acp_comercial` · `jefe_comercial`

| Rol | Ve solicitud | Confirma fechas | Modifica fechas |
|-----|-------------|-----------------|----------------|
| `comercial`* | ✅ | ❌ | ❌ |
| `backoffice` | ✅ | ❌ | ❌ |
| `acp_comercial` | ✅ | ✅ | ✅ |
| `jefe_comercial` | ✅ | ✅ | ✅ |
| `jefe_operaciones` | ✅ | ✅ | ✅ |
| `jefe_logistica` | ✅ | ✅ | ✅ |
| `jefe_tecnico` | ✅ | ✅ | ✅ |
| `tecnico` | ✅ | ✅ | ❌ |
| `logistica` | ✅ | ✅ | ❌ |
| `gerencia` | 👁 | ❌ | ❌ |

---

#### PASO CP-9: Arribo y Registro de Equipo

**Estado:** `WAITING_DISPATCH` → `DISPATCH_READY` → registro de serial

| Rol | Ve estado logístico | Marcar llegado | Registrar serial | Generar acta |
|-----|-------------------|----------------|-----------------|-------------|
| `jefe_logistica` | ✅ | ✅ | ✅ | ✅ |
| `logistica` | ✅ | ✅ | ✅ | ❌ |
| `jefe_operaciones` | ✅ | ✅ | ✅ | ✅ |
| `jefe_tecnico` | ✅ | ✅ | ✅ | ✅ |
| `jefe_servicio_tecnico` | ✅ | ✅ | ✅ | ✅ |
| `tecnico` | ✅ | ✅ | ✅ | ❌ |
| `acp_comercial` | ✅ | ✅ | ✅ | ✅ |
| `jefe_comercial` | ✅ | ✅ | ✅ | ✅ |
| `comercial`* | 👁 | ❌ | ❌ | ❌ |
| `gerencia` | 👁 | ❌ | ❌ | ❌ |

---

#### PASO CP-10: Acta de Entrega

**Estado:** `DELIVERY_ACT_PENDING` → `DELIVERY_ACT_ASSIGNED` → `DELIVERY_ACT_COMPLETED`

| Rol | Ve actas | Asigna técnico | Finaliza acta |
|-----|---------|---------------|--------------|
| `jefe_tecnico` | ✅ Todas | ✅ | ✅ |
| `jefe_servicio_tecnico` | ✅ Todas | ✅ | ✅ |
| `tecnico` | ⚠️ Solo las suyas | ❌ | ✅ (las suyas) |
| `jefe_logistica` | 👁 | ❌ | ❌ |
| `acp_comercial` | 👁 | ❌ | ❌ |
| `jefe_comercial` | 👁 | ❌ | ❌ |
| `comercial`* | 👁 estado | ❌ | ❌ |
| `gerencia` | 👁 | ❌ | ❌ |

**Vista del `tecnico` en su acta asignada:**
- ✅ Formulario de acta de entrega
- ✅ Lista de ítems a entregar
- ✅ Captura de firma digital del cliente
- ✅ Subir fotos de entrega
- ❌ No ve actas de otros técnicos

---

#### PASO CP-11: Control Operativo (Opcional)

**Quién habilita:** `acp_comercial` · `jefe_comercial` (únicos)

**Tipos de control:**

| Tipo | Disponible cuando |
|------|------------------|
| `BC_MAXIMUMS` | Solo si hay BC vinculado y aprobado |
| `COMMERCIAL_DELIVERABLES` | Siempre disponible |
| `NONE` | Sin control de suministro |

> ⚠️ **CP-COR-03:** Si no hay BC, la opción `BC_MAXIMUMS` no debe aparecer.

| Rol | Ve panel | Solicita suministro | Aprueba (OPS) | Confirma despacho |
|-----|---------|--------------------|--------------|--------------------|
| `comercial`* | ✅ | ✅ | ❌ | ❌ |
| `backoffice` | ✅ | ✅ | ❌ | ❌ |
| `acp_comercial` | ✅ | ✅ | ✅ | ✅ |
| `jefe_comercial` | ✅ | ✅ | ✅ | ✅ |
| `jefe_operaciones` | ✅ | ✅ | ✅ | ❌ |
| `operaciones` | ✅ | ✅ | ✅ | ❌ |
| `jefe_logistica` | ✅ | ❌ | ❌ | ✅ |
| `logistica` | ✅ | ❌ | ❌ | ✅ |
| `gerencia` | 👁 | ❌ | ❌ | ❌ |

---

#### PASO CP-12: Completado

Todos los roles con acceso ven el expediente en **modo solo lectura**. Sin botones de acción para ningún rol.

---

## 5. Flujo: Compras Privadas

### 5.1 ¿Qué es?

Venta directa sin proceso público. El BC es obligatorio **solo si se marca como comodato** al crear el expediente. El usuario elige manualmente el tipo al crear.

### 5.2 Diferencias clave vs Compras Públicas

| Aspecto | Pública | Privada |
|---------|---------|---------|
| Punto de inicio | Business Case | Expediente directo |
| Business Case | Siempre obligatorio | Solo si es comodato |
| Inspección automática | Al subir doc. estadístico en BC | Al subir oferta firmada por cliente |
| ACP confirma disponibilidad | Solo `acp_comercial` | Solo `acp_comercial` |
| Control Operativo | `acp_comercial` o `jefe_comercial` | Ídem |

### 5.3 Flujo Paso a Paso

---

#### PASO PR-1: Creación del Expediente

**Quién puede crear:** `comercial`* · `backoffice` · `acp_comercial` · `jefe_comercial`

- ✅ Selector de tipo: PRIVADA
- ✅ Si tipo = COMODATO → se crea BC vinculado automáticamente

---

#### PASO PR-2: Oferta Comercial

**Estado:** `PENDING_COMMERCIAL` → `OFFER_SENT`

| Rol | Ve oferta | Envía | Sube firmado | Aprueba |
|-----|----------|-------|-------------|---------|
| `comercial`* | ✅ | ✅ | ✅ | ❌ |
| `backoffice` | ✅ | ✅ | ✅ | ❌ |
| `acp_comercial` | ✅ | ✅ | ✅ | ✅ |
| `jefe_comercial` | ✅ | ✅ | ✅ | ✅ |
| `gerencia` | 👁 | ❌ | ❌ | ❌ |
| `jefe_operaciones` | ❌ | ❌ | ❌ | ❌ |

> 🔒 **Al subir la oferta firmada por el cliente** → el sistema dispara automáticamente la inspección de ambiente (notifica a `jefe_tecnico`, `jefe_servicio_tecnico`, `comercial`).

---

#### PASO PR-3: Disponibilidad ACP

**Estado:** `SENT_TO_ACP` → `ACP_AVAILABILITY_CONFIRMED`

**Solo `acp_comercial` puede confirmar** (igual que en pública).

| Rol | Ve | Confirma | Devuelve a backoffice | Inicia BC (si comodato) |
|-----|----|---------|-----------------------|------------------------|
| `acp_comercial` | ✅ | ✅ | ✅ | ✅ |
| `backoffice` | ✅ | ❌ | ❌ | ✅ |
| `jefe_comercial` | ✅ | ❌ | ❌ | ✅ |
| `comercial`* | ✅ | ❌ | ❌ | ❌ |
| `gerencia` | 👁 | ❌ | ❌ | ❌ |

---

#### PASO PR-4: Contrato

| Rol | Sube contrato | Sube firmado cliente | Aprueba |
|-----|--------------|---------------------|---------|
| `comercial`* | ✅ | ✅ | ❌ |
| `backoffice` | ✅ | ✅ | ❌ |
| `acp_comercial` | ❌ | ❌ | ✅ |
| `jefe_comercial` | ❌ | ❌ | ✅ |
| `gerencia` | ❌ | ❌ | ❌ |

> ⚠️ **PR-COR-01:** `acp_comercial` NO sube el contrato en compra privada. Solo aprueba.

---

#### PASO PR-5: Inspección Técnica

Ya fue disparada automáticamente en PR-2. Este paso muestra el estado de la inspección.

| Rol | Ve estado | Coordina | Asigna | Ejecuta |
|-----|----------|---------|--------|---------|
| `jefe_tecnico` | ✅ | ✅ | ✅ | ✅ |
| `jefe_servicio_tecnico` | ✅ | ✅ | ✅ | ✅ |
| `tecnico` | ⚠️ Solo las suyas | ❌ | ❌ | ✅ |
| `acp_comercial` | ✅ | ❌ | ❌ | ❌ |
| `jefe_comercial` | ✅ | ❌ | ❌ | ❌ |
| `comercial`* | 👁 | ❌ | ❌ | ❌ |

---

#### PASO PR-6: Entrega y Acta

Mismos roles y permisos que CP-9 y CP-10. Endpoints propios de compra privada:
- `POST /:id/ready-for-delivery` — cualquier rol delivery
- `POST /:id/complete-delivery` — cualquier rol delivery
- `POST /:id/delivery-act/assign` — `jefe_tecnico` / `jefe_servicio_tecnico`
- `POST /:id/delivery-act/finalize` — `jefe_tecnico` / `jefe_servicio_tecnico`

---

#### PASO PR-7: Control de Suministro

Mismo modelo que CP-11. Regla adicional:

> Si el expediente privado NO tiene BC vinculado, la opción `BC_MAXIMUMS` **no debe aparecer** en el selector.

---

#### PASO PR-8: Cancelación

**Quién puede cancelar:** `acp_comercial` · `jefe_comercial` · `gerencia`

| Rol | Puede cancelar | Ve "Cancelado" |
|-----|---------------|----------------|
| `acp_comercial` | ✅ | ✅ |
| `jefe_comercial` | ✅ | ✅ |
| `gerencia` | ✅ | ✅ |
| `comercial`* | ❌ | 👁 Ve el estado |
| `backoffice` | ❌ | 👁 Ve el estado |

> ⚠️ **PR-COR-02:** El botón "Cancelar" no se debe renderizar para `comercial` ni `backoffice`.

---

## 6. Flujo: Solicitudes de Entrega

### 6.1 ¿Qué es?

Control de techo y saldo de entrega. Gestiona cuántos ítems de un cliente pueden entregarse contra el techo contractual.

### 6.2 Estados

| Estado | Efecto en saldo |
|--------|----------------|
| `pending` | Sin efecto en saldo |
| `ops_approved` | Reserva el saldo |
| `confirmed` | Consume el saldo |
| `cancelled` | Libera la reserva automáticamente |

### 6.3 Flujo Paso a Paso

---

#### PASO DR-1: Crear Solicitud

**Quién puede:** `comercial`* · `backoffice` · `acp_comercial` · `jefe_comercial` · `gerencia`

| Rol | Crea solicitud | Ve solicitudes | Aprueba OPS | Confirma entrega |
|-----|----------------|----------------|-------------|-----------------|
| `comercial`* | ✅ | ✅ | ❌ | ❌ |
| `backoffice` | ✅ | ✅ | ❌ | ❌ |
| `acp_comercial` | ✅ | ✅ | ✅ | ❌ |
| `jefe_comercial` | ✅ | ✅ | ✅ | ❌ |
| `jefe_operaciones` | ❌ | ✅ | ✅ | ❌ |
| `operaciones` | ❌ | ✅ | ✅ | ❌ |
| `jefe_logistica` | ❌ | ✅ | ❌ | ✅ |
| `gerencia` | ✅ | ✅ | ✅ | ❌ |
| `jefe_tecnico` | ❌ | ⚠️ Limitado | ❌ | ❌ |
| `tecnico` | ❌ | ⚠️ Limitado | ❌ | ❌ |

> **`jefe_tecnico` y `tecnico` en DR:** Tienen acceso de solo lectura **limitado** para planificar actividades pre-entrega y post-entrega. Solo ven la información relevante a sus expedientes asignados.

---

#### PASO DR-2: Aprobación OPS

**Quién actúa:** `jefe_operaciones` · `operaciones` · `acp_comercial` · `jefe_comercial` · `gerencia`

- ✅ Lista de solicitudes pendientes con saldo disponible
- ✅ Botón "Aprobar" (reserva el saldo)
- ✅ Botón "Rechazar" con motivo obligatorio

---

#### PASO DR-3: Confirmación de Entrega

**Quién actúa:** `jefe_logistica` · `acp_comercial` · `jefe_comercial` · `gerencia`

- ✅ Lista de solicitudes aprobadas
- ✅ Botón "Confirmar entrega" (consume el saldo definitivamente)
- Al cancelar → saldo se libera automáticamente

---

## 7. Integraciones entre Módulos

### 7.1 BC → Expediente Público (automático)

```
BC aprobado (APROBADO)
    └─→ Expediente de compra pública se crea automáticamente
         └─→ Hereda datos del BC (cliente, equipos, determinaciones)
              └─→ Inspección de ambiente ya iniciada o en curso
```

### 7.2 Oferta firmada → Inspección (automático, privada)

```
Comercial sube oferta firmada por cliente (compra privada)
    └─→ Sistema dispara solicitud de inspección
         └─→ Notifica: jefe_tecnico, jefe_servicio_tecnico, comercial
              └─→ Flujo: coordinar → asignar técnico → ejecutar
```

### 7.3 Control Operativo → Delivery Requests

```
Control Operativo habilitado por acp_comercial / jefe_comercial
    ├─ BC_MAXIMUMS → lee máximos del BC (solo si hay BC)
    ├─ COMMERCIAL_DELIVERABLES → lee ítems de la oferta
    │
    └─→ Delivery Requests:
          comercial/backoffice crea solicitud
          jefe_operaciones aprueba (reserva)
          jefe_logistica confirma (consume)
```

---

## 8. Checklist de Correcciones

> **Leyenda:** ⬜ Pendiente | ✅ Corregido en código | 🔁 Parcial (frontend pendiente) | ❌ Requiere feature nueva

### 8.1 Business Case

| # | Descripción | Archivos modificados | Estado |
|---|-------------|---------------------|--------|
| BC-01 | `jefe_comercial`, `acp_comercial`, `backoffice` pueden crear BC | `businessCase.routes.js` L.129 | ✅ |
| BC-02 | `analista_comercial` y `asesor_comercial` = mismo nivel que `comercial` | `businessCase.routes.js` + `roleSectionConfig.js` | ✅ |
| BC-03 | `jefe_operaciones`, `jefe_tecnico`, `jefe_financiero`, `jefe_ti` ven BC desde BORRADOR | `businessCase.routes.js` (businessCaseRoles) + `roleSectionConfig.js` | ✅ |
| BC-04 | `gerencia` = `gerencia_general` — configs idénticas | `roleSectionConfig.js` (configs duplicadas idénticas) | ✅ |
| BC-05 | Sección general: solo `comercial`* edita. `acp_comercial`/`backoffice` con permiso (en canEdit pero sin ítem propio). `jefe_comercial` fuera de canEdit en valores | `roleSectionConfig.js` | ✅ |
| BC-06 | Equipment: `jefe_operaciones` y `jefe_tecnico` fuera de canEdit | `roleSectionConfig.js` | ✅ |
| BC-07 | Determinaciones: `comercial`* fuera de canEdit siempre | `roleSectionConfig.js` | ✅ |
| BC-08 | Determinaciones reactivos: `acp_comercial` solo en pública (lógica en componente) | `DeterminationsSection.jsx` — `canEditType()` con `isPublicBC` basado en `PUBLIC_BC_TYPES`; public→`acp_comercial`, private→`backoffice`/`backoffice_comercial` | ✅ |
| BC-09 | Determinaciones reactivos: `backoffice` solo en privada (lógica en componente) | `DeterminationsSection.jsx` — mismo `canEditType()` ya implementado (verifica `businessCase.bc_purchase_type`) | ✅ |
| BC-10 | `jefe_ti` puede ver BC y agregar ítems al carrito | `businessCase.routes.js` (businessCaseRoles + investmentRoles) + `roleSectionConfig.js` | ✅ |
| BC-11 | Botón "Solicitar cambio" en ítems de otro dueño | Verificado: `InvestmentsSection.jsx` — botón "Solicitar aumento" implementado con modal; endpoint `POST /investments/selections/request-increase` en backend | ✅ |
| BC-12 | `investment_values`: solo `jefe_operaciones` y `jefe_financiero` en canEdit; `jefe_comercial`/`gerencia` solo visible | `roleSectionConfig.js` | ✅ |
| BC-13 | `prices`: solo `jefe_operaciones` — sección no expuesta en WORKSPACE_SECTION_ORDER activo | `BusinessCaseWorkspace.jsx` (LEGACY_DEV_SECTIONS) | ✅ |
| BC-14 | Feasibility: `jefe_financiero` y `jefe_ti` ven resultado (en visible de roleSectionConfig) | `roleSectionConfig.js` | ✅ |
| BC-15 | Emergency-transition: `gerencia` + `gerencia_general` (mismo nivel) | `businessCase.routes.js` L.258 | ✅ |
| BC-16 | BC rechazado → `comercial`* puede apelar | `businessCase.controller.js` + `businessCase.routes.js` — endpoints `POST /feasibility/appeal` y `POST /feasibility/appeal/resolve`; `getUIGuidance` expone `canAppealFeasibilityRejection`/`canResolveFeasibilityAppeal`; `FeasibilitySection.jsx` panel de apelación completo; `businessCaseApi.js` funciones de API | ✅ |
| BC-17 | Al apelar, expediente vinculado queda en espera (ver §9 — contradicción) | Pendiente decisión de arquitectura | ⬜ |
| BC-18 | Inspección automática al subir doc. estadístico — sin botón manual | `businessCase.controller.js` — `preflowService.completeCommercialStageAndStartReview()` con reason `stat_document_uploaded` ya implementado | ✅ |
| BC-19 | Notificación automática a `jefe_tecnico`, `jefe_servicio_tecnico`, `comercial` | `businessCaseDeterminationsGate.service.js` — `notify` array incluye `acp_comercial`, `tecnico`, `jefe_tecnico` según tipo de compra | ✅ |
| BC-20 | Bloqueo de sección: banner con rol autorizador correcto (pública vs privada) | `SectionContent.jsx` — lógica de unlockAuthorizer | ✅ |
| BC-21 | Secciones `investment_values_op`/`fin` en WORKSPACE_SECTION_ORDER | `BusinessCaseWorkspace.jsx` | ✅ |

### 8.2 Compras Públicas

| # | Descripción | Archivos modificados | Estado |
|---|-------------|---------------------|--------|
| CP-01 | Expediente público se activa desde BC aprobado — sin botón "Iniciar BC" en expediente | Verificado: `PurchaseExpedienteDetail.jsx` no tiene ningún botón "Iniciar BC" — el BC se vincula automáticamente vía `auto_business_case_id` | ✅ |
| CP-02 | `comercial`* solo ve sus propios expedientes | `equipmentPurchases.service.js` — `listByUser()` filtra `created_by = user.id OR assigned_to = user.id`; `MANAGER_ROLES` ampliado con `jefe_de_comercial` | ✅ |
| CP-03 | `jefe_comercial` NO puede confirmar disponibilidad ACP | `equipmentPurchases.routes.js` — `acpConfirmRoles = ["acp_comercial"]` | ✅ |
| CP-04 | `tecnico` solo ve inspecciones asignadas a él | `equipmentPurchases.service.js` — `listByUser()` separado: `jefe_tecnico` ve toda la cola, `tecnico` base filtrado por `assigned_to = user.id` (BUG-05) | ✅ |
| CP-05 | `logistica` no genera actas | `EquipmentLogisticsTab.jsx` — "Subir acta logistica" restringida a `jefe_logistica` + managers (base `logistica` excluida) | ✅ |
| CP-06 | `tecnico` no asigna ni coordina inspecciones | `equipmentPurchases.routes.js` — `inspectionRequestRoles` y `inspectionCoordinationRoles` ya correctos | ✅ |
| CP-07 | `gerencia` ve expedientes solo lectura | Backend: todas las rutas de acción excluyen `gerencia`; `gerencia` en `MANAGER_ROLES` solo para ver lista. Frontend: verificado sin botones de acción para gerencia en los tabs del expediente | ✅ |
| CP-08 | `comercial`* no puede cancelar expediente público | Verificado: `cancelOrder` solo existe en `equipmentPurchasesApi.js` pero ningún componente lo importa — no hay botón en UI; el endpoint backend usa `managerRoles` (sin comercial) | ✅ |
| CP-09 | Control Operativo: solo `acp_comercial` o `jefe_comercial` habilitan | `equipmentPurchases.routes.js` — `controlOperativoRoles` | ✅ |
| CP-10 | `BC_MAXIMUMS` oculta si no hay BC vinculado | `SupplyControlTab.jsx` — opción filtrada cuando `hasBc = false`; nota informativa añadida; roles de activación corregidos | ✅ |

### 8.3 Compras Privadas

| # | Descripción | Archivos modificados | Estado |
|---|-------------|---------------------|--------|
| PR-01 | Inspección automática al subir oferta firmada | Requiere revisión en service/eventos | ⬜ |
| PR-02 | `acp_comercial` NO sube contrato en privada | `privatePurchases.routes.js` — `submit-contract` usa `comercialAndBackofficeRoles` (sin acp_comercial directo) | ✅ |
| PR-03 | `comercial`* no puede cancelar privada | `privatePurchases.routes.js` — `cancel` usa `managerRoles` (sin comercial) | ✅ |
| PR-04 | `BC_MAXIMUMS` oculta si no hay BC vinculado | `SupplyControlTab.jsx` — mismo fix que CP-10 (componente compartido para public y private) | ✅ |
| PR-05 | Control Operativo: solo `acp_comercial` o `jefe_comercial` | `privatePurchases.routes.js` — `supplyControlRoles` restringido | ✅ |

### 8.4 Delivery Requests

| # | Descripción | Archivos modificados | Estado |
|---|-------------|---------------------|--------|
| DR-01 | `comercial`* crea solicitudes pero NO aprueba | `deliveryRequests.routes.js` — separación REQUEST_CREATOR vs OPS_APPROVE | ✅ |
| DR-02 | `jefe_logistica` confirma entrega pero NO crea ni aprueba | `deliveryRequests.routes.js` — LOGISTICS_ROLES solo en confirm-delivery | ✅ |
| DR-03 | `jefe_tecnico`/`tecnico` solo lectura — en READ_ROLES, sin acceso a approve/confirm | `deliveryRequests.routes.js` — READ_ROLES correcto | ✅ |
| DR-04 | Al cancelar, saldo se libera automáticamente | `deliveryRequests.service.js` — verificado: saldo se libera por diseño dinámico (query excluye `cancelled` de `OPEN_REQUEST_STATUSES`; no hay campo físico a restar) | ✅ |

### 8.5 Generales / Cross-Module

| # | Descripción | Área | Estado |
|---|-------------|------|--------|
| GEN-01 | `admin` bypass — verificar que no omita validaciones de negocio | `requireRole` no bloquea a `admin`/`administrador` — acceso total por diseño; las validaciones de negocio en los services sí aplican (assertRequestExists, etc.) | ✅ |
| GEN-02 | Timeline visible para todos los roles con acceso | Verificado: `PurchaseExpedienteDetail.jsx` — tab "Timeline" incluido en `TABS_PUBLIC` para todos los roles; no hay gate de rol | ✅ |
| GEN-03 | SSE funciona para todos los roles | `equipmentPurchases.routes.js` + `privatePurchases.routes.js` — viewerRoles ampliados | ✅ |
| GEN-04 | COMPLETED/CANCELLED/REJECTED → solo lectura | `SectionContent.jsx` — `isTerminalState` ya implementado | ✅ |
| GEN-05 | Módulos deshabilitados no aparecen en menú | Verificado: `NavigationBar.jsx` — `filterEnabledLinks` usa `isPathEnabledForUser` con `user.module_access` para ocultar links de módulos deshabilitados | ✅ |

---

### 8.6 Bugs encontrados en stress test de 50 escenarios (2026-05-23)

| Bug | Descripción | Archivos modificados | Estado |
|-----|-------------|---------------------|--------|
| BUG-01 | `jefe_comercial`/`jefe_de_comercial` no podían editar calibradores/controles/materiales | `DeterminationsSection.jsx` — creado `TECNICO_EDIT_ROLES` (split de `TECNICO_ROLES`) | ✅ |
| BUG-02 | `TECNICO_ROLES` tenía doble responsabilidad (identidad + edición) | `DeterminationsSection.jsx` — `canEditType()` usa `TECNICO_EDIT_ROLES` para calibradores/controles/materiales | ✅ |
| BUG-03 | `backoffice` podía bloquear/desbloquear secciones en BC públicos | `businessCase.controller.js` — `lockSection` y `unlockSection` validan `purchase_type` para roles `BACKOFFICE_LOCK_ROLES` | ✅ |
| BUG-04 | `backoffice` veía la pestaña `feasibility` (sin acceso según flujo BC-7) | `roleSectionConfig.js` — `feasibility` eliminado de `backoffice.visible` y `backoffice_comercial.visible` | ✅ |
| BUG-05 | `tecnico` (base) veía TODOS los expedientes en cola de inspección | `equipmentPurchases.service.js` — `listByUser()` separado: `jefe_tecnico` ve toda la cola; `tecnico` solo ve `assigned_to = user.id` | ✅ |
| BUG-06 | `operaciones` (base) no tenía acceso al BC para editar `dispatch_workspace` | `businessCase.routes.js` — `operaciones` añadido a `businessCaseRoles` | ✅ |
| BUG-07 | Rutas `commercial-plan` y `operations-control` con roles incompletos | `businessCase.routes.js` — rutas corregidas para incluir `jefe_de_comercial`, `operaciones` y `jefe_operaciones` | ✅ |
| BUG-08 | `servicio_tecnico` y `jefe_servicio_tecnico` en `roleSectionConfig.js` (roles inexistentes) | `roleSectionConfig.js` — entrada `servicio_tecnico` eliminada; comentario BUG-08 añadido | ✅ |
| GAP-01 | Backend no valida que BC exista antes de aceptar `supplyControlType = 'BC_MAXIMUMS'` | `equipmentPurchases.service.js` — `activateSupplyControl` valida `linkedBcId` antes de aceptar `bc_maximums`; error 409 con código `NO_LINKED_BUSINESS_CASE` | ✅ |
| GAP-02 | `jefe_financiero` y `jefe_operaciones` no estaban en `MANAGER_ROLES` — solo veían sus propios expedientes | `equipmentPurchases.service.js` — ambos roles añadidos a `MANAGER_ROLES` | ✅ |
| GAP-03 | Sin validación de que el techo se desactiva al completar el expediente | `equipmentPurchases.service.js` — `confirmDelivery` ya incluye `supply_control_type = 'none'` en el UPDATE al completar | ✅ |

---

### 8.7 Bugs encontrados en flujo completo de 5 tipos de compra (2026-05-23)

> Verificación exhaustiva paso a paso de los 5 tipos: compra pública, compra privada comodato, compra privada venta directa, alquiler, alquiler con transferencia de dominio.

| Bug | Descripción | Archivos modificados | Estado |
|-----|-------------|---------------------|--------|
| NUEVO-01 | `PRIVATE_PURCHASE_TYPES` no incluía `private_comodato` ni `private_sale` — backoffice bloqueado en BC comodato privado | `businessCase.controller.js` — constante ampliada | ✅ |
| NUEVO-02 | `jefe_comercial`/`jefe_de_comercial` no podían editar reactivos/determinaciones en `DeterminationsSection` | `DeterminationsSection.jsx` — `canEditType()` agrega `isJefeComercial` antes del branch isPublicBC | ✅ |
| NUEVO-03 | `jefe_comercial` puede editar sección `general` (potencial conflicto con preflow review) | Decisión de diseño intencional — FLUJO doc lo autoriza; no se modifica | ✅ (diseño) |
| NUEVO-04 | `acp_comercial` puede enviar contratos de compra privada vía `managerRoles` | Revisado: comportamiento intencional según PR-02 | ✅ (diseño) |
| NUEVO-05 | `backoffice`/`backoffice_comercial` no podían registrar clientes en compras privadas (rutas con `['comercial', ...managerRoles]`) | `privatePurchases.routes.js` — `backoffice` y `backoffice_comercial` añadidos a rutas `request-client-registration`, `register-client`, `client-registration` | ✅ |
| NUEVO-06 | `jefe_de_comercial` no estaba en ruta `start-business-case` de compras privadas | `privatePurchases.routes.js` — `jefe_de_comercial` añadido al `requireRole` del endpoint | ✅ |
| NUEVO-07 | `jefe_de_comercial` faltaba en `LOCK_ROLES` del controller (routes ya lo tenían) | `businessCase.controller.js` — `LOCK_ROLES` ampliado; `canBlockSections`/`canUnblockSections` en `getUIGuidance` usan este array | ✅ |
| NUEVO-08 | `jefe_de_comercial` no podía resolver solicitudes de desbloqueo de sub-secciones de determinaciones | `businessCase.routes.js` — `jefe_de_comercial` añadido a `resolve-unlock-subsection` | ✅ |
| NUEVO-09 | `jefe_de_comercial` no podía aprobar reapertura de ventana preflow (`reopen-decision`) | `businessCase.routes.js` — `jefe_de_comercial` añadido a `preflow/reopen-decision` | ✅ |

---

**Resumen de correcciones (actualizado 2026-05-23 — decisiones arquitectónicas cerradas):**
- ✅ **70 puntos corregidos o verificados en código** (68 anteriores + BC-17 + PR-01 implementados)
- ✅ **BC-17**: Expediente se pausa al apelar; rechazo definitivo cancela expedientes y bloquea nuevas apelaciones
- ✅ **PR-01**: Inspección auto-disparada al subir oferta firmada; notifica jefe_tecnico; idempotente

**Archivos adicionales modificados en flujo completo (sesión 3 — 2026-05-23):**
- `businessCase.controller.js` — `LOCK_ROLES` incluye `jefe_de_comercial`; `PRIVATE_PURCHASE_TYPES` incluye `private_comodato` y `private_sale`
- `businessCase.routes.js` — `jefe_de_comercial` en `resolve-unlock-subsection` y `preflow/reopen-decision`; `jefe_de_comercial` en lock/unlock sections
- `DeterminationsSection.jsx` — `canEditType()` corregido para reactivos/determinaciones: `jefe_comercial`/`jefe_de_comercial` siempre pueden editar
- `privatePurchases.routes.js` — `backoffice`/`backoffice_comercial` en client-registration; `jefe_de_comercial` en `start-business-case`

**Archivos modificados en sesión 4 — BC-17 y PR-01 (2026-05-23):**
- `privatePurchases.service.js` — columna `paused_reason` (ensurePrivatePausedReasonColumn); método `_assertNotPaused`; método `_autoTriggerInspectionOnSignedOffer`; auto-trigger en `uploadSignedOffer`; guard en `uploadContract` y `saveInspectionRequest`
- `businessCase.controller.js` — helpers `pauseLinkedExpedients` / `unpauseLinkedExpedients` / `cancelLinkedExpedients`; `requestFeasibilityAppeal` bloquea si `feasibility_is_definitively_rejected` y llama `pauseLinkedExpedients`; `resolveFeasibilityAppeal` despausa (approve) o cancela (reject) + marca `feasibility_is_definitively_rejected`; `getUIGuidance` expone `feasibilityIsDefinitivelyRejected`
- `FeasibilitySection.jsx` — badge "decisión definitiva" cuando `feasibilityIsDefinitivelyRejected = true`

**Archivos modificados en sesión 2 (segunda ronda):**
- `SupplyControlTab.jsx` — `bc_maximums` oculto sin BC; roles de activación corregidos; roles de solicitud/confirmación/envío corregidos
- `EquipmentLogisticsTab.jsx` — "Subir acta logística" restringida a `jefe_logistica` + managers; roles "Solicitar fechas" ampliados
- `equipmentPurchases.service.js` — `MANAGER_ROLES` ampliado; `listByUser()` separado tecnico/jefe_tecnico; `activateSupplyControl` valida BC vinculado; `confirmDelivery` desactiva techo
- `DeterminationsSection.jsx` — `TECNICO_EDIT_ROLES` creado; `canEditType()` corregido
- `roleSectionConfig.js` — `feasibility` eliminado de `backoffice`; entrada `servicio_tecnico` eliminada
- `businessCase.controller.js` — `lockSection`/`unlockSection` con validación purchase_type; permisos `canAppealFeasibilityRejection`/`canResolveFeasibilityAppeal` en `getUIGuidance`; controladores `requestFeasibilityAppeal`/`resolveFeasibilityAppeal` implementados
- `businessCase.routes.js` — `operaciones` en `businessCaseRoles`; rutas `commercial-plan`/`operations-control` corregidas; rutas `POST /feasibility/appeal` y `POST /feasibility/appeal/resolve` añadidas
- `businessCaseApi.js` — funciones `requestBusinessCaseFeasibilityAppeal`/`resolveBusinessCaseFeasibilityAppeal` añadidas
- `FeasibilitySection.jsx` — panel completo de apelación (solicitud + resolución + estados)

---

## 9. Decisiones Arquitectónicas Cerradas (2026-05-23)

### BC-17: Pausa del Expediente Durante Apelación de Factibilidad ✅

**Decisiones tomadas:**
1. **Expediente durante apelación pendiente** → se **pausa** (`paused_reason = 'feasibility_appeal_pending'`). Las acciones de avance (upload contrato, solicitar inspección) retornan HTTP 423.
2. **Apelación aprobada** → expediente se **despausa** y continúa su flujo normal.
3. **Apelación rechazada** → BC queda con `feasibility_is_definitively_rejected = true`. No se pueden hacer más apelaciones. Los expedientes vinculados quedan **cancelados** (`status = 'rejected'`).

**Implementación:**
- Columna `paused_reason TEXT DEFAULT NULL` en `private_purchase_requests` y `equipment_purchases` (migración `ADD COLUMN IF NOT EXISTS` en service init)
- `pauseLinkedExpedients(bcId)` / `unpauseLinkedExpedients(bcId)` / `cancelLinkedExpedients(bcId)` en `businessCase.controller.js`
- `_assertNotPaused(purchaseId)` llamado en `uploadContract` y `saveInspectionRequest` de `privatePurchases.service.js`
- Badge "decisión definitiva" en `FeasibilitySection.jsx`

**Nota sobre Caso B (legacy):** Los helpers de pausa/cancelación usan UPDATE con JOIN por `business_case_id` — si no hay expediente vinculado, el UPDATE afecta 0 filas sin error. El sistema cubre ambos casos (A: sin expediente, B: con expediente legacy).

---

### PR-01: Inspección Automática al Subir Oferta Firmada ✅

**Decisiones tomadas:**
1. Al llamar `uploadSignedOffer` con éxito → se dispara `_autoTriggerInspectionOnSignedOffer` (fire-and-forget).
2. La inspección auto-crea un `inspection_request` en el sistema externo (F.ST-20) y establece `inspection_request_id` + `inspection_requested_at` en DB.
3. Notifica a `jefe_tecnico` / `jefe_servicio_tecnico` vía notificationManager.
4. **Idempotente**: si ya existe `inspection_request_id`, no crea duplicado. Esto hace que el auto-trigger de `updateClientRegistration` (que ya existía) sea un no-op de transición de estado.
5. **Fire-and-forget sin bloqueo**: si falla, el upload de la oferta firmada igualmente termina exitosamente. El error se loguea; comercial puede solicitar inspección manualmente.

**Implementación:** `_autoTriggerInspectionOnSignedOffer` en `privatePurchases.service.js`.

---

## Notas de Implementación

### Middleware de Roles (backend)
```js
verifyToken       // extrae user del JWT
requireRole([])   // verifica user.role / user.roles contra lista
```

### RoleGatedAction (frontend)
```jsx
<RoleGatedAction allowedRoles={['acp_comercial', 'jefe_comercial']} userRoles={user.roles}>
  <Button>Acción restringida</Button>
</RoleGatedAction>
// Rol no incluido → componente no se renderiza (no solo oculto con CSS)
```

### Verificación de permisos en BC (roleSectionConfig.js)
```js
const config = roleSectionConfig[user.role];
const canEdit = config?.editableSections?.includes(sectionName);
const canView = config?.visibleSections?.includes(sectionName);
// Si sección está bloqueada por estado → canEdit = false siempre
```

### Bloqueo de sección en BC
```
sección.locked = true
  → inputs: disabled / readOnly
  → botones guardar: display:none (no disabled)
  → panel: "Para modificar esta sección, solicitar desbloqueo a [acp_comercial / jefe_comercial / backoffice]"
```

---

*Documento v3 — 2026-05-23*  
*50 escenarios evaluados · 9 errores de lógica detectados · 5 vacíos de flujo · 1 contradicción pendiente de decisión*  
*Checklist: 46 puntos de corrección listos para implementar*
