SMART BLUE SHEET — GUÍA DE IMPLEMENTACIÓN FAMSPI
Documento de Requerimientos de Software (SRS) + Guía de Implementación
Módulo que reemplaza la plantilla Excel Miller Heiman Blue Sheet en FamSPI

Versión — 2.0
Estado — Guía activa de implementación
Fecha — 04/06/2026
Autor — Equipo de Producto e Ingeniería
Audiencia — Desarrolladores FamSPI, PM, QA
Confidencialidad — Interno

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NOTA DE VERSIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
v1.0 — 04/06/2026 — SRS original (requerimientos teóricos)
v2.0 — 04/06/2026 — Documento híbrido: SRS + análisis real del código FamSPI.
        Cada sección tiene su bloque [FAMSPI] con la realidad del código actual:
        qué existe, qué adaptar, qué crear desde cero. Sin asumir nada.
v2.1 — 04/06/2026 — Corrección arquitectural: el Bluesheet es un proceso
        INDEPENDIENTE. La vinculación a BC, compras privadas o públicas es
        OPCIONAL y siempre iniciada por el usuario. Se reemplaza
        opportunity_bc_link por opportunity_process_link (polimórfica).
        Se agrega CU-16 (Vincular a expediente) y los endpoints de vínculo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ÍNDICE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 1. Visión y objetivos
 2. Personas y stakeholders
 3. Casos de uso (CU-01 a CU-15)
 4. Modelo de datos
 5. DDL SQL — Schema adaptado a FamSPI
 6. Requerimientos funcionales (RF-01 a RF-10)
 7. Requerimientos no funcionales
 8. Reglas de negocio (RN-01 a RN-15)
 9. Especificación de API
10. Seguridad y cumplimiento
11. Wireframes textuales
12. GUÍA DE IMPLEMENTACIÓN FAMSPI ← sección nueva central
13. Roadmap y fases
14. KPIs y métricas de éxito
15. Riesgos y mitigaciones
16. Glosario


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. VISIÓN Y OBJETIVOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1.1 Propósito
Construir Smart Blue Sheet como módulo nativo de FamSPI que sustituye la
plantilla Excel Miller Heiman para planificación estratégica de oportunidades
comerciales complejas. Preserva íntegramente la metodología y elimina las
fricciones del Excel: fórmulas rotas, duplicación de plantillas, ausencia de
versionado, sin colaboración multiusuario, sin integración con los flujos de
Business Case y compras que ya existen en FamSPI.

1.2 Alcance funcional

  Dentro de alcance
  • Gestión completa del ciclo de vida de una Blue Sheet
    (crear → editar → archivar → ganar/perder).
  • Modelo de Influencias Compradoras con roles, modos, grado de influencia
    y euforia-pánico.
  • Calificación automática sobre los 5 criterios Miller Heiman.
  • Gestión de Puntos Fuertes, Banderas Rojas y Plan de Acción.
  • Mapa competitivo multi-competidor con calificación por evidencia.
  • Dashboard de gerente, vista Kanban del embudo, reportes ejecutivos.
  • El Bluesheet es un proceso independiente: puede existir solo,
    sin necesidad de estar atado a ningún otro proceso de FamSPI.
  • Vinculación opcional a cualquier proceso existente en FamSPI:
    Business Case (bc_master), Compra Pública (equipment_purchase_requests),
    Compra Privada (private_purchase_requests), o cualquier expediente futuro.
  • Cuando se vincula, puede leer datos del expediente enlazado
    (cliente, equipos, montos, contactos) para evitar re-captura.
  • Integración bidireccional CRM (Salesforce primero, luego HubSpot).
  • Capa de IA para sugerencias (fase v2.0).

  Fuera de alcance (v1)
  • Generación de propuestas/cotizaciones (el CPQ ya existe en FamSPI vía BC).
  • Forecasting financiero por línea de producto.
  • Gestión de leads / prospección saliente.
  • Módulos de RRHH (permisos, vacaciones, asistencia) — son independientes.

1.3 Objetivos medibles

  Objetivo                             Baseline (Excel)  Meta v1
  ─────────────────────────────────────────────────────────────────
  Tiempo de llenado inicial            ~45 min           ≤ 12 min
  Tiempo de actualización semanal      ~10 min           ≤  2 min
  Adopción del equipo comercial        <20%              ≥ 80% opp > $5K
  Disponibilidad del servicio          N/A               99.9% mensual
  Auditabilidad de cambios             Ninguna           100% versionado
  Win-rate score>70 vs score<40        Desconocido       ≥ 25 pp diferencial

1.4 Supuestos y dependencias
  • FamSPI ya tiene autenticación Google OAuth2 + JWT (módulo auth).
  • Los roles comerciales ya existen: comercial, asesor_comercial,
    acp_comercial, jefe_comercial.
  • La tabla audit_log ya está operativa para trazabilidad.
  • El sistema de notificaciones (email/push/in-app) ya existe.
  • El módulo de Business Case (bc_master) ya está en producción.

[FAMSPI] Independencia y vinculación opcional con procesos existentes

  El Bluesheet es un proceso autónomo. No depende de ningún otro módulo
  para existir ni para completarse. Un vendedor puede crear, llenar y
  cerrar una BS sin que haya ningún BC, compra o expediente relacionado.

  Sin embargo, PUEDE vincularse a cualquier proceso existente en FamSPI:

  MODO 1 — Bluesheet independiente (sin vínculo)
  ───────────────────────────────────────────────
  [BLUESHEET]  → Won/Lost → archivada
   (autónomo)

  MODO 2 — Bluesheet vinculada a BC existente
  ───────────────────────────────────────────────
  [BC existente]   ←→   [BLUESHEET]
   bc_master              opportunity
   (EXISTE)               (NUEVA)
   ↑ BS puede leer cliente, equipos, monto del BC
   ↑ BC puede ver qué oportunidad lo originó

  MODO 3 — Bluesheet vinculada a Compra Privada existente
  ────────────────────────────────────────────────────────
  [COMPRA PRIVADA]   ←→   [BLUESHEET]
   private_purchase_          opportunity
   requests (EXISTE)          (NUEVA)
   ↑ BS puede leer cliente, equipos, oferta del expediente

  MODO 4 — Bluesheet vinculada a Compra Pública existente
  ────────────────────────────────────────────────────────
  [COMPRA PÚBLICA]   ←→   [BLUESHEET]
   equipment_purchase_        opportunity
   requests (EXISTE)          (NUEVA)
   ↑ BS puede leer cliente, modelos de equipo, montos

  La vinculación es N:M (una BS puede enlazarse a múltiples procesos,
  y un proceso puede tener una BS asociada). La tabla
  opportunity_process_link (nueva, migración 195) gestiona todos los
  vínculos en una sola tabla polimórfica.

  IMPORTENTE: el vínculo nunca es obligatorio. Siempre es una acción
  explícita del usuario ("Vincular a expediente existente").



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. PERSONAS Y STAKEHOLDERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Persona             Rol                   Objetivos              Dispositivo
────────────────────────────────────────────────────────────────────────────
Vendedor de campo   Account Executive     Cerrar oportunidades   Móvil + Laptop
                                          reduciendo riesgo
Gerente comercial   Sales Manager         Coachear, predecir     Laptop
                                          cierre, pipeline
Director comercial  VP Sales / CRO        Salud pipeline,        Laptop
                                          forecast
Especialista        Sales Engineer        Apoyar estrategia      Laptop
pre-venta                                 técnica
Marketing           Product Marketing     Insights objeciones    Laptop
                                          y competencia
Admin sistema       RevOps / SalesOps     Gobernar catálogos,    Laptop
                                          integraciones CRM

[FAMSPI] Mapeo de personas a roles reales del sistema

  Persona BS          →  Rol(es) en users.role de FamSPI
  ──────────────────────────────────────────────────────
  Vendedor (rep)      →  'comercial', 'asesor_comercial', 'acp_comercial'
  Gerente (manager)   →  'jefe_comercial', 'jefe_de_comercial'
  Director            →  Roles de dirección general
  Admin (RevOps)      →  'admin', 'ti'
  Pre-venta           →  'backoffice_comercial', 'acp_comercial'

  El RBAC del Bluesheet se construye sobre la jerarquía existente:
    comercial / asesor_comercial → aprueba: jefe_comercial
    acp_comercial               → aprueba: jefe_comercial
  Definida en backend/src/modules/permisos/permisos.service.js
  (ROLE_APPROVER y APPROVER_ROLE_ALIASES).


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. CASOS DE USO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CU-01  Crear oportunidad desde cero
  Actor:        Vendedor
  Precondición: Sesión autenticada; cuenta registrada en el sistema
  Flujo:        1) Click 'Nueva BS'
                2) Wizard pide cuenta (autocompletar), objetivo singular,
                   producto, monto, fecha cierre
                3) Sistema crea Opp en estado 'prospect'
  Postcondición: Oportunidad creada, score 0, plan vacío
  Alterno:       Cuenta no existe → crear cuenta rápida o cancelar

  [FAMSPI] La cuenta se busca en la tabla accounts (NUEVA — ver sección 5).
           No se usa clients directamente porque tiene PII encriptada y
           solo registra clientes ya aprobados, no prospectos.

CU-02  Vincular a oportunidad CRM existente
  Actor:        Vendedor
  Flujo:        Desde el CRM → 'Open Smart Blue Sheet' → sync datos básicos
  [FAMSPI] Se apoya en integration_outbox (ya existe) y
           integration_product_map para mapeo de campos.

CU-03  Registrar Influencia Compradora
  Actor:        Vendedor
  Flujo:        Click 'Agregar IC' → autocompletar contacto → asignar
                Rol/Influencia/Modo → slider Euforia-Pánico 1-10 →
                triunfos personales + resultados de negocio
  [FAMSPI] Contacto se busca en tabla contacts (NUEVA — ver sección 5).
           Si euforia-pánico ≥ 7 → RN-03 dispara bandera roja automática.

CU-04  Calificar oportunidad (5 criterios)
  Actor:        Vendedor
  Flujo:        Tarjetas Y/N/U → recalcular score en vivo → semáforo
  [FAMSPI] Score calculado como GENERATED ALWAYS en opportunity_rating.
           No requiere lógica en backend, la DB lo computa.

CU-05  Registrar competencia
  Actor:        Vendedor
  Flujo:        Agregar competidor desde catálogo → calificar 5 ejes → radar
  [FAMSPI] Catálogo de competidores en competitor_catalog (NUEVA).
           El gráfico radial usa chart.js ya instalado
           (chart.js@4.5.1 + react-chartjs-2@5.3.1).

CU-06  Gestionar puntos fuertes y banderas rojas
  Actor:        Vendedor
  Flujo:        Agregar/editar/reordenar → vincular a IC →
                BR critical fuerza crear acción de mitigación
  [FAMSPI] Reordenamiento requiere instalar @dnd-kit (ÚNICA dep faltante).
           Validación BR critical→acción: opportunityFlag.service.js (NUEVO).

CU-07  Definir plan de acción
  Actor:        Vendedor
  Flujo:        Nueva acción → actividad + due date + responsable →
                vincular a bandera → notificar
  [FAMSPI] Notificación usa notifications + notification_dispatch_queue
           que ya existen. Calendario se integra vía gmail.routes.js
           (Google Calendar OAuth2 ya disponible).

CU-08  Revisar dashboard de gerente
  Actor:        Gerente (jefe_comercial)
  Flujo:        Ver opp por etapa, score promedio, BR críticas,
                opp sin coach, acciones vencidas → drill-down
  [FAMSPI] Endpoint GET /api/v1/dashboards/manager (NUEVO).
           DashboardLayout.jsx ya existe como wrapper base.

CU-09  Dejar comentario de coaching
  Actor:        Gerente
  Flujo:        Seleccionar sección → comentar + @mencionar →
                vendedor recibe notificación
  [FAMSPI] Tabla comment (NUEVA). @menciones resuelven contra users.id.
           Visibilidad 'private' solo para gerente ↔ vendedor.

CU-10  Exportar resumen ejecutivo
  Actor:        Vendedor / Gerente
  Flujo:        Click 'Exportar' → elegir PDF o PPTX → descarga
  [FAMSPI] jspdf@3.0.3 + html2canvas@1.4.1 + pdf-lib@1.17.1
           ya instalados. PPTX requiere instalar pptxgenjs.

CU-11  Llenar BS sin conexión
  Actor:        Vendedor (móvil)
  Flujo:        Trabajar offline → cambios encolados → sync al reconectar
  [FAMSPI] Fase v1.0 (móvil). El frontend actual es web-only.

CU-12  Avanzar etapa del embudo
  Actor:        Vendedor
  Flujo:        Drag-and-drop en Kanban → validar RN → sync CRM
  [FAMSPI] Drag-drop requiere @dnd-kit. Validaciones RN en
           opportunityStateTransition.js (NUEVO).

CU-13  Ganar o perder oportunidad
  Actor:        Vendedor
  Flujo:        Marcar Won/Lost → motivo categorizado → BS archivada
  [FAMSPI] El cierre no fuerza crear un BC ni ningún otro proceso.
           Si el vendedor quiere vincular la BS ganada a un BC, lo hace
           de forma explícita mediante CU-16.
           Si Lost → motivo + lecciones (RN-11, obligatorio).

