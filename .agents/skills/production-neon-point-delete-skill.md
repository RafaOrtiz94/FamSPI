# skill: production-neon-point-delete

## Proposito
Ejecutar eliminaciones puntuales en la base de datos de produccion de FamSPI con maxima precision, evidencia previa, minimo alcance y verificacion posterior.

Este skill existe para operaciones como:
- borrar un activo de TI erroneo
- borrar una entrega puntual de prueba
- borrar una acta puntual creada por error
- limpiar datos E2E de un usuario especifico

No sirve para limpiezas masivas ni backfills.

---

## Activar cuando

Usar este skill si el usuario pide cualquiera de estas acciones directamente en produccion:

- borrar un registro puntual desde base
- limpiar datos de prueba en Neon
- eliminar una entidad operativa especifica con validacion previa
- revisar dependencias antes de borrar
- verificar que un registro realmente desaparecio

---

## No usar cuando

No usar si:

- el cambio es de schema
- la tarea es una migracion
- el usuario pide borrar muchos registros sin criterio exacto
- no hay datos suficientes para identificar un registro unico
- la operacion afecta tablas core sin filtro por id o sin evidencia

Si el usuario pide un borrado amplio, detener y pedir confirmacion con criterio exacto.

---

## Fuente de verdad

Para DB en este proyecto:

Neon PostgreSQL es la fuente de verdad.

Orden obligatorio:

1. `backend/src/modules/<modulo>/CONTEXT.md`
2. codigo real del modulo
3. Neon en produccion usando secrets desde GCP Secret Manager

Si falta `CONTEXT.md`, escribir:

`CONTEXT.md no disponible o insuficiente.`

Si Neon contradice el codigo o la documentacion, Neon manda para estructura y datos reales.

---

## Reglas duras

Prohibido:

- borrar por nombre solamente si puede haber multiples matches
- borrar sin localizar primero el `id` real
- borrar sin medir dependencias
- borrar con `DELETE` masivo
- borrar varias tablas a ciegas
- asumir `ON DELETE CASCADE` sin verificar
- tocar produccion sin una consulta de verificacion previa
- exponer secretos en respuesta, logs o commits

Siempre:

- localizar primero el registro exacto
- contar matches
- verificar dependencias por tabla
- borrar en transaccion
- verificar despues del borrado
- reportar exactamente que se elimino

---

## Conexion estandar del proyecto

Parametros reales verificados del proyecto (actualizado 2026-07-21, migracion desde wispy-moon por cuota de compute agotada):

- proyecto GCP: `famspi-sbox`
- host Neon: `ep-muddy-sun-ah5um48r.c-3.us-east-1.aws.neon.tech` (SIN `-pooler`: el pooler de esta instancia no honra `ALTER ROLE ... SET search_path`, usar siempre el endpoint directo)
- puerto: `5432`
- usuario: `neondb_owner`
- base: `neondb`

La contrasena debe obtenerse desde Secret Manager:

- secret: `DB_PASSWORD`

Si `psql` no esta disponible en la maquina, usar `node` con `./backend/node_modules/pg`.

Ese es el metodo preferido en este repo para consultas ad hoc de produccion desde el entorno local.

---

## Flujo obligatorio

### 1. Identificar el modulo

Determinar primero la entidad pedida por el usuario.

Ejemplos:

- activo TI -> `backend/src/modules/ti-assets/`
- entrega colaborador -> `backend/src/modules/collab-deliveries/`
- workflow de firma -> `backend/src/modules/signature-workflows/`

Leer `CONTEXT.md` si existe. Si no existe, continuar con codigo real y marcar riesgo.

### 2. Verificar estructura real en codigo

Antes de tocar Neon, ubicar en codigo:

- tabla principal
- tablas hijas
- tablas que referencian por FK o por uso operativo
- si el modulo usa borrado fisico o solo `active=false`

Buscar con `rg` sobre:

- nombre de tabla
- `DELETE FROM`
- `UPDATE ... active = false`
- columnas FK como `asset_id`, `delivery_id`, `workflow_id`, `user_id`

### 3. Localizar el registro exacto

Primero ejecutar un `SELECT` con filtros suficientes para hallar un solo match.

