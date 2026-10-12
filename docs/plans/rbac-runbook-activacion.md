# Procedimiento: activar el motor central de RBAC en producción

Complementa `rbac-unified-access-implementation-plan.md` (fases 2, 4, 5, 7 y 8). Todo lo descrito aquí **existe y está probado solo en el ambiente local**; nada de esto se ha activado en producción.

## 1. Banderas

Todas son variables de entorno del servicio `spi-backend`. Apagadas por defecto: sin ellas el sistema se comporta como antes.

| Variable | Valor | Qué hace | Riesgo |
|---|---|---|---|
| `RBAC_MODULE_SHADOW` | `true` | Compara el registro ruta API → módulo con la decisión actual y lo registra | Ninguno sobre las respuestas: no se espera y descarta sus errores |
| `RBAC_CENTRAL_SHADOW` | `true` | Compara la decisión del motor central con el 403 real y lo registra | Una consulta a la base por decisión, con caché de 60 s |
| `RBAC_CENTRAL_PILOT` | `true` | `module_access.read/manage` se decide con el motor central | Si el motor falla, decide la regla de siempre |
| `RBAC_CENTRAL_ENFORCE` | `viaticos,attendance` | Las áreas listadas se deciden con el motor central | Si el motor falla, decide la regla de siempre |

Las áreas de `RBAC_CENTRAL_ENFORCE` son el primer segmento tras `/api/v1` (`/asistencia` cuenta como `attendance`).

## 2. Antes de tocar producción

1. Aplicar `backend/migrations/316_rbac_central_assignments.sql` y, antes, confirmar que 284 a 286 siguen aplicadas. Es aditiva: crea tablas nuevas y no modifica las existentes.
2. Sembrar el catálogo con `seed_rbac_catalog.js`. **La versión actual solo siembra la base local de staging**; sembrar producción requiere ampliarla con aprobación expresa y ensayar antes el rollback (borrar las filas generadas, que llevan el prefijo `[generado]` en `description`).
3. Ejecutar `verify_central_parity.js` contra la base sembrada y exigir 0 diferencias.
4. Desplegar el backend con las banderas apagadas y comprobar `/auth/me` y un recorrido de roles.

## 3. Ventana de observación (sombra)

1. Encender `RBAC_MODULE_SHADOW` y `RBAC_CENTRAL_SHADOW`.
2. Durante la ventana acordada, buscar en el log de Cloud Run las entradas `rbacShadow`:
   - `rbacShadow: "module"`: diferencias entre módulo declarado, encabezado `x-app-path` y decisión actual.
   - `rbacShadow: "central"`: diferencias del motor central. La que importa es `central_niega_legacy_permite` (el motor negaría algo que hoy se atiende). `central_permite_legacy_403` suele ser una negación por propiedad o estado, no por rol.
   - `rbacShadow: "central_resumen"`: cada 500 evaluaciones, totales por tipo.
3. Cada combinación distinta se escribe una sola vez; el resto solo se cuenta. No hay identificadores de usuario en las entradas.
4. Criterio para pasar: cero `central_niega_legacy_permite` sin explicación durante la ventana, y todo `sin_declarar` revisado.

## 4. Activar un área

Una área a la vez, en este orden de riesgo (la pertenencia concreta de cada módulo a una ola la decide la matriz de la Fase 0 y el responsable del área):

1. Lectura o bajo impacto.
2. CRUD sin aprobaciones ni cambios de estado sensibles.
3. Con propietario o asignación.
4. Flujos, aprobaciones, documentos, firmas o impacto financiero.
5. Auth, rutas públicas y componentes globales, en tareas separadas.

Por cada área:

1. El responsable del área aprueba los nombres de permiso de su área (`catalogo-central-informe.md`) y las variantes `-v2`.
2. Repetir paridad (`verify_central_parity.js`) y regresión del módulo.
3. Añadir el área a `RBAC_CENTRAL_ENFORCE`:
   ```
   gcloud run services update spi-backend --project=famspi-sbox --region=us-central1 \
     --update-env-vars=RBAC_CENTRAL_ENFORCE=<areas>
   ```
