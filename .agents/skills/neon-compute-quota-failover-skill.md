# skill: neon-compute-quota-failover

## Proposito

Restaurar el acceso a produccion de FamSPI cuando Neon suspende el compute
activo por haber excedido la cuota mensual de CU-hrs del plan (mensaje tipico:
`Your account or project has exceeded the compute time quota. Upgrade your
plan to increase limits.`). Cuando esto pasa, **nadie puede iniciar sesion**
porque el backend no puede conectar a la base.

Ya paso una vez (2026-07-21: `wispy-moon` -> `muddy-sun`) y volvio a pasar
(2026-08-11: `muddy-sun` -> `wispy-moon`, a la inversa). Es razonable esperar
que vuelva a repetirse, en cualquier direccion.

---

## Diagnostico rapido

1. Confirmar el sintoma real antes de asumir que es esto: intentar una query
   simple contra el host actual (ver `production-neon-query-skill.md`).
2. Si el error es literalmente sobre cuota de compute (no timeout, no auth,
   no "database does not exist"), es este escenario.
3. Verificar el host actual en Cloud Run:
   ```bash
   gcloud run services describe spi-backend --project=famspi-sbox --region=us-central1 \
     --format="yaml(spec.template.spec.containers[0].env)" | grep -A1 "DB_HOST\|DB_NAME"
   ```

---

## Regla de oro: NUNCA cambiar de host sin verificar que el destino tiene los datos correctos

El error mas caro posible aca no es la caida — es cambiar a un destino con
datos **vacios o desactualizados** sin darse cuenta, porque a diferencia de
una caida (obvia para todos), un destino con datos viejos "funciona" pero
muestra informacion incorrecta silenciosamente.

Antes de tocar Cloud Run, para el host candidato:

1. **Verificar que la base tiene el schema esperado.** Un mismo servidor Neon
   puede tener varias bases (`neondb`, `FamSPI`, etc.) — la que aparece en el
   connection string que te pasen no siempre es la correcta. Listar bases:
   ```sql
   SELECT datname FROM pg_database WHERE datistemplate = false;
   ```
   Y por cada una, contar tablas en `public` y otros schemas:
   ```sql
   SELECT table_schema, COUNT(*)::int AS n FROM information_schema.tables GROUP BY table_schema;
   ```
   (2026-08-11: el connection string traia `/neondb`, que estaba
   completamente vacia — 0 tablas. Los datos reales estaban en la base
   `FamSPI` del mismo servidor.)

2. **Verificar que los datos son recientes, no una foto vieja.** Consultar el
   `MAX(updated_at)` de una tabla con actividad diaria (ej.
   `equipment_purchase_requests`, `visit_schedules`) y comparar contra la
   fecha real de hoy. Si el maximo es de semanas atras, es una snapshot
   congelada de antes de la ultima migracion — sirve para restaurar acceso
   de emergencia, pero **hay que avisarle al usuario del hueco de datos
   exacto** antes de proceder, no asumir que esta bien.

3. Si el destino esta vacio o desactualizado y no hay alternativa mejor
   disponible, seguir con la seccion "Restaurar desde backup" antes de
   apuntar produccion ahi.

**Stop condition:** si no se puede verificar el punto 1 y 2 (por ejemplo,
porque el host origen tambien esta caido y no hay forma de comparar), avisar
explicitamente al usuario del riesgo y pedir confirmacion antes de cambiar
produccion — no asumir.

---

## Preservar escrituras que ocurrieron durante la ventana de falla

Antes de restaurar un backup (que puede ser de dias antes) sobre la base que
esta sirviendo en ese momento (aunque sea con datos viejos), hay que salvar
lo que se escribio en esa ventana. El caso mas sensible en este proyecto son
las marcaciones de asistencia (`user_attendance_records`, columna `date`):

```sql
SELECT * FROM user_attendance_records WHERE date = CURRENT_DATE ORDER BY user_id;
```

Guardar el resultado a JSON (consulta + `fs.writeFileSync`) **antes** de
correr cualquier restore. Repetir la consulta justo antes del switch final
por si entraron mas marcaciones mientras se preparaba el restore.

Al reinsertar en la base restaurada, **NO forzar el mismo `id` de origen**.
El backup viene de una linea de tiempo distinta (ej. muddy-sun) que sigue
avanzando su propia secuencia de `id` en paralelo — un `id` que hoy es
libre en el origen puede ya estar ocupado por una fila completamente
distinta en el backup restaurado (2026-08-11: de 10 filas de asistencia a
reinsertar, 8 chocaron por `id` con filas ajenas del backup y quedaron
descartadas silenciosamente con `ON CONFLICT (id) DO NOTHING` — hubo que
rehacerlo). Insertar sin la columna `id` (dejar que la secuencia del
destino asigne uno nuevo) y usar como llave de deduplicacion una columna
o combinacion natural de negocio (ej. `UNIQUE(user_id, date)` en
`user_attendance_records`), nunca el `id` numerico crudo. Despues de
insertar, correr `SELECT setval(...)` sobre la secuencia para que quede
alineada con el nuevo `MAX(id)`.

Este mismo patron aplica a cualquier otra tabla con escrituras frecuentes
que el usuario mencione explicitamente que le preocupa perder.

---

## Restaurar desde backup (.sql.gz) sin psql

Este entorno de desarrollo **no tiene `psql` instalado** y Docker Desktop
puede no estar corriendo. La alternativa que funciono:

```bash
cd backend
npm install pg-copy-streams --no-save   # si no esta ya en node_modules

DB_HOST=<host-destino> \
DB_PORT=5432 \
DB_USER=neondb_owner \
DB_PASSWORD=<password-destino> \
DB_NAME=<base-destino> \
node scripts/restore_pg_dump.js /ruta/al/backup.sql.gz
```

