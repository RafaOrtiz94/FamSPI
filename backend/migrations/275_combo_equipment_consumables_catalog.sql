-- 275_combo_equipment_consumables_catalog.sql
--
-- Root cause (BC dca773bb-0e45-42bc-998b-3bb784867249, equipo "cobas Pure
-- <303 + 402>"): los equipos "combo" (SKU comercial que agrupa 2
-- instrumentos, ej. "cobas Pure <303 + 402>" id=15, "cobas Pro <503+801>
-- ISE" id=16) NUNCA tuvieron sus propias filas en
-- catalog_equipment_consumables -- toda la data real de reactivos,
-- controles, calibradores y materiales vive bajo los equipos INDIVIDUALES
-- (303=id 9, 402=id 13, 503=id 10, 801=id 14), que un BC nunca selecciona
-- directamente (el combo es el SKU que se vende).
--
-- El matching de hojas del Sheet (businessCaseSheetSyncLocal.service.js,
-- buildSheetPayloads) SI resuelve correctamente ambas hojas del template
-- ("c303 c503" + " e402 e801") para el combo -- verificado simulando el
-- algoritmo real contra la plantilla -- pero como el combo no tenia
-- consumables propios, no habia datos que sincronizar/mostrar para la mitad
-- "303" del combo ni en el Sheet ni en la UI de determinaciones.
--
-- Fix: la union de consumables de los 2 componentes se copia al equipo
-- combo. Esto beneficia automaticamente a TODO BC futuro que seleccione
-- estos combos (el catalogo es compartido, no es un parche por BC).

-- DISTINCT ON (consumable_id, determination_id) en vez de solo ON CONFLICT:
-- Postgres trata NULL <> NULL en constraints UNIQUE, y determination_id es
-- NULL en casi todas las filas -- 6 consumable_id se repiten entre los 2
-- componentes de cada combo (mismos reactivos compartidos), ON CONFLICT solo
-- no habria evitado duplicarlos.
INSERT INTO catalog_equipment_consumables (equipment_id, consumable_id, determination_id, consumption_rate, created_at)
SELECT DISTINCT ON (consumable_id, determination_id) 15, consumable_id, determination_id, consumption_rate, NOW()
FROM catalog_equipment_consumables
WHERE equipment_id IN (9, 13)
ORDER BY consumable_id, determination_id
ON CONFLICT (equipment_id, consumable_id, determination_id) DO NOTHING;

INSERT INTO catalog_equipment_consumables (equipment_id, consumable_id, determination_id, consumption_rate, created_at)
SELECT DISTINCT ON (consumable_id, determination_id) 16, consumable_id, determination_id, consumption_rate, NOW()
FROM catalog_equipment_consumables
WHERE equipment_id IN (10, 14)
ORDER BY consumable_id, determination_id
ON CONFLICT (equipment_id, consumable_id, determination_id) DO NOTHING;
