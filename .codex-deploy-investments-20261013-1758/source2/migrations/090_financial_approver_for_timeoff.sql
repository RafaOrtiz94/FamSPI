-- Migration: 090_financial_approver_for_timeoff.sql
-- Description: Asegura que solicitudes de permisos/vacaciones del rol financiero
--              se asignen a jefe_financiero (incluye backfill de pendientes).
-- Date: 2026-02-13

DO $$
DECLARE
  v_finance_boss_id INTEGER;
  v_finance_boss_email TEXT;
BEGIN
  SELECT id, email
    INTO v_finance_boss_id, v_finance_boss_email
  FROM users
  WHERE active = true
    AND LOWER(role) IN ('jefe_financiero', 'jefe_finanzas')
  ORDER BY id
  LIMIT 1;

  -- Backfill permisos_vacaciones pendientes de usuarios financieros
  IF v_finance_boss_id IS NOT NULL THEN
    UPDATE permisos_vacaciones pv
       SET approver_role = 'jefe_financiero',
           approver_user_id = v_finance_boss_id,
           approver_email = COALESCE(v_finance_boss_email, approver_email),
           updated_at = NOW()
      FROM users u
     WHERE (
             (pv.user_id IS NOT NULL AND pv.user_id = u.id)
             OR (pv.user_id IS NULL AND LOWER(pv.user_email) = LOWER(u.email))
           )
       AND LOWER(COALESCE(u.role, '')) IN ('financiero', 'finanzas')
       AND pv.status IN ('pending', 'partially_approved', 'pending_final')
       AND (
            pv.approver_user_id IS NULL
            OR LOWER(COALESCE(pv.approver_role, '')) IN ('', 'gerencia', 'gerencia_general')
           );

    -- Backfill vacaciones_solicitudes pendientes de usuarios financieros
    UPDATE vacaciones_solicitudes v
       SET approver_role = 'jefe_financiero',
           approver_id = v_finance_boss_id,
           updated_at = NOW()
      FROM users u
     WHERE v.requester_id = u.id
       AND LOWER(COALESCE(u.role, '')) IN ('financiero', 'finanzas')
       AND LOWER(COALESCE(v.status, '')) = 'pendiente'
       AND (
            v.approver_id IS NULL
            OR LOWER(COALESCE(v.approver_role, '')) IN ('', 'gerencia', 'gerencia_general')
           );
  END IF;
END $$;