4. Humo posterior: iniciar sesión con un usuario de cada rol del área, abrir sus pantallas y ejecutar una acción permitida y una denegada.
5. Observar errores 401/403, latencia y divergencias antes de pasar al área siguiente.

## 5. Rollback (probado en pruebas automáticas; ensayar en staging antes de la primera activación)

Quitar la variable. No requiere construir ni desplegar código:

```
gcloud run services update spi-backend --project=famspi-sbox --region=us-central1 \
  --remove-env-vars=RBAC_CENTRAL_ENFORCE
```

El efecto es inmediato para las instancias nuevas; cada revisión de Cloud Run tarda lo de un reinicio. Para volver solo un área, dejar en la variable las demás.

Ensayo hecho en el ambiente local el 2026-10-08 (`rbac-rollback.spec.js`): con el backend reiniciado sin la variable, la asignación manual se guarda pero no abre el acceso, el rol de siempre sigue entrando y la navegación de los 17 roles queda idéntica a la línea base. Aún no se ha ensayado en Cloud Run.

La variable acepta `*` (todas las áreas) solo para ensayar en staging; en producción se listan las áreas una a una.

## 6. Acceso de emergencia, revocación y recuperación

- **Si el motor central deja a alguien sin acceso legítimo:** quitar `RBAC_CENTRAL_ENFORCE` (sección 5). Los usuarios vuelven a la regla de siempre.
- **Si falla el motor o la base de RBAC:** las áreas activadas caen a `requireRole` (fallo seguro) y el piloto de `module_access` a su regla de siempre. No se necesita acción.
- **Superroles:** `admin` y `administrador` pasan todas las guardas en ambos sistemas. Hoy ningún usuario real los tiene; el acceso de emergencia operativo es `jefe_ti`, que administra `module_access` y `rbac`.
- **Revocar un acceso concedido por error:** pestaña "Roles y permisos" (revoca asignaciones manuales y grants con motivo). Las asignaciones heredadas de `users.role` se corrigen cambiando el rol del usuario, no desde la pestaña.
- **Auditoría de la concesión:** cada alta o baja es una petición POST/DELETE registrada en `auditoria.logs`, y la tabla conserva quién concedió, qué, a quién, cuándo, por qué y hasta cuándo (`assigned_by`, `reason`, `created_at`, `expires_at`, `revoked_at`, `revoked_by`).

## 7. Qué no está resuelto

- Las asignaciones heredadas no se sincronizan solas cuando cambia `users.role` o `extra_roles`. Mientras el enforcement use los roles del token junto con las asignaciones manuales (como ahora), no afecta. Antes de retirar los roles heredados del token (Fase 9) hay que sincronizarlas en el momento del cambio de rol.
- El modo sombra de módulos usa `x-app-path`, que el navegador puede omitir o falsificar. El registro ruta API → módulo no lo sustituye hasta que se apruebe y se active.
- Los 5 usuarios con rol `pending` o `"null"` no se convierten; resolverlos es una decisión de TI usuario por usuario.

## 8. Modo multiempresa (RBAC_TENANT_MODE)

No cambia nada mientras este apagado. Orden para encenderlo, sin afectar a los usuarios actuales:

1. Aplicar `317_rbac_tenant_scope.sql` (aditiva; no cambia filas). Debe ir antes de desplegar el codigo que la usa.
2. Crear la empresa por defecto y hacer miembros a todos los usuarios con `seed_tenants.js` (hoy solo corre contra la base local; para produccion hay que ampliarlo con autorizacion expresa). El nombre sale de `RBAC_DEFAULT_TENANT_NAME`.
3. Verificar con una sola empresa: la regresion completa debe dar los mismos resultados que con el modo apagado.
4. Encender `RBAC_TENANT_MODE=true` (`gcloud run services update ... --update-env-vars`).
5. Rollback: quitar la variable. Las filas con empresa quedan guardadas pero dejan de usarse; los roles personalizados creados con el modo encendido dejan de verse.

Los roles personalizados creados antes de encender el modo (sin empresa) siguen visibles pero de solo lectura para las empresas: hay que duplicarlos.
