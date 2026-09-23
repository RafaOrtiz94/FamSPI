CREATE TABLE IF NOT EXISTS public.equipment_asset_documents (
  id bigserial PRIMARY KEY,
  asset_id bigint NOT NULL REFERENCES public.equipment_assets(id) ON DELETE CASCADE,
  doc_type text NOT NULL DEFAULT 'otro',
  title text,
  filename text NOT NULL,
  mime_type text,
  size_bytes bigint,
  drive_file_id text NOT NULL,
  drive_link text,
  notes text,
  uploaded_by bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipment_asset_documents_asset_id
  ON public.equipment_asset_documents(asset_id);

CREATE INDEX IF NOT EXISTS idx_equipment_asset_documents_doc_type
  ON public.equipment_asset_documents(doc_type);
