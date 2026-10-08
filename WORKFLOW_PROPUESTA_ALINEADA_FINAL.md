# Propuesta Visual — Workspace Unificado de Compras y Control Operativo

> Versión corregida y alineada del flujo de compras internas en FamSPI.  
> Complementa `WORKFLOW_COMPRAS.md` y reemplaza la lógica anterior donde se mezclaban compra pública, compra privada, BC, disponibilidad y cierre operativo.

---

## 0. Principios corregidos del flujo

Esta propuesta se basa en las siguientes reglas de negocio:

1. El expediente inicia como una **solicitud de compra**.
2. La primera clasificación es:
   - **Compra pública**
   - **Compra privada**
3. La **compra privada** tiene 4 modalidades:
   - Venta directa
   - Alquiler
   - Alquiler con transferencia de dominio
   - Comodato
4. Solo requieren **Business Case**:
   - Compra pública
   - Compra privada modalidad comodato
5. No requieren **Business Case**:
   - Venta directa
   - Alquiler
   - Alquiler con transferencia de dominio
6. La **decisión de participar** solo aplica a compra pública.
7. Todas las modalidades deben revisar **disponibilidad del equipo** antes de avanzar.
8. En disponibilidad solo existen dos caminos:
   - equipo interno disponible y listo;
   - solicitar disponibilidad al proveedor.
9. No existe estado de equipo interno condicionado dentro de este flujo. Si un equipo no está listo, no aparece como disponible.
10. El número de serie no se registra al inicio ni en el BC. Se registra solo cuando el equipo llega físicamente.
11. El expediente no debe cerrarse apenas termina instalación o entrenamiento. Debe quedar en **control operativo** hasta que Logística haya registrado el envío completo de todas las cantidades máximas aprobadas en el BC, cuando aplique.
12. Para compra pública y comodato, las cantidades máximas salen del BC.
13. Para venta directa, alquiler y alquiler con transferencia de dominio, si existen insumos comprometidos, se controlan como **entregables comerciales**, no como máximos de BC.
14. Logística es la fuente de verdad de las cantidades realmente enviadas.

---

## 1. Vista global — antes vs después

### ❌ HOY — fragmentado

```mermaid
flowchart LR
    User((Usuario))

    subgraph Comercial["Comercial"]
        direction TB
        C1[Equipment Purchases]
        C2[Cupos públicos]
    end

    subgraph Backoffice["Backoffice"]
        direction TB
        B1[Private Purchases]
    end

    subgraph Logistica["Logística"]
        direction TB
        L1[Logística Privadas]
    end

    subgraph Servicio["Servicio Técnico"]
        direction TB
        S1[Entregas Privadas]
        S2[Workspace Procedimiento]
        S3[Aplicaciones / Entrenamiento]
        S4[Asistencia]
        S5[Desinfección]
    end

    subgraph Gerencia["Gerencia"]
        direction TB
        G1[Álbum Compras]
    end

    subgraph Workspace["Workspace actual"]
        direction TB
        W1[Workspace Compras<br/>solo listado]
    end

    User --> C1
    User --> C2
    User --> B1
    User --> L1
    User --> S1
    User --> S2
    User --> S3
    User --> S4
    User --> S5
    User --> G1
    User --> W1

    classDef comercial fill:#DBEAFE,stroke:#1E40AF,color:#1E3A8A
    classDef backoffice fill:#E0E7FF,stroke:#4338CA,color:#312E81
    classDef logistica fill:#FEF3C7,stroke:#D97706,color:#78350F
    classDef servicio fill:#FEE2E2,stroke:#DC2626,color:#7F1D1D
    classDef gerencia fill:#F3E8FF,stroke:#7C3AED,color:#4C1D95
    classDef workspace fill:#DCFCE7,stroke:#16A34A,color:#14532D

    class C1,C2 comercial
    class B1 backoffice
    class L1 logistica
    class S1,S2,S3,S4,S5 servicio
    class G1 gerencia
    class W1 workspace
```

### ✅ PROPUESTA — workspace unificado con flujo operativo completo