CU-16  Vincular BS a expediente existente (nuevo)
  Actor:        Vendedor / Gerente
  Precondición: BS activa o archivada; expediente existente en FamSPI
  Flujo:        1) Click 'Vincular a expediente'
                2) Selector de tipo: BC | Compra Privada | Compra Pública
                3) Buscar expediente por número, cliente o fecha
                4) Confirmar vínculo
                5) Sistema ofrece importar datos del expediente a la BS
                   (cliente → account, contactos, equipos, monto)
                6) Vendedor decide qué importar (checkbox por campo)
  Postcondición: Vínculo registrado en opportunity_process_link;
                 datos importados solo si el vendedor los aceptó
  Alterno:       Expediente ya vinculado a otra BS → advertir, permitir
                 continuar (N:M permitido)

CU-14  Ver histórico de cambios
  Actor:        Cualquier usuario con acceso
  Flujo:        Click 'Histórico' → timeline → comparar versiones
  [FAMSPI] opportunity_snapshot (NUEVA) sigue el mismo patrón
           que bc_document_versions ya existente.

CU-15  Recibir sugerencia de IA
  Actor:        Vendedor
  Flujo:        BS con ≥30% completada → sistema sugiere acciones
  [FAMSPI] Fase v2.0. No existe infraestructura de IA en FamSPI aún.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. MODELO DE DATOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4.1 Diagrama lógico

  accounts 1─N contacts                         (NUEVAS)
  accounts 1─N opportunities                    (NUEVA)
  opportunities 1─N buying_influence N─1 contacts
  opportunities 1─1 opportunity_rating
  opportunities 1─N opportunity_flag
  opportunities 1─N competitor
  opportunities 1─N bs_action_item
  opportunities 1─N opportunity_snapshot        (event store inmutable)
  opportunities 1─N bs_comment
  opportunities 1─N opportunity_process_link    (NUEVA — vínculo opcional)
  users 1─N opportunities (owner)               (tabla users YA EXISTE)

  opportunity_process_link es polimórfica:
    process_type = 'bc'               → process_id apunta a bc_master.id
    process_type = 'private_purchase' → process_id apunta a private_purchase_requests.id
    process_type = 'public_purchase'  → process_id apunta a equipment_purchase_requests.id
    (extensible a futuros procesos sin cambiar el schema)

4.2 Entidades — Estado por tabla en FamSPI

  Entidad              Tabla en FamSPI             Estado
  ─────────────────────────────────────────────────────────────────────
  Account (empresa)    accounts                    CREAR — ver sección 5
  Contact              contacts                    CREAR — ver sección 5
  Opportunity          opportunity                 CREAR — ver sección 5
  BuyingInfluence      buying_influence            CREAR — ver sección 5
  OpportunityRating    opportunity_rating          CREAR — ver sección 5
  OpportunityFlag      opportunity_flag            CREAR — ver sección 5
  Competitor           competitor                  CREAR — ver sección 5
  ActionItem           bs_action_item              CREAR — ver sección 5
  OpportunitySnapshot  opportunity_snapshot        CREAR — ver sección 5
  Comment              bs_comment                  CREAR — ver sección 5
  Vínculo opcional     opportunity_process_link    CREAR — ver sección 5
                       (polimórfica: BC, privada, pública, extensible)
  User (owner)         users                       EXISTE (id INTEGER)
  BC (vínculo opt.)    bc_master                   EXISTE (id INTEGER)
  Compra privada       private_purchase_requests   EXISTE (id ?)
  Compra pública       equipment_purchase_requests EXISTE (id ?)
  Catálogo competidores competitor_catalog         CREAR — ver sección 5
  Catálogo BR          red_flag_templates          CREAR — ver sección 5
  Catálogo acciones    action_templates            CREAR — ver sección 5

  NOTA: verificar tipos de id de private_purchase_requests y
  equipment_purchase_requests antes de ejecutar migración 195.
  Usar el query:
    SELECT pg_typeof(id) FROM private_purchase_requests LIMIT 1;
    SELECT pg_typeof(id) FROM equipment_purchase_requests LIMIT 1;

4.3 FK crítica: users.id es INTEGER en FamSPI

  La tabla users existente usa id SERIAL (INTEGER), no UUID.
  Todos los campos owner_id, author_id, mentions[] que apunten a
  usuarios deben ser INTEGER REFERENCES users(id), no UUID.
  Las tablas nuevas (accounts, contacts, opportunity, etc.) usan
  UUID entre sí para aislamiento limpio.

4.4 Multi-tenancy en FamSPI

  FamSPI es actualmente single-tenant en DB (sin tabla tenant).
  Las tablas nuevas del Bluesheet NO incluyen tenant_id en MVP.
  RLS se omite en MVP. Se puede agregar en v1.5 si se requiere
  multi-tenant real. El aislamiento por ahora es lógico (owner_id +
  visibilidad por rol en RBAC).


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. DDL SQL — SCHEMA ADAPTADO A FAMSPI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Convención de archivos de migración FamSPI: NNN_descripcion.sql
Última migración existente: 188_private_purchase_provider_contract.sql
Próximas migraciones del Bluesheet: 189 en adelante.

Ejecutar en orden. Sin RLS en MVP (FamSPI es single-tenant).

─────────────────────────────────────────────────────────────────────────
MIGRACIÓN 189 — Tipos ENUM del Bluesheet
─────────────────────────────────────────────────────────────────────────
-- archivo: 189_bluesheet_enums.sql

CREATE TYPE bs_funnel_stage AS ENUM (
  'prospect','qualify','pursue','close','won','lost'
);
CREATE TYPE bs_competitive_position AS ENUM (
  'sole','dominant','shared','zero'
);
CREATE TYPE bs_opp_status AS ENUM (
  'active','paused','archived','won','lost'
);
CREATE TYPE bs_bi_role AS ENUM ('E','T','U','C');
CREATE TYPE bs_bi_influence AS ENUM ('A','M','B');
CREATE TYPE bs_bi_mode AS ENUM ('C','P','E','EC');
CREATE TYPE bs_ynu AS ENUM ('Y','N','U');
CREATE TYPE bs_flag_type AS ENUM ('strength','red_flag');
CREATE TYPE bs_flag_severity AS ENUM ('low','medium','high','critical');
CREATE TYPE bs_action_status AS ENUM (
  'pending','in_progress','done','cancelled'
);
CREATE TYPE bs_comp_pref AS ENUM ('plus','equal','minus');

─────────────────────────────────────────────────────────────────────────
MIGRACIÓN 190 — Tabla accounts
─────────────────────────────────────────────────────────────────────────
-- archivo: 190_bluesheet_accounts.sql
-- Nota: No se usa la tabla `clients` existente porque almacena clientes
-- aprobados con PII encriptada. `accounts` es el directorio de empresas
-- prospecto para el pipeline comercial.

CREATE TABLE accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  industry      VARCHAR(200),
  city          VARCHAR(100),
  country       VARCHAR(100) DEFAULT 'Ecuador',
  website       VARCHAR(500),
  annual_revenue NUMERIC(16,2),
  employee_count INT,
  external_crm_id TEXT UNIQUE,
  -- FK a clients cuando el prospecto se convierte en cliente aprobado
  client_id     INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  created_by    INTEGER NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_name ON accounts(name);
CREATE INDEX idx_accounts_crm  ON accounts(external_crm_id);

─────────────────────────────────────────────────────────────────────────
MIGRACIÓN 191 — Tabla contacts
─────────────────────────────────────────────────────────────────────────
-- archivo: 191_bluesheet_contacts.sql
-- Contactos de empresas (directorio BS). Independiente de clients.

CREATE TABLE contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  title           VARCHAR(200),
  email           VARCHAR(500),
  phone           VARCHAR(50),
  external_crm_id TEXT,
  created_by      INTEGER NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_account ON contacts(account_id);
CREATE INDEX idx_contacts_name    ON contacts(full_name);

─────────────────────────────────────────────────────────────────────────
MIGRACIÓN 192 — Tabla opportunity (núcleo del Bluesheet)
─────────────────────────────────────────────────────────────────────────
-- archivo: 192_bluesheet_opportunity.sql

CREATE TABLE opportunity (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id               UUID NOT NULL REFERENCES accounts(id),
  owner_id                 INTEGER NOT NULL REFERENCES users(id),
  singular_sales_objective TEXT NOT NULL
    CHECK (length(singular_sales_objective) <= 500),
  specific_business_unit   TEXT NOT NULL,
  revenue_amount           NUMERIC(14,2) NOT NULL
    CHECK (revenue_amount >= 0),
  revenue_period_years     INT NOT NULL
    CHECK (revenue_period_years >= 1),
  product_solution         TEXT NOT NULL,
  expected_close_date      DATE NOT NULL,
  funnel_stage             bs_funnel_stage NOT NULL DEFAULT 'prospect',
  competitive_position     bs_competitive_position,
  status                   bs_opp_status NOT NULL DEFAULT 'active',
  external_crm_id          TEXT UNIQUE,
  -- override de RN-05 (score<40 en Close): requiere jefe_comercial
  score_override_by        INTEGER REFERENCES users(id),
  score_override_reason    TEXT,
  score_override_at        TIMESTAMPTZ,
  -- cierre
  close_result             VARCHAR(10) CHECK (close_result IN ('won','lost')),
  close_reason_code        VARCHAR(100),
  close_lessons_learned    TEXT,
  close_justification_zero TEXT,  -- RN-07: posición Cero en Close
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_opp_owner   ON opportunity(owner_id);
CREATE INDEX idx_opp_account ON opportunity(account_id);
CREATE INDEX idx_opp_stage   ON opportunity(funnel_stage);
CREATE INDEX idx_opp_status  ON opportunity(status);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION bs_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_opp_updated
  BEFORE UPDATE ON opportunity
  FOR EACH ROW EXECUTE FUNCTION bs_set_updated_at();

─────────────────────────────────────────────────────────────────────────
MIGRACIÓN 193 — Tablas del Bluesheet (IC, Rating, Flags, Competitor, Actions)
─────────────────────────────────────────────────────────────────────────
-- archivo: 193_bluesheet_core_tables.sql

-- Influencias Compradoras
CREATE TABLE buying_influence (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id       UUID NOT NULL REFERENCES opportunity(id)
                         ON DELETE CASCADE,
  contact_id           UUID NOT NULL REFERENCES contacts(id),
  role                 bs_bi_role NOT NULL,
  influence_level      bs_bi_influence NOT NULL,
  mode                 bs_bi_mode NOT NULL,
  euphoria_panic_level INT NOT NULL
    CHECK (euphoria_panic_level BETWEEN 1 AND 10),
  personal_wins        TEXT[] NOT NULL DEFAULT '{}',
  business_results     TEXT[] NOT NULL DEFAULT '{}',
  competitive_preference bs_comp_pref,
  rating               INT CHECK (rating BETWEEN -5 AND 5),
  rating_evidence      TEXT,
  is_coach             BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, contact_id)
);
CREATE INDEX idx_bi_opp ON buying_influence(opportunity_id);

-- Calificación 5 criterios Miller Heiman (1:1 con opportunity)
-- total_score es GENERATED ALWAYS: la DB lo calcula, no el backend.
CREATE TABLE opportunity_rating (
  opportunity_id           UUID PRIMARY KEY
    REFERENCES opportunity(id) ON DELETE CASCADE,
  sufficient_budget        bs_ynu NOT NULL DEFAULT 'U',
  have_access              bs_ynu NOT NULL DEFAULT 'U',
  understand_buying_process bs_ynu NOT NULL DEFAULT 'U',
  strong_economic_relationship bs_ynu NOT NULL DEFAULT 'U',
  have_coach               bs_ynu NOT NULL DEFAULT 'U',
  total_score              INT GENERATED ALWAYS AS (
    (CASE WHEN sufficient_budget='Y'            THEN 20 ELSE 0 END) +
    (CASE WHEN have_access='Y'                  THEN 20 ELSE 0 END) +
    (CASE WHEN understand_buying_process='Y'    THEN 20 ELSE 0 END) +
    (CASE WHEN strong_economic_relationship='Y' THEN 20 ELSE 0 END) +
    (CASE WHEN have_coach='Y'                   THEN 20 ELSE 0 END)
  ) STORED
);

-- Puntos Fuertes y Banderas Rojas
CREATE TABLE opportunity_flag (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id           UUID NOT NULL REFERENCES opportunity(id)
                             ON DELETE CASCADE,
  type                     bs_flag_type NOT NULL,
  description              TEXT NOT NULL,
  severity                 bs_flag_severity,
  sort_order               INT NOT NULL DEFAULT 0,
  is_auto_generated        BOOLEAN NOT NULL DEFAULT false,
  linked_buying_influence_id UUID REFERENCES buying_influence(id)
                               ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- BR siempre debe tener severity; PF no la requiere
  CHECK (type='strength' OR (type='red_flag' AND severity IS NOT NULL))
);
CREATE INDEX idx_flag_opp ON opportunity_flag(opportunity_id);

