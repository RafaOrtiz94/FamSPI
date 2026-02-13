/**
 * Migration: 080_create_bc_consumption_items.sql
 * Goal: Persist Business Case consumption items (determinaciones/consumibles/reactivos/controles/etc.)
 * and excluded catalog keys in dedicated tables, instead of only JSON metadata.
 */

CREATE TABLE IF NOT EXISTS public.bc_consumption_items (
  id serial PRIMARY KEY,
  business_case_id uuid NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  item_id text,
  name text NOT NULL,
  item_type text NOT NULL,
  source text NOT NULL DEFAULT 'catalog',
  catalog_id integer,
  annual_qty integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_bc_consumption_items_key
  ON public.bc_consumption_items (business_case_id, item_key);

CREATE INDEX IF NOT EXISTS idx_bc_consumption_items_bc
  ON public.bc_consumption_items (business_case_id);

CREATE TABLE IF NOT EXISTS public.bc_consumption_excluded (
  id serial PRIMARY KEY,
  business_case_id uuid NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_bc_consumption_excluded_key
  ON public.bc_consumption_excluded (business_case_id, item_key);

CREATE INDEX IF NOT EXISTS idx_bc_consumption_excluded_bc
  ON public.bc_consumption_excluded (business_case_id);