```mermaid
flowchart LR
    User((Usuario))

    subgraph Unificado["WORKSPACE DE COMPRAS"]
        direction TB
        WS[Lista de expedientes<br/>+ filtros por tipo, modalidad, estado y responsable]
        WS --> Detalle{Expediente seleccionado}
        Detalle --> T1[1. COMERCIAL / BC]
        Detalle --> T2[2. DISPONIBILIDAD]
        Detalle --> T3[3. ACP PÚBLICO]
        Detalle --> T4[4. CONTRATO]
        Detalle --> T5[5. LOGÍSTICA EQUIPO]
        Detalle --> T6[6. TÉCNICA]
        Detalle --> T7[7. ENTRENAMIENTO]
        Detalle --> T8[8. CONTROL DE INSUMOS]
        Detalle --> T9[9. TIMELINE]
    end

    subgraph Auxiliares["Adyacentes — siguen separados"]
        direction TB
        A1[Cupos Públicos]
        A2[Álbum Gerencia]
        A3[Retiros F.ST-11]
        A4[Mantenimiento Preventivo]
        A5[Casos Correctivos]
    end

    User ==> WS
    User -.-> A1
    User -.-> A2
    User -.-> A3
    User -.-> A4
    User -.-> A5

    classDef main fill:#16A34A,stroke:#14532D,color:#FFFFFF,stroke-width:2px
    classDef tab fill:#DCFCE7,stroke:#16A34A,color:#14532D
    classDef aux fill:#F3F4F6,stroke:#9CA3AF,color:#374151

    class WS,Detalle main
    class T1,T2,T3,T4,T5,T6,T7,T8,T9 tab
    class A1,A2,A3,A4,A5 aux
```

---

## 2. Clasificación correcta de solicitudes

```mermaid
flowchart TD
    A[Solicitud de compra] --> B{Tipo principal}

    B -->|Compra pública| C[Proceso público]
    B -->|Compra privada| D[Compra privada]

    D --> E{Modalidad privada}
    E -->|Venta directa| F[Venta directa<br/>sin BC]
    E -->|Alquiler| G[Alquiler<br/>sin BC]
    E -->|Alquiler con transferencia de dominio| H[Alquiler con transferencia de dominio<br/>sin BC]
    E -->|Comodato| I[Comodato<br/>con BC]

    C --> J[Requiere Business Case]
    I --> J

    F --> K[No requiere BC]
    G --> K
    H --> K

    J --> L[Declara cantidades máximas si aplica]
    K --> M[Puede declarar entregables comerciales si aplica]

    classDef root fill:#0F172A,stroke:#000,color:#FFFFFF,stroke-width:2px
    classDef bc fill:#DBEAFE,stroke:#2563EB,color:#1E3A8A
    classDef noBc fill:#F3F4F6,stroke:#9CA3AF,color:#374151
    classDef private fill:#E0E7FF,stroke:#4338CA,color:#312E81

    class A root
    class C,I,J,L bc
    class F,G,H,K,M noBc
    class D,E private
```

---

## 3. Anatomía del expediente unificado

```mermaid
flowchart TB
    Header["Header del expediente<br/>Cliente · Equipo/modelo · Tipo · Modalidad · Estado · Bloqueos · Saldo de insumos"]

    Header --> Tabs

    subgraph Tabs["Sub-tabs del expediente"]
        direction LR
        Tab1["1. COMERCIAL / BC<br/>Solicitud, BC, factibilidad, modalidad"]
        Tab2["2. DISPONIBILIDAD<br/>Equipo interno listo o proveedor"]
        Tab3["3. ACP PÚBLICO<br/>Checklist portal externo y resultado"]
        Tab4["4. CONTRATO<br/>Documentos, firmas, adjudicación o aceptación"]
        Tab5["5. LOGÍSTICA EQUIPO<br/>Llegada, recepción física, serial"]
        Tab6["6. TÉCNICA<br/>F.ST-14/07/09/02/10, CU si aplica"]
        Tab7["7. ENTRENAMIENTO<br/>F.ST-04/05, certificado"]
        Tab8["8. CONTROL DE INSUMOS<br/>Solicitudes, operaciones, envíos y saldos"]
        Tab9["9. TIMELINE<br/>Auditoría completa"]
    end

    Tabs --> Badges

    subgraph Badges["Cada sub-tab muestra un badge de estado"]
        direction LR
        B1[/"n/a"/]
        B2[/"pendiente"/]
        B3[/"en curso"/]
        B4[/"bloqueado"/]
        B5[/"completado"/]
        B6[/"control activo"/]
    end

    classDef header fill:#0F172A,stroke:#000,color:#FFFFFF,stroke-width:2px
    classDef tab fill:#FFFFFF,stroke:#2563EB,color:#1E3A8A
    classDef badge fill:#F9FAFB,stroke:#9CA3AF,color:#374151,stroke-dasharray: 3 3

    class Header header
    class Tab1,Tab2,Tab3,Tab4,Tab5,Tab6,Tab7,Tab8,Tab9 tab
    class B1,B2,B3,B4,B5,B6 badge
```

---

## 4. Flujo end-to-end corregido