Script: `backend/scripts/restore_pg_dump.js`. Que hace:
- Descomprime el `.gz` en memoria (backups de ~50MB comprimido / ~130MB
  texto se manejan sin problema).
- Parsea el dump separando bloques `COPY ... FROM stdin; ... \.` (datos, se
  cargan via `pg-copy-streams`) del resto de SQL (DDL, se ejecuta tal cual
  via `client.query`).
- Descarta lineas `\restrict` / `\unrestrict` (meta-comandos de psql 17+ que
  no son SQL valido y rompen la ejecucion via `pg`).
- Corre todo en orden secuencial (importa: los `COPY` dependen de que las
  tablas ya existan, y estan intercalados con el DDL en el dump).
- Reporta progreso cada 50 acciones y guarda errores en
  `restore_errors.json` junto al dump si algo falla (no aborta todo el
  restore por un error puntual en un bloque).

**Preferir siempre `psql` real si esta disponible** (mas rapido, mas
robusto con casos raros del dump). Este script es el plan B verificado
cuando no lo esta.

**IMPORTANTE — restaurar contra una base VACIA**, no contra una que ya
tenga el schema (el dump no usa `--clean`, no dropea nada — colisiona con
`CREATE SCHEMA X` / `CREATE TABLE X` si ya existen). Si el host destino
solo tiene una base con datos viejos y otra vacia (ver seccion anterior),
restaurar en la vacia y apuntar Cloud Run ahi, no sobreescribir la que ya
tiene datos.

**IMPORTANTE — el dump deja `search_path = ''` en la sesion y nunca lo
resetea** (primera linea: `SELECT pg_catalog.set_config('search_path', '',
false);`, para poder auto-calificar todo su propio DDL). Con `psql` esto
muere solo al cerrar la conexion. Con este script, que usa un `pg.Client`
persistente sobre el endpoint `-pooler`, ese estado puede quedar pegado en
un backend del pool de Neon y filtrarse a otras conexiones que reusen ese
mismo backend — sintoma: queries sin calificar (`SELECT * FROM users`)
fallan con `relation "X" does not exist" aunque `information_schema`
confirme que la tabla existe, y **queries calificadas
(`SELECT * FROM public.users`) SI funcionan**. Si ves ese patron exacto,
es esto, no una restauracion fallida. Verificar con `SHOW search_path` —
si sale vacio en vez de `"$user", public`, ese es el problema.

Por esto: **usar siempre el endpoint DIRECTO (sin `-pooler`) tanto para
el restore como para el `DB_HOST` que apunta Cloud Run**, igual que ya
recomendaba el skill de queries de produccion para `muddy-sun`. El
endpoint directo no comparte backends entre clientes, asi que este tipo
de contaminacion de sesion no puede ocurrir. Regla general para este
proyecto: **nunca usar el endpoint `-pooler` de Neon**, ni para scripts
ad hoc ni para `DB_HOST` en produccion.

---

## Aplicar el failover en Cloud Run

1. Nueva version del password en Secret Manager (si el host destino usa una
   contrasena distinta a la actual):
   ```bash
   printf '%s' '<password-destino>' | gcloud secrets versions add DB_PASSWORD --data-file=- --project=famspi-sbox
   ```
2. Actualizar `DB_HOST` y `DB_NAME` (y `DB_PORT`/`DB_USER` si cambian) en
   Cloud Run — esto crea una revision nueva y **re-resuelve el secreto a la
   version `latest`** (por eso el paso 1 va primero):
   ```bash
   gcloud run services update spi-backend --project=famspi-sbox --region=us-central1 \
     --update-env-vars=DB_HOST=<host-destino>,DB_NAME=<base-destino>
   ```
3. Verificar logs (no hay endpoint de health check confiable expuesto para
   `curl` directo desde este entorno — usar logs):
   ```bash
   gcloud run services logs read spi-backend --project=famspi-sbox --region=us-central1 --limit=40
   ```
   Buscar `PostgreSQL conectado correctamente` y requests `200` reales de
   usuarios. Errores tipo `relation "X" does not exist` son esperables si el
   destino es una snapshot vieja a la que le faltan migraciones posteriores
   — no bloquean el login, pero hay que avisarlos.

---

## Despues de la contingencia (siempre pendiente, documentar en el reporte al usuario)

1. Subir el plan de Neon o esperar el reset del ciclo de facturacion en el
   host que quedo suspendido — esto es accion humana en el dashboard de
   Neon (console.neon.tech -> Billing), no se puede resolver por codigo/CLI.
2. Aplicar sobre el host destino cualquier migracion de
   `backend/migrations/` posterior a la fecha del backup restaurado.
3. Reconciliar manualmente cualquier escritura que haya ocurrido en el host
   viejo durante la ventana en que no era accesible (si el usuario necesita
   ese dato de vuelta) contra lo que se escribio en el host nuevo mientras
   tanto — van a ser dos lineas de datos divergentes.
4. Cuando el host original se recupere, decidir con el usuario si conviene
   volver a el (con los datos ya reconciliados) o quedarse en el nuevo.

---

## Stop conditions

No proceder sin confirmacion explicita del usuario si:

- el destino candidato no tiene el schema esperado o esta vacio, y no hay
  backup disponible para restaurarlo primero
- no se puede verificar la fecha/frescura real de los datos del destino
- el restore implica sobreescribir una base que ya tiene datos (aunque sean
  viejos) en vez de una vacia
- hay escrituras recientes sin respaldar en el host que se va a dejar de
  usar y el usuario no ha confirmado que acepta ese hueco
