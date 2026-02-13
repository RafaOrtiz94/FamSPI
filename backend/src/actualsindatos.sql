--
-- PostgreSQL database dump
--

\restrict tUmeVL1P2GYeUQpVvsyYWe2rvUmZ0ra2uqSaBDAE6Ui6CgZB2vnRjG2YLTLwSSN

-- Dumped from database version 18.0
-- Dumped by pg_dump version 18.0

-- Started on 2026-01-06 06:17:34

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 9 (class 2615 OID 16984)
-- Name: auditoria; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA auditoria;


ALTER SCHEMA auditoria OWNER TO postgres;

--
-- TOC entry 8 (class 2615 OID 16385)
-- Name: servicio; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA servicio;


ALTER SCHEMA servicio OWNER TO postgres;

--
-- TOC entry 2 (class 3079 OID 16772)
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- TOC entry 6747 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- TOC entry 3 (class 3079 OID 28203)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 6748 (class 0 OID 0)
-- Dependencies: 3
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- TOC entry 1130 (class 1247 OID 16387)
-- Name: approval_action_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.approval_action_enum AS ENUM (
    'approve',
    'reject'
);


ALTER TYPE public.approval_action_enum OWNER TO postgres;

--
-- TOC entry 1343 (class 1247 OID 27394)
-- Name: private_purchase_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.private_purchase_status_enum AS ENUM (
    'pending_commercial',
    'pending_backoffice',
    'offer_sent',
    'offer_signed',
    'client_registered',
    'sent_to_acp',
    'rejected',
    'pending_manager_signature',
    'pending_client_signature'
);


ALTER TYPE public.private_purchase_status_enum OWNER TO postgres;

--
-- TOC entry 1133 (class 1247 OID 16392)
-- Name: request_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.request_status_enum AS ENUM (
    'pending',
    'in_review',
    'approved',
    'rejected'
);


ALTER TYPE public.request_status_enum OWNER TO postgres;