```mermaid
flowchart TD
    Start([Inicio: solicitud de compra]) --> Tipo{Tipo principal}

    Tipo -->|Compra pública| Pub[Compra pública]
    Tipo -->|Compra privada| Priv[Compra privada]

    Priv --> Modalidad{Modalidad privada}
    Modalidad -->|Venta directa| VD[Venta directa]
    Modalidad -->|Alquiler| ALQ[Alquiler]
    Modalidad -->|Alquiler con transferencia de dominio| ATD[Alquiler con transferencia de dominio]
    Modalidad -->|Comodato| COM[Comodato]

    Pub --> BCPub[Business Case público]
    COM --> BCCom[Business Case comodato]

    VD --> SinBC[Omitir BC]
    ALQ --> SinBC
    ATD --> SinBC

    BCPub --> DatosBC[Completar datos del BC]
    BCCom --> DatosBC

    DatosBC --> CantMax[Declarar cantidades máximas<br/>reactivos, controles, calibradores y materiales]
    CantMax --> Factibilidad[Evaluar factibilidad]

    Factibilidad --> Factible{¿Factible?}
    Factible -->|No| NoFactible[Devolver, ajustar o cancelar solicitud]
    Factible -->|Sí| TipoPostFact{Tipo de expediente}

    TipoPostFact -->|Compra pública| DecisionParticipar[Decisión formal de participar]
    TipoPostFact -->|Comodato| DispComodato[Revisar disponibilidad del equipo]

    DecisionParticipar -->|No participar| NoParticipa[Expediente no participado]
    DecisionParticipar -->|Participar| AsignarACP[Jefe comercial asigna ACP Comercial]

    AsignarACP --> DispPublica[ACP revisa disponibilidad del equipo]
    SinBC --> DispPrivada[Revisar disponibilidad del equipo]

    DispPublica --> Disponibilidad[Disponibilidad común]
    DispComodato --> Disponibilidad
    DispPrivada --> Disponibilidad

    Disponibilidad --> EquipoDisponible{¿Equipo interno disponible y listo?}

    EquipoDisponible -->|Sí| DisponibilidadInterna[Registrar disponibilidad interna]
    EquipoDisponible -->|No| SolicitarProveedor[Solicitar disponibilidad a proveedor]

    SolicitarProveedor --> ProveedorConfirma{¿Proveedor confirma disponibilidad?}
    ProveedorConfirma -->|No| Alternativa[Buscar alternativa o devolver expediente]
    ProveedorConfirma -->|Sí| DisponibilidadProveedor[Registrar disponibilidad proveedor]

    DisponibilidadInterna --> Continuidad{Continuidad según tipo}
    DisponibilidadProveedor --> Continuidad

    Continuidad -->|Compra pública| ChecklistPortal[ACP gestiona checklist del portal externo]
    Continuidad -->|Compra privada| OfertaPrivada[Oferta, proforma, aprobación o contrato]

    ChecklistPortal --> ResultadoACP{ACP declara resultado}
    ResultadoACP -->|Perdido| NoAdjudicado[Expediente no adjudicado]
    ResultadoACP -->|Desierto / cancelado| SinAdjudicacion[Expediente sin adjudicación]
    ResultadoACP -->|Ganado| Contrato[Contrato / documentación]

    OfertaPrivada --> Aceptacion{¿Cliente acepta o se aprueba?}
    Aceptacion -->|No| NoAceptado[Expediente no aceptado]
    Aceptacion -->|Sí| Contrato

    Contrato --> LogEquipo[Logística del equipo]
    LogEquipo --> Recepcion[Recepción física del equipo]
    Recepcion --> Serial[Registrar número de serie]
    Serial --> Unidad[Crear o activar unidad física]

    Unidad --> Tecnica[Técnica]
    Tecnica --> Entrenamiento[Entrenamiento]

    Entrenamiento --> ControlOrigen{¿Existe control de cantidades?}

    ControlOrigen -->|Pública o comodato| ControlBC[Activar control de máximos del BC]
    ControlOrigen -->|Venta directa / alquiler / alquiler TD con entregables| ControlEntregables[Controlar entregables comerciales]
    ControlOrigen -->|No aplica| FinOperativo[Fin operativo principal]

    ControlBC --> ControlActivo[Expediente queda en control operativo]
    ControlEntregables --> ControlActivo

    classDef start fill:#0F172A,color:#FFFFFF,stroke:#000
    classDef finish fill:#16A34A,color:#FFFFFF,stroke:#14532D,stroke-width:2px
    classDef branch fill:#FEF3C7,stroke:#D97706,color:#78350F
    classDef block fill:#FEE2E2,stroke:#DC2626,color:#7F1D1D
    classDef phase fill:#DBEAFE,stroke:#2563EB,color:#1E3A8A
    classDef control fill:#DCFCE7,stroke:#16A34A,color:#14532D

    class Start start
    class Tipo,Modalidad,Factible,TipoPostFact,DecisionParticipar,EquipoDisponible,ProveedorConfirma,Continuidad,ResultadoACP,Aceptacion,ControlOrigen branch
    class NoFactible,NoParticipa,Alternativa,NoAdjudicado,SinAdjudicacion,NoAceptado block
    class Pub,Priv,VD,ALQ,ATD,COM,BCPub,BCCom,DatosBC,CantMax,Factibilidad,AsignarACP,DispPublica,DispPrivada,Disponibilidad,DisponibilidadInterna,SolicitarProveedor,DisponibilidadProveedor,ChecklistPortal,OfertaPrivada,Contrato,LogEquipo,Recepcion,Serial,Unidad,Tecnica,Entrenamiento phase
    class ControlBC,ControlEntregables,ControlActivo,FinOperativo finish
```

