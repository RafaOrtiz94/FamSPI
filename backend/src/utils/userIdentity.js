/**
 * backend/src/utils/userIdentity.js
 * ---------------------------------
 * Deduplicacion de identidad de usuario por cedula / nombre completo.
 * Usado en cualquier punto que crea o vincula una fila en `users` a partir
 * de datos de un aspirante/colaborador, para evitar cuentas duplicadas
 * cuando la misma persona ya tiene una cuenta (por ejemplo, pre-provisionada
 * por TI o creada en un login previo).
 */

/**
 * Normaliza un nombre completo a una clave comparable por conjunto de
 * palabras (mayusculas, sin espacios extra, orden alfabetico). Esto hace
 * que "Nombres Apellidos" y "Apellidos Nombres" generen la misma clave.
 */
const normalizeNameKey = (fullname) => {
  return String(fullname || '')
    .toUpperCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
};

/**
 * Busca un usuario existente que corresponda a la misma persona, por cedula
 * (collaborator_profiles.profile->personal->cedula) o por nombre completo
 * normalizado. Devuelve la fila { id, email, fullname } o null.
 */
const findExistingUserByIdentity = async (client, { cedula, fullname } = {}) => {
  const cedulaValue = String(cedula || '').trim();
  const fullnameKey = normalizeNameKey(fullname);

  if (!cedulaValue && !fullnameKey) return null;

  const result = await client.query(
    `
    SELECT u.id, u.email, u.fullname
      FROM users u
      LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id
     WHERE ($1 <> '' AND cp.profile->'personal'->>'cedula' = $1)
        OR ($2 <> '' AND (
             SELECT array_to_string(
                      array(SELECT unnest(string_to_array(upper(trim(u.fullname)), ' '))
                            ORDER BY 1),
                      ' '
                    )
           ) = $2)
     ORDER BY (cp.profile->'personal'->>'cedula' = $1) DESC
     LIMIT 1
    `,
    [cedulaValue, fullnameKey]
  );

  return result.rows[0] || null;
};

module.exports = {
  normalizeNameKey,
  findExistingUserByIdentity,
};
