-- 264_bc_consumption_items_annual_qty_numeric.sql
-- BUG REAL encontrado en el BC activo de b123: annual_qty es integer, pero
-- PRODUCTO CALCULADO (fuente de annual_qty para controles/calibradores/
-- materiales) es una formula que casi siempre da decimales (ej. 116.64,
-- 291.6, 21.42857143). El INSERT batch de syncConsumptionData manda TODOS
-- los items en un solo jsonb_to_recordset -- si UN SOLO item del lote tiene
-- un decimal, Postgres rechaza el batch completo con "invalid input syntax
-- for type integer" y la transaccion entera hace ROLLBACK. Por eso
-- reactivos/controles con annual_qty entero sincronizaban bien mientras que
-- materiales (siempre decimales) nunca se creaban ni actualizaban, y
-- arrastraban en el rollback a cualquier otro item del mismo lote.

ALTER TABLE public.bc_consumption_items
  ALTER COLUMN annual_qty TYPE numeric(14,2) USING annual_qty::numeric(14,2),
  ALTER COLUMN annual_qty SET DEFAULT 0;