---

## 5. Flujo específico de compra pública

```mermaid
flowchart TD
    A[Solicitud de compra pública] --> B[Crear Business Case]
    B --> C[Completar datos del BC]
    C --> D[Declarar cantidades máximas]
    D --> E[Evaluar factibilidad]

    E --> F{¿Factible?}
    F -->|No| G[Devolver / ajustar / cancelar]
    F -->|Sí| H[Decisión formal de participar]

    H -->|No participar| I[Expediente no participado]
    H -->|Participar| J[Jefe comercial asigna ACP Comercial]

    J --> K[ACP revisa disponibilidad del equipo]
    K --> L{¿Equipo interno disponible y listo?}

    L -->|Sí| M[Registrar disponibilidad interna]
    L -->|No| N[Solicitar disponibilidad a proveedor]

    N --> O{¿Proveedor confirma?}
    O -->|No| P[Buscar alternativa / devolver]
    O -->|Sí| Q[Registrar disponibilidad proveedor]

    M --> R[Checklist portal externo]
    Q --> R

    R --> S[ACP gestiona proceso en portal externo]
    S --> T{Resultado declarado por ACP}

    T -->|Perdido| U[No adjudicado]
    T -->|Desierto / cancelado| V[Sin adjudicación]
    T -->|Ganado| W[Contrato / documentación]

    W --> X[Logística del equipo]
    X --> Y[Recepción física]
    Y --> Z[Registrar serial]
    Z --> AA[Crear / activar unidad física]
    AA --> AB[Técnica]
    AB --> AC[Entrenamiento]
    AC --> AD[Control operativo de máximos del BC]
```

### Regla para ACP Comercial

ACP Comercial trabaja el proceso en el portal externo, pero FamSPI solo registra:

- checklist de seguimiento;
- fechas clave;
- evidencias;
- disponibilidad interna o proveedor;
- resultado declarado por ACP:
  - ganado;
  - perdido;
  - desierto;
  - cancelado.

FamSPI no debe intentar replicar la operación completa del portal de compras públicas.

---

## 6. Flujo específico de compra privada

```mermaid
flowchart TD
    A[Solicitud de compra privada] --> B{Modalidad privada}

    B -->|Venta directa| C[Sin Business Case]
    B -->|Alquiler| D[Sin Business Case]
    B -->|Alquiler con transferencia de dominio| E[Sin Business Case]
    B -->|Comodato| F[Business Case comodato]

    F --> G[Completar datos del BC]
    G --> H[Declarar cantidades máximas]
    H --> I[Evaluar factibilidad]

    I --> J{¿Factible?}
    J -->|No| K[Devolver / ajustar / cancelar]
    J -->|Sí| L[Revisar disponibilidad del equipo]

    C --> L
    D --> L
    E --> L

    L --> M{¿Equipo interno disponible y listo?}

    M -->|Sí| N[Registrar disponibilidad interna]
    M -->|No| O[Solicitar disponibilidad a proveedor]

    O --> P{¿Proveedor confirma?}
    P -->|No| Q[Buscar alternativa / devolver expediente]
    P -->|Sí| R[Registrar disponibilidad proveedor]

    N --> S[Oferta, proforma, aprobación o contrato]
    R --> S

    S --> T{¿Cliente acepta o se aprueba?}
    T -->|No| U[Expediente no aceptado]
    T -->|Sí| V[Contrato / documentación]

    V --> W[Logística del equipo]
    W --> X[Recepción física]
    X --> Y[Registrar serial]
    Y --> Z[Crear / activar unidad física]
    Z --> AA[Técnica]
    AA --> AB[Entrenamiento]

    AB --> AC{¿Tiene cantidades o entregables?}
    AC -->|Comodato| AD[Control de máximos del BC]
    AC -->|Venta directa / alquiler / alquiler TD| AE[Control de entregables comerciales, si aplica]
    AC -->|No aplica| AF[Fin operativo principal]
```

---

## 7. Revisión de disponibilidad del equipo

La disponibilidad se revisa en todos los tipos de expediente.

```mermaid
flowchart TD
    A[Revisión de disponibilidad del equipo] --> B{¿Hay equipo interno disponible y listo?}

    B -->|Sí| C[Registrar disponibilidad interna]
    B -->|No| D[Solicitar disponibilidad a proveedor]

    D --> E{¿Proveedor confirma disponibilidad?}
    E -->|Sí| F[Registrar disponibilidad proveedor]
    E -->|No| G[Buscar alternativa o devolver expediente]

    C --> H[Continuar flujo]
    F --> H
```

