# skill: production-neon-query

## Proposito

Ejecutar consultas de lectura o escritura en la base de datos de produccion de FamSPI (Neon PostgreSQL) directamente desde el entorno local, usando Secret Manager de GCP como fuente de la contrasena.

Usar este skill cuando se necesite:
- consultar registros directamente en produccion
- ejecutar scripts de backfill o migracion de datos
- verificar estados reales de la DB sin pasar por el API
- depurar problemas de datos o inconsistencias

---

## Parametros de conexion verificados

- **Proyecto GCP**: `famspi-sbox`
- **Secret name**: `DB_PASSWORD` (version 5+, actualizada en la migracion 2026-07-21)
- **Host**: `ep-muddy-sun-ah5um48r.c-3.us-east-1.aws.neon.tech` — **SIN** `-pooler`: esta instancia se migro el 2026-07-21 (la anterior, `wispy-moon`, agoto su cuota mensual de compute); su endpoint pooled NO honra `ALTER ROLE ... SET search_path`, usar siempre el endpoint directo
- **Puerto**: `5432`
- **Usuario**: `neondb_owner`
- **Base**: `neondb`
- **SSL**: requerido (`rejectUnauthorized: false`)
- **pg binario**: `./backend/node_modules/pg` (no requiere instalacion global)

---

## Prerequisito: gcloud auth activo

Verificar con:

```bash
gcloud auth print-access-token
```

Si falla con "Reauthentication failed":

```bash
gcloud auth login
```

El usuario debe hacer este paso una vez en su terminal. Es interactivo — abre navegador.

Verificar cuenta activa:

```bash
gcloud auth list
# debe mostrar: administrador@fam-project.com *
```

---

## Obtener la contrasena desde Secret Manager

```bash
DB_PASS=$(gcloud secrets versions access latest --secret=DB_PASSWORD --project=famspi-sbox)
```

Verificar que no esta vacia:

```bash
echo ${#DB_PASS}   # debe ser > 0
```

---

## Patron de conexion Node.js (metodo preferido)

```js
const { Client } = require("./backend/node_modules/pg");

const client = new Client({
  host: "ep-muddy-sun-ah5um48r.c-3.us-east-1.aws.neon.tech",
  port: 5432,
  user: "neondb_owner",
  password: process.env.DB_PASS,
  database: "neondb",
  ssl: { rejectUnauthorized: false },
});
```

Patron completo para `node -e`:

```bash
DB_PASS=$(gcloud secrets versions access latest --secret=DB_PASSWORD --project=famspi-sbox) \
node -e "
const { Client } = require('./backend/node_modules/pg');
const client = new Client({
  host: 'ep-muddy-sun-ah5um48r.c-3.us-east-1.aws.neon.tech',
  port: 5432, user: 'neondb_owner',
  password: process.env.DB_PASS,
  database: 'neondb',
  ssl: { rejectUnauthorized: false }
});
(async () => {
  await client.connect();
  const r = await client.query('TU_QUERY_AQUI');
  console.log(JSON.stringify(r.rows, null, 2));
  await client.end();
})().catch(e => { console.error(e.message); process.exit(1); });
"
```

---

## Test de conexion rapido

```bash
DB_PASS=$(gcloud secrets versions access latest --secret=DB_PASSWORD --project=famspi-sbox) \
node -e "
const { Client } = require('./backend/node_modules/pg');
const client = new Client({
  host: 'ep-muddy-sun-ah5um48r.c-3.us-east-1.aws.neon.tech',
  port: 5432, user: 'neondb_owner',
  password: process.env.DB_PASS,
  database: 'neondb',
  ssl: { rejectUnauthorized: false }
});
(async () => {
  await client.connect();
  const r = await client.query('SELECT NOW() AS ahora, current_database() AS db');
  console.log('Conectado:', r.rows[0]);
  await client.end();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
"
```

Resultado esperado:
```
Conectado: { ahora: 2026-06-23T..., db: 'neondb' }
```

---

## Ejecutar un archivo SQL externo

```bash
DB_PASS=$(gcloud secrets versions access latest --secret=DB_PASSWORD --project=famspi-sbox) \
node -e "
const { Client } = require('./backend/node_modules/pg');
const fs = require('fs');
const sql = fs.readFileSync('./ruta/al/archivo.sql', 'utf8');
const client = new Client({
  host: 'ep-muddy-sun-ah5um48r.c-3.us-east-1.aws.neon.tech',
  port: 5432, user: 'neondb_owner',
  password: process.env.DB_PASS,
  database: 'neondb',
  ssl: { rejectUnauthorized: false }
});
(async () => {
  await client.connect();
  const r = await client.query(sql);
  console.log('Done. Rows:', Array.isArray(r) ? r.length : (r.rows?.length ?? 0));
  await client.end();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
"
```

---

## Ejecutar un script Node.js que usa db directamente

Para scripts en `backend/scripts/` que requieren acceso a DB:

```bash
DB_PASS=$(gcloud secrets versions access latest --secret=DB_PASSWORD --project=famspi-sbox) \
DB_HOST=ep-muddy-sun-ah5um48r.c-3.us-east-1.aws.neon.tech \
DB_PORT=5432 \
DB_USER=neondb_owner \
DB_PASSWORD=$DB_PASS \
DB_NAME=neondb \
DB_SSL=true \
node backend/scripts/nombre_script.js
```

---

## Errores frecuentes

| Error | Causa | Solucion |
|---|---|---|
| `Reauthentication failed` | gcloud auth expirado | `gcloud auth login` en terminal |
| `password authentication failed` | DB_PASS vacio o .env desactualizado | Usar gcloud secret, no .env |
| `ENOTFOUND base` | DATABASE_URL del .env tiene prefijo `psql '...'` | Extraer con regex o usar variables individuales |
| `column does not exist` | Migration no aplicada | Aplicar migration pendiente en Neon |
| `SSL required` | Falta `ssl: { rejectUnauthorized: false }` | Agregarlo al Client/Pool |

---

## Relacion con otros skills

- `production-neon-point-delete-skill`: para borrados puntuales (usa este patron de conexion)
- `db-migration-skill`: para cambios de schema (migrations .sql)

---

## Stop conditions

No ejecutar si:

- gcloud auth no responde (pedir al usuario `gcloud auth login` primero)
- la query es destructiva sin haber hecho SELECT previo de verificacion
- no hay acceso confirmado al proyecto `famspi-sbox`