Si hay 0 matches:

- no borrar
- reportar que no existe evidencia en Neon

Si hay mas de 1 match:

- no borrar
- pedir criterio adicional o agregar mas filtros

El objetivo es terminar con:

- `id`
- codigo funcional si existe
- campos de control para confirmar identidad

### 4. Medir dependencias

Antes del `DELETE`, contar dependencias en tablas relacionadas.

Hacer `COUNT(*)` por tabla relevante.

Clasificar:

- dependencias en cascada real por FK
- dependencias con `SET NULL`
- dependencias sin FK pero operativamente relevantes

Si hay dependencias no esperadas, detener y reportar antes de borrar.

### 5. Ejecutar borrado puntual

Regla:

- usar `BEGIN`
- borrar por `id`
- usar `RETURNING`
- verificar conteo residual dentro de la misma operacion
- `COMMIT`
- `ROLLBACK` si algo falla

### 6. Verificar resultado

Despues del borrado, confirmar:

- `COUNT(*) = 0` para el registro objetivo
- si aplica, que no quedaron huellas hijas huerfanas
- si aplica, que el usuario o entidad principal sigue consistente

---

## Patron tecnico recomendado

### Consulta de localizacion

Usar `node -e` con `pg` y `ssl: { rejectUnauthorized: false }`.

Patron:

```js
const { Client } = require("./backend/node_modules/pg");
```

Luego:

```js
const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
});
```

### Consulta de dependencias

Patron:

```sql
SELECT 'tabla_a' AS table_name, COUNT(*)::int AS total FROM public.tabla_a WHERE fk_id = $ID
UNION ALL
SELECT 'tabla_b', COUNT(*)::int FROM public.tabla_b WHERE fk_id = $ID;
```

### Borrado puntual

Patron:

```sql
BEGIN;
DELETE FROM public.tabla_objetivo
WHERE id = $ID
RETURNING id;

SELECT COUNT(*)::int AS total
FROM public.tabla_objetivo
WHERE id = $ID;
COMMIT;
```

Si falla:

```sql
ROLLBACK;
```

---

## Checklist de salida minima

Antes de responder al usuario, confirmar internamente:

- modulo identificado
- `CONTEXT.md` leido o declarado insuficiente
- tabla principal verificada en codigo
- registro localizado con `id` exacto
- dependencias medidas
- borrado hecho solo sobre el objetivo
- verificacion posterior ejecutada

---

## Plantilla de respuesta

Usar una respuesta corta y factual:

```txt
Registro eliminado directamente de Neon.

Entidad:
- id:
- codigo:
- campos de confirmacion:

Verificacion:
- matches previos:
- dependencias detectadas:
- matches posteriores:

Observacion:
- CONTEXT.md no disponible o insuficiente.
```

---

## Casos frecuentes del proyecto

### TI assets

Tabla principal:

- `public.ti_assets`

Dependencias a medir normalmente:

- `public.ti_asset_assignments`
- `public.ti_asset_events`
- `public.ti_asset_accessories`
- `public.ti_asset_maintenance_schedule`
- `public.ti_asset_actas`
- `public.ti_asset_actas_items`
- `public.ti_asset_financial_docs`
- `public.ti_asset_liberation_photos`
- `public.ti_corporate_numbers`

### Collab deliveries

Tablas a revisar normalmente:

- `public.collab_deliveries`
- `public.collab_delivery_events`
- `public.collab_delivery_actas`
- `public.collab_delivery_actas_items`
- `public.collab_renewal_schedule`
- tablas de workflow o firma si la entrega ya genero expediente

### Signature workflows

Tablas a revisar normalmente:

- `public.signature_workflows`
- `public.signature_workflow_signers`
- `public.signature_workflow_events`
- cualquier tabla origen con `signature_workflow_id`

---

## Stop conditions

Detenerse y no borrar si ocurre cualquiera de estas:

- el registro no es unico
- hay dependencias activas que el usuario no pidio borrar
- hay evidencia de que el registro ya forma parte de un flujo firmado o auditado
- el borrado romperia una secuencia documental o un expediente productivo
- el usuario pidio un borrado ambiguo

En esos casos, responder con evidencia concreta y pedir criterio adicional.