### Reglas

- Solo deben listarse como disponibles los equipos internos que estén listos.
- No existe estado de disponibilidad interna condicionada.
- Si un equipo no está listo, no aparece como disponible.
- Si no hay disponibilidad interna lista, se solicita disponibilidad al proveedor.
- Aunque exista disponibilidad confirmada, el serial no se registra todavía.
- El serial solo se registra en recepción física.

### Filtro recomendado para disponibilidad interna

```text
status = available
ready_for_assignment = true
reserved = false
```

---

## 8. Registro de serial y unidad física

El número de serie pertenece a la **unidad física**, no al modelo ni al BC.

```mermaid
flowchart TD
    A[Contrato / documentación] --> B[Logística del equipo]
    B --> C[Recepción física]
    C --> D{¿Equipo llegó físicamente?}

    D -->|No| E[Serial pendiente]
    D -->|Sí| F[Registrar número de serie]

    F --> G[Crear o activar unidad física]
    G --> H[Asociar unidad al expediente]
    H --> I[Asociar cliente y ubicación]
    I --> J[Iniciar historial del activo]
```

### Reglas

- No se registra serial al crear solicitud.
- No se registra serial en el Business Case.
- No se registra serial en disponibilidad.
- El serial se captura solo en recepción física.
- La unidad física se crea o activa cuando existe equipo real recibido.
- Si el equipo ya existía internamente, se asocia la unidad existente al expediente.

---

## 9. Control de máximos del BC y entregables comerciales

### 9.1 Origen de cantidades

```mermaid
flowchart TD
    A[Expediente aprobado / avanzado] --> B{Origen de cantidades}

    B -->|Compra pública| C[Cantidades máximas del BC]
    B -->|Comodato| D[Cantidades máximas del BC]
    B -->|Venta directa| E[Entregables comerciales, si aplica]
    B -->|Alquiler| F[Entregables comerciales, si aplica]
    B -->|Alquiler con transferencia de dominio| G[Entregables comerciales, si aplica]

    C --> H[Control operativo]
    D --> H
    E --> H
    F --> H
    G --> H
```

### 9.2 Flujo de control operativo

```mermaid
flowchart TD
    A[Control operativo activo] --> B[Comercial solicita reactivo, control, calibrador o material]

    B --> C{¿Solicitud dentro del saldo permitido?}

    C -->|No| D[Bloquear solicitud]
    D --> E[Notificar a Comercial]

    C -->|Sí| F[Enviar solicitud a Operaciones]

    F --> G[Operaciones revisa disponibilidad / stock]

    G --> H{Resultado de Operaciones}
    H -->|Sin stock| I[Operaciones gestiona disponibilidad]
    H -->|Parcial| J[Liberar parcial]
    H -->|Completo| K[Liberar completo]

    I --> G

    J --> L[Logística registra envío parcial]
    K --> M[Logística registra envío completo]

    L --> N[Actualizar acumulado enviado]
    M --> N

    N --> O{¿Máximo o entregable alcanzado por ítem?}

    O -->|No| P[Saldo disponible para futuras solicitudes]
    O -->|Sí| Q[Bloquear nuevas solicitudes de ese ítem]
    Q --> R[Notificar a Comercial]

    P --> B
```

### 9.3 Fórmulas de control

```text
Saldo real pendiente = Cantidad máxima aprobada - Total enviado por Logística
```

```text
Saldo solicitables = Cantidad máxima aprobada - Total enviado por Logística - Solicitudes abiertas pendientes
```

Para venta directa, alquiler y alquiler con transferencia de dominio:

```text
Saldo real pendiente = Cantidad comprometida en entregable comercial - Total enviado por Logística
```

### 9.4 Fuente de verdad

| Dato | Fuente de verdad |
|---|---|
| Cantidad máxima de compra pública | BC aprobado |
| Cantidad máxima de comodato | BC aprobado |
| Cantidad comprometida en venta directa, alquiler o alquiler TD | Entregable comercial / oferta / contrato |
| Solicitud de entrega | Comercial |
| Revisión de disponibilidad / stock | Operaciones |
| Cantidad realmente enviada | Logística |
| Saldo restante | Cálculo FamSPI |
| Bloqueo por máximo alcanzado | Sistema |
| Notificación por máximo alcanzado | Sistema |

---

## 10. Estados recomendados del expediente

