-- Agrega la URL de Drive del acta de inasistentes.
-- La columna absent_acta_drive_pdf_id ya existe y guarda el doc ID;
-- esta columna guarda el webViewLink para acceso directo desde el frontend.

ALTER TABLE trainings
  ADD COLUMN IF NOT EXISTS absent_acta_drive_url TEXT DEFAULT NULL;
