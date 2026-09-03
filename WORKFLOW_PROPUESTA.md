# Propuesta Visual — Workspace Unificado de Compras

> Diagramas de flujo de la arquitectura propuesta.
> Complementa [WORKFLOW_COMPRAS.md](WORKFLOW_COMPRAS.md).

---

## 1. Vista global — antes vs después

### ❌ HOY (fragmentado)

```mermaid
flowchart LR
    User((Usuario))

    subgraph Comercial[" "]
        direction TB
        C1[Equipment Purchases]
        C2[Cupos]
    end

    subgraph Backoffice[" "]
        direction TB
        B1[Private Purchases]
    end

    subgraph Logistica[" "]
        direction TB
        L1[Logistica Privadas]
    end

    subgraph Servicio[" "]
        direction TB
        S1[Entregas Privadas]
        S2[Workspace Procedimiento]
        S3[Aplicaciones / Entrenamiento]
        S4[Asistencia]
        S5[Desinfección]
    end

    subgraph Gerencia[" "]
        direction TB
        G1[Álbum Compras]
    end

    subgraph Workspace[" "]
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

### ✅ PROPUESTA (unificado)

```mermaid
flowchart LR
    User((Usuario))

    subgraph Unificado["WORKSPACE DE COMPRAS"]
        direction TB
        WS[Lista de expedientes<br/>+ filtros por tipo/estado/rol]
        WS --> Detalle{Expediente seleccionado}
        Detalle --> T1[1. COMERCIAL]
        Detalle --> T2[2. CONTRATO]
        Detalle --> T3[3. LOGÍSTICA]
        Detalle --> T4[4. TÉCNICA]
        Detalle --> T5[5. ENTRENAMIENTO]
        Detalle --> T6[6. TIMELINE]
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
    class T1,T2,T3,T4,T5,T6 tab
    class A1,A2,A3,A4,A5 aux
```

---

## 2. Anatomía del expediente unificado

```mermaid
flowchart TB
    Header["🔍 Header del expediente<br/>Cliente · Equipo · Tipo · Estado · Bloqueo activo"]

    Header --> Tabs

    subgraph Tabs["Sub-tabs del expediente"]
        direction LR
        Tab1["1. COMERCIAL<br/>● Datos · Oferta · Proforma"]
        Tab2["2. CONTRATO<br/>● Documentos · Firmas"]
        Tab3["3. LOGÍSTICA<br/>● Despacho · F.ST-14"]
        Tab4["4. TÉCNICA<br/>● F.ST-07/09/02 · CU · F.ST-10"]
        Tab5["5. ENTRENAMIENTO<br/>● F.ST-04/05 · Certificado"]
        Tab6["6. TIMELINE<br/>● Auditoría completa"]
    end

    Tabs --> Badges

    subgraph Badges["Cada sub-tab muestra un badge de estado"]
        direction LR
        B1[/"⚪ n/a"/]
        B2[/"🟡 pendiente"/]
        B3[/"🔵 en curso"/]
        B4[/"🔴 bloqueado"/]
        B5[/"🟢 completado"/]
    end

    classDef header fill:#0F172A,stroke:#000,color:#FFFFFF,stroke-width:2px
    classDef tab fill:#FFFFFF,stroke:#2563EB,color:#1E3A8A
    classDef badge fill:#F9FAFB,stroke:#9CA3AF,color:#374151,stroke-dasharray: 3 3

    class Header header
    class Tab1,Tab2,Tab3,Tab4,Tab5,Tab6 tab
    class B1,B2,B3,B4,B5 badge