| Estado | Aplica a | Descripción |
|---|---|---|
| `request_created` | Todos | Solicitud creada |
| `bc_in_progress` | Pública / comodato | BC en elaboración |
| `bc_completed` | Pública / comodato | BC lleno con cantidades máximas |
| `feasibility_review` | Pública / comodato | Factibilidad en revisión |
| `not_feasible` | Pública / comodato | No factible |
| `feasible` | Pública / comodato | Factible |
| `public_participation_decision` | Pública | Esperando decisión de participar |
| `public_not_participated` | Pública | Se decidió no participar |
| `public_acp_assigned` | Pública | ACP asignado |
| `availability_review` | Todos | Revisión de disponibilidad del equipo |
| `supplier_availability_requested` | Todos | Se solicitó disponibilidad al proveedor |
| `availability_confirmed` | Todos | Disponibilidad confirmada |
| `public_process_tracking` | Pública | Checklist del portal externo |
| `public_won` | Pública | ACP declaró proceso ganado |
| `public_lost` | Pública | ACP declaró proceso perdido |
| `public_deserted_cancelled` | Pública | Proceso desierto o cancelado |
| `private_offer_process` | Privada | Oferta, proforma o aprobación |
| `private_not_accepted` | Privada | Cliente no acepta o no se aprueba |
| `contract_process` | Todos los que avanzan | Contrato / documentación |
| `equipment_logistics` | Todos los que avanzan | Logística del equipo |
| `equipment_received` | Todos los que avanzan | Equipo recibido |
| `unit_created` | Todos los que avanzan | Unidad física asociada con serial |
| `technical_process` | Todos los que avanzan | Técnica en proceso |
| `training_process` | Todos los que avanzan | Entrenamiento en proceso |
| `supply_control_active` | Con cantidades | Control de máximos o entregables activo |
| `supply_control_completed` | Con cantidades | Todas las cantidades fueron enviadas |
| `archived` | Todos | Archivado histórico |

---

## 11. Estados recomendados por ítem de insumo

| Estado | Descripción |
|---|---|
| `available_to_request` | Comercial puede solicitar |
| `requested_by_commercial` | Comercial generó solicitud |
| `operations_review` | Operaciones revisa disponibilidad |
| `pending_stock` | Falta disponibilidad |
| `ready_for_dispatch` | Listo para envío |
| `partial_dispatched` | Logística envió una parte |
| `full_dispatched` | Logística envió la solicitud completa |
| `max_partially_consumed` | Aún queda saldo disponible |
| `max_reached` | Máximo o entregable alcanzado |
| `blocked_by_max` | Ya no se permite solicitar más de ese ítem |
| `cancelled` | Ítem cancelado o no aplica |

---

## 12. Visibilidad por rol — todos ven todo, las acciones se gatean

```mermaid
flowchart LR
    subgraph Expediente["Expediente abierto"]
        direction TB
        E1[1. COMERCIAL / BC]
        E2[2. DISPONIBILIDAD]
        E3[3. ACP PÚBLICO]
        E4[4. CONTRATO]
        E5[5. LOGÍSTICA EQUIPO]
        E6[6. TÉCNICA]
        E7[7. ENTRENAMIENTO]
        E8[8. CONTROL DE INSUMOS]
        E9[9. TIMELINE]
    end

    subgraph Roles["Rol del usuario actual"]
        direction TB
        R1[comercial]
        R2[jefe_comercial]
        R3[acp_comercial]
        R4[backoffice_comercial]
        R5[gerencia]
        R6[operaciones]
        R7[logística]
        R8[jefe_tecnico]
        R9[tecnico]
    end

    R1 -.->|Ve todas| Expediente
    R2 -.->|Ve todas| Expediente
    R3 -.->|Ve todas| Expediente
    R4 -.->|Ve todas| Expediente
    R5 -.->|Ve todas| Expediente
    R6 -.->|Ve todas| Expediente
    R7 -.->|Ve todas| Expediente
    R8 -.->|Ve todas| Expediente
    R9 -.->|Ve todas| Expediente

    R1 ==>|Acciones| E1
    R1 ==>|Solicitudes| E8
    R2 ==>|Aprobaciones comerciales| E1
    R3 ==>|Proceso público| E3
    R3 ==>|Disponibilidad pública| E2
    R4 ==>|Oferta / contrato privado| E1
    R4 ==>|Documentación| E4
    R5 ==>|Aprobaciones / firmas| E4
    R6 ==>|Stock / disponibilidad insumos| E8
    R7 ==>|Recepción / envíos| E5
    R7 ==>|Envíos de insumos| E8
    R8 ==>|Planificación técnica| E6
    R8 ==>|Entrenamiento| E7
    R9 ==>|Ejecución técnica| E6
    R9 ==>|Ejecución entrenamiento| E7

    classDef tab fill:#FFFFFF,stroke:#2563EB,color:#1E3A8A
    classDef role fill:#F9FAFB,stroke:#6B7280,color:#111827

    class E1,E2,E3,E4,E5,E6,E7,E8,E9 tab
    class R1,R2,R3,R4,R5,R6,R7,R8,R9 role
```

