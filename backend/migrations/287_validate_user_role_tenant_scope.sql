-- Fase 2 / 287: evita asignar a una membresia un rol de otro tenant.
-- Los roles globales (tenant_id IS NULL) siguen siendo asignables a cualquier tenant.

CREATE OR REPLACE FUNCTION public.validate_user_role_tenant_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  membership_tenant_id BIGINT;
  role_tenant_id BIGINT;
BEGIN
  SELECT tenant_id
    INTO membership_tenant_id
    FROM public.tenant_memberships
   WHERE id = NEW.membership_id;

  SELECT tenant_id
    INTO role_tenant_id
    FROM public.roles
   WHERE id = NEW.role_id;

  IF membership_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_membership % no existe', NEW.membership_id
      USING ERRCODE = '23503';
  END IF;

  IF role_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF role_tenant_id <> membership_tenant_id THEN
    RAISE EXCEPTION
      'role % pertenece al tenant %, pero membership % pertenece al tenant %',
      NEW.role_id, role_tenant_id, NEW.membership_id, membership_tenant_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_user_role_tenant_scope
  ON public.user_roles;

CREATE TRIGGER trg_validate_user_role_tenant_scope
BEFORE INSERT OR UPDATE OF membership_id, role_id
ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.validate_user_role_tenant_scope();

COMMENT ON FUNCTION public.validate_user_role_tenant_scope() IS
  'Impide asignar roles tenant-specific a membresias de otro tenant; permite roles globales.';
