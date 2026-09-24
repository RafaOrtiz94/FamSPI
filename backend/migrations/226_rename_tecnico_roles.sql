-- Migra los roles legacy de la familia técnica a los nuevos nombres canónicos.
-- tecnico        → ing_servicio
-- jefe_tecnico   → jefe_servicio
--
-- Los valores legacy se mantienen como aliases en ROLE_GROUPS (roles.js),
-- por lo que cualquier usuario que no sea actualizado aquí seguirá funcionando.

UPDATE public.users
  SET role = 'ing_servicio', updated_at = NOW()
  WHERE role = 'tecnico';

UPDATE public.users
  SET role = 'jefe_servicio', updated_at = NOW()
  WHERE role = 'jefe_tecnico';

-- Verificación
SELECT role, COUNT(*) AS total
FROM public.users
WHERE role IN ('tecnico', 'ing_servicio', 'jefe_tecnico', 'jefe_servicio')
GROUP BY role
ORDER BY role;
