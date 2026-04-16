# Runbook operativo integracion SPI <-> Odoo

## 1) Sintomas
- Las rutas principales de SPI responden, pero no se reflejan cambios en integraciones (outbox acumulado en `pending`/`failed`).
- El worker reporta errores repetidos y suben filas `dead`.
- Incidentes de latencia o indisponibilidad de Odoo.
- Se requiere contencion rapida para proteger la operacion interna de SPI.

## 2) Diagnostico (SQL y comandos)
Ejecutar en la base de datos de SPI:

```sql
-- Conteo por estado
SELECT status, COUNT(*) AS total
FROM public.integration_outbox
GROUP BY status
ORDER BY status;
```

```sql
-- Pendiente mas antiguo (segundos)
SELECT COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(created_at))), 0)::int AS oldest_pending_age_sec
FROM public.integration_outbox
WHERE status = 'pending';
```

```sql
-- Ultimos eventos failed/dead
SELECT id, event_type, idempotency_key, correlation_id, status, attempt_count, last_error, created_at, updated_at
FROM public.integration_outbox
WHERE status IN ('failed', 'dead')
ORDER BY updated_at DESC
LIMIT 50;
```

Reporte rapido desde script:

```bash
cd backend
npm run integration:reconcile
```

## 3) Contencion (emergencia)
1. Forzar degradado seguro en backend: `ODOO_INTEGRATION_ENABLED=false`.
2. Reiniciar proceso de API/worker para aplicar variable.
3. Verificar que no se estan intentando envios:
   - `npm run integration:reconcile` (no debe crecer `processing`/`sent`).
   - Worker (`node scripts/integration-outbox-worker.js`) deja eventos en `skipped` o sin envio segun configuracion.
4. Confirmar continuidad de SPI con flag off:

```bash
cd backend
npm run test:integration-off
```

## 4) Recuperacion (reprocesar outbox)
Cuando Odoo vuelva estable:
1. Habilitar `ODOO_INTEGRATION_ENABLED=true` y reiniciar servicios.
2. Reintentar `failed` no terminales:

```sql
UPDATE public.integration_outbox
SET status = 'pending',
    updated_at = NOW()
WHERE status = 'failed';
```

3. Para `dead`, revisar causa en `last_error`; si procede reintento controlado:

```sql
UPDATE public.integration_outbox
SET status = 'pending',
    attempt_count = 0,
    last_error = NULL,
    updated_at = NOW()
WHERE status = 'dead'
  AND event_type IN ('private_purchase.status_changed', 'equipment_purchase.status_changed');
```

4. Ejecutar worker por lotes:

```bash
cd backend
node scripts/integration-outbox-worker.js --limit=50 --max-attempts=5
```

5. Validar tendencia descendente de `pending/failed/dead` con `npm run integration:reconcile`.

## 5) Escalamiento
- Escalar a equipo ERP/Odoo cuando:
  - `dead > 0` sostenido por mas de 2 ciclos de reproceso.
  - `oldestPendingAgeSec` supera el umbral operativo acordado (ej. 1800 s).
  - Hay errores repetitivos de autenticacion/TLS.
- Escalar a backend SPI cuando:
  - Hay errores SQL en outbox o picos de `failed` sin cambios en Odoo.
  - El worker no avanza estados (`pending` no disminuye tras ejecuciones).