--
-- TOC entry 486 (class 1255 OID 27030)
-- Name: bc_audit_trigger(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.bc_audit_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_user_id INTEGER;
  v_new_json JSONB;
BEGIN
  v_new_json := to_jsonb(NEW);
  
  -- Extract user ID safely from potential columns
  v_user_id := (v_new_json->>'added_by')::INTEGER;
  
  IF v_user_id IS NULL THEN
    v_user_id := (v_new_json->>'selected_by')::INTEGER;
  END IF;
  
  IF v_user_id IS NULL THEN
    v_user_id := (v_new_json->>'changed_by')::INTEGER;
  END IF;

  INSERT INTO bc_audit_log (
    business_case_id,
    action,
    entity_type,
    entity_id,
    before_value,
    after_value,
    changed_by
  ) VALUES (
    COALESCE(NEW.business_case_id, OLD.business_case_id),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    row_to_json(OLD),
    row_to_json(NEW),
    v_user_id
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.bc_audit_trigger() OWNER TO postgres;

--
-- TOC entry 507 (class 1255 OID 28862)
-- Name: create_document_seal_and_qr(bigint, character varying, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_document_seal_and_qr(p_document_id bigint, p_authorized_role character varying, p_authorized_user_id integer DEFAULT NULL::integer) RETURNS TABLE(seal_id integer, qr_id integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_seal_id INTEGER;
    v_qr_id INTEGER;
BEGIN
    -- Create institutional seal
    INSERT INTO document_seals (
        document_id,
        authorized_role,
        authorized_user_id
    ) VALUES (
        p_document_id,
        p_authorized_role,
        p_authorized_user_id
    ) RETURNING id INTO v_seal_id;

    -- Create QR code for verification
    INSERT INTO document_qr_codes (
        document_id,
        seal_id
    ) VALUES (
        p_document_id,
        v_seal_id
    ) RETURNING id INTO v_qr_id;

    -- Return the created IDs
    RETURN QUERY SELECT v_seal_id, v_qr_id;
END;
$$;


ALTER FUNCTION public.create_document_seal_and_qr(p_document_id bigint, p_authorized_role character varying, p_authorized_user_id integer) OWNER TO postgres;

--
-- TOC entry 508 (class 1255 OID 28844)
-- Name: ensure_single_current_hash(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ensure_single_current_hash() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- If new hash is marked as current, unset all other current hashes for this document
    IF NEW.is_current = true THEN
        UPDATE document_hashes
        SET is_current = false
        WHERE document_id = NEW.document_id AND id != NEW.id;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.ensure_single_current_hash() OWNER TO postgres;

--
-- TOC entry 464 (class 1255 OID 27333)
-- Name: equipos_touch(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.equipos_touch() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.equipos_touch() OWNER TO postgres;

--
-- TOC entry 463 (class 1255 OID 27271)
-- Name: equipos_touch_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.equipos_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.equipos_touch_updated_at() OWNER TO postgres;

--
-- TOC entry 423 (class 1255 OID 16401)
-- Name: fn_log_request_status(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_log_request_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.request_status_history(request_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.requester_id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_log_request_status() OWNER TO postgres;

--
-- TOC entry 500 (class 1255 OID 28384)
-- Name: generate_bc_number(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_bc_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.bc_number IS NULL THEN
    NEW.bc_number := 'BC-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(nextval('bc_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.generate_bc_number() OWNER TO postgres;

--
-- TOC entry 469 (class 1255 OID 17460)
-- Name: generate_personnel_request_number(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_personnel_request_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.request_number := 'SP-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEW.id::TEXT, 5, '0');
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.generate_personnel_request_number() OWNER TO postgres;

--
-- TOC entry 502 (class 1255 OID 28856)
-- Name: generate_qr_url(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_qr_url(p_verification_token uuid) RETURNS text
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN 'https://spi.famproject.app/verificar/' || p_verification_token::TEXT;
END;
$$;


ALTER FUNCTION public.generate_qr_url(p_verification_token uuid) OWNER TO postgres;

--
-- TOC entry 505 (class 1255 OID 28860)
-- Name: generate_qr_url_trigger(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_qr_url_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.qr_url IS NULL THEN
        NEW.qr_url := generate_qr_url(NEW.verification_token);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.generate_qr_url_trigger() OWNER TO postgres;

--
-- TOC entry 501 (class 1255 OID 28855)
-- Name: generate_seal_code(bigint, character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_seal_code(p_document_id bigint, p_authorized_role character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_year TEXT;
    v_role_prefix TEXT;
    v_sequence INTEGER;
    v_seal_code VARCHAR(50);
BEGIN
    -- Get current year
    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');

    -- Convert role to prefix
    v_role_prefix := CASE UPPER(p_authorized_role)
        WHEN 'DELEGADO DE PROTECCIÓN DE DATOS' THEN 'DPD'
        WHEN 'JEFE DE TI' THEN 'TI'
        WHEN 'GERENTE' THEN 'GER'
        WHEN 'JEFE COMERCIAL' THEN 'COM'
        WHEN 'BACKOFFICE' THEN 'BOF'
        WHEN 'TÉCNICO' THEN 'TEC'
        ELSE 'RESP'
    END;

    -- Get next sequence number (based on document_id for uniqueness)
    v_sequence := (p_document_id % 90000) + 10000; -- 10000-99999 range

    -- Generate seal code
    v_seal_code := 'SPI-' || v_year || '-' || v_role_prefix || '-' || LPAD(v_sequence::TEXT, 5, '0');

    RETURN v_seal_code;
END;
$$;


ALTER FUNCTION public.generate_seal_code(p_document_id bigint, p_authorized_role character varying) OWNER TO postgres;

--
-- TOC entry 504 (class 1255 OID 28858)
-- Name: generate_seal_code_trigger(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_seal_code_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.seal_code IS NULL THEN
        NEW.seal_code := generate_seal_code(NEW.document_id, NEW.authorized_role);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.generate_seal_code_trigger() OWNER TO postgres;

--
-- TOC entry 485 (class 1255 OID 27029)
-- Name: get_current_price(integer, integer, integer, character varying, date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_current_price(p_equipment_id integer DEFAULT NULL::integer, p_consumable_id integer DEFAULT NULL::integer, p_determination_id integer DEFAULT NULL::integer, p_price_type character varying DEFAULT NULL::character varying, p_date date DEFAULT CURRENT_DATE) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_price DECIMAL(12,2);
BEGIN
  -- Buscar en historial primero
  SELECT price INTO v_price
  FROM equipment_price_history
  WHERE (
    (p_equipment_id IS NOT NULL AND equipment_id = p_equipment_id) OR
    (p_consumable_id IS NOT NULL AND consumable_id = p_consumable_id) OR
    (p_determination_id IS NOT NULL AND determination_id = p_determination_id)
  )
  AND (p_price_type IS NULL OR price_type = p_price_type)
  AND effective_from <= p_date
  AND (effective_to IS NULL OR effective_to >= p_date)
  ORDER BY effective_from DESC
  LIMIT 1;
  
  -- Si no hay en historial, buscar en tablas actuales
  IF v_price IS NULL THEN
    IF p_equipment_id IS NOT NULL THEN
      SELECT base_price INTO v_price FROM servicio.equipos WHERE id_equipo = p_equipment_id;
    ELSIF p_consumable_id IS NOT NULL THEN
      SELECT unit_price INTO v_price FROM catalog_consumables WHERE id = p_consumable_id;
    ELSIF p_determination_id IS NOT NULL THEN
      SELECT cost_per_test INTO v_price FROM catalog_determinations WHERE id = p_determination_id;
    END IF;
  END IF;
  
  RETURN COALESCE(v_price, 0);
END;
$$;


ALTER FUNCTION public.get_current_price(p_equipment_id integer, p_consumable_id integer, p_determination_id integer, p_price_type character varying, p_date date) OWNER TO postgres;

--
-- TOC entry 6749 (class 0 OID 0)
-- Dependencies: 485
-- Name: FUNCTION get_current_price(p_equipment_id integer, p_consumable_id integer, p_determination_id integer, p_price_type character varying, p_date date); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_current_price(p_equipment_id integer, p_consumable_id integer, p_determination_id integer, p_price_type character varying, p_date date) IS 'Obtiene el precio vigente de un equipo, consumible o determinación en una fecha específica';


--
-- TOC entry 471 (class 1255 OID 17464)
-- Name: log_personnel_request_status_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.log_personnel_request_status_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO personnel_request_history (
            personnel_request_id,
            previous_status,
            new_status,
            changed_by
        ) VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            NEW.approved_by_hr -- Esto debería ser el usuario actual, ajustar según contexto
        );
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.log_personnel_request_status_change() OWNER TO postgres;

--
-- TOC entry 462 (class 1255 OID 27127)
-- Name: mark_business_case_as_modern(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.mark_business_case_as_modern(p_business_case_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE equipment_purchase_requests
  SET 
    uses_modern_system = true,
    bc_system_type = 'modern',
    updated_at = now()
  WHERE id = p_business_case_id;
END;
$$;


ALTER FUNCTION public.mark_business_case_as_modern(p_business_case_id uuid) OWNER TO postgres;

--
-- TOC entry 6750 (class 0 OID 0)
-- Dependencies: 462
-- Name: FUNCTION mark_business_case_as_modern(p_business_case_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.mark_business_case_as_modern(p_business_case_id uuid) IS 'Marca un Business Case como modernizado (ya no usa Google Sheets)';


--
-- TOC entry 487 (class 1255 OID 27128)
-- Name: migrate_legacy_bc_to_modern(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.migrate_legacy_bc_to_modern(p_business_case_id uuid) RETURNS TABLE(success boolean, message text)
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_bc_exists BOOLEAN;
  v_already_modern BOOLEAN;
BEGIN
  -- Verificar que el BC existe
  SELECT EXISTS(SELECT 1 FROM equipment_purchase_requests WHERE id = p_business_case_id)
  INTO v_bc_exists;
  
  IF NOT v_bc_exists THEN
    RETURN QUERY SELECT false, 'Business Case no encontrado';
    RETURN;
  END IF;
  
  -- Verificar si ya es moderno
  SELECT uses_modern_system INTO v_already_modern
  FROM equipment_purchase_requests
  WHERE id = p_business_case_id;
  
  IF v_already_modern THEN
    RETURN QUERY SELECT false, 'Business Case ya está en sistema moderno';
    RETURN;
  END IF;
  
  -- Marcar como moderno
  UPDATE equipment_purchase_requests
  SET 
    uses_modern_system = true,
    bc_system_type = 'modern',
    bc_spreadsheet_id = NULL,  -- Ya no se usará Google Sheets
    bc_spreadsheet_url = NULL,
    modern_bc_metadata = jsonb_build_object(
      'migrated_from_legacy', true,
      'migration_date', now()
    ),
    updated_at = now()
  WHERE id = p_business_case_id;
  
  RETURN QUERY SELECT true, 'Business Case migrado exitosamente a sistema moderno';
END;
$$;


ALTER FUNCTION public.migrate_legacy_bc_to_modern(p_business_case_id uuid) OWNER TO postgres;

--
-- TOC entry 6751 (class 0 OID 0)
-- Dependencies: 487
-- Name: FUNCTION migrate_legacy_bc_to_modern(p_business_case_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.migrate_legacy_bc_to_modern(p_business_case_id uuid) IS 'Migra un Business Case legacy (Google Sheets) al sistema modernizado';


--
-- TOC entry 467 (class 1255 OID 17028)
-- Name: recalculate_inventory(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.recalculate_inventory() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE public.inventory i
  SET quantity = (
    SELECT COALESCE(SUM(
      CASE 
        WHEN m.movement_type = 'entrada' THEN m.quantity
        WHEN m.movement_type = 'salida' THEN -m.quantity
        ELSE 0
      END
    ), 0)
    FROM public.inventory_movements m
    WHERE m.inventory_id = i.id
  ),
  updated_at = NOW()
  WHERE i.id = NEW.inventory_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.recalculate_inventory() OWNER TO postgres;

--
-- TOC entry 503 (class 1255 OID 28857)
-- Name: track_qr_access(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.track_qr_access(p_qr_id integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE document_qr_codes
    SET
        access_count = access_count + 1,
        first_accessed_at = COALESCE(first_accessed_at, NOW()),
        last_accessed_at = NOW()
    WHERE id = p_qr_id AND is_active = true;
END;
$$;


ALTER FUNCTION public.track_qr_access(p_qr_id integer) OWNER TO postgres;

--
-- TOC entry 499 (class 1255 OID 28368)
-- Name: trigger_mark_for_recalculation(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trigger_mark_for_recalculation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_bc_master_id uuid;
BEGIN
  -- Obtener bc_master_id según la operación
  IF TG_OP = 'DELETE' THEN
    v_bc_master_id := OLD.bc_master_id;
  ELSE
    v_bc_master_id := NEW.bc_master_id;
  END IF;
  
  -- Solo marcar si no está en estados finales
  IF v_bc_master_id IS NOT NULL THEN
    UPDATE bc_master 
    SET current_stage = 'pending_recalculation',
        updated_at = now()
    WHERE id = v_bc_master_id
      AND current_stage NOT IN ('approved', 'rejected', 'draft');
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION public.trigger_mark_for_recalculation() OWNER TO postgres;

--
-- TOC entry 468 (class 1255 OID 17193)
-- Name: update_attendance_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_attendance_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_attendance_timestamp() OWNER TO postgres;

--
-- TOC entry 424 (class 1255 OID 27074)
-- Name: update_calculation_templates_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_calculation_templates_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_calculation_templates_timestamp() OWNER TO postgres;

--
-- TOC entry 506 (class 1255 OID 28842)
-- Name: update_document_signature_status(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_document_signature_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Update document signature status based on signatures
    UPDATE documents
    SET signature_status = CASE
        WHEN EXISTS (SELECT 1 FROM document_signatures_advanced dsa
                    WHERE dsa.document_id = NEW.document_id AND dsa.is_valid = true) THEN 'signed'
        ELSE 'pending'
    END
    WHERE id = NEW.document_id;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_document_signature_status() OWNER TO postgres;

--
-- TOC entry 470 (class 1255 OID 17462)
-- Name: update_personnel_request_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_personnel_request_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_personnel_request_timestamp() OWNER TO postgres;

--
-- TOC entry 472 (class 1255 OID 26185)
-- Name: update_remaining_quantity(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_remaining_quantity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.remaining_quantity := NEW.annual_negotiated_quantity - NEW.consumed_quantity;
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_remaining_quantity() OWNER TO postgres;

--
-- TOC entry 473 (class 1255 OID 26346)
-- Name: update_tech_docs_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_tech_docs_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_tech_docs_timestamp() OWNER TO postgres;

--
-- TOC entry 465 (class 1255 OID 16402)
-- Name: update_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  BEGIN
    NEW.updated_at := now();
  EXCEPTION WHEN undefined_column THEN
    -- Tabla sin columna updated_at, ignorar
    NULL;
  END;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_timestamp() OWNER TO postgres;

--
-- TOC entry 488 (class 1255 OID 27129)
-- Name: validate_bc_system_consistency(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_bc_system_consistency() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Si usa sistema moderno, no debe tener spreadsheet_id
  IF NEW.uses_modern_system = true AND NEW.bc_system_type = 'modern' THEN
    IF NEW.bc_spreadsheet_id IS NOT NULL THEN
      RAISE WARNING 'BC moderno no debe tener bc_spreadsheet_id, limpiando...';
      NEW.bc_spreadsheet_id := NULL;
      NEW.bc_spreadsheet_url := NULL;
    END IF;
  END IF;
  
  -- Si es legacy, debe tener spreadsheet_id (al menos para BCs creados con sheets)
  IF NEW.uses_modern_system = false AND NEW.bc_system_type = 'legacy' THEN
    -- No forzamos, pero logueamos si falta
    IF NEW.bc_spreadsheet_id IS NULL THEN
      RAISE NOTICE 'BC legacy sin bc_spreadsheet_id (puede ser intencional si es nuevo)';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.validate_bc_system_consistency() OWNER TO postgres;

--
-- TOC entry 466 (class 1255 OID 16403)
-- Name: update_timestamp(); Type: FUNCTION; Schema: servicio; Owner: postgres
--

CREATE FUNCTION servicio.update_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  BEGIN
    NEW.updated_at := now();
  EXCEPTION WHEN undefined_column THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;


ALTER FUNCTION servicio.update_timestamp() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 267 (class 1259 OID 16986)
-- Name: logs; Type: TABLE; Schema: auditoria; Owner: postgres
--

CREATE TABLE auditoria.logs (
    id integer NOT NULL,
    usuario_id integer,
    usuario_email character varying(255),
    rol character varying(100),
    modulo character varying(100),
    accion character varying(100),
    descripcion text,
    datos_anteriores jsonb,
    datos_nuevos jsonb,
    ip character varying(45),
    user_agent text,
    fecha timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    duracion_ms integer,
    request_id integer,
    mantenimiento_id integer,
    inventario_id integer,
    auto boolean DEFAULT false,
    creado_en timestamp with time zone DEFAULT now()
);


ALTER TABLE auditoria.logs OWNER TO postgres;

--
-- TOC entry 6752 (class 0 OID 0)
-- Dependencies: 267
-- Name: TABLE logs; Type: COMMENT; Schema: auditoria; Owner: postgres
--

COMMENT ON TABLE auditoria.logs IS 'Registra todas las acciones de usuarios del sistema SPI Fam (creaciones, modificaciones, logins, etc.)';


--
-- TOC entry 6753 (class 0 OID 0)
-- Dependencies: 267
-- Name: COLUMN logs.usuario_email; Type: COMMENT; Schema: auditoria; Owner: postgres
--

COMMENT ON COLUMN auditoria.logs.usuario_email IS 'Correo del usuario que realizó la acción';


--
-- TOC entry 6754 (class 0 OID 0)
-- Dependencies: 267
-- Name: COLUMN logs.modulo; Type: COMMENT; Schema: auditoria; Owner: postgres
--

COMMENT ON COLUMN auditoria.logs.modulo IS 'Módulo afectado (auth, solicitudes, mantenimientos, etc.)';


--
-- TOC entry 6755 (class 0 OID 0)
-- Dependencies: 267
-- Name: COLUMN logs.accion; Type: COMMENT; Schema: auditoria; Owner: postgres
--

COMMENT ON COLUMN auditoria.logs.accion IS 'Tipo de acción (CREATE, UPDATE, DELETE, LOGIN, APPROVE, etc.)';


--
-- TOC entry 6756 (class 0 OID 0)
-- Dependencies: 267
-- Name: COLUMN logs.descripcion; Type: COMMENT; Schema: auditoria; Owner: postgres
--

COMMENT ON COLUMN auditoria.logs.descripcion IS 'Descripción amigable de la acción realizada';


--
-- TOC entry 6757 (class 0 OID 0)
-- Dependencies: 267
-- Name: COLUMN logs.datos_anteriores; Type: COMMENT; Schema: auditoria; Owner: postgres
--

COMMENT ON COLUMN auditoria.logs.datos_anteriores IS 'JSON con los datos antes del cambio';


--
-- TOC entry 6758 (class 0 OID 0)
-- Dependencies: 267
-- Name: COLUMN logs.datos_nuevos; Type: COMMENT; Schema: auditoria; Owner: postgres
--

COMMENT ON COLUMN auditoria.logs.datos_nuevos IS 'JSON con los datos después del cambio';


--
-- TOC entry 6759 (class 0 OID 0)
-- Dependencies: 267
-- Name: COLUMN logs.fecha; Type: COMMENT; Schema: auditoria; Owner: postgres
--

COMMENT ON COLUMN auditoria.logs.fecha IS 'Fecha y hora del evento registrado';


--
-- TOC entry 266 (class 1259 OID 16985)
-- Name: logs_id_seq; Type: SEQUENCE; Schema: auditoria; Owner: postgres
--

CREATE SEQUENCE auditoria.logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE auditoria.logs_id_seq OWNER TO postgres;

--
-- TOC entry 6760 (class 0 OID 0)
-- Dependencies: 266
-- Name: logs_id_seq; Type: SEQUENCE OWNED BY; Schema: auditoria; Owner: postgres
--

ALTER SEQUENCE auditoria.logs_id_seq OWNED BY auditoria.logs.id;


--
-- TOC entry 322 (class 1259 OID 26419)
-- Name: advisor_location_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.advisor_location_history (
    id integer NOT NULL,
    user_email text NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    accuracy double precision,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    activity_type text,
    client_request_id integer,
    visit_log_id integer,
    speed double precision,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.advisor_location_history OWNER TO postgres;

--
-- TOC entry 321 (class 1259 OID 26418)
-- Name: advisor_location_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.advisor_location_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.advisor_location_history_id_seq OWNER TO postgres;

--
-- TOC entry 6761 (class 0 OID 0)
-- Dependencies: 321
-- Name: advisor_location_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.advisor_location_history_id_seq OWNED BY public.advisor_location_history.id;


--
-- TOC entry 388 (class 1259 OID 28452)
-- Name: attendance_exceptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendance_exceptions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now(),
    type character varying(50) NOT NULL,
    description text,
    location text,
    created_at timestamp with time zone DEFAULT now(),
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    start_time timestamp with time zone DEFAULT now(),
    start_location text,
    arrival_time timestamp with time zone,
    arrival_location text,
    departure_time timestamp with time zone,
    departure_location text,
    return_time timestamp with time zone,
    return_location text
);


ALTER TABLE public.attendance_exceptions OWNER TO postgres;

--
-- TOC entry 387 (class 1259 OID 28451)
-- Name: attendance_exceptions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.attendance_exceptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.attendance_exceptions_id_seq OWNER TO postgres;

--
-- TOC entry 6762 (class 0 OID 0)
-- Dependencies: 387
-- Name: attendance_exceptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.attendance_exceptions_id_seq OWNED BY public.attendance_exceptions.id;


--
-- TOC entry 397 (class 1259 OID 28573)
-- Name: audit_access_grants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_access_grants (
    id integer NOT NULL,
    email text NOT NULL,
    display_name text,
    expires_at timestamp with time zone,
    active boolean DEFAULT true NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    revoked_by integer
);


ALTER TABLE public.audit_access_grants OWNER TO postgres;

--
-- TOC entry 396 (class 1259 OID 28572)
-- Name: audit_access_grants_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_access_grants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_access_grants_id_seq OWNER TO postgres;

--
-- TOC entry 6763 (class 0 OID 0)
-- Dependencies: 396
-- Name: audit_access_grants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_access_grants_id_seq OWNED BY public.audit_access_grants.id;


--
-- TOC entry 395 (class 1259 OID 28543)
-- Name: audit_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_documents (
    id integer NOT NULL,
    section_code text NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'pendiente'::text NOT NULL,
    drive_file_id text,
    drive_folder_id text,
    uploaded_by integer,
    uploaded_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_documents OWNER TO postgres;

--
-- TOC entry 394 (class 1259 OID 28542)
-- Name: audit_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_documents_id_seq OWNER TO postgres;

--
-- TOC entry 6764 (class 0 OID 0)
-- Dependencies: 394
-- Name: audit_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_documents_id_seq OWNED BY public.audit_documents.id;


--
-- TOC entry 393 (class 1259 OID 28517)
-- Name: audit_sections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_sections (
    id integer NOT NULL,
    code text NOT NULL,
    title text NOT NULL,
    description text,
    area text,
    storage_path text,
    allowed_roles text[] DEFAULT '{}'::text[] NOT NULL,
    ordering integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_sections OWNER TO postgres;

--
-- TOC entry 392 (class 1259 OID 28516)
-- Name: audit_sections_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_sections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_sections_id_seq OWNER TO postgres;

--
-- TOC entry 6765 (class 0 OID 0)
-- Dependencies: 392
-- Name: audit_sections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_sections_id_seq OWNED BY public.audit_sections.id;


--
-- TOC entry 391 (class 1259 OID 28499)
-- Name: audit_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_settings (
    id smallint DEFAULT 1 NOT NULL,
    audit_mode boolean DEFAULT false NOT NULL,
    audit_start_date timestamp with time zone,
    audit_end_date timestamp with time zone,
    drive_root_id text,
    checklist_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_settings OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 16404)
-- Name: audit_trail; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_trail (
    id integer NOT NULL,
    action text NOT NULL,
    user_id integer,
    request_id integer,
    details jsonb,
    created_at timestamp without time zone DEFAULT now(),
    module text DEFAULT 'core'::text,
    entity text,
    entity_id text,
    ip text
);


ALTER TABLE public.audit_trail OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 16412)
-- Name: audit_trail_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_trail_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_trail_id_seq OWNER TO postgres;

--
-- TOC entry 6766 (class 0 OID 0)
-- Dependencies: 226
-- Name: audit_trail_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_trail_id_seq OWNED BY public.audit_trail.id;


--
-- TOC entry 308 (class 1259 OID 26213)
-- Name: bc_alerts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bc_alerts (
    id integer NOT NULL,
    business_case_id uuid,
    contract_determination_id integer,
    alert_type character varying(50) NOT NULL,
    severity character varying(20) DEFAULT 'yellow'::character varying NOT NULL,
    message text NOT NULL,
    acknowledged boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at timestamp without time zone,
    acknowledged_by_user_id integer,
    CONSTRAINT bc_alerts_alert_type_check CHECK (((alert_type)::text = ANY ((ARRAY['low_inventory'::character varying, 'product_discontinued'::character varying, 'unusual_consumption'::character varying, 'threshold_exceeded'::character varying])::text[]))),
    CONSTRAINT bc_alerts_severity_check CHECK (((severity)::text = ANY ((ARRAY['yellow'::character varying, 'red'::character varying, 'critical'::character varying])::text[])))
);


ALTER TABLE public.bc_alerts OWNER TO postgres;

--
-- TOC entry 6767 (class 0 OID 0)
-- Dependencies: 308
-- Name: TABLE bc_alerts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_alerts IS 'Alertas automáticas para Business Cases';


--
-- TOC entry 6768 (class 0 OID 0)
-- Dependencies: 308
-- Name: COLUMN bc_alerts.alert_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_alerts.alert_type IS 'Tipo: low_inventory, product_discontinued, unusual_consumption, threshold_exceeded';


--
-- TOC entry 6769 (class 0 OID 0)
-- Dependencies: 308
-- Name: COLUMN bc_alerts.severity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_alerts.severity IS 'Severidad: yellow (30%), red (10%), critical (<5%)';


--
-- TOC entry 307 (class 1259 OID 26212)
-- Name: bc_alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bc_alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bc_alerts_id_seq OWNER TO postgres;

--
-- TOC entry 6770 (class 0 OID 0)
-- Dependencies: 307
-- Name: bc_alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_alerts_id_seq OWNED BY public.bc_alerts.id;


--
-- TOC entry 334 (class 1259 OID 27009)
-- Name: bc_audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bc_audit_log (
    id integer NOT NULL,
    business_case_id uuid NOT NULL,
    action character varying(100) NOT NULL,
    entity_type character varying(50),
    entity_id integer,
    before_value jsonb,
    after_value jsonb,
    changed_by integer,
    changed_at timestamp with time zone DEFAULT now(),
    ip_address character varying(64),
    user_agent text
);


ALTER TABLE public.bc_audit_log OWNER TO postgres;

--
-- TOC entry 6771 (class 0 OID 0)
-- Dependencies: 334
-- Name: TABLE bc_audit_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_audit_log IS 'Registro completo de auditoría de todos los cambios en Business Cases';


--
-- TOC entry 6772 (class 0 OID 0)
-- Dependencies: 334
-- Name: COLUMN bc_audit_log.action; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_audit_log.action IS 'Acción realizada: equipment_selected, determination_added, calculation_run, etc.';


--
-- TOC entry 333 (class 1259 OID 27008)
-- Name: bc_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bc_audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bc_audit_log_id_seq OWNER TO postgres;

--
-- TOC entry 6773 (class 0 OID 0)
-- Dependencies: 333
-- Name: bc_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_audit_log_id_seq OWNED BY public.bc_audit_log.id;


--
-- TOC entry 330 (class 1259 OID 26943)
-- Name: bc_calculations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bc_calculations (
    id integer NOT NULL,
    business_case_id uuid NOT NULL,
    total_monthly_tests integer DEFAULT 0,
    total_reagent_consumption numeric(12,4) DEFAULT 0,
    total_monthly_cost numeric(12,2) DEFAULT 0,
    annual_projection numeric(12,2) DEFAULT 0,
    equipment_utilization_percentage numeric(5,2) DEFAULT 0,
    capacity_exceeded boolean DEFAULT false,
    underutilized boolean DEFAULT false,
    cost_per_test numeric(10,2) DEFAULT 0,
    roi_months integer,
    break_even_date date,
    warnings jsonb DEFAULT '[]'::jsonb,
    recommendations jsonb DEFAULT '[]'::jsonb,
    calculated_at timestamp with time zone DEFAULT now(),
    calculation_version integer DEFAULT 1,
    calculation_engine character varying(50) DEFAULT 'v1.0'::character varying,
    total_annual_tests integer,
    total_annual_cost numeric(12,2),
    equipment_investment numeric(12,2),
    total_investment numeric(12,2),
    monthly_revenue numeric(12,2),
    annual_revenue numeric(12,2),
    monthly_margin numeric(12,2),
    annual_margin numeric(12,2),
    roi_percentage numeric(5,2),
    payback_months integer,
    annual_operating_cost numeric(12,2),
    monthly_operating_cost numeric(12,2)
);


ALTER TABLE public.bc_calculations OWNER TO postgres;

--
-- TOC entry 6774 (class 0 OID 0)
-- Dependencies: 330
-- Name: TABLE bc_calculations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_calculations IS 'Resultados de cálculos para Business Cases (consumo, costos, ROI, etc.)';


--
-- TOC entry 6775 (class 0 OID 0)
-- Dependencies: 330
-- Name: COLUMN bc_calculations.total_monthly_tests; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.total_monthly_tests IS 'Total de pruebas mensuales (BCs públicos)';


--
-- TOC entry 6776 (class 0 OID 0)
-- Dependencies: 330
-- Name: COLUMN bc_calculations.equipment_utilization_percentage; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.equipment_utilization_percentage IS '% de utilización del equipo basado en capacidad máxima';


--
-- TOC entry 6777 (class 0 OID 0)
-- Dependencies: 330
-- Name: COLUMN bc_calculations.warnings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.warnings IS 'Array JSON de advertencias (capacidad excedida, ROI bajo, etc.)';


--
-- TOC entry 6778 (class 0 OID 0)
-- Dependencies: 330
-- Name: COLUMN bc_calculations.recommendations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.recommendations IS 'Array JSON de recomendaciones automáticas';


--
-- TOC entry 6779 (class 0 OID 0)
-- Dependencies: 330
-- Name: COLUMN bc_calculations.calculation_version; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.calculation_version IS 'Versión del cálculo (incrementa con cada recálculo)';


--
-- TOC entry 6780 (class 0 OID 0)
-- Dependencies: 330
-- Name: COLUMN bc_calculations.total_annual_tests; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.total_annual_tests IS 'Total de pruebas anuales (Comodatos)';


--
-- TOC entry 6781 (class 0 OID 0)
-- Dependencies: 330
-- Name: COLUMN bc_calculations.total_annual_cost; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.total_annual_cost IS 'Costo anual total estimado';


--
-- TOC entry 6782 (class 0 OID 0)
-- Dependencies: 330
-- Name: COLUMN bc_calculations.equipment_investment; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.equipment_investment IS 'Inversión directa en equipos';


--
-- TOC entry 6783 (class 0 OID 0)
-- Dependencies: 330
-- Name: COLUMN bc_calculations.total_investment; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.total_investment IS 'Inversión total (equipo + inversiones externas)';


--
-- TOC entry 6784 (class 0 OID 0)
-- Dependencies: 330
-- Name: COLUMN bc_calculations.monthly_revenue; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.monthly_revenue IS 'Ingreso mensual necesario para cubrir costos y margen';


--
-- TOC entry 6785 (class 0 OID 0)
-- Dependencies: 330
-- Name: COLUMN bc_calculations.monthly_margin; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.monthly_margin IS 'Margen mensual neto';


--
-- TOC entry 6786 (class 0 OID 0)
-- Dependencies: 330
-- Name: COLUMN bc_calculations.roi_percentage; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.roi_percentage IS 'ROI proyectado en porcentaje';


--
-- TOC entry 6787 (class 0 OID 0)
-- Dependencies: 330
-- Name: COLUMN bc_calculations.payback_months; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.payback_months IS 'Meses esperados para recuperar la inversión';


--
-- TOC entry 6788 (class 0 OID 0)
-- Dependencies: 330
-- Name: COLUMN bc_calculations.annual_operating_cost; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.annual_operating_cost IS 'Costo operativo anual (incluye inversiones recorrentes)';


--
-- TOC entry 6789 (class 0 OID 0)
-- Dependencies: 330
-- Name: COLUMN bc_calculations.monthly_operating_cost; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.monthly_operating_cost IS 'Costo operativo mensual';


--
-- TOC entry 329 (class 1259 OID 26942)
-- Name: bc_calculations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bc_calculations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bc_calculations_id_seq OWNER TO postgres;

--
-- TOC entry 6790 (class 0 OID 0)
-- Dependencies: 329
-- Name: bc_calculations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_calculations_id_seq OWNED BY public.bc_calculations.id;


--
-- TOC entry 370 (class 1259 OID 27662)
-- Name: bc_deliveries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bc_deliveries (
    id integer NOT NULL,
    business_case_id uuid NOT NULL,
    delivery_type character varying(50),
    effective_determination boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT bc_deliveries_delivery_type_check CHECK (((delivery_type)::text = ANY ((ARRAY['total'::character varying, 'partial_time'::character varying, 'partial_need'::character varying])::text[])))
);


ALTER TABLE public.bc_deliveries OWNER TO postgres;

--
-- TOC entry 6791 (class 0 OID 0)
-- Dependencies: 370
-- Name: TABLE bc_deliveries; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_deliveries IS 'Tipo de entregas del BC';


--
-- TOC entry 6792 (class 0 OID 0)
-- Dependencies: 370
-- Name: COLUMN bc_deliveries.delivery_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_deliveries.delivery_type IS 'Tipo: total, partial_time (parcial a tiempo), partial_need (parcial a necesidad)';


--
-- TOC entry 369 (class 1259 OID 27661)
-- Name: bc_deliveries_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bc_deliveries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bc_deliveries_id_seq OWNER TO postgres;

--
-- TOC entry 6793 (class 0 OID 0)
-- Dependencies: 369
-- Name: bc_deliveries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_deliveries_id_seq OWNED BY public.bc_deliveries.id;


--
-- TOC entry 328 (class 1259 OID 26912)
-- Name: bc_determinations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bc_determinations (
    id integer NOT NULL,
    business_case_id uuid NOT NULL,
    determination_id integer NOT NULL,
    monthly_quantity integer NOT NULL,
    calculated_consumption numeric(12,4),
    calculated_cost numeric(12,2),
    calculation_details jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    added_by integer,
    annual_quantity integer,
    bc_master_id uuid,
    CONSTRAINT bc_determinations_annual_quantity_check CHECK ((annual_quantity > 0)),
    CONSTRAINT bc_determinations_monthly_quantity_check CHECK ((monthly_quantity > 0))
);


ALTER TABLE public.bc_determinations OWNER TO postgres;

--
-- TOC entry 6794 (class 0 OID 0)
-- Dependencies: 328
-- Name: TABLE bc_determinations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_determinations IS 'Determinaciones agregadas a cada Business Case con cantidades mensuales o anuales';


--
-- TOC entry 6795 (class 0 OID 0)
-- Dependencies: 328
-- Name: COLUMN bc_determinations.monthly_quantity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_determinations.monthly_quantity IS 'Cantidad mensual estimada para Business Cases públicos';


--
-- TOC entry 6796 (class 0 OID 0)
-- Dependencies: 328
-- Name: COLUMN bc_determinations.calculated_consumption; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_determinations.calculated_consumption IS 'Consumo calculado de reactivos';


--
-- TOC entry 6797 (class 0 OID 0)
-- Dependencies: 328
-- Name: COLUMN bc_determinations.calculated_cost; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_determinations.calculated_cost IS 'Costo calculado';


--
-- TOC entry 6798 (class 0 OID 0)
-- Dependencies: 328
-- Name: COLUMN bc_determinations.calculation_details; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_determinations.calculation_details IS 'Detalles del cálculo en JSON';


--
-- TOC entry 6799 (class 0 OID 0)
-- Dependencies: 328
-- Name: COLUMN bc_determinations.annual_quantity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_determinations.annual_quantity IS 'Cantidad anual estimada para Business Cases privados/comodatos';


--
-- TOC entry 327 (class 1259 OID 26911)
-- Name: bc_determinations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bc_determinations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bc_determinations_id_seq OWNER TO postgres;

--
-- TOC entry 6800 (class 0 OID 0)
-- Dependencies: 327
-- Name: bc_determinations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_determinations_id_seq OWNED BY public.bc_determinations.id;


--
-- TOC entry 373 (class 1259 OID 28239)
-- Name: bc_economic_data; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bc_economic_data (
    id integer NOT NULL,
    bc_master_id uuid NOT NULL,
    equipment_id integer,
    equipment_name character varying(255),
    equipment_cost numeric(12,2),
    calculation_mode character varying(20) DEFAULT 'annual'::character varying,
    show_roi boolean DEFAULT true,
    show_margin boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT bc_economic_data_calculation_mode_check CHECK (((calculation_mode)::text = ANY ((ARRAY['monthly'::character varying, 'annual'::character varying])::text[])))
);


ALTER TABLE public.bc_economic_data OWNER TO postgres;

--
-- TOC entry 6801 (class 0 OID 0)
-- Dependencies: 373
-- Name: TABLE bc_economic_data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_economic_data IS 'Dominio Economics - Datos económicos del BC';


--
-- TOC entry 372 (class 1259 OID 28238)
-- Name: bc_economic_data_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bc_economic_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bc_economic_data_id_seq OWNER TO postgres;

--
-- TOC entry 6802 (class 0 OID 0)
-- Dependencies: 372
-- Name: bc_economic_data_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_economic_data_id_seq OWNED BY public.bc_economic_data.id;


--
-- TOC entry 362 (class 1259 OID 27574)
-- Name: bc_equipment_details; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bc_equipment_details (
    id integer NOT NULL,
    business_case_id uuid NOT NULL,
    equipment_status character varying(50),
    ownership_status character varying(50),
    reservation_image_url text,
    backup_equipment_name character varying(255),
    backup_status character varying(50),
    backup_manufacture_year integer,
    install_with_primary boolean DEFAULT false,
    installation_location text,
    allows_provisional boolean DEFAULT false,
    requires_complementary boolean DEFAULT false,
    complementary_test_purpose text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT bc_equipment_details_backup_manufacture_year_check CHECK (((backup_manufacture_year >= 1900) AND (backup_manufacture_year <= 2100))),
    CONSTRAINT bc_equipment_details_equipment_status_check CHECK (((equipment_status)::text = ANY ((ARRAY['new'::character varying, 'cu'::character varying])::text[]))),
    CONSTRAINT bc_equipment_details_ownership_status_check CHECK (((ownership_status)::text = ANY ((ARRAY['owned'::character varying, 'rented'::character varying, 'new'::character varying, 'reserved'::character varying, 'fam_series'::character varying])::text[])))
);


ALTER TABLE public.bc_equipment_details OWNER TO postgres;

--
-- TOC entry 6803 (class 0 OID 0)
-- Dependencies: 362
-- Name: TABLE bc_equipment_details; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_equipment_details IS 'Detalles del equipamiento (principal, backup, complementario)';


--
-- TOC entry 6804 (class 0 OID 0)
-- Dependencies: 362
-- Name: COLUMN bc_equipment_details.equipment_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_equipment_details.equipment_status IS 'Estado: new (nuevo) o cu (usado)';


--
-- TOC entry 6805 (class 0 OID 0)
-- Dependencies: 362
-- Name: COLUMN bc_equipment_details.ownership_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_equipment_details.ownership_status IS 'Propiedad: owned, rented, new, reserved, fam_series';


--
-- TOC entry 361 (class 1259 OID 27573)
-- Name: bc_equipment_details_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bc_equipment_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bc_equipment_details_id_seq OWNER TO postgres;

--
-- TOC entry 6806 (class 0 OID 0)
-- Dependencies: 361
-- Name: bc_equipment_details_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_equipment_details_id_seq OWNED BY public.bc_equipment_details.id;


--
-- TOC entry 340 (class 1259 OID 27139)
-- Name: bc_equipment_selection; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bc_equipment_selection (
    id integer NOT NULL,
    business_case_id uuid NOT NULL,
    equipment_id integer NOT NULL,
    is_primary boolean DEFAULT true,
    selected_at timestamp with time zone DEFAULT now(),
    selected_by integer,
    quantity integer DEFAULT 1,
    notes text,
    CONSTRAINT bc_equipment_selection_quantity_check CHECK ((quantity > 0))
);


ALTER TABLE public.bc_equipment_selection OWNER TO postgres;

--
-- TOC entry 6807 (class 0 OID 0)
-- Dependencies: 340
-- Name: TABLE bc_equipment_selection; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_equipment_selection IS 'Equipos seleccionados para cada Business Case';


--
-- TOC entry 6808 (class 0 OID 0)
-- Dependencies: 340
-- Name: COLUMN bc_equipment_selection.is_primary; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_equipment_selection.is_primary IS 'Equipo principal del BC (solo uno por BC)';


--
-- TOC entry 6809 (class 0 OID 0)
-- Dependencies: 340
-- Name: COLUMN bc_equipment_selection.quantity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_equipment_selection.quantity IS 'Cantidad de unidades seleccionadas del equipo principal';


--
-- TOC entry 6810 (class 0 OID 0)
-- Dependencies: 340
-- Name: COLUMN bc_equipment_selection.notes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_equipment_selection.notes IS 'Notas adicionales sobre la selección del equipo';


--
-- TOC entry 339 (class 1259 OID 27138)
-- Name: bc_equipment_selection_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bc_equipment_selection_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bc_equipment_selection_id_seq OWNER TO postgres;

--
-- TOC entry 6811 (class 0 OID 0)
-- Dependencies: 339
-- Name: bc_equipment_selection_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_equipment_selection_id_seq OWNED BY public.bc_equipment_selection.id;


--
-- TOC entry 354 (class 1259 OID 27501)
-- Name: bc_investments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bc_investments (
    id integer NOT NULL,
    business_case_id uuid NOT NULL,
    concept character varying(255) NOT NULL,
    amount numeric(12,2) NOT NULL,
    investment_type character varying(50) NOT NULL,
    category character varying(100),
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    bc_master_id uuid,
    CONSTRAINT bc_investments_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT bc_investments_category_check CHECK (((category)::text = ANY ((ARRAY['installation'::character varying, 'training'::character varying, 'transport'::character varying, 'maintenance'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT bc_investments_investment_type_check CHECK (((investment_type)::text = ANY ((ARRAY['one_time'::character varying, 'recurring_monthly'::character varying, 'recurring_annual'::character varying])::text[])))
);


ALTER TABLE public.bc_investments OWNER TO postgres;

--
-- TOC entry 6812 (class 0 OID 0)
-- Dependencies: 354
-- Name: TABLE bc_investments; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_investments IS 'Inversiones adicionales asociadas a un Business Case moderno';


--
-- TOC entry 6813 (class 0 OID 0)
-- Dependencies: 354
-- Name: COLUMN bc_investments.amount; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_investments.amount IS 'Monto de la inversión';


--
-- TOC entry 6814 (class 0 OID 0)
-- Dependencies: 354
-- Name: COLUMN bc_investments.investment_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_investments.investment_type IS 'Tipo de inversión: one_time, recurring_monthly o recurring_annual';


--
-- TOC entry 6815 (class 0 OID 0)
-- Dependencies: 354
-- Name: COLUMN bc_investments.category; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_investments.category IS 'Categoría sugerida: installation, training, transport, maintenance, other';


--
-- TOC entry 353 (class 1259 OID 27500)
-- Name: bc_investments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bc_investments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bc_investments_id_seq OWNER TO postgres;

--
-- TOC entry 6816 (class 0 OID 0)
-- Dependencies: 353
-- Name: bc_investments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_investments_id_seq OWNED BY public.bc_investments.id;


--
-- TOC entry 360 (class 1259 OID 27549)
-- Name: bc_lab_environment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bc_lab_environment (
    id integer NOT NULL,
    business_case_id uuid NOT NULL,
    work_days_per_week integer,
    shifts_per_day integer,
    hours_per_shift numeric(4,2),
    quality_controls_per_shift integer,
    control_levels integer,
    routine_qc_frequency character varying(100),
    special_tests text,
    special_qc_frequency character varying(100),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT bc_lab_environment_control_levels_check CHECK ((control_levels >= 0)),
    CONSTRAINT bc_lab_environment_hours_per_shift_check CHECK ((hours_per_shift > (0)::numeric)),
    CONSTRAINT bc_lab_environment_quality_controls_per_shift_check CHECK ((quality_controls_per_shift >= 0)),
    CONSTRAINT bc_lab_environment_shifts_per_day_check CHECK ((shifts_per_day >= 1)),
    CONSTRAINT bc_lab_environment_work_days_per_week_check CHECK (((work_days_per_week >= 1) AND (work_days_per_week <= 7)))
);


ALTER TABLE public.bc_lab_environment OWNER TO postgres;

--
-- TOC entry 6817 (class 0 OID 0)
-- Dependencies: 360
-- Name: TABLE bc_lab_environment; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_lab_environment IS 'Ambiente de laboratorio del cliente';


--
-- TOC entry 359 (class 1259 OID 27548)
-- Name: bc_lab_environment_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bc_lab_environment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bc_lab_environment_id_seq OWNER TO postgres;

--
-- TOC entry 6818 (class 0 OID 0)
-- Dependencies: 359
-- Name: bc_lab_environment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_lab_environment_id_seq OWNED BY public.bc_lab_environment.id;


--
-- TOC entry 377 (class 1259 OID 28308)
-- Name: bc_lis_data; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bc_lis_data (
    id integer NOT NULL,
    bc_master_id uuid NOT NULL,
    includes_lis boolean DEFAULT false,
    lis_provider character varying(100),
    includes_hardware boolean DEFAULT false,
    monthly_patients integer,
    current_system_name character varying(255),
    current_system_provider character varying(255),
    current_system_hardware boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT bc_lis_data_lis_provider_check CHECK (((lis_provider)::text = ANY ((ARRAY['orion'::character varying, 'cobas_infiniti'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT bc_lis_data_monthly_patients_check CHECK ((monthly_patients >= 0))
);


ALTER TABLE public.bc_lis_data OWNER TO postgres;

--
-- TOC entry 6819 (class 0 OID 0)
-- Dependencies: 377
-- Name: TABLE bc_lis_data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_lis_data IS 'Dominio LIS - Integración con sistemas de información de laboratorio';


--
-- TOC entry 376 (class 1259 OID 28307)
-- Name: bc_lis_data_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bc_lis_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bc_lis_data_id_seq OWNER TO postgres;

--
-- TOC entry 6820 (class 0 OID 0)
-- Dependencies: 376
-- Name: bc_lis_data_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_lis_data_id_seq OWNED BY public.bc_lis_data.id;


--
-- TOC entry 366 (class 1259 OID 27625)
-- Name: bc_lis_equipment_interfaces; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bc_lis_equipment_interfaces (
    id integer NOT NULL,
    bc_lis_data_id integer CONSTRAINT bc_lis_equipment_interfaces_lis_integration_id_not_null NOT NULL,
    model character varying(255),
    provider character varying(255),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.bc_lis_equipment_interfaces OWNER TO postgres;

--
-- TOC entry 6821 (class 0 OID 0)
-- Dependencies: 366
-- Name: TABLE bc_lis_equipment_interfaces; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_lis_equipment_interfaces IS 'Interfaces de equipos para integración LIS';


--
-- TOC entry 365 (class 1259 OID 27624)
-- Name: bc_lis_equipment_interfaces_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bc_lis_equipment_interfaces_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bc_lis_equipment_interfaces_id_seq OWNER TO postgres;

--
-- TOC entry 6822 (class 0 OID 0)
-- Dependencies: 365
-- Name: bc_lis_equipment_interfaces_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_lis_equipment_interfaces_id_seq OWNED BY public.bc_lis_equipment_interfaces.id;


--
-- TOC entry 364 (class 1259 OID 27600)
-- Name: bc_lis_integration; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bc_lis_integration (
    id integer NOT NULL,
    business_case_id uuid NOT NULL,
    includes_lis boolean DEFAULT false,
    lis_provider character varying(100),
    includes_hardware boolean DEFAULT false,
    monthly_patients integer,
    current_system_name character varying(255),
    current_system_provider character varying(255),
    current_system_hardware boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT bc_lis_integration_lis_provider_check CHECK (((lis_provider)::text = ANY ((ARRAY['orion'::character varying, 'cobas_infiniti'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT bc_lis_integration_monthly_patients_check CHECK ((monthly_patients >= 0))
);


ALTER TABLE public.bc_lis_integration OWNER TO postgres;

--
-- TOC entry 6823 (class 0 OID 0)
-- Dependencies: 364
-- Name: TABLE bc_lis_integration; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_lis_integration IS 'Integración con sistema LIS';


--
-- TOC entry 6824 (class 0 OID 0)
-- Dependencies: 364
-- Name: COLUMN bc_lis_integration.lis_provider; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_lis_integration.lis_provider IS 'Proveedor LIS: orion, cobas_infiniti, other';


--
-- TOC entry 363 (class 1259 OID 27599)
-- Name: bc_lis_integration_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bc_lis_integration_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bc_lis_integration_id_seq OWNER TO postgres;

--
-- TOC entry 6825 (class 0 OID 0)
-- Dependencies: 363
-- Name: bc_lis_integration_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_lis_integration_id_seq OWNED BY public.bc_lis_integration.id;


--
-- TOC entry 371 (class 1259 OID 28214)
-- Name: bc_master; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bc_master (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    bc_number character varying(50),
    client_id integer,
    client_name character varying(255),
    bc_type character varying(50),
    duration_years integer,
    target_margin_percentage numeric(5,2),
    process_code character varying(255),
    contract_object text,
    current_stage character varying(50) DEFAULT 'draft'::character varying,
    economic_data_complete boolean DEFAULT false,
    operational_data_complete boolean DEFAULT false,
    lis_data_complete boolean DEFAULT false,
    delivery_plan_complete boolean DEFAULT false,
    calculated_roi_percentage numeric(10,2),
    calculated_payback_months numeric(10,2),
    calculated_monthly_margin numeric(12,2),
    calculated_annual_margin numeric(12,2),
    calculated_monthly_revenue numeric(12,2),
    calculated_annual_revenue numeric(12,2),
    calculated_monthly_cost numeric(12,2),
    calculated_annual_cost numeric(12,2),
    total_investment numeric(12,2),
    equipment_investment numeric(12,2),
    has_inconsistencies boolean DEFAULT false,
    inconsistency_details jsonb,
    risk_level character varying(20),
    created_by character varying(255),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    approved_by character varying(255),
    approved_at timestamp without time zone,
    rejected_by character varying(255),
    rejected_at timestamp without time zone,
    rejection_reason text,
    CONSTRAINT bc_master_bc_type_check CHECK (((bc_type)::text = ANY ((ARRAY['comodato_publico'::character varying, 'comodato_privado'::character varying])::text[]))),
    CONSTRAINT bc_master_current_stage_check CHECK (((current_stage)::text = ANY ((ARRAY['draft'::character varying, 'pending_economic_approval'::character varying, 'pending_operational_data'::character varying, 'pending_recalculation'::character varying, 'pending_technical_review'::character varying, 'pending_manager_approval'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT bc_master_duration_years_check CHECK (((duration_years >= 1) AND (duration_years <= 10))),
    CONSTRAINT bc_master_risk_level_check CHECK (((risk_level)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying])::text[]))),
    CONSTRAINT bc_master_target_margin_percentage_check CHECK (((target_margin_percentage >= (0)::numeric) AND (target_margin_percentage <= (100)::numeric)))
);


ALTER TABLE public.bc_master OWNER TO postgres;

--
-- TOC entry 6826 (class 0 OID 0)
-- Dependencies: 371
-- Name: TABLE bc_master; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_master IS 'Tabla central del Business Case unificado - Orquesta todos los módulos';


--
-- TOC entry 6827 (class 0 OID 0)
-- Dependencies: 371
-- Name: COLUMN bc_master.bc_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_master.bc_number IS 'Número único del BC (ej: BC-2024-001)';


--
-- TOC entry 6828 (class 0 OID 0)
-- Dependencies: 371
-- Name: COLUMN bc_master.current_stage; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_master.current_stage IS 'Estado actual en el workflow del BC';


--
-- TOC entry 6829 (class 0 OID 0)
-- Dependencies: 371
-- Name: COLUMN bc_master.risk_level; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_master.risk_level IS 'Nivel de riesgo calculado: low, medium, high';


--
-- TOC entry 382 (class 1259 OID 28383)
-- Name: bc_number_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bc_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bc_number_seq OWNER TO postgres;

--
-- TOC entry 375 (class 1259 OID 28273)
-- Name: bc_operational_data; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bc_operational_data (
    id integer NOT NULL,
    bc_master_id uuid NOT NULL,
    work_days_per_week integer,
    shifts_per_day integer,
    hours_per_shift numeric(4,2),
    quality_controls_per_shift integer,
    control_levels integer,
    routine_qc_frequency character varying(100),
    special_tests text,
    special_qc_frequency character varying(100),
    equipment_status character varying(50),
    ownership_status character varying(50),
    reservation_image_url text,
    backup_equipment_name character varying(255),
    backup_status character varying(50),
    backup_manufacture_year integer,
    install_with_primary boolean DEFAULT false,
    installation_location text,
    allows_provisional boolean DEFAULT false,
    requires_complementary boolean DEFAULT false,
    complementary_test_purpose text,
    deadline_months integer,
    projected_deadline_months integer,
    delivery_type character varying(50),
    effective_determination boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT bc_operational_data_backup_manufacture_year_check CHECK (((backup_manufacture_year >= 1900) AND (backup_manufacture_year <= 2100))),
    CONSTRAINT bc_operational_data_control_levels_check CHECK ((control_levels >= 0)),
    CONSTRAINT bc_operational_data_deadline_months_check CHECK ((deadline_months > 0)),
    CONSTRAINT bc_operational_data_delivery_type_check CHECK (((delivery_type)::text = ANY ((ARRAY['total'::character varying, 'partial_time'::character varying, 'partial_need'::character varying])::text[]))),
    CONSTRAINT bc_operational_data_equipment_status_check CHECK (((equipment_status)::text = ANY ((ARRAY['new'::character varying, 'cu'::character varying])::text[]))),
    CONSTRAINT bc_operational_data_hours_per_shift_check CHECK ((hours_per_shift > (0)::numeric)),
    CONSTRAINT bc_operational_data_ownership_status_check CHECK (((ownership_status)::text = ANY ((ARRAY['owned'::character varying, 'rented'::character varying, 'new'::character varying, 'reserved'::character varying, 'fam_series'::character varying])::text[]))),
    CONSTRAINT bc_operational_data_projected_deadline_months_check CHECK ((projected_deadline_months > 0)),
    CONSTRAINT bc_operational_data_quality_controls_per_shift_check CHECK ((quality_controls_per_shift >= 0)),
    CONSTRAINT bc_operational_data_shifts_per_day_check CHECK ((shifts_per_day >= 1)),
    CONSTRAINT bc_operational_data_work_days_per_week_check CHECK (((work_days_per_week >= 1) AND (work_days_per_week <= 7)))
);


ALTER TABLE public.bc_operational_data OWNER TO postgres;

--
-- TOC entry 6830 (class 0 OID 0)
-- Dependencies: 375
-- Name: TABLE bc_operational_data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_operational_data IS 'Dominio Operations - Datos operativos del cliente (ambiente + equipamiento + requerimientos + entregas)';


--
-- TOC entry 374 (class 1259 OID 28272)
-- Name: bc_operational_data_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bc_operational_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bc_operational_data_id_seq OWNER TO postgres;

--
-- TOC entry 6831 (class 0 OID 0)
-- Dependencies: 374
-- Name: bc_operational_data_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_operational_data_id_seq OWNED BY public.bc_operational_data.id;


--
-- TOC entry 368 (class 1259 OID 27642)
-- Name: bc_requirements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bc_requirements (
    id integer NOT NULL,
    business_case_id uuid NOT NULL,
    deadline_months integer,
    projected_deadline_months integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT bc_requirements_deadline_months_check CHECK ((deadline_months > 0)),
    CONSTRAINT bc_requirements_projected_deadline_months_check CHECK ((projected_deadline_months > 0))
);


ALTER TABLE public.bc_requirements OWNER TO postgres;

--
-- TOC entry 6832 (class 0 OID 0)
-- Dependencies: 368
-- Name: TABLE bc_requirements; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_requirements IS 'Requerimientos y plazos del BC';


--
-- TOC entry 367 (class 1259 OID 27641)
-- Name: bc_requirements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bc_requirements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bc_requirements_id_seq OWNER TO postgres;

--
-- TOC entry 6833 (class 0 OID 0)
-- Dependencies: 367
-- Name: bc_requirements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_requirements_id_seq OWNED BY public.bc_requirements.id;


--
-- TOC entry 381 (class 1259 OID 28350)
-- Name: bc_validations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bc_validations (
    id integer NOT NULL,
    bc_master_id uuid NOT NULL,
    validation_type character varying(50),
    severity character varying(20),
    message text,
    details jsonb,
    resolved boolean DEFAULT false,
    resolved_at timestamp without time zone,
    resolved_by character varying(255),
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT bc_validations_severity_check CHECK (((severity)::text = ANY ((ARRAY['info'::character varying, 'warning'::character varying, 'error'::character varying])::text[])))
);


ALTER TABLE public.bc_validations OWNER TO postgres;

--
-- TOC entry 6834 (class 0 OID 0)
-- Dependencies: 381
-- Name: TABLE bc_validations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_validations IS 'Validaciones y alertas del BC';


--
-- TOC entry 380 (class 1259 OID 28349)
-- Name: bc_validations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bc_validations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bc_validations_id_seq OWNER TO postgres;

--
-- TOC entry 6835 (class 0 OID 0)
-- Dependencies: 380
-- Name: bc_validations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_validations_id_seq OWNED BY public.bc_validations.id;


--
-- TOC entry 379 (class 1259 OID 28333)
-- Name: bc_workflow_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bc_workflow_history (
    id integer NOT NULL,
    bc_master_id uuid NOT NULL,
    from_stage character varying(50),
    to_stage character varying(50),
    changed_by character varying(255),
    changed_at timestamp without time zone DEFAULT now(),
    notes text
);


ALTER TABLE public.bc_workflow_history OWNER TO postgres;

--
-- TOC entry 6836 (class 0 OID 0)
-- Dependencies: 379
-- Name: TABLE bc_workflow_history; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_workflow_history IS 'Historial de cambios de estado del BC';


--
-- TOC entry 378 (class 1259 OID 28332)
-- Name: bc_workflow_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bc_workflow_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bc_workflow_history_id_seq OWNER TO postgres;

--
-- TOC entry 6837 (class 0 OID 0)
-- Dependencies: 378
-- Name: bc_workflow_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_workflow_history_id_seq OWNED BY public.bc_workflow_history.id;


--
-- TOC entry 420 (class 1259 OID 28960)
-- Name: business_case_section_ownership; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.business_case_section_ownership (
    id integer NOT NULL,
    business_case_id uuid NOT NULL,
    section_name character varying(50) NOT NULL,
    completed_by uuid,
    completed_by_role character varying(50),
    completed_at timestamp with time zone,
    canonical_state character varying(50),
    first_completed_by uuid,
    first_completed_at timestamp with time zone,
    completion_count integer DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.business_case_section_ownership OWNER TO postgres;

--
-- TOC entry 6838 (class 0 OID 0)
-- Dependencies: 420
-- Name: TABLE business_case_section_ownership; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.business_case_section_ownership IS 'Tracks who completed each section of a business case and when';


--
-- TOC entry 6839 (class 0 OID 0)
-- Dependencies: 420
-- Name: COLUMN business_case_section_ownership.business_case_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.business_case_section_ownership.business_case_id IS 'Reference to the business case';


--
-- TOC entry 6840 (class 0 OID 0)
-- Dependencies: 420
-- Name: COLUMN business_case_section_ownership.section_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.business_case_section_ownership.section_name IS 'Name of the section (general, equipment, etc.)';


--
-- TOC entry 6841 (class 0 OID 0)
-- Dependencies: 420
-- Name: COLUMN business_case_section_ownership.completed_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.business_case_section_ownership.completed_by IS 'User who last completed this section';


--
-- TOC entry 6842 (class 0 OID 0)
-- Dependencies: 420
-- Name: COLUMN business_case_section_ownership.completed_by_role; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.business_case_section_ownership.completed_by_role IS 'Role of the user who last completed this section';


--
-- TOC entry 6843 (class 0 OID 0)
-- Dependencies: 420
-- Name: COLUMN business_case_section_ownership.completed_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.business_case_section_ownership.completed_at IS 'When this section was last completed';


--
-- TOC entry 6844 (class 0 OID 0)
-- Dependencies: 420
-- Name: COLUMN business_case_section_ownership.canonical_state; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.business_case_section_ownership.canonical_state IS 'Business case state when section was completed';


--
-- TOC entry 6845 (class 0 OID 0)
-- Dependencies: 420
-- Name: COLUMN business_case_section_ownership.first_completed_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.business_case_section_ownership.first_completed_by IS 'User who first completed this section';


--
-- TOC entry 6846 (class 0 OID 0)
-- Dependencies: 420
-- Name: COLUMN business_case_section_ownership.first_completed_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.business_case_section_ownership.first_completed_at IS 'When this section was first completed';


--
-- TOC entry 6847 (class 0 OID 0)
-- Dependencies: 420
-- Name: COLUMN business_case_section_ownership.completion_count; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.business_case_section_ownership.completion_count IS 'How many times this section has been completed/modified';


--
-- TOC entry 422 (class 1259 OID 28983)
-- Name: business_case_section_ownership_audit; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.business_case_section_ownership_audit (
    id integer NOT NULL,
    business_case_id uuid NOT NULL,
    section_name character varying(50) NOT NULL,
    action character varying(50) NOT NULL,
    performed_by uuid NOT NULL,
    performed_by_role character varying(50),
    canonical_state character varying(50),
    metadata jsonb DEFAULT '{}'::jsonb,
    performed_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.business_case_section_ownership_audit OWNER TO postgres;

--
-- TOC entry 6848 (class 0 OID 0)
-- Dependencies: 422
-- Name: TABLE business_case_section_ownership_audit; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.business_case_section_ownership_audit IS 'Audit trail for all section ownership changes';


--
-- TOC entry 6849 (class 0 OID 0)
-- Dependencies: 422
-- Name: COLUMN business_case_section_ownership_audit.action; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.business_case_section_ownership_audit.action IS 'Type of action performed (completed, corrected, locked)';


--
-- TOC entry 6850 (class 0 OID 0)
-- Dependencies: 422
-- Name: COLUMN business_case_section_ownership_audit.performed_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.business_case_section_ownership_audit.performed_by IS 'User who performed the action';


--
-- TOC entry 6851 (class 0 OID 0)
-- Dependencies: 422
-- Name: COLUMN business_case_section_ownership_audit.performed_by_role; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.business_case_section_ownership_audit.performed_by_role IS 'Role of the user who performed the action';


--
-- TOC entry 6852 (class 0 OID 0)
-- Dependencies: 422
-- Name: COLUMN business_case_section_ownership_audit.canonical_state; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.business_case_section_ownership_audit.canonical_state IS 'Business case state when action was performed';


--
-- TOC entry 421 (class 1259 OID 28982)
-- Name: business_case_section_ownership_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.business_case_section_ownership_audit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.business_case_section_ownership_audit_id_seq OWNER TO postgres;

--
-- TOC entry 6853 (class 0 OID 0)
-- Dependencies: 421
-- Name: business_case_section_ownership_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.business_case_section_ownership_audit_id_seq OWNED BY public.business_case_section_ownership_audit.id;


--
-- TOC entry 419 (class 1259 OID 28959)
-- Name: business_case_section_ownership_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.business_case_section_ownership_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.business_case_section_ownership_id_seq OWNER TO postgres;

--
-- TOC entry 6854 (class 0 OID 0)
-- Dependencies: 419
-- Name: business_case_section_ownership_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.business_case_section_ownership_id_seq OWNED BY public.business_case_section_ownership.id;


--
-- TOC entry 418 (class 1259 OID 28942)
-- Name: business_case_state_transitions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.business_case_state_transitions (
    id integer NOT NULL,
    business_case_id uuid NOT NULL,
    from_state character varying(50),
    to_state character varying(50) NOT NULL,
    transition_reason text,
    transitioned_by uuid,
    transitioned_at timestamp with time zone DEFAULT now(),
    metadata jsonb
);


ALTER TABLE public.business_case_state_transitions OWNER TO postgres;

--
-- TOC entry 417 (class 1259 OID 28941)
-- Name: business_case_state_transitions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.business_case_state_transitions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.business_case_state_transitions_id_seq OWNER TO postgres;

--
-- TOC entry 6855 (class 0 OID 0)
-- Dependencies: 417
-- Name: business_case_state_transitions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.business_case_state_transitions_id_seq OWNED BY public.business_case_state_transitions.id;


--
-- TOC entry 337 (class 1259 OID 27049)
-- Name: calculation_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.calculation_templates (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    formula jsonb NOT NULL,
    category character varying(100),
    required_variables jsonb DEFAULT '[]'::jsonb,
    example_input jsonb,
    example_output numeric(12,4),
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    version character varying(10) DEFAULT '1.0'::character varying,
    is_active boolean DEFAULT true
);


ALTER TABLE public.calculation_templates OWNER TO postgres;

--
-- TOC entry 6856 (class 0 OID 0)
-- Dependencies: 337
-- Name: TABLE calculation_templates; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.calculation_templates IS 'Plantillas reutilizables de fórmulas de cálculo';


--
-- TOC entry 6857 (class 0 OID 0)
-- Dependencies: 337
-- Name: COLUMN calculation_templates.formula; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.calculation_templates.formula IS 'Fórmula en formato JSON {type, expression, variables}';


--
-- TOC entry 6858 (class 0 OID 0)
-- Dependencies: 337
-- Name: COLUMN calculation_templates.required_variables; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.calculation_templates.required_variables IS 'Array JSON con nombres de variables obligatorias';


--
-- TOC entry 336 (class 1259 OID 27048)
-- Name: calculation_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.calculation_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.calculation_templates_id_seq OWNER TO postgres;

--
-- TOC entry 6859 (class 0 OID 0)
-- Dependencies: 336
-- Name: calculation_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.calculation_templates_id_seq OWNED BY public.calculation_templates.id;


--
-- TOC entry 300 (class 1259 OID 26094)
-- Name: catalog_consumables; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.catalog_consumables (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(50),
    units_per_kit integer,
    unit_price numeric(10,2),
    version character varying(100),
    status character varying(50) DEFAULT 'active'::character varying,
    replaced_by_id integer,
    valid_from date DEFAULT CURRENT_DATE NOT NULL,
    valid_to date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    performance jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    yield_per_unit integer,
    reorder_point integer,
    lead_time_days integer,
    supplier character varying(255),
    supplier_code character varying(100),
    CONSTRAINT catalog_consumables_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'discontinuado'::character varying])::text[]))),
    CONSTRAINT catalog_consumables_type_check CHECK (((type)::text = ANY ((ARRAY['reactivo'::character varying, 'calibrador'::character varying, 'control'::character varying, 'diluyente'::character varying, 'material'::character varying])::text[])))
);


ALTER TABLE public.catalog_consumables OWNER TO postgres;

--
-- TOC entry 6860 (class 0 OID 0)
-- Dependencies: 300
-- Name: TABLE catalog_consumables; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.catalog_consumables IS 'Catálogo de consumibles (reactivos, calibradores, controles)';


--
-- TOC entry 6861 (class 0 OID 0)
-- Dependencies: 300
-- Name: COLUMN catalog_consumables.units_per_kit; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_consumables.units_per_kit IS 'Unidades/determinaciones por kit';


--
-- TOC entry 6862 (class 0 OID 0)
-- Dependencies: 300
-- Name: COLUMN catalog_consumables.performance; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_consumables.performance IS 'Rendimiento por determinación en formato JSON';


--
-- TOC entry 6863 (class 0 OID 0)
-- Dependencies: 300
-- Name: COLUMN catalog_consumables.yield_per_unit; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_consumables.yield_per_unit IS 'Número de determinaciones que rinde una unidad de consumible';


--
-- TOC entry 6864 (class 0 OID 0)
-- Dependencies: 300
-- Name: COLUMN catalog_consumables.reorder_point; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_consumables.reorder_point IS 'Punto de reorden para inventario';


--
-- TOC entry 299 (class 1259 OID 26093)
-- Name: catalog_consumables_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.catalog_consumables_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.catalog_consumables_id_seq OWNER TO postgres;

--
-- TOC entry 6865 (class 0 OID 0)
-- Dependencies: 299
-- Name: catalog_consumables_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.catalog_consumables_id_seq OWNED BY public.catalog_consumables.id;


--
-- TOC entry 298 (class 1259 OID 26061)
-- Name: catalog_determinations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.catalog_determinations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    roche_code character varying(100),
    category character varying(100),
    equipment_id integer,
    version character varying(100),
    status character varying(50) DEFAULT 'active'::character varying,
    replaced_by_id integer,
    valid_from date DEFAULT CURRENT_DATE NOT NULL,
    valid_to date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    metadata jsonb DEFAULT '{}'::jsonb,
    volume_per_test numeric(10,4),
    reagent_consumption numeric(10,4),
    processing_time integer,
    wash_cycles integer DEFAULT 0,
    blank_required boolean DEFAULT false,
    calibration_frequency integer,
    cost_per_test numeric(10,2),
    subcategory character varying(100),
    calculation_formula jsonb,
    formula_version character varying(10) DEFAULT '1.0'::character varying,
    formula_type character varying(50) DEFAULT 'default'::character varying,
    CONSTRAINT catalog_determinations_formula_type_check CHECK (((formula_type)::text = ANY ((ARRAY['default'::character varying, 'custom'::character varying, 'template'::character varying])::text[]))),
    CONSTRAINT catalog_determinations_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'discontinuado'::character varying])::text[])))
);


ALTER TABLE public.catalog_determinations OWNER TO postgres;

--
-- TOC entry 6866 (class 0 OID 0)
-- Dependencies: 298
-- Name: TABLE catalog_determinations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.catalog_determinations IS 'Catálogo de determinaciones médicas con versionamiento';


--
-- TOC entry 6867 (class 0 OID 0)
-- Dependencies: 298
-- Name: COLUMN catalog_determinations.valid_from; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_determinations.valid_from IS 'Fecha desde la cual esta versión es válida';


--
-- TOC entry 6868 (class 0 OID 0)
-- Dependencies: 298
-- Name: COLUMN catalog_determinations.valid_to; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_determinations.valid_to IS 'Fecha hasta la cual esta versión es válida (NULL si aún vigente)';


--
-- TOC entry 6869 (class 0 OID 0)
-- Dependencies: 298
-- Name: COLUMN catalog_determinations.volume_per_test; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_determinations.volume_per_test IS 'Volumen de muestra requerido por prueba en mL';


--
-- TOC entry 6870 (class 0 OID 0)
-- Dependencies: 298
-- Name: COLUMN catalog_determinations.reagent_consumption; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_determinations.reagent_consumption IS 'Consumo de reactivo por prueba en mL - reemplaza fórmulas Excel';


--
-- TOC entry 6871 (class 0 OID 0)
-- Dependencies: 298
-- Name: COLUMN catalog_determinations.processing_time; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_determinations.processing_time IS 'Tiempo de procesamiento en segundos';


--
-- TOC entry 6872 (class 0 OID 0)
-- Dependencies: 298
-- Name: COLUMN catalog_determinations.cost_per_test; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_determinations.cost_per_test IS 'Costo directo por prueba calculado';


--
-- TOC entry 6873 (class 0 OID 0)
-- Dependencies: 298
-- Name: COLUMN catalog_determinations.calculation_formula; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_determinations.calculation_formula IS 'Fórmula personalizada de cálculo en formato JSON';


--
-- TOC entry 6874 (class 0 OID 0)
-- Dependencies: 298
-- Name: COLUMN catalog_determinations.formula_version; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_determinations.formula_version IS 'Versión de la fórmula para control de cambios';


--
-- TOC entry 6875 (class 0 OID 0)
-- Dependencies: 298
-- Name: COLUMN catalog_determinations.formula_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_determinations.formula_type IS 'default=fórmula estándar, custom=personalizada, template=basada en plantilla';


--
-- TOC entry 297 (class 1259 OID 26060)
-- Name: catalog_determinations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.catalog_determinations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.catalog_determinations_id_seq OWNER TO postgres;

--
-- TOC entry 6876 (class 0 OID 0)
-- Dependencies: 297
-- Name: catalog_determinations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.catalog_determinations_id_seq OWNED BY public.catalog_determinations.id;


--
-- TOC entry 302 (class 1259 OID 26122)
-- Name: catalog_equipment_consumables; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.catalog_equipment_consumables (
    id integer NOT NULL,
    equipment_id integer,
    consumable_id integer,
    determination_id integer,
    consumption_rate numeric(10,4) DEFAULT 1.0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.catalog_equipment_consumables OWNER TO postgres;

--
-- TOC entry 6877 (class 0 OID 0)
-- Dependencies: 302
-- Name: TABLE catalog_equipment_consumables; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.catalog_equipment_consumables IS 'Relación entre equipos, determinaciones y sus consumibles';


--
-- TOC entry 6878 (class 0 OID 0)
-- Dependencies: 302
-- Name: COLUMN catalog_equipment_consumables.consumption_rate; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_equipment_consumables.consumption_rate IS 'Tasa de consumo del consumible por determinación';


--
-- TOC entry 301 (class 1259 OID 26121)
-- Name: catalog_equipment_consumables_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.catalog_equipment_consumables_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.catalog_equipment_consumables_id_seq OWNER TO postgres;

--
-- TOC entry 6879 (class 0 OID 0)
-- Dependencies: 301
-- Name: catalog_equipment_consumables_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.catalog_equipment_consumables_id_seq OWNED BY public.catalog_equipment_consumables.id;


--
-- TOC entry 310 (class 1259 OID 26246)
-- Name: catalog_investments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.catalog_investments (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    category character varying(100),
    subcategory character varying(100),
    suggested_price numeric(10,2),
    suggested_quantity integer DEFAULT 1,
    requires_lis boolean DEFAULT false,
    requires_equipment boolean DEFAULT false,
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT catalog_investments_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'discontinued'::character varying])::text[])))
);


ALTER TABLE public.catalog_investments OWNER TO postgres;

--
-- TOC entry 6880 (class 0 OID 0)
-- Dependencies: 310
-- Name: TABLE catalog_investments; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.catalog_investments IS 'Catálogo de inversiones adicionales para sugerir automáticamente';


--
-- TOC entry 6881 (class 0 OID 0)
-- Dependencies: 310
-- Name: COLUMN catalog_investments.requires_lis; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_investments.requires_lis IS 'TRUE si esta inversión es recomendada cuando se incluye LIS';


--
-- TOC entry 6882 (class 0 OID 0)
-- Dependencies: 310
-- Name: COLUMN catalog_investments.requires_equipment; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_investments.requires_equipment IS 'TRUE si esta inversión es recomendada con equipo principal';


--
-- TOC entry 309 (class 1259 OID 26245)
-- Name: catalog_investments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.catalog_investments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.catalog_investments_id_seq OWNER TO postgres;

--
-- TOC entry 6883 (class 0 OID 0)
-- Dependencies: 309
-- Name: catalog_investments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.catalog_investments_id_seq OWNED BY public.catalog_investments.id;


--
-- TOC entry 294 (class 1259 OID 25715)
-- Name: client_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_assignments (
    id integer NOT NULL,
    client_request_id integer NOT NULL,
    assigned_to_email text NOT NULL,
    assigned_by_email text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.client_assignments OWNER TO postgres;

--
-- TOC entry 293 (class 1259 OID 25714)
-- Name: client_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.client_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.client_assignments_id_seq OWNER TO postgres;

--
-- TOC entry 6884 (class 0 OID 0)
-- Dependencies: 293
-- Name: client_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.client_assignments_id_seq OWNED BY public.client_assignments.id;


--
-- TOC entry 272 (class 1259 OID 17130)
-- Name: client_request_consent_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_request_consent_tokens (
    id character varying(64) NOT NULL,
    client_email character varying(255) NOT NULL,
    client_name character varying(255),
    code_hash character varying(255) NOT NULL,
    code_last_four character varying(4),
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    verified_at timestamp without time zone,
    verified_by_email character varying(255),
    verified_by_user_id integer,
    created_by_email character varying(255),
    created_by_user_id integer,
    used_at timestamp without time zone,
    used_request_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.client_request_consent_tokens OWNER TO postgres;

--
-- TOC entry 271 (class 1259 OID 17112)
-- Name: client_request_consents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_request_consents (
    id integer NOT NULL,
    client_request_id integer NOT NULL,
    event_type character varying(50) NOT NULL,
    method character varying(50) NOT NULL,
    details text,
    evidence_file_id character varying(255),
    actor_email character varying(255),
    actor_role character varying(100),
    actor_name character varying(255),
    ip character varying(64),
    user_agent text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.client_request_consents OWNER TO postgres;

--
-- TOC entry 270 (class 1259 OID 17111)
-- Name: client_request_consents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.client_request_consents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.client_request_consents_id_seq OWNER TO postgres;

--
-- TOC entry 6885 (class 0 OID 0)
-- Dependencies: 270
-- Name: client_request_consents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.client_request_consents_id_seq OWNED BY public.client_request_consents.id;


--
-- TOC entry 269 (class 1259 OID 17084)
-- Name: client_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_requests (
    id integer NOT NULL,
    created_by character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'pending_consent'::character varying NOT NULL,
    rejection_reason text,
    lopdp_token character varying(255),
    lopdp_consent_status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    client_email character varying(255) NOT NULL,
    client_type character varying(50) NOT NULL,
    legal_person_business_name character varying(255),
    nationality character varying(100),
    natural_person_firstname character varying(255),
    natural_person_lastname character varying(255),
    commercial_name character varying(255),
    ruc_cedula character varying(20) NOT NULL,
    establishment_province character varying(100),
    establishment_city character varying(100),
    establishment_address text,
    establishment_reference text,
    establishment_phone character varying(50),
    establishment_cellphone character varying(50),
    legal_rep_name character varying(255),
    legal_rep_position character varying(100),
    legal_rep_id_document character varying(20),
    legal_rep_cellphone character varying(50),
    legal_rep_email character varying(255),
    shipping_contact_name character varying(255),
    shipping_address text,
    shipping_city character varying(100),
    shipping_province character varying(100),
    shipping_reference text,
    shipping_phone character varying(50),
    shipping_cellphone character varying(50),
    shipping_delivery_hours character varying(255),
    operating_permit_status character varying(50),
    drive_folder_id character varying(255),
    legal_rep_appointment_file_id character varying(255),
    ruc_file_id character varying(255),
    id_file_id character varying(255),
    operating_permit_file_id character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    data_processing_consent boolean DEFAULT false NOT NULL,
    establishment_name character varying(255),
    consent_capture_method character varying(50) DEFAULT 'email_link'::character varying NOT NULL,
    consent_capture_details text,
    lopdp_consent_method character varying(50),
    lopdp_consent_details text,
    lopdp_consent_at timestamp without time zone,
    lopdp_consent_ip character varying(64),
    lopdp_consent_user_agent text,
    consent_evidence_file_id character varying(255),
    consent_recipient_email character varying(255),
    consent_email_token_id character varying(64),
    approval_status character varying(50) DEFAULT 'pendiente'::character varying,
    approved_by integer,
    approved_at timestamp without time zone,
    client_id integer,
    user_id integer,
    client_sector character varying(20) DEFAULT 'privado'::character varying,
    approval_letter_file_id character varying(255),
    consent_record_file_id character varying(255)
);


ALTER TABLE public.client_requests OWNER TO postgres;

--
-- TOC entry 6886 (class 0 OID 0)
-- Dependencies: 269
-- Name: COLUMN client_requests.rejection_reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_requests.rejection_reason IS 'Motivo del rechazo si la solicitud fue rechazada';


--
-- TOC entry 6887 (class 0 OID 0)
-- Dependencies: 269
-- Name: COLUMN client_requests.data_processing_consent; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_requests.data_processing_consent IS 'Aceptación interna del tratamiento de datos';


--
-- TOC entry 6888 (class 0 OID 0)
-- Dependencies: 269
-- Name: COLUMN client_requests.establishment_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_requests.establishment_name IS 'Nombre del establecimiento registrado en la solicitud';


--
-- TOC entry 6889 (class 0 OID 0)
-- Dependencies: 269
-- Name: COLUMN client_requests.consent_capture_method; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_requests.consent_capture_method IS 'Método planificado para recolectar el consentimiento';


--
-- TOC entry 6890 (class 0 OID 0)
-- Dependencies: 269
-- Name: COLUMN client_requests.lopdp_consent_method; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_requests.lopdp_consent_method IS 'Método real utilizado para registrar la aceptación';


--
-- TOC entry 6891 (class 0 OID 0)
-- Dependencies: 269
-- Name: COLUMN client_requests.consent_recipient_email; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_requests.consent_recipient_email IS 'Correo al que se envió el código OTP LOPDP';


--
-- TOC entry 6892 (class 0 OID 0)
-- Dependencies: 269
-- Name: COLUMN client_requests.consent_email_token_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_requests.consent_email_token_id IS 'Token OTP verificado previamente para LOPDP';


--
-- TOC entry 6893 (class 0 OID 0)
-- Dependencies: 269
-- Name: COLUMN client_requests.approval_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_requests.approval_status IS 'Estado de aprobación: pendiente, aprobado, rechazado';


--
-- TOC entry 6894 (class 0 OID 0)
-- Dependencies: 269
-- Name: COLUMN client_requests.client_sector; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_requests.client_sector IS 'Sector del cliente: publico o privado';


--
-- TOC entry 6895 (class 0 OID 0)
-- Dependencies: 269
-- Name: COLUMN client_requests.approval_letter_file_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_requests.approval_letter_file_id IS 'ID del documento de oficio de aprobación generado en Drive';


--
-- TOC entry 6896 (class 0 OID 0)
-- Dependencies: 269
-- Name: COLUMN client_requests.consent_record_file_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_requests.consent_record_file_id IS 'Archivo generado con la declaración de consentimiento';


--
-- TOC entry 268 (class 1259 OID 17083)
-- Name: client_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.client_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.client_requests_id_seq OWNER TO postgres;

--
-- TOC entry 6897 (class 0 OID 0)
-- Dependencies: 268
-- Name: client_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.client_requests_id_seq OWNED BY public.client_requests.id;


--
-- TOC entry 296 (class 1259 OID 25735)
-- Name: client_visit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_visit_logs (
    id integer NOT NULL,
    client_request_id integer NOT NULL,
    user_email text NOT NULL,
    visit_date date NOT NULL,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    hora_entrada timestamp with time zone,
    hora_salida timestamp with time zone,
    lat_entrada double precision,
    lng_entrada double precision,
    lat_salida double precision,
    lng_salida double precision,
    observaciones text,
    duracion_minutos integer,
    CONSTRAINT client_visit_logs_status_check CHECK ((status = ANY (ARRAY['visited'::text, 'pending'::text, 'skipped'::text, 'in_visit'::text])))
);


ALTER TABLE public.client_visit_logs OWNER TO postgres;

--
-- TOC entry 295 (class 1259 OID 25734)
-- Name: client_visit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.client_visit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.client_visit_logs_id_seq OWNER TO postgres;

--
-- TOC entry 6898 (class 0 OID 0)
-- Dependencies: 295
-- Name: client_visit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.client_visit_logs_id_seq OWNED BY public.client_visit_logs.id;


--
-- TOC entry 278 (class 1259 OID 17244)
-- Name: clients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clients (
    id integer NOT NULL,
    client_request_id integer,
    razon_social text NOT NULL,
    ruc text NOT NULL,
    nombre_comercial text,
    contacto_nombre text,
    contacto_cargo text,
    contacto_email text,
    contacto_telefono text,
    direccion text,
    ciudad text,
    provincia text,
    pais text DEFAULT 'Ecuador'::text,
    nombre_banco text,
    tipo_cuenta text,
    numero_cuenta text,
    representante_nombre text,
    representante_cedula text,
    representante_email text,
    representante_telefono text,
    consentimiento_lopdp boolean DEFAULT false,
    consentimiento_email text,
    consentimiento_token text,
    consentimiento_verificado boolean DEFAULT false,
    consentimiento_fecha timestamp without time zone,
    estado character varying(50) DEFAULT 'activo'::character varying,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    ruc_hash character varying(64),
    client_sector character varying(20) DEFAULT 'privado'::character varying
);


ALTER TABLE public.clients OWNER TO postgres;

--
-- TOC entry 6899 (class 0 OID 0)
-- Dependencies: 278
-- Name: TABLE clients; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.clients IS 'Clientes aprobados con datos encriptados para máxima seguridad';


--
-- TOC entry 6900 (class 0 OID 0)
-- Dependencies: 278
-- Name: COLUMN clients.ruc_hash; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.clients.ruc_hash IS 'Hash SHA-256 del RUC para búsquedas sin exponer el dato real';


--
-- TOC entry 6901 (class 0 OID 0)
-- Dependencies: 278
-- Name: COLUMN clients.client_sector; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.clients.client_sector IS 'Sector del cliente: publico o privado';


--
-- TOC entry 277 (class 1259 OID 17243)
-- Name: clients_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clients_id_seq OWNER TO postgres;

--
-- TOC entry 6902 (class 0 OID 0)
-- Dependencies: 277
-- Name: clients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;


--
-- TOC entry 304 (class 1259 OID 26152)
-- Name: contract_determinations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contract_determinations (
    id integer NOT NULL,
    business_case_id uuid,
    client_id integer,
    determination_id integer,
    annual_negotiated_quantity integer NOT NULL,
    consumed_quantity integer DEFAULT 0,
    remaining_quantity integer,
    alert_threshold_yellow integer DEFAULT 30,
    alert_threshold_red integer DEFAULT 10,
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT contract_determinations_alert_threshold_red_check CHECK (((alert_threshold_red > 0) AND (alert_threshold_red <= 100))),
    CONSTRAINT contract_determinations_alert_threshold_yellow_check CHECK (((alert_threshold_yellow > 0) AND (alert_threshold_yellow <= 100))),
    CONSTRAINT contract_determinations_annual_negotiated_quantity_check CHECK ((annual_negotiated_quantity > 0)),
    CONSTRAINT contract_determinations_consumed_quantity_check CHECK ((consumed_quantity >= 0)),
    CONSTRAINT contract_determinations_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.contract_determinations OWNER TO postgres;

--
-- TOC entry 6903 (class 0 OID 0)
-- Dependencies: 304
-- Name: TABLE contract_determinations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.contract_determinations IS 'Inventario de determinaciones negociadas por Business Case';


--
-- TOC entry 6904 (class 0 OID 0)
-- Dependencies: 304
-- Name: COLUMN contract_determinations.alert_threshold_yellow; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contract_determinations.alert_threshold_yellow IS 'Porcentaje restante para alerta amarilla';


--
-- TOC entry 6905 (class 0 OID 0)
-- Dependencies: 304
-- Name: COLUMN contract_determinations.alert_threshold_red; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contract_determinations.alert_threshold_red IS 'Porcentaje restante para alerta roja';


--
-- TOC entry 303 (class 1259 OID 26151)
-- Name: contract_determinations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.contract_determinations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.contract_determinations_id_seq OWNER TO postgres;

--
-- TOC entry 6906 (class 0 OID 0)
-- Dependencies: 303
-- Name: contract_determinations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.contract_determinations_id_seq OWNED BY public.contract_determinations.id;


--
-- TOC entry 265 (class 1259 OID 16959)
-- Name: departments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.departments (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.departments OWNER TO postgres;

--
-- TOC entry 264 (class 1259 OID 16958)
-- Name: departments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.departments_id_seq OWNER TO postgres;

--
-- TOC entry 6907 (class 0 OID 0)
-- Dependencies: 264
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;


--
-- TOC entry 306 (class 1259 OID 26188)
-- Name: determination_consumption_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.determination_consumption_log (
    id integer NOT NULL,
    contract_determination_id integer,
    consumed_quantity integer NOT NULL,
    consumption_date date DEFAULT CURRENT_DATE NOT NULL,
    consumed_by_user_id integer,
    source character varying(50) DEFAULT 'manual'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT determination_consumption_log_consumed_quantity_check CHECK ((consumed_quantity > 0)),
    CONSTRAINT determination_consumption_log_source_check CHECK (((source)::text = ANY ((ARRAY['manual'::character varying, 'lis_integration'::character varying, 'auto'::character varying])::text[])))
);


ALTER TABLE public.determination_consumption_log OWNER TO postgres;

--
-- TOC entry 6908 (class 0 OID 0)
-- Dependencies: 306
-- Name: TABLE determination_consumption_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.determination_consumption_log IS 'Registro histórico de consumos de determinaciones';


--
-- TOC entry 6909 (class 0 OID 0)
-- Dependencies: 306
-- Name: COLUMN determination_consumption_log.source; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.determination_consumption_log.source IS 'Origen del registro: manual, lis_integration, auto';


--
-- TOC entry 305 (class 1259 OID 26187)
-- Name: determination_consumption_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.determination_consumption_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.determination_consumption_log_id_seq OWNER TO postgres;

--
-- TOC entry 6910 (class 0 OID 0)
-- Dependencies: 305
-- Name: determination_consumption_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.determination_consumption_log_id_seq OWNED BY public.determination_consumption_log.id;


--
-- TOC entry 403 (class 1259 OID 28656)
-- Name: document_hashes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_hashes (
    id integer NOT NULL,
    document_id bigint NOT NULL,
    document_type character varying(50) NOT NULL,
    hash_sha256 character varying(64) NOT NULL,
    hash_algorithm character varying(20) DEFAULT 'SHA-256'::character varying,
    calculated_at timestamp with time zone DEFAULT now(),
    calculated_by integer,
    is_current boolean DEFAULT true
);


ALTER TABLE public.document_hashes OWNER TO postgres;

--
-- TOC entry 6911 (class 0 OID 0)
-- Dependencies: 403
-- Name: TABLE document_hashes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.document_hashes IS 'Cryptographic hashes for document integrity verification';


--
-- TOC entry 6912 (class 0 OID 0)
-- Dependencies: 403
-- Name: COLUMN document_hashes.document_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.document_hashes.document_type IS 'Type of document: pdf, docx, excel, etc.';


--
-- TOC entry 6913 (class 0 OID 0)
-- Dependencies: 403
-- Name: COLUMN document_hashes.hash_sha256; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.document_hashes.hash_sha256 IS 'SHA-256 hash of the document content';


--
-- TOC entry 6914 (class 0 OID 0)
-- Dependencies: 403
-- Name: COLUMN document_hashes.is_current; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.document_hashes.is_current IS 'True if this is the current valid hash for the document';


--
-- TOC entry 402 (class 1259 OID 28655)
-- Name: document_hashes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.document_hashes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.document_hashes_id_seq OWNER TO postgres;

--
-- TOC entry 6916 (class 0 OID 0)
-- Dependencies: 402
-- Name: document_hashes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.document_hashes_id_seq OWNED BY public.document_hashes.id;


--
-- TOC entry 409 (class 1259 OID 28748)
-- Name: document_qr_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_qr_codes (
    id integer NOT NULL,
    document_id bigint NOT NULL,
    seal_id integer,
    qr_code text NOT NULL,
    qr_url text NOT NULL,
    verification_token uuid DEFAULT gen_random_uuid(),
    generated_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true,
    access_count integer DEFAULT 0,
    last_accessed_at timestamp with time zone
);


ALTER TABLE public.document_qr_codes OWNER TO postgres;

--
-- TOC entry 6917 (class 0 OID 0)
-- Dependencies: 409
-- Name: TABLE document_qr_codes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.document_qr_codes IS 'QR codes for public document verification';


--
-- TOC entry 6918 (class 0 OID 0)
-- Dependencies: 409
-- Name: COLUMN document_qr_codes.qr_code; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.document_qr_codes.qr_code IS 'Base64 encoded QR code image';


--
-- TOC entry 6919 (class 0 OID 0)
-- Dependencies: 409
-- Name: COLUMN document_qr_codes.qr_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.document_qr_codes.qr_url IS 'Public URL for document verification';


--
-- TOC entry 6920 (class 0 OID 0)
-- Dependencies: 409
-- Name: COLUMN document_qr_codes.verification_token; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.document_qr_codes.verification_token IS 'Token for public verification endpoint';


--
-- TOC entry 408 (class 1259 OID 28747)
-- Name: document_qr_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.document_qr_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.document_qr_codes_id_seq OWNER TO postgres;

--
-- TOC entry 6922 (class 0 OID 0)
-- Dependencies: 408
-- Name: document_qr_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.document_qr_codes_id_seq OWNED BY public.document_qr_codes.id;


--
-- TOC entry 407 (class 1259 OID 28714)
-- Name: document_seals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_seals (
    id integer NOT NULL,
    document_id bigint NOT NULL,
    seal_code character varying(50) NOT NULL,
    seal_type character varying(50) DEFAULT 'institutional'::character varying,
    issued_by character varying(255) DEFAULT 'SPI Fam'::character varying,
    authorized_role character varying(100) NOT NULL,
    authorized_user_id integer,
    seal_token uuid DEFAULT gen_random_uuid(),
    document_hash_id integer,
    issued_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.document_seals OWNER TO postgres;

--
-- TOC entry 6923 (class 0 OID 0)
-- Dependencies: 407
-- Name: TABLE document_seals; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.document_seals IS 'Institutional digital seals for document authentication';


--
-- TOC entry 6924 (class 0 OID 0)
-- Dependencies: 407
-- Name: COLUMN document_seals.seal_code; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.document_seals.seal_code IS 'Unique institutional seal code (format: SPI-YYYY-TYPE-NNNNN)';


--
-- TOC entry 6925 (class 0 OID 0)
-- Dependencies: 407
-- Name: COLUMN document_seals.authorized_role; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.document_seals.authorized_role IS 'Role that authorized the seal (DPD, Manager, etc.)';


--
-- TOC entry 6926 (class 0 OID 0)
-- Dependencies: 407
-- Name: COLUMN document_seals.seal_token; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.document_seals.seal_token IS 'Unique token for seal verification and API access';


--
-- TOC entry 406 (class 1259 OID 28713)
-- Name: document_seals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.document_seals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.document_seals_id_seq OWNER TO postgres;

--
-- TOC entry 6928 (class 0 OID 0)
-- Dependencies: 406
-- Name: document_seals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.document_seals_id_seq OWNED BY public.document_seals.id;


--
-- TOC entry 411 (class 1259 OID 28775)
-- Name: document_signature_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_signature_logs (
    id integer NOT NULL,
    document_id bigint NOT NULL,
    event_type character varying(100) NOT NULL,
    event_description text,
    user_id integer,
    user_name character varying(255),
    user_role character varying(100),
    user_email character varying(255),
    ip_address inet,
    user_agent text,
    session_id character varying(255),
    event_hash character varying(64) NOT NULL,
    previous_event_hash character varying(64),
    event_data jsonb,
    event_timestamp timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.document_signature_logs OWNER TO postgres;

--
-- TOC entry 410 (class 1259 OID 28774)
-- Name: document_signature_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.document_signature_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.document_signature_logs_id_seq OWNER TO postgres;

--
-- TOC entry 6929 (class 0 OID 0)
-- Dependencies: 410
-- Name: document_signature_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.document_signature_logs_id_seq OWNED BY public.document_signature_logs.id;


--
-- TOC entry 227 (class 1259 OID 16413)
-- Name: document_signatures; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_signatures (
    id bigint NOT NULL,
    document_id bigint NOT NULL,
    signer_user_id integer NOT NULL,
    role_at_sign text,
    signature_file_id text,
    signed_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.document_signatures OWNER TO postgres;

--
-- TOC entry 6930 (class 0 OID 0)
-- Dependencies: 227
-- Name: TABLE document_signatures; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.document_signatures IS 'Firmas digitales PNG por documento/usuario/rol.';


--
-- TOC entry 405 (class 1259 OID 28678)
-- Name: document_signatures_advanced; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_signatures_advanced (
    id integer NOT NULL,
    document_id bigint NOT NULL,
    signer_user_id integer NOT NULL,
    signer_role character varying(100) NOT NULL,
    signature_type character varying(50) DEFAULT 'advanced_electronic'::character varying,
    signer_name character varying(255) NOT NULL,
    signer_email character varying(255) NOT NULL,
    signer_department character varying(100),
    signed_at timestamp with time zone DEFAULT now(),
    ip_address inet NOT NULL,
    user_agent text,
    session_id character varying(255),
    auth_method character varying(50) DEFAULT 'oauth_corporate'::character varying,
    document_hash_id integer,
    signature_hash character varying(64),
    is_valid boolean DEFAULT true,
    invalidated_at timestamp with time zone,
    invalidation_reason text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.document_signatures_advanced OWNER TO postgres;

--
-- TOC entry 6931 (class 0 OID 0)
-- Dependencies: 405
-- Name: TABLE document_signatures_advanced; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.document_signatures_advanced IS 'Advanced electronic signatures with full audit trail';


--
-- TOC entry 6932 (class 0 OID 0)
-- Dependencies: 405
-- Name: COLUMN document_signatures_advanced.signer_role; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.document_signatures_advanced.signer_role IS 'Role of the signer at the time of signing';


--
-- TOC entry 6933 (class 0 OID 0)
-- Dependencies: 405
-- Name: COLUMN document_signatures_advanced.signature_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.document_signatures_advanced.signature_type IS 'Type of signature: advanced_electronic, qualified, etc.';


--
-- TOC entry 6934 (class 0 OID 0)
-- Dependencies: 405
-- Name: COLUMN document_signatures_advanced.auth_method; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.document_signatures_advanced.auth_method IS 'Authentication method used: oauth_corporate, certificate, etc.';


--
-- TOC entry 6935 (class 0 OID 0)
-- Dependencies: 405
-- Name: COLUMN document_signatures_advanced.document_hash_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.document_signatures_advanced.document_hash_id IS 'Reference to the document hash at time of signing';


--
-- TOC entry 6936 (class 0 OID 0)
-- Dependencies: 405
-- Name: COLUMN document_signatures_advanced.signature_hash; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.document_signatures_advanced.signature_hash IS 'Hash of the complete signature record for tamper detection';


--
-- TOC entry 404 (class 1259 OID 28677)
-- Name: document_signatures_advanced_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.document_signatures_advanced_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.document_signatures_advanced_id_seq OWNER TO postgres;

--
-- TOC entry 6938 (class 0 OID 0)
-- Dependencies: 404
-- Name: document_signatures_advanced_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.document_signatures_advanced_id_seq OWNED BY public.document_signatures_advanced.id;


--
-- TOC entry 228 (class 1259 OID 16422)
-- Name: document_signatures_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.document_signatures_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.document_signatures_id_seq OWNER TO postgres;

--
-- TOC entry 6939 (class 0 OID 0)
-- Dependencies: 228
-- Name: document_signatures_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.document_signatures_id_seq OWNED BY public.document_signatures.id;


--
-- TOC entry 229 (class 1259 OID 16423)
-- Name: documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.documents (
    id bigint NOT NULL,
    request_id integer NOT NULL,
    request_type_id integer NOT NULL,
    doc_drive_id text,
    pdf_drive_id text,
    folder_drive_id text,
    version_number integer DEFAULT 1,
    signed boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    signature_status character varying(50) DEFAULT 'pending'::character varying,
    current_hash_id integer,
    is_locked boolean DEFAULT false,
    locked_at timestamp with time zone,
    locked_by integer
);


ALTER TABLE public.documents OWNER TO postgres;

--
-- TOC entry 6940 (class 0 OID 0)
-- Dependencies: 229
-- Name: TABLE documents; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.documents IS 'Documentos generados desde plantillas: DOCX/PDF/firma y carpeta Drive por request.';


--
-- TOC entry 6941 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN documents.signature_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.documents.signature_status IS 'Status: pending, signed, locked, expired';


--
-- TOC entry 6942 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN documents.current_hash_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.documents.current_hash_id IS 'Reference to the current document hash';


--
-- TOC entry 6943 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN documents.is_locked; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.documents.is_locked IS 'True if document is locked after signing';


--
-- TOC entry 6944 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN documents.locked_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.documents.locked_at IS 'Timestamp when document was locked';


--
-- TOC entry 6945 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN documents.locked_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.documents.locked_by IS 'User who locked the document';


--
-- TOC entry 415 (class 1259 OID 28863)
-- Name: document_verification_info; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.document_verification_info AS
 SELECT d.id AS document_id,
    d.doc_drive_id,
    d.pdf_drive_id,
    d.signature_status,
    d.is_locked,
    ds.seal_code,
    ds.seal_token,
    ds.issued_by,
    ds.authorized_role,
    ds.issued_at,
    ds.is_active AS seal_active,
    dqc.qr_url,
    dqc.verification_token,
    dqc.access_count,
    dqc.last_accessed_at,
    dqc.is_active AS qr_active,
    dh.hash_sha256,
    dh.calculated_at AS hash_calculated_at,
    dsa.signed_at AS last_signed_at,
    dsa.signer_name AS last_signer_name,
    dsa.signer_role AS last_signer_role
   FROM ((((public.documents d
     LEFT JOIN public.document_seals ds ON (((ds.document_id = d.id) AND (ds.is_active = true))))
     LEFT JOIN public.document_qr_codes dqc ON (((dqc.document_id = d.id) AND (dqc.is_active = true))))
     LEFT JOIN public.document_hashes dh ON ((dh.id = d.current_hash_id)))
     LEFT JOIN public.document_signatures_advanced dsa ON (((dsa.document_id = d.id) AND (dsa.signed_at = ( SELECT max(document_signatures_advanced.signed_at) AS max
           FROM public.document_signatures_advanced
          WHERE ((document_signatures_advanced.document_id = d.id) AND (document_signatures_advanced.is_valid = true)))))));


ALTER VIEW public.document_verification_info OWNER TO postgres;

--
-- TOC entry 6946 (class 0 OID 0)
-- Dependencies: 415
-- Name: VIEW document_verification_info; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.document_verification_info IS 'Complete verification information for documents with seals and QR codes';


--
-- TOC entry 413 (class 1259 OID 28795)
-- Name: document_verifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_verifications (
    id integer NOT NULL,
    verification_token uuid NOT NULL,
    document_id bigint NOT NULL,
    is_valid boolean NOT NULL,
    verification_result jsonb,
    access_count integer DEFAULT 0,
    first_accessed_at timestamp with time zone,
    last_accessed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.document_verifications OWNER TO postgres;

--
-- TOC entry 412 (class 1259 OID 28794)
-- Name: document_verifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.document_verifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.document_verifications_id_seq OWNER TO postgres;

--
-- TOC entry 6948 (class 0 OID 0)
-- Dependencies: 412
-- Name: document_verifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.document_verifications_id_seq OWNED BY public.document_verifications.id;


--
-- TOC entry 230 (class 1259 OID 16435)
-- Name: documents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.documents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.documents_id_seq OWNER TO postgres;

--
-- TOC entry 6949 (class 0 OID 0)
-- Dependencies: 230
-- Name: documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.documents_id_seq OWNED BY public.documents.id;


--
-- TOC entry 231 (class 1259 OID 16436)
-- Name: employees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employees (
    id integer NOT NULL,
    nombre text,
    cedula text,
    cargo text,
    fecha_ingreso date,
    estado text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.employees OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 16444)
-- Name: employees_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employees_id_seq OWNER TO postgres;

--
-- TOC entry 6950 (class 0 OID 0)
-- Dependencies: 232
-- Name: employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;


--
-- TOC entry 384 (class 1259 OID 28423)
-- Name: equipment_models_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.equipment_models_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.equipment_models_id_seq OWNER TO postgres;

--
-- TOC entry 385 (class 1259 OID 28424)
-- Name: equipment_models; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.equipment_models (
    id integer DEFAULT nextval('public.equipment_models_id_seq'::regclass) NOT NULL,
    code character varying(50),
    sku text,
    name text NOT NULL,
    manufacturer character varying(255),
    model character varying(255),
    category character varying(100),
    category_type character varying(100),
    description text,
    status text DEFAULT 'operativo'::text,
    default_location text,
    capacity_per_hour integer,
    max_daily_capacity integer,
    installation_days integer DEFAULT 7,
    training_hours integer DEFAULT 16,
    warranty_months integer DEFAULT 12,
    base_price numeric(12,2),
    maintenance_cost numeric(12,2),
    technical_specs jsonb DEFAULT '{}'::jsonb,
    notes text,
    default_calculation_formula jsonb DEFAULT '{}'::jsonb,
    calculation_engine character varying(50) DEFAULT 'standard'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by integer,
    updated_by integer,
    metadata jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.equipment_models OWNER TO postgres;

--
-- TOC entry 6951 (class 0 OID 0)
-- Dependencies: 385
-- Name: TABLE equipment_models; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.equipment_models IS 'Catálogo unificado de equipos/modelos para todo el sistema.';


--
-- TOC entry 6952 (class 0 OID 0)
-- Dependencies: 385
-- Name: COLUMN equipment_models.code; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_models.code IS 'Código legacy (servicio.equipos.code).';


--
-- TOC entry 6953 (class 0 OID 0)
-- Dependencies: 385
-- Name: COLUMN equipment_models.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_models.status IS 'Estado operativo del equipo.';


--
-- TOC entry 332 (class 1259 OID 26970)
-- Name: equipment_price_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.equipment_price_history (
    id integer NOT NULL,
    equipment_id integer,
    consumable_id integer,
    determination_id integer,
    price numeric(12,2) NOT NULL,
    price_type character varying(50) NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    changed_by integer,
    reason text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT equipment_price_history_check CHECK ((((equipment_id IS NOT NULL) AND (consumable_id IS NULL) AND (determination_id IS NULL)) OR ((equipment_id IS NULL) AND (consumable_id IS NOT NULL) AND (determination_id IS NULL)) OR ((equipment_id IS NULL) AND (consumable_id IS NULL) AND (determination_id IS NOT NULL)))),
    CONSTRAINT equipment_price_history_price_type_check CHECK (((price_type)::text = ANY ((ARRAY['base_price'::character varying, 'unit_price'::character varying, 'cost_per_test'::character varying, 'maintenance'::character varying])::text[])))
);


ALTER TABLE public.equipment_price_history OWNER TO postgres;

--
-- TOC entry 6954 (class 0 OID 0)
-- Dependencies: 332
-- Name: TABLE equipment_price_history; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.equipment_price_history IS 'Historial completo de cambios de precios para trazabilidad';


--
-- TOC entry 6955 (class 0 OID 0)
-- Dependencies: 332
-- Name: COLUMN equipment_price_history.price_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_price_history.price_type IS 'Tipo de precio: base_price, unit_price, cost_per_test, maintenance';


--
-- TOC entry 331 (class 1259 OID 26969)
-- Name: equipment_price_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.equipment_price_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.equipment_price_history_id_seq OWNER TO postgres;

--
-- TOC entry 6956 (class 0 OID 0)
-- Dependencies: 331
-- Name: equipment_price_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.equipment_price_history_id_seq OWNED BY public.equipment_price_history.id;


--
-- TOC entry 288 (class 1259 OID 17468)
-- Name: equipment_purchase_bc_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.equipment_purchase_bc_items (
    id uuid NOT NULL,
    request_id uuid,
    name text NOT NULL,
    characteristics text,
    status text,
    quantity numeric,
    price numeric,
    total numeric,
    created_by integer,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.equipment_purchase_bc_items OWNER TO postgres;

--
-- TOC entry 281 (class 1259 OID 17321)
-- Name: equipment_purchase_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.equipment_purchase_requests (
    id uuid NOT NULL,
    created_by integer,
    created_by_email text,
    client_id integer,
    client_name text NOT NULL,
    client_email text,
    provider_email text,
    equipment jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text NOT NULL,
    availability_email_sent_at timestamp with time zone,
    availability_email_file_id text,
    provider_response jsonb,
    provider_response_at timestamp with time zone,
    proforma_requested_at timestamp with time zone,
    proforma_request_email_file_id text,
    proforma_file_id text,
    proforma_uploaded_at timestamp with time zone,
    reservation_email_sent_at timestamp with time zone,
    reservation_calendar_event_id text,
    reservation_calendar_event_link text,
    reservation_email_file_id text,
    signed_proforma_file_id text,
    signed_proforma_uploaded_at timestamp with time zone,
    arrival_eta_email_sent_at timestamp with time zone,
    arrival_eta_email_file_id text,
    inspection_min_date date,
    inspection_max_date date,
    includes_starter_kit boolean,
    inspection_recorded_at timestamp with time zone,
    contract_file_id text,
    contract_uploaded_at timestamp with time zone,
    contract_reminder_event_id text,
    contract_reminder_event_link text,
    drive_folder_id text,
    extra jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    equipment_type text DEFAULT 'new'::text,
    reservation_expires_at timestamp with time zone,
    reservation_renewed_at timestamp with time zone,
    reservation_renewal_count integer DEFAULT 0,
    cancelled_at timestamp with time zone,
    cancellation_reason text,
    assigned_to integer,
    assigned_to_email text,
    assigned_to_name text,
    notes text,
    bc_spreadsheet_id text,
    bc_spreadsheet_url text,
    bc_created_at timestamp with time zone,
    bc_stage text DEFAULT 'pending_comercial'::text,
    bc_progress jsonb DEFAULT '{}'::jsonb,
    process_doc_id text,
    process_doc_url text,
    process_doc_created_at timestamp with time zone,
    request_type text DEFAULT 'purchase'::text,
    uses_modern_system boolean DEFAULT false,
    bc_system_type character varying(50) DEFAULT 'legacy'::character varying,
    modern_bc_metadata jsonb DEFAULT '{}'::jsonb,
    inspection_request_id integer,
    bc_purchase_type character varying(50) DEFAULT 'public'::character varying,
    bc_duration_years integer,
    bc_equipment_cost numeric(12,2),
    bc_target_margin_percentage numeric(5,2),
    bc_amortization_months integer,
    bc_calculation_mode character varying(20) DEFAULT 'monthly'::character varying,
    bc_show_roi boolean DEFAULT false,
    bc_show_margin boolean DEFAULT false,
    process_code character varying(255),
    contract_object text,
    business_case_type character varying(50),
    calculation_mode character varying(20),
    includes_lis boolean DEFAULT false,
    includes_lis_hardware boolean DEFAULT false,
    deadline_months integer,
    projected_deadline_months integer,
    canonical_state character varying(50) DEFAULT 'DRAFT_INICIAL'::character varying,
    CONSTRAINT equipment_purchase_requests_bc_amortization_months_check CHECK ((bc_amortization_months > 0)),
    CONSTRAINT equipment_purchase_requests_bc_calculation_mode_check CHECK (((bc_calculation_mode)::text = ANY ((ARRAY['monthly'::character varying, 'annual'::character varying])::text[]))),
    CONSTRAINT equipment_purchase_requests_bc_duration_years_check CHECK ((bc_duration_years > 0)),
    CONSTRAINT equipment_purchase_requests_bc_equipment_cost_check CHECK ((bc_equipment_cost >= (0)::numeric)),
    CONSTRAINT equipment_purchase_requests_bc_purchase_type_check CHECK (((bc_purchase_type)::text = ANY ((ARRAY['public'::character varying, 'private_comodato'::character varying, 'private_sale'::character varying])::text[]))),
    CONSTRAINT equipment_purchase_requests_bc_system_type_check CHECK (((bc_system_type)::text = ANY ((ARRAY['legacy'::character varying, 'modern'::character varying])::text[]))),
    CONSTRAINT equipment_purchase_requests_bc_target_margin_percentage_check CHECK (((bc_target_margin_percentage >= (0)::numeric) AND (bc_target_margin_percentage <= (100)::numeric)))
);


ALTER TABLE public.equipment_purchase_requests OWNER TO postgres;

--
-- TOC entry 6957 (class 0 OID 0)
-- Dependencies: 281
-- Name: TABLE equipment_purchase_requests; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.equipment_purchase_requests IS 'Business Cases de comodatos (públicos y privados) con cálculos automáticos de ROI';


--
-- TOC entry 6958 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN equipment_purchase_requests.equipment_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.equipment_type IS 'Tipo de equipo solicitado: new (nuevo) o cu (usado/reacondicionado)';


--
-- TOC entry 6959 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN equipment_purchase_requests.reservation_expires_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.reservation_expires_at IS 'Fecha de expiración de la reserva (60 días después de la última reserva/renovación)';


--
-- TOC entry 6960 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN equipment_purchase_requests.reservation_renewed_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.reservation_renewed_at IS 'Última fecha de renovación de la reserva';


--
-- TOC entry 6961 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN equipment_purchase_requests.reservation_renewal_count; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.reservation_renewal_count IS 'Número de veces que se ha renovado la reserva';


--
-- TOC entry 6962 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN equipment_purchase_requests.cancelled_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.cancelled_at IS 'Fecha de cancelación de la orden';


--
-- TOC entry 6963 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN equipment_purchase_requests.cancellation_reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.cancellation_reason IS 'Razón de la cancelación (manual, auto-expiración, etc)';


--
-- TOC entry 6964 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN equipment_purchase_requests.uses_modern_system; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.uses_modern_system IS 'true = usa sistema modernizado (BD), false = usa Google Sheets (legacy)';


--
-- TOC entry 6965 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN equipment_purchase_requests.bc_system_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.bc_system_type IS 'Tipo de sistema: legacy (Google Sheets) o modern (nuevo sistema con motor de cálculos)';


--
-- TOC entry 6966 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN equipment_purchase_requests.modern_bc_metadata; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.modern_bc_metadata IS 'Metadata adicional para BCs modernos (configuraciones, flags, etc.)';


--
-- TOC entry 6967 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN equipment_purchase_requests.bc_purchase_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.bc_purchase_type IS 'Tipo de Business Case: public, private_comodato o private_sale';


--
-- TOC entry 6968 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN equipment_purchase_requests.bc_duration_years; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.bc_duration_years IS 'Duración del comodato en años (solo para privados)';


--
-- TOC entry 6969 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN equipment_purchase_requests.bc_equipment_cost; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.bc_equipment_cost IS 'Costo del equipo utilizado para cálculos de ROI';


--
-- TOC entry 6970 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN equipment_purchase_requests.bc_target_margin_percentage; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.bc_target_margin_percentage IS 'Margen objetivo (%) para cálculos privados';


--
-- TOC entry 6971 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN equipment_purchase_requests.bc_amortization_months; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.bc_amortization_months IS 'Meses de amortización estimados';


--
-- TOC entry 6972 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN equipment_purchase_requests.bc_calculation_mode; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.bc_calculation_mode IS 'Modo de cálculo: monthly o annual';


--
-- TOC entry 6973 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN equipment_purchase_requests.bc_show_roi; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.bc_show_roi IS 'Flag para mostrar ROI en reportes';


--
-- TOC entry 6974 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN equipment_purchase_requests.bc_show_margin; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.bc_show_margin IS 'Flag para mostrar margen en reportes';


--
-- TOC entry 6975 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN equipment_purchase_requests.process_code; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.process_code IS 'Código del proceso (solo para comodatos públicos)';


--
-- TOC entry 6976 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN equipment_purchase_requests.contract_object; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.contract_object IS 'Objeto de contratación (solo para comodatos públicos)';


--
-- TOC entry 342 (class 1259 OID 27223)
-- Name: equipos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.equipos (
    id integer NOT NULL,
    sku text,
    nombre text NOT NULL,
    fabricante text,
    modelo text,
    categoria text,
    serie text,
    estado text DEFAULT 'disponible'::text NOT NULL,
    ubicacion text,
    cantidad integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT equipos_cantidad_check CHECK ((cantidad >= 0))
);


ALTER TABLE public.equipos OWNER TO postgres;

--
-- TOC entry 350 (class 1259 OID 27312)
-- Name: equipos_historial; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.equipos_historial (
    id integer NOT NULL,
    unidad_id integer,
    evento text NOT NULL,
    cliente_id integer,
    sucursal_id integer,
    request_id integer,
    detalle jsonb,
    created_by integer,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.equipos_historial OWNER TO postgres;

--
-- TOC entry 349 (class 1259 OID 27311)
-- Name: equipos_historial_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.equipos_historial_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.equipos_historial_id_seq OWNER TO postgres;

--
-- TOC entry 6977 (class 0 OID 0)
-- Dependencies: 349
-- Name: equipos_historial_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.equipos_historial_id_seq OWNED BY public.equipos_historial.id;


--
-- TOC entry 341 (class 1259 OID 27222)
-- Name: equipos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.equipos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.equipos_id_seq OWNER TO postgres;

--
-- TOC entry 6978 (class 0 OID 0)
-- Dependencies: 341
-- Name: equipos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.equipos_id_seq OWNED BY public.equipos.id;


--
-- TOC entry 346 (class 1259 OID 27274)
-- Name: equipos_modelo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.equipos_modelo (
    id integer NOT NULL,
    sku text,
    nombre text NOT NULL,
    fabricante text,
    modelo text,
    categoria text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.equipos_modelo OWNER TO postgres;

--
-- TOC entry 345 (class 1259 OID 27273)
-- Name: equipos_modelo_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.equipos_modelo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.equipos_modelo_id_seq OWNER TO postgres;

--
-- TOC entry 6979 (class 0 OID 0)
-- Dependencies: 345
-- Name: equipos_modelo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.equipos_modelo_id_seq OWNED BY public.equipos_modelo.id;


--
-- TOC entry 344 (class 1259 OID 27245)
-- Name: equipos_movimientos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.equipos_movimientos (
    id integer NOT NULL,
    equipo_id integer NOT NULL,
    movement_type character varying(20) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    reason text,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT equipos_movimientos_movement_type_check CHECK (((movement_type)::text = ANY ((ARRAY['entrada'::character varying, 'salida'::character varying, 'traslado'::character varying, 'reserva'::character varying])::text[]))),
    CONSTRAINT equipos_movimientos_quantity_check CHECK ((quantity > 0))
);


ALTER TABLE public.equipos_movimientos OWNER TO postgres;

--
-- TOC entry 343 (class 1259 OID 27244)
-- Name: equipos_movimientos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.equipos_movimientos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.equipos_movimientos_id_seq OWNER TO postgres;

--
-- TOC entry 6980 (class 0 OID 0)
-- Dependencies: 343
-- Name: equipos_movimientos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.equipos_movimientos_id_seq OWNED BY public.equipos_movimientos.id;


--
-- TOC entry 348 (class 1259 OID 27288)
-- Name: equipos_unidad; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.equipos_unidad (
    id integer NOT NULL,
    modelo_id integer,
    serial text NOT NULL,
    estado text DEFAULT 'disponible'::text NOT NULL,
    cliente_id integer,
    sucursal_id integer,
    ubicacion text,
    serial_pendiente boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    request_id integer
);


ALTER TABLE public.equipos_unidad OWNER TO postgres;

--
-- TOC entry 347 (class 1259 OID 27287)
-- Name: equipos_unidad_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.equipos_unidad_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.equipos_unidad_id_seq OWNER TO postgres;

--
-- TOC entry 6981 (class 0 OID 0)
-- Dependencies: 347
-- Name: equipos_unidad_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.equipos_unidad_id_seq OWNED BY public.equipos_unidad.id;


--
-- TOC entry 233 (class 1259 OID 16445)
-- Name: inventory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory (
    id integer NOT NULL,
    sku text,
    name text,
    quantity integer DEFAULT 0,
    last_updated timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.inventory OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 16453)
-- Name: inventory_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inventory_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inventory_id_seq OWNER TO postgres;

--
-- TOC entry 6982 (class 0 OID 0)
-- Dependencies: 234
-- Name: inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventory_id_seq OWNED BY public.inventory.id;


--
-- TOC entry 235 (class 1259 OID 16454)
-- Name: inventory_movements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_movements (
    id integer NOT NULL,
    inventory_id integer,
    type text,
    quantity integer,
    reason text,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    silver_tx_id text,
    movement_type character varying(20) DEFAULT 'entrada'::character varying,
    CONSTRAINT inventory_movements_movement_type_check CHECK (((movement_type)::text = ANY ((ARRAY['entrada'::character varying, 'salida'::character varying])::text[])))
);


ALTER TABLE public.inventory_movements OWNER TO postgres;

--
-- TOC entry 236 (class 1259 OID 16461)
-- Name: inventory_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inventory_movements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inventory_movements_id_seq OWNER TO postgres;

--
-- TOC entry 6983 (class 0 OID 0)
-- Dependencies: 236
-- Name: inventory_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventory_movements_id_seq OWNED BY public.inventory_movements.id;


--
-- TOC entry 416 (class 1259 OID 28935)
-- Name: migration_progress_business_case; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.migration_progress_business_case AS
 WITH field_metrics AS (
         SELECT 'business_case_type'::text AS canonical_field,
            'bc_purchase_type'::text AS legacy_field,
            count(*) FILTER (WHERE (equipment_purchase_requests.business_case_type IS NOT NULL)) AS rows_using_canonical,
            count(*) FILTER (WHERE (equipment_purchase_requests.bc_purchase_type IS NOT NULL)) AS rows_with_legacy_data,
            count(*) FILTER (WHERE ((equipment_purchase_requests.business_case_type IS NOT NULL) AND (equipment_purchase_requests.bc_purchase_type IS NULL))) AS rows_canonical_only,
            count(*) FILTER (WHERE ((equipment_purchase_requests.business_case_type IS NULL) AND (equipment_purchase_requests.bc_purchase_type IS NOT NULL))) AS rows_legacy_only,
            count(*) FILTER (WHERE ((equipment_purchase_requests.business_case_type IS NOT NULL) AND (equipment_purchase_requests.bc_purchase_type IS NOT NULL) AND ((equipment_purchase_requests.business_case_type)::text = (equipment_purchase_requests.bc_purchase_type)::text))) AS rows_consistent
           FROM public.equipment_purchase_requests
          WHERE ((equipment_purchase_requests.uses_modern_system = true) AND ((equipment_purchase_requests.bc_system_type)::text = 'modern'::text))
        UNION ALL
         SELECT 'calculation_mode'::text AS canonical_field,
            'bc_calculation_mode'::text AS legacy_field,
            count(*) FILTER (WHERE (equipment_purchase_requests.calculation_mode IS NOT NULL)) AS rows_using_canonical,
            count(*) FILTER (WHERE (equipment_purchase_requests.bc_calculation_mode IS NOT NULL)) AS rows_with_legacy_data,
            count(*) FILTER (WHERE ((equipment_purchase_requests.calculation_mode IS NOT NULL) AND (equipment_purchase_requests.bc_calculation_mode IS NULL))) AS rows_canonical_only,
            count(*) FILTER (WHERE ((equipment_purchase_requests.calculation_mode IS NULL) AND (equipment_purchase_requests.bc_calculation_mode IS NOT NULL))) AS rows_legacy_only,
            count(*) FILTER (WHERE ((equipment_purchase_requests.calculation_mode IS NOT NULL) AND (equipment_purchase_requests.bc_calculation_mode IS NOT NULL) AND ((equipment_purchase_requests.calculation_mode)::text = (equipment_purchase_requests.bc_calculation_mode)::text))) AS rows_consistent
           FROM public.equipment_purchase_requests
          WHERE ((equipment_purchase_requests.uses_modern_system = true) AND ((equipment_purchase_requests.bc_system_type)::text = 'modern'::text))
        UNION ALL
         SELECT 'includes_lis'::text AS canonical_field,
            'extra.lisIncludes'::text AS legacy_field,
            count(*) FILTER (WHERE (equipment_purchase_requests.includes_lis IS NOT NULL)) AS rows_using_canonical,
            count(*) FILTER (WHERE (equipment_purchase_requests.extra ? 'lisIncludes'::text)) AS rows_with_legacy_data,
            count(*) FILTER (WHERE ((equipment_purchase_requests.includes_lis IS NOT NULL) AND (NOT (equipment_purchase_requests.extra ? 'lisIncludes'::text)))) AS rows_canonical_only,
            count(*) FILTER (WHERE ((equipment_purchase_requests.includes_lis IS NULL) AND (equipment_purchase_requests.extra ? 'lisIncludes'::text))) AS rows_legacy_only,
            count(*) FILTER (WHERE ((equipment_purchase_requests.includes_lis IS NOT NULL) AND (equipment_purchase_requests.extra ? 'lisIncludes'::text) AND (equipment_purchase_requests.includes_lis = ((equipment_purchase_requests.extra ->> 'lisIncludes'::text))::boolean))) AS rows_consistent
           FROM public.equipment_purchase_requests
          WHERE ((equipment_purchase_requests.uses_modern_system = true) AND ((equipment_purchase_requests.bc_system_type)::text = 'modern'::text))
        UNION ALL
         SELECT 'deadline_months'::text AS canonical_field,
            'extra.requirementsDeadlineMonths'::text AS legacy_field,
            count(*) FILTER (WHERE (equipment_purchase_requests.deadline_months IS NOT NULL)) AS rows_using_canonical,
            count(*) FILTER (WHERE (equipment_purchase_requests.extra ? 'requirementsDeadlineMonths'::text)) AS rows_with_legacy_data,
            count(*) FILTER (WHERE ((equipment_purchase_requests.deadline_months IS NOT NULL) AND (NOT (equipment_purchase_requests.extra ? 'requirementsDeadlineMonths'::text)))) AS rows_canonical_only,
            count(*) FILTER (WHERE ((equipment_purchase_requests.deadline_months IS NULL) AND (equipment_purchase_requests.extra ? 'requirementsDeadlineMonths'::text))) AS rows_legacy_only,
            count(*) FILTER (WHERE ((equipment_purchase_requests.deadline_months IS NOT NULL) AND (equipment_purchase_requests.extra ? 'requirementsDeadlineMonths'::text) AND (equipment_purchase_requests.deadline_months = ((equipment_purchase_requests.extra ->> 'requirementsDeadlineMonths'::text))::integer))) AS rows_consistent
           FROM public.equipment_purchase_requests
          WHERE ((equipment_purchase_requests.uses_modern_system = true) AND ((equipment_purchase_requests.bc_system_type)::text = 'modern'::text))
        ), overall_stats AS (
         SELECT count(*) AS total_business_cases,
            count(*) FILTER (WHERE ((equipment_purchase_requests.uses_modern_system = true) AND ((equipment_purchase_requests.bc_system_type)::text = 'modern'::text))) AS modern_business_cases
           FROM public.equipment_purchase_requests
        )
 SELECT fm.canonical_field,
    fm.legacy_field,
    os.total_business_cases,
    os.modern_business_cases,
    fm.rows_using_canonical,
    fm.rows_with_legacy_data,
    fm.rows_canonical_only,
    fm.rows_legacy_only,
    fm.rows_consistent,
    round((((fm.rows_using_canonical)::numeric / (NULLIF(os.modern_business_cases, 0))::numeric) * (100)::numeric), 2) AS migration_percentage,
        CASE
            WHEN (fm.rows_using_canonical = os.modern_business_cases) THEN 'COMPLETE'::text
            WHEN (fm.rows_using_canonical > 0) THEN 'IN_PROGRESS'::text
            ELSE 'NOT_STARTED'::text
        END AS migration_status,
        CASE
            WHEN (fm.rows_legacy_only > 0) THEN '⚠️ LEGACY DEPENDENCY'::text
            WHEN (fm.rows_consistent < fm.rows_with_legacy_data) THEN '⚠️ INCONSISTENCY DETECTED'::text
            ELSE '✅ HEALTHY'::text
        END AS health_status,
    now() AS last_updated
   FROM field_metrics fm,
    overall_stats os;


ALTER VIEW public.migration_progress_business_case OWNER TO postgres;

--
-- TOC entry 399 (class 1259 OID 28600)
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    title character varying(255) NOT NULL,
    message text,
    type character varying(50) DEFAULT 'info'::character varying,
    source character varying(100),
    status character varying(20) DEFAULT 'unread'::character varying,
    priority integer DEFAULT 0,
    meta jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    read_at timestamp with time zone
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- TOC entry 398 (class 1259 OID 28599)
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO postgres;

--
-- TOC entry 6984 (class 0 OID 0)
-- Dependencies: 398
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- TOC entry 326 (class 1259 OID 26482)
-- Name: permisos_vacaciones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permisos_vacaciones (
    id integer NOT NULL,
    user_email text NOT NULL,
    user_fullname text,
    tipo_solicitud text DEFAULT 'vacaciones'::text NOT NULL,
    tipo_permiso text,
    subtipo_calamidad text,
    duracion_horas numeric(4,2),
    duracion_dias numeric(5,2),
    fecha_inicio date,
    fecha_fin date,
    es_recuperable boolean DEFAULT false,
    periodo_vacaciones text,
    justificacion_requerida text[],
    justificantes_urls text[],
    aprobacion_parcial_at timestamp with time zone,
    aprobacion_parcial_por text,
    aprobacion_final_at timestamp with time zone,
    aprobacion_final_por text,
    pdf_generado_url text,
    observaciones text[],
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    approver_role text,
    user_id integer,
    approver_id integer,
    department_id integer,
    fecha_regreso date,
    rejection_reason text,
    drive_doc_id text,
    drive_pdf_id text,
    drive_doc_link text,
    drive_pdf_link text,
    drive_folder_id text,
    CONSTRAINT permisos_vacaciones_check CHECK ((((tipo_solicitud = 'permiso'::text) AND (tipo_permiso = ANY (ARRAY['estudios'::text, 'personal'::text, 'salud'::text, 'calamidad'::text]))) OR (tipo_solicitud = 'vacaciones'::text))),
    CONSTRAINT permisos_vacaciones_check1 CHECK ((((tipo_permiso = 'calamidad'::text) AND (subtipo_calamidad IS NOT NULL) AND (length(btrim(subtipo_calamidad)) > 0)) OR (tipo_permiso <> 'calamidad'::text))),
    CONSTRAINT permisos_vacaciones_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'partially_approved'::text, 'pending_final'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT permisos_vacaciones_tipo_solicitud_check CHECK ((tipo_solicitud = ANY (ARRAY['permiso'::text, 'vacaciones'::text])))
);


ALTER TABLE public.permisos_vacaciones OWNER TO postgres;

--
-- TOC entry 325 (class 1259 OID 26481)
-- Name: permisos_vacaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.permisos_vacaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.permisos_vacaciones_id_seq OWNER TO postgres;

--
-- TOC entry 6985 (class 0 OID 0)
-- Dependencies: 325
-- Name: permisos_vacaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.permisos_vacaciones_id_seq OWNED BY public.permisos_vacaciones.id;


--
-- TOC entry 287 (class 1259 OID 17430)
-- Name: personnel_request_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.personnel_request_comments (
    id integer NOT NULL,
    personnel_request_id integer NOT NULL,
    user_id integer NOT NULL,
    comment text NOT NULL,
    is_internal boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.personnel_request_comments OWNER TO postgres;

--
-- TOC entry 286 (class 1259 OID 17429)
-- Name: personnel_request_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.personnel_request_comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.personnel_request_comments_id_seq OWNER TO postgres;

--
-- TOC entry 6986 (class 0 OID 0)
-- Dependencies: 286
-- Name: personnel_request_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.personnel_request_comments_id_seq OWNED BY public.personnel_request_comments.id;


--
-- TOC entry 285 (class 1259 OID 17407)
-- Name: personnel_request_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.personnel_request_history (
    id integer NOT NULL,
    personnel_request_id integer NOT NULL,
    previous_status character varying(50),
    new_status character varying(50) NOT NULL,
    changed_by integer,
    change_reason text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.personnel_request_history OWNER TO postgres;

--
-- TOC entry 284 (class 1259 OID 17406)
-- Name: personnel_request_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.personnel_request_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.personnel_request_history_id_seq OWNER TO postgres;

--
-- TOC entry 6987 (class 0 OID 0)
-- Dependencies: 284
-- Name: personnel_request_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.personnel_request_history_id_seq OWNED BY public.personnel_request_history.id;


--
-- TOC entry 283 (class 1259 OID 17351)
-- Name: personnel_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.personnel_requests (
    id integer NOT NULL,
    request_number character varying(50) NOT NULL,
    requester_id integer NOT NULL,
    department_id integer,
    position_title character varying(255) NOT NULL,
    position_type character varying(50) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    start_date date,
    end_date date,
    education_level character varying(100) NOT NULL,
    career_field character varying(255),
    years_experience integer,
    specific_skills text,
    technical_knowledge text,
    soft_skills text,
    certifications text,
    languages text,
    main_responsibilities text NOT NULL,
    specific_functions text,
    reports_to character varying(255),
    supervises character varying(255),
    work_schedule character varying(100),
    salary_range character varying(100),
    benefits text,
    work_location character varying(255),
    justification text NOT NULL,
    urgency_level character varying(50) DEFAULT 'normal'::character varying,
    status character varying(50) DEFAULT 'pendiente'::character varying,
    priority integer DEFAULT 3,
    approved_by_manager integer,
    approved_by_hr integer,
    approved_by_finance integer,
    manager_approval_date timestamp without time zone,
    hr_approval_date timestamp without time zone,
    finance_approval_date timestamp without time zone,
    manager_notes text,
    hr_notes text,
    rejection_reason text,
    drive_folder_id character varying(255),
    job_description_file_id character varying(255),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    completed_at timestamp without time zone,
    CONSTRAINT personnel_requests_position_type_check CHECK (((position_type)::text = ANY ((ARRAY['permanente'::character varying, 'temporal'::character varying, 'reemplazo'::character varying, 'proyecto'::character varying])::text[]))),
    CONSTRAINT personnel_requests_priority_check CHECK (((priority >= 1) AND (priority <= 5))),
    CONSTRAINT personnel_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pendiente'::character varying, 'en_revision'::character varying, 'aprobada'::character varying, 'rechazada'::character varying, 'en_proceso'::character varying, 'completada'::character varying, 'cancelada'::character varying])::text[]))),
    CONSTRAINT personnel_requests_urgency_level_check CHECK (((urgency_level)::text = ANY ((ARRAY['baja'::character varying, 'normal'::character varying, 'alta'::character varying, 'urgente'::character varying])::text[]))),
    CONSTRAINT valid_date_range CHECK (((end_date IS NULL) OR (end_date >= start_date)))
);


ALTER TABLE public.personnel_requests OWNER TO postgres;

--
-- TOC entry 6988 (class 0 OID 0)
-- Dependencies: 283
-- Name: TABLE personnel_requests; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.personnel_requests IS 'Solicitudes de personal con perfil profesional completo';


--
-- TOC entry 6989 (class 0 OID 0)
-- Dependencies: 283
-- Name: COLUMN personnel_requests.position_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.personnel_requests.position_type IS 'Tipo de contratación: permanente, temporal, reemplazo, proyecto';


--
-- TOC entry 6990 (class 0 OID 0)
-- Dependencies: 283
-- Name: COLUMN personnel_requests.urgency_level; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.personnel_requests.urgency_level IS 'Nivel de urgencia: baja, normal, alta, urgente';


--
-- TOC entry 6991 (class 0 OID 0)
-- Dependencies: 283
-- Name: COLUMN personnel_requests.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.personnel_requests.status IS 'Estado: pendiente, en_revision, aprobada, rechazada, en_proceso, completada, cancelada';


--
-- TOC entry 282 (class 1259 OID 17350)
-- Name: personnel_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.personnel_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.personnel_requests_id_seq OWNER TO postgres;

--
-- TOC entry 6992 (class 0 OID 0)
-- Dependencies: 282
-- Name: personnel_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.personnel_requests_id_seq OWNED BY public.personnel_requests.id;


--
-- TOC entry 352 (class 1259 OID 27409)
-- Name: private_purchase_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.private_purchase_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_by integer,
    created_by_email character varying(255),
    client_request_id integer,
    client_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    client_type character varying(64) DEFAULT 'privado'::character varying,
    equipment jsonb DEFAULT '[]'::jsonb NOT NULL,
    status public.private_purchase_status_enum DEFAULT 'pending_commercial'::public.private_purchase_status_enum NOT NULL,
    offer_document_id character varying(255),
    offer_signed_document_id character varying(255),
    offer_signed_uploaded_at timestamp with time zone,
    backoffice_approved_at timestamp with time zone,
    commercial_accepted_offer_at timestamp with time zone,
    signed_offer_received_at timestamp with time zone,
    client_registered_at timestamp with time zone,
    forwarded_to_acp_at timestamp with time zone,
    equipment_purchase_request_id uuid,
    drive_folder_id character varying(255),
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    offer_valid_until timestamp with time zone,
    offer_kind character varying(32) DEFAULT 'venta'::character varying,
    comodato_document_id character varying(255)
);


ALTER TABLE public.private_purchase_requests OWNER TO postgres;

--
-- TOC entry 6993 (class 0 OID 0)
-- Dependencies: 352
-- Name: TABLE private_purchase_requests; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.private_purchase_requests IS 'Solicitudes privadas de compra que recorren el flujo comercial → backoffice → ACP';


--
-- TOC entry 6994 (class 0 OID 0)
-- Dependencies: 352
-- Name: COLUMN private_purchase_requests.client_snapshot; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.private_purchase_requests.client_snapshot IS 'Snapshot JSON del cliente (temp o registrado) provisto por el asesor comercial';


--
-- TOC entry 6995 (class 0 OID 0)
-- Dependencies: 352
-- Name: COLUMN private_purchase_requests.equipment; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.private_purchase_requests.equipment IS 'Lista de equipos seleccionados para esta solicitud (solo activos sin cliente/serie asignada)';


--
-- TOC entry 6996 (class 0 OID 0)
-- Dependencies: 352
-- Name: COLUMN private_purchase_requests.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.private_purchase_requests.status IS 'Estado de la solicitud privada durante la negociación';


--
-- TOC entry 6997 (class 0 OID 0)
-- Dependencies: 352
-- Name: COLUMN private_purchase_requests.offer_document_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.private_purchase_requests.offer_document_id IS 'Document ID de la oferta generada en Drive';


--
-- TOC entry 6998 (class 0 OID 0)
-- Dependencies: 352
-- Name: COLUMN private_purchase_requests.offer_signed_document_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.private_purchase_requests.offer_signed_document_id IS 'Document ID de la oferta firmada cargada por el comercial';


--
-- TOC entry 6999 (class 0 OID 0)
-- Dependencies: 352
-- Name: COLUMN private_purchase_requests.forwarded_to_acp_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.private_purchase_requests.forwarded_to_acp_at IS 'Fecha en que backoffice envió la solicitud a ACP tras registro del cliente';


--
-- TOC entry 7000 (class 0 OID 0)
-- Dependencies: 352
-- Name: COLUMN private_purchase_requests.offer_valid_until; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.private_purchase_requests.offer_valid_until IS 'Fecha de expiración de la oferta propuesta';


--
-- TOC entry 7001 (class 0 OID 0)
-- Dependencies: 352
-- Name: COLUMN private_purchase_requests.offer_kind; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.private_purchase_requests.offer_kind IS 'Tipo de solicitud: venta, prestamo o comodato';


--
-- TOC entry 7002 (class 0 OID 0)
-- Dependencies: 352
-- Name: COLUMN private_purchase_requests.comodato_document_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.private_purchase_requests.comodato_document_id IS 'Documento de estadísticas cargado para comodatos, almacenado en Drive';


--
-- TOC entry 390 (class 1259 OID 28477)
-- Name: prospect_visits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.prospect_visits (
    id integer NOT NULL,
    user_email text NOT NULL,
    prospect_name text NOT NULL,
    visit_date date DEFAULT CURRENT_DATE NOT NULL,
    status text NOT NULL,
    check_in_time timestamp with time zone,
    check_out_time timestamp with time zone,
    check_in_lat double precision,
    check_in_lng double precision,
    check_out_lat double precision,
    check_out_lng double precision,
    observations text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT prospect_visits_status_check CHECK ((status = ANY (ARRAY['in_visit'::text, 'visited'::text])))
);


ALTER TABLE public.prospect_visits OWNER TO postgres;

--
-- TOC entry 389 (class 1259 OID 28476)
-- Name: prospect_visits_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.prospect_visits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.prospect_visits_id_seq OWNER TO postgres;

--
-- TOC entry 7003 (class 0 OID 0)
-- Dependencies: 389
-- Name: prospect_visits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.prospect_visits_id_seq OWNED BY public.prospect_visits.id;


--
-- TOC entry 237 (class 1259 OID 16462)
-- Name: request_approvals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.request_approvals (
    id integer NOT NULL,
    request_id integer,
    approver_id integer,
    token text,
    token_expires_at timestamp without time zone,
    used boolean DEFAULT false,
    action text,
    comments text,
    acted_at timestamp without time zone
);


ALTER TABLE public.request_approvals OWNER TO postgres;

--
-- TOC entry 238 (class 1259 OID 16469)
-- Name: request_approvals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.request_approvals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.request_approvals_id_seq OWNER TO postgres;

--
-- TOC entry 7004 (class 0 OID 0)
-- Dependencies: 238
-- Name: request_approvals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.request_approvals_id_seq OWNED BY public.request_approvals.id;


--
-- TOC entry 239 (class 1259 OID 16470)
-- Name: request_attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.request_attachments (
    id integer NOT NULL,
    request_id integer,
    drive_file_id text,
    filename text,
    mimetype text,
    uploaded_by integer,
    created_at timestamp without time zone DEFAULT now(),
    drive_link text,
    mime_type text,
    size bigint,
    title text
);


ALTER TABLE public.request_attachments OWNER TO postgres;

--
-- TOC entry 240 (class 1259 OID 16477)
-- Name: request_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.request_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.request_attachments_id_seq OWNER TO postgres;

--
-- TOC entry 7005 (class 0 OID 0)
-- Dependencies: 240
-- Name: request_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.request_attachments_id_seq OWNED BY public.request_attachments.id;


--
-- TOC entry 241 (class 1259 OID 16478)
-- Name: request_status_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.request_status_history (
    id bigint NOT NULL,
    request_id integer NOT NULL,
    old_status text,
    new_status text NOT NULL,
    changed_by integer,
    changed_at timestamp without time zone DEFAULT now(),
    note text
);


ALTER TABLE public.request_status_history OWNER TO postgres;

--
-- TOC entry 7006 (class 0 OID 0)
-- Dependencies: 241
-- Name: TABLE request_status_history; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.request_status_history IS 'Historial completo de estados por request.';


--
-- TOC entry 242 (class 1259 OID 16487)
-- Name: request_status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.request_status_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.request_status_history_id_seq OWNER TO postgres;

--
-- TOC entry 7007 (class 0 OID 0)
-- Dependencies: 242
-- Name: request_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.request_status_history_id_seq OWNED BY public.request_status_history.id;


--
-- TOC entry 243 (class 1259 OID 16488)
-- Name: request_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.request_types (
    id integer NOT NULL,
    title text NOT NULL,
    drive_folder_id text,
    schema jsonb,
    created_at timestamp without time zone DEFAULT now(),
    code text NOT NULL,
    version text,
    reference text,
    template_doc_id text
);


ALTER TABLE public.request_types OWNER TO postgres;

--
-- TOC entry 244 (class 1259 OID 16497)
-- Name: request_types_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.request_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.request_types_id_seq OWNER TO postgres;

--
-- TOC entry 7008 (class 0 OID 0)
-- Dependencies: 244
-- Name: request_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.request_types_id_seq OWNED BY public.request_types.id;


--
-- TOC entry 245 (class 1259 OID 16498)
-- Name: request_versions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.request_versions (
    id integer NOT NULL,
    request_id integer,
    version_number integer,
    payload jsonb,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.request_versions OWNER TO postgres;

--
-- TOC entry 246 (class 1259 OID 16505)
-- Name: request_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.request_versions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.request_versions_id_seq OWNER TO postgres;

--
-- TOC entry 7009 (class 0 OID 0)
-- Dependencies: 246
-- Name: request_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.request_versions_id_seq OWNED BY public.request_versions.id;


--
-- TOC entry 247 (class 1259 OID 16506)
-- Name: requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.requests (
    id integer NOT NULL,
    requester_id integer NOT NULL,
    status text DEFAULT 'pendiente'::text,
    version_number integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    request_group_id uuid,
    request_type_id integer,
    payload jsonb,
    acta_generada boolean DEFAULT false,
    CONSTRAINT chk_requests_status CHECK ((status = ANY (ARRAY['pendiente'::text, 'en_revision'::text, 'aprobado'::text, 'rechazado'::text, 'cancelado'::text])))
);


ALTER TABLE public.requests OWNER TO postgres;

--
-- TOC entry 248 (class 1259 OID 16519)
-- Name: requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.requests_id_seq OWNER TO postgres;

--
-- TOC entry 7010 (class 0 OID 0)
-- Dependencies: 248
-- Name: requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.requests_id_seq OWNED BY public.requests.id;


--
-- TOC entry 320 (class 1259 OID 26390)
-- Name: scheduled_visits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scheduled_visits (
    id integer NOT NULL,
    schedule_id integer NOT NULL,
    client_request_id integer NOT NULL,
    planned_date date NOT NULL,
    city text NOT NULL,
    priority integer DEFAULT 1,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.scheduled_visits OWNER TO postgres;

--
-- TOC entry 319 (class 1259 OID 26389)
-- Name: scheduled_visits_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.scheduled_visits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.scheduled_visits_id_seq OWNER TO postgres;

--
-- TOC entry 7011 (class 0 OID 0)
-- Dependencies: 319
-- Name: scheduled_visits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.scheduled_visits_id_seq OWNED BY public.scheduled_visits.id;


--
-- TOC entry 414 (class 1259 OID 28831)
-- Name: signature_dashboard; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.signature_dashboard AS
 WITH per_document AS (
         SELECT d.id,
            d.signature_status,
            d.is_locked,
            d.created_at,
            min(dsa.signed_at) AS first_signed_at
           FROM (public.documents d
             LEFT JOIN public.document_signatures_advanced dsa ON ((dsa.document_id = d.id)))
          GROUP BY d.id, d.signature_status, d.is_locked, d.created_at
        )
 SELECT count(*) AS total_documents,
    count(*) FILTER (WHERE ((signature_status)::text = 'signed'::text)) AS signed_documents,
    count(*) FILTER (WHERE (is_locked IS TRUE)) AS locked_documents,
    avg((EXTRACT(epoch FROM (first_signed_at - (created_at)::timestamp with time zone)) / 3600.0)) AS avg_signing_time_hours
   FROM per_document;


ALTER VIEW public.signature_dashboard OWNER TO postgres;

--
-- TOC entry 7012 (class 0 OID 0)
-- Dependencies: 414
-- Name: VIEW signature_dashboard; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.signature_dashboard IS 'Dashboard metrics for document signing system';


--
-- TOC entry 314 (class 1259 OID 26320)
-- Name: technical_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.technical_documents (
    id integer NOT NULL,
    document_type character varying(100) NOT NULL,
    document_code character varying(50) NOT NULL,
    user_id integer NOT NULL,
    user_email character varying(255),
    user_name character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    form_data jsonb NOT NULL,
    file_name character varying(500),
    file_path text,
    drive_file_id character varying(255),
    drive_folder_id character varying(255),
    equipment_name character varying(255),
    equipment_serial character varying(100),
    status character varying(50) DEFAULT 'generated'::character varying,
    notes text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.technical_documents OWNER TO postgres;

--
-- TOC entry 7014 (class 0 OID 0)
-- Dependencies: 314
-- Name: TABLE technical_documents; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.technical_documents IS 'Registro de documentos técnicos generados por el área de Servicio Técnico';


--
-- TOC entry 7015 (class 0 OID 0)
-- Dependencies: 314
-- Name: COLUMN technical_documents.document_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.technical_documents.document_type IS 'Tipo de documento: DISINFECTION, TRAINING_ATTENDANCE, etc.';


--
-- TOC entry 7016 (class 0 OID 0)
-- Dependencies: 314
-- Name: COLUMN technical_documents.document_code; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.technical_documents.document_code IS 'Código del formato (Ej: F.ST-02, F.ST-05)';


--
-- TOC entry 7017 (class 0 OID 0)
-- Dependencies: 314
-- Name: COLUMN technical_documents.form_data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.technical_documents.form_data IS 'Datos del formulario en formato JSON';


--
-- TOC entry 7018 (class 0 OID 0)
-- Dependencies: 314
-- Name: COLUMN technical_documents.drive_file_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.technical_documents.drive_file_id IS 'ID del archivo en Google Drive';


--
-- TOC entry 313 (class 1259 OID 26319)
-- Name: technical_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.technical_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.technical_documents_id_seq OWNER TO postgres;

--
-- TOC entry 7019 (class 0 OID 0)
-- Dependencies: 313
-- Name: technical_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.technical_documents_id_seq OWNED BY public.technical_documents.id;


--
-- TOC entry 324 (class 1259 OID 26445)
-- Name: travel_segments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.travel_segments (
    id integer NOT NULL,
    user_email text NOT NULL,
    from_client_id integer,
    to_client_id integer,
    from_lat double precision,
    from_lng double precision,
    to_lat double precision,
    to_lng double precision,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    duration_minutes integer NOT NULL,
    distance_km double precision,
    avg_speed_kmh double precision,
    travel_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.travel_segments OWNER TO postgres;

--
-- TOC entry 323 (class 1259 OID 26444)
-- Name: travel_segments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.travel_segments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.travel_segments_id_seq OWNER TO postgres;

--
-- TOC entry 7020 (class 0 OID 0)
-- Dependencies: 323
-- Name: travel_segments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.travel_segments_id_seq OWNED BY public.travel_segments.id;


--
-- TOC entry 276 (class 1259 OID 17170)
-- Name: user_attendance_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_attendance_records (
    id integer NOT NULL,
    user_id integer NOT NULL,
    date date NOT NULL,
    entry_time timestamp with time zone,
    lunch_start_time timestamp with time zone,
    lunch_end_time timestamp with time zone,
    exit_time timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    entry_location text,
    lunch_start_location text,
    lunch_end_location text,
    exit_location text
);


ALTER TABLE public.user_attendance_records OWNER TO postgres;

--
-- TOC entry 7021 (class 0 OID 0)
-- Dependencies: 276
-- Name: TABLE user_attendance_records; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_attendance_records IS 'Daily attendance records per user with entry, lunch, and exit times. Integrates with user signatures from lopdp_internal_signature_file_id.';


--
-- TOC entry 7022 (class 0 OID 0)
-- Dependencies: 276
-- Name: COLUMN user_attendance_records.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_attendance_records.user_id IS 'Foreign key to users table';


--
-- TOC entry 7023 (class 0 OID 0)
-- Dependencies: 276
-- Name: COLUMN user_attendance_records.date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_attendance_records.date IS 'Date of the attendance record (without time component)';


--
-- TOC entry 7024 (class 0 OID 0)
-- Dependencies: 276
-- Name: COLUMN user_attendance_records.entry_time; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_attendance_records.entry_time IS 'Timestamp when user clocked in for the day';


--
-- TOC entry 7025 (class 0 OID 0)
-- Dependencies: 276
-- Name: COLUMN user_attendance_records.lunch_start_time; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_attendance_records.lunch_start_time IS 'Timestamp when user started lunch break (requires signature)';


--
-- TOC entry 7026 (class 0 OID 0)
-- Dependencies: 276
-- Name: COLUMN user_attendance_records.lunch_end_time; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_attendance_records.lunch_end_time IS 'Timestamp when user returned from lunch break';


--
-- TOC entry 7027 (class 0 OID 0)
-- Dependencies: 276
-- Name: COLUMN user_attendance_records.exit_time; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_attendance_records.exit_time IS 'Timestamp when user clocked out for the day (requires signature)';


--
-- TOC entry 7028 (class 0 OID 0)
-- Dependencies: 276
-- Name: COLUMN user_attendance_records.notes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_attendance_records.notes IS 'Optional notes for special circumstances (late arrival, early departure, etc.)';


--
-- TOC entry 275 (class 1259 OID 17169)
-- Name: user_attendance_records_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_attendance_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_attendance_records_id_seq OWNER TO postgres;

--
-- TOC entry 7029 (class 0 OID 0)
-- Dependencies: 275
-- Name: user_attendance_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_attendance_records_id_seq OWNED BY public.user_attendance_records.id;


--
-- TOC entry 280 (class 1259 OID 17298)
-- Name: user_gmail_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_gmail_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    email character varying(255) NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    expiry_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.user_gmail_tokens OWNER TO postgres;

--
-- TOC entry 7030 (class 0 OID 0)
-- Dependencies: 280
-- Name: TABLE user_gmail_tokens; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_gmail_tokens IS 'Tokens OAuth 2.0 de Gmail para envío de emails por usuario';


--
-- TOC entry 7031 (class 0 OID 0)
-- Dependencies: 280
-- Name: COLUMN user_gmail_tokens.access_token; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_gmail_tokens.access_token IS 'Token de acceso temporal de Gmail API';


--
-- TOC entry 7032 (class 0 OID 0)
-- Dependencies: 280
-- Name: COLUMN user_gmail_tokens.refresh_token; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_gmail_tokens.refresh_token IS 'Token para renovar el access_token automáticamente';


--
-- TOC entry 7033 (class 0 OID 0)
-- Dependencies: 280
-- Name: COLUMN user_gmail_tokens.expiry_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_gmail_tokens.expiry_date IS 'Fecha de expiración del access_token';


--
-- TOC entry 279 (class 1259 OID 17297)
-- Name: user_gmail_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_gmail_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_gmail_tokens_id_seq OWNER TO postgres;

--
-- TOC entry 7034 (class 0 OID 0)
-- Dependencies: 279
-- Name: user_gmail_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_gmail_tokens_id_seq OWNED BY public.user_gmail_tokens.id;


--
-- TOC entry 274 (class 1259 OID 17155)
-- Name: user_lopdp_consents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_lopdp_consents (
    id integer NOT NULL,
    user_id integer,
    user_email character varying(255) NOT NULL,
    status character varying(50) NOT NULL,
    pdf_file_id character varying(255),
    signature_file_id character varying(255),
    ip character varying(64),
    user_agent text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_lopdp_consents OWNER TO postgres;

--
-- TOC entry 273 (class 1259 OID 17154)
-- Name: user_lopdp_consents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_lopdp_consents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_lopdp_consents_id_seq OWNER TO postgres;

--
-- TOC entry 7035 (class 0 OID 0)
-- Dependencies: 273
-- Name: user_lopdp_consents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_lopdp_consents_id_seq OWNED BY public.user_lopdp_consents.id;


--
-- TOC entry 401 (class 1259 OID 28624)
-- Name: user_profile; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_profile (
    id integer NOT NULL,
    user_id integer NOT NULL,
    avatar_url text,
    avatar_drive_id text,
    metadata jsonb DEFAULT '{}'::jsonb,
    preferences jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_profile OWNER TO postgres;

--
-- TOC entry 400 (class 1259 OID 28623)
-- Name: user_profile_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_profile_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_profile_id_seq OWNER TO postgres;

--
-- TOC entry 7036 (class 0 OID 0)
-- Dependencies: 400
-- Name: user_profile_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_profile_id_seq OWNED BY public.user_profile.id;


--
-- TOC entry 263 (class 1259 OID 16947)
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_sessions (
    id integer NOT NULL,
    user_email character varying(255) NOT NULL,
    login_time timestamp without time zone DEFAULT now(),
    logout_time timestamp without time zone,
    ip character varying(64),
    user_agent text,
    refresh_token text
);


ALTER TABLE public.user_sessions OWNER TO postgres;

--
-- TOC entry 262 (class 1259 OID 16946)
-- Name: user_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_sessions_id_seq OWNER TO postgres;

--
-- TOC entry 7037 (class 0 OID 0)
-- Dependencies: 262
-- Name: user_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_sessions_id_seq OWNED BY public.user_sessions.id;


--
-- TOC entry 249 (class 1259 OID 16520)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    google_id text,
    email text NOT NULL,
    name text,
    department_id integer,
    role text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    fullname text,
    lopdp_internal_status character varying(50) DEFAULT 'granted'::character varying NOT NULL,
    lopdp_internal_signed_at timestamp without time zone,
    lopdp_internal_pdf_file_id character varying(255),
    lopdp_internal_signature_file_id character varying(255),
    lopdp_internal_ip character varying(64),
    lopdp_internal_user_agent text,
    lopdp_internal_notes text,
    can_sign_documents boolean DEFAULT false,
    signature_role character varying(100),
    signature_certificate_id character varying(255)
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 7038 (class 0 OID 0)
-- Dependencies: 249
-- Name: COLUMN users.can_sign_documents; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.can_sign_documents IS 'Whether user has permission to sign documents';


--
-- TOC entry 7039 (class 0 OID 0)
-- Dependencies: 249
-- Name: COLUMN users.signature_role; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.signature_role IS 'Role for signature authorization (DPD, Manager, etc.)';


--
-- TOC entry 7040 (class 0 OID 0)
-- Dependencies: 249
-- Name: COLUMN users.signature_certificate_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.signature_certificate_id IS 'ID of digital certificate for qualified signatures';


--
-- TOC entry 250 (class 1259 OID 16530)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 7041 (class 0 OID 0)
-- Dependencies: 250
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 383 (class 1259 OID 28386)
-- Name: v_bc_complete; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_bc_complete AS
 SELECT m.id,
    m.bc_number,
    m.client_id,
    m.client_name,
    m.bc_type,
    m.duration_years,
    m.target_margin_percentage,
    m.process_code,
    m.contract_object,
    m.current_stage,
    m.economic_data_complete,
    m.operational_data_complete,
    m.lis_data_complete,
    m.delivery_plan_complete,
    m.calculated_roi_percentage,
    m.calculated_payback_months,
    m.calculated_monthly_margin,
    m.calculated_annual_margin,
    m.calculated_monthly_revenue,
    m.calculated_annual_revenue,
    m.calculated_monthly_cost,
    m.calculated_annual_cost,
    m.total_investment,
    m.equipment_investment,
    m.has_inconsistencies,
    m.inconsistency_details,
    m.risk_level,
    m.created_by,
    m.created_at,
    m.updated_at,
    m.approved_by,
    m.approved_at,
    m.rejected_by,
    m.rejected_at,
    m.rejection_reason,
    e.equipment_id,
    e.equipment_name,
    e.equipment_cost,
    e.calculation_mode,
    o.work_days_per_week,
    o.shifts_per_day,
    o.hours_per_shift,
    o.installation_location,
    o.delivery_type,
    l.includes_lis,
    l.lis_provider,
    l.monthly_patients,
    ( SELECT count(*) AS count
           FROM public.bc_determinations
          WHERE (bc_determinations.bc_master_id = m.id)) AS determination_count,
    ( SELECT count(*) AS count
           FROM public.bc_investments
          WHERE (bc_investments.bc_master_id = m.id)) AS investment_count,
    ( SELECT count(*) AS count
           FROM public.bc_validations
          WHERE ((bc_validations.bc_master_id = m.id) AND ((bc_validations.severity)::text = 'error'::text) AND (NOT bc_validations.resolved))) AS error_count,
    ( SELECT count(*) AS count
           FROM public.bc_validations
          WHERE ((bc_validations.bc_master_id = m.id) AND ((bc_validations.severity)::text = 'warning'::text) AND (NOT bc_validations.resolved))) AS warning_count
   FROM (((public.bc_master m
     LEFT JOIN public.bc_economic_data e ON ((e.bc_master_id = m.id)))
     LEFT JOIN public.bc_operational_data o ON ((o.bc_master_id = m.id)))
     LEFT JOIN public.bc_lis_data l ON ((l.bc_master_id = m.id)));


ALTER VIEW public.v_bc_complete OWNER TO postgres;

--
-- TOC entry 7042 (class 0 OID 0)
-- Dependencies: 383
-- Name: VIEW v_bc_complete; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.v_bc_complete IS 'Vista completa del BC con todos los módulos';


--
-- TOC entry 355 (class 1259 OID 27528)
-- Name: v_business_cases; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_business_cases AS
 SELECT id AS business_case_id,
    client_name,
    client_id,
    bc_purchase_type,
    status,
    bc_stage,
    bc_progress,
    bc_duration_years,
    bc_equipment_cost,
    bc_target_margin_percentage,
    bc_calculation_mode,
    bc_show_roi,
    bc_show_margin,
    assigned_to_email,
    assigned_to_name,
    drive_folder_id,
    extra,
    modern_bc_metadata,
    created_at,
    updated_at,
    created_by,
    bc_created_at,
    uses_modern_system,
    bc_system_type
   FROM public.equipment_purchase_requests
  WHERE ((uses_modern_system = true) AND ((bc_system_type)::text = 'modern'::text));


ALTER VIEW public.v_business_cases OWNER TO postgres;

--
-- TOC entry 7043 (class 0 OID 0)
-- Dependencies: 355
-- Name: VIEW v_business_cases; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.v_business_cases IS 'Vista de Business Cases de comodatos (públicos y privados)';


--
-- TOC entry 358 (class 1259 OID 27543)
-- Name: v_business_cases_complete; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_business_cases_complete AS
 SELECT business_case_id,
    client_name,
    client_id,
    bc_purchase_type,
    status,
    bc_stage,
    bc_progress,
    bc_duration_years,
    bc_equipment_cost,
    bc_target_margin_percentage,
    bc_calculation_mode,
    bc_show_roi,
    bc_show_margin,
    assigned_to_email,
    assigned_to_name,
    drive_folder_id,
    extra,
    modern_bc_metadata,
    created_at,
    updated_at,
    created_by,
    bc_created_at,
    uses_modern_system,
    bc_system_type
   FROM public.v_business_cases;


ALTER VIEW public.v_business_cases_complete OWNER TO postgres;

--
-- TOC entry 7044 (class 0 OID 0)
-- Dependencies: 358
-- Name: VIEW v_business_cases_complete; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.v_business_cases_complete IS 'Vista completa de Business Cases (alias de v_business_cases)';


--
-- TOC entry 357 (class 1259 OID 27538)
-- Name: v_business_cases_private; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_business_cases_private AS
 SELECT business_case_id,
    client_name,
    client_id,
    bc_purchase_type,
    status,
    bc_stage,
    bc_progress,
    bc_duration_years,
    bc_equipment_cost,
    bc_target_margin_percentage,
    bc_calculation_mode,
    bc_show_roi,
    bc_show_margin,
    assigned_to_email,
    assigned_to_name,
    drive_folder_id,
    extra,
    modern_bc_metadata,
    created_at,
    updated_at,
    created_by,
    bc_created_at,
    uses_modern_system,
    bc_system_type
   FROM public.v_business_cases
  WHERE ((bc_purchase_type)::text = 'comodato_privado'::text);


ALTER VIEW public.v_business_cases_private OWNER TO postgres;

--
-- TOC entry 7045 (class 0 OID 0)
-- Dependencies: 357
-- Name: VIEW v_business_cases_private; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.v_business_cases_private IS 'Vista de comodatos privados (clientes privados)';


--
-- TOC entry 356 (class 1259 OID 27533)
-- Name: v_business_cases_public; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_business_cases_public AS
 SELECT business_case_id,
    client_name,
    client_id,
    bc_purchase_type,
    status,
    bc_stage,
    bc_progress,
    bc_duration_years,
    bc_equipment_cost,
    bc_target_margin_percentage,
    bc_calculation_mode,
    bc_show_roi,
    bc_show_margin,
    assigned_to_email,
    assigned_to_name,
    drive_folder_id,
    extra,
    modern_bc_metadata,
    created_at,
    updated_at,
    created_by,
    bc_created_at,
    uses_modern_system,
    bc_system_type
   FROM public.v_business_cases
  WHERE ((bc_purchase_type)::text = 'comodato_publico'::text);


ALTER VIEW public.v_business_cases_public OWNER TO postgres;

--
-- TOC entry 7046 (class 0 OID 0)
-- Dependencies: 356
-- Name: VIEW v_business_cases_public; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.v_business_cases_public IS 'Vista de comodatos públicos (licitaciones)';


--
-- TOC entry 311 (class 1259 OID 26271)
-- Name: v_client_inventory; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_client_inventory AS
 SELECT cd.id,
    cd.business_case_id,
    ep.client_name,
    d.name AS determination_name,
    cd.annual_negotiated_quantity,
    cd.consumed_quantity,
    cd.remaining_quantity,
    round((((cd.remaining_quantity)::numeric / (cd.annual_negotiated_quantity)::numeric) * (100)::numeric), 2) AS percentage_remaining,
    cd.status,
    cd.alert_threshold_yellow,
    cd.alert_threshold_red,
        CASE
            WHEN ((((cd.remaining_quantity)::numeric / (cd.annual_negotiated_quantity)::numeric) * (100)::numeric) <= (cd.alert_threshold_red)::numeric) THEN 'red'::text
            WHEN ((((cd.remaining_quantity)::numeric / (cd.annual_negotiated_quantity)::numeric) * (100)::numeric) <= (cd.alert_threshold_yellow)::numeric) THEN 'yellow'::text
            ELSE 'green'::text
        END AS alert_level
   FROM ((public.contract_determinations cd
     JOIN public.equipment_purchase_requests ep ON ((cd.business_case_id = ep.id)))
     JOIN public.catalog_determinations d ON ((cd.determination_id = d.id)))
  WHERE ((cd.status)::text = 'active'::text)
  ORDER BY cd.business_case_id, d.name;


ALTER VIEW public.v_client_inventory OWNER TO postgres;

--
-- TOC entry 259 (class 1259 OID 16583)
-- Name: equipos; Type: TABLE; Schema: servicio; Owner: postgres
--

CREATE TABLE servicio.equipos (
    id_equipo integer NOT NULL,
    nombre text NOT NULL,
    modelo text,
    fabricante text,
    categoria text,
    descripcion text,
    serie text,
    ubicacion_actual text,
    fecha_instalacion date,
    estado text DEFAULT 'operativo'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    code character varying(50),
    manufacturer character varying(255),
    category_type character varying(100),
    capacity_per_hour integer,
    max_daily_capacity integer,
    installation_days integer DEFAULT 7,
    training_hours integer DEFAULT 16,
    warranty_months integer DEFAULT 12,
    base_price numeric(12,2),
    maintenance_cost numeric(12,2),
    technical_specs jsonb DEFAULT '{}'::jsonb,
    notes text,
    created_by integer,
    updated_by integer,
    default_calculation_formula jsonb,
    calculation_engine character varying(50) DEFAULT 'standard'::character varying,
    CONSTRAINT equipos_estado_check CHECK ((estado = ANY (ARRAY['operativo'::text, 'en_mantenimiento'::text, 'fuera_de_servicio'::text])))
);


ALTER TABLE servicio.equipos OWNER TO postgres;

--
-- TOC entry 7047 (class 0 OID 0)
-- Dependencies: 259
-- Name: TABLE equipos; Type: COMMENT; Schema: servicio; Owner: postgres
--

COMMENT ON TABLE servicio.equipos IS 'Catálogo único de equipos manejados por el área de servicio técnico.';


--
-- TOC entry 7048 (class 0 OID 0)
-- Dependencies: 259
-- Name: COLUMN equipos.code; Type: COMMENT; Schema: servicio; Owner: postgres
--

COMMENT ON COLUMN servicio.equipos.code IS 'Código único del equipo (ej: c311, c501) - corresponde a hojas de Excel';


--
-- TOC entry 7049 (class 0 OID 0)
-- Dependencies: 259
-- Name: COLUMN equipos.capacity_per_hour; Type: COMMENT; Schema: servicio; Owner: postgres
--

COMMENT ON COLUMN servicio.equipos.capacity_per_hour IS 'Determinaciones que puede procesar por hora';


--
-- TOC entry 7050 (class 0 OID 0)
-- Dependencies: 259
-- Name: COLUMN equipos.max_daily_capacity; Type: COMMENT; Schema: servicio; Owner: postgres
--

COMMENT ON COLUMN servicio.equipos.max_daily_capacity IS 'Capacidad máxima de determinaciones por día';


--
-- TOC entry 7051 (class 0 OID 0)
-- Dependencies: 259
-- Name: COLUMN equipos.technical_specs; Type: COMMENT; Schema: servicio; Owner: postgres
--

COMMENT ON COLUMN servicio.equipos.technical_specs IS 'Especificaciones técnicas en JSON flexible (voltaje, dimensiones, etc.)';


--
-- TOC entry 7052 (class 0 OID 0)
-- Dependencies: 259
-- Name: COLUMN equipos.default_calculation_formula; Type: COMMENT; Schema: servicio; Owner: postgres
--

COMMENT ON COLUMN servicio.equipos.default_calculation_formula IS 'Fórmula por defecto para todas las determinaciones de este equipo';


--
-- TOC entry 7053 (class 0 OID 0)
-- Dependencies: 259
-- Name: COLUMN equipos.calculation_engine; Type: COMMENT; Schema: servicio; Owner: postgres
--

COMMENT ON COLUMN servicio.equipos.calculation_engine IS 'Motor de cálculo: standard, advanced, custom';


--
-- TOC entry 338 (class 1259 OID 27076)
-- Name: v_determinations_with_formulas; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_determinations_with_formulas AS
 SELECT d.id,
    d.name,
    d.roche_code,
    d.category,
    d.equipment_id,
    e.nombre AS equipment_name,
    e.code AS equipment_code,
    d.formula_type,
    d.calculation_formula,
        CASE
            WHEN (d.calculation_formula IS NOT NULL) THEN 'Personalizada'::text
            WHEN (e.default_calculation_formula IS NOT NULL) THEN 'Del Equipo'::text
            ELSE 'Por Defecto'::text
        END AS formula_source,
    d.volume_per_test,
    d.reagent_consumption,
    d.processing_time,
    d.cost_per_test,
    d.status
   FROM (public.catalog_determinations d
     LEFT JOIN servicio.equipos e ON ((e.id_equipo = d.equipment_id)))
  WHERE ((d.status)::text = 'active'::text);


ALTER VIEW public.v_determinations_with_formulas OWNER TO postgres;

--
-- TOC entry 7054 (class 0 OID 0)
-- Dependencies: 338
-- Name: VIEW v_determinations_with_formulas; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.v_determinations_with_formulas IS 'Vista de determinaciones mostrando origen de su fórmula de cálculo';


--
-- TOC entry 386 (class 1259 OID 28447)
-- Name: v_equipment_catalog; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_equipment_catalog AS
 SELECT id,
    code,
    sku,
    name,
    manufacturer,
    model,
    category,
    category_type,
    description,
    status,
    default_location,
    capacity_per_hour,
    max_daily_capacity,
    base_price,
    maintenance_cost,
    technical_specs
   FROM public.equipment_models;


ALTER VIEW public.v_equipment_catalog OWNER TO postgres;

--
-- TOC entry 7055 (class 0 OID 0)
-- Dependencies: 386
-- Name: VIEW v_equipment_catalog; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.v_equipment_catalog IS 'Vista que expone el catálogo mientras migramos consumidores al nuevo modelo.';


--
-- TOC entry 312 (class 1259 OID 26297)
-- Name: v_equipment_determinations; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_equipment_determinations AS
 SELECT e.id_equipo AS equipment_id,
    e.nombre AS equipment_name,
    e.modelo AS model,
    e.fabricante AS manufacturer,
    d.id AS determination_id,
    d.name AS determination_name,
    d.roche_code,
    d.category,
    d.version AS determination_version,
    d.status AS determination_status
   FROM (servicio.equipos e
     LEFT JOIN public.catalog_determinations d ON ((d.equipment_id = e.id_equipo)))
  ORDER BY e.nombre, d.name;


ALTER VIEW public.v_equipment_determinations OWNER TO postgres;

--
-- TOC entry 7056 (class 0 OID 0)
-- Dependencies: 312
-- Name: VIEW v_equipment_determinations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.v_equipment_determinations IS 'Vista de equipos (servicio.equipos) con sus determinaciones';


--
-- TOC entry 335 (class 1259 OID 27033)
-- Name: v_equipment_full_catalog; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_equipment_full_catalog AS
 SELECT e.id_equipo AS equipment_id,
    e.code AS equipment_code,
    e.nombre AS equipment_name,
    e.fabricante AS manufacturer,
    e.modelo AS model,
    e.category_type AS category,
    e.capacity_per_hour,
    e.max_daily_capacity,
    e.base_price,
    e.estado AS status,
    count(DISTINCT d.id) AS total_determinations,
    count(DISTINCT c.id) AS total_consumables
   FROM (((servicio.equipos e
     LEFT JOIN public.catalog_determinations d ON (((d.equipment_id = e.id_equipo) AND ((d.status)::text = 'active'::text))))
     LEFT JOIN public.catalog_equipment_consumables ec ON ((ec.equipment_id = e.id_equipo)))
     LEFT JOIN public.catalog_consumables c ON (((c.id = ec.consumable_id) AND ((c.status)::text = 'active'::text))))
  WHERE (e.estado = 'operativo'::text)
  GROUP BY e.id_equipo, e.code, e.nombre, e.fabricante, e.modelo, e.category_type, e.capacity_per_hour, e.max_daily_capacity, e.base_price, e.estado;


ALTER VIEW public.v_equipment_full_catalog OWNER TO postgres;

--
-- TOC entry 7057 (class 0 OID 0)
-- Dependencies: 335
-- Name: VIEW v_equipment_full_catalog; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.v_equipment_full_catalog IS 'Vista consolidada de equipos con conteo de determinaciones y consumibles disponibles';


--
-- TOC entry 351 (class 1259 OID 27341)
-- Name: v_inventario_completo; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_inventario_completo AS
 SELECT u.id AS inventory_id,
    u.id AS unidad_id,
    m.sku,
    m.nombre AS item_name,
    m.modelo AS model,
    m.fabricante AS brand,
    m.categoria AS category,
    u.serial AS serial_number,
    u.estado,
    u.ubicacion,
    u.cliente_id,
    u.serial_pendiente,
    u.updated_at,
    NULL::text AS tipo_ultimo_movimiento
   FROM (public.equipos_unidad u
     JOIN public.equipos_modelo m ON ((m.id = u.modelo_id)));


ALTER VIEW public.v_inventario_completo OWNER TO postgres;

--
-- TOC entry 292 (class 1259 OID 25697)
-- Name: vacaciones_solicitudes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vacaciones_solicitudes (
    id integer NOT NULL,
    requester_id integer NOT NULL,
    approver_id integer,
    approver_role text,
    department_id integer,
    start_date date NOT NULL,
    end_date date NOT NULL,
    return_date date NOT NULL,
    period text,
    days integer DEFAULT 0,
    status text DEFAULT 'pendiente'::text,
    drive_doc_id text,
    drive_pdf_id text,
    drive_doc_link text,
    drive_pdf_link text,
    drive_folder_id text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.vacaciones_solicitudes OWNER TO postgres;

--
-- TOC entry 291 (class 1259 OID 25696)
-- Name: vacaciones_solicitudes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.vacaciones_solicitudes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vacaciones_solicitudes_id_seq OWNER TO postgres;

--
-- TOC entry 7058 (class 0 OID 0)
-- Dependencies: 291
-- Name: vacaciones_solicitudes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.vacaciones_solicitudes_id_seq OWNED BY public.vacaciones_solicitudes.id;


--
-- TOC entry 318 (class 1259 OID 26369)
-- Name: visit_schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.visit_schedules (
    id integer NOT NULL,
    user_email text NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    submitted_at timestamp with time zone,
    reviewed_by_email text,
    reviewed_at timestamp with time zone,
    rejection_reason text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT visit_schedules_month_check CHECK (((month >= 1) AND (month <= 12))),
    CONSTRAINT visit_schedules_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending_approval'::text, 'approved'::text, 'rejected'::text])))
);


ALTER TABLE public.visit_schedules OWNER TO postgres;

--
-- TOC entry 317 (class 1259 OID 26368)
-- Name: visit_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.visit_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.visit_schedules_id_seq OWNER TO postgres;

--
-- TOC entry 7059 (class 0 OID 0)
-- Dependencies: 317
-- Name: visit_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.visit_schedules_id_seq OWNED BY public.visit_schedules.id;


--
-- TOC entry 251 (class 1259 OID 16531)
-- Name: vw_dashboard_requests; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vw_dashboard_requests AS
 SELECT r.id AS request_id,
    rt.code AS request_type_code,
    rt.title AS request_type_title,
    r.status,
    r.created_at,
    r.updated_at,
    ( SELECT count(1) AS count
           FROM (public.documents d
             JOIN public.document_signatures ds ON ((ds.document_id = d.id)))
          WHERE (d.request_id = r.id)) AS signatures,
    ( SELECT max(h.changed_at) AS max
           FROM public.request_status_history h
          WHERE (h.request_id = r.id)) AS last_status_change
   FROM (public.requests r
     JOIN public.request_types rt ON ((rt.id = r.request_type_id)));


ALTER VIEW public.vw_dashboard_requests OWNER TO postgres;

--
-- TOC entry 7060 (class 0 OID 0)
-- Dependencies: 251
-- Name: VIEW vw_dashboard_requests; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.vw_dashboard_requests IS 'Vista de consolidación de solicitudes, incluyendo estados pending, in_review, approved, rejected y cancelled.';


--
-- TOC entry 252 (class 1259 OID 16536)
-- Name: vw_request_metrics; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vw_request_metrics AS
 SELECT status,
    count(*) AS total
   FROM public.requests
  GROUP BY status
  ORDER BY status;


ALTER VIEW public.vw_request_metrics OWNER TO postgres;

--
-- TOC entry 7061 (class 0 OID 0)
-- Dependencies: 252
-- Name: VIEW vw_request_metrics; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.vw_request_metrics IS 'Resumen de solicitudes agrupadas por estado (incluye cancelled).';


--
-- TOC entry 316 (class 1259 OID 26351)
-- Name: aplicaciones_tecnicas; Type: TABLE; Schema: servicio; Owner: postgres
--

CREATE TABLE servicio.aplicaciones_tecnicas (
    id integer NOT NULL,
    client text,
    location text,
    type text,
    url text,
    status text DEFAULT 'Disponible'::text,
    assignee text,
    archived boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE servicio.aplicaciones_tecnicas OWNER TO postgres;

--
-- TOC entry 315 (class 1259 OID 26350)
-- Name: aplicaciones_tecnicas_id_seq; Type: SEQUENCE; Schema: servicio; Owner: postgres
--

CREATE SEQUENCE servicio.aplicaciones_tecnicas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE servicio.aplicaciones_tecnicas_id_seq OWNER TO postgres;

--
-- TOC entry 7062 (class 0 OID 0)
-- Dependencies: 315
-- Name: aplicaciones_tecnicas_id_seq; Type: SEQUENCE OWNED BY; Schema: servicio; Owner: postgres
--

ALTER SEQUENCE servicio.aplicaciones_tecnicas_id_seq OWNED BY servicio.aplicaciones_tecnicas.id;


--
-- TOC entry 253 (class 1259 OID 16540)
-- Name: cronograma_capacitacion; Type: TABLE; Schema: servicio; Owner: postgres
--

CREATE TABLE servicio.cronograma_capacitacion (
    id_capacitacion integer NOT NULL,
    titulo text NOT NULL,
    descripcion text,
    instructor text,
    modalidad text,
    fecha date NOT NULL,
    hora_inicio time without time zone,
    hora_fin time without time zone,
    ubicacion text,
    estado text DEFAULT 'Programada'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT cronograma_capacitacion_estado_check CHECK ((estado = ANY (ARRAY['Programada'::text, 'Realizada'::text, 'Cancelada'::text]))),
    CONSTRAINT cronograma_capacitacion_modalidad_check CHECK ((modalidad = ANY (ARRAY['Presencial'::text, 'Virtual'::text, 'Mixta'::text])))
);


ALTER TABLE servicio.cronograma_capacitacion OWNER TO postgres;

--
-- TOC entry 254 (class 1259 OID 16553)
-- Name: cronograma_capacitacion_id_capacitacion_seq; Type: SEQUENCE; Schema: servicio; Owner: postgres
--

CREATE SEQUENCE servicio.cronograma_capacitacion_id_capacitacion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE servicio.cronograma_capacitacion_id_capacitacion_seq OWNER TO postgres;

--
-- TOC entry 7063 (class 0 OID 0)
-- Dependencies: 254
-- Name: cronograma_capacitacion_id_capacitacion_seq; Type: SEQUENCE OWNED BY; Schema: servicio; Owner: postgres
--

ALTER SEQUENCE servicio.cronograma_capacitacion_id_capacitacion_seq OWNED BY servicio.cronograma_capacitacion.id_capacitacion;


--
-- TOC entry 255 (class 1259 OID 16554)
-- Name: cronograma_mantenimientos; Type: TABLE; Schema: servicio; Owner: postgres
--

CREATE TABLE servicio.cronograma_mantenimientos (
    id_mantenimiento integer NOT NULL,
    id_equipo integer NOT NULL,
    tipo text DEFAULT 'Preventivo'::text,
    descripcion text,
    responsable text,
    fecha_programada date NOT NULL,
    fecha_realizacion date,
    estado text DEFAULT 'Pendiente'::text,
    observaciones text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    carpeta_drive_id text,
    doc_drive_id text,
    link_carpeta text,
    link_doc text,
    id integer GENERATED ALWAYS AS (id_mantenimiento) STORED,
    request_id integer,
    created_by integer,
    next_maintenance_date date,
    next_maintenance_status text DEFAULT 'pendiente'::text,
    next_maintenance_conflict text,
    next_reminder_sent_at timestamp with time zone,
    firma_responsable text,
    firma_receptor text,
    CONSTRAINT cronograma_mantenimientos_estado_check CHECK ((estado = ANY (ARRAY['Pendiente'::text, 'En Proceso'::text, 'Cumplido'::text, 'No Cumplido'::text]))),
    CONSTRAINT cronograma_mantenimientos_tipo_check CHECK ((tipo = ANY (ARRAY['Preventivo'::text, 'Correctivo'::text])))
);


ALTER TABLE servicio.cronograma_mantenimientos OWNER TO postgres;

--
-- TOC entry 7064 (class 0 OID 0)
-- Dependencies: 255
-- Name: TABLE cronograma_mantenimientos; Type: COMMENT; Schema: servicio; Owner: postgres
--

COMMENT ON TABLE servicio.cronograma_mantenimientos IS 'Registro de mantenimientos preventivos y correctivos asociados a cada equipo.';


--
-- TOC entry 256 (class 1259 OID 16568)
-- Name: cronograma_mantenimientos_anuales; Type: TABLE; Schema: servicio; Owner: postgres
--

CREATE TABLE servicio.cronograma_mantenimientos_anuales (
    id_mant_anual integer NOT NULL,
    id_equipo integer NOT NULL,
    mes text NOT NULL,
    responsable text,
    fecha_programada date,
    estado text DEFAULT 'Pendiente'::text,
    comentarios text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT cronograma_mantenimientos_anuales_estado_check CHECK ((estado = ANY (ARRAY['Pendiente'::text, 'Cumplido'::text, 'No Cumplido'::text]))),
    CONSTRAINT cronograma_mantenimientos_anuales_mes_check CHECK ((mes = ANY (ARRAY['Enero'::text, 'Febrero'::text, 'Marzo'::text, 'Abril'::text, 'Mayo'::text, 'Junio'::text, 'Julio'::text, 'Agosto'::text, 'Septiembre'::text, 'Octubre'::text, 'Noviembre'::text, 'Diciembre'::text])))
);


ALTER TABLE servicio.cronograma_mantenimientos_anuales OWNER TO postgres;

--
-- TOC entry 7065 (class 0 OID 0)
-- Dependencies: 256
-- Name: TABLE cronograma_mantenimientos_anuales; Type: COMMENT; Schema: servicio; Owner: postgres
--

COMMENT ON TABLE servicio.cronograma_mantenimientos_anuales IS 'Plan anual de mantenimiento preventivo por equipo.';


--
-- TOC entry 257 (class 1259 OID 16581)
-- Name: cronograma_mantenimientos_anuales_id_mant_anual_seq; Type: SEQUENCE; Schema: servicio; Owner: postgres
--

CREATE SEQUENCE servicio.cronograma_mantenimientos_anuales_id_mant_anual_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE servicio.cronograma_mantenimientos_anuales_id_mant_anual_seq OWNER TO postgres;

--
-- TOC entry 7066 (class 0 OID 0)
-- Dependencies: 257
-- Name: cronograma_mantenimientos_anuales_id_mant_anual_seq; Type: SEQUENCE OWNED BY; Schema: servicio; Owner: postgres
--

ALTER SEQUENCE servicio.cronograma_mantenimientos_anuales_id_mant_anual_seq OWNED BY servicio.cronograma_mantenimientos_anuales.id_mant_anual;


--
-- TOC entry 258 (class 1259 OID 16582)
-- Name: cronograma_mantenimientos_id_mantenimiento_seq; Type: SEQUENCE; Schema: servicio; Owner: postgres
--

CREATE SEQUENCE servicio.cronograma_mantenimientos_id_mantenimiento_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE servicio.cronograma_mantenimientos_id_mantenimiento_seq OWNER TO postgres;

--
-- TOC entry 7067 (class 0 OID 0)
-- Dependencies: 258
-- Name: cronograma_mantenimientos_id_mantenimiento_seq; Type: SEQUENCE OWNED BY; Schema: servicio; Owner: postgres
--

ALTER SEQUENCE servicio.cronograma_mantenimientos_id_mantenimiento_seq OWNED BY servicio.cronograma_mantenimientos.id_mantenimiento;


--
-- TOC entry 290 (class 1259 OID 25678)
-- Name: disponibilidad_tecnicos; Type: TABLE; Schema: servicio; Owner: postgres
--

CREATE TABLE servicio.disponibilidad_tecnicos (
    id integer NOT NULL,
    user_id integer,
    name text,
    status text DEFAULT 'no_disponible'::text,
    note text,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE servicio.disponibilidad_tecnicos OWNER TO postgres;

--
-- TOC entry 289 (class 1259 OID 25677)
-- Name: disponibilidad_tecnicos_id_seq; Type: SEQUENCE; Schema: servicio; Owner: postgres
--

CREATE SEQUENCE servicio.disponibilidad_tecnicos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE servicio.disponibilidad_tecnicos_id_seq OWNER TO postgres;

--
-- TOC entry 7068 (class 0 OID 0)
-- Dependencies: 289
-- Name: disponibilidad_tecnicos_id_seq; Type: SEQUENCE OWNED BY; Schema: servicio; Owner: postgres
--

ALTER SEQUENCE servicio.disponibilidad_tecnicos_id_seq OWNED BY servicio.disponibilidad_tecnicos.id;


--
-- TOC entry 260 (class 1259 OID 16594)
-- Name: equipos_id_equipo_seq; Type: SEQUENCE; Schema: servicio; Owner: postgres
--

CREATE SEQUENCE servicio.equipos_id_equipo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE servicio.equipos_id_equipo_seq OWNER TO postgres;

--
-- TOC entry 7069 (class 0 OID 0)
-- Dependencies: 260
-- Name: equipos_id_equipo_seq; Type: SEQUENCE OWNED BY; Schema: servicio; Owner: postgres
--

ALTER SEQUENCE servicio.equipos_id_equipo_seq OWNED BY servicio.equipos.id_equipo;


--
-- TOC entry 261 (class 1259 OID 16595)
-- Name: vista_mantenimientos_por_equipo; Type: VIEW; Schema: servicio; Owner: postgres
--

CREATE VIEW servicio.vista_mantenimientos_por_equipo AS
 SELECT e.id_equipo,
    e.nombre AS equipo,
    count(m.id_mantenimiento) AS total_mantenimientos,
    sum(
        CASE
            WHEN (m.estado = 'Cumplido'::text) THEN 1
            ELSE 0
        END) AS cumplidos,
    sum(
        CASE
            WHEN (m.estado = 'Pendiente'::text) THEN 1
            ELSE 0
        END) AS pendientes
   FROM (servicio.equipos e
     LEFT JOIN servicio.cronograma_mantenimientos m ON ((e.id_equipo = m.id_equipo)))
  GROUP BY e.id_equipo, e.nombre
  ORDER BY e.nombre;


ALTER VIEW servicio.vista_mantenimientos_por_equipo OWNER TO postgres;

--
-- TOC entry 5541 (class 2604 OID 16989)
-- Name: logs id; Type: DEFAULT; Schema: auditoria; Owner: postgres
--

ALTER TABLE ONLY auditoria.logs ALTER COLUMN id SET DEFAULT nextval('auditoria.logs_id_seq'::regclass);


--
-- TOC entry 5680 (class 2604 OID 26422)
-- Name: advisor_location_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.advisor_location_history ALTER COLUMN id SET DEFAULT nextval('public.advisor_location_history_id_seq'::regclass);


--
-- TOC entry 5818 (class 2604 OID 28455)
-- Name: attendance_exceptions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_exceptions ALTER COLUMN id SET DEFAULT nextval('public.attendance_exceptions_id_seq'::regclass);


--
-- TOC entry 5845 (class 2604 OID 28576)
-- Name: audit_access_grants id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_access_grants ALTER COLUMN id SET DEFAULT nextval('public.audit_access_grants_id_seq'::regclass);


--
-- TOC entry 5840 (class 2604 OID 28546)
-- Name: audit_documents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_documents ALTER COLUMN id SET DEFAULT nextval('public.audit_documents_id_seq'::regclass);


--
-- TOC entry 5833 (class 2604 OID 28520)
-- Name: audit_sections id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_sections ALTER COLUMN id SET DEFAULT nextval('public.audit_sections_id_seq'::regclass);


--
-- TOC entry 5469 (class 2604 OID 16600)
-- Name: audit_trail id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_trail ALTER COLUMN id SET DEFAULT nextval('public.audit_trail_id_seq'::regclass);


--
-- TOC entry 5651 (class 2604 OID 26216)
-- Name: bc_alerts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_alerts ALTER COLUMN id SET DEFAULT nextval('public.bc_alerts_id_seq'::regclass);


--
-- TOC entry 5711 (class 2604 OID 27012)
-- Name: bc_audit_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_audit_log ALTER COLUMN id SET DEFAULT nextval('public.bc_audit_log_id_seq'::regclass);


--
-- TOC entry 5695 (class 2604 OID 26946)
-- Name: bc_calculations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_calculations ALTER COLUMN id SET DEFAULT nextval('public.bc_calculations_id_seq'::regclass);


--
-- TOC entry 5770 (class 2604 OID 27665)
-- Name: bc_deliveries id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_deliveries ALTER COLUMN id SET DEFAULT nextval('public.bc_deliveries_id_seq'::regclass);


--
-- TOC entry 5691 (class 2604 OID 26915)
-- Name: bc_determinations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_determinations ALTER COLUMN id SET DEFAULT nextval('public.bc_determinations_id_seq'::regclass);


--
-- TOC entry 5783 (class 2604 OID 28242)
-- Name: bc_economic_data id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_economic_data ALTER COLUMN id SET DEFAULT nextval('public.bc_economic_data_id_seq'::regclass);


--
-- TOC entry 5753 (class 2604 OID 27577)
-- Name: bc_equipment_details id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_equipment_details ALTER COLUMN id SET DEFAULT nextval('public.bc_equipment_details_id_seq'::regclass);


--
-- TOC entry 5719 (class 2604 OID 27142)
-- Name: bc_equipment_selection id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_equipment_selection ALTER COLUMN id SET DEFAULT nextval('public.bc_equipment_selection_id_seq'::regclass);


--
-- TOC entry 5748 (class 2604 OID 27504)
-- Name: bc_investments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_investments ALTER COLUMN id SET DEFAULT nextval('public.bc_investments_id_seq'::regclass);


--
-- TOC entry 5750 (class 2604 OID 27552)
-- Name: bc_lab_environment id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lab_environment ALTER COLUMN id SET DEFAULT nextval('public.bc_lab_environment_id_seq'::regclass);


--
-- TOC entry 5796 (class 2604 OID 28311)
-- Name: bc_lis_data id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lis_data ALTER COLUMN id SET DEFAULT nextval('public.bc_lis_data_id_seq'::regclass);


--
-- TOC entry 5765 (class 2604 OID 27628)
-- Name: bc_lis_equipment_interfaces id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lis_equipment_interfaces ALTER COLUMN id SET DEFAULT nextval('public.bc_lis_equipment_interfaces_id_seq'::regclass);


--
-- TOC entry 5759 (class 2604 OID 27603)
-- Name: bc_lis_integration id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lis_integration ALTER COLUMN id SET DEFAULT nextval('public.bc_lis_integration_id_seq'::regclass);


--
-- TOC entry 5789 (class 2604 OID 28276)
-- Name: bc_operational_data id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_operational_data ALTER COLUMN id SET DEFAULT nextval('public.bc_operational_data_id_seq'::regclass);


--
-- TOC entry 5767 (class 2604 OID 27645)
-- Name: bc_requirements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_requirements ALTER COLUMN id SET DEFAULT nextval('public.bc_requirements_id_seq'::regclass);


--
-- TOC entry 5804 (class 2604 OID 28353)
-- Name: bc_validations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_validations ALTER COLUMN id SET DEFAULT nextval('public.bc_validations_id_seq'::regclass);


--
-- TOC entry 5802 (class 2604 OID 28336)
-- Name: bc_workflow_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_workflow_history ALTER COLUMN id SET DEFAULT nextval('public.bc_workflow_history_id_seq'::regclass);


--
-- TOC entry 5889 (class 2604 OID 28963)
-- Name: business_case_section_ownership id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_case_section_ownership ALTER COLUMN id SET DEFAULT nextval('public.business_case_section_ownership_id_seq'::regclass);


--
-- TOC entry 5894 (class 2604 OID 28986)
-- Name: business_case_section_ownership_audit id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_case_section_ownership_audit ALTER COLUMN id SET DEFAULT nextval('public.business_case_section_ownership_audit_id_seq'::regclass);


--
-- TOC entry 5887 (class 2604 OID 28945)
-- Name: business_case_state_transitions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_case_state_transitions ALTER COLUMN id SET DEFAULT nextval('public.business_case_state_transitions_id_seq'::regclass);


--
-- TOC entry 5713 (class 2604 OID 27052)
-- Name: calculation_templates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calculation_templates ALTER COLUMN id SET DEFAULT nextval('public.calculation_templates_id_seq'::regclass);


--
-- TOC entry 5630 (class 2604 OID 26097)
-- Name: catalog_consumables id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_consumables ALTER COLUMN id SET DEFAULT nextval('public.catalog_consumables_id_seq'::regclass);


--
-- TOC entry 5620 (class 2604 OID 26064)
-- Name: catalog_determinations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_determinations ALTER COLUMN id SET DEFAULT nextval('public.catalog_determinations_id_seq'::regclass);


--
-- TOC entry 5637 (class 2604 OID 26125)
-- Name: catalog_equipment_consumables id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_equipment_consumables ALTER COLUMN id SET DEFAULT nextval('public.catalog_equipment_consumables_id_seq'::regclass);


--
-- TOC entry 5655 (class 2604 OID 26249)
-- Name: catalog_investments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_investments ALTER COLUMN id SET DEFAULT nextval('public.catalog_investments_id_seq'::regclass);


--
-- TOC entry 5615 (class 2604 OID 25718)
-- Name: client_assignments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_assignments ALTER COLUMN id SET DEFAULT nextval('public.client_assignments_id_seq'::regclass);


--
-- TOC entry 5554 (class 2604 OID 17115)
-- Name: client_request_consents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_request_consents ALTER COLUMN id SET DEFAULT nextval('public.client_request_consents_id_seq'::regclass);


--
-- TOC entry 5545 (class 2604 OID 17087)
-- Name: client_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_requests ALTER COLUMN id SET DEFAULT nextval('public.client_requests_id_seq'::regclass);


--
-- TOC entry 5617 (class 2604 OID 25738)
-- Name: client_visit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_visit_logs ALTER COLUMN id SET DEFAULT nextval('public.client_visit_logs_id_seq'::regclass);


--
-- TOC entry 5565 (class 2604 OID 17247)
-- Name: clients id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);


--
-- TOC entry 5640 (class 2604 OID 26155)
-- Name: contract_determinations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_determinations ALTER COLUMN id SET DEFAULT nextval('public.contract_determinations_id_seq'::regclass);


--
-- TOC entry 5538 (class 2604 OID 16962)
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- TOC entry 5647 (class 2604 OID 26191)
-- Name: determination_consumption_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.determination_consumption_log ALTER COLUMN id SET DEFAULT nextval('public.determination_consumption_log_id_seq'::regclass);


--
-- TOC entry 5859 (class 2604 OID 28659)
-- Name: document_hashes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_hashes ALTER COLUMN id SET DEFAULT nextval('public.document_hashes_id_seq'::regclass);


--
-- TOC entry 5876 (class 2604 OID 28751)
-- Name: document_qr_codes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_qr_codes ALTER COLUMN id SET DEFAULT nextval('public.document_qr_codes_id_seq'::regclass);


--
-- TOC entry 5869 (class 2604 OID 28717)
-- Name: document_seals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_seals ALTER COLUMN id SET DEFAULT nextval('public.document_seals_id_seq'::regclass);


--
-- TOC entry 5881 (class 2604 OID 28778)
-- Name: document_signature_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_signature_logs ALTER COLUMN id SET DEFAULT nextval('public.document_signature_logs_id_seq'::regclass);


--
-- TOC entry 5472 (class 2604 OID 16601)
-- Name: document_signatures id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_signatures ALTER COLUMN id SET DEFAULT nextval('public.document_signatures_id_seq'::regclass);


--
-- TOC entry 5863 (class 2604 OID 28681)
-- Name: document_signatures_advanced id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_signatures_advanced ALTER COLUMN id SET DEFAULT nextval('public.document_signatures_advanced_id_seq'::regclass);


--
-- TOC entry 5884 (class 2604 OID 28798)
-- Name: document_verifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_verifications ALTER COLUMN id SET DEFAULT nextval('public.document_verifications_id_seq'::regclass);


--
-- TOC entry 5474 (class 2604 OID 16602)
-- Name: documents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents ALTER COLUMN id SET DEFAULT nextval('public.documents_id_seq'::regclass);


--
-- TOC entry 5481 (class 2604 OID 16603)
-- Name: employees id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);


--
-- TOC entry 5709 (class 2604 OID 26973)
-- Name: equipment_price_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipment_price_history ALTER COLUMN id SET DEFAULT nextval('public.equipment_price_history_id_seq'::regclass);


--
-- TOC entry 5723 (class 2604 OID 27226)
-- Name: equipos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos ALTER COLUMN id SET DEFAULT nextval('public.equipos_id_seq'::regclass);


--
-- TOC entry 5738 (class 2604 OID 27315)
-- Name: equipos_historial id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_historial ALTER COLUMN id SET DEFAULT nextval('public.equipos_historial_id_seq'::regclass);


--
-- TOC entry 5731 (class 2604 OID 27277)
-- Name: equipos_modelo id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_modelo ALTER COLUMN id SET DEFAULT nextval('public.equipos_modelo_id_seq'::regclass);


--
-- TOC entry 5728 (class 2604 OID 27248)
-- Name: equipos_movimientos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_movimientos ALTER COLUMN id SET DEFAULT nextval('public.equipos_movimientos_id_seq'::regclass);


--
-- TOC entry 5733 (class 2604 OID 27291)
-- Name: equipos_unidad id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_unidad ALTER COLUMN id SET DEFAULT nextval('public.equipos_unidad_id_seq'::regclass);


--
-- TOC entry 5484 (class 2604 OID 16604)
-- Name: inventory id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory ALTER COLUMN id SET DEFAULT nextval('public.inventory_id_seq'::regclass);


--
-- TOC entry 5488 (class 2604 OID 16605)
-- Name: inventory_movements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_movements ALTER COLUMN id SET DEFAULT nextval('public.inventory_movements_id_seq'::regclass);


--
-- TOC entry 5848 (class 2604 OID 28603)
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- TOC entry 5685 (class 2604 OID 26485)
-- Name: permisos_vacaciones id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos_vacaciones ALTER COLUMN id SET DEFAULT nextval('public.permisos_vacaciones_id_seq'::regclass);


--
-- TOC entry 5603 (class 2604 OID 17433)
-- Name: personnel_request_comments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_request_comments ALTER COLUMN id SET DEFAULT nextval('public.personnel_request_comments_id_seq'::regclass);


--
-- TOC entry 5601 (class 2604 OID 17410)
-- Name: personnel_request_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_request_history ALTER COLUMN id SET DEFAULT nextval('public.personnel_request_history_id_seq'::regclass);


--
-- TOC entry 5594 (class 2604 OID 17354)
-- Name: personnel_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_requests ALTER COLUMN id SET DEFAULT nextval('public.personnel_requests_id_seq'::regclass);


--
-- TOC entry 5824 (class 2604 OID 28480)
-- Name: prospect_visits id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prospect_visits ALTER COLUMN id SET DEFAULT nextval('public.prospect_visits_id_seq'::regclass);


--
-- TOC entry 5491 (class 2604 OID 16606)
-- Name: request_approvals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_approvals ALTER COLUMN id SET DEFAULT nextval('public.request_approvals_id_seq'::regclass);


--
-- TOC entry 5493 (class 2604 OID 16607)
-- Name: request_attachments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_attachments ALTER COLUMN id SET DEFAULT nextval('public.request_attachments_id_seq'::regclass);


--
-- TOC entry 5495 (class 2604 OID 16608)
-- Name: request_status_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_status_history ALTER COLUMN id SET DEFAULT nextval('public.request_status_history_id_seq'::regclass);


--
-- TOC entry 5497 (class 2604 OID 16609)
-- Name: request_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_types ALTER COLUMN id SET DEFAULT nextval('public.request_types_id_seq'::regclass);


--
-- TOC entry 5499 (class 2604 OID 16610)
-- Name: request_versions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_versions ALTER COLUMN id SET DEFAULT nextval('public.request_versions_id_seq'::regclass);


--
-- TOC entry 5501 (class 2604 OID 16611)
-- Name: requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requests ALTER COLUMN id SET DEFAULT nextval('public.requests_id_seq'::regclass);


--
-- TOC entry 5676 (class 2604 OID 26393)
-- Name: scheduled_visits id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scheduled_visits ALTER COLUMN id SET DEFAULT nextval('public.scheduled_visits_id_seq'::regclass);


--
-- TOC entry 5663 (class 2604 OID 26323)
-- Name: technical_documents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.technical_documents ALTER COLUMN id SET DEFAULT nextval('public.technical_documents_id_seq'::regclass);


--
-- TOC entry 5683 (class 2604 OID 26448)
-- Name: travel_segments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.travel_segments ALTER COLUMN id SET DEFAULT nextval('public.travel_segments_id_seq'::regclass);


--
-- TOC entry 5562 (class 2604 OID 17173)
-- Name: user_attendance_records id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_attendance_records ALTER COLUMN id SET DEFAULT nextval('public.user_attendance_records_id_seq'::regclass);


--
-- TOC entry 5573 (class 2604 OID 17301)
-- Name: user_gmail_tokens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_gmail_tokens ALTER COLUMN id SET DEFAULT nextval('public.user_gmail_tokens_id_seq'::regclass);


--
-- TOC entry 5560 (class 2604 OID 17158)
-- Name: user_lopdp_consents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_lopdp_consents ALTER COLUMN id SET DEFAULT nextval('public.user_lopdp_consents_id_seq'::regclass);


--
-- TOC entry 5854 (class 2604 OID 28627)
-- Name: user_profile id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_profile ALTER COLUMN id SET DEFAULT nextval('public.user_profile_id_seq'::regclass);


--
-- TOC entry 5536 (class 2604 OID 16950)
-- Name: user_sessions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions ALTER COLUMN id SET DEFAULT nextval('public.user_sessions_id_seq'::regclass);


--
-- TOC entry 5507 (class 2604 OID 16612)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 5610 (class 2604 OID 25700)
-- Name: vacaciones_solicitudes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vacaciones_solicitudes ALTER COLUMN id SET DEFAULT nextval('public.vacaciones_solicitudes_id_seq'::regclass);


--
-- TOC entry 5672 (class 2604 OID 26372)
-- Name: visit_schedules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.visit_schedules ALTER COLUMN id SET DEFAULT nextval('public.visit_schedules_id_seq'::regclass);


--
-- TOC entry 5667 (class 2604 OID 26354)
-- Name: aplicaciones_tecnicas id; Type: DEFAULT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.aplicaciones_tecnicas ALTER COLUMN id SET DEFAULT nextval('servicio.aplicaciones_tecnicas_id_seq'::regclass);


--
-- TOC entry 5512 (class 2604 OID 16613)
-- Name: cronograma_capacitacion id_capacitacion; Type: DEFAULT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_capacitacion ALTER COLUMN id_capacitacion SET DEFAULT nextval('servicio.cronograma_capacitacion_id_capacitacion_seq'::regclass);


--
-- TOC entry 5516 (class 2604 OID 16614)
-- Name: cronograma_mantenimientos id_mantenimiento; Type: DEFAULT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos ALTER COLUMN id_mantenimiento SET DEFAULT nextval('servicio.cronograma_mantenimientos_id_mantenimiento_seq'::regclass);


--
-- TOC entry 5523 (class 2604 OID 16615)
-- Name: cronograma_mantenimientos_anuales id_mant_anual; Type: DEFAULT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos_anuales ALTER COLUMN id_mant_anual SET DEFAULT nextval('servicio.cronograma_mantenimientos_anuales_id_mant_anual_seq'::regclass);


--
-- TOC entry 5607 (class 2604 OID 25681)
-- Name: disponibilidad_tecnicos id; Type: DEFAULT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.disponibilidad_tecnicos ALTER COLUMN id SET DEFAULT nextval('servicio.disponibilidad_tecnicos_id_seq'::regclass);


--
-- TOC entry 5527 (class 2604 OID 16616)
-- Name: equipos id_equipo; Type: DEFAULT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.equipos ALTER COLUMN id_equipo SET DEFAULT nextval('servicio.equipos_id_equipo_seq'::regclass);


--
-- TOC entry 6070 (class 2606 OID 16995)
-- Name: logs logs_pkey; Type: CONSTRAINT; Schema: auditoria; Owner: postgres
--

ALTER TABLE ONLY auditoria.logs
    ADD CONSTRAINT logs_pkey PRIMARY KEY (id);


--
-- TOC entry 6206 (class 2606 OID 26433)
-- Name: advisor_location_history advisor_location_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.advisor_location_history
    ADD CONSTRAINT advisor_location_history_pkey PRIMARY KEY (id);


--
-- TOC entry 6348 (class 2606 OID 28466)
-- Name: attendance_exceptions attendance_exceptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_exceptions
    ADD CONSTRAINT attendance_exceptions_pkey PRIMARY KEY (id);


--
-- TOC entry 6363 (class 2606 OID 28586)
-- Name: audit_access_grants audit_access_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_access_grants
    ADD CONSTRAINT audit_access_grants_pkey PRIMARY KEY (id);


--
-- TOC entry 6359 (class 2606 OID 28561)
-- Name: audit_documents audit_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_documents
    ADD CONSTRAINT audit_documents_pkey PRIMARY KEY (id);


--
-- TOC entry 6355 (class 2606 OID 28541)
-- Name: audit_sections audit_sections_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_sections
    ADD CONSTRAINT audit_sections_code_key UNIQUE (code);


--
-- TOC entry 6357 (class 2606 OID 28539)
-- Name: audit_sections audit_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_sections
    ADD CONSTRAINT audit_sections_pkey PRIMARY KEY (id);


--
-- TOC entry 6353 (class 2606 OID 28515)
-- Name: audit_settings audit_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_settings
    ADD CONSTRAINT audit_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 5987 (class 2606 OID 16618)
-- Name: audit_trail audit_trail_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_trail
    ADD CONSTRAINT audit_trail_pkey PRIMARY KEY (id);


--
-- TOC entry 6173 (class 2606 OID 26229)
-- Name: bc_alerts bc_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_alerts
    ADD CONSTRAINT bc_alerts_pkey PRIMARY KEY (id);


--
-- TOC entry 6242 (class 2606 OID 27020)
-- Name: bc_audit_log bc_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_audit_log
    ADD CONSTRAINT bc_audit_log_pkey PRIMARY KEY (id);


--
-- TOC entry 6231 (class 2606 OID 26967)
-- Name: bc_calculations bc_calculations_business_case_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_calculations
    ADD CONSTRAINT bc_calculations_business_case_id_key UNIQUE (business_case_id);


--
-- TOC entry 6234 (class 2606 OID 26965)
-- Name: bc_calculations bc_calculations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_calculations
    ADD CONSTRAINT bc_calculations_pkey PRIMARY KEY (id);


--
-- TOC entry 6309 (class 2606 OID 27675)
-- Name: bc_deliveries bc_deliveries_business_case_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_deliveries
    ADD CONSTRAINT bc_deliveries_business_case_id_key UNIQUE (business_case_id);


--
-- TOC entry 6311 (class 2606 OID 27673)
-- Name: bc_deliveries bc_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_deliveries
    ADD CONSTRAINT bc_deliveries_pkey PRIMARY KEY (id);


--
-- TOC entry 6220 (class 2606 OID 26929)
-- Name: bc_determinations bc_determinations_business_case_id_determination_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_determinations
    ADD CONSTRAINT bc_determinations_business_case_id_determination_id_key UNIQUE (business_case_id, determination_id);


--
-- TOC entry 6224 (class 2606 OID 26927)
-- Name: bc_determinations bc_determinations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_determinations
    ADD CONSTRAINT bc_determinations_pkey PRIMARY KEY (id);


--
-- TOC entry 6322 (class 2606 OID 28254)
-- Name: bc_economic_data bc_economic_data_bc_master_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_economic_data
    ADD CONSTRAINT bc_economic_data_bc_master_id_key UNIQUE (bc_master_id);


--
-- TOC entry 6324 (class 2606 OID 28252)
-- Name: bc_economic_data bc_economic_data_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_economic_data
    ADD CONSTRAINT bc_economic_data_pkey PRIMARY KEY (id);


--
-- TOC entry 6290 (class 2606 OID 27593)
-- Name: bc_equipment_details bc_equipment_details_business_case_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_equipment_details
    ADD CONSTRAINT bc_equipment_details_business_case_id_key UNIQUE (business_case_id);


--
-- TOC entry 6292 (class 2606 OID 27591)
-- Name: bc_equipment_details bc_equipment_details_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_equipment_details
    ADD CONSTRAINT bc_equipment_details_pkey PRIMARY KEY (id);


--
-- TOC entry 6253 (class 2606 OID 27156)
-- Name: bc_equipment_selection bc_equipment_selection_business_case_id_equipment_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_equipment_selection
    ADD CONSTRAINT bc_equipment_selection_business_case_id_equipment_id_key UNIQUE (business_case_id, equipment_id);


--
-- TOC entry 6257 (class 2606 OID 27149)
-- Name: bc_equipment_selection bc_equipment_selection_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_equipment_selection
    ADD CONSTRAINT bc_equipment_selection_pkey PRIMARY KEY (id);


--
-- TOC entry 6281 (class 2606 OID 27517)
-- Name: bc_investments bc_investments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_investments
    ADD CONSTRAINT bc_investments_pkey PRIMARY KEY (id);


--
-- TOC entry 6285 (class 2606 OID 27567)
-- Name: bc_lab_environment bc_lab_environment_business_case_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lab_environment
    ADD CONSTRAINT bc_lab_environment_business_case_id_key UNIQUE (business_case_id);


--
-- TOC entry 6287 (class 2606 OID 27565)
-- Name: bc_lab_environment bc_lab_environment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lab_environment
    ADD CONSTRAINT bc_lab_environment_pkey PRIMARY KEY (id);


--
-- TOC entry 6332 (class 2606 OID 28326)
-- Name: bc_lis_data bc_lis_data_bc_master_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lis_data
    ADD CONSTRAINT bc_lis_data_bc_master_id_key UNIQUE (bc_master_id);


--
-- TOC entry 6334 (class 2606 OID 28324)
-- Name: bc_lis_data bc_lis_data_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lis_data
    ADD CONSTRAINT bc_lis_data_pkey PRIMARY KEY (id);


--
-- TOC entry 6300 (class 2606 OID 27635)
-- Name: bc_lis_equipment_interfaces bc_lis_equipment_interfaces_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lis_equipment_interfaces
    ADD CONSTRAINT bc_lis_equipment_interfaces_pkey PRIMARY KEY (id);


--
-- TOC entry 6295 (class 2606 OID 27618)
-- Name: bc_lis_integration bc_lis_integration_business_case_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lis_integration
    ADD CONSTRAINT bc_lis_integration_business_case_id_key UNIQUE (business_case_id);


--
-- TOC entry 6297 (class 2606 OID 27616)
-- Name: bc_lis_integration bc_lis_integration_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lis_integration
    ADD CONSTRAINT bc_lis_integration_pkey PRIMARY KEY (id);


--
-- TOC entry 6314 (class 2606 OID 28237)
-- Name: bc_master bc_master_bc_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_master
    ADD CONSTRAINT bc_master_bc_number_key UNIQUE (bc_number);


--
-- TOC entry 6316 (class 2606 OID 28235)
-- Name: bc_master bc_master_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_master
    ADD CONSTRAINT bc_master_pkey PRIMARY KEY (id);


--
-- TOC entry 6327 (class 2606 OID 28301)
-- Name: bc_operational_data bc_operational_data_bc_master_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_operational_data
    ADD CONSTRAINT bc_operational_data_bc_master_id_key UNIQUE (bc_master_id);


--
-- TOC entry 6329 (class 2606 OID 28299)
-- Name: bc_operational_data bc_operational_data_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_operational_data
    ADD CONSTRAINT bc_operational_data_pkey PRIMARY KEY (id);


--
-- TOC entry 6304 (class 2606 OID 27655)
-- Name: bc_requirements bc_requirements_business_case_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_requirements
    ADD CONSTRAINT bc_requirements_business_case_id_key UNIQUE (business_case_id);


--
-- TOC entry 6306 (class 2606 OID 27653)
-- Name: bc_requirements bc_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_requirements
    ADD CONSTRAINT bc_requirements_pkey PRIMARY KEY (id);


--
-- TOC entry 6340 (class 2606 OID 28362)
-- Name: bc_validations bc_validations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_validations
    ADD CONSTRAINT bc_validations_pkey PRIMARY KEY (id);


--
-- TOC entry 6337 (class 2606 OID 28343)
-- Name: bc_workflow_history bc_workflow_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_workflow_history
    ADD CONSTRAINT bc_workflow_history_pkey PRIMARY KEY (id);


--
-- TOC entry 6410 (class 2606 OID 28976)
-- Name: business_case_section_ownership business_case_section_ownersh_business_case_id_section_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_case_section_ownership
    ADD CONSTRAINT business_case_section_ownersh_business_case_id_section_name_key UNIQUE (business_case_id, section_name);


--
-- TOC entry 6417 (class 2606 OID 28997)
-- Name: business_case_section_ownership_audit business_case_section_ownership_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_case_section_ownership_audit
    ADD CONSTRAINT business_case_section_ownership_audit_pkey PRIMARY KEY (id);


--
-- TOC entry 6412 (class 2606 OID 28974)
-- Name: business_case_section_ownership business_case_section_ownership_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_case_section_ownership
    ADD CONSTRAINT business_case_section_ownership_pkey PRIMARY KEY (id);


--
-- TOC entry 6408 (class 2606 OID 28953)
-- Name: business_case_state_transitions business_case_state_transitions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_case_state_transitions
    ADD CONSTRAINT business_case_state_transitions_pkey PRIMARY KEY (id);


--
-- TOC entry 6247 (class 2606 OID 27066)
-- Name: calculation_templates calculation_templates_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calculation_templates
    ADD CONSTRAINT calculation_templates_name_key UNIQUE (name);


--
-- TOC entry 6249 (class 2606 OID 27064)
-- Name: calculation_templates calculation_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calculation_templates
    ADD CONSTRAINT calculation_templates_pkey PRIMARY KEY (id);


--
-- TOC entry 6151 (class 2606 OID 26112)
-- Name: catalog_consumables catalog_consumables_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_consumables
    ADD CONSTRAINT catalog_consumables_pkey PRIMARY KEY (id);


--
-- TOC entry 6144 (class 2606 OID 26079)
-- Name: catalog_determinations catalog_determinations_name_roche_code_version_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_determinations
    ADD CONSTRAINT catalog_determinations_name_roche_code_version_key UNIQUE (name, roche_code, version);


--
-- TOC entry 6146 (class 2606 OID 26077)
-- Name: catalog_determinations catalog_determinations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_determinations
    ADD CONSTRAINT catalog_determinations_pkey PRIMARY KEY (id);


--
-- TOC entry 6156 (class 2606 OID 26290)
-- Name: catalog_equipment_consumables catalog_equipment_consumables_equipment_id_consumable_id_de_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_equipment_consumables
    ADD CONSTRAINT catalog_equipment_consumables_equipment_id_consumable_id_de_key UNIQUE (equipment_id, consumable_id, determination_id);


--
-- TOC entry 6158 (class 2606 OID 26131)
-- Name: catalog_equipment_consumables catalog_equipment_consumables_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_equipment_consumables
    ADD CONSTRAINT catalog_equipment_consumables_pkey PRIMARY KEY (id);


--
-- TOC entry 6180 (class 2606 OID 26263)
-- Name: catalog_investments catalog_investments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_investments
    ADD CONSTRAINT catalog_investments_pkey PRIMARY KEY (id);


--
-- TOC entry 5897 (class 2606 OID 16619)
-- Name: inventory_movements chk_inventory_movements_type; Type: CHECK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE public.inventory_movements
    ADD CONSTRAINT chk_inventory_movements_type CHECK ((type = ANY (ARRAY['in'::text, 'out'::text]))) NOT VALID;


--
-- TOC entry 5899 (class 2606 OID 16620)
-- Name: request_approvals chk_request_approvals_action; Type: CHECK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE public.request_approvals
    ADD CONSTRAINT chk_request_approvals_action CHECK (((action IS NULL) OR (action = ANY (ARRAY['approve'::text, 'reject'::text])))) NOT VALID;


--
-- TOC entry 6136 (class 2606 OID 25728)
-- Name: client_assignments client_assignments_client_request_id_assigned_to_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_assignments
    ADD CONSTRAINT client_assignments_client_request_id_assigned_to_email_key UNIQUE (client_request_id, assigned_to_email);


--
-- TOC entry 6138 (class 2606 OID 25726)
-- Name: client_assignments client_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_assignments
    ADD CONSTRAINT client_assignments_pkey PRIMARY KEY (id);


--
-- TOC entry 6083 (class 2606 OID 17146)
-- Name: client_request_consent_tokens client_request_consent_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_request_consent_tokens
    ADD CONSTRAINT client_request_consent_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 6081 (class 2606 OID 17124)
-- Name: client_request_consents client_request_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_request_consents
    ADD CONSTRAINT client_request_consents_pkey PRIMARY KEY (id);


--
-- TOC entry 6072 (class 2606 OID 17104)
-- Name: client_requests client_requests_lopdp_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_requests
    ADD CONSTRAINT client_requests_lopdp_token_key UNIQUE (lopdp_token);


--
-- TOC entry 6074 (class 2606 OID 17102)
-- Name: client_requests client_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_requests
    ADD CONSTRAINT client_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 6076 (class 2606 OID 17106)
-- Name: client_requests client_requests_ruc_cedula_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_requests
    ADD CONSTRAINT client_requests_ruc_cedula_key UNIQUE (ruc_cedula);


--
-- TOC entry 6140 (class 2606 OID 25752)
-- Name: client_visit_logs client_visit_logs_client_request_id_user_email_visit_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_visit_logs
    ADD CONSTRAINT client_visit_logs_client_request_id_user_email_visit_date_key UNIQUE (client_request_id, user_email, visit_date);


--
-- TOC entry 6142 (class 2606 OID 25750)
-- Name: client_visit_logs client_visit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_visit_logs
    ADD CONSTRAINT client_visit_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 6094 (class 2606 OID 17260)
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- TOC entry 6096 (class 2606 OID 17262)
-- Name: clients clients_ruc_hash_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_ruc_hash_key UNIQUE (ruc_hash);


--
-- TOC entry 6162 (class 2606 OID 26170)
-- Name: contract_determinations contract_determinations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_determinations
    ADD CONSTRAINT contract_determinations_pkey PRIMARY KEY (id);


--
-- TOC entry 6062 (class 2606 OID 16973)
-- Name: departments departments_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_code_key UNIQUE (code);


--
-- TOC entry 6064 (class 2606 OID 16971)
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- TOC entry 6168 (class 2606 OID 26203)
-- Name: determination_consumption_log determination_consumption_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.determination_consumption_log
    ADD CONSTRAINT determination_consumption_log_pkey PRIMARY KEY (id);


--
-- TOC entry 6374 (class 2606 OID 28668)
-- Name: document_hashes document_hashes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_hashes
    ADD CONSTRAINT document_hashes_pkey PRIMARY KEY (id);


--
-- TOC entry 6395 (class 2606 OID 28763)
-- Name: document_qr_codes document_qr_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_qr_codes
    ADD CONSTRAINT document_qr_codes_pkey PRIMARY KEY (id);


--
-- TOC entry 6386 (class 2606 OID 28729)
-- Name: document_seals document_seals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_seals
    ADD CONSTRAINT document_seals_pkey PRIMARY KEY (id);


--
-- TOC entry 6388 (class 2606 OID 28731)
-- Name: document_seals document_seals_seal_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_seals
    ADD CONSTRAINT document_seals_seal_code_key UNIQUE (seal_code);


--
-- TOC entry 6402 (class 2606 OID 28788)
-- Name: document_signature_logs document_signature_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_signature_logs
    ADD CONSTRAINT document_signature_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 6380 (class 2606 OID 28697)
-- Name: document_signatures_advanced document_signatures_advanced_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_signatures_advanced
    ADD CONSTRAINT document_signatures_advanced_pkey PRIMARY KEY (id);


--
-- TOC entry 5992 (class 2606 OID 16622)
-- Name: document_signatures document_signatures_document_id_signer_user_id_role_at_sign_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_signatures
    ADD CONSTRAINT document_signatures_document_id_signer_user_id_role_at_sign_key UNIQUE (document_id, signer_user_id, role_at_sign);


--
-- TOC entry 5994 (class 2606 OID 16624)
-- Name: document_signatures document_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_signatures
    ADD CONSTRAINT document_signatures_pkey PRIMARY KEY (id);


--
-- TOC entry 6404 (class 2606 OID 28808)
-- Name: document_verifications document_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_verifications
    ADD CONSTRAINT document_verifications_pkey PRIMARY KEY (id);


--
-- TOC entry 6406 (class 2606 OID 28810)
-- Name: document_verifications document_verifications_verification_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_verifications
    ADD CONSTRAINT document_verifications_verification_token_key UNIQUE (verification_token);


--
-- TOC entry 5996 (class 2606 OID 16626)
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- TOC entry 5999 (class 2606 OID 16628)
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- TOC entry 6344 (class 2606 OID 28443)
-- Name: equipment_models equipment_models_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipment_models
    ADD CONSTRAINT equipment_models_pkey PRIMARY KEY (id);


--
-- TOC entry 6237 (class 2606 OID 26984)
-- Name: equipment_price_history equipment_price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipment_price_history
    ADD CONSTRAINT equipment_price_history_pkey PRIMARY KEY (id);


--
-- TOC entry 6128 (class 2606 OID 17477)
-- Name: equipment_purchase_bc_items equipment_purchase_bc_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipment_purchase_bc_items
    ADD CONSTRAINT equipment_purchase_bc_items_pkey PRIMARY KEY (id);


--
-- TOC entry 6110 (class 2606 OID 17334)
-- Name: equipment_purchase_requests equipment_purchase_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipment_purchase_requests
    ADD CONSTRAINT equipment_purchase_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 6274 (class 2606 OID 27322)
-- Name: equipos_historial equipos_historial_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_historial
    ADD CONSTRAINT equipos_historial_pkey PRIMARY KEY (id);


--
-- TOC entry 6266 (class 2606 OID 27284)
-- Name: equipos_modelo equipos_modelo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_modelo
    ADD CONSTRAINT equipos_modelo_pkey PRIMARY KEY (id);


--
-- TOC entry 6268 (class 2606 OID 27286)
-- Name: equipos_modelo equipos_modelo_sku_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_modelo
    ADD CONSTRAINT equipos_modelo_sku_key UNIQUE (sku);


--
-- TOC entry 6264 (class 2606 OID 27261)
-- Name: equipos_movimientos equipos_movimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_movimientos
    ADD CONSTRAINT equipos_movimientos_pkey PRIMARY KEY (id);


--
-- TOC entry 6260 (class 2606 OID 27241)
-- Name: equipos equipos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_pkey PRIMARY KEY (id);


--
-- TOC entry 6262 (class 2606 OID 27243)
-- Name: equipos equipos_sku_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_sku_key UNIQUE (sku);


--
-- TOC entry 6270 (class 2606 OID 27303)
-- Name: equipos_unidad equipos_unidad_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_unidad
    ADD CONSTRAINT equipos_unidad_pkey PRIMARY KEY (id);


--
-- TOC entry 6272 (class 2606 OID 27305)
-- Name: equipos_unidad equipos_unidad_serial_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_unidad
    ADD CONSTRAINT equipos_unidad_serial_key UNIQUE (serial);


--
-- TOC entry 6006 (class 2606 OID 16630)
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- TOC entry 6001 (class 2606 OID 16632)
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- TOC entry 6003 (class 2606 OID 16634)
-- Name: inventory inventory_sku_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_sku_key UNIQUE (sku);


--
-- TOC entry 6367 (class 2606 OID 28615)
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- TOC entry 6218 (class 2606 OID 26501)
-- Name: permisos_vacaciones permisos_vacaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos_vacaciones
    ADD CONSTRAINT permisos_vacaciones_pkey PRIMARY KEY (id);


--
-- TOC entry 6126 (class 2606 OID 17443)
-- Name: personnel_request_comments personnel_request_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_request_comments
    ADD CONSTRAINT personnel_request_comments_pkey PRIMARY KEY (id);


--
-- TOC entry 6123 (class 2606 OID 17418)
-- Name: personnel_request_history personnel_request_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_request_history
    ADD CONSTRAINT personnel_request_history_pkey PRIMARY KEY (id);


--
-- TOC entry 6118 (class 2606 OID 17378)
-- Name: personnel_requests personnel_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_requests
    ADD CONSTRAINT personnel_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 6120 (class 2606 OID 17380)
-- Name: personnel_requests personnel_requests_request_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_requests
    ADD CONSTRAINT personnel_requests_request_number_key UNIQUE (request_number);


--
-- TOC entry 6351 (class 2606 OID 28493)
-- Name: prospect_visits prospect_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prospect_visits
    ADD CONSTRAINT prospect_visits_pkey PRIMARY KEY (id);


--
-- TOC entry 6009 (class 2606 OID 16636)
-- Name: request_approvals request_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_approvals
    ADD CONSTRAINT request_approvals_pkey PRIMARY KEY (id);


--
-- TOC entry 6011 (class 2606 OID 16638)
-- Name: request_approvals request_approvals_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_approvals
    ADD CONSTRAINT request_approvals_token_key UNIQUE (token);


--
-- TOC entry 6014 (class 2606 OID 16640)
-- Name: request_attachments request_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_attachments
    ADD CONSTRAINT request_attachments_pkey PRIMARY KEY (id);


--
-- TOC entry 6017 (class 2606 OID 16642)
-- Name: request_status_history request_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_status_history
    ADD CONSTRAINT request_status_history_pkey PRIMARY KEY (id);


--
-- TOC entry 6020 (class 2606 OID 16644)
-- Name: request_types request_types_code_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_types
    ADD CONSTRAINT request_types_code_unique UNIQUE (code);


--
-- TOC entry 6022 (class 2606 OID 16646)
-- Name: request_types request_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_types
    ADD CONSTRAINT request_types_pkey PRIMARY KEY (id);


--
-- TOC entry 6024 (class 2606 OID 16648)
-- Name: request_versions request_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_versions
    ADD CONSTRAINT request_versions_pkey PRIMARY KEY (id);


--
-- TOC entry 6030 (class 2606 OID 16650)
-- Name: requests requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_pkey PRIMARY KEY (id);


--
-- TOC entry 6202 (class 2606 OID 26405)
-- Name: scheduled_visits scheduled_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scheduled_visits
    ADD CONSTRAINT scheduled_visits_pkey PRIMARY KEY (id);


--
-- TOC entry 6204 (class 2606 OID 26407)
-- Name: scheduled_visits scheduled_visits_schedule_id_client_request_id_planned_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scheduled_visits
    ADD CONSTRAINT scheduled_visits_schedule_id_client_request_id_planned_date_key UNIQUE (schedule_id, client_request_id, planned_date);


--
-- TOC entry 6189 (class 2606 OID 26335)
-- Name: technical_documents technical_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.technical_documents
    ADD CONSTRAINT technical_documents_pkey PRIMARY KEY (id);


--
-- TOC entry 6212 (class 2606 OID 26459)
-- Name: travel_segments travel_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.travel_segments
    ADD CONSTRAINT travel_segments_pkey PRIMARY KEY (id);


--
-- TOC entry 6101 (class 2606 OID 17264)
-- Name: clients unique_client_request; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT unique_client_request UNIQUE (client_request_id);


--
-- TOC entry 6378 (class 2606 OID 28670)
-- Name: document_hashes unique_current_hash; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_hashes
    ADD CONSTRAINT unique_current_hash UNIQUE (document_id, is_current) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 6090 (class 2606 OID 17184)
-- Name: user_attendance_records unique_user_date; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_attendance_records
    ADD CONSTRAINT unique_user_date UNIQUE (user_id, date);


--
-- TOC entry 6092 (class 2606 OID 17182)
-- Name: user_attendance_records user_attendance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_attendance_records
    ADD CONSTRAINT user_attendance_records_pkey PRIMARY KEY (id);


--
-- TOC entry 6105 (class 2606 OID 17311)
-- Name: user_gmail_tokens user_gmail_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_gmail_tokens
    ADD CONSTRAINT user_gmail_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 6107 (class 2606 OID 17313)
-- Name: user_gmail_tokens user_gmail_tokens_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_gmail_tokens
    ADD CONSTRAINT user_gmail_tokens_user_id_key UNIQUE (user_id);


--
-- TOC entry 6085 (class 2606 OID 17166)
-- Name: user_lopdp_consents user_lopdp_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_lopdp_consents
    ADD CONSTRAINT user_lopdp_consents_pkey PRIMARY KEY (id);


--
-- TOC entry 6370 (class 2606 OID 28639)
-- Name: user_profile user_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_profile
    ADD CONSTRAINT user_profile_pkey PRIMARY KEY (id);


--
-- TOC entry 6372 (class 2606 OID 28641)
-- Name: user_profile user_profile_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_profile
    ADD CONSTRAINT user_profile_user_id_key UNIQUE (user_id);


--
-- TOC entry 6060 (class 2606 OID 16957)
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 6032 (class 2606 OID 16652)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 6034 (class 2606 OID 16654)
-- Name: users users_google_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_google_id_key UNIQUE (google_id);


--
-- TOC entry 6036 (class 2606 OID 16656)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 6134 (class 2606 OID 25713)
-- Name: vacaciones_solicitudes vacaciones_solicitudes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vacaciones_solicitudes
    ADD CONSTRAINT vacaciones_solicitudes_pkey PRIMARY KEY (id);


--
-- TOC entry 6195 (class 2606 OID 26386)
-- Name: visit_schedules visit_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.visit_schedules
    ADD CONSTRAINT visit_schedules_pkey PRIMARY KEY (id);


--
-- TOC entry 6197 (class 2606 OID 26388)
-- Name: visit_schedules visit_schedules_user_email_month_year_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.visit_schedules
    ADD CONSTRAINT visit_schedules_user_email_month_year_key UNIQUE (user_email, month, year);


--
-- TOC entry 6191 (class 2606 OID 26363)
-- Name: aplicaciones_tecnicas aplicaciones_tecnicas_pkey; Type: CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.aplicaciones_tecnicas
    ADD CONSTRAINT aplicaciones_tecnicas_pkey PRIMARY KEY (id);


--
-- TOC entry 6038 (class 2606 OID 16658)
-- Name: cronograma_capacitacion cronograma_capacitacion_pkey; Type: CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_capacitacion
    ADD CONSTRAINT cronograma_capacitacion_pkey PRIMARY KEY (id_capacitacion);


--
-- TOC entry 6048 (class 2606 OID 16660)
-- Name: cronograma_mantenimientos_anuales cronograma_mantenimientos_anuales_pkey; Type: CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos_anuales
    ADD CONSTRAINT cronograma_mantenimientos_anuales_pkey PRIMARY KEY (id_mant_anual);


--
-- TOC entry 6040 (class 2606 OID 17052)
-- Name: cronograma_mantenimientos cronograma_mantenimientos_id_unique; Type: CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos
    ADD CONSTRAINT cronograma_mantenimientos_id_unique UNIQUE (id);


--
-- TOC entry 6042 (class 2606 OID 16662)
-- Name: cronograma_mantenimientos cronograma_mantenimientos_pkey; Type: CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos
    ADD CONSTRAINT cronograma_mantenimientos_pkey PRIMARY KEY (id_mantenimiento);


--
-- TOC entry 6130 (class 2606 OID 25688)
-- Name: disponibilidad_tecnicos disponibilidad_tecnicos_pkey; Type: CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.disponibilidad_tecnicos
    ADD CONSTRAINT disponibilidad_tecnicos_pkey PRIMARY KEY (id);


--
-- TOC entry 6132 (class 2606 OID 25690)
-- Name: disponibilidad_tecnicos disponibilidad_tecnicos_user_id_key; Type: CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.disponibilidad_tecnicos
    ADD CONSTRAINT disponibilidad_tecnicos_user_id_key UNIQUE (user_id);


--
-- TOC entry 6051 (class 2606 OID 16664)
-- Name: equipos equipos_nombre_key; Type: CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.equipos
    ADD CONSTRAINT equipos_nombre_key UNIQUE (nombre);


--
-- TOC entry 6053 (class 2606 OID 16666)
-- Name: equipos equipos_pkey; Type: CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.equipos
    ADD CONSTRAINT equipos_pkey PRIMARY KEY (id_equipo);


--
-- TOC entry 6058 (class 2606 OID 26881)
-- Name: equipos servicio_equipos_code_unique; Type: CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.equipos
    ADD CONSTRAINT servicio_equipos_code_unique UNIQUE (code);


--
-- TOC entry 6065 (class 1259 OID 16999)
-- Name: idx_auditoria_accion; Type: INDEX; Schema: auditoria; Owner: postgres
--

CREATE INDEX idx_auditoria_accion ON auditoria.logs USING btree (accion);


--
-- TOC entry 6066 (class 1259 OID 16996)
-- Name: idx_auditoria_fecha; Type: INDEX; Schema: auditoria; Owner: postgres
--

CREATE INDEX idx_auditoria_fecha ON auditoria.logs USING btree (fecha DESC);


--
-- TOC entry 6067 (class 1259 OID 16998)
-- Name: idx_auditoria_modulo; Type: INDEX; Schema: auditoria; Owner: postgres
--

CREATE INDEX idx_auditoria_modulo ON auditoria.logs USING btree (modulo);


--
-- TOC entry 6068 (class 1259 OID 16997)
-- Name: idx_auditoria_usuario; Type: INDEX; Schema: auditoria; Owner: postgres
--

CREATE INDEX idx_auditoria_usuario ON auditoria.logs USING btree (usuario_email);


--
-- TOC entry 6229 (class 1259 OID 27526)
-- Name: bc_calculations_business_case_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bc_calculations_business_case_id_idx ON public.bc_calculations USING btree (business_case_id);


--
-- TOC entry 6232 (class 1259 OID 27527)
-- Name: bc_calculations_calculated_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bc_calculations_calculated_at_idx ON public.bc_calculations USING btree (calculated_at DESC);


--
-- TOC entry 6221 (class 1259 OID 27497)
-- Name: bc_determinations_business_case_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bc_determinations_business_case_id_idx ON public.bc_determinations USING btree (business_case_id);


--
-- TOC entry 6222 (class 1259 OID 27498)
-- Name: bc_determinations_determination_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bc_determinations_determination_id_idx ON public.bc_determinations USING btree (determination_id);


--
-- TOC entry 6225 (class 1259 OID 27499)
-- Name: bc_determinations_unique_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX bc_determinations_unique_idx ON public.bc_determinations USING btree (business_case_id, determination_id);


--
-- TOC entry 6254 (class 1259 OID 27494)
-- Name: bc_equipment_selection_business_case_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bc_equipment_selection_business_case_id_idx ON public.bc_equipment_selection USING btree (business_case_id);


--
-- TOC entry 6255 (class 1259 OID 27495)
-- Name: bc_equipment_selection_equipment_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bc_equipment_selection_equipment_id_idx ON public.bc_equipment_selection USING btree (equipment_id);


--
-- TOC entry 6258 (class 1259 OID 27493)
-- Name: bc_equipment_selection_primary_unique_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX bc_equipment_selection_primary_unique_idx ON public.bc_equipment_selection USING btree (business_case_id) WHERE (is_primary = true);


--
-- TOC entry 6277 (class 1259 OID 27523)
-- Name: bc_investments_business_case_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bc_investments_business_case_id_idx ON public.bc_investments USING btree (business_case_id);


--
-- TOC entry 6278 (class 1259 OID 27525)
-- Name: bc_investments_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bc_investments_category_idx ON public.bc_investments USING btree (category);


--
-- TOC entry 6279 (class 1259 OID 27524)
-- Name: bc_investments_investment_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bc_investments_investment_type_idx ON public.bc_investments USING btree (investment_type);


--
-- TOC entry 6342 (class 1259 OID 28444)
-- Name: equipment_models_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX equipment_models_code_key ON public.equipment_models USING btree (code) WHERE (code IS NOT NULL);


--
-- TOC entry 6108 (class 1259 OID 27460)
-- Name: equipment_purchase_requests_bc_purchase_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX equipment_purchase_requests_bc_purchase_type_idx ON public.equipment_purchase_requests USING btree (bc_purchase_type);


--
-- TOC entry 6086 (class 1259 OID 17191)
-- Name: idx_attendance_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendance_date ON public.user_attendance_records USING btree (date DESC);


--
-- TOC entry 6349 (class 1259 OID 28472)
-- Name: idx_attendance_exceptions_user_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendance_exceptions_user_date ON public.attendance_exceptions USING btree (user_id, date);


--
-- TOC entry 6087 (class 1259 OID 17192)
-- Name: idx_attendance_incomplete; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendance_incomplete ON public.user_attendance_records USING btree (user_id, date) WHERE (exit_time IS NULL);


--
-- TOC entry 6088 (class 1259 OID 17190)
-- Name: idx_attendance_user_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendance_user_date ON public.user_attendance_records USING btree (user_id, date DESC);


--
-- TOC entry 5988 (class 1259 OID 16826)
-- Name: idx_audit_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_created_at ON public.audit_trail USING btree (created_at DESC);


--
-- TOC entry 6360 (class 1259 OID 28597)
-- Name: idx_audit_documents_section; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_documents_section ON public.audit_documents USING btree (section_code);


--
-- TOC entry 6361 (class 1259 OID 28598)
-- Name: idx_audit_documents_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_documents_status ON public.audit_documents USING btree (status);


--
-- TOC entry 5989 (class 1259 OID 16825)
-- Name: idx_audit_module_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_module_action ON public.audit_trail USING btree (module, action);


--
-- TOC entry 5990 (class 1259 OID 16827)
-- Name: idx_audit_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_user ON public.audit_trail USING btree (user_id);


--
-- TOC entry 6174 (class 1259 OID 26244)
-- Name: idx_bc_alerts_acknowledged; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_alerts_acknowledged ON public.bc_alerts USING btree (acknowledged);


--
-- TOC entry 6175 (class 1259 OID 26240)
-- Name: idx_bc_alerts_bc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_alerts_bc ON public.bc_alerts USING btree (business_case_id);


--
-- TOC entry 6176 (class 1259 OID 26241)
-- Name: idx_bc_alerts_contract; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_alerts_contract ON public.bc_alerts USING btree (contract_determination_id);


--
-- TOC entry 6177 (class 1259 OID 26243)
-- Name: idx_bc_alerts_severity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_alerts_severity ON public.bc_alerts USING btree (severity);


--
-- TOC entry 6178 (class 1259 OID 26242)
-- Name: idx_bc_alerts_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_alerts_type ON public.bc_alerts USING btree (alert_type);


--
-- TOC entry 6243 (class 1259 OID 27027)
-- Name: idx_bc_audit_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_audit_action ON public.bc_audit_log USING btree (action);


--
-- TOC entry 6244 (class 1259 OID 27026)
-- Name: idx_bc_audit_bc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_audit_bc ON public.bc_audit_log USING btree (business_case_id);


--
-- TOC entry 6245 (class 1259 OID 27028)
-- Name: idx_bc_audit_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_audit_date ON public.bc_audit_log USING btree (changed_at);


--
-- TOC entry 6235 (class 1259 OID 26968)
-- Name: idx_bc_calculations_bc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_calculations_bc ON public.bc_calculations USING btree (business_case_id);


--
-- TOC entry 6312 (class 1259 OID 27686)
-- Name: idx_bc_deliveries_bc_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_deliveries_bc_id ON public.bc_deliveries USING btree (business_case_id);


--
-- TOC entry 6226 (class 1259 OID 26940)
-- Name: idx_bc_determinations_bc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_determinations_bc ON public.bc_determinations USING btree (business_case_id);


--
-- TOC entry 6227 (class 1259 OID 26941)
-- Name: idx_bc_determinations_det; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_determinations_det ON public.bc_determinations USING btree (determination_id);


--
-- TOC entry 6228 (class 1259 OID 28265)
-- Name: idx_bc_determinations_master; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_determinations_master ON public.bc_determinations USING btree (bc_master_id);


--
-- TOC entry 6325 (class 1259 OID 28377)
-- Name: idx_bc_economic_data_master; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_economic_data_master ON public.bc_economic_data USING btree (bc_master_id);


--
-- TOC entry 6293 (class 1259 OID 27682)
-- Name: idx_bc_equipment_details_bc_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_equipment_details_bc_id ON public.bc_equipment_details USING btree (business_case_id);


--
-- TOC entry 6282 (class 1259 OID 28393)
-- Name: idx_bc_investments_bc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_investments_bc ON public.bc_investments USING btree (business_case_id);


--
-- TOC entry 6283 (class 1259 OID 28271)
-- Name: idx_bc_investments_master; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_investments_master ON public.bc_investments USING btree (bc_master_id);


--
-- TOC entry 6288 (class 1259 OID 27681)
-- Name: idx_bc_lab_environment_bc_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_lab_environment_bc_id ON public.bc_lab_environment USING btree (business_case_id);


--
-- TOC entry 6335 (class 1259 OID 28379)
-- Name: idx_bc_lis_data_master; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_lis_data_master ON public.bc_lis_data USING btree (bc_master_id);


--
-- TOC entry 6301 (class 1259 OID 27684)
-- Name: idx_bc_lis_equipment_interfaces_lis_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_lis_equipment_interfaces_lis_id ON public.bc_lis_equipment_interfaces USING btree (bc_lis_data_id);


--
-- TOC entry 6298 (class 1259 OID 27683)
-- Name: idx_bc_lis_integration_bc_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_lis_integration_bc_id ON public.bc_lis_integration USING btree (business_case_id);


--
-- TOC entry 6302 (class 1259 OID 28382)
-- Name: idx_bc_lis_interfaces_lis; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_lis_interfaces_lis ON public.bc_lis_equipment_interfaces USING btree (bc_lis_data_id);


--
-- TOC entry 6317 (class 1259 OID 28374)
-- Name: idx_bc_master_client; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_master_client ON public.bc_master USING btree (client_id);


--
-- TOC entry 6318 (class 1259 OID 28376)
-- Name: idx_bc_master_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_master_created ON public.bc_master USING btree (created_at DESC);


--
-- TOC entry 6319 (class 1259 OID 28373)
-- Name: idx_bc_master_stage; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_master_stage ON public.bc_master USING btree (current_stage);


--
-- TOC entry 6320 (class 1259 OID 28375)
-- Name: idx_bc_master_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_master_type ON public.bc_master USING btree (bc_type);


--
-- TOC entry 6330 (class 1259 OID 28378)
-- Name: idx_bc_operational_data_master; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_operational_data_master ON public.bc_operational_data USING btree (bc_master_id);


--
-- TOC entry 6307 (class 1259 OID 27685)
-- Name: idx_bc_requirements_bc_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_requirements_bc_id ON public.bc_requirements USING btree (business_case_id);


--
-- TOC entry 6418 (class 1259 OID 29006)
-- Name: idx_bc_section_ownership_audit_bc_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_section_ownership_audit_bc_id ON public.business_case_section_ownership_audit USING btree (business_case_id);


--
-- TOC entry 6419 (class 1259 OID 29009)
-- Name: idx_bc_section_ownership_audit_performed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_section_ownership_audit_performed_at ON public.business_case_section_ownership_audit USING btree (performed_at);


--
-- TOC entry 6420 (class 1259 OID 29008)
-- Name: idx_bc_section_ownership_audit_performed_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_section_ownership_audit_performed_by ON public.business_case_section_ownership_audit USING btree (performed_by);


--
-- TOC entry 6421 (class 1259 OID 29007)
-- Name: idx_bc_section_ownership_audit_section; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_section_ownership_audit_section ON public.business_case_section_ownership_audit USING btree (section_name);


--
-- TOC entry 6413 (class 1259 OID 29003)
-- Name: idx_bc_section_ownership_bc_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_section_ownership_bc_id ON public.business_case_section_ownership USING btree (business_case_id);


--
-- TOC entry 6414 (class 1259 OID 29005)
-- Name: idx_bc_section_ownership_completed_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_section_ownership_completed_by ON public.business_case_section_ownership USING btree (completed_by);


--
-- TOC entry 6415 (class 1259 OID 29004)
-- Name: idx_bc_section_ownership_section; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_section_ownership_section ON public.business_case_section_ownership USING btree (section_name);


--
-- TOC entry 6341 (class 1259 OID 28381)
-- Name: idx_bc_validations_master; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_validations_master ON public.bc_validations USING btree (bc_master_id, severity);


--
-- TOC entry 6338 (class 1259 OID 28380)
-- Name: idx_bc_workflow_history_master; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_workflow_history_master ON public.bc_workflow_history USING btree (bc_master_id, changed_at DESC);


--
-- TOC entry 6250 (class 1259 OID 27073)
-- Name: idx_calc_templates_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_calc_templates_active ON public.calculation_templates USING btree (is_active) WHERE (is_active = true);


--
-- TOC entry 6251 (class 1259 OID 27072)
-- Name: idx_calc_templates_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_calc_templates_category ON public.calculation_templates USING btree (category);


--
-- TOC entry 6152 (class 1259 OID 26120)
-- Name: idx_catalog_consumables_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_catalog_consumables_name ON public.catalog_consumables USING btree (name);


--
-- TOC entry 6153 (class 1259 OID 26118)
-- Name: idx_catalog_consumables_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_catalog_consumables_status ON public.catalog_consumables USING btree (status);


--
-- TOC entry 6154 (class 1259 OID 26119)
-- Name: idx_catalog_consumables_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_catalog_consumables_type ON public.catalog_consumables USING btree (type);


--
-- TOC entry 6147 (class 1259 OID 26283)
-- Name: idx_catalog_determinations_equipment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_catalog_determinations_equipment ON public.catalog_determinations USING btree (equipment_id);


--
-- TOC entry 6148 (class 1259 OID 26092)
-- Name: idx_catalog_determinations_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_catalog_determinations_name ON public.catalog_determinations USING btree (name);


--
-- TOC entry 6149 (class 1259 OID 26090)
-- Name: idx_catalog_determinations_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_catalog_determinations_status ON public.catalog_determinations USING btree (status);


--
-- TOC entry 6181 (class 1259 OID 26264)
-- Name: idx_catalog_inv_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_catalog_inv_category ON public.catalog_investments USING btree (category);


--
-- TOC entry 6182 (class 1259 OID 26265)
-- Name: idx_catalog_inv_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_catalog_inv_status ON public.catalog_investments USING btree (status);


--
-- TOC entry 6077 (class 1259 OID 17294)
-- Name: idx_client_requests_approval_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_client_requests_approval_status ON public.client_requests USING btree (approval_status);


--
-- TOC entry 6078 (class 1259 OID 17296)
-- Name: idx_client_requests_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_client_requests_created_by ON public.client_requests USING btree (created_by);


--
-- TOC entry 6079 (class 1259 OID 17295)
-- Name: idx_client_requests_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_client_requests_user_id ON public.client_requests USING btree (user_id);


--
-- TOC entry 6097 (class 1259 OID 17293)
-- Name: idx_clients_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clients_created_at ON public.clients USING btree (created_at DESC);


--
-- TOC entry 6098 (class 1259 OID 17291)
-- Name: idx_clients_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clients_estado ON public.clients USING btree (estado);


--
-- TOC entry 6099 (class 1259 OID 17292)
-- Name: idx_clients_ruc_hash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clients_ruc_hash ON public.clients USING btree (ruc_hash);


--
-- TOC entry 6169 (class 1259 OID 26209)
-- Name: idx_consumption_log_contract; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_consumption_log_contract ON public.determination_consumption_log USING btree (contract_determination_id);


--
-- TOC entry 6170 (class 1259 OID 26210)
-- Name: idx_consumption_log_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_consumption_log_date ON public.determination_consumption_log USING btree (consumption_date);


--
-- TOC entry 6171 (class 1259 OID 26211)
-- Name: idx_consumption_log_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_consumption_log_user ON public.determination_consumption_log USING btree (consumed_by_user_id);


--
-- TOC entry 6163 (class 1259 OID 26181)
-- Name: idx_contract_det_bc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contract_det_bc ON public.contract_determinations USING btree (business_case_id);


--
-- TOC entry 6164 (class 1259 OID 26182)
-- Name: idx_contract_det_client; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contract_det_client ON public.contract_determinations USING btree (client_id);


--
-- TOC entry 6165 (class 1259 OID 26183)
-- Name: idx_contract_det_determination; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contract_det_determination ON public.contract_determinations USING btree (determination_id);


--
-- TOC entry 6166 (class 1259 OID 26184)
-- Name: idx_contract_det_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contract_det_status ON public.contract_determinations USING btree (status);


--
-- TOC entry 6375 (class 1259 OID 28837)
-- Name: idx_document_hashes_current; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_hashes_current ON public.document_hashes USING btree (document_id, is_current) WHERE (is_current = true);


--
-- TOC entry 6376 (class 1259 OID 28836)
-- Name: idx_document_hashes_document_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_hashes_document_id ON public.document_hashes USING btree (document_id);


--
-- TOC entry 6396 (class 1259 OID 28854)
-- Name: idx_document_qr_codes_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_qr_codes_active ON public.document_qr_codes USING btree (is_active) WHERE (is_active = true);


--
-- TOC entry 6397 (class 1259 OID 28851)
-- Name: idx_document_qr_codes_document_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_qr_codes_document_id ON public.document_qr_codes USING btree (document_id);


--
-- TOC entry 6398 (class 1259 OID 28852)
-- Name: idx_document_qr_codes_seal_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_qr_codes_seal_id ON public.document_qr_codes USING btree (seal_id);


--
-- TOC entry 6399 (class 1259 OID 28853)
-- Name: idx_document_qr_codes_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_qr_codes_token ON public.document_qr_codes USING btree (verification_token);


--
-- TOC entry 6400 (class 1259 OID 28869)
-- Name: idx_document_qr_codes_verification; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_qr_codes_verification ON public.document_qr_codes USING btree (document_id, is_active, verification_token);


--
-- TOC entry 6389 (class 1259 OID 28850)
-- Name: idx_document_seals_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_seals_active ON public.document_seals USING btree (is_active) WHERE (is_active = true);


--
-- TOC entry 6390 (class 1259 OID 28847)
-- Name: idx_document_seals_document_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_seals_document_id ON public.document_seals USING btree (document_id);


--
-- TOC entry 6391 (class 1259 OID 28848)
-- Name: idx_document_seals_seal_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_seals_seal_code ON public.document_seals USING btree (seal_code);


--
-- TOC entry 6392 (class 1259 OID 28849)
-- Name: idx_document_seals_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_seals_token ON public.document_seals USING btree (seal_token);


--
-- TOC entry 6393 (class 1259 OID 28868)
-- Name: idx_document_seals_verification; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_seals_verification ON public.document_seals USING btree (document_id, is_active, seal_token);


--
-- TOC entry 6381 (class 1259 OID 28838)
-- Name: idx_document_signatures_advanced_document_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_signatures_advanced_document_id ON public.document_signatures_advanced USING btree (document_id);


--
-- TOC entry 6382 (class 1259 OID 28840)
-- Name: idx_document_signatures_advanced_signed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_signatures_advanced_signed_at ON public.document_signatures_advanced USING btree (signed_at DESC);


--
-- TOC entry 6383 (class 1259 OID 28839)
-- Name: idx_document_signatures_advanced_signer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_signatures_advanced_signer ON public.document_signatures_advanced USING btree (signer_user_id);


--
-- TOC entry 6384 (class 1259 OID 28841)
-- Name: idx_document_signatures_advanced_valid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_signatures_advanced_valid ON public.document_signatures_advanced USING btree (is_valid) WHERE (is_valid = true);


--
-- TOC entry 5997 (class 1259 OID 16667)
-- Name: idx_documents_request_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_request_id ON public.documents USING btree (request_id);


--
-- TOC entry 6159 (class 1259 OID 26150)
-- Name: idx_eq_cons_determination; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_eq_cons_determination ON public.catalog_equipment_consumables USING btree (determination_id);


--
-- TOC entry 6160 (class 1259 OID 26291)
-- Name: idx_eq_cons_equipment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_eq_cons_equipment ON public.catalog_equipment_consumables USING btree (equipment_id);


--
-- TOC entry 6345 (class 1259 OID 28445)
-- Name: idx_equipment_models_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_equipment_models_name ON public.equipment_models USING btree (name);


--
-- TOC entry 6346 (class 1259 OID 28446)
-- Name: idx_equipment_models_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_equipment_models_status ON public.equipment_models USING btree (status);


--
-- TOC entry 6111 (class 1259 OID 27086)
-- Name: idx_equipment_purchase_requests_modern; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_equipment_purchase_requests_modern ON public.equipment_purchase_requests USING btree (uses_modern_system) WHERE (uses_modern_system = true);


--
-- TOC entry 6112 (class 1259 OID 27085)
-- Name: idx_equipment_purchase_requests_system_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_equipment_purchase_requests_system_type ON public.equipment_purchase_requests USING btree (bc_system_type) WHERE ((bc_system_type)::text = 'modern'::text);


--
-- TOC entry 6004 (class 1259 OID 16668)
-- Name: idx_inventory_movements_inventory; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_movements_inventory ON public.inventory_movements USING btree (inventory_id);


--
-- TOC entry 6207 (class 1259 OID 26477)
-- Name: idx_location_history_activity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_location_history_activity ON public.advisor_location_history USING btree (activity_type);


--
-- TOC entry 6208 (class 1259 OID 26476)
-- Name: idx_location_history_client; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_location_history_client ON public.advisor_location_history USING btree (client_request_id);


--
-- TOC entry 6209 (class 1259 OID 26475)
-- Name: idx_location_history_user_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_location_history_user_time ON public.advisor_location_history USING btree (user_email, "timestamp" DESC);


--
-- TOC entry 6364 (class 1259 OID 28622)
-- Name: idx_notifications_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_status ON public.notifications USING btree (status);


--
-- TOC entry 6365 (class 1259 OID 28621)
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);


--
-- TOC entry 6213 (class 1259 OID 26505)
-- Name: idx_permisos_approver; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_permisos_approver ON public.permisos_vacaciones USING btree (approver_role);


--
-- TOC entry 6214 (class 1259 OID 26503)
-- Name: idx_permisos_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_permisos_status ON public.permisos_vacaciones USING btree (status);


--
-- TOC entry 6215 (class 1259 OID 26504)
-- Name: idx_permisos_tipo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_permisos_tipo ON public.permisos_vacaciones USING btree (tipo_solicitud);


--
-- TOC entry 6216 (class 1259 OID 26502)
-- Name: idx_permisos_user_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_permisos_user_email ON public.permisos_vacaciones USING btree (user_email);


--
-- TOC entry 6124 (class 1259 OID 17459)
-- Name: idx_personnel_request_comments_request; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_personnel_request_comments_request ON public.personnel_request_comments USING btree (personnel_request_id);


--
-- TOC entry 6121 (class 1259 OID 17458)
-- Name: idx_personnel_request_history_request; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_personnel_request_history_request ON public.personnel_request_history USING btree (personnel_request_id);


--
-- TOC entry 6113 (class 1259 OID 17457)
-- Name: idx_personnel_requests_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_personnel_requests_created_at ON public.personnel_requests USING btree (created_at DESC);


--
-- TOC entry 6114 (class 1259 OID 17455)
-- Name: idx_personnel_requests_department; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_personnel_requests_department ON public.personnel_requests USING btree (department_id);


--
-- TOC entry 6115 (class 1259 OID 17454)
-- Name: idx_personnel_requests_requester; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_personnel_requests_requester ON public.personnel_requests USING btree (requester_id);


--
-- TOC entry 6116 (class 1259 OID 17456)
-- Name: idx_personnel_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_personnel_requests_status ON public.personnel_requests USING btree (status);


--
-- TOC entry 6238 (class 1259 OID 27006)
-- Name: idx_price_history_consumable; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_price_history_consumable ON public.equipment_price_history USING btree (consumable_id) WHERE (consumable_id IS NOT NULL);


--
-- TOC entry 6239 (class 1259 OID 27007)
-- Name: idx_price_history_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_price_history_dates ON public.equipment_price_history USING btree (effective_from, effective_to);


--
-- TOC entry 6240 (class 1259 OID 27005)
-- Name: idx_price_history_equipment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_price_history_equipment ON public.equipment_price_history USING btree (equipment_id) WHERE (equipment_id IS NOT NULL);


--
-- TOC entry 6007 (class 1259 OID 16669)
-- Name: idx_request_approvals_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_request_approvals_pending ON public.request_approvals USING btree (used, token_expires_at);


--
-- TOC entry 6012 (class 1259 OID 16670)
-- Name: idx_request_attachments_request; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_request_attachments_request ON public.request_attachments USING btree (request_id);


--
-- TOC entry 6018 (class 1259 OID 16671)
-- Name: idx_request_types_schema_gin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_request_types_schema_gin ON public.request_types USING gin (schema);


--
-- TOC entry 6026 (class 1259 OID 16672)
-- Name: idx_requests_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requests_created_at ON public.requests USING btree (created_at);


--
-- TOC entry 6027 (class 1259 OID 16673)
-- Name: idx_requests_payload_gin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requests_payload_gin ON public.requests USING gin (payload);


--
-- TOC entry 6028 (class 1259 OID 16674)
-- Name: idx_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requests_status ON public.requests USING btree (status);


--
-- TOC entry 6015 (class 1259 OID 16675)
-- Name: idx_rsh_request_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsh_request_id ON public.request_status_history USING btree (request_id);


--
-- TOC entry 6198 (class 1259 OID 26474)
-- Name: idx_scheduled_visits_city; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scheduled_visits_city ON public.scheduled_visits USING btree (city);


--
-- TOC entry 6199 (class 1259 OID 26473)
-- Name: idx_scheduled_visits_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scheduled_visits_date ON public.scheduled_visits USING btree (planned_date);


--
-- TOC entry 6200 (class 1259 OID 26472)
-- Name: idx_scheduled_visits_schedule; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scheduled_visits_schedule ON public.scheduled_visits USING btree (schedule_id);


--
-- TOC entry 6183 (class 1259 OID 26343)
-- Name: idx_tech_docs_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tech_docs_created ON public.technical_documents USING btree (created_at DESC);


--
-- TOC entry 6184 (class 1259 OID 26344)
-- Name: idx_tech_docs_equipment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tech_docs_equipment ON public.technical_documents USING btree (equipment_name);


--
-- TOC entry 6185 (class 1259 OID 26345)
-- Name: idx_tech_docs_serial; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tech_docs_serial ON public.technical_documents USING btree (equipment_serial);


--
-- TOC entry 6186 (class 1259 OID 26341)
-- Name: idx_tech_docs_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tech_docs_type ON public.technical_documents USING btree (document_type);


--
-- TOC entry 6187 (class 1259 OID 26342)
-- Name: idx_tech_docs_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tech_docs_user ON public.technical_documents USING btree (user_id);


--
-- TOC entry 6210 (class 1259 OID 26478)
-- Name: idx_travel_segments_user_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_travel_segments_user_date ON public.travel_segments USING btree (user_email, travel_date);


--
-- TOC entry 6102 (class 1259 OID 17320)
-- Name: idx_user_gmail_tokens_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_gmail_tokens_email ON public.user_gmail_tokens USING btree (email);


--
-- TOC entry 6103 (class 1259 OID 17319)
-- Name: idx_user_gmail_tokens_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_gmail_tokens_user_id ON public.user_gmail_tokens USING btree (user_id);


--
-- TOC entry 6368 (class 1259 OID 28647)
-- Name: idx_user_profile_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_profile_user_id ON public.user_profile USING btree (user_id);


--
-- TOC entry 6192 (class 1259 OID 26471)
-- Name: idx_visit_schedules_month_year; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_visit_schedules_month_year ON public.visit_schedules USING btree (year, month, status);


--
-- TOC entry 6193 (class 1259 OID 26470)
-- Name: idx_visit_schedules_user_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_visit_schedules_user_status ON public.visit_schedules USING btree (user_email, status);


--
-- TOC entry 6275 (class 1259 OID 27436)
-- Name: private_purchase_requests_created_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX private_purchase_requests_created_by_idx ON public.private_purchase_requests USING btree (created_by);


--
-- TOC entry 6276 (class 1259 OID 27435)
-- Name: private_purchase_requests_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX private_purchase_requests_status_idx ON public.private_purchase_requests USING btree (status);


--
-- TOC entry 6025 (class 1259 OID 16676)
-- Name: uidx_request_versions_req_ver; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uidx_request_versions_req_ver ON public.request_versions USING btree (request_id, version_number);


--
-- TOC entry 6043 (class 1259 OID 17071)
-- Name: idx_cronograma_mantenimientos_next_status; Type: INDEX; Schema: servicio; Owner: postgres
--

CREATE INDEX idx_cronograma_mantenimientos_next_status ON servicio.cronograma_mantenimientos USING btree (next_maintenance_status);


--
-- TOC entry 6044 (class 1259 OID 17053)
-- Name: idx_cronograma_mantenimientos_request_id; Type: INDEX; Schema: servicio; Owner: postgres
--

CREATE INDEX idx_cronograma_mantenimientos_request_id ON servicio.cronograma_mantenimientos USING btree (request_id);


--
-- TOC entry 6054 (class 1259 OID 26883)
-- Name: idx_equipos_category; Type: INDEX; Schema: servicio; Owner: postgres
--

CREATE INDEX idx_equipos_category ON servicio.equipos USING btree (category_type);


--
-- TOC entry 6055 (class 1259 OID 26882)
-- Name: idx_equipos_code; Type: INDEX; Schema: servicio; Owner: postgres
--

CREATE INDEX idx_equipos_code ON servicio.equipos USING btree (code);


--
-- TOC entry 6056 (class 1259 OID 26884)
-- Name: idx_equipos_estado; Type: INDEX; Schema: servicio; Owner: postgres
--

CREATE INDEX idx_equipos_estado ON servicio.equipos USING btree (estado);


--
-- TOC entry 6049 (class 1259 OID 28650)
-- Name: idx_mantenimientos_anuales_equipo; Type: INDEX; Schema: servicio; Owner: postgres
--

CREATE INDEX idx_mantenimientos_anuales_equipo ON servicio.cronograma_mantenimientos_anuales USING btree (id_equipo);


--
-- TOC entry 6045 (class 1259 OID 28648)
-- Name: idx_mantenimientos_equipo; Type: INDEX; Schema: servicio; Owner: postgres
--

CREATE INDEX idx_mantenimientos_equipo ON servicio.cronograma_mantenimientos USING btree (id_equipo);


--
-- TOC entry 6046 (class 1259 OID 28649)
-- Name: idx_mantenimientos_fecha; Type: INDEX; Schema: servicio; Owner: postgres
--

CREATE INDEX idx_mantenimientos_fecha ON servicio.cronograma_mantenimientos USING btree (fecha_programada);


--
-- TOC entry 6564 (class 2620 OID 27032)
-- Name: bc_determinations bc_determinations_audit; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER bc_determinations_audit AFTER INSERT OR DELETE OR UPDATE ON public.bc_determinations FOR EACH ROW EXECUTE FUNCTION public.bc_audit_trigger();


--
-- TOC entry 6567 (class 2620 OID 27157)
-- Name: bc_equipment_selection bc_equipment_audit; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER bc_equipment_audit AFTER INSERT OR DELETE OR UPDATE ON public.bc_equipment_selection FOR EACH ROW EXECUTE FUNCTION public.bc_audit_trigger();


--
-- TOC entry 6565 (class 2620 OID 28369)
-- Name: bc_determinations recalculate_on_determination_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER recalculate_on_determination_change AFTER INSERT OR DELETE OR UPDATE ON public.bc_determinations FOR EACH ROW EXECUTE FUNCTION public.trigger_mark_for_recalculation();


--
-- TOC entry 6572 (class 2620 OID 28372)
-- Name: bc_economic_data recalculate_on_economic_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER recalculate_on_economic_change AFTER UPDATE ON public.bc_economic_data FOR EACH ROW EXECUTE FUNCTION public.trigger_mark_for_recalculation();


--
-- TOC entry 6570 (class 2620 OID 28370)
-- Name: bc_investments recalculate_on_investment_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER recalculate_on_investment_change AFTER INSERT OR DELETE OR UPDATE ON public.bc_investments FOR EACH ROW EXECUTE FUNCTION public.trigger_mark_for_recalculation();


--
-- TOC entry 6573 (class 2620 OID 28371)
-- Name: bc_operational_data recalculate_on_operational_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER recalculate_on_operational_change AFTER UPDATE ON public.bc_operational_data FOR EACH ROW EXECUTE FUNCTION public.trigger_mark_for_recalculation();


--
-- TOC entry 6571 (class 2620 OID 28385)
-- Name: bc_master set_bc_number; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_bc_number BEFORE INSERT ON public.bc_master FOR EACH ROW EXECUTE FUNCTION public.generate_bc_number();


--
-- TOC entry 6563 (class 2620 OID 26347)
-- Name: technical_documents tech_docs_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tech_docs_updated_at BEFORE UPDATE ON public.technical_documents FOR EACH ROW EXECUTE FUNCTION public.update_tech_docs_timestamp();


--
-- TOC entry 6556 (class 2620 OID 17194)
-- Name: user_attendance_records trg_attendance_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_attendance_updated_at BEFORE UPDATE ON public.user_attendance_records FOR EACH ROW EXECUTE FUNCTION public.update_attendance_timestamp();


--
-- TOC entry 6541 (class 2620 OID 16677)
-- Name: documents trg_documents_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- TOC entry 6574 (class 2620 OID 28879)
-- Name: document_hashes trg_ensure_single_current_hash; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_ensure_single_current_hash BEFORE INSERT OR UPDATE ON public.document_hashes FOR EACH ROW EXECUTE FUNCTION public.ensure_single_current_hash();


--
-- TOC entry 6568 (class 2620 OID 27272)
-- Name: equipos trg_equipos_touch; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_equipos_touch BEFORE UPDATE ON public.equipos FOR EACH ROW EXECUTE FUNCTION public.equipos_touch_updated_at();


--
-- TOC entry 6569 (class 2620 OID 27340)
-- Name: equipos_unidad trg_equipos_touch; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_equipos_touch BEFORE UPDATE ON public.equipos_unidad FOR EACH ROW EXECUTE FUNCTION public.equipos_touch();


--
-- TOC entry 6558 (class 2620 OID 17461)
-- Name: personnel_requests trg_generate_personnel_request_number; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_generate_personnel_request_number BEFORE INSERT ON public.personnel_requests FOR EACH ROW EXECUTE FUNCTION public.generate_personnel_request_number();


--
-- TOC entry 6577 (class 2620 OID 28861)
-- Name: document_qr_codes trg_generate_qr_url; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_generate_qr_url BEFORE INSERT ON public.document_qr_codes FOR EACH ROW EXECUTE FUNCTION public.generate_qr_url_trigger();


--
-- TOC entry 6576 (class 2620 OID 28859)
-- Name: document_seals trg_generate_seal_code; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_generate_seal_code BEFORE INSERT ON public.document_seals FOR EACH ROW EXECUTE FUNCTION public.generate_seal_code_trigger();


--
-- TOC entry 6542 (class 2620 OID 17031)
-- Name: inventory_movements trg_inventory_after_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_inventory_after_delete AFTER DELETE ON public.inventory_movements FOR EACH ROW EXECUTE FUNCTION public.recalculate_inventory();


--
-- TOC entry 6543 (class 2620 OID 17029)
-- Name: inventory_movements trg_inventory_after_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_inventory_after_insert AFTER INSERT ON public.inventory_movements FOR EACH ROW EXECUTE FUNCTION public.recalculate_inventory();


--
-- TOC entry 6544 (class 2620 OID 17030)
-- Name: inventory_movements trg_inventory_after_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_inventory_after_update AFTER UPDATE ON public.inventory_movements FOR EACH ROW EXECUTE FUNCTION public.recalculate_inventory();


--
-- TOC entry 6559 (class 2620 OID 17465)
-- Name: personnel_requests trg_log_personnel_request_status_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_log_personnel_request_status_change AFTER UPDATE ON public.personnel_requests FOR EACH ROW EXECUTE FUNCTION public.log_personnel_request_status_change();


--
-- TOC entry 6546 (class 2620 OID 16678)
-- Name: requests trg_log_request_status; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_log_request_status AFTER UPDATE OF status ON public.requests FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION public.fn_log_request_status();


--
-- TOC entry 6545 (class 2620 OID 16679)
-- Name: request_types trg_request_types_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_request_types_updated_at BEFORE UPDATE ON public.request_types FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- TOC entry 6547 (class 2620 OID 16680)
-- Name: requests trg_requests_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_requests_updated_at BEFORE UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- TOC entry 6575 (class 2620 OID 28878)
-- Name: document_signatures_advanced trg_update_document_signature_status; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_update_document_signature_status AFTER INSERT OR DELETE OR UPDATE ON public.document_signatures_advanced FOR EACH ROW EXECUTE FUNCTION public.update_document_signature_status();


--
-- TOC entry 6560 (class 2620 OID 17463)
-- Name: personnel_requests trg_update_personnel_request_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_update_personnel_request_timestamp BEFORE UPDATE ON public.personnel_requests FOR EACH ROW EXECUTE FUNCTION public.update_personnel_request_timestamp();


--
-- TOC entry 6562 (class 2620 OID 26186)
-- Name: contract_determinations trg_update_remaining_quantity; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_update_remaining_quantity BEFORE INSERT OR UPDATE OF consumed_quantity, annual_negotiated_quantity ON public.contract_determinations FOR EACH ROW EXECUTE FUNCTION public.update_remaining_quantity();


--
-- TOC entry 6548 (class 2620 OID 16681)
-- Name: users trg_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- TOC entry 6557 (class 2620 OID 27130)
-- Name: equipment_purchase_requests trigger_validate_bc_system; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_validate_bc_system BEFORE INSERT OR UPDATE ON public.equipment_purchase_requests FOR EACH ROW EXECUTE FUNCTION public.validate_bc_system_consistency();


--
-- TOC entry 6566 (class 2620 OID 27075)
-- Name: calculation_templates update_calc_templates_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_calc_templates_timestamp BEFORE UPDATE ON public.calculation_templates FOR EACH ROW EXECUTE FUNCTION public.update_calculation_templates_timestamp();


--
-- TOC entry 6549 (class 2620 OID 16682)
-- Name: cronograma_capacitacion capacitacion_update_timestamp; Type: TRIGGER; Schema: servicio; Owner: postgres
--

CREATE TRIGGER capacitacion_update_timestamp BEFORE UPDATE ON servicio.cronograma_capacitacion FOR EACH ROW EXECUTE FUNCTION servicio.update_timestamp();


--
-- TOC entry 6555 (class 2620 OID 16683)
-- Name: equipos equipos_update_timestamp; Type: TRIGGER; Schema: servicio; Owner: postgres
--

CREATE TRIGGER equipos_update_timestamp BEFORE UPDATE ON servicio.equipos FOR EACH ROW EXECUTE FUNCTION servicio.update_timestamp();


--
-- TOC entry 6553 (class 2620 OID 16684)
-- Name: cronograma_mantenimientos_anuales mantenimiento_anual_update_timestamp; Type: TRIGGER; Schema: servicio; Owner: postgres
--

CREATE TRIGGER mantenimiento_anual_update_timestamp BEFORE UPDATE ON servicio.cronograma_mantenimientos_anuales FOR EACH ROW EXECUTE FUNCTION servicio.update_timestamp();


--
-- TOC entry 6551 (class 2620 OID 16685)
-- Name: cronograma_mantenimientos mantenimiento_update_timestamp; Type: TRIGGER; Schema: servicio; Owner: postgres
--

CREATE TRIGGER mantenimiento_update_timestamp BEFORE UPDATE ON servicio.cronograma_mantenimientos FOR EACH ROW EXECUTE FUNCTION servicio.update_timestamp();


--
-- TOC entry 6550 (class 2620 OID 28651)
-- Name: cronograma_capacitacion trg_capacitacion_updated_at; Type: TRIGGER; Schema: servicio; Owner: postgres
--

CREATE TRIGGER trg_capacitacion_updated_at BEFORE UPDATE ON servicio.cronograma_capacitacion FOR EACH ROW EXECUTE FUNCTION servicio.update_timestamp();


--
-- TOC entry 6561 (class 2620 OID 28652)
-- Name: disponibilidad_tecnicos trg_disponibilidad_updated_at; Type: TRIGGER; Schema: servicio; Owner: postgres
--

CREATE TRIGGER trg_disponibilidad_updated_at BEFORE UPDATE ON servicio.disponibilidad_tecnicos FOR EACH ROW EXECUTE FUNCTION servicio.update_timestamp();


--
-- TOC entry 6554 (class 2620 OID 28654)
-- Name: cronograma_mantenimientos_anuales trg_mantenimientos_anuales_updated_at; Type: TRIGGER; Schema: servicio; Owner: postgres
--

CREATE TRIGGER trg_mantenimientos_anuales_updated_at BEFORE UPDATE ON servicio.cronograma_mantenimientos_anuales FOR EACH ROW EXECUTE FUNCTION servicio.update_timestamp();


--
-- TOC entry 6552 (class 2620 OID 28653)
-- Name: cronograma_mantenimientos trg_mantenimientos_updated_at; Type: TRIGGER; Schema: servicio; Owner: postgres
--

CREATE TRIGGER trg_mantenimientos_updated_at BEFORE UPDATE ON servicio.cronograma_mantenimientos FOR EACH ROW EXECUTE FUNCTION servicio.update_timestamp();


--
-- TOC entry 6484 (class 2606 OID 26434)
-- Name: advisor_location_history advisor_location_history_client_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.advisor_location_history
    ADD CONSTRAINT advisor_location_history_client_request_id_fkey FOREIGN KEY (client_request_id) REFERENCES public.client_requests(id) ON DELETE SET NULL;


--
-- TOC entry 6485 (class 2606 OID 26439)
-- Name: advisor_location_history advisor_location_history_visit_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.advisor_location_history
    ADD CONSTRAINT advisor_location_history_visit_log_id_fkey FOREIGN KEY (visit_log_id) REFERENCES public.client_visit_logs(id) ON DELETE SET NULL;


--
-- TOC entry 6520 (class 2606 OID 28467)
-- Name: attendance_exceptions attendance_exceptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_exceptions
    ADD CONSTRAINT attendance_exceptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 6523 (class 2606 OID 28587)
-- Name: audit_access_grants audit_access_grants_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_access_grants
    ADD CONSTRAINT audit_access_grants_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 6524 (class 2606 OID 28592)
-- Name: audit_access_grants audit_access_grants_revoked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_access_grants
    ADD CONSTRAINT audit_access_grants_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES public.users(id);


--
-- TOC entry 6521 (class 2606 OID 28562)
-- Name: audit_documents audit_documents_section_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_documents
    ADD CONSTRAINT audit_documents_section_code_fkey FOREIGN KEY (section_code) REFERENCES public.audit_sections(code);


--
-- TOC entry 6522 (class 2606 OID 28567)
-- Name: audit_documents audit_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_documents
    ADD CONSTRAINT audit_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- TOC entry 6479 (class 2606 OID 26230)
-- Name: bc_alerts bc_alerts_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_alerts
    ADD CONSTRAINT bc_alerts_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6480 (class 2606 OID 26235)
-- Name: bc_alerts bc_alerts_contract_determination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_alerts
    ADD CONSTRAINT bc_alerts_contract_determination_id_fkey FOREIGN KEY (contract_determination_id) REFERENCES public.contract_determinations(id) ON DELETE SET NULL;


--
-- TOC entry 6497 (class 2606 OID 27021)
-- Name: bc_audit_log bc_audit_log_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_audit_log
    ADD CONSTRAINT bc_audit_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- TOC entry 6514 (class 2606 OID 27676)
-- Name: bc_deliveries bc_deliveries_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_deliveries
    ADD CONSTRAINT bc_deliveries_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6488 (class 2606 OID 26935)
-- Name: bc_determinations bc_determinations_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_determinations
    ADD CONSTRAINT bc_determinations_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id);


--
-- TOC entry 6489 (class 2606 OID 28260)
-- Name: bc_determinations bc_determinations_bc_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_determinations
    ADD CONSTRAINT bc_determinations_bc_master_id_fkey FOREIGN KEY (bc_master_id) REFERENCES public.bc_master(id) ON DELETE CASCADE;


--
-- TOC entry 6490 (class 2606 OID 26930)
-- Name: bc_determinations bc_determinations_determination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_determinations
    ADD CONSTRAINT bc_determinations_determination_id_fkey FOREIGN KEY (determination_id) REFERENCES public.catalog_determinations(id) ON DELETE CASCADE;


--
-- TOC entry 6515 (class 2606 OID 28255)
-- Name: bc_economic_data bc_economic_data_bc_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_economic_data
    ADD CONSTRAINT bc_economic_data_bc_master_id_fkey FOREIGN KEY (bc_master_id) REFERENCES public.bc_master(id) ON DELETE CASCADE;


--
-- TOC entry 6510 (class 2606 OID 27594)
-- Name: bc_equipment_details bc_equipment_details_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_equipment_details
    ADD CONSTRAINT bc_equipment_details_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6500 (class 2606 OID 27150)
-- Name: bc_equipment_selection bc_equipment_selection_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_equipment_selection
    ADD CONSTRAINT bc_equipment_selection_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES servicio.equipos(id_equipo) ON DELETE CASCADE;


--
-- TOC entry 6507 (class 2606 OID 28266)
-- Name: bc_investments bc_investments_bc_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_investments
    ADD CONSTRAINT bc_investments_bc_master_id_fkey FOREIGN KEY (bc_master_id) REFERENCES public.bc_master(id) ON DELETE CASCADE;


--
-- TOC entry 6508 (class 2606 OID 27518)
-- Name: bc_investments bc_investments_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_investments
    ADD CONSTRAINT bc_investments_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6509 (class 2606 OID 27568)
-- Name: bc_lab_environment bc_lab_environment_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lab_environment
    ADD CONSTRAINT bc_lab_environment_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6517 (class 2606 OID 28327)
-- Name: bc_lis_data bc_lis_data_bc_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lis_data
    ADD CONSTRAINT bc_lis_data_bc_master_id_fkey FOREIGN KEY (bc_master_id) REFERENCES public.bc_master(id) ON DELETE CASCADE;


--
-- TOC entry 6512 (class 2606 OID 27636)
-- Name: bc_lis_equipment_interfaces bc_lis_equipment_interfaces_lis_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lis_equipment_interfaces
    ADD CONSTRAINT bc_lis_equipment_interfaces_lis_integration_id_fkey FOREIGN KEY (bc_lis_data_id) REFERENCES public.bc_lis_integration(id) ON DELETE CASCADE;


--
-- TOC entry 6511 (class 2606 OID 27619)
-- Name: bc_lis_integration bc_lis_integration_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lis_integration
    ADD CONSTRAINT bc_lis_integration_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6516 (class 2606 OID 28302)
-- Name: bc_operational_data bc_operational_data_bc_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_operational_data
    ADD CONSTRAINT bc_operational_data_bc_master_id_fkey FOREIGN KEY (bc_master_id) REFERENCES public.bc_master(id) ON DELETE CASCADE;


--
-- TOC entry 6513 (class 2606 OID 27656)
-- Name: bc_requirements bc_requirements_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_requirements
    ADD CONSTRAINT bc_requirements_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6519 (class 2606 OID 28363)
-- Name: bc_validations bc_validations_bc_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_validations
    ADD CONSTRAINT bc_validations_bc_master_id_fkey FOREIGN KEY (bc_master_id) REFERENCES public.bc_master(id) ON DELETE CASCADE;


--
-- TOC entry 6518 (class 2606 OID 28344)
-- Name: bc_workflow_history bc_workflow_history_bc_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_workflow_history
    ADD CONSTRAINT bc_workflow_history_bc_master_id_fkey FOREIGN KEY (bc_master_id) REFERENCES public.bc_master(id) ON DELETE CASCADE;


--
-- TOC entry 6540 (class 2606 OID 28998)
-- Name: business_case_section_ownership_audit business_case_section_ownership_audit_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_case_section_ownership_audit
    ADD CONSTRAINT business_case_section_ownership_audit_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6539 (class 2606 OID 28977)
-- Name: business_case_section_ownership business_case_section_ownership_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_case_section_ownership
    ADD CONSTRAINT business_case_section_ownership_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6538 (class 2606 OID 28954)
-- Name: business_case_state_transitions business_case_state_transitions_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_case_state_transitions
    ADD CONSTRAINT business_case_state_transitions_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id);


--
-- TOC entry 6499 (class 2606 OID 27067)
-- Name: calculation_templates calculation_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calculation_templates
    ADD CONSTRAINT calculation_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 6472 (class 2606 OID 26113)
-- Name: catalog_consumables catalog_consumables_replaced_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_consumables
    ADD CONSTRAINT catalog_consumables_replaced_by_id_fkey FOREIGN KEY (replaced_by_id) REFERENCES public.catalog_consumables(id) ON DELETE SET NULL;


--
-- TOC entry 6470 (class 2606 OID 26284)
-- Name: catalog_determinations catalog_determinations_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_determinations
    ADD CONSTRAINT catalog_determinations_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES servicio.equipos(id_equipo) ON DELETE SET NULL;


--
-- TOC entry 6471 (class 2606 OID 26085)
-- Name: catalog_determinations catalog_determinations_replaced_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_determinations
    ADD CONSTRAINT catalog_determinations_replaced_by_id_fkey FOREIGN KEY (replaced_by_id) REFERENCES public.catalog_determinations(id) ON DELETE SET NULL;


--
-- TOC entry 6473 (class 2606 OID 26139)
-- Name: catalog_equipment_consumables catalog_equipment_consumables_consumable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_equipment_consumables
    ADD CONSTRAINT catalog_equipment_consumables_consumable_id_fkey FOREIGN KEY (consumable_id) REFERENCES public.catalog_consumables(id) ON DELETE CASCADE;


--
-- TOC entry 6474 (class 2606 OID 26144)
-- Name: catalog_equipment_consumables catalog_equipment_consumables_determination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_equipment_consumables
    ADD CONSTRAINT catalog_equipment_consumables_determination_id_fkey FOREIGN KEY (determination_id) REFERENCES public.catalog_determinations(id) ON DELETE CASCADE;


--
-- TOC entry 6475 (class 2606 OID 26292)
-- Name: catalog_equipment_consumables catalog_equipment_consumables_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_equipment_consumables
    ADD CONSTRAINT catalog_equipment_consumables_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES servicio.equipos(id_equipo) ON DELETE CASCADE;


--
-- TOC entry 6468 (class 2606 OID 25729)
-- Name: client_assignments client_assignments_client_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_assignments
    ADD CONSTRAINT client_assignments_client_request_id_fkey FOREIGN KEY (client_request_id) REFERENCES public.client_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6451 (class 2606 OID 17147)
-- Name: client_request_consent_tokens client_request_consent_tokens_used_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_request_consent_tokens
    ADD CONSTRAINT client_request_consent_tokens_used_request_id_fkey FOREIGN KEY (used_request_id) REFERENCES public.client_requests(id) ON DELETE SET NULL;


--
-- TOC entry 6450 (class 2606 OID 17125)
-- Name: client_request_consents client_request_consents_client_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_request_consents
    ADD CONSTRAINT client_request_consents_client_request_id_fkey FOREIGN KEY (client_request_id) REFERENCES public.client_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6447 (class 2606 OID 17276)
-- Name: client_requests client_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_requests
    ADD CONSTRAINT client_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 6448 (class 2606 OID 17281)
-- Name: client_requests client_requests_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_requests
    ADD CONSTRAINT client_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- TOC entry 6449 (class 2606 OID 17286)
-- Name: client_requests client_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_requests
    ADD CONSTRAINT client_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 6469 (class 2606 OID 25753)
-- Name: client_visit_logs client_visit_logs_client_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_visit_logs
    ADD CONSTRAINT client_visit_logs_client_request_id_fkey FOREIGN KEY (client_request_id) REFERENCES public.client_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6453 (class 2606 OID 17265)
-- Name: clients clients_client_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_client_request_id_fkey FOREIGN KEY (client_request_id) REFERENCES public.client_requests(id) ON DELETE SET NULL;


--
-- TOC entry 6454 (class 2606 OID 17270)
-- Name: clients clients_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 6476 (class 2606 OID 26171)
-- Name: contract_determinations contract_determinations_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_determinations
    ADD CONSTRAINT contract_determinations_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6477 (class 2606 OID 26176)
-- Name: contract_determinations contract_determinations_determination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_determinations
    ADD CONSTRAINT contract_determinations_determination_id_fkey FOREIGN KEY (determination_id) REFERENCES public.catalog_determinations(id) ON DELETE SET NULL;


--
-- TOC entry 6478 (class 2606 OID 26204)
-- Name: determination_consumption_log determination_consumption_log_contract_determination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.determination_consumption_log
    ADD CONSTRAINT determination_consumption_log_contract_determination_id_fkey FOREIGN KEY (contract_determination_id) REFERENCES public.contract_determinations(id) ON DELETE CASCADE;


--
-- TOC entry 6527 (class 2606 OID 28672)
-- Name: document_hashes document_hashes_calculated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_hashes
    ADD CONSTRAINT document_hashes_calculated_by_fkey FOREIGN KEY (calculated_by) REFERENCES public.users(id);


--
-- TOC entry 6534 (class 2606 OID 28764)
-- Name: document_qr_codes document_qr_codes_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_qr_codes
    ADD CONSTRAINT document_qr_codes_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- TOC entry 6535 (class 2606 OID 28769)
-- Name: document_qr_codes document_qr_codes_seal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_qr_codes
    ADD CONSTRAINT document_qr_codes_seal_id_fkey FOREIGN KEY (seal_id) REFERENCES public.document_seals(id);


--
-- TOC entry 6531 (class 2606 OID 28737)
-- Name: document_seals document_seals_authorized_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_seals
    ADD CONSTRAINT document_seals_authorized_user_id_fkey FOREIGN KEY (authorized_user_id) REFERENCES public.users(id);


--
-- TOC entry 6532 (class 2606 OID 28742)
-- Name: document_seals document_seals_document_hash_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_seals
    ADD CONSTRAINT document_seals_document_hash_id_fkey FOREIGN KEY (document_hash_id) REFERENCES public.document_hashes(id);


--
-- TOC entry 6533 (class 2606 OID 28732)
-- Name: document_seals document_seals_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_seals
    ADD CONSTRAINT document_seals_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- TOC entry 6536 (class 2606 OID 28789)
-- Name: document_signature_logs document_signature_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_signature_logs
    ADD CONSTRAINT document_signature_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 6528 (class 2606 OID 28708)
-- Name: document_signatures_advanced document_signatures_advanced_document_hash_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_signatures_advanced
    ADD CONSTRAINT document_signatures_advanced_document_hash_id_fkey FOREIGN KEY (document_hash_id) REFERENCES public.document_hashes(id);


--
-- TOC entry 6529 (class 2606 OID 28698)
-- Name: document_signatures_advanced document_signatures_advanced_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_signatures_advanced
    ADD CONSTRAINT document_signatures_advanced_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- TOC entry 6530 (class 2606 OID 28703)
-- Name: document_signatures_advanced document_signatures_advanced_signer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_signatures_advanced
    ADD CONSTRAINT document_signatures_advanced_signer_user_id_fkey FOREIGN KEY (signer_user_id) REFERENCES public.users(id);


--
-- TOC entry 6422 (class 2606 OID 16686)
-- Name: document_signatures document_signatures_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_signatures
    ADD CONSTRAINT document_signatures_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- TOC entry 6423 (class 2606 OID 16691)
-- Name: document_signatures document_signatures_signer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_signatures
    ADD CONSTRAINT document_signatures_signer_user_id_fkey FOREIGN KEY (signer_user_id) REFERENCES public.users(id);


--
-- TOC entry 6537 (class 2606 OID 28811)
-- Name: document_verifications document_verifications_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_verifications
    ADD CONSTRAINT document_verifications_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- TOC entry 6424 (class 2606 OID 28819)
-- Name: documents documents_current_hash_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_current_hash_id_fkey FOREIGN KEY (current_hash_id) REFERENCES public.document_hashes(id);


--
-- TOC entry 6425 (class 2606 OID 28825)
-- Name: documents documents_locked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_locked_by_fkey FOREIGN KEY (locked_by) REFERENCES public.users(id);


--
-- TOC entry 6426 (class 2606 OID 16696)
-- Name: documents documents_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE CASCADE;


--
-- TOC entry 6427 (class 2606 OID 16701)
-- Name: documents documents_request_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_request_type_id_fkey FOREIGN KEY (request_type_id) REFERENCES public.request_types(id) ON DELETE CASCADE;


--
-- TOC entry 6493 (class 2606 OID 27000)
-- Name: equipment_price_history equipment_price_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipment_price_history
    ADD CONSTRAINT equipment_price_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- TOC entry 6494 (class 2606 OID 26990)
-- Name: equipment_price_history equipment_price_history_consumable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipment_price_history
    ADD CONSTRAINT equipment_price_history_consumable_id_fkey FOREIGN KEY (consumable_id) REFERENCES public.catalog_consumables(id);


--
-- TOC entry 6495 (class 2606 OID 26995)
-- Name: equipment_price_history equipment_price_history_determination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipment_price_history
    ADD CONSTRAINT equipment_price_history_determination_id_fkey FOREIGN KEY (determination_id) REFERENCES public.catalog_determinations(id);


--
-- TOC entry 6496 (class 2606 OID 26985)
-- Name: equipment_price_history equipment_price_history_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipment_price_history
    ADD CONSTRAINT equipment_price_history_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES servicio.equipos(id_equipo);


--
-- TOC entry 6465 (class 2606 OID 17478)
-- Name: equipment_purchase_bc_items equipment_purchase_bc_items_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipment_purchase_bc_items
    ADD CONSTRAINT equipment_purchase_bc_items_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6504 (class 2606 OID 27323)
-- Name: equipos_historial equipos_historial_unidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_historial
    ADD CONSTRAINT equipos_historial_unidad_id_fkey FOREIGN KEY (unidad_id) REFERENCES public.equipos_unidad(id) ON DELETE CASCADE;


--
-- TOC entry 6501 (class 2606 OID 27262)
-- Name: equipos_movimientos equipos_movimientos_equipo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_movimientos
    ADD CONSTRAINT equipos_movimientos_equipo_id_fkey FOREIGN KEY (equipo_id) REFERENCES public.equipos(id) ON DELETE CASCADE;


--
-- TOC entry 6502 (class 2606 OID 27306)
-- Name: equipos_unidad equipos_unidad_modelo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_unidad
    ADD CONSTRAINT equipos_unidad_modelo_id_fkey FOREIGN KEY (modelo_id) REFERENCES public.equipos_modelo(id) ON DELETE CASCADE;


--
-- TOC entry 6503 (class 2606 OID 27352)
-- Name: equipos_unidad equipos_unidad_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_unidad
    ADD CONSTRAINT equipos_unidad_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE SET NULL;


--
-- TOC entry 6498 (class 2606 OID 27102)
-- Name: bc_audit_log fk_bc_audit_log_bc; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_audit_log
    ADD CONSTRAINT fk_bc_audit_log_bc FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6492 (class 2606 OID 27097)
-- Name: bc_calculations fk_bc_calculations_bc; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_calculations
    ADD CONSTRAINT fk_bc_calculations_bc FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6491 (class 2606 OID 27092)
-- Name: bc_determinations fk_bc_determinations_bc; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_determinations
    ADD CONSTRAINT fk_bc_determinations_bc FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6466 (class 2606 OID 27107)
-- Name: equipment_purchase_bc_items fk_bc_items_request; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipment_purchase_bc_items
    ADD CONSTRAINT fk_bc_items_request FOREIGN KEY (request_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6455 (class 2606 OID 17314)
-- Name: user_gmail_tokens fk_user_gmail_tokens_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_gmail_tokens
    ADD CONSTRAINT fk_user_gmail_tokens_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 6439 (class 2606 OID 16974)
-- Name: users fk_users_department; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_department FOREIGN KEY (department_id) REFERENCES public.departments(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 6440 (class 2606 OID 16979)
-- Name: users fk_users_departments; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_departments FOREIGN KEY (department_id) REFERENCES public.departments(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 6428 (class 2606 OID 16706)
-- Name: inventory_movements inventory_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 6429 (class 2606 OID 16711)
-- Name: inventory_movements inventory_movements_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id);


--
-- TOC entry 6525 (class 2606 OID 28616)
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 6463 (class 2606 OID 17444)
-- Name: personnel_request_comments personnel_request_comments_personnel_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_request_comments
    ADD CONSTRAINT personnel_request_comments_personnel_request_id_fkey FOREIGN KEY (personnel_request_id) REFERENCES public.personnel_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6464 (class 2606 OID 17449)
-- Name: personnel_request_comments personnel_request_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_request_comments
    ADD CONSTRAINT personnel_request_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 6461 (class 2606 OID 17424)
-- Name: personnel_request_history personnel_request_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_request_history
    ADD CONSTRAINT personnel_request_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- TOC entry 6462 (class 2606 OID 17419)
-- Name: personnel_request_history personnel_request_history_personnel_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_request_history
    ADD CONSTRAINT personnel_request_history_personnel_request_id_fkey FOREIGN KEY (personnel_request_id) REFERENCES public.personnel_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6456 (class 2606 OID 17401)
-- Name: personnel_requests personnel_requests_approved_by_finance_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_requests
    ADD CONSTRAINT personnel_requests_approved_by_finance_fkey FOREIGN KEY (approved_by_finance) REFERENCES public.users(id);


--
-- TOC entry 6457 (class 2606 OID 17396)
-- Name: personnel_requests personnel_requests_approved_by_hr_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_requests
    ADD CONSTRAINT personnel_requests_approved_by_hr_fkey FOREIGN KEY (approved_by_hr) REFERENCES public.users(id);


--
-- TOC entry 6458 (class 2606 OID 17391)
-- Name: personnel_requests personnel_requests_approved_by_manager_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_requests
    ADD CONSTRAINT personnel_requests_approved_by_manager_fkey FOREIGN KEY (approved_by_manager) REFERENCES public.users(id);


--
-- TOC entry 6459 (class 2606 OID 17386)
-- Name: personnel_requests personnel_requests_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_requests
    ADD CONSTRAINT personnel_requests_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- TOC entry 6460 (class 2606 OID 17381)
-- Name: personnel_requests personnel_requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_requests
    ADD CONSTRAINT personnel_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 6505 (class 2606 OID 27425)
-- Name: private_purchase_requests private_purchase_requests_client_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.private_purchase_requests
    ADD CONSTRAINT private_purchase_requests_client_request_id_fkey FOREIGN KEY (client_request_id) REFERENCES public.client_requests(id) ON DELETE SET NULL;


--
-- TOC entry 6506 (class 2606 OID 27430)
-- Name: private_purchase_requests private_purchase_requests_equipment_purchase_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.private_purchase_requests
    ADD CONSTRAINT private_purchase_requests_equipment_purchase_request_id_fkey FOREIGN KEY (equipment_purchase_request_id) REFERENCES public.equipment_purchase_requests(id);


--
-- TOC entry 6430 (class 2606 OID 16716)
-- Name: request_approvals request_approvals_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_approvals
    ADD CONSTRAINT request_approvals_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id);


--
-- TOC entry 6431 (class 2606 OID 16721)
-- Name: request_approvals request_approvals_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_approvals
    ADD CONSTRAINT request_approvals_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id);


--
-- TOC entry 6432 (class 2606 OID 16726)
-- Name: request_attachments request_attachments_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_attachments
    ADD CONSTRAINT request_attachments_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id);


--
-- TOC entry 6433 (class 2606 OID 16731)
-- Name: request_attachments request_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_attachments
    ADD CONSTRAINT request_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- TOC entry 6434 (class 2606 OID 16736)
-- Name: request_status_history request_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_status_history
    ADD CONSTRAINT request_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- TOC entry 6435 (class 2606 OID 16741)
-- Name: request_status_history request_status_history_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_status_history
    ADD CONSTRAINT request_status_history_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE CASCADE;


--
-- TOC entry 6436 (class 2606 OID 16746)
-- Name: request_versions request_versions_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_versions
    ADD CONSTRAINT request_versions_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id);


--
-- TOC entry 6437 (class 2606 OID 16751)
-- Name: requests requests_request_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_request_type_id_fkey FOREIGN KEY (request_type_id) REFERENCES public.request_types(id) ON DELETE CASCADE;


--
-- TOC entry 6438 (class 2606 OID 16756)
-- Name: requests requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id);


--
-- TOC entry 6482 (class 2606 OID 26413)
-- Name: scheduled_visits scheduled_visits_client_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scheduled_visits
    ADD CONSTRAINT scheduled_visits_client_request_id_fkey FOREIGN KEY (client_request_id) REFERENCES public.client_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6483 (class 2606 OID 26408)
-- Name: scheduled_visits scheduled_visits_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scheduled_visits
    ADD CONSTRAINT scheduled_visits_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.visit_schedules(id) ON DELETE CASCADE;


--
-- TOC entry 6481 (class 2606 OID 26336)
-- Name: technical_documents technical_documents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.technical_documents
    ADD CONSTRAINT technical_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 6486 (class 2606 OID 26460)
-- Name: travel_segments travel_segments_from_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.travel_segments
    ADD CONSTRAINT travel_segments_from_client_id_fkey FOREIGN KEY (from_client_id) REFERENCES public.client_requests(id) ON DELETE SET NULL;


--
-- TOC entry 6487 (class 2606 OID 26465)
-- Name: travel_segments travel_segments_to_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.travel_segments
    ADD CONSTRAINT travel_segments_to_client_id_fkey FOREIGN KEY (to_client_id) REFERENCES public.client_requests(id) ON DELETE SET NULL;


--
-- TOC entry 6452 (class 2606 OID 17185)
-- Name: user_attendance_records user_attendance_records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_attendance_records
    ADD CONSTRAINT user_attendance_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 6526 (class 2606 OID 28642)
-- Name: user_profile user_profile_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_profile
    ADD CONSTRAINT user_profile_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 6444 (class 2606 OID 16761)
-- Name: cronograma_mantenimientos_anuales cronograma_mantenimientos_anuales_id_equipo_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos_anuales
    ADD CONSTRAINT cronograma_mantenimientos_anuales_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES servicio.equipos(id_equipo) ON DELETE CASCADE;


--
-- TOC entry 6441 (class 2606 OID 17059)
-- Name: cronograma_mantenimientos cronograma_mantenimientos_created_by_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos
    ADD CONSTRAINT cronograma_mantenimientos_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 6442 (class 2606 OID 16766)
-- Name: cronograma_mantenimientos cronograma_mantenimientos_id_equipo_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos
    ADD CONSTRAINT cronograma_mantenimientos_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES servicio.equipos(id_equipo) ON DELETE CASCADE;


--
-- TOC entry 6443 (class 2606 OID 17054)
-- Name: cronograma_mantenimientos cronograma_mantenimientos_request_fk; Type: FK CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos
    ADD CONSTRAINT cronograma_mantenimientos_request_fk FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE SET NULL;


--
-- TOC entry 6467 (class 2606 OID 25691)
-- Name: disponibilidad_tecnicos disponibilidad_tecnicos_user_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.disponibilidad_tecnicos
    ADD CONSTRAINT disponibilidad_tecnicos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 6445 (class 2606 OID 26870)
-- Name: equipos equipos_created_by_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.equipos
    ADD CONSTRAINT equipos_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 6446 (class 2606 OID 26875)
-- Name: equipos equipos_updated_by_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.equipos
    ADD CONSTRAINT equipos_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- TOC entry 6915 (class 0 OID 0)
-- Dependencies: 403
-- Name: TABLE document_hashes; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.document_hashes TO PUBLIC;


--
-- TOC entry 6921 (class 0 OID 0)
-- Dependencies: 409
-- Name: TABLE document_qr_codes; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.document_qr_codes TO PUBLIC;


--
-- TOC entry 6927 (class 0 OID 0)
-- Dependencies: 407
-- Name: TABLE document_seals; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.document_seals TO PUBLIC;


--
-- TOC entry 6937 (class 0 OID 0)
-- Dependencies: 405
-- Name: TABLE document_signatures_advanced; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.document_signatures_advanced TO PUBLIC;


--
-- TOC entry 6947 (class 0 OID 0)
-- Dependencies: 415
-- Name: TABLE document_verification_info; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.document_verification_info TO PUBLIC;


--
-- TOC entry 7013 (class 0 OID 0)
-- Dependencies: 414
-- Name: TABLE signature_dashboard; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.signature_dashboard TO PUBLIC;


-- Completed on 2026-01-06 06:17:34

--
-- PostgreSQL database dump complete
--

\unrestrict tUmeVL1P2GYeUQpVvsyYWe2rvUmZ0ra2uqSaBDAE6Ui6CgZB2vnRjG2YLTLwSSN

