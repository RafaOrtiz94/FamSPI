-- Migration 218: Eliminar solicitudes de prueba / test data
-- Solicitudes a eliminar:
--   SP-2025-00001 "asdasd"
--   SP-2026-00002 "Analista de Sistemas"
--   SP-2026-00003 "asdf"
--   SP-2026-00004 "asdfasd"
--   SP-2026-00005 "sdfasdf"
--
-- Las tablas hijas (profiles, documents, comments, history) tienen
-- ON DELETE CASCADE, por lo que se eliminan automáticamente.

BEGIN;

DELETE FROM personnel_requests
WHERE request_number IN (
  'SP-2025-00001',
  'SP-2026-00002',
  'SP-2026-00003',
  'SP-2026-00004',
  'SP-2026-00005'
);

COMMIT;