> Línea punteada = visibilidad.  
> Línea sólida = acciones permitidas.

---

## 13. Reglas por sub-tab

| Sub-tab | Regla principal |
|---|---|
| Comercial / BC | Muestra BC solo si es compra pública o comodato. Venta directa, alquiler y alquiler TD no muestran BC. |
| Disponibilidad | Aplica a todos los tipos. Solo lista equipos internos disponibles y listos. Si no hay, se solicita proveedor. |
| ACP Público | Solo visible/accionable para compra pública. Registra checklist externo y resultado ACP. |
| Contrato | Se habilita si pública = ganado, o privada = aceptada/aprobada. |
| Logística Equipo | Registra llegada del equipo, recepción física, serial y unidad física. |
| Técnica | Gestiona F.ST-14, F.ST-07, F.ST-09, CU si aplica, F.ST-02 y F.ST-10. |
| Entrenamiento | Gestiona F.ST-04, F.ST-05, conformidad y certificado. |
| Control de Insumos | Controla máximos del BC o entregables comerciales. Logística es fuente de verdad del enviado. |
| Timeline | Registra auditoría de estados, documentos, solicitudes, envíos, serial y cambios. |

---

## 14. Plan de migración — orden de ejecución actualizado

```mermaid
flowchart TB
    Start([Estado actual])

    Start --> P1

    subgraph Fase1["FASE 1 — Limpieza"]
        P1[CHG-01<br/>Borrar duplicados puros]
        P1 --> P2[CHG-02<br/>Limpiar navbar]
    end

    P2 --> P3

    subgraph Fase2["FASE 2 — Estructura del workspace"]
        P3[Crear scaffold<br/>workspace unificado]
        P3 --> P4[Crear sub-tabs corregidas]
        P4 --> P5[Crear Timeline unificado]
    end

    P5 --> P6

    subgraph Fase3["FASE 3 — Clasificación y reglas"]
        P6[Agregar purchase_type<br/>public / private]
        P6 --> P7[Agregar private_modality<br/>direct_sale / rental / rental_with_domain_transfer / comodato]
        P7 --> P8[Reglas requires_business_case<br/>y requires_participation_decision]
    end

    P8 --> P9

    subgraph Fase4["FASE 4 — Flujos principales"]
        P9[Migrar compra pública<br/>BC + decisión + ACP]
        P9 --> P10[Migrar compra privada<br/>modalidades internas]
        P10 --> P11[Crear disponibilidad común]
    end

    P11 --> P12

    subgraph Fase5["FASE 5 — Post-adjudicación / post-aceptación"]
        P12[Conectar contrato]
        P12 --> P13[Conectar logística equipo]
        P13 --> P14[Recepción física + serial + unidad]
        P14 --> P15[Técnica + entrenamiento]
    end

    P15 --> P16

    subgraph Fase6["FASE 6 — Control operativo"]
        P16[Crear control de máximos del BC]
        P16 --> P17[Crear control de entregables comerciales]
        P17 --> P18[Solicitudes comercial → operaciones → logística]
        P18 --> P19[Bloqueos por máximo alcanzado]
    end

    P19 --> End([Workspace alineado y operativo])

    classDef phase1 fill:#FEF3C7,stroke:#D97706,color:#78350F
    classDef phase2 fill:#DBEAFE,stroke:#2563EB,color:#1E3A8A
    classDef phase3 fill:#E0E7FF,stroke:#4338CA,color:#312E81
    classDef phase4 fill:#F3E8FF,stroke:#7C3AED,color:#4C1D95
    classDef phase5 fill:#FEE2E2,stroke:#DC2626,color:#7F1D1D
    classDef phase6 fill:#DCFCE7,stroke:#16A34A,color:#14532D
    classDef finish fill:#16A34A,color:#FFFFFF,stroke:#14532D,stroke-width:2px

    class P1,P2 phase1
    class P3,P4,P5 phase2
    class P6,P7,P8 phase3
    class P9,P10,P11 phase4
    class P12,P13,P14,P15 phase5
    class P16,P17,P18,P19 phase6
    class End finish
```

---

## 15. Estructura sugerida de archivos frontend