```

---

## 3. Flujo end-to-end con todos los roles

```mermaid
flowchart TD
    Start([Inicia oportunidad])

    Start --> Tipo{¿Tipo de compra?}
    Tipo -->|Pública| Pub[Sub-tab COMERCIAL<br/>flujo público]
    Tipo -->|Privada| Priv[Sub-tab COMERCIAL<br/>flujo privado]

    Pub --> PubCom[comercial crea<br/>jefe_comercial asigna ACP<br/>acp_comercial gestiona proveedor]
    Priv --> PrivCom[comercial crea<br/>backoffice_comercial elabora oferta<br/>jefe_comercial valida business case]

    PubCom --> Proforma[/Proforma firmada/]
    PrivCom --> Oferta[/Oferta firmada por cliente/]

    Proforma --> Contrato
    Oferta --> Contrato

    subgraph Contrato["Sub-tab CONTRATO"]
        Docs{¿Documentos completos?}
        Docs -->|No| Falta[Bloqueo: documentos faltantes]
        Docs -->|Sí| Firma[gerencia firma contrato]
        Falta -.-> Docs
    end

    Contrato --> Logistica

    subgraph Logistica["Sub-tab LOGÍSTICA"]
        Fechas[jefe_operaciones fechas]
        Despacho[jefe_logistica despacho]
        FST14["tecnico ejecuta F.ST-14<br/>recepción visual"]
        Fechas --> Despacho --> FST14
    end

    Logistica --> Tecnica

    subgraph Tecnica["Sub-tab TÉCNICA"]
        FST07["tecnico F.ST-07<br/>inspección sitio"]
        Decision{"jefe_tecnico F.ST-09<br/>¿aplica o requiere CU?"}
        Verif["tecnico verifica<br/>multi-intento"]
        CU["Flujo CU<br/>partes + reporte proveedor + F.ST-02"]
        FST10["F.ST-10 acta<br/>tecnico → logistica → gerencia"]

        FST07 --> Decision
        Decision -->|Aplica| Verif
        Decision -->|Requiere CU| CU
        CU --> Verif
        Verif --> FST10
    end

    Tecnica --> Entrenamiento

    subgraph Entrenamiento["Sub-tab ENTRENAMIENTO"]
        Plan["jefe_tecnico F.ST-04<br/>planificación"]
        Asist["tecnico F.ST-05<br/>asistencia"]
        Eval[Conformidad y evaluación]
        Cert[Certificado emitido]
        Plan --> Asist --> Eval --> Cert
    end

    Entrenamiento --> Cierre{Closure gate}
    Cierre -->|Bloqueos resueltos| End([✅ Expediente cerrado])
    Cierre -->|Pendientes| Bloqueo[🔴 Sub-tab indica bloqueo]
    Bloqueo -.-> Tecnica

    classDef start fill:#0F172A,color:#FFFFFF,stroke:#000
    classDef finish fill:#16A34A,color:#FFFFFF,stroke:#14532D,stroke-width:2px
    classDef branch fill:#FEF3C7,stroke:#D97706,color:#78350F
    classDef block fill:#FEE2E2,stroke:#DC2626,color:#7F1D1D
    classDef phase fill:#DBEAFE,stroke:#2563EB,color:#1E3A8A

    class Start start
    class End finish
    class Tipo,Docs,Decision,Cierre branch
    class Falta,Bloqueo block
    class Pub,Priv,PubCom,PrivCom,Proforma,Oferta,Firma,Fechas,Despacho,FST14,FST07,Verif,CU,FST10,Plan,Asist,Eval,Cert phase
```

---

## 4. Visibilidad por rol — todos ven todo, las acciones se gatean

```mermaid
flowchart LR
    subgraph Expediente["Expediente abierto"]
        direction TB
        E1[1. COMERCIAL]
        E2[2. CONTRATO]
        E3[3. LOGÍSTICA]
        E4[4. TÉCNICA]
        E5[5. ENTRENAMIENTO]
        E6[6. TIMELINE]
    end

    subgraph Roles["Rol del usuario actual"]
        direction TB
        R1[comercial / acp / backoffice]
        R2[jefe_comercial]
        R3[gerencia]
        R4[logística]
        R5[jefe_tecnico]
        R6[tecnico]
    end

    R1 -.->|Ve todas| Expediente
    R2 -.->|Ve todas| Expediente
    R3 -.->|Ve todas| Expediente
    R4 -.->|Ve todas| Expediente
    R5 -.->|Ve todas| Expediente
    R6 -.->|Ve todas| Expediente

    R1 ==>|Acciones| E1
    R2 ==>|Acciones| E1
    R3 ==>|Acciones| E2
    R4 ==>|Acciones| E3
    R5 ==>|Acciones| E4
    R5 ==>|Acciones| E5
    R6 ==>|Acciones| E4
    R6 ==>|Acciones| E5

    classDef tab fill:#FFFFFF,stroke:#2563EB,color:#1E3A8A
    classDef role fill:#F9FAFB,stroke:#6B7280,color:#111827

    class E1,E2,E3,E4,E5,E6 tab
    class R1,R2,R3,R4,R5,R6 role
```

> **Línea punteada** = visibilidad (todos los roles leen todo el expediente).
> **Línea sólida** = acciones disponibles (gateadas por rol).

---

## 5. Plan de migración — orden de ejecución

```mermaid
flowchart TB
    Start([Estado actual])

    Start --> P1

    subgraph Fase1["FASE 1 — Limpieza"]
        P1[CHG-01<br/>Borrar duplicados puros]
        P1 --> P7[CHG-07<br/>Limpiar navbar]
    end

    P7 --> P2

    subgraph Fase2["FASE 2 — Estructura"]
        P2[Crear scaffold<br/>workspace unificado<br/>con 6 sub-tabs vacías]
        P2 --> P9[CHG-09<br/>Timeline unificado]
    end

    P9 --> P3

    subgraph Fase3["FASE 3 — Migración por sub-tab"]
        direction TB
        M1[CHG-04<br/>backoffice → COMERCIAL]
        M2[CHG-02<br/>logistica + entregas → LOGÍSTICA + TÉCNICA]
        M3[CHG-05<br/>procedimiento técnico → TÉCNICA]
        M4[CHG-06<br/>entrenamiento → ENTRENAMIENTO]
        M1 --> M2 --> M3 --> M4
    end

    P3 --> Fase3
    M4 --> Fase4

    subgraph Fase4["FASE 4 — Extender a compra pública"]
        P4[CHG-03<br/>Conectar equipment_purchase<br/>al installationWorkflow]
    end

    P4 --> Fase5

    subgraph Fase5["FASE 5 — Decisiones pendientes"]
        P5[CHG-08<br/>Consolidar modelo<br/>de cupos públicos]
    end

    P5 --> End([✅ Workspace unificado])

    classDef phase1 fill:#FEF3C7,stroke:#D97706,color:#78350F
    classDef phase2 fill:#DBEAFE,stroke:#2563EB,color:#1E3A8A
    classDef phase3 fill:#E0E7FF,stroke:#4338CA,color:#312E81
    classDef phase4 fill:#F3E8FF,stroke:#7C3AED,color:#4C1D95
    classDef phase5 fill:#FEE2E2,stroke:#DC2626,color:#7F1D1D
    classDef finish fill:#16A34A,color:#FFFFFF,stroke:#14532D,stroke-width:2px

    class P1,P7 phase1
    class P2,P9 phase2
    class M1,M2,M3,M4 phase3
    class P4 phase4
    class P5 phase5
    class End finish
    class Start phase1
    class Fase3 phase3
