# Plan de Implementación — Módulo General de Entregas a Colaboradores

> **Fecha de elaboración:** 2026-06-16  
> **Base:** Auditoría real de BD de producción (Neon) + revisión de código existente  
> **Módulo interno:** `collab-deliveries`

---

## 1. Estado verificado en producción

### 1.1 Tablas de ti_assets existentes en producción

| Tabla | Registros |
|---|---|
| `ti_assets` | 4 |
| `ti_asset_assignments` | 4 |
| `ti_asset_events` | — |
| `ti_asset_maintenance_schedule` | — |
| `ti_maintenance_reports` | — |

### 1.2 Tablas de ti_assets en el código pero AUSENTES en producción (pendientes de migrar)

- `ti_asset_actas`
- `ti_asset_actas_items`
- `ti_asset_financial_docs`
- `ti_asset_accessories`
- `ti_asset_liberation_photos`
- `ti_corporate_numbers`
- `ti_corporate_number_history`
- Columnas `purchase_value` y `value_category` en `ti_assets`

> **Estas deben aplicarse en FASE 0 antes de cualquier desarrollo nuevo.**

### 1.3 Infraestructura existente reutilizable (confirmada en producción)

| Tabla | Uso en el nuevo módulo |
|---|---|
| `document_hashes` | Registro SHA-256 de actas generadas |
| `document_seals` | Sello institucional de actas |
| `document_qr_codes` | QR de verificación en actas |
| `document_signatures_advanced` | Firma electrónica avanzada |
| `document_verifications` | Verificación pública de documentos |
| `system_document_integrity` | Integridad de archivos en Drive |
| `collaborator_profiles` | Fuente de cédula, nombres, cargo para actas |
| `collaborator_documents` | Documentos por colaborador con SHA-256 |
| `offboarding_processes` | Proceso de salida (3 activos en producción) |
| `offboarding_tasks` | Checklist de salida (12 tareas activas) |
| `notifications` | Canal in-app de notificaciones |
| `notification_dispatch_queue` | Cola email/chat asíncrona con reintentos |
| `user_module_access` | Control de acceso por módulo y usuario |

> **Nota:** `notification_recipients_config` NO existe en producción aún.

---

## 2. Alcance del módulo

### 2.1 Categorías de entregables

| Categoría | Ejemplos concretos | ¿Tiene serie? | ¿Condición 1-10? | ¿Quién genera actas? |
|---|---|---|---|---|
| `ti` | Laptop, celular, número corporativo | Sí | Sí | TI (módulo existente, sin cambios) |
| `ropa` | Camiseta, chompa | No | No (atributos: talla, color) | Financiero / Jefe financiero |
| `herramienta` | Multímetro, flexómetro, maleta, desarmadores | Algunos sí | Sí | Financiero / Jefe financiero |
| `logistica` | Tarjeta de crédito empresarial | No (atributos: banco) | No | Financiero / Jefe financiero |

### 2.2 Reglas de negocio confirmadas

- **R1:** Los colaboradores son siempre `users` del sistema (tienen login).
- **R2:** La tarjeta de crédito se registra como entrega/retiro con acta, sin tracking financiero del límite.
- **R3:** La ropa es libre — se registra qué se entregó sin catálogo rígido de tallas.
- **R4:** El módulo es flexible: algunos ítems tienen serie y condición, otros no. El catálogo define esto por ítem.
- **R5:** Cada categoría tendrá su propio template de acta PDF. Los templates serán provistos posteriormente. La lógica de generación se construye desde el inicio; se activa al recibir los templates.
- **R6:** La fecha de renovación es abierta y seleccionable al momento de registrar el ítem. No hay regla fija por categoría.
- **R7:** TI gestiona únicamente Activos TI (módulo existente sin cambios). Financiero y jefe financiero gestionan todo lo demás y generan sus actas. Gerencia general tiene acceso de lectura a todo.
- **R8:** Al iniciar el proceso de offboarding, se generan automáticamente tareas en el checklist de salida para cada categoría con ítems activos. La tarea se marca completada cuando se genera el acta de retiro de todos los ítems de esa categoría.

### 2.3 RBAC definitivo

