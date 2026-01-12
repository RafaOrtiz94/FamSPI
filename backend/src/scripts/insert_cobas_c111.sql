
-- Script to insert Cobas c 111 data
-- Usage: psql -d <database> -f insert_cobas_c111.sql

-- SAFETY FIRST: Rollback any previous aborted transaction
ROLLBACK;

BEGIN;

DO $$
DECLARE
    v_equip_id INTEGER;
    v_det_category TEXT := 'Química clínica';
BEGIN
    -------------------------------------------------------------------------
    -- 1. EQUIPMENT: cobas c 111
    -------------------------------------------------------------------------
    -- Check if exists by name or code
    SELECT id_equipo INTO v_equip_id FROM servicio.equipos WHERE nombre = 'cobas c 111' LIMIT 1;

    IF v_equip_id IS NULL THEN
        -- Insert with correct columns found in DB schema
        INSERT INTO servicio.equipos (
            nombre, 
            descripcion,
            categoria,
            category_type, 
            base_price, 
            capacity_per_hour, 
            code,
            manufacturer,
            technical_specs,
            estado
        ) VALUES (
            'cobas c 111', 
            'Analizador de química clínica compacto.', 
            'Química clínica',
            'Química clínica',
            0, -- Precio base
            85, -- Numérico (capacity_per_hour integer)
            'c111',
            'Roche',
            '{"capacity_text": "60-85 test/h"}'::jsonb,
            'operativo'
        ) RETURNING id_equipo INTO v_equip_id;
        RAISE NOTICE 'Equipo cobas c 111 insertado con ID: %', v_equip_id;
    ELSE
        RAISE NOTICE 'Equipo cobas c 111 ya existe con ID: %', v_equip_id;
        -- Update categories if needed to match filtering logic
        UPDATE servicio.equipos 
        SET categoria = 'Química clínica', category_type = 'Química clínica'
        WHERE id_equipo = v_equip_id;
    END IF;

    -------------------------------------------------------------------------
    -- 2. DETERMINATIONS (Reactivos / Pruebas)
    -------------------------------------------------------------------------
    -- We use a temp table to hold data to insert
    CREATE TEMP TABLE temp_determinations (
        roche_code TEXT,
        name TEXT,
        units_per_kit INTEGER
    ) ON COMMIT DROP;

    INSERT INTO temp_determinations (roche_code, name, units_per_kit) VALUES
    ('4657527190', 'Glucosa', 400),
    ('4657616190', 'Urea', 400),
    ('5401755190', 'Creatinina', 400),
    ('4657608190', 'Ácido Úrico', 400),
    ('4718917190', 'Colesterol Total', 400),
    ('4657594190', 'Triglicéridos', 200),
    ('4718569190', 'ALT (TGP)', 400),
    ('4657543190', 'AST (TGO)', 400),
    ('4657373190', 'Fosfatasa Alcalina', 200),
    ('5795648190', 'Bilirrubina Total', 400),
    ('5589134190', 'Bilirrubina Directa', 100),
    ('7528604190', 'HDL Colesterol', 200),
    ('5401496190', 'Amilasa', 200),
    ('5401704190', 'Lipasa', 100),
    ('5401461190', 'GGT', 200),
    ('4657357190', 'Albúmina', 400),
    ('7005806190', 'LDL Colesterol', 100),
    ('5061504190', 'Calcio', 400),
    ('7442017190', 'CK', 200),
    ('5401674190', 'LDH', 100),
    ('5336180190', 'HbA1c', 200),
    ('5401658190', 'Hierro', 100),
    ('4657586190', 'Proteínas Totales', 400),
    ('7876432190', 'PCR Látex', 200),
    ('5077753190', 'D-Dimer', 200),
    ('5401780190', 'Fósforo', 100),
    ('7442050190', 'CK-MB', 100);

    -- Insert or Update Determinations
    INSERT INTO public.catalog_determinations (
        name, 
        roche_code, 
        category, 
        equipment_id, 
        status,
        metadata
    )
    SELECT 
        t.name, 
        t.roche_code, 
        v_det_category, 
        v_equip_id, 
        'active',
        jsonb_build_object('units_per_kit', t.units_per_kit)
    FROM temp_determinations t
    WHERE NOT EXISTS (
        SELECT 1 FROM public.catalog_determinations d 
        WHERE d.roche_code = t.roche_code
    );

    RAISE NOTICE 'Determinaciones insertadas/verificadas.';

    -------------------------------------------------------------------------
    -- 3. CONSUMABLES (Calibradores, Controles, Insumos)
    -------------------------------------------------------------------------
    CREATE TEMP TABLE temp_consumables (
        supplier_code TEXT,
        name TEXT,
        type TEXT
    ) ON COMMIT DROP;

    INSERT INTO temp_consumables (supplier_code, name, type) VALUES
    -- Calibradores
    ('10759350190', 'Calibrator f.a.s. 12×3 ml', 'calibrador'),
    ('12172623122', 'CFAS Lipids 3×1 ml', 'calibrador'),
    ('11355279216', 'CFAS Proteins', 'calibrador'),
    ('4528417190', 'CFAS HbA1c 3×2 ml', 'calibrador'),
    ('5050901190', 'CFAS D-Dimer', 'calibrador'),
    -- Controles
    ('5947626190', 'PreciControl ClinChem Multi 1 (4×5 ml)', 'control'),
    ('5947774190', 'PreciControl ClinChem Multi 2 (4×5 ml)', 'control'),
    ('5479207190', 'PreciControl HbA1c Norm', 'control'),
    ('5912504190', 'PreciControl HbA1c Path', 'control'),
    ('5050936190', 'PreciControl D-Dimer', 'control'),
    -- Consumibles / Insumos
    ('4774230190', 'NaCl 0.9% cobas c 111', 'material'),
    ('4528182190', 'HbA1c TQ haemolyzing reagent', 'reactivo'),
    ('4663632190', 'Activator for cobas c / Integra / c111', 'material'),
    ('11298500316', 'ISE Cleaning Solution 5×100 ml', 'material'),
    ('20754765322', 'Cobas Integra Cleaner', 'material'),
    ('4357108001', 'Micro Cuvette Segment', 'material'),
    ('4444191001', 'Sample cup (250 unidades)', 'material'),
    ('4352483001', 'URISYS papel impresora', 'material'),
    ('5344620001', 'Lámpara Halógena 12V / 20W', 'material');

    -- Insert Consumables
    INSERT INTO public.catalog_consumables (
        name, 
        supplier_code, 
        type, 
        unit_price,
        status
    )
    SELECT 
        t.name, 
        t.supplier_code, 
        t.type, 
        0, -- Precio 0 por defecto
        'active'
    FROM temp_consumables t
    WHERE NOT EXISTS (
        SELECT 1 FROM public.catalog_consumables c 
        WHERE c.supplier_code = t.supplier_code
    );

    -- Link Consumables to Equipment
    INSERT INTO public.catalog_equipment_consumables (
        equipment_id,
        consumable_id,
        consumption_rate
    )
    SELECT 
        v_equip_id,
        c.id,
        1.0
    FROM temp_consumables t
    JOIN public.catalog_consumables c ON c.supplier_code = t.supplier_code
    WHERE NOT EXISTS (
        SELECT 1 FROM public.catalog_equipment_consumables cec
        WHERE cec.equipment_id = v_equip_id AND cec.consumable_id = c.id
    );

    RAISE NOTICE 'Consumibles insertados y vinculados.';

END $$;

COMMIT;