```

---

## 6. Comparación de superficie de UI

```mermaid
flowchart LR
    subgraph Antes["❌ HOY"]
        direction TB
        H1["11 rutas distintas"]
        H2["Hasta 4 entradas duplicadas<br/>en navbar por rol"]
        H3["Backoffice: 3000 líneas<br/>en un solo archivo"]
        H4["Compra pública sin<br/>UI post-arrival"]
        H5["Técnico salta entre<br/>4 pantallas para cerrar"]
    end

    subgraph Despues["✅ PROPUESTA"]
        direction TB
        D1["1 workspace<br/>+ 5 rutas adyacentes"]
        D2["1 entrada principal<br/>en navbar"]
        D3["UI distribuida en<br/>6 sub-tabs reutilizables"]
        D4["Pública y privada<br/>mismo flujo post-arrival"]
        D5["Técnico cierra desde<br/>1 sola pantalla"]
    end

    Antes ==>|migración| Despues

    classDef bad fill:#FEE2E2,stroke:#DC2626,color:#7F1D1D
    classDef good fill:#DCFCE7,stroke:#16A34A,color:#14532D

    class H1,H2,H3,H4,H5 bad
    class D1,D2,D3,D4,D5 good
```

---

## 7. Estructura del archivo (lo que se va a tocar)

```
spi_front/src/modules/
├── shared/
│   └── purchases-workspace/
│       ├── PurchasesWorkspace.jsx          ← orquesta lista + detalle
│       ├── PurchaseList.jsx                ← lista lateral con filtros
│       ├── PurchaseDetail.jsx              ← contenedor de sub-tabs
│       ├── tabs/
│       │   ├── CommercialTab.jsx           ⟵ ex backoffice/PrivatePurchases + EquipmentPurchases
│       │   ├── ContractTab.jsx             ⟵ gate de gerencia + firmas
│       │   ├── LogisticsTab.jsx            ⟵ ex LogisticaPrivatePurchases + F.ST-14
│       │   ├── TechnicalTab.jsx            ⟵ ex PrivatePurchaseDeliveries + ProcedureWorkspace
│       │   ├── TrainingTab.jsx             ⟵ ex TrainingWorkflowWorkspace
│       │   └── TimelineTab.jsx             ⟵ NUEVO
│       └── components/
│           ├── PurchaseHeader.jsx          ← cliente + equipo + estado + bloqueo
│           ├── TabBadge.jsx                ← n/a/pendiente/en curso/bloqueado/completado
│           └── RoleGatedAction.jsx         ← wrapper que oculta/deshabilita por rol
│
├── comercial/                              ← se reduce a páginas auxiliares
│   └── pages/DeliveryCeilings.jsx          ← se mantiene (cupos públicos)
│
├── backoffice/                             ← se vacía (su UI vive en CommercialTab)
│
├── logistica/                              ← se vacía (su UI vive en LogisticsTab)
│
└── servicio/
    ├── pages/
    │   ├── RetiroEquipos.jsx               ← se mantiene
    │   ├── PreventiveAnnualPlanBoard.jsx   ← se mantiene
    │   └── CorrectiveCaseWorkspace.jsx     ← se mantiene
    └── components/                         ← steppers se reusan en TechnicalTab/TrainingTab
        ├── InstallationReceptionStepper.jsx
        ├── VerificacionStepper.jsx
        ├── DeliveryActPanel.jsx
        ├── EntrenamientoStepper.jsx
        └── ...
```

---

## 8. Resumen de la propuesta en una frase

> **Una ruta. Seis sub-tabs. Todos los roles ven todo. Las acciones se gatean por rol. Compra pública y privada usan el mismo flujo post-arrival.**

---

*Generado a partir de [WORKFLOW_COMPRAS.md](WORKFLOW_COMPRAS.md). Última actualización: 2026-05-08.*
