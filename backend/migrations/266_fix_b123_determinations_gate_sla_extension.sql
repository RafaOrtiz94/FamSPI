-- 266_fix_b123_determinations_gate_sla_extension.sql
-- Correccion puntual: el BC 5e1b0650-f81f-4021-a82c-46e2abec0b08 (equipo
-- b123, "cobas b 123 POC system") tuvo su prorroga de SLA aprobada por
-- jefe_comercial (modern_bc_metadata.preflow_reopen_request.status =
-- 'approved', con new_deadline_at calculado correctamente), pero el
-- deadline extendido nunca llego a persistirse en determinations_gate ni en
-- preflow_review_deadline_at/preflow_deadline_at -- una condicion de carrera
-- (ver updateBusinessCase en businessCase.service.js, ya corregida en este
-- mismo cambio: reemplazo ciego de modern_bc_metadata en vez de merge) hizo
-- que un request concurrente de jefe_servicio pisara la aprobacion con una
-- copia vieja del metadata. Resultado: la UI seguia mostrando "SLA vencido"
-- pese a la prorroga ya aprobada, bloqueando el cierre de Determinaciones.
--
-- Esta migracion toma el new_deadline_at YA APROBADO (guardado en
-- preflow_reopen_request) como fuente de verdad y lo vuelve a aplicar a
-- determinations_gate.deadline_at / review_deadline_at / is_expired y a los
-- campos top-level preflow_review_deadline_at / preflow_deadline_at. Solo
-- afecta esta fila puntual y solo si la solicitud sigue en estado
-- 'approved' con new_deadline_at presente (no-op en cualquier otro caso).

UPDATE public.equipment_purchase_requests AS epr
SET modern_bc_metadata = COALESCE(epr.modern_bc_metadata, '{}'::jsonb) || jsonb_build_object(
      'determinations_gate', COALESCE(epr.modern_bc_metadata->'determinations_gate', '{}'::jsonb) || jsonb_build_object(
        'deadline_at', epr.modern_bc_metadata->'preflow_reopen_request'->>'new_deadline_at',
        'review_deadline_at', epr.modern_bc_metadata->'preflow_reopen_request'->>'new_deadline_at',
        'is_expired', false,
        'expired_at', NULL,
        'expired_notified_at', NULL,
        'updated_at', to_jsonb(now())
      ),
      'preflow_review_deadline_at', epr.modern_bc_metadata->'preflow_reopen_request'->>'new_deadline_at',
      'preflow_deadline_at', epr.modern_bc_metadata->'preflow_reopen_request'->>'new_deadline_at'
    ),
    updated_at = now()
WHERE epr.id = '5e1b0650-f81f-4021-a82c-46e2abec0b08'
  AND epr.modern_bc_metadata->'preflow_reopen_request'->>'status' = 'approved'
  AND epr.modern_bc_metadata->'preflow_reopen_request'->>'new_deadline_at' IS NOT NULL;
