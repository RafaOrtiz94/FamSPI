-- =============================================================
-- create_expedientes_from_applicants.sql
-- Ejecutar directamente en Neon → SQL Editor
--
-- Qué hace:
--   1. Lee puestos distintos normalizados de applicants.profile
--   2. Crea un personnel_request por cada puesto único
--   3. Vincula cada aspirante a su expediente
-- =============================================================

DO $$
DECLARE
    v_requester_id  INTEGER;
    v_request_id    INTEGER;
    v_puesto        TEXT;
    v_creados       INTEGER := 0;
    v_existentes    INTEGER := 0;
    v_vinculados    INTEGER := 0;
    v_omitidos      INTEGER := 0;
    v_updated       INTEGER;
    rec             RECORD;
BEGIN

    -- 1. Obtener el ID del usuario administrador
    SELECT id INTO v_requester_id
    FROM users
    WHERE email = 'administrador@fam-project.com'
    LIMIT 1;

    IF v_requester_id IS NULL THEN
        RAISE EXCEPTION 'Usuario administrador no encontrado en la tabla users';
    END IF;

    RAISE NOTICE 'Admin ID: %', v_requester_id;
    RAISE NOTICE '-------------------------------------------';

    -- 2. Iterar sobre puestos únicos normalizados
    FOR rec IN
        SELECT
            UPPER(TRIM(REGEXP_REPLACE(
                profile->'laboral'->>'cargo', '\s+', ' ', 'g'
            ))) AS puesto_norm,
            array_agg(id ORDER BY created_at) AS applicant_ids,
            COUNT(*)::INTEGER AS total
        FROM applicants
        WHERE profile->'laboral'->>'cargo' IS NOT NULL
          AND TRIM(profile->'laboral'->>'cargo') != ''
        GROUP BY puesto_norm
        ORDER BY total DESC, puesto_norm
    LOOP
        v_puesto := rec.puesto_norm;

        -- Saltar filas vacías o muy cortas
        IF v_puesto IS NULL OR LENGTH(v_puesto) < 2 THEN
            RAISE NOTICE 'SKIP vacío — % aspirantes', rec.total;
            v_omitidos := v_omitidos + 1;
            CONTINUE;
        END IF;

        -- 3. ¿Ya existe un expediente para este puesto?
        SELECT id INTO v_request_id
        FROM personnel_requests
        WHERE UPPER(TRIM(REGEXP_REPLACE(position_title, '\s+', ' ', 'g'))) = v_puesto
        LIMIT 1;

        IF v_request_id IS NULL THEN
            -- 4. Crear nuevo expediente
            INSERT INTO personnel_requests (
                requester_id,
                position_title,
                position_type,
                education_level,
                main_responsibilities,
                justification,
                status,
                urgency_level,
                priority
            ) VALUES (
                v_requester_id,
                v_puesto,
                'permanente',
                'Bachillerato o Superior',
                'Por definir',
                'Expediente generado automáticamente desde postulaciones recibidas.',
                'en_proceso',
                'normal',
                3
            )
            RETURNING id INTO v_request_id;

            RAISE NOTICE 'CREADO    [% aspirantes]  id=% → "%"', rec.total, v_request_id, v_puesto;
            v_creados := v_creados + 1;
        ELSE
            RAISE NOTICE 'EXISTE    [% aspirantes]  id=% → "%"', rec.total, v_request_id, v_puesto;
            v_existentes := v_existentes + 1;
        END IF;

        -- 5. Vincular aspirantes → expediente
        UPDATE applicants
        SET personnel_request_id = v_request_id,
            updated_at            = NOW()
        WHERE id = ANY(rec.applicant_ids)
          AND (personnel_request_id IS NULL OR personnel_request_id = v_request_id);

        GET DIAGNOSTICS v_updated = ROW_COUNT;
        v_vinculados := v_vinculados + v_updated;

    END LOOP;

    RAISE NOTICE '-------------------------------------------';
    RAISE NOTICE 'Expedientes creados   : %', v_creados;
    RAISE NOTICE 'Expedientes existentes: %', v_existentes;
    RAISE NOTICE 'Aspirantes vinculados : %', v_vinculados;
    RAISE NOTICE 'Puestos omitidos      : %', v_omitidos;
    RAISE NOTICE '===========================================';

END $$;
