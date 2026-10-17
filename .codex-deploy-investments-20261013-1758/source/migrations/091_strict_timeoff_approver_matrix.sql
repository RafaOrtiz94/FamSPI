-- Migration: 091_strict_timeoff_approver_matrix.sql
-- Description: Normaliza aprobadores de permisos/vacaciones segun matriz estricta por area.
-- Date: 2026-02-13

WITH boss_by_role AS (
  SELECT DISTINCT ON (LOWER(u.role))
         LOWER(u.role) AS role_key,
         u.id,
         u.email
    FROM users u
   WHERE u.active = true
     AND LOWER(u.role) IN (
       'jefe_comercial',
       'jefe_financiero',
       'jefe_finanzas',
       'jefe_tecnico',
       'jefe_logistica',
       'jefe_operaciones',
       'jefe_calidad',
       'gerencia_general',
       'gerente_general'
     )
   ORDER BY LOWER(u.role), u.id
),
expected_permisos AS (
  SELECT pv.id,
         CASE
           WHEN LOWER(COALESCE(u.role, '')) LIKE 'jefe\_%' ESCAPE '\' THEN 'gerencia_general'
           WHEN LOWER(COALESCE(u.role, '')) IN ('comercial', 'acp_comercial', 'marketing', 'backoffice_comercial') THEN 'jefe_comercial'
           WHEN LOWER(COALESCE(u.role, '')) IN ('financiero', 'finanzas') THEN 'jefe_financiero'
           WHEN LOWER(COALESCE(u.role, '')) IN ('tecnico', 'tecnico_servicio') THEN 'jefe_tecnico'
           WHEN LOWER(COALESCE(u.role, '')) IN ('logistica') THEN 'jefe_logistica'
           WHEN LOWER(COALESCE(u.role, '')) IN ('operaciones') THEN 'jefe_operaciones'
           WHEN LOWER(COALESCE(u.role, '')) IN ('calidad') THEN 'jefe_calidad'
           ELSE NULL
         END AS expected_role
    FROM permisos_vacaciones pv
    LEFT JOIN users u
      ON (
        (pv.user_id IS NOT NULL AND pv.user_id = u.id)
        OR (pv.user_id IS NULL AND LOWER(pv.user_email) = LOWER(u.email))
      )
   WHERE pv.status IN ('pending', 'partially_approved', 'pending_final')
),
resolved_permisos AS (
  SELECT ep.id,
         ep.expected_role,
         COALESCE(
           CASE
             WHEN ep.expected_role = 'gerencia_general' THEN (
               SELECT b.id FROM boss_by_role b
                WHERE b.role_key IN ('gerencia_general', 'gerente_general')
                ORDER BY b.id
                LIMIT 1
             )
             ELSE (
               SELECT b.id FROM boss_by_role b
                WHERE b.role_key = ep.expected_role
                ORDER BY b.id
                LIMIT 1
             )
           END,
           NULL
         ) AS expected_user_id,
         COALESCE(
           CASE
             WHEN ep.expected_role = 'gerencia_general' THEN (
               SELECT b.email FROM boss_by_role b
                WHERE b.role_key IN ('gerencia_general', 'gerente_general')
                ORDER BY b.id
                LIMIT 1
             )
             ELSE (
               SELECT b.email FROM boss_by_role b
                WHERE b.role_key = ep.expected_role
                ORDER BY b.id
                LIMIT 1
             )
           END,
           NULL
         ) AS expected_email
    FROM expected_permisos ep
   WHERE ep.expected_role IS NOT NULL
),
updated_permisos AS (
  UPDATE permisos_vacaciones pv
     SET approver_role = rp.expected_role,
         approver_user_id = rp.expected_user_id,
         approver_email = COALESCE(rp.expected_email, pv.approver_email),
         updated_at = NOW()
    FROM resolved_permisos rp
   WHERE pv.id = rp.id
     AND (
       COALESCE(LOWER(pv.approver_role), '') <> rp.expected_role
       OR COALESCE(pv.approver_user_id, -1) <> COALESCE(rp.expected_user_id, -1)
     )
  RETURNING pv.id
)
SELECT COUNT(*) AS permisos_updated FROM updated_permisos;

WITH boss_by_role AS (
  SELECT DISTINCT ON (LOWER(u.role))
         LOWER(u.role) AS role_key,
         u.id
    FROM users u
   WHERE u.active = true
     AND LOWER(u.role) IN (
       'jefe_comercial',
       'jefe_financiero',
       'jefe_finanzas',
       'jefe_tecnico',
       'jefe_logistica',
       'jefe_operaciones',
       'jefe_calidad',
       'gerencia_general',
       'gerente_general'
     )
   ORDER BY LOWER(u.role), u.id
),
expected_vacaciones AS (
  SELECT v.id,
         CASE
           WHEN LOWER(COALESCE(u.role, '')) LIKE 'jefe\_%' ESCAPE '\' THEN 'gerencia_general'
           WHEN LOWER(COALESCE(u.role, '')) IN ('comercial', 'acp_comercial', 'marketing', 'backoffice_comercial') THEN 'jefe_comercial'
           WHEN LOWER(COALESCE(u.role, '')) IN ('financiero', 'finanzas') THEN 'jefe_financiero'
           WHEN LOWER(COALESCE(u.role, '')) IN ('tecnico', 'tecnico_servicio') THEN 'jefe_tecnico'
           WHEN LOWER(COALESCE(u.role, '')) IN ('logistica') THEN 'jefe_logistica'
           WHEN LOWER(COALESCE(u.role, '')) IN ('operaciones') THEN 'jefe_operaciones'
           WHEN LOWER(COALESCE(u.role, '')) IN ('calidad') THEN 'jefe_calidad'
           ELSE NULL
         END AS expected_role
    FROM vacaciones_solicitudes v
    JOIN users u ON u.id = v.requester_id
   WHERE LOWER(COALESCE(v.status, '')) = 'pendiente'
),
resolved_vacaciones AS (
  SELECT ev.id,
         ev.expected_role,
         CASE
           WHEN ev.expected_role = 'gerencia_general' THEN (
             SELECT b.id FROM boss_by_role b
              WHERE b.role_key IN ('gerencia_general', 'gerente_general')
              ORDER BY b.id
              LIMIT 1
           )
           ELSE (
             SELECT b.id FROM boss_by_role b
              WHERE b.role_key = ev.expected_role
              ORDER BY b.id
              LIMIT 1
           )
         END AS expected_user_id
    FROM expected_vacaciones ev
   WHERE ev.expected_role IS NOT NULL
),
updated_vacaciones AS (
  UPDATE vacaciones_solicitudes v
     SET approver_role = rv.expected_role,
         approver_id = rv.expected_user_id,
         updated_at = NOW()
    FROM resolved_vacaciones rv
   WHERE v.id = rv.id
     AND (
       COALESCE(LOWER(v.approver_role), '') <> rv.expected_role
       OR COALESCE(v.approver_id, -1) <> COALESCE(rv.expected_user_id, -1)
     )
  RETURNING v.id
)
SELECT COUNT(*) AS vacaciones_updated FROM updated_vacaciones;

