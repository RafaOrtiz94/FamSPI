-- Pone el módulo Kick Off 2026 en producción: acceso abierto a todos los usuarios.
INSERT INTO module_global_status (module_key, stage, whitelist_emails, updated_at)
VALUES ('kickoff_2026', 'production', '{}', NOW())
ON CONFLICT (module_key) DO UPDATE SET
  stage            = 'production',
  whitelist_emails = '{}',
  updated_at       = NOW();
