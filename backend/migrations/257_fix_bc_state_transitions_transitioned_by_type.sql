BEGIN;

-- business_case_state_transitions.transitioned_by fue creado como UUID, pero
-- BusinessCaseStateMachine.transition() siempre pasa users.id (INTEGER real
-- en public.users). Como el INSERT del log de auditoria vive en la MISMA
-- transaccion que el UPDATE de canonical_state, cada transicion fallaba con
-- "invalid input syntax for type uuid" y hacia ROLLBACK de todo -- por eso
-- canonical_state nunca avanzaba de DRAFT_INICIAL para ningun Business Case,
-- bloqueando determinaciones/inversiones/carrito para todos los roles
-- (businessCasePermissions.canEdit exige canonicalState truthy y matrix por
-- estado). Tabla confirmada vacia (0 filas, nunca hubo un INSERT exitoso).
ALTER TABLE business_case_state_transitions
  ALTER COLUMN transitioned_by TYPE INTEGER USING NULL;

COMMIT;
