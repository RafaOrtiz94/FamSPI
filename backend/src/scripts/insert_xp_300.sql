
-- Script to insert XP 300 (Sysmex) data
-- Usage: psql -d <database> -f insert_xp_300.sql

-- ROLLBACK to clear any previous aborted state
ROLLBACK;

BEGIN;

DO $$
DECLARE
    v_equip_id INTEGER;
    v_det_category TEXT := 'Hematología';
    v_det_id INTEGER;
BEGIN
    -------------------------------------------------------------------------
    -- 1. EQUIPMENT: XP 300
    -------------------------------------------------------------------------
    SELECT id_equipo INTO v_equip_id FROM servicio.equipos WHERE nombre = 'XP 300' LIMIT 1;

    IF v_equip_id IS NULL THEN
        INSERT INTO servicio.equipos (
            nombre, 
            descripcion,
            categoria,
            category_type, 
            base_price, 
            capacity_per_hour, 
            code,
            manufacturer,
            estado
        ) VALUES (
            'XP 300', 
            'Analizador hematológico automatizado de 3 partes.', 
            v_det_category,
            v_det_category,
            0, -- Precio base
            60, -- Aprox 60 test/h
            'XP300',
            'Sysmex',
            'operativo'
        ) RETURNING id_equipo INTO v_equip_id;
        RAISE NOTICE 'Equipo XP 300 insertado con ID: %', v_equip_id;
    ELSE
        RAISE NOTICE 'Equipo XP 300 ya existe con ID: %', v_equip_id;
        UPDATE servicio.equipos 
        SET categoria = v_det_category, category_type = v_det_category 
        WHERE id_equipo = v_equip_id;
    END IF;

    -------------------------------------------------------------------------
    -- 2. DETERMINATIONS (Biometría básica)
    -------------------------------------------------------------------------
    -- Verify if exists
    SELECT id INTO v_det_id FROM public.catalog_determinations 
    WHERE equipment_id = v_equip_id AND name = 'Biometría Hemática' LIMIT 1;

    IF v_det_id IS NULL THEN
        INSERT INTO public.catalog_determinations (
            name,
            category,
            equipment_id,
            status,
            metadata
        ) VALUES (
            'Biometría Hemática',
            v_det_category,
            v_equip_id,
            'active',
            '{"alias": "Biometría básica", "parameters": "3 partes"}'::jsonb
        ) RETURNING id INTO v_det_id;
    END IF;

    -------------------------------------------------------------------------
    -- 3. CONSUMABLES
    -------------------------------------------------------------------------
    -- Temp table for consumables
    CREATE TEMP TABLE temp_xp300_consumables (
        supplier_code TEXT,
        name TEXT,
        type TEXT,
        units_per_kit INTEGER,
        consumption_rate NUMERIC
    ) ON COMMIT DROP;

    INSERT INTO temp_xp300_consumables (supplier_code, name, type, units_per_kit, consumption_rate) VALUES
    ('3145611001', 'CELLPACK 20L', 'reactivo', 450, 1.0),
    ('12216540001', 'STROMA WH KX21 x 500ML', 'reactivo', 450, 1.0),
    ('3134466001', 'EIGHT CHECK-3WP XTRA ( 4 X 2 ML)', 'control', 1, 0), -- Control usage depends on frequency, set 0 per test default
    ('6431321001', 'THERMAL PAPER (4X5 ROLLS,50 MM DIAMETER)', 'material', 1, 0.01); -- Estimated paper usage

    -- Insert Consumables if not exist
    INSERT INTO public.catalog_consumables (
        name, 
        supplier_code, 
        type, 
        units_per_kit,
        unit_price,
        status
    )
    SELECT 
        t.name, 
        t.supplier_code, 
        t.type, 
        t.units_per_kit,
        0, 
        'active'
    FROM temp_xp300_consumables t
    WHERE NOT EXISTS (
        SELECT 1 FROM public.catalog_consumables c 
        WHERE c.supplier_code = t.supplier_code
    );

    -- Link to Equipment
    INSERT INTO public.catalog_equipment_consumables (
        equipment_id,
        consumable_id,
        consumption_rate
    )
    SELECT 
        v_equip_id,
        c.id,
        t.consumption_rate
    FROM temp_xp300_consumables t
    JOIN public.catalog_consumables c ON c.supplier_code = t.supplier_code
    WHERE NOT EXISTS (
        SELECT 1 FROM public.catalog_equipment_consumables cec
        WHERE cec.equipment_id = v_equip_id AND cec.consumable_id = c.id
    );

    RAISE NOTICE 'Datos XP 300 insertados correctamente.';

END $$;

COMMIT;
