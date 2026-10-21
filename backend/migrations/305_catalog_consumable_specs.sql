-- Migration 305: ficha tecnica versionada de consumibles (calibradores,
-- controles, materiales, electrolitos/ISE y, a futuro, reactivos).
--
-- Base del motor de calculo por reglas del Business Case: la cantidad de un
-- calibrador/control/material se deriva de presentacion + estabilidad (abierto
-- y a bordo) + duracion del proceso, no del historico ni de lo que se escribio
-- en el Sheet. Cada fila es UNA version de la ficha, respaldada por un
-- documento del fabricante (version y fecha) y con vigencia [valid_from,
-- valid_to). Si Roche cambia presentacion o estabilidad se inserta una fila
-- nueva y se cierra la anterior; el calculo usa la version vigente en cada
-- tramo del proceso.
--
-- supplier_code se guarda sin ceros a la izquierda, igual que
-- bc_consumption_items.item_id (ver normalizeCatalogCode). No hay FK a
-- catalog_consumables: el mismo codigo existe en varias filas del catalogo
-- (una por equipo) y la ficha describe al producto, no a la fila.

CREATE TABLE IF NOT EXISTS public.catalog_consumable_specs (
  id SERIAL PRIMARY KEY,
  supplier_code VARCHAR(32) NOT NULL,
  item_type VARCHAR(20) NOT NULL
    CHECK (item_type IN ('reactivo', 'calibrador', 'control', 'material')),
  product_name TEXT NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE,

  -- Presentacion
  containers_per_pack NUMERIC(10, 2),
  container_volume_ml NUMERIC(12, 3),
  levels_per_pack INTEGER,
  tests_per_pack INTEGER,

  -- Estabilidad (dias)
  stability_open_days NUMERIC(10, 3),
  stability_onboard_days NUMERIC(10, 3),
  single_use BOOLEAN NOT NULL DEFAULT FALSE,
  replacement_interval_days NUMERIC(10, 3),

  consumption_basis VARCHAR(30) NOT NULL
    CHECK (consumption_basis IN (
      'calibration_event',
      'qc_event',
      'per_test',
      'onboard_time',
      'maintenance',
      'replacement_interval',
      'unknown'
    )),
  compatible_systems TEXT[] NOT NULL DEFAULT '{}',
  -- Datos que cambian por analizador, p.ej. {"cobas c 303/503": {"onboard_days": 56,
  -- "calibration": {"events": ["reagent_lot_change"], "interval_days": 28},
  -- "qc": {"interval_hours": 24}}}. Base de los valores por defecto que el
  -- laboratorio ve (y puede ajustar) en Entorno Laboratorio.
  system_specs JSONB NOT NULL DEFAULT '{}'::jsonb,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Evidencia
  source_type VARCHAR(40) NOT NULL
    CHECK (source_type IN ('manufacturer_method_sheet', 'manufacturer_catalogue', 'internal', 'none')),
  source_title TEXT,
  source_url TEXT,
  source_document_id TEXT,
  source_document_version TEXT,
  source_document_date DATE,
  source_retrieved_at DATE,
  verification_status VARCHAR(20) NOT NULL
    -- verified: revisado por una persona contra el documento.
    -- extracted: extraido automaticamente del documento, pendiente de revision.
    CHECK (verification_status IN ('verified', 'extracted', 'partial', 'requires_review', 'pending')),
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,

  CONSTRAINT catalog_consumable_specs_valid_range
    CHECK (valid_to IS NULL OR valid_to > valid_from),
  CONSTRAINT catalog_consumable_specs_version_unique
    UNIQUE (supplier_code, valid_from)
);

-- Una sola version abierta por codigo.
CREATE UNIQUE INDEX IF NOT EXISTS catalog_consumable_specs_open_version_idx
  ON public.catalog_consumable_specs (supplier_code)
  WHERE valid_to IS NULL;

COMMENT ON TABLE public.catalog_consumable_specs IS
  'Ficha tecnica versionada por producto (presentacion, estabilidad, base de consumo) con evidencia del fabricante. Fuente del motor de calculo por reglas del Business Case.';
COMMENT ON COLUMN public.catalog_consumable_specs.stability_open_days IS
  'Estabilidad tras abrir/reconstituir a 2-8 C (condicion de uso normal). Otras condiciones (15-25 C, congelado, excepciones por analito) van en parameters.';
COMMENT ON COLUMN public.catalog_consumable_specs.stability_onboard_days IS
  'Estabilidad en uso a bordo cuando el documento da un unico valor. Si varia por analizador, ver system_specs.';
COMMENT ON COLUMN public.catalog_consumable_specs.consumption_basis IS
  'Que dispara el consumo: evento de calibracion, corrida de control, prueba, tiempo a bordo, mantenimiento o reemplazo periodico.';