-- Competidores por oportunidad
CREATE TABLE competitor (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id       UUID NOT NULL REFERENCES opportunity(id)
                         ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  is_incumbent         BOOLEAN NOT NULL DEFAULT false,
  their_strengths      TEXT,
  their_weaknesses     TEXT,
  -- Eje 1-5 del radar: -5 (ellos mejor) a +5 (yo mejor)
  my_rating_price      INT CHECK (my_rating_price      BETWEEN -5 AND 5),
  my_rating_relationship INT CHECK (my_rating_relationship BETWEEN -5 AND 5),
  my_rating_technical  INT CHECK (my_rating_technical  BETWEEN -5 AND 5),
  my_rating_timing     INT CHECK (my_rating_timing     BETWEEN -5 AND 5),
  my_rating_service    INT CHECK (my_rating_service    BETWEEN -5 AND 5),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_comp_opp ON competitor(opportunity_id);

-- Plan de Acción
-- Nota: existe action_item en otro módulo (vacaciones). Esta es diferente.
CREATE TABLE bs_action_item (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id        UUID NOT NULL REFERENCES opportunity(id)
                          ON DELETE CASCADE,
  activity              TEXT NOT NULL,
  owner_id              INTEGER NOT NULL REFERENCES users(id),
  due_date              DATE NOT NULL,
  status                bs_action_status NOT NULL DEFAULT 'pending',
  leverages_strength_id UUID REFERENCES opportunity_flag(id)
                          ON DELETE SET NULL,
  mitigates_red_flag_id UUID REFERENCES opportunity_flag(id)
                          ON DELETE SET NULL,
  perspective_to_share  TEXT,
  target_audience       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bsaction_opp   ON bs_action_item(opportunity_id);
CREATE INDEX idx_bsaction_owner ON bs_action_item(owner_id);
CREATE INDEX idx_bsaction_due   ON bs_action_item(due_date);

CREATE TRIGGER trg_bsaction_updated
  BEFORE UPDATE ON bs_action_item
  FOR EACH ROW EXECUTE FUNCTION bs_set_updated_at();

─────────────────────────────────────────────────────────────────────────
MIGRACIÓN 194 — Event store y comentarios
─────────────────────────────────────────────────────────────────────────
-- archivo: 194_bluesheet_eventsource_comments.sql

-- Event store inmutable (sigue el patrón de bc_document_versions)
CREATE TABLE opportunity_snapshot (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunity(id),
  version        INT NOT NULL,
  event_type     VARCHAR(50) NOT NULL
    CHECK (event_type IN (
      'create','update_objective','update_bi','update_rating',
      'update_flag','update_competitor','update_action',
      'stage_change','close','score_override'
    )),
  taken_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  author_id      INTEGER NOT NULL REFERENCES users(id),
  payload        JSONB NOT NULL,
  UNIQUE (opportunity_id, version)
);
CREATE INDEX idx_snap_opp ON opportunity_snapshot(opportunity_id);

-- Comentarios de coaching por sección
CREATE TABLE bs_comment (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunity(id) ON DELETE CASCADE,
  section_anchor TEXT NOT NULL,  -- 'objective'|'influences'|'rating'|etc.
  body           TEXT NOT NULL,
  mentions       INTEGER[] DEFAULT '{}',  -- array de users.id (INTEGER)
  author_id      INTEGER NOT NULL REFERENCES users(id),
  visibility     VARCHAR(10) NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public','private')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_comment_opp ON bs_comment(opportunity_id);

─────────────────────────────────────────────────────────────────────────
MIGRACIÓN 195 — Vínculo opcional y polimórfico a cualquier proceso FamSPI
─────────────────────────────────────────────────────────────────────────
-- archivo: 195_bluesheet_process_link.sql
--
-- El Bluesheet es independiente. Esta tabla registra vínculos OPCIONALES
-- a procesos existentes en FamSPI (BC, compra privada, compra pública).
-- Es polimórfica: process_type indica a qué tabla apunta process_id.
-- No usa FK foránea por la polimorfía; la integridad se valida en servicio.
--
-- ANTES DE EJECUTAR: verificar tipos de id en cada proceso:
--   SELECT pg_typeof(id) FROM bc_master LIMIT 1;
--   SELECT pg_typeof(id) FROM private_purchase_requests LIMIT 1;
--   SELECT pg_typeof(id) FROM equipment_purchase_requests LIMIT 1;
-- Ajustar el tipo de process_id según el resultado (TEXT es seguro).

CREATE TYPE bs_process_type AS ENUM (
  'bc',               -- bc_master
  'private_purchase', -- private_purchase_requests
  'public_purchase'   -- equipment_purchase_requests
  -- extensible: ALTER TYPE bs_process_type ADD VALUE 'nuevo_tipo';
);

CREATE TABLE opportunity_process_link (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunity(id) ON DELETE CASCADE,
  process_type   bs_process_type NOT NULL,
  -- process_id como TEXT para soportar INTEGER o UUID según el proceso
  process_id     TEXT NOT NULL,
  -- datos importados del expediente en el momento del vínculo (snapshot)
  imported_data  JSONB,
  notes          TEXT,
  linked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  linked_by      INTEGER NOT NULL REFERENCES users(id),
  -- una BS no se vincula dos veces al mismo expediente
  UNIQUE (opportunity_id, process_type, process_id)
);

CREATE INDEX idx_opp_proc_link_opp  ON opportunity_process_link(opportunity_id);
CREATE INDEX idx_opp_proc_link_proc ON opportunity_process_link(process_type, process_id);

-- imported_data es el snapshot de lo que se copió al vincular.
-- Estructura sugerida del JSONB según process_type:
--
-- process_type = 'bc':
-- {
--   "client_name": "...", "bc_number": "...", "duration_years": 5,
--   "equipment": [{"model": "XN-550", "cost": 15000}],
--   "contacts": [{"name": "Dr. Pérez", "title": "Jefe Lab"}]
-- }
--
-- process_type = 'private_purchase':
-- {
--   "client_name": "...", "client_snapshot": {...},
--   "equipment": [...], "offer_amount": 25000
-- }
--
-- process_type = 'public_purchase':
-- {
--   "client_name": "...", "bc_equipment_cost": 18000,
--   "bc_duration_years": 3, "product_solution": "..."
-- }

─────────────────────────────────────────────────────────────────────────
MIGRACIÓN 196 — Catálogos administrables (RevOps)
─────────────────────────────────────────────────────────────────────────
-- archivo: 196_bluesheet_catalogs.sql

-- Catálogo de competidores (gobernado por admin/RevOps)
CREATE TABLE competitor_catalog (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,
  industry        VARCHAR(200),
  category        VARCHAR(100),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      INTEGER NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Plantillas de banderas rojas comunes
CREATE TABLE red_flag_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description     TEXT NOT NULL,
  category        VARCHAR(100),
  default_severity bs_flag_severity NOT NULL DEFAULT 'medium',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      INTEGER NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Plantillas de acciones del plan
CREATE TABLE action_templates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  category              VARCHAR(100),
  default_duration_days INT NOT NULL DEFAULT 7,
  perspective_template  TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_by            INTEGER NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

─────────────────────────────────────────────────────────────────────────
MIGRACIÓN 197 — Trigger RN-03: auto bandera roja si euforia-pánico ≥ 7
─────────────────────────────────────────────────────────────────────────
-- archivo: 197_bluesheet_triggers.sql

CREATE OR REPLACE FUNCTION bs_check_euphoria_panic()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.euphoria_panic_level >= 7 THEN
    INSERT INTO opportunity_flag (
      opportunity_id, type, description, severity,
      is_auto_generated, linked_buying_influence_id
    ) VALUES (
      NEW.opportunity_id,
      'red_flag',
      'Euforia-Pánico elevado (nivel ' || NEW.euphoria_panic_level ||
        ') en IC registrada',
      'high',
      true,
      NEW.id
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bi_euphoria_panic
  AFTER INSERT OR UPDATE OF euphoria_panic_level ON buying_influence
  FOR EACH ROW
  WHEN (NEW.euphoria_panic_level >= 7)
  EXECUTE FUNCTION bs_check_euphoria_panic();

-- Trigger updated_at para tablas restantes
CREATE TRIGGER trg_accounts_updated
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION bs_set_updated_at();

CREATE TRIGGER trg_contacts_updated
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION bs_set_updated_at();

CREATE TRIGGER trg_comment_updated
  BEFORE UPDATE ON bs_comment
  FOR EACH ROW EXECUTE FUNCTION bs_set_updated_at();


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. REQUERIMIENTOS FUNCIONALES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RF-01  Gestión de oportunidades
  RF-01.1  Wizard de creación
           • 5 pasos guiados, barra de progreso superior
           • Cada paso valida antes de avanzar; no permite saltar pasos
           • Botón "Guardar borrador" disponible desde el paso 2
           • Borrador guardado en opportunity con status='active',
             funnel_stage='prospect' y campos mínimos (pasos completados)
           • Al retomar un borrador, el wizard abre en el último paso incompleto
           • Tiempo objetivo < 4 min para completar los 5 pasos

  RF-01.2  Búsqueda y filtros
           • Filtros combinables: cuenta (autocompletar), vendedor, etapa,
             rango de monto, rango de score, posición competitiva,
             fecha de cierre (desde/hasta), estado (active/archived/won/lost)
           • Búsqueda full-text en: nombre de cuenta, objetivo singular,
             producto/solución — índice en DB sobre estos campos
           • Resultados < 300 ms P95; paginación por cursor (no por offset)
           • Vistas guardables por usuario (filtros nombrados)
           • URL refleja los filtros activos (linkeable y compartible)

  RF-01.3  Duplicar como plantilla
           • Selector de qué secciones clonar: ICs, competidores, flags, acciones
           • Datos sensibles excluidos siempre: contactos específicos, monto,
             fecha cierre, score overrides, comentarios, snapshots
           • La cuenta de destino es obligatoria (no hereda la cuenta origen)
           • La copia se crea en 'prospect' con score 0

  RF-01.4  Archivar / reactivar
           • Archivar es soft-delete: status='archived', no se elimina nada
           • Las BS archivadas no aparecen en listados por defecto;
             requieren filtro explícito status=archived
           • Reactivar cambia status='active'; mantiene todos los datos y snapshots
           • Al archivar: acciones pendientes se marcan 'cancelled' automáticamente;
             sus owners reciben notificación
           • Archivar registra en audit_log y crea snapshot de tipo 'close'

  RF-01.5  Kanban del embudo
           • Columnas: Prospect | Qualify | Pursue | Close
           • Won y Lost no son columnas; son estados finales accesibles desde
             el botón "Cerrar oportunidad" dentro de la tarjeta
           • Drag-and-drop entre columnas dispara POST /:id/stage con validación RN
           • Si la validación falla, la tarjeta regresa a su columna original
             con un toast explicando el motivo del bloqueo
           • Tarjeta muestra: cuenta, monto formateado, score con semáforo,
             conteo de BR críticas sin acción, días hasta el close date,
             indicador si falta Coach o EB

  RF-01.6  Autosave
           • Debounce de 2 segundos en cualquier campo del workspace
           • Indicador visual: "Guardando…" → "Guardado hace X"
           • Si la llamada falla: indicador rojo "Sin guardar" + retry automático
           • El autosave no dispara validaciones de RN (solo el cambio de stage lo hace)

  RF-01.7  Concurrencia
           • Si dos usuarios editan la misma BS simultáneamente, el sistema usa
             optimistic locking con campo updated_at
           • Si hay conflicto (updated_at diverge), el segundo escritor recibe
             error 409 con mensaje claro: "Otra persona guardó cambios mientras
             editabas. Recarga para ver la versión más reciente."
           • No hay resolución automática de conflictos en MVP (last-write-wins
             por sesión, no por campo)

  [FAMSPI] RF-01.1: wizard/ carpeta existe en comercial pero vacía.
           RF-01.4: usar audit_log existente (módulo auditoria).
           RF-01.5: requiere instalar @dnd-kit/core + @dnd-kit/sortable.
           RF-01.7: optimistic locking con updated_at ya es patrón en bc_master.

RF-02  Influencias Compradoras
  RF-02.1  Autocompletar contactos
           • Buscar en contacts al teclear ≥2 caracteres; resultados < 300 ms
           • Si el contacto no existe, opción inline "Crear contacto rápido":
             pide nombre, título, email — lo crea en contacts y lo asocia
           • Un contacto puede ser IC en múltiples oportunidades simultáneamente
           • Un contacto tiene un único rol primario por oportunidad (RN-09);
             is_coach es una bandera adicional independiente del rol
           • Al seleccionar un contacto que ya es IC en la misma oportunidad,
             el sistema muestra advertencia y ofrece editar la IC existente

  RF-02.2  Alerta sin Coach
           • Banner amarillo persistente en el workspace cuando stage >= 'pursue'
             y no existe ninguna IC con is_coach=true
           • El banner NO bloquea guardar; sí bloquea la transición a 'Close'
           • El banner desaparece en cuanto al menos una IC tiene is_coach=true
           • Si la única IC Coach es eliminada → banner reaparece inmediatamente

  RF-02.3  Alerta sin Económico (EB)
           • Banner rojo en workspace si no hay IC con role='E'
           • Bloquea avance a 'Close' (validado en backend RN-02)
           • Si el único EB es eliminado mientras la oportunidad está en 'pursue',
             el sistema permite continuar en 'pursue' pero impide avanzar a 'Close'

  RF-02.4  Mapa visual IC
           • Matriz X=Rol (E/T/U/C), Y=Influencia (A/M/B)
           • Cada IC es una burbuja con el nombre del contacto
           • Color de burbuja = escala Euforia-Pánico:
             1-3 verde (euforia), 4-6 amarillo (neutro), 7-10 rojo (pánico)
           • Click en burbuja abre panel lateral con todos los datos de la IC
           • La matriz es de solo lectura; la edición se hace desde el panel

  RF-02.5  Slider Euforia-Pánico
           • Rango 1 (euforia máxima) a 10 (pánico máximo)
           • Accesible por teclado (flechas) y por touch
           • Etiqueta textual que cambia con el valor:
             1-3: "Euforia — oportunidad clara", 4-6: "Neutro",
             7-9: "Preocupado", 10: "Pánico — ve riesgo crítico"
           • Al llegar a ≥7 → aviso inline inmediato: "Se generará una
             bandera roja automática (RN-03)" antes de guardar

  RF-02.6  Selector Modo con tooltips
           • C/P/E/EC con definición contextual al hover/tap
           • Tooltip muestra ejemplo concreto de cada modo
           • El modo afecta la estrategia sugerida (solo info, no bloquea)

  RF-02.7  Edición y eliminación de IC
           • Todos los campos de la IC son editables después de crearla
           • Eliminar una IC: confirmación si tiene is_coach=true o role='E'
             con advertencia del impacto en RN-01/RN-02
           • La eliminación de IC dispara re-evaluación de alertas en tiempo real
           • El historial de la IC eliminada se preserva en opportunity_snapshot

  [FAMSPI] RF-02.1: GET /api/v1/contacts?q= + POST /api/v1/contacts (NUEVO).
           RF-02.4: HTML/CSS grid o SVG posicionado (sin librería adicional).
           RF-02.7: DELETE /api/v1/buying-influences/:id (ya en spec API).

RF-03  Calificación
  RF-03.1  Tarjetas Y/N/U
           • Una tarjeta por criterio con texto explicativo de qué significa
             responder Y, N o U en ese criterio específico
           • Respuesta con un solo tap/click; el cambio se guarda inmediatamente
             (sin botón "Guardar" — autosave de 2s)
           • El criterio actual se resalta visualmente (borde activo)

  RF-03.2  Score en vivo
           • El score se actualiza en pantalla al instante (optimistic update)
           • El valor definitivo lo confirma la respuesta del PUT /rating
             que devuelve total_score desde la GENERATED ALWAYS column
           • Si el backend corrige el score (edge case de concurrencia),
             el UI actualiza silenciosamente sin interrumpir al usuario

  RF-03.3  Semáforo
           • 0-40: rojo — "Oportunidad en riesgo"
           • 41-70: amarillo — "Oportunidad en desarrollo"
           • 71-100: verde — "Oportunidad sólida"
           • El semáforo aparece en: workspace (panel lateral), tarjeta Kanban,
             lista de oportunidades, y exportación PDF
           • Si score baja mientras ya está en 'close' (ej. se cambió un Y a N),
             aparece banner de advertencia pero no retrocede el stage automáticamente

  RF-03.4  Acciones sugeridas por N/U
           • Cada criterio con respuesta N o U genera una sugerencia de acción
             predefinida visible inmediatamente bajo la tarjeta
           • Sugerencia es un botón "Crear acción" que pre-llena el formulario
           • El usuario puede ignorar la sugerencia sin consecuencias

  RF-03.5  Histórico de score
           • Gráfico de línea (chart.js) con la evolución del score en el tiempo
           • Cada punto corresponde a un snapshot de tipo 'update_rating'
           • Al hover sobre un punto se muestra fecha, score, y quién lo actualizó
           • Accesible desde la pestaña "Histórico" del workspace

  [FAMSPI] RF-03.2: total_score es GENERATED ALWAYS en opportunity_rating.
           RF-03.5: datos vienen de opportunity_snapshot filtrados por
           event_type='update_rating'.

RF-04  Puntos Fuertes y Banderas Rojas
  RF-04.1  Listas reordenables
           • Drag-and-drop separado para Puntos Fuertes y para Banderas Rojas
           • El orden se persiste en sort_order (columna INT en opportunity_flag)
           • El reordenamiento dispara PATCH con el nuevo sort_order; no crea snapshot
           • Accessible por teclado (Alt+Arriba/Abajo para mover items)

  RF-04.2  BR critical → acción obligatoria
           • Al intentar cambiar stage con ≥1 BR critical sin acción vinculada,
             el sistema muestra checklist de BRs bloqueantes antes de continuar
           • El checklist permite crear la acción inline sin salir del modal
           • La validación ocurre en backend (fuente de verdad) y en frontend (UX)

  RF-04.3  Flags automáticas (RN-03 y RN-12)
           • Las flags generadas automáticamente tienen is_auto_generated=true
             y se muestran con un ícono diferenciador (ej. rayo o robot)
           • Una flag auto-generada NO puede eliminarse directamente;
             solo puede resolverse mediante una acción vinculada marcada como 'done'
           • Cuando la acción mitigadora se marca 'done', el sistema sugiere
             "¿Resolver esta bandera roja?" con botón de confirmación
           • Al resolver, la flag no se elimina — cambia a un estado visual
             "resuelta" (color gris, tachado) para mantener el historial

  RF-04.4  Biblioteca BR comunes
           • Catálogo precargado de red_flag_templates por categoría
           • Al agregar una BR, opción "Elegir de la biblioteca" abre selector
           • Selector buscable; categorías: Precio, Relación, Técnico, Proceso,
             Competencia, Presupuesto, Personas
           • Al elegir una plantilla, pre-llena description y severity

  RF-04.5  Puntos Fuertes
           • Los PF no tienen severity ni acción obligatoria
           • Pueden vincularse a una IC para indicar quién los reconoce
           • En el plan de acción, una acción puede "apalancar" un PF
             (leverages_strength_id)

  RF-04.6  Eliminación de flags
           • Las flags manuales (no auto-generadas) pueden eliminarse con confirmación
           • Si la flag tiene acciones vinculadas, advertir antes de eliminar
           • Las acciones vinculadas NO se eliminan al eliminar la flag;
             su campo mitigates_red_flag_id o leverages_strength_id se pone NULL

  [FAMSPI] RF-04.1: sort_order en opportunity_flag.
           RF-04.2/RF-04.3: opportunityFlag.service.js.
           RF-04.3: trigger 197 genera la flag; el servicio gestiona la resolución.

RF-05  Mapa Competitivo
  RF-05.1  Multi-competidor
           • N competidores sin límite; incumbente marcado con ícono distintivo
           • Al agregar un competidor, autocompletar desde competitor_catalog
           • Si no está en catálogo, crear ad-hoc (queda solo en la oportunidad,
             no se agrega al catálogo automáticamente — eso lo hace el admin)
           • Solo puede haber un incumbente marcado por oportunidad
             (al marcar uno como incumbente, el anterior se desmarca)
           • Los competidores pueden editarse y eliminarse en cualquier momento
           • Eliminar un competidor no afecta el selector de posición global

  RF-05.2  Gráfico radial
           • 5 ejes: Precio | Relación | Técnico | Timing | Servicio
           • Escala -5 (ellos mejor) a +5 (yo mejor); 0 es empate
           • Cada competidor es una capa del radar (distinto color/trazo)
           • Toggle de visibilidad por competidor (checkbox en la leyenda)
           • Hover sobre un vértice muestra el valor numérico y el campo de evidencia
           • Si no hay competidores, el área del gráfico muestra placeholder:
             "Agrega al menos un competidor para ver el mapa"
           • El gráfico es exportable como imagen PNG (botón de descarga)

  RF-05.3  Selector posición global
           • Sole (Única) | Dominant (Dominante) | Shared (Compartida) | Zero (Cero)
           • Definición visible en tooltip al hover de cada opción
           • Cambiar a Zero mientras stage='close' activa RN-07 (justificación)
           • El valor de posición global cambia el color del borde del header de la BS:
             Verde (Sole/Dominant), Amarillo (Shared), Rojo (Zero)

  RF-05.4  Evidencia por eje
           • Cada rating (-5..+5) debe poder acompañarse de un texto de evidencia
           • La evidencia es opcional pero el radar la muestra al hover
           • La evidencia se exporta en el PDF bajo la tabla de competidores

  [FAMSPI] RF-05.2: chart.js RadarChart (ya instalado).
           RF-05.4: evidencia almacenada en competitor.their_strengths /
           their_weaknesses + campo libre por eje si se decide agregar en DDL.
           Considerar agregar competitor_axis_evidence JSONB a la tabla competitor.

RF-06  Plan de Acción y Calendario
  RF-06.1  Integración calendario (v1.0)
           • Al crear una acción, opción "Agregar al calendario" (no obligatoria)
           • Si el usuario tiene Google Calendar conectado, crea evento
           • El evento incluye: nombre de la oportunidad, actividad, due_date
           • Si se cambia la due_date en FamSPI, se actualiza el evento en Calendar
           • Si se marca 'done' o 'cancelled', se elimina el evento en Calendar
           • Si Calendar no está conectado, se omite silenciosamente (no bloquea)

  RF-06.2  Notificaciones de acciones
           • 24h antes del due_date → notificación al owner de la acción
           • Día del due_date (a las 8am) → notificación al owner
           • Al vencer (día siguiente sin marcar done) → notificación al owner
             + notificación al owner de la oportunidad si es diferente
           • A los 14 días vencida → trigger RN-12 (BR automática)
           • Canales configurables por usuario: email, push, in-app
           • Notificaciones para el gerente: cuando una acción de su equipo
             vence sin resolverse (configurable: inmediato o resumen diario)

  RF-06.3  Mis acciones hoy (agregado por usuario)
           • Lista de todas las acciones del usuario autenticado con due_date = hoy
             o vencidas (due_date < hoy, status = pending|in_progress)
           • Ordenadas por: vencidas primero, luego por due_date, luego por monto
             de la oportunidad padre
           • Cambio de estado inline (pending → in_progress → done) sin abrir la BS
           • Al marcar 'done' desde esta vista, se re-evalúa RN-06 en la BS padre

  RF-06.4  Plantillas de acciones
           • Catálogo de action_templates administrado por jefe_comercial/admin
           • Al crear acción, opción "Usar plantilla" con selector buscable
           • Categorías de plantilla: Reunión EB | Demo técnica | Propuesta |
             Seguimiento | Validación presupuesto | Identificar Coach | Otro
           • La plantilla pre-llena: actividad, duración sugerida, perspective_to_share
           • El usuario puede modificar todos los campos antes de guardar

  RF-06.5  Ciclo de vida de acciones
           • Estado 'done': acción completada; si mitigaba una BR,
             el sistema sugiere resolver la flag (ver RF-04.3)
           • Estado 'cancelled': acción descartada con razón opcional
           • Reasignación: el owner de la oportunidad o el gerente pueden
             cambiar el owner de una acción (genera notificación al nuevo owner)
           • Si el owner de una acción es desactivado en el sistema,
             la acción se reasigna automáticamente al owner de la oportunidad
             y se genera notificación y entrada en audit_log

  [FAMSPI] RF-06.2: notifications + notification_dispatch_queue ya existen.
           Agregar tipos: bs_action_due_24h, bs_action_due_today,
           bs_action_overdue, bs_action_overdue_manager.
           RF-06.1: gmail.routes.js + Calendar API (mismo OAuth2 scope).
           RF-06.5: lógica de reasignación en bs_action_item.service.js.

RF-07  Reportes y Dashboard
  RF-07.1  Exportación PDF
           • El PDF incluye: portada (logo, cuenta, fecha, vendedor), objetivo
             singular, tabla de ICs (rol, influencia, modo, EP, triunfos,
             resultados), calificación (5 criterios + score + semáforo),
             tabla de competidores + ejes, lista de PF y BR, plan de acción,
             posición competitiva global
           • El PDF excluye: comentarios de coaching privados, histórico de
             snapshots, datos internos de overrides
           • Si la BS está incompleta (secciones vacías), el PDF incluye
             advertencia por sección vacía pero se genera igualmente
           • La generación es asíncrona: POST /export devuelve job_id;
             el cliente hace polling GET /export-jobs/:jobId cada 2s
             hasta status='done' o 'failed'; máximo 30s
           • El archivo PDF se firma con la infraestructura de documents/
             signature existente si se requiere (opcional)
           • Los exports se almacenan 24h; después se eliminan del storage

  RF-07.2  Dashboard gerente
           • Tarjetas resumen: # BS por etapa, score promedio del equipo,
             # BS sin Coach, # BS sin EB, # acciones vencidas del equipo
           • Gráfico de embudo: conversión entre etapas (% que avanza)
           • Tabla de oportunidades en riesgo: score < 50 O BR crítica sin
             acción O sin Coach O sin EB O sin actualización > 30 días
           • Gráfico de tendencia mensual de score promedio (últimos 6 meses)
           • Win-rate por banda de score: <40, 40-70, >70
           • Filtros: por vendedor (multiselect), por rango de monto,
             por fecha de cierre, por etapa
           • Drill-down a la BS específica con un click
           • El dashboard es solo lectura; no permite editar BS desde él

  RF-07.3  Salud del pipeline
           • BS en riesgo = cumple al menos UNO de: score<50, BR critical
             sin acción, sin Coach en pursue+, sin EB en pursue+, sin
             actualización > 30 días en pursue/close
           • Lista exportable como CSV o PDF
           • Cada ítem de la lista muestra el motivo de riesgo con ícono

  RF-07.4  Histórico de score
           • Línea de tiempo del score con todos los puntos de cambio
           • Los eventos de stage change se marcan en la línea temporal
           • Filtro por rango de fechas
           • Si no hay snapshots de rating, muestra estado: "Sin historial"

  RF-07.5  Métricas personales del vendedor
           • Vista propia (no del gerente): mis BS por etapa, mi score promedio,
             mis acciones vencidas, mis BS sin actualizar
           • Motivacional: racha de actualizaciones semanales, win-rate propio

  [FAMSPI] RF-07.1: jspdf@3.0.3 + html2canvas@1.4.1 ya instalados.
           RF-07.2: endpoint nuevo en dashboard.routes.js existente.
           RF-07.1: export job state en tabla bs_export_jobs (NUEVA, opcional)
           o en memoria con TTL de 30s (más simple para MVP).

RF-08  Colaboración
  RF-08.1  Comentarios + @menciones
           • Comentarios anclados a una sección específica del workspace
             (section_anchor: 'objective'|'influences'|'rating'|'competitors'|
             'flags'|'actions'|'general')
           • El autor puede editar su comentario hasta 15 minutos después de crearlo;
             pasado ese tiempo, solo puede eliminarlo (con auditoría)
           • El jefe_comercial puede eliminar cualquier comentario con razón obligatoria
           • @menciones con autocompletar de usuarios del equipo (teclear @)
           • Las menciones generan notificación in-app + email al mencionado
           • Los comentarios eliminados no se borran de DB; se marcan deleted=true
             y muestran "[Comentario eliminado]" en el thread
           • Threading de 1 nivel: respuestas directas a un comentario padre
             (no reply a reply para simplificar MVP)
           • Conteo de comentarios no leídos visible en la pestaña del workspace

  RF-08.2  Modo coaching
           • Comentarios con visibility='private' solo visibles para:
             el autor (gerente), el owner de la oportunidad, y otros gerentes
           • Los comentarios privados se muestran con fondo diferenciado y
             etiqueta "Solo visible para ti y el vendedor"
           • Los comentarios privados NO aparecen en la exportación PDF

  RF-08.3  Acceso compartido entre vendedores (MVP)
           • El owner puede agregar colaboradores a su BS
           • Un colaborador tiene acceso de lectura y puede agregar comentarios
           • No puede editar contenido de la BS (ICs, flags, competidores, acciones)
           • El gerente puede agregar/quitar colaboradores de las BS de su equipo
           • Lista de colaboradores visible en el panel lateral del workspace

  RF-08.4  Link de solo lectura (v1.5)
           • Token firmado con expiración configurable (1d, 7d, 30d)
           • Accesible sin login para usuarios internos con el enlace
           • Muestra la BS en modo lectura sin commentarios privados
           • El link puede revocarse manualmente; acceso auditado en audit_log

  [FAMSPI] RF-08.1: tabla bs_comment + campo deleted BOOLEAN.
           RF-08.3: tabla opportunity_collaborator (NUEVA, simple):
           {opportunity_id UUID, user_id INTEGER, added_by INTEGER, added_at}.
           RF-08.4: integrable con sistema de documentos existente.

RF-09  Integración CRM
  RF-09.1  Conectores
           • Salesforce: OAuth2 Connected App; scopes: api, refresh_token
           • HubSpot: OAuth2 Private App (fase v1.5)
           • Configuración por usuario: cada vendedor conecta su cuenta CRM
           • El admin puede configurar una conexión a nivel organización (fallback)

  RF-09.2  Sync bidireccional
           • Campos sincronizados:
             CRM → BS: account name, contact (nombre, título, email),
               amount, close date, stage mapping
             BS → CRM: stage (con mapeo configurable), close result,
               score (campo custom en CRM), fecha de última actualización
           • Latencia máxima de sync: 30s desde el evento
           • Estrategia de conflicto: el campo con updated_at más reciente gana
           • Si un registro del CRM se elimina y tiene BS vinculada:
             la BS NO se elimina; la cuenta/contacto queda huérfano con
             external_crm_id preservado; se notifica al admin

  RF-09.3  Webhooks Won/Lost
           • Al cerrar Won/Lost en FamSPI → event en integration_outbox → push al CRM
           • Al recibir Won/Lost desde CRM (webhook entrante) → cierra la BS
             si existe una vinculada por external_crm_id
           • Firma HMAC verificada en todos los webhooks entrantes
           • Reintentos automáticos: 3 intentos con backoff exponencial (1m, 5m, 30m)

  RF-09.4  Mapeo de campos
           • Configuración de mapeo account_field → crm_field administrable por RevOps
           • integration_product_map ya existe para mapeo de productos

  RF-10  Gestión de Cuentas y Contactos
  RF-10.1  CRUD de cuentas (accounts)
           • Crear, editar, buscar (full-text en name, industry, city)
           • Página de detalle de cuenta: info + lista de oportunidades vinculadas
             + lista de contactos + vínculo a clients si existe
           • Merge de cuentas duplicadas: el admin puede fusionar dos accounts;
             las oportunidades y contactos se reasignan a la cuenta superviviente
           • La cuenta no puede eliminarse si tiene oportunidades activas

  RF-10.2  CRUD de contactos (contacts)
           • Crear contacto desde la cuenta (acceso desde perfil de cuenta)
             o inline desde el formulario de IC (crear contacto rápido)
           • Un contacto pertenece a una cuenta; no puede existir sin cuenta
           • Editar: nombre, título, email, teléfono, external_crm_id
           • Al buscar contactos para IC, el autocompletar filtra primero los de
             la cuenta de la oportunidad, luego permite buscar en todas las cuentas
           • Eliminar contacto: solo si no está vinculado como IC en ninguna
             oportunidad activa; si lo está, solo archivar

  RF-10.3  Vinculación accounts → clients
           • Campo client_id (FK nullable a clients.id) en accounts
           • Cuando un prospecto se convierte en cliente aprobado,
             el jefe_comercial o admin puede hacer el enlace manual
           • El enlace NO es automático; requiere acción explícita
           • Una vez enlazado, el perfil de cuenta muestra datos del cliente
             (sin revelar PII encriptada; solo nombre y estado)

  RF-11  Vinculación a Expedientes FamSPI (CU-16)
  RF-11.1  Selector de expediente
           • Tipo de proceso: BC | Compra Privada | Compra Pública
           • Buscador por: número de expediente, nombre de cliente, fecha, estado
           • Previsualización del expediente antes de vincular:
             cliente, monto, equipos, estado actual, fecha
           • Si el expediente ya está vinculado a otra BS, advertencia visible
             (no bloquea — N:M permitido)

  RF-11.2  Importación de datos
           • Después de vincular, el sistema ofrece importar campos específicos
           • Campos disponibles según el tipo de proceso:
             BC → account (nombre empresa), contacts (de la BC),
               product_solution (equipo principal), revenue_amount
             Compra Privada → account (de client_snapshot), equipment (lista),
               offer_amount como revenue_amount
             Compra Pública → account (de bc_master.client), product_solution,
               revenue_amount (bc_equipment_cost)
           • El usuario elige qué campos importar con checkboxes
           • La importación sobrescribe solo los campos seleccionados
           • Los datos importados se guardan en imported_data JSONB del link
             (snapshot del momento del vínculo, no se actualiza después)
           • Botón "Re-importar" disponible para actualizar desde el expediente actual

  RF-11.3  Panel de vínculos en workspace
           • Sección "Expedientes vinculados" en el panel lateral del workspace
           • Muestra: tipo de proceso, número/ID, estado actual del expediente
             y fecha de vinculación
           • Botón de acceso directo al expediente (navega al módulo correspondiente)
           • Botón desvincular (elimina el link, no toca el expediente)

  RF-12  Inteligencia Artificial (fase v2.0)
  RF-12.1  IA sugiere BR — detección de patrones de riesgo a partir del estado
  RF-12.2  IA borrador de plan — genera acciones a partir del estado de la BS
  RF-12.3  Resumen ejecutivo NL — párrafo en lenguaje natural del estado actual
  RF-12.4  Detector de inconsistencias — identifica contradicciones entre secciones
           Ejemplo: IC marcada como Coach pero con euphoria_panic=9 sin BR vinculada

  [FAMSPI] RF-10/RF-11: módulos accounts/ y contacts/ (NUEVOS en backend).
           RF-11.3: sección adicional en WorkspacePanel.jsx.
           RF-09.2: integration_outbox ya existe para el patrón de sync.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. REQUERIMIENTOS NO FUNCIONALES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RNF-01  Disponibilidad
  RNF-01.1  Uptime mensual ≥ 99.9% medido en status page
  RNF-01.2  Offline-first móvil (v1.0) — crear/editar sin conexión
  RNF-01.3  Conflict resolution MVP — last-write-wins por sesión
             (409 con mensaje claro si updated_at diverge, ver RF-01.7)
  RNF-01.4  Degradación graciosa: si el sistema de notificaciones falla,
             las acciones principales (crear/editar BS) siguen funcionando
  RNF-01.5  Jobs nocturnos (RN-12/RN-13): si fallan, no bloquean la app;
             reintento automático al siguiente ciclo con alert en logs

RNF-02  Seguridad
  RNF-02.1  SSO — Google Workspace (ya en auth.routes.js)
  RNF-02.2  RBAC — según mapeo sección 2; verificar en cada endpoint,
             no solo en el frontend
  RNF-02.3  TLS 1.3 en tránsito; AES-256 en reposo
  RNF-02.4  Auditoría — 100% de escrituras en audit_log (ya existe)
  RNF-02.5  Rate limiting en endpoints de búsqueda y autocompletar:
             máximo 60 req/min por usuario para contacts?q= y accounts?q=
  RNF-02.6  Los comentarios privados (visibility='private') deben verificarse
             en el backend, nunca filtrados solo en el frontend
  RNF-02.7  Las exportaciones PDF/PPTX se registran en audit_log con el
             ID del usuario, timestamp y ID de la oportunidad
  RNF-02.8  Los webhooks CRM entrantes se validan con HMAC-SHA256;
             payload inválido → 401 y log de seguridad
  [FAMSPI]  RNF-02.1 y RNF-02.4 ya cumplen de forma nativa.

RNF-03  Performance
  RNF-03.1  Carga inicial del workspace < 1.5 s P95 (TTI)
  RNF-03.2  Autosave: debounce 2s; respuesta del servidor < 500 ms P95
  RNF-03.3  Búsqueda full-text < 300 ms P95
  RNF-03.4  Generación de PDF < 10 s; si supera 30 s → error con reintento
  RNF-03.5  El dashboard del gerente carga en < 2 s P95 con hasta 500 BS
  RNF-03.6  El Kanban renderiza hasta 200 tarjetas sin paginación;
             si supera 200, paginar por columna con "Cargar más"

RNF-04  Usabilidad
  RNF-04.1  Mobile-first, diseño usable desde ≤ 360px
  RNF-04.2  WCAG 2.1 AA — contraste de colores del semáforo debe pasar AA
             (incluir texto alternativo junto al color, no solo el color)
  RNF-04.3  Idioma: español Ecuador; formato de moneda: $XX.XXX,XX
  RNF-04.4  Formato de fechas: DD/MM/YYYY en toda la UI
  RNF-04.5  Todos los estados de error de API muestran mensaje legible
             en español; nunca mostrar el error técnico al usuario final
  RNF-04.6  El wizard tiene botón "Cancelar" que no guarda nada si se
             cancela antes del paso 2 (donde se guarda el borrador)
  RNF-04.7  Los modales de confirmación destructiva (eliminar IC, eliminar
             competidor, desvincular expediente) requieren confirmación
             explícita; no son dismissibles haciendo click fuera

RNF-05  Escalabilidad
  RNF-05.1  Diseñado para 10K usuarios concurrentes sin degradación
  RNF-05.2  Sin límite de BS por cuenta; paginación cursor en todos los listados
  RNF-05.3  Los índices en opportunity (owner_id, funnel_stage, status,
             account_id) son obligatorios desde la migración 192

RNF-06  Integridad
  RNF-06.1  Score inviolable: GENERATED ALWAYS en DB; el backend nunca
             calcula ni pasa el score, solo lo lee desde DB
  RNF-06.2  Event store inmutable: opportunity_snapshot nunca recibe UPDATE
             ni DELETE; solo INSERT; violación = error de aplicación
  RNF-06.3  Los ENUMs de DB (bs_funnel_stage, bs_bi_role, etc.) son la
             única fuente de verdad para valores válidos; el backend
             valida con zod antes de llegar a DB
  RNF-06.4  Toda mutación que cambia ICs, Rating, Stage, Flags, Actions
             o Close debe crear un snapshot ANTES de retornar la respuesta
             (no en background — si falla el snapshot, la mutación no se persiste)

RNF-07  Observabilidad
  RNF-07.1  Correlation-id en todos los requests (ya existe en FamSPI)
  RNF-07.2  Log de cada transición de stage con: who, from, to, timestamp,
             override (si aplica), motivo de bloqueo (si aplica)
  RNF-07.3  Log de cada export con: user_id, opp_id, format, duration_ms
  RNF-07.4  Alert si job RN-12 o RN-13 no corre en > 26h (debería correr diario)
  [FAMSPI]  Logs estructurados JSON ya presentes; agregar estos campos específicos.

RNF-08  Mantenibilidad
  RNF-08.1  Cobertura de tests:
             - opportunityStateTransition.js: 100% de casos RN-01..RN-15
             - opportunityFlag.service.js: 100%
             - buyingInfluence.service.js: 100%
             - resto del módulo: ≥ 80% de líneas
  RNF-08.2  Cada endpoint de API tiene al menos: 1 test happy path,
             1 test de autorización (rol sin permiso → 403),
             1 test de validación (payload inválido → 400/422)
  RNF-08.3  Los jobs nocturnos (RN-12/RN-13) tienen tests de integración
             que verifican que las notificaciones se encolan correctamente
  RNF-08.4  CI/CD — deploy en Cloud Run vía deploy_backend_cloudrun.ps1;
             el pipeline no despliega si la cobertura baja del umbral


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. REGLAS DE NEGOCIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Todas las RN se implementan en backend (fuente de verdad) y se reflejan
en UI. El archivo central es:
backend/src/modules/opportunities/opportunityStateTransition.js

ID     Regla                                          Dónde en FamSPI
──────────────────────────────────────────────────────────────────────────
RN-01  Pursue+ requiere ≥1 IC con is_coach=true       opportunityStateTransition.js
       → Banner persistente en UI; bloquea avance      + banner en OpportunityDetail

RN-02  Close requiere ≥1 IC con role='E'              opportunityStateTransition.js
       → Bloquea transición a 'Close'                  + alerta RF-02.3

RN-03  IC con euphoria_panic_level ≥ 7                Trigger 197_bluesheet_triggers.sql
       → BR automática severity='high'                 (DB lo hace, no el backend)

RN-04  total_score = Σ(criterio='Y' → 20)            GENERATED ALWAYS en opportunity_rating
       → Inviolable por diseño de DB                   (no requiere código)

RN-05  score < 40 en stage='Close' → override gerente API: score_override_by + score_override_reason
       → Solo jefe_comercial puede aprobar             RBAC en opportunityPermissions.js

RN-06  BR critical sin acción → bloquea avance        opportunityFlag.service.js
       → Checklist en UI antes de cambiar etapa        + validación en opportunityStateTransition

RN-07  Posición 'zero' en 'Close' → justificación     Campo close_justification_zero
       → Bloquea cierre sin texto                      en opportunity; validación en POST /close

RN-08  IC con role='E' → personal_wins y              Validación en buyingInfluence.service.js
       business_results obligatorios                   Aviso amarillo en UI (no bloquea)

RN-09  1 contacto = 1 rol primario por Opp            UNIQUE(opportunity_id, contact_id)
       Coach es is_coach BOOLEAN adicional             en buying_influence (DB constraint)

RN-10  Avance de stage solo en orden secuencial        opportunityStateTransition.js
       Won/Lost solo desde 'close'                     State machine lineal

RN-11  Lost → motivo categorizado + lecciones          Campos close_reason_code +
       aprendidas obligatorios                         close_lessons_learned en POST /close

RN-12  Acciones vencidas > 14 días → BR medium        Job nocturno en opportunities.service.js
       automática                                      Cron o Cloud Scheduler

RN-13  BS sin edición > 30 días en pursue/close        Job semanal → notificación al
       → alerta al gerente                             jefe_comercial vía notifications

RN-14  Cambio de owner_id → doble aprobación           Workflow en opportunityPermissions.js
       (cedente + receptor)                            Estado intermedio 'pending_transfer'

RN-15  Snapshot en cada cambio significativo           opportunities.service.js llama
       (BI, Rating, Stage, Flag, Action, Close)        createSnapshot() en cada mutación


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. ESPECIFICACIÓN DE API
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Base URL: /api/v1  (consistente con todos los módulos de FamSPI)
Auth:     Bearer JWT (mismo token que el resto del sistema)
Style:    REST JSON — mismo patrón que business-case, clients, kickoff

─────────────────────────────────────────────────────────
ACCOUNTS (nuevo módulo)
─────────────────────────────────────────────────────────
GET    /api/v1/accounts               Buscar/listar cuentas
POST   /api/v1/accounts               Crear cuenta
GET    /api/v1/accounts/:id           Detalle con contactos
PATCH  /api/v1/accounts/:id           Actualizar cuenta

─────────────────────────────────────────────────────────
CONTACTS (nuevo módulo)
─────────────────────────────────────────────────────────
GET    /api/v1/contacts               Buscar (q=, account_id=)
POST   /api/v1/contacts               Crear contacto
PATCH  /api/v1/contacts/:id           Actualizar contacto

─────────────────────────────────────────────────────────
OPPORTUNITIES (módulo principal BS)
─────────────────────────────────────────────────────────
Método  Ruta                                   Descripción
──────────────────────────────────────────────────────────────────────────
POST    /api/v1/opportunities                  Crear oportunidad
        Body: {account_id, singular_sales_objective,
               specific_business_unit, revenue_amount,
               revenue_period_years, product_solution,
               expected_close_date}
        Resp 201: opportunity completa + opportunity_rating inicial

GET     /api/v1/opportunities                  Listar/filtrar
        Query: stage, owner_id, account_id,
               min_score, max_score, status,
               q (full-text), limit, cursor
        Resp 200: {data:[], next_cursor}

GET     /api/v1/opportunities/:id              Detalle con relaciones
        Resp 200: opportunity + buying_influences + rating +
                  flags + competitors + actions + comments

PATCH   /api/v1/opportunities/:id              Actualizar campos base
        Resp 200: opportunity actualizada + snapshot RN-15

POST    /api/v1/opportunities/:id/stage        Transición de etapa
        Body: {stage, override_reason?}
        Resp 200: opportunity / 422 si viola RN-01..10
        Valida: opportunityStateTransition.js

POST    /api/v1/opportunities/:id/close        Ganar o perder
        Body: {result: 'won'|'lost', reason_code,
               lessons_learned,           (obligatorio si lost - RN-11)
               justification_zero?}       (obligatorio si pos=zero - RN-07)
        Resp 200 / 422

─────────────────────────────────────────────────────────
SUBRECURSOS DE OPPORTUNITY
─────────────────────────────────────────────────────────
POST    /api/v1/opportunities/:id/buying-influences
        Body: {contact_id, role, influence_level, mode,
               euphoria_panic_level, personal_wins[],
               business_results[], is_coach}
        Resp 201 + RN-03 si euphoria>=7 (trigger DB)

PATCH   /api/v1/buying-influences/:biId
        Resp 200 + snapshot si cambió role/euphoria/is_coach

DELETE  /api/v1/buying-influences/:biId
        Resp 204

PUT     /api/v1/opportunities/:id/rating
        Body: {sufficient_budget, have_access,
               understand_buying_process,
               strong_economic_relationship, have_coach}
               (cada uno: 'Y'|'N'|'U')
        Resp 200: {opportunity_id, ...criterios, total_score}
        Nota: total_score lo devuelve la DB (GENERATED ALWAYS)

POST    /api/v1/opportunities/:id/flags
        Body: {type, description, severity?, linked_bi_id?,
               sort_order?}
        Resp 201

PATCH   /api/v1/opportunity-flags/:flagId
        Incluye sort_order para reordenamiento (RF-04.1)
        Resp 200

DELETE  /api/v1/opportunity-flags/:flagId
        Resp 204

POST    /api/v1/opportunities/:id/competitors
        Body: {name, is_incumbent, their_strengths,
               their_weaknesses, my_rating_price,
               my_rating_relationship, my_rating_technical,
               my_rating_timing, my_rating_service}
        Resp 201

PATCH   /api/v1/competitors/:compId
        Resp 200

POST    /api/v1/opportunities/:id/actions
        Body: {activity, owner_id, due_date,
               leverages_strength_id?, mitigates_red_flag_id?,
               perspective_to_share?, target_audience?}
        Resp 201 + notificación al owner si ≠ usuario actual

PATCH   /api/v1/bs-actions/:actionId
        Resp 200

GET     /api/v1/opportunities/:id/history
        Query: from?, to?, event_type?
        Resp 200: [{version, event_type, taken_at, author, payload}]

POST    /api/v1/opportunities/:id/comments
        Body: {section_anchor, body, mentions[], visibility}
        Resp 201 + notificación a mentions

GET     /api/v1/opportunities/:id/export
        Query: format=pdf|pptx
        Resp 202: {job_id} → poll GET /api/v1/export-jobs/:job_id

─────────────────────────────────────────────────────────
AGREGADOS Y DASHBOARDS
─────────────────────────────────────────────────────────
GET     /api/v1/me/actions/today           Mis acciones hoy (RF-06.3)
GET     /api/v1/dashboards/manager         Métricas del equipo (RF-07.2)
        Filtros: owner_id, stage, min_amount, date_range

─────────────────────────────────────────────────────────
CATÁLOGOS (RevOps / Admin)
─────────────────────────────────────────────────────────
GET/POST/PATCH  /api/v1/catalogs/competitors
GET/POST/PATCH  /api/v1/catalogs/red-flag-templates
GET/POST/PATCH  /api/v1/catalogs/action-templates

─────────────────────────────────────────────────────────
VÍNCULOS A PROCESOS FAMSPI (opcional, CU-16)
─────────────────────────────────────────────────────────
GET     /api/v1/opportunities/:id/links
        Resp 200: lista de vínculos activos con resumen del expediente

POST    /api/v1/opportunities/:id/links
        Body: {process_type: 'bc'|'private_purchase'|'public_purchase',
               process_id: "123",
               import_fields?: ['client','contacts','equipment','amount']}
        Flujo interno:
          1. Valida que process_id exista en la tabla correspondiente
          2. Si import_fields presente → lee el expediente y extrae datos
          3. Guarda vínculo en opportunity_process_link
          4. Devuelve imported_data para que el frontend ofrezca
             confirmación de qué aplicar a la BS
        Resp 201: {link, imported_data}

POST    /api/v1/opportunities/:id/links/:linkId/apply
        Body: {fields: ['account','contacts','amount','product']}
        Aplica los campos del imported_data a la oportunidad
        (sobrescribe solo los campos seleccionados por el usuario)
        Resp 200: opportunity actualizada

DELETE  /api/v1/opportunities/:id/links/:linkId
        Elimina el vínculo (no toca el expediente ni la BS)
        Resp 204

GET     /api/v1/process-lookup/:type/:id
        Devuelve resumen del expediente para previsualizarlo antes
        de vincular. type = bc|private_purchase|public_purchase
        Resp 200: {id, client_name, amount, date, status, contacts[]}

─────────────────────────────────────────────────────────
CRM
─────────────────────────────────────────────────────────
POST    /api/v1/integrations/crm/sync/:oppId   Sync manual
POST    /api/v1/webhooks/crm/:provider          Receptor webhook

Ejemplo — Crear oportunidad:

  POST /api/v1/opportunities
  Authorization: Bearer <jwt>
  Content-Type: application/json

  {
    "account_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "singular_sales_objective": "Implementar solución hematología XN-550 en 5 laboratorios de la Red Médica Pichincha para Q4-2026, generando $37.500/año durante 5 años",
    "specific_business_unit": "Diagnóstico In Vitro",
    "revenue_amount": 37500,
    "revenue_period_years": 5,
    "product_solution": "XN-550 Hematología + Reactivos",
    "expected_close_date": "2026-12-31"
  }

  Respuesta 201:
  {
    "id": "9d7c-...",
    "funnel_stage": "prospect",
    "status": "active",
    "rating": { "total_score": 0 },
    "created_at": "2026-06-04T..."
  }


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. SEGURIDAD Y CUMPLIMIENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

10.1 Autenticación
  [FAMSPI] Ya implementada en auth.routes.js:
  • Google OAuth2 con JWT (1h sesión, 30d refresh)
  • LOPDP aceptado antes del primer acceso
  • Auditoría de sesiones (audit_log)
  • No se necesita código adicional de auth para el Bluesheet.

10.2 RBAC del Bluesheet

  Rol FamSPI               Alcance lectura           Alcance escritura
  ──────────────────────────────────────────────────────────────────────────
  comercial /               Sus oportunidades          Sus oportunidades
  asesor_comercial          + compartidas
  acp_comercial             Sus oportunidades          Sus oportunidades
  backoffice_comercial      Sus oportunidades          Sus oportunidades
  analista_comercial
  jefe_comercial            Todo el equipo a cargo     Override RN-05, RN-14;
                                                       comentarios privados;
                                                       reasignar owner
  Dirección                 Toda la organización       Solo metadata
  admin / ti                Todo                       Catálogos, RBAC, CRM

  Implementar en: backend/src/modules/opportunities/opportunityPermissions.js
  Seguir patrón de: businessCasePermissions.js (módulo business-case)

10.3 Protección de datos
  • TLS 1.3 — ya configurado en el sistema
  • Encriptación en reposo — ya configurado
  • PII en contacts: email y phone no se muestran en logs ni exports
  • audit_log — ya registra IP, user-agent, correlation-id

10.4 Auditoría
  Todo CRUD de opportunities/buying_influences/flags/competitors/actions
  escribe en audit_log (módulo auditoria ya existente) además de
  crear un opportunity_snapshot (event store propio del BS).


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
11. WIREFRAMES TEXTUALES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pantalla 1 — Mis Oportunidades (lista)
  DashboardLayout.jsx existente como wrapper
  Main: tarjetas por oportunidad — cuenta, score semáforo, etapa,
        monto, próxima acción, última actualización
  CTA: 'Nueva BS' → wizard
  Filtros: etapa, score, cuenta, vendedor, fecha cierre

Pantalla 2 — Kanban del embudo
  Columnas: Prospect | Qualify | Pursue | Close
  Tarjeta: cuenta, monto, score (semáforo), banderas críticas count
  Drag-and-drop con @dnd-kit → POST /:id/stage al soltar

Pantalla 3 — Editor de Blue Sheet (workspace)
  Tabs: Objetivo | Influencias | Calificación | Competencia |
        Banderas | Plan | Histórico
  Panel derecho sticky: score en vivo, alertas RN, comentarios
  Autosave: debounce 2s, indicador "Guardado hace X"
  [FAMSPI] workspace/ carpeta existe pero sin componentes.
           sections/ subcarpeta existe pero vacía.

Pantalla 4 — Wizard de creación (5 pasos)
  Paso 1: Cuenta (autocomplete desde /api/v1/accounts?q=)
  Paso 2: Objetivo Singular (textarea 500 chars, helper Qué+Cuánto+Cuándo)
  Paso 3: Producto / Monto / Período
  Paso 4: Fecha estimada de cierre
  Paso 5: Primera Influencia Compradora
  Barra progreso superior; botón "Guardar borrador" siempre visible
  [FAMSPI] wizard/ carpeta existe pero sin componentes.

Pantalla 5 — Mapa de Influencias
  Matriz X=Rol (E/T/U/C), Y=Influencia (A/M/B)
  Burbujas por contacto; tamaño = relevancia; color = euforia-pánico
  Click abre panel: triunfos, resultados, evidencia, modo

Pantalla 6 — Mapa Competitivo
  Gráfico radial (chart.js Radar) 5 ejes:
  Precio | Relación | Técnico | Timing | Servicio
  Toggle de competidores (overlay por competidor)
  Tabla de evidencia bajo el gráfico

Pantalla 7 — Plan de Acción
  Lista priorizada; due date; responsable; estado in-line
  Filtros: vencidas | esta semana | este mes
  Vinculación visible a bandera/punto fuerte
  Reordenable con @dnd-kit

Pantalla 8 — Dashboard Gerente
  Tarjetas: # Opp por etapa, score promedio, BS sin Coach,
            sin EB, acciones vencidas
  Gráficos (chart.js): tendencia mensual de score,
            conversión por etapa, win-rate por banda score
  Drill-down a vendedor y a oportunidad


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12. GUÍA DE IMPLEMENTACIÓN FAMSPI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Esta sección es la guía operativa para el equipo de desarrollo.
Todo basado en el código real analizado. Sin asumir nada.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12.1 LO QUE YA EXISTE Y SE REUTILIZA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Sistema de autenticación y sesión (cero trabajo)
  ─ backend/src/modules/auth/ → OAuth2 + JWT completo
  ─ JWT verificado en cada request vía middleware existente

  Roles y jerarquía de aprobación (cero trabajo)
  ─ backend/src/modules/permisos/permisos.service.js
  ─ Roles: comercial, asesor_comercial, acp_comercial, jefe_comercial
  ─ ROLE_APPROVER y APPROVER_ROLE_ALIASES ya definidos

  Auditoría centralizada (cero trabajo)
  ─ Tabla audit_log con correlation-id, IP, user-agent
  ─ Solo registrar módulo='bluesheet' en cada acción

  Sistema de notificaciones (cero trabajo)
  ─ Tablas: notifications + notification_dispatch_queue
  ─ Canales: email, push, in-app ya implementados
  ─ Solo crear los tipos de evento nuevos del BS

  Integración Google (OAuth2 ya configurado)
  ─ gmail.routes.js con tokens OAuth2 encriptados en user_gmail_tokens
  ─ Extender para Calendar API (mismo scope, sin instalar nada nuevo)

  Patrón de outbox para CRM
  ─ Tabla integration_outbox (JSONB payload, target_system, status)
  ─ Reutilizar para sync bidireccional Salesforce/HubSpot

  Patrón de event store / versionado
  ─ bc_document_versions como referencia para opportunity_snapshot
  ─ Mismo patrón JSONB con version INT

  Charts (sin instalar nada)
  ─ chart.js@4.5.1 + react-chartjs-2@5.3.1 → radar, línea, barra
  ─ CompetitorRadar.jsx usa tipo 'radar' de chart.js directamente

  PDF export (sin instalar nada)
  ─ jspdf@3.0.3 + html2canvas@1.4.1 + pdf-lib@1.17.1 instalados
  ─ El componente de export renderiza el workspace y lo captura

  Formularios y validación (sin instalar nada)
  ─ react-hook-form@7.54.2 + zod@4.3.6 + @hookform/resolvers@5.2.2

  Animaciones y UX (sin instalar nada)
  ─ framer-motion@12.23.24 para transiciones de wizard
  ─ react-hot-toast@2.6.0 para toasts de autosave y errores

  Layout y estilos (sin instalar nada)
  ─ DashboardLayout.jsx como wrapper de todas las páginas BS
  ─ Tailwind CSS 3.4.13 + Bootstrap 5.3.8 ya configurados
  ─ Paleta DESIGN.md: Naval Slate + Action Blue + colores de status

  Tabla clients (lectura, no escritura)
  ─ Cuando una BS se vincula a un proceso que ya tiene cliente aprobado,
    el servicio de vínculo puede leer clients para importar datos.
  ─ accounts.client_id (FK nullable) enlaza la cuenta BS con el cliente
    aprobado si en algún momento se registra formalmente.

  Tablas de procesos existentes (lectura para importar datos)
  ─ bc_master              → leer al vincular (process_type='bc')
  ─ private_purchase_requests → leer al vincular (process_type='private_purchase')
  ─ equipment_purchase_requests → leer al vincular (process_type='public_purchase')
  ─ La BS nunca escribe en estas tablas. Solo lee para importar datos.
  ─ La vinculación es siempre iniciada por el usuario (CU-16), nunca automática.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12.2 LO QUE SE DEBE INSTALAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ÚNICA dependencia npm nueva requerida:

  npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
  (en spi_front/)

  Uso: Kanban de etapas (Pantalla 2) y listas reordenables de
  Puntos Fuertes/Banderas Rojas (RF-04.1).

  Opcional para v1.0 (PPTX export):
  npm install pptxgenjs
  (en spi_front/)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12.3 ESTRUCTURA DE ARCHIVOS A CREAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BACKEND — módulo opportunities
  backend/src/modules/opportunities/
  ├── opportunities.routes.js          ← definir todas las rutas de sección 9
  ├── opportunities.controller.js      ← handlers HTTP, parseo req/res
  ├── opportunities.service.js         ← lógica de negocio, CRUD, snapshots
  ├── opportunityStateTransition.js    ← RN-01..10, máquina de estados
  ├── opportunityPermissions.js        ← RBAC (seguir businessCasePermissions)
  ├── opportunityFlag.service.js       ← RN-06: BR critical → acción obligatoria
  ├── opportunityRating.service.js     ← helper de score (aunque DB lo calcula)
  ├── buyingInfluence.service.js       ← CRUD IC, validación RN-08
  ├── comment.service.js               ← CRUD comentarios + @menciones
  └── __tests__/
      ├── opportunityStateTransition.test.js  ← probar RN-01..15
      ├── opportunities.service.test.js
      └── buyingInfluence.service.test.js

BACKEND — módulos auxiliares nuevos
  backend/src/modules/accounts/
  ├── accounts.routes.js
  ├── accounts.controller.js
  └── accounts.service.js

  backend/src/modules/contacts/
  ├── contacts.routes.js
  ├── contacts.controller.js
  └── contacts.service.js

  backend/src/modules/catalogs/
  ├── catalogs.routes.js               ← competidores, BR templates, acciones
  ├── catalogs.controller.js
  └── catalogs.service.js

BACKEND — archivo a modificar
  backend/src/app.js
  → Agregar 4 bloques de rutas (accounts, contacts, opportunities, catalogs)
    siguiendo el mismo patrón de los 58 módulos existentes

FRONTEND — páginas (en spi_front/src/modules/comercial/pages/)
  OpportunitiesList.jsx    ← lista + Kanban del embudo
  OpportunityDetail.jsx    ← workspace con tabs (sección del editor)
  OpportunityWizard.jsx    ← 5 pasos guiados

FRONTEND — componentes (en spi_front/src/modules/comercial/components/)
  wizard/
    WizardStep1Account.jsx          ← autocomplete de accounts
    WizardStep2Objective.jsx        ← textarea 500 chars + helper
    WizardStep3Product.jsx          ← monto, período, producto
    WizardStep4CloseDate.jsx        ← date picker
    WizardStep5FirstIC.jsx          ← primera influencia compradora
    WizardProgressBar.jsx

  workspace/
    sections/
      ObjectiveSection.jsx          ← objetivo singular editable
      InfluencesSection.jsx         ← lista + botón agregar IC
      RatingSection.jsx             ← 5 tarjetas Y/N/U
      CompetitorSection.jsx         ← radar + tabla evidencia
      FlagsSection.jsx              ← PF y BR con drag-drop
      ActionPlanSection.jsx         ← plan con drag-drop
      HistorySection.jsx            ← timeline de snapshots
    WorkspaceTabs.jsx               ← navegación entre secciones
    WorkspacePanel.jsx              ← panel lateral (score, alertas, comments)
    AutosaveIndicator.jsx

  shared/
    BuyingInfluenceMatrix.jsx       ← matriz visual Rol × Influencia
    BuyingInfluenceForm.jsx         ← form agregar/editar IC
    EuforiaPanicoSlider.jsx         ← slider 1-10 con emoji
    RatingCards.jsx                 ← tarjetas Y/N/U con recalc vivo
    ScoreGauge.jsx                  ← semáforo 0-40/41-70/71-100
    CompetitorRadar.jsx             ← chart.js RadarChart
    FlagsList.jsx                   ← drag-drop @dnd-kit
    ActionPlanList.jsx              ← drag-drop @dnd-kit
    StageTransitionModal.jsx        ← confirmación de cambio de etapa
    CommentThread.jsx               ← comentarios con @menciones
    OpportunityKanban.jsx           ← columnas drag-drop
    OpportunityCard.jsx             ← tarjeta en lista y kanban
    ManagerDashboard.jsx            ← KPIs gerente

FRONTEND — hooks (en spi_front/src/modules/comercial/hooks/)
  useOpportunity.js             ← fetch single + mutaciones
  useOpportunities.js           ← lista + filtros + paginación cursor
  useOpportunityStaging.js      ← validar y ejecutar transición de etapa
  useBuyingInfluences.js        ← CRUD IC de una oportunidad
  useRating.js                  ← leer y actualizar 5 criterios
  useCompetitors.js             ← CRUD competidores
  useFlags.js                   ← CRUD + reordenar flags
  useActionPlan.js              ← CRUD + reordenar acciones
  useComments.js                ← CRUD comentarios + @menciones
  useOpportunityHistory.js      ← snapshots históricos

FRONTEND — API client (en spi_front/src/modules/comercial/api/)
  opportunitiesApi.js           ← todos los endpoints de sección 9
  accountsApi.js                ← GET/POST/PATCH /accounts
  contactsApi.js                ← GET/POST/PATCH /contacts
  catalogsApi.js                ← catálogos (competidores, templates)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12.4 ORDEN DE IMPLEMENTACIÓN (por dependencias)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE A — Cimientos (sin esto nada funciona)
  1. Ejecutar migraciones 189 → 197 en orden
  2. Verificar FK: users.id tipo INTEGER (confirmar antes de ejecutar 190)
  3. Verificar bc_master.id tipo INTEGER (confirmar antes de ejecutar 195)
  4. Instalar @dnd-kit en spi_front

FASE B — Backend core (en paralelo con front si hay equipo)
  5. accounts.service.js + accounts.routes.js + montar en app.js
  6. contacts.service.js + contacts.routes.js + montar en app.js
  7. opportunities.service.js (CRUD básico + createSnapshot RN-15)
  8. opportunityStateTransition.js (RN-01..10)
  9. opportunityPermissions.js (RBAC)
  10. buyingInfluence.service.js (RN-08 + RN-09)
  11. opportunityFlag.service.js (RN-06)
  12. opportunities.controller.js + opportunities.routes.js
  13. Montar /api/v1/opportunities en app.js
  14. Tests: RN-01..15 en __tests__/

FASE C — Frontend wizard y lista (primera iteración visible)
  15. accountsApi.js + contactsApi.js
  16. OpportunityWizard.jsx + 5 pasos (WizardStep1-5)
  17. OpportunitiesList.jsx (lista básica sin Kanban)
  18. OpportunityCard.jsx
  19. useOpportunities.js + useOpportunity.js

FASE D — Frontend workspace (valor principal del BS)
  20. WorkspaceTabs.jsx + WorkspacePanel.jsx
  21. ObjectiveSection.jsx (read + edit inline)
  22. RatingSection.jsx + RatingCards.jsx + ScoreGauge.jsx
  23. InfluencesSection.jsx + BuyingInfluenceForm.jsx +
      EuforiaPanicoSlider.jsx
  24. BuyingInfluenceMatrix.jsx (visualización Rol × Influencia)
  25. FlagsSection.jsx + FlagsList.jsx (drag-drop @dnd-kit)
  26. CompetitorSection.jsx + CompetitorRadar.jsx (chart.js)
  27. ActionPlanSection.jsx + ActionPlanList.jsx (drag-drop)
  28. HistorySection.jsx + timeline

FASE E — Kanban, dashboard, export
  29. OpportunityKanban.jsx (drag-drop entre columnas)
  30. ManagerDashboard.jsx + endpoint /api/v1/dashboards/manager
  31. Export PDF (jspdf + html2canvas, ya instalados)
  32. Notificaciones: tipos de evento BS en notification system

FASE F — Comentarios y colaboración
  33. comment.service.js + endpoint /comments
  34. CommentThread.jsx + @menciones
  35. Modo coaching (visibility='private')

FASE G — Vinculación opcional con procesos existentes (CU-16)
  36. processLink.service.js — lógica de vínculo + importación de datos
      Métodos:
        linkProcess(opp_id, process_type, process_id, import_fields)
        resolveProcess(type, id)    ← lee el expediente según el tipo
        applyImportedData(opp_id, link_id, fields)
        unlinkProcess(opp_id, link_id)
  37. Endpoints: POST/GET/DELETE /api/v1/opportunities/:id/links
      GET /api/v1/process-lookup/:type/:id
  38. Frontend: modal 'Vincular a expediente'
        Paso 1: selector tipo (BC | Compra Privada | Compra Pública)
        Paso 2: buscador del expediente (número, cliente, fecha)
        Paso 3: previsualización de datos disponibles para importar
        Paso 4: checkboxes de qué importar → confirmar
  39. En WorkspacePanel.jsx: sección "Expedientes vinculados" (lista de links)
      con botón "Desvincular" y botón "Re-importar datos"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12.5 PATRONES A SEGUIR DEL CÓDIGO EXISTENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Patrón                   Referencia en FamSPI
  ──────────────────────────────────────────────────────────────────
  Módulo backend completo  business-case/ (routes + controller + service)
  Permisos RBAC            businessCasePermissions.js
  Event store JSONB        bc_document_versions
  Máquina de estados       business_case_state_transitions
  Auditoría en servicio    auditMiddleware (registra en audit_log)
  Notificaciones           bc_notification_queue → notifications
  Outbox CRM               integration_outbox
  Hook React + React Query @tanstack/react-query (kickoffApi.js patrón)
  Formulario zod           react-hook-form + zod (todos los módulos)
  Chart.js en React        react-chartjs-2 (ya usado en finanzas)
  Layout wrapper           DashboardLayout.jsx (todos los módulos)

  Estructura de response estándar de FamSPI:
  { data: {}, message: "...", status: 200 }
  Mantener igual para consistencia.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12.6 GAPS REALES CONFIRMADOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ❌ FALTA — Tablas nuevas (migraciones 189-197)
     accounts, contacts, opportunity, buying_influence,
     opportunity_rating, opportunity_flag, competitor,
     bs_action_item, opportunity_snapshot, bs_comment,
     opportunity_process_link (polimórfica, opcional),
     competitor_catalog, red_flag_templates, action_templates

  ❌ FALTA — Módulo backend opportunities/ completo
     (7 services + controller + routes)

  ❌ FALTA — Módulos backend accounts/ y contacts/

  ❌ FALTA — Frontend: todos los componentes específicos del BS
     (wizard vacío, workspace vacío, secciones vacías)

  ❌ FALTA — Frontend: hooks useOpportunity*, useRating, etc.

  ❌ FALTA — Frontend: opportunitiesApi.js, accountsApi.js, etc.

  ❌ FALTA — npm install @dnd-kit (drag-drop)

  ✅ EXISTE — Auth, roles, auditoría, notificaciones, charts,
              PDF, formularios, layout, Tailwind, Bootstrap

  ✅ EXISTE — Patrón de flujo BC que se conecta después del BS

  ✅ EXISTE — integration_outbox para CRM (ampliar, no reescribir)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12.7 DECISIONES DE DISEÑO TOMADAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1. accounts ES NUEVA tabla, separada de clients
     Razón: clients tiene PII encriptada y solo guarda clientes
     aprobados. accounts es el directorio de prospectos del pipeline.
     Cuando se aprueba el cliente → accounts.client_id → clients.id

  2. owner_id ES INTEGER (no UUID)
     Razón: users.id en FamSPI es INTEGER (SERIAL). Confirmado en
     análisis de equipment_purchase_requests y bc_master que usan
     INTEGER FK a users.

  3. No hay tenant_id en MVP
     Razón: FamSPI es single-tenant. No existe tabla tenant. Se omite
     RLS por ahora. Se puede agregar en v1.5 sin romper el schema
     (ALTER TABLE ADD COLUMN tenant_id + RLS posterior).

  4. bs_action_item (no action_item)
     Razón: ya existe una tabla action_item en otro módulo con schema
     diferente (gestión de ausencias). Se usa el prefijo bs_ para evitar
     colisión.

  5. bs_comment (no comment)
     Razón: comment es palabra reservada en algunos contextos. Prefijo
     bs_ para claridad y consistencia con bs_action_item.

  6. opportunity_process_link es polimórfica (sin FK foránea por tipo)
     Razón: bc_master, private_purchase_requests y equipment_purchase_requests
     tienen tipos de id distintos y futuros procesos también podrán vincularse.
     Una tabla polimórfica con process_type ENUM + process_id TEXT es extensible
     con solo un ALTER TYPE ADD VALUE, sin crear nuevas tablas de enlace.
     La integridad referencial se valida en processLink.service.js antes del INSERT.
     El JSONB imported_data guarda snapshot del expediente al momento del vínculo,
     protegiendo la BS de cambios posteriores en el proceso original.

  7. La vinculación nunca es automática ni obligatoria
     Razón: el Bluesheet tiene ciclo de vida propio. Forzar un vínculo al Won
     rompería el uso independiente. El vendedor decide si vincula y cuándo.
     El sistema facilita la importación de datos pero nunca la impone.

  8. RN-03 en trigger de DB
     Razón: el trigger garantiza que siempre se cree la bandera roja
     cuando euphoria_panic >= 7, independientemente de qué capa del
     backend lo llame. No se puede olvidar ni saltar.

  7. total_score es GENERATED ALWAYS
     Razón: el score es una propiedad derivada de los 5 criterios.
     No puede existir un estado donde los criterios digan una cosa y
     el score diga otra. La DB es la única fuente de verdad.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
13. ROADMAP Y FASES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Fase     Duración  Alcance                              Entregables
─────────────────────────────────────────────────────────────────────────
MVP      8 semanas Fases A+B+C+D (sección 12.4)         Web responsive:
                   RF-01, RF-02, RF-03, RF-04,           CRUD completo,
                   RF-06 (sin Calendar), RF-07 (PDF)     score en vivo,
                                                         autosave, PDF básico
                   Integración flujo existente:
                   oportunidad Won → BC existente

v1.0     +4 semanas Fases E+F (12.4)                    Mapa competitivo,
                    RF-05, RF-07 (dashboard gerente),    dashboard gerente,
                    RF-08 (comentarios coaching),        Kanban completo,
                    Kanban                               export PDF/PPTX,
                                                         @menciones

v1.5     +4 semanas Fase G + RF-09 (CRM)                Sync Salesforce/HubSpot
                    Integración Calendar RF-06.1          Calendar Google,
                                                         link solo lectura

v2.0     +6 semanas RF-10 (IA), mobile offline           IA sugerencias,
                    Pipedrive/Dynamics/Zoho               móvil offline,
                                                         SOC 2 iniciado

Equipo recomendado para MVP:
  1 PM  |  1 Diseñador  |  2 Frontend  |  2 Backend  |  1 QA


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
14. KPIs Y MÉTRICAS DE ÉXITO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Categoría    KPI                             Meta 6 m  Meta 12 m  Fuente
──────────────────────────────────────────────────────────────────────────
Adopción     % Opp con BS activa (opp>$5K)  60%       80%        DB
Adopción     Tiempo de llenado inicial        ≤18 min   ≤12 min   Telemetría
Adopción     % BS actualizadas esta semana    55%       70%        DB
Calidad      % Pursue+ con Coach (RN-01)      85%       95%        DB
Calidad      % Opp con IC role=E (RN-02)      90%       98%        DB
Performance  P95 carga BS (TTI)               ≤2s       ≤1.5s     RUM
Performance  P95 búsqueda /opportunities?q=  ≤500ms    ≤300ms    APM
Negocio      Δ Win-rate score>70 vs <40       ≥15pp     ≥25pp     DB hist.
Negocio      Tiempo medio en etapa Pursue     -15%      -25%       DB
Satisfacción NPS interno equipo comercial     ≥30       ≥40        Encuesta
Confiabilidad Uptime mensual                  99.9%     99.95%    Status
Soporte      Tickets P1/mes                   ≤2        ≤1         Helpdesk


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
15. RIESGOS Y MITIGACIONES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ID    Riesgo                              Prob  Impacto  Mitigación
──────────────────────────────────────────────────────────────────────────
R-01  Baja adopción (siguen usando Excel) Alta  Crítico  Migrar BS históricas;
                                                         quitar Excel del proceso;
                                                         ownership del jefe_comercial

R-02  FK a users.id tipo incorrecto       Media Alto     Verificar ANTES de ejecutar
      (UUID vs INTEGER)                                  migración 190 con:
                                                         SELECT pg_typeof(id) FROM users LIMIT 1;

R-03  bc_master.id tipo incorrecto        Media Alto     Verificar ANTES de ejecutar
      para opportunity_bc_link                           migración 195.

R-04  Colisión de nombres de tablas       Baja  Medio    Prefijo bs_ en action_item y
      con módulos existentes                             comment (ya aplicado en DDL)

R-05  Sync CRM corrompe datos             Media Alto     Outbox pattern + dry-run +
                                                         rollback + canary

R-06  Datos sensibles de contactos en     Media Alto     PII no en logs; watermark en
      export PDF                                         exports; auditar descargas

R-07  Performance con muchas BS           Media Medio    Index en funnel_stage, owner_id,
                                                         account_id (incluidos en migración 192)

R-08  IA sugiere acciones equivocadas     Alta  Medio    Solo fase v2.0; sugerencias
      (fase v2.0)                                        auditables; humano aprueba; opt-out

R-09  Resistencia gerente a coachear      Media Medio    Dashboard muestra KPIs de coaching
      via app                                            en MBO del jefe_comercial

R-10  Migraciones 189-197 corren en       Alta  Alto     Ejecutar primero en staging;
      producción con datos existentes                    todas son CREATE TABLE/TYPE (no ALTER
                                                         de tablas con datos); rollback limpio


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
16. GLOSARIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Término                  Definición
──────────────────────────────────────────────────────────────────────────
Blue Sheet               Plantilla de planificación estratégica de
                         oportunidades complejas de Miller Heiman Group.

Influencia Compradora    Persona del lado del cliente que afecta la
(IC)                     decisión de compra.

Rol E (Económico)        Aprueba el presupuesto. Uno solo por decisión.
Rol T (Técnico)          Filtra técnicamente (puede vetar).
Rol U (Usuario)          Usa la solución; juzga por desempeño.
Rol C (Coach)            Aliado interno; da información y aboga por la
                         venta. Imprescindible para ganar.

Modo C (Crecimiento)     Cliente percibe brecha entre realidad y meta.
Modo P (Problema)        Cliente percibe problema activo; urgente.
Modo E (Equilibrio)      Cliente satisfecho; difícil moverlo.
Modo EC (Exc. Confianza) Cliente cree estar mejor de lo que está.

Euforia-Pánico           Escala 1-10 que mide cómo se siente la IC
                         respecto a la situación actual.

Triunfos Personales      Lo que la IC gana personalmente con la decisión.
Resultados de Negocio    Lo que la organización gana con la decisión.
Bandera Roja             Riesgo o incertidumbre que amenaza la venta.
Punto Fuerte             Diferenciador a favor; apalancar en estrategia.

Objetivo Singular        Qué + Cuánto + Cuándo. Meta concreta de la Opp.
Posición competitiva     Única/Dominante/Compartida/Cero.
Embudo de ventas         Prospect → Qualify → Pursue → Close → Won/Lost.
Score                    0-100. Suma de 5 criterios MHG (cada Y = 20).

accounts                 Nueva tabla FamSPI para directorio de empresas
                         prospecto del pipeline comercial (≠ clients).
contacts                 Nueva tabla FamSPI para contactos de accounts
                         usados como IC en oportunidades.
bs_action_item           Plan de acción del Bluesheet. Prefijo bs_ para
                         distinguirla del action_item de otros módulos.
bs_comment               Comentarios de coaching del Bluesheet.
opportunity_process_link Tabla polimórfica que registra vínculos OPCIONALES
                         entre una BS y cualquier proceso de FamSPI
                         (bc_master, private_purchase_requests,
                         equipment_purchase_requests). Nunca obligatoria.
GENERATED ALWAYS         Columna de PostgreSQL calculada automáticamente
                         (total_score en opportunity_rating).
Event sourcing           Patrón donde el estado se reconstruye a partir
                         de eventos inmutables (opportunity_snapshot).
RBAC                     Role-Based Access Control.
RLS                      Row Level Security (PostgreSQL) — omitido en MVP.
RUM                      Real User Monitoring; mide performance real.
P95                      Percentil 95: 95% de las muestras bajo ese valor.
Outbox pattern           Tabla integration_outbox para eventos de salida
                         al CRM; garantiza entrega exacta una vez.
jefe_comercial           Rol en FamSPI equivalente a "manager" en BS.
comercial /              Roles en FamSPI equivalentes a "rep" en BS.
asesor_comercial