```text
spi_front/src/modules/
├── shared/
│   └── purchases-workspace/
│       ├── pages/
│       │   └── PurchasesWorkspacePage.jsx
│       ├── components/
│       │   ├── PurchaseHeader.jsx
│       │   ├── TabBadge.jsx
│       │   ├── RoleGatedAction.jsx
│       │   ├── BlockerAlert.jsx
│       │   └── PurchaseStatusSummary.jsx
│       ├── tabs/
│       │   ├── commercial/
│       │   │   ├── CommercialTab.jsx
│       │   │   ├── BusinessCaseSection.jsx
│       │   │   ├── FeasibilitySection.jsx
│       │   │   ├── PrivateModalitySection.jsx
│       │   │   └── CommercialDeliverablesSection.jsx
│       │   ├── availability/
│       │   │   ├── AvailabilityTab.jsx
│       │   │   ├── InternalAvailableUnits.jsx
│       │   │   └── SupplierAvailabilityRequest.jsx
│       │   ├── public-acp/
│       │   │   ├── PublicAcpTab.jsx
│       │   │   ├── ExternalPortalChecklist.jsx
│       │   │   └── PublicResultDeclaration.jsx
│       │   ├── contract/
│       │   │   ├── ContractTab.jsx
│       │   │   └── DocumentGateChecklist.jsx
│       │   ├── equipment-logistics/
│       │   │   ├── EquipmentLogisticsTab.jsx
│       │   │   ├── EquipmentReceptionSection.jsx
│       │   │   └── SerialAndUnitSection.jsx
│       │   ├── technical/
│       │   │   ├── TechnicalTab.jsx
│       │   │   ├── SiteInspectionSection.jsx
│       │   │   ├── VerificationSection.jsx
│       │   │   ├── CUFlowSection.jsx
│       │   │   └── DeliveryActSection.jsx
│       │   ├── training/
│       │   │   ├── TrainingTab.jsx
│       │   │   ├── TrainingPlanSection.jsx
│       │   │   ├── AttendanceSection.jsx
│       │   │   └── CertificateSection.jsx
│       │   ├── supply-control/
│       │   │   ├── SupplyControlTab.jsx
│       │   │   ├── SupplyMatrix.jsx
│       │   │   ├── CommercialSupplyRequest.jsx
│       │   │   ├── OperationsStockReview.jsx
│       │   │   └── LogisticsDispatchRegister.jsx
│       │   └── timeline/
│       │       ├── TimelineTab.jsx
│       │       ├── AuditTimeline.jsx
│       │       └── BlockersPanel.jsx
│       ├── hooks/
│       │   ├── usePurchaseList.js
│       │   ├── usePurchaseDetail.js
│       │   ├── usePurchaseActions.js
│       │   └── useSupplyControl.js
│       └── api/
│           └── purchasesWorkspaceApi.js
```

---

## 16. Campos mínimos recomendados para backend

```text
purchase_type:
  public
  private

private_modality:
  direct_sale
  rental
  rental_with_domain_transfer
  comodato
  null si purchase_type = public

requires_business_case:
  true si purchase_type = public
  true si private_modality = comodato
  false en los demás casos

requires_participation_decision:
  true solo si purchase_type = public

requires_availability_review:
  true para todos los expedientes

availability_source:
  internal
  supplier
  null

availability_status:
  not_checked
  internal_available_ready
  supplier_requested
  supplier_confirmed
  supplier_rejected
  alternative_required
  availability_confirmed

serial_status:
  not_applicable_yet
  pending_reception
  received_pending_serial
  serial_registered

supply_control_type:
  bc_maximums
  commercial_deliverables
  none
```

---

## 17. Comparación final de superficie de UI

```mermaid
flowchart LR
    subgraph Antes["HOY"]
        direction TB
        H1["11 rutas distintas"]
        H2["Compra pública y privada separadas"]
        H3["Compra privada sin modalidades claras"]
        H4["BC mezclado con flujos que no lo requieren"]
        H5["Disponibilidad ambigua"]
        H6["Serial no claramente ligado a recepción física"]
        H7["Cierre antes de controlar máximos"]
    end

    subgraph Despues["PROPUESTA ALINEADA"]
        direction TB
        D1["1 workspace principal"]
        D2["Compra pública vs compra privada"]
        D3["4 modalidades privadas"]
        D4["BC solo para pública y comodato"]
        D5["Disponibilidad simple: interno listo o proveedor"]
        D6["Serial solo en recepción física"]
        D7["Control operativo hasta cumplir máximos o entregables"]
    end

    Antes ==>|migración| Despues

    classDef bad fill:#FEE2E2,stroke:#DC2626,color:#7F1D1D
    classDef good fill:#DCFCE7,stroke:#16A34A,color:#14532D

    class H1,H2,H3,H4,H5,H6,H7 bad
    class D1,D2,D3,D4,D5,D6,D7 good
```

---

## 18. Resumen ejecutivo

> **Una ruta principal. Compra pública y compra privada claramente separadas. Compra privada con cuatro modalidades. BC solo para compra pública y comodato. Decisión de participar solo para compra pública. Disponibilidad obligatoria para todos los tipos, sin estados condicionados. Serial solo en recepción física. Control operativo activo hasta que Logística registre el envío de todos los máximos del BC o entregables comerciales comprometidos.**

---

*Última actualización: 2026-05-12.*