| Rol | Activos TI | Collab Deliveries | Ver actas |
|---|---|---|---|
| `ti`, `jefe_ti`, `admin_ti` | CRUD total | Sin acceso | Solo TI |
| `financiero`, `jefe_financiero` | Solo lectura | CRUD total + generar actas | Todas |
| `gerencia_general` | Solo lectura | Solo lectura | Todas |
| `gerencia` | Solo lectura | Solo lectura | Todas |

---

## 3. Modelo de datos

> **Archivo de migración:** `backend/migrations/203_collab_deliveries.sql`

### 3.1 `collab_item_catalog`

Catálogo de tipos de elementos entregables (solo categorías no-TI).

```sql
CREATE TABLE collab_item_catalog (
  id                 BIGSERIAL PRIMARY KEY,
  category           TEXT NOT NULL CHECK (category IN ('ropa','herramienta','logistica')),
  name               TEXT NOT NULL,
  description        TEXT,
  requires_serial    BOOLEAN NOT NULL DEFAULT false,
  requires_condition BOOLEAN NOT NULL DEFAULT false,
  attribute_schema   JSONB NOT NULL DEFAULT '{}',  -- esquema sugerido de atributos libres
  active             BOOLEAN NOT NULL DEFAULT true,
  created_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Ejemplos de `attribute_schema` por categoría:**
- `ropa` → `{"talla": "", "color": ""}`
- `herramienta` → `{"marca": "", "modelo": ""}`
- `logistica` → `{"banco": "", "numero_tarjeta_ultimos4": ""}`

### 3.2 `collab_deliveries`

Un registro por cada entrega activa o histórica de un ítem a un colaborador.

```sql
CREATE TABLE collab_deliveries (
  id                 BIGSERIAL PRIMARY KEY,
  catalog_item_id    BIGINT NOT NULL REFERENCES collab_item_catalog(id),
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status             TEXT NOT NULL DEFAULT 'entregado'
                       CHECK (status IN ('entregado','retirado','perdido','dañado')),
  serial_number      TEXT,
  physical_condition INTEGER CHECK (physical_condition BETWEEN 1 AND 10),
  attributes         JSONB NOT NULL DEFAULT '{}',    -- talla, color, banco, etc.
  observations       TEXT,
  delivery_date      DATE NOT NULL,
  withdrawal_date    DATE,
  renewal_date       DATE,     -- seleccionable al registrar, sin regla fija
  renewal_notes      TEXT,     -- criterio libre en texto
  delivered_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  withdrawn_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  active             BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_collab_deliveries_user    ON collab_deliveries(user_id, status);
CREATE INDEX idx_collab_deliveries_catalog ON collab_deliveries(catalog_item_id);
CREATE INDEX idx_collab_deliveries_renewal ON collab_deliveries(renewal_date)
  WHERE renewal_date IS NOT NULL AND status = 'entregado';
```

### 3.3 `collab_delivery_actas`

Actas de entrega y retiro para categorías no-TI. Misma estructura que `ti_asset_actas`, adaptada al módulo general.

```sql
CREATE TABLE collab_delivery_actas (
  id                       BIGSERIAL PRIMARY KEY,
  acta_code                TEXT UNIQUE NOT NULL,        -- ACTA-COL-2026-000001
  tipo                     TEXT NOT NULL CHECK (tipo IN ('entrega','retiro')),
  category                 TEXT NOT NULL CHECK (category IN ('ropa','herramienta','logistica')),
  delivery_id              BIGINT REFERENCES collab_deliveries(id) ON DELETE SET NULL,
  recipient_user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  -- Snapshot en el momento del acta (no cambia si el perfil se actualiza)
  recipient_nombre         TEXT NOT NULL,
  recipient_cedula         TEXT NOT NULL,
  recipient_cargo          TEXT NOT NULL,
  acta_day                 INTEGER NOT NULL,
  acta_month               INTEGER NOT NULL,
  acta_year                INTEGER NOT NULL,
  generated_by             INTEGER REFERENCES users(id) ON DELETE SET NULL,
  generated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes                    TEXT,
  -- Borrador PDF
  pdf_filename             TEXT,
  pdf_sha256               TEXT,
  pdf_drive_url            TEXT,
  pdf_drive_file_id        TEXT,
  -- PDF firmado
  signed_pdf_sha256        TEXT,
  signed_pdf_drive_url     TEXT,
  signed_pdf_drive_file_id TEXT,
  signed_pdf_filename      TEXT,
  signed_at                TIMESTAMPTZ,
  signed_by                INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_complete              BOOLEAN NOT NULL DEFAULT false,
  active                   BOOLEAN NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_collab_actas_delivery  ON collab_delivery_actas(delivery_id);
CREATE INDEX idx_collab_actas_user      ON collab_delivery_actas(recipient_user_id);
CREATE INDEX idx_collab_actas_generated ON collab_delivery_actas(generated_at DESC);
CREATE INDEX idx_collab_actas_code      ON collab_delivery_actas(acta_code);
```

### 3.4 `collab_delivery_events`

Auditoría de todos los cambios sobre una entrega.

```sql
CREATE TABLE collab_delivery_events (
  id          BIGSERIAL PRIMARY KEY,
  delivery_id BIGINT NOT NULL REFERENCES collab_deliveries(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,   -- 'created','withdrawn','condition_updated','renewal_set', etc.
  payload     JSONB NOT NULL DEFAULT '{}',
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_collab_events_delivery ON collab_delivery_events(delivery_id, created_at DESC);
```

### 3.5 `collab_renewal_schedule`

Seguimiento de renovaciones programadas.

```sql
CREATE TABLE collab_renewal_schedule (
  id             BIGSERIAL PRIMARY KEY,
  delivery_id    BIGINT NOT NULL REFERENCES collab_deliveries(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','notified','completed','cancelled')),
  notes          TEXT,
  notified_at    TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  completed_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_collab_renewal_pending ON collab_renewal_schedule(scheduled_date)
  WHERE status = 'pending';
```

### 3.6 Integración con `offboarding_tasks`

Al iniciar un proceso de offboarding se insertan las siguientes tareas (si el colaborador tiene ítems activos en esa categoría):

| `task_key` | `stage` | Condición de activación |
|---|---|---|
| `ti_assets_returned` | `equipos` | Tiene `ti_assets` con `status = 'assigned'` |
| `collab_ropa_returned` | `equipos` | Tiene entregas activas en categoría `ropa` |
| `collab_herramientas_returned` | `equipos` | Tiene entregas activas en categoría `herramienta` |
| `collab_logistica_returned` | `equipos` | Tiene entregas activas en categoría `logistica` |

Cada tarea se marca `is_completed = true` automáticamente cuando se genera el acta de retiro de todos los ítems de su categoría para ese colaborador.

---

## 4. Backend

### 4.1 Estructura de archivos nuevos

```
backend/src/modules/collab-deliveries/
  collabDeliveries.service.js      ← lógica de negocio y queries
  collabDeliveries.controller.js   ← manejo HTTP, validaciones de entrada
  collabDeliveries.routes.js       ← definición de rutas y RBAC
  collabDeliveries.acta.js         ← generación PDF con SHA-256 (se activa con templates)
  collabDeliveries.report.js       ← reportes PDF por colaborador y categoría

backend/migrations/
  203_collab_deliveries.sql        ← migración completa del módulo
```

### 4.2 Endpoints

#### Catálogo de ítems

```
GET    /collab-deliveries/catalog                    Lista el catálogo activo
POST   /collab-deliveries/catalog                    Crea ítem en catálogo        [financiero, jefe_financiero]
PATCH  /collab-deliveries/catalog/:id                Edita ítem del catálogo       [financiero, jefe_financiero]
DELETE /collab-deliveries/catalog/:id                Desactiva ítem del catálogo   [financiero, jefe_financiero]
```

#### Entregas

```
GET    /collab-deliveries                            Lista todas (filtros: user, category, status, renewal_due)
GET    /collab-deliveries/user/:userId               Todo lo entregado a un colaborador
GET    /collab-deliveries/:id                        Detalle con eventos e historial
POST   /collab-deliveries                            Registrar entrega             [financiero, jefe_financiero]
PATCH  /collab-deliveries/:id                        Editar observations/renewal   [financiero, jefe_financiero]
POST   /collab-deliveries/:id/withdraw               Registrar retiro              [financiero, jefe_financiero]
```

#### Actas

```
GET    /collab-deliveries/:id/actas                  Actas de una entrega
POST   /collab-deliveries/:id/actas                  Generar acta (entrega o retiro) [financiero, jefe_financiero]
GET    /collab-deliveries/actas/:actaId/pdf          Descargar PDF del acta
POST   /collab-deliveries/actas/:actaId/upload-signed Subir acta firmada            [financiero, jefe_financiero]
```

#### Renovaciones

```
GET    /collab-deliveries/renewals                   Próximas renovaciones (filtrable por días restantes)
PATCH  /collab-deliveries/renewals/:id               Completar o cancelar renovación [financiero, jefe_financiero]
```

#### Reportes

```
GET    /collab-deliveries/reports/collaborator/:userId  Reporte PDF por colaborador
GET    /collab-deliveries/reports/category/:category    Reporte PDF por categoría
```

### 4.3 Constantes RBAC

```javascript
const COLLAB_WRITE_ROLES = ["financiero", "jefe_financiero"];
const COLLAB_READ_ROLES  = [
  ...COLLAB_WRITE_ROLES,
  "gerencia_general",
  "gerencia",
  "ti", "jefe_ti", "admin_ti"
];
```

### 4.4 Registro en `registerRoutes.js`

```javascript
const collabDeliveriesRoutes = require("./modules/collab-deliveries/collabDeliveries.routes");
app.use("/api/v1/collab-deliveries", collabDeliveriesRoutes);
```

---

## 5. Generación de actas con SHA-256

### 5.1 Enfoque

- Mismo patrón que `tiAssets.acta.js` (PDF-lib + campos de formulario)
- Cada categoría (`ropa`, `herramienta`, `logistica`) tiene su propio template PDF
- Los templates son archivos `.pdf` con campos de formulario nombrados (mismo esquema que `ACTA-ET-2026-000001.pdf`)
- SHA-256 se calcula del buffer final antes de subir a Drive
- Se registra en `collab_delivery_actas.pdf_sha256`
- Opcionalmente se enlaza con `document_hashes` para usar la infraestructura de `document_seals` y `document_verifications`

### 5.2 Flujo de generación

```
1. POST /collab-deliveries/:id/actas
2. Leer datos del colaborador desde collaborator_profiles
3. Leer ítem desde collab_deliveries + collab_item_catalog
4. Llenar campos del template PDF según categoría
5. Computar SHA-256 del buffer
6. Subir a Google Drive (carpeta GDRIVE_FOLDER_ACTAS_COLLAB)
7. Insertar en collab_delivery_actas
8. Opcionalmente insertar en document_hashes + document_seals
9. Retornar acta_code, pdf_sha256, pdf_drive_url
```

### 5.3 Campos del template por categoría

Los campos exactos dependen del template que se reciba. La estructura base (igual para todas las categorías) es:

| Campo PDF | Fuente |
|---|---|
| `codigo` | Últimos 6 dígitos de `acta_code` |
| `nombre` | `collaborator_profiles.profile.personal.nombres + apellidos` |
| `cedula` | `collaborator_profiles.profile.personal.cedula` |
| `cargo` | `collaborator_profiles.profile.laboral.cargo` |
| `dia` / `mes` / `anio` | Fecha de generación |
| Tabla de ítems | `name`, `serial_number`, `attributes`, `physical_condition`, `observations` |

### 5.4 Activación por fases

| Estado | Comportamiento |
|---|---|
| Sin template | El registro del acta en BD se crea. La descarga de PDF retorna `503 Template no disponible`. |
| Con template | Generación completa: PDF → SHA-256 → Drive → registro. |

---

## 6. Frontend

### 6.1 Archivos nuevos

```
spi_front/src/
  core/api/
    collabDeliveriesApi.js
  modules/collab/
    pages/
      CollabDeliveriesFinancieroPage.jsx   ← financiero, jefe_financiero
      CollabDeliveriesGerenciaPage.jsx      ← gerencia_general (lectura)
```

### 6.2 Rutas en `AppRoutes.jsx`

```
/dashboard/collab/entregas   → CollabDeliveriesFinancieroPage  [financiero, jefe_financiero, gerencia_general, gerencia]
/dashboard/collab/resumen    → CollabDeliveriesGerenciaPage     [gerencia_general, gerencia]
```

### 6.3 Vista financiero / jefe_financiero

**KPIs:**
- Total ítems activos entregados
- Colaboradores con ítems activos
- Actas pendientes de firma
- Renovaciones próximas (próximos 30 días)
- Renovaciones vencidas

**Panel principal — Lista de colaboradores:**
- Filtros: categoría, estado, renovación próxima, búsqueda por nombre
- Por cada colaborador: nombre, cargo, cantidad de ítems activos por categoría, próxima renovación

**Panel detalle — por colaborador:**
- Listado de todos sus ítems con estado, acta entrega, acta retiro, fecha renovación
- Botón "Registrar entrega" → formulario (selecciona catálogo → llena atributos de la categoría)
- Botón "Registrar retiro" → genera acta de retiro
- Botón "Generar acta" → disponible cuando hay template
- Botón "Subir acta firmada"

**Panel de renovaciones:**
- Lista de próximas renovaciones con semáforo (verde/amarillo/rojo según días restantes)
- Botón para marcar renovación completada

### 6.4 Vista gerencia_general

- Dashboard ejecutivo: ítems entregados por categoría (cards con totales)
- % de actas firmadas vs pendientes
- Alertas de renovación vencida
- Sin formularios ni botones de acción

---

## 7. Renovaciones y notificaciones

### 7.1 Job de revisión diaria

Se agrega al scheduler existente (junto con el job de mantenimiento de ti_assets):

```javascript
// Busca collab_renewal_schedule donde:
// scheduled_date <= NOW() + 30 días AND status = 'pending'
// Agrupa por usuario y envía notificación in-app + email
// Actualiza status a 'notified' y registra notified_at
```

### 7.2 Plantillas de notificación nuevas

| Template key | Destinatarios | Trigger |
|---|---|---|
| `collab_renewal_due` | `financiero`, `jefe_financiero` | Renovación en los próximos 30 días |
| `collab_renewal_overdue` | `financiero`, `jefe_financiero` | Renovación vencida (scheduled_date < hoy) |
| `collab_acta_pending_signature` | `financiero`, `jefe_financiero` | Acta generada hace más de 7 días sin firmar |

**Ejemplo de mensaje `collab_renewal_due`:**
```
Renovación próxima: {item_name} de {colaborador_nombre} — vence el {fecha}
```

---

## 8. Integración con offboarding

### 8.1 Trigger al iniciar offboarding

Hook en el servicio de offboarding (`offboarding_processes` INSERT):

```javascript
// Para cada categoría activa del colaborador:
const activeCategories = await db.query(`
  SELECT DISTINCT ci.category
  FROM collab_deliveries cd
  JOIN collab_item_catalog ci ON ci.id = cd.catalog_item_id
  WHERE cd.user_id = $1 AND cd.status = 'entregado' AND cd.active = true
`, [userId]);

// Insertar tareas en offboarding_tasks
for (const { category } of activeCategories.rows) {
  await db.query(`
    INSERT INTO offboarding_tasks (user_id, stage, task_key, is_completed)
    VALUES ($1, 'equipos', $2, false)
    ON CONFLICT DO NOTHING
  `, [userId, `collab_${category}_returned`]);
}

// También para ti_assets si tiene activos asignados
const hasTiAssets = await db.query(`
  SELECT 1 FROM ti_assets WHERE assigned_to_user_id = $1 LIMIT 1
`, [userId]);
if (hasTiAssets.rowCount > 0) {
  await db.query(`
    INSERT INTO offboarding_tasks (user_id, stage, task_key, is_completed)
    VALUES ($1, 'equipos', 'ti_assets_returned', false)
    ON CONFLICT DO NOTHING
  `, [userId]);
}
```

### 8.2 Trigger al generar acta de retiro

En `collabDeliveries.service.js`, después de crear el acta de retiro:

```javascript
// Verificar si quedan ítems activos de esta categoría para el colaborador
const remaining = await db.query(`
  SELECT count(*) FROM collab_deliveries cd
  JOIN collab_item_catalog ci ON ci.id = cd.catalog_item_id
  WHERE cd.user_id = $1 AND ci.category = $2 AND cd.status = 'entregado' AND cd.active = true
`, [userId, category]);

// Si ya no quedan, marcar tarea de offboarding como completada
if (parseInt(remaining.rows[0].count) === 0) {
  await db.query(`
    UPDATE offboarding_tasks
    SET is_completed = true, completed_at = NOW(), completed_by = $3
    WHERE user_id = $1 AND task_key = $2 AND is_completed = false
  `, [userId, `collab_${category}_returned`, actorUserId]);
}
```

---

## 9. Orden de ejecución recomendado

```
FASE 0   Aplicar migraciones pendientes de ti_assets a producción          1 día
FASE 1   Migración 203_collab_deliveries.sql + seeds del catálogo base     2-3 días
FASE 2   Backend CRUD base (catálogo, entregas, retiros, sin actas)        3-4 días
FASE 4   Frontend base (registro, listado, historial) — funcional sin PDF  3-4 días
FASE 3   Sistema de actas + SHA-256 (se activa al recibir templates)       2-3 días
FASE 5   Job de renovaciones + plantillas de notificación                  2 días
FASE 6   Integración con offboarding (hooks en ambos sentidos)             1-2 días
```

**Total estimado: 14-20 días de desarrollo**

> Las fases 2 y 4 son independientes y pueden ejecutarse en paralelo si hay más de un desarrollador.  
> La FASE 3 no bloquea producción: el sistema queda funcional sin PDF hasta que lleguen los templates.

---

## 10. Variables de entorno nuevas

```bash
# Carpeta de Drive para actas del módulo general
GDRIVE_FOLDER_ACTAS_COLLAB=<folder_id>

# Templates de actas por categoría (se agregan cuando estén disponibles)
ACTA_TEMPLATE_ROPA_ENTREGA=./src/data/plantillas/ACTA-ROPA-ET-2026.pdf
ACTA_TEMPLATE_ROPA_RETIRO=./src/data/plantillas/ACTA-ROPA-D-2026.pdf
ACTA_TEMPLATE_HERRAMIENTA_ENTREGA=./src/data/plantillas/ACTA-HER-ET-2026.pdf
ACTA_TEMPLATE_HERRAMIENTA_RETIRO=./src/data/plantillas/ACTA-HER-D-2026.pdf
ACTA_TEMPLATE_LOGISTICA_ENTREGA=./src/data/plantillas/ACTA-LOG-ET-2026.pdf
ACTA_TEMPLATE_LOGISTICA_RETIRO=./src/data/plantillas/ACTA-LOG-D-2026.pdf

# Notificaciones del módulo
COLLAB_RENEWAL_ALERT_DAYS=30         # días de anticipación para alerta de renovación
COLLAB_ACTA_PENDING_ALERT_DAYS=7     # días sin firma para alertar del acta
```

---

## 11. Preguntas abiertas / decisiones futuras

| # | Pregunta | Impacto |
|---|---|---|
| P1 | ¿El acta de retiro de `ropa` es individual por prenda o agrupa todas las prendas de un colaborador en una sola acta? | Diseño de `collab_delivery_actas` (1:1 o 1:N con `collab_deliveries`) |
| P2 | ¿Los reportes PDF por categoría incluyen a todos los colaboradores o solo los activos? | Query de reportes |
| P3 | ¿Gerencia general puede ver el número de tarjeta (aunque sea parcial) o solo saber que tiene una? | RBAC en el endpoint de detalle |
| P4 | ¿El catálogo de ítems es editable en producción o solo por administradores técnicos? | Si lo edita financiero o solo admin_ti |
| P5 | ¿Los templates de acta vendrán como archivos físicos (igual que los de TI) o como Google Docs con campos? | Impacta en el generador de actas |

---

*Documento generado el 2026-06-16. Basado en auditoría directa de la base de datos de producción (Neon) y revisión del código fuente del módulo `ti-assets` existente.*
