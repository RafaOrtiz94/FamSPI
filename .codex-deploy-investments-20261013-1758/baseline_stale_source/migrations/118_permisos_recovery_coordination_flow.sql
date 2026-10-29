BEGIN;

ALTER TABLE permisos_vacaciones
  ADD COLUMN IF NOT EXISTS recovery_coordination_status TEXT NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS recovery_coordination_round INTEGER NOT NULL DEFAULT 0;

ALTER TABLE permisos_vacaciones
  DROP CONSTRAINT IF EXISTS permisos_vacaciones_recovery_coordination_status_check;

ALTER TABLE permisos_vacaciones
  ADD CONSTRAINT permisos_vacaciones_recovery_coordination_status_check
  CHECK (
    recovery_coordination_status IN (
      'not_required',
      'pending_approver_proposal',
      'pending_requester_acceptance',
      'agreed',
      'finalized_by_approver'
    )
  );

UPDATE permisos_vacaciones
   SET recovery_coordination_status = CASE
      WHEN COALESCE(es_recuperable, false) AND LOWER(COALESCE(status, '')) IN ('approved','aprobado')
        THEN 'pending_approver_proposal'
      WHEN COALESCE(es_recuperable, false)
        THEN 'pending_approver_proposal'
      ELSE 'not_required'
   END
 WHERE recovery_coordination_status IS NULL
    OR length(trim(recovery_coordination_status)) = 0
    OR recovery_coordination_status NOT IN (
      'not_required',
      'pending_approver_proposal',
      'pending_requester_acceptance',
      'agreed',
      'finalized_by_approver'
    );

COMMIT;
