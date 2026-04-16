# skill: db-migration

## Proposito
Crear migraciones SQL secuenciales e idempotentes.

## Alcance exacto
- `backend/migrations/*.sql`

## Activar cuando
- Se agrega/ajusta tabla, columna, indice o constraint.

## No usar cuando
- Cambio es solo de codigo sin schema.

## Maximo de archivos por tarea
- 2 archivos (`NNN_*.sql` y opcional rollback).

## Verificacion minima
- Confirmar numero siguiente disponible.
- Validar `IF NOT EXISTS` cuando aplique.

## Stop condition
- Si requiere backfill complejo y transformacion masiva, detener y dividir.

## Handoff
- Despues de migracion, delegar al agente del modulo que consume el schema.
