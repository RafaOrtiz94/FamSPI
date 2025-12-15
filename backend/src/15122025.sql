--
-- PostgreSQL database dump
--

\restrict SdsbRB1GPKQtZ70JI1GYA0aWD30tg1wzA8L3dm2YDmAd6tZkKxXlOcqHBsi858O

-- Dumped from database version 18.0
-- Dumped by pg_dump version 18.0

-- Started on 2025-12-15 10:10:19

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
-- TOC entry 6417 (class 0 OID 0)
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
-- TOC entry 6418 (class 0 OID 0)
-- Dependencies: 3
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- TOC entry 1081 (class 1247 OID 16387)
-- Name: approval_action_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.approval_action_enum AS ENUM (
    'approve',
    'reject'
);


ALTER TYPE public.approval_action_enum OWNER TO postgres;

--
-- TOC entry 1294 (class 1247 OID 27394)
-- Name: private_purchase_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.private_purchase_status_enum AS ENUM (
    'pending_commercial',
    'pending_backoffice',
    'offer_sent',
    'offer_signed',
    'client_registered',
    'sent_to_acp',
    'rejected'
);


ALTER TYPE public.private_purchase_status_enum OWNER TO postgres;

--
-- TOC entry 1084 (class 1247 OID 16392)
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
-- TOC entry 445 (class 1255 OID 27030)
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
-- TOC entry 423 (class 1255 OID 27333)
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
-- TOC entry 422 (class 1255 OID 27271)
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
-- TOC entry 382 (class 1255 OID 16401)
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
-- TOC entry 459 (class 1255 OID 28384)
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
-- TOC entry 428 (class 1255 OID 17460)
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
-- TOC entry 444 (class 1255 OID 27029)
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
-- TOC entry 6419 (class 0 OID 0)
-- Dependencies: 444
-- Name: FUNCTION get_current_price(p_equipment_id integer, p_consumable_id integer, p_determination_id integer, p_price_type character varying, p_date date); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_current_price(p_equipment_id integer, p_consumable_id integer, p_determination_id integer, p_price_type character varying, p_date date) IS 'Obtiene el precio vigente de un equipo, consumible o determinación en una fecha específica';


--
-- TOC entry 430 (class 1255 OID 17464)
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
-- TOC entry 421 (class 1255 OID 27127)
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
-- TOC entry 6420 (class 0 OID 0)
-- Dependencies: 421
-- Name: FUNCTION mark_business_case_as_modern(p_business_case_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.mark_business_case_as_modern(p_business_case_id uuid) IS 'Marca un Business Case como modernizado (ya no usa Google Sheets)';


--
-- TOC entry 446 (class 1255 OID 27128)
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
-- TOC entry 6421 (class 0 OID 0)
-- Dependencies: 446
-- Name: FUNCTION migrate_legacy_bc_to_modern(p_business_case_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.migrate_legacy_bc_to_modern(p_business_case_id uuid) IS 'Migra un Business Case legacy (Google Sheets) al sistema modernizado';


--
-- TOC entry 426 (class 1255 OID 17028)
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
-- TOC entry 458 (class 1255 OID 28368)
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
-- TOC entry 427 (class 1255 OID 17193)
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
-- TOC entry 383 (class 1255 OID 27074)
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
-- TOC entry 429 (class 1255 OID 17462)
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
-- TOC entry 431 (class 1255 OID 26185)
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
-- TOC entry 432 (class 1255 OID 26346)
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
-- TOC entry 424 (class 1255 OID 16402)
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
-- TOC entry 447 (class 1255 OID 27129)
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
-- TOC entry 425 (class 1255 OID 16403)
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
-- TOC entry 265 (class 1259 OID 16986)
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
-- TOC entry 6422 (class 0 OID 0)
-- Dependencies: 265
-- Name: TABLE logs; Type: COMMENT; Schema: auditoria; Owner: postgres
--

COMMENT ON TABLE auditoria.logs IS 'Registra todas las acciones de usuarios del sistema SPI Fam (creaciones, modificaciones, logins, etc.)';


--
-- TOC entry 6423 (class 0 OID 0)
-- Dependencies: 265
-- Name: COLUMN logs.usuario_email; Type: COMMENT; Schema: auditoria; Owner: postgres
--

COMMENT ON COLUMN auditoria.logs.usuario_email IS 'Correo del usuario que realizó la acción';


--
-- TOC entry 6424 (class 0 OID 0)
-- Dependencies: 265
-- Name: COLUMN logs.modulo; Type: COMMENT; Schema: auditoria; Owner: postgres
--

COMMENT ON COLUMN auditoria.logs.modulo IS 'Módulo afectado (auth, solicitudes, mantenimientos, etc.)';


--
-- TOC entry 6425 (class 0 OID 0)
-- Dependencies: 265
-- Name: COLUMN logs.accion; Type: COMMENT; Schema: auditoria; Owner: postgres
--

COMMENT ON COLUMN auditoria.logs.accion IS 'Tipo de acción (CREATE, UPDATE, DELETE, LOGIN, APPROVE, etc.)';


--
-- TOC entry 6426 (class 0 OID 0)
-- Dependencies: 265
-- Name: COLUMN logs.descripcion; Type: COMMENT; Schema: auditoria; Owner: postgres
--

COMMENT ON COLUMN auditoria.logs.descripcion IS 'Descripción amigable de la acción realizada';


--
-- TOC entry 6427 (class 0 OID 0)
-- Dependencies: 265
-- Name: COLUMN logs.datos_anteriores; Type: COMMENT; Schema: auditoria; Owner: postgres
--

COMMENT ON COLUMN auditoria.logs.datos_anteriores IS 'JSON con los datos antes del cambio';


--
-- TOC entry 6428 (class 0 OID 0)
-- Dependencies: 265
-- Name: COLUMN logs.datos_nuevos; Type: COMMENT; Schema: auditoria; Owner: postgres
--

COMMENT ON COLUMN auditoria.logs.datos_nuevos IS 'JSON con los datos después del cambio';


--
-- TOC entry 6429 (class 0 OID 0)
-- Dependencies: 265
-- Name: COLUMN logs.fecha; Type: COMMENT; Schema: auditoria; Owner: postgres
--

COMMENT ON COLUMN auditoria.logs.fecha IS 'Fecha y hora del evento registrado';


--
-- TOC entry 264 (class 1259 OID 16985)
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
-- TOC entry 6430 (class 0 OID 0)
-- Dependencies: 264
-- Name: logs_id_seq; Type: SEQUENCE OWNED BY; Schema: auditoria; Owner: postgres
--

ALTER SEQUENCE auditoria.logs_id_seq OWNED BY auditoria.logs.id;


--
-- TOC entry 320 (class 1259 OID 26419)
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
-- TOC entry 319 (class 1259 OID 26418)
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
-- TOC entry 6431 (class 0 OID 0)
-- Dependencies: 319
-- Name: advisor_location_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.advisor_location_history_id_seq OWNED BY public.advisor_location_history.id;


--
-- TOC entry 223 (class 1259 OID 16404)
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
-- TOC entry 224 (class 1259 OID 16412)
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
-- TOC entry 6432 (class 0 OID 0)
-- Dependencies: 224
-- Name: audit_trail_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_trail_id_seq OWNED BY public.audit_trail.id;


--
-- TOC entry 306 (class 1259 OID 26213)
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
-- TOC entry 6433 (class 0 OID 0)
-- Dependencies: 306
-- Name: TABLE bc_alerts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_alerts IS 'Alertas automáticas para Business Cases';


--
-- TOC entry 6434 (class 0 OID 0)
-- Dependencies: 306
-- Name: COLUMN bc_alerts.alert_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_alerts.alert_type IS 'Tipo: low_inventory, product_discontinued, unusual_consumption, threshold_exceeded';


--
-- TOC entry 6435 (class 0 OID 0)
-- Dependencies: 306
-- Name: COLUMN bc_alerts.severity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_alerts.severity IS 'Severidad: yellow (30%), red (10%), critical (<5%)';


--
-- TOC entry 305 (class 1259 OID 26212)
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
-- TOC entry 6436 (class 0 OID 0)
-- Dependencies: 305
-- Name: bc_alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_alerts_id_seq OWNED BY public.bc_alerts.id;


--
-- TOC entry 332 (class 1259 OID 27009)
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
-- TOC entry 6437 (class 0 OID 0)
-- Dependencies: 332
-- Name: TABLE bc_audit_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_audit_log IS 'Registro completo de auditoría de todos los cambios en Business Cases';


--
-- TOC entry 6438 (class 0 OID 0)
-- Dependencies: 332
-- Name: COLUMN bc_audit_log.action; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_audit_log.action IS 'Acción realizada: equipment_selected, determination_added, calculation_run, etc.';


--
-- TOC entry 331 (class 1259 OID 27008)
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
-- TOC entry 6439 (class 0 OID 0)
-- Dependencies: 331
-- Name: bc_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_audit_log_id_seq OWNED BY public.bc_audit_log.id;


--
-- TOC entry 328 (class 1259 OID 26943)
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
-- TOC entry 6440 (class 0 OID 0)
-- Dependencies: 328
-- Name: TABLE bc_calculations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_calculations IS 'Resultados de cálculos para Business Cases (consumo, costos, ROI, etc.)';


--
-- TOC entry 6441 (class 0 OID 0)
-- Dependencies: 328
-- Name: COLUMN bc_calculations.total_monthly_tests; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.total_monthly_tests IS 'Total de pruebas mensuales (BCs públicos)';


--
-- TOC entry 6442 (class 0 OID 0)
-- Dependencies: 328
-- Name: COLUMN bc_calculations.equipment_utilization_percentage; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.equipment_utilization_percentage IS '% de utilización del equipo basado en capacidad máxima';


--
-- TOC entry 6443 (class 0 OID 0)
-- Dependencies: 328
-- Name: COLUMN bc_calculations.warnings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.warnings IS 'Array JSON de advertencias (capacidad excedida, ROI bajo, etc.)';


--
-- TOC entry 6444 (class 0 OID 0)
-- Dependencies: 328
-- Name: COLUMN bc_calculations.recommendations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.recommendations IS 'Array JSON de recomendaciones automáticas';


--
-- TOC entry 6445 (class 0 OID 0)
-- Dependencies: 328
-- Name: COLUMN bc_calculations.calculation_version; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.calculation_version IS 'Versión del cálculo (incrementa con cada recálculo)';


--
-- TOC entry 6446 (class 0 OID 0)
-- Dependencies: 328
-- Name: COLUMN bc_calculations.total_annual_tests; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.total_annual_tests IS 'Total de pruebas anuales (Comodatos)';


--
-- TOC entry 6447 (class 0 OID 0)
-- Dependencies: 328
-- Name: COLUMN bc_calculations.total_annual_cost; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.total_annual_cost IS 'Costo anual total estimado';


--
-- TOC entry 6448 (class 0 OID 0)
-- Dependencies: 328
-- Name: COLUMN bc_calculations.equipment_investment; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.equipment_investment IS 'Inversión directa en equipos';


--
-- TOC entry 6449 (class 0 OID 0)
-- Dependencies: 328
-- Name: COLUMN bc_calculations.total_investment; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.total_investment IS 'Inversión total (equipo + inversiones externas)';


--
-- TOC entry 6450 (class 0 OID 0)
-- Dependencies: 328
-- Name: COLUMN bc_calculations.monthly_revenue; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.monthly_revenue IS 'Ingreso mensual necesario para cubrir costos y margen';


--
-- TOC entry 6451 (class 0 OID 0)
-- Dependencies: 328
-- Name: COLUMN bc_calculations.monthly_margin; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.monthly_margin IS 'Margen mensual neto';


--
-- TOC entry 6452 (class 0 OID 0)
-- Dependencies: 328
-- Name: COLUMN bc_calculations.roi_percentage; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.roi_percentage IS 'ROI proyectado en porcentaje';


--
-- TOC entry 6453 (class 0 OID 0)
-- Dependencies: 328
-- Name: COLUMN bc_calculations.payback_months; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.payback_months IS 'Meses esperados para recuperar la inversión';


--
-- TOC entry 6454 (class 0 OID 0)
-- Dependencies: 328
-- Name: COLUMN bc_calculations.annual_operating_cost; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.annual_operating_cost IS 'Costo operativo anual (incluye inversiones recorrentes)';


--
-- TOC entry 6455 (class 0 OID 0)
-- Dependencies: 328
-- Name: COLUMN bc_calculations.monthly_operating_cost; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_calculations.monthly_operating_cost IS 'Costo operativo mensual';


--
-- TOC entry 327 (class 1259 OID 26942)
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
-- TOC entry 6456 (class 0 OID 0)
-- Dependencies: 327
-- Name: bc_calculations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_calculations_id_seq OWNED BY public.bc_calculations.id;


--
-- TOC entry 368 (class 1259 OID 27662)
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
-- TOC entry 6457 (class 0 OID 0)
-- Dependencies: 368
-- Name: TABLE bc_deliveries; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_deliveries IS 'Tipo de entregas del BC';


--
-- TOC entry 6458 (class 0 OID 0)
-- Dependencies: 368
-- Name: COLUMN bc_deliveries.delivery_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_deliveries.delivery_type IS 'Tipo: total, partial_time (parcial a tiempo), partial_need (parcial a necesidad)';


--
-- TOC entry 367 (class 1259 OID 27661)
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
-- TOC entry 6459 (class 0 OID 0)
-- Dependencies: 367
-- Name: bc_deliveries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_deliveries_id_seq OWNED BY public.bc_deliveries.id;


--
-- TOC entry 326 (class 1259 OID 26912)
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
-- TOC entry 6460 (class 0 OID 0)
-- Dependencies: 326
-- Name: TABLE bc_determinations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_determinations IS 'Determinaciones agregadas a cada Business Case con cantidades mensuales o anuales';


--
-- TOC entry 6461 (class 0 OID 0)
-- Dependencies: 326
-- Name: COLUMN bc_determinations.monthly_quantity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_determinations.monthly_quantity IS 'Cantidad mensual estimada para Business Cases públicos';


--
-- TOC entry 6462 (class 0 OID 0)
-- Dependencies: 326
-- Name: COLUMN bc_determinations.calculated_consumption; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_determinations.calculated_consumption IS 'Consumo calculado de reactivos';


--
-- TOC entry 6463 (class 0 OID 0)
-- Dependencies: 326
-- Name: COLUMN bc_determinations.calculated_cost; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_determinations.calculated_cost IS 'Costo calculado';


--
-- TOC entry 6464 (class 0 OID 0)
-- Dependencies: 326
-- Name: COLUMN bc_determinations.calculation_details; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_determinations.calculation_details IS 'Detalles del cálculo en JSON';


--
-- TOC entry 6465 (class 0 OID 0)
-- Dependencies: 326
-- Name: COLUMN bc_determinations.annual_quantity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_determinations.annual_quantity IS 'Cantidad anual estimada para Business Cases privados/comodatos';


--
-- TOC entry 325 (class 1259 OID 26911)
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
-- TOC entry 6466 (class 0 OID 0)
-- Dependencies: 325
-- Name: bc_determinations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_determinations_id_seq OWNED BY public.bc_determinations.id;


--
-- TOC entry 371 (class 1259 OID 28239)
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
-- TOC entry 6467 (class 0 OID 0)
-- Dependencies: 371
-- Name: TABLE bc_economic_data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_economic_data IS 'Dominio Economics - Datos económicos del BC';


--
-- TOC entry 370 (class 1259 OID 28238)
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
-- TOC entry 6468 (class 0 OID 0)
-- Dependencies: 370
-- Name: bc_economic_data_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_economic_data_id_seq OWNED BY public.bc_economic_data.id;


--
-- TOC entry 360 (class 1259 OID 27574)
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
-- TOC entry 6469 (class 0 OID 0)
-- Dependencies: 360
-- Name: TABLE bc_equipment_details; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_equipment_details IS 'Detalles del equipamiento (principal, backup, complementario)';


--
-- TOC entry 6470 (class 0 OID 0)
-- Dependencies: 360
-- Name: COLUMN bc_equipment_details.equipment_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_equipment_details.equipment_status IS 'Estado: new (nuevo) o cu (usado)';


--
-- TOC entry 6471 (class 0 OID 0)
-- Dependencies: 360
-- Name: COLUMN bc_equipment_details.ownership_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_equipment_details.ownership_status IS 'Propiedad: owned, rented, new, reserved, fam_series';


--
-- TOC entry 359 (class 1259 OID 27573)
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
-- TOC entry 6472 (class 0 OID 0)
-- Dependencies: 359
-- Name: bc_equipment_details_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_equipment_details_id_seq OWNED BY public.bc_equipment_details.id;


--
-- TOC entry 338 (class 1259 OID 27139)
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
-- TOC entry 6473 (class 0 OID 0)
-- Dependencies: 338
-- Name: TABLE bc_equipment_selection; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_equipment_selection IS 'Equipos seleccionados para cada Business Case';


--
-- TOC entry 6474 (class 0 OID 0)
-- Dependencies: 338
-- Name: COLUMN bc_equipment_selection.is_primary; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_equipment_selection.is_primary IS 'Equipo principal del BC (solo uno por BC)';


--
-- TOC entry 6475 (class 0 OID 0)
-- Dependencies: 338
-- Name: COLUMN bc_equipment_selection.quantity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_equipment_selection.quantity IS 'Cantidad de unidades seleccionadas del equipo principal';


--
-- TOC entry 6476 (class 0 OID 0)
-- Dependencies: 338
-- Name: COLUMN bc_equipment_selection.notes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_equipment_selection.notes IS 'Notas adicionales sobre la selección del equipo';


--
-- TOC entry 337 (class 1259 OID 27138)
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
-- TOC entry 6477 (class 0 OID 0)
-- Dependencies: 337
-- Name: bc_equipment_selection_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_equipment_selection_id_seq OWNED BY public.bc_equipment_selection.id;


--
-- TOC entry 352 (class 1259 OID 27501)
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
-- TOC entry 6478 (class 0 OID 0)
-- Dependencies: 352
-- Name: TABLE bc_investments; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_investments IS 'Inversiones adicionales asociadas a un Business Case moderno';


--
-- TOC entry 6479 (class 0 OID 0)
-- Dependencies: 352
-- Name: COLUMN bc_investments.amount; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_investments.amount IS 'Monto de la inversión';


--
-- TOC entry 6480 (class 0 OID 0)
-- Dependencies: 352
-- Name: COLUMN bc_investments.investment_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_investments.investment_type IS 'Tipo de inversión: one_time, recurring_monthly o recurring_annual';


--
-- TOC entry 6481 (class 0 OID 0)
-- Dependencies: 352
-- Name: COLUMN bc_investments.category; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_investments.category IS 'Categoría sugerida: installation, training, transport, maintenance, other';


--
-- TOC entry 351 (class 1259 OID 27500)
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
-- TOC entry 6482 (class 0 OID 0)
-- Dependencies: 351
-- Name: bc_investments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_investments_id_seq OWNED BY public.bc_investments.id;


--
-- TOC entry 358 (class 1259 OID 27549)
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
-- TOC entry 6483 (class 0 OID 0)
-- Dependencies: 358
-- Name: TABLE bc_lab_environment; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_lab_environment IS 'Ambiente de laboratorio del cliente';


--
-- TOC entry 357 (class 1259 OID 27548)
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
-- TOC entry 6484 (class 0 OID 0)
-- Dependencies: 357
-- Name: bc_lab_environment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_lab_environment_id_seq OWNED BY public.bc_lab_environment.id;


--
-- TOC entry 375 (class 1259 OID 28308)
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
-- TOC entry 6485 (class 0 OID 0)
-- Dependencies: 375
-- Name: TABLE bc_lis_data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_lis_data IS 'Dominio LIS - Integración con sistemas de información de laboratorio';


--
-- TOC entry 374 (class 1259 OID 28307)
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
-- TOC entry 6486 (class 0 OID 0)
-- Dependencies: 374
-- Name: bc_lis_data_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_lis_data_id_seq OWNED BY public.bc_lis_data.id;


--
-- TOC entry 364 (class 1259 OID 27625)
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
-- TOC entry 6487 (class 0 OID 0)
-- Dependencies: 364
-- Name: TABLE bc_lis_equipment_interfaces; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_lis_equipment_interfaces IS 'Interfaces de equipos para integración LIS';


--
-- TOC entry 363 (class 1259 OID 27624)
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
-- TOC entry 6488 (class 0 OID 0)
-- Dependencies: 363
-- Name: bc_lis_equipment_interfaces_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_lis_equipment_interfaces_id_seq OWNED BY public.bc_lis_equipment_interfaces.id;


--
-- TOC entry 362 (class 1259 OID 27600)
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
-- TOC entry 6489 (class 0 OID 0)
-- Dependencies: 362
-- Name: TABLE bc_lis_integration; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_lis_integration IS 'Integración con sistema LIS';


--
-- TOC entry 6490 (class 0 OID 0)
-- Dependencies: 362
-- Name: COLUMN bc_lis_integration.lis_provider; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_lis_integration.lis_provider IS 'Proveedor LIS: orion, cobas_infiniti, other';


--
-- TOC entry 361 (class 1259 OID 27599)
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
-- TOC entry 6491 (class 0 OID 0)
-- Dependencies: 361
-- Name: bc_lis_integration_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_lis_integration_id_seq OWNED BY public.bc_lis_integration.id;


--
-- TOC entry 369 (class 1259 OID 28214)
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
-- TOC entry 6492 (class 0 OID 0)
-- Dependencies: 369
-- Name: TABLE bc_master; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_master IS 'Tabla central del Business Case unificado - Orquesta todos los módulos';


--
-- TOC entry 6493 (class 0 OID 0)
-- Dependencies: 369
-- Name: COLUMN bc_master.bc_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_master.bc_number IS 'Número único del BC (ej: BC-2024-001)';


--
-- TOC entry 6494 (class 0 OID 0)
-- Dependencies: 369
-- Name: COLUMN bc_master.current_stage; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_master.current_stage IS 'Estado actual en el workflow del BC';


--
-- TOC entry 6495 (class 0 OID 0)
-- Dependencies: 369
-- Name: COLUMN bc_master.risk_level; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bc_master.risk_level IS 'Nivel de riesgo calculado: low, medium, high';


--
-- TOC entry 380 (class 1259 OID 28383)
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
-- TOC entry 373 (class 1259 OID 28273)
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
-- TOC entry 6496 (class 0 OID 0)
-- Dependencies: 373
-- Name: TABLE bc_operational_data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_operational_data IS 'Dominio Operations - Datos operativos del cliente (ambiente + equipamiento + requerimientos + entregas)';


--
-- TOC entry 372 (class 1259 OID 28272)
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
-- TOC entry 6497 (class 0 OID 0)
-- Dependencies: 372
-- Name: bc_operational_data_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_operational_data_id_seq OWNED BY public.bc_operational_data.id;


--
-- TOC entry 366 (class 1259 OID 27642)
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
-- TOC entry 6498 (class 0 OID 0)
-- Dependencies: 366
-- Name: TABLE bc_requirements; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_requirements IS 'Requerimientos y plazos del BC';


--
-- TOC entry 365 (class 1259 OID 27641)
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
-- TOC entry 6499 (class 0 OID 0)
-- Dependencies: 365
-- Name: bc_requirements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_requirements_id_seq OWNED BY public.bc_requirements.id;


--
-- TOC entry 379 (class 1259 OID 28350)
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
-- TOC entry 6500 (class 0 OID 0)
-- Dependencies: 379
-- Name: TABLE bc_validations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_validations IS 'Validaciones y alertas del BC';


--
-- TOC entry 378 (class 1259 OID 28349)
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
-- TOC entry 6501 (class 0 OID 0)
-- Dependencies: 378
-- Name: bc_validations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_validations_id_seq OWNED BY public.bc_validations.id;


--
-- TOC entry 377 (class 1259 OID 28333)
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
-- TOC entry 6502 (class 0 OID 0)
-- Dependencies: 377
-- Name: TABLE bc_workflow_history; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bc_workflow_history IS 'Historial de cambios de estado del BC';


--
-- TOC entry 376 (class 1259 OID 28332)
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
-- TOC entry 6503 (class 0 OID 0)
-- Dependencies: 376
-- Name: bc_workflow_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bc_workflow_history_id_seq OWNED BY public.bc_workflow_history.id;


--
-- TOC entry 335 (class 1259 OID 27049)
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
-- TOC entry 6504 (class 0 OID 0)
-- Dependencies: 335
-- Name: TABLE calculation_templates; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.calculation_templates IS 'Plantillas reutilizables de fórmulas de cálculo';


--
-- TOC entry 6505 (class 0 OID 0)
-- Dependencies: 335
-- Name: COLUMN calculation_templates.formula; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.calculation_templates.formula IS 'Fórmula en formato JSON {type, expression, variables}';


--
-- TOC entry 6506 (class 0 OID 0)
-- Dependencies: 335
-- Name: COLUMN calculation_templates.required_variables; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.calculation_templates.required_variables IS 'Array JSON con nombres de variables obligatorias';


--
-- TOC entry 334 (class 1259 OID 27048)
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
-- TOC entry 6507 (class 0 OID 0)
-- Dependencies: 334
-- Name: calculation_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.calculation_templates_id_seq OWNED BY public.calculation_templates.id;


--
-- TOC entry 298 (class 1259 OID 26094)
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
-- TOC entry 6508 (class 0 OID 0)
-- Dependencies: 298
-- Name: TABLE catalog_consumables; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.catalog_consumables IS 'Catálogo de consumibles (reactivos, calibradores, controles)';


--
-- TOC entry 6509 (class 0 OID 0)
-- Dependencies: 298
-- Name: COLUMN catalog_consumables.units_per_kit; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_consumables.units_per_kit IS 'Unidades/determinaciones por kit';


--
-- TOC entry 6510 (class 0 OID 0)
-- Dependencies: 298
-- Name: COLUMN catalog_consumables.performance; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_consumables.performance IS 'Rendimiento por determinación en formato JSON';


--
-- TOC entry 6511 (class 0 OID 0)
-- Dependencies: 298
-- Name: COLUMN catalog_consumables.yield_per_unit; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_consumables.yield_per_unit IS 'Número de determinaciones que rinde una unidad de consumible';


--
-- TOC entry 6512 (class 0 OID 0)
-- Dependencies: 298
-- Name: COLUMN catalog_consumables.reorder_point; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_consumables.reorder_point IS 'Punto de reorden para inventario';


--
-- TOC entry 297 (class 1259 OID 26093)
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
-- TOC entry 6513 (class 0 OID 0)
-- Dependencies: 297
-- Name: catalog_consumables_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.catalog_consumables_id_seq OWNED BY public.catalog_consumables.id;


--
-- TOC entry 296 (class 1259 OID 26061)
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
-- TOC entry 6514 (class 0 OID 0)
-- Dependencies: 296
-- Name: TABLE catalog_determinations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.catalog_determinations IS 'Catálogo de determinaciones médicas con versionamiento';


--
-- TOC entry 6515 (class 0 OID 0)
-- Dependencies: 296
-- Name: COLUMN catalog_determinations.valid_from; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_determinations.valid_from IS 'Fecha desde la cual esta versión es válida';


--
-- TOC entry 6516 (class 0 OID 0)
-- Dependencies: 296
-- Name: COLUMN catalog_determinations.valid_to; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_determinations.valid_to IS 'Fecha hasta la cual esta versión es válida (NULL si aún vigente)';


--
-- TOC entry 6517 (class 0 OID 0)
-- Dependencies: 296
-- Name: COLUMN catalog_determinations.volume_per_test; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_determinations.volume_per_test IS 'Volumen de muestra requerido por prueba en mL';


--
-- TOC entry 6518 (class 0 OID 0)
-- Dependencies: 296
-- Name: COLUMN catalog_determinations.reagent_consumption; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_determinations.reagent_consumption IS 'Consumo de reactivo por prueba en mL - reemplaza fórmulas Excel';


--
-- TOC entry 6519 (class 0 OID 0)
-- Dependencies: 296
-- Name: COLUMN catalog_determinations.processing_time; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_determinations.processing_time IS 'Tiempo de procesamiento en segundos';


--
-- TOC entry 6520 (class 0 OID 0)
-- Dependencies: 296
-- Name: COLUMN catalog_determinations.cost_per_test; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_determinations.cost_per_test IS 'Costo directo por prueba calculado';


--
-- TOC entry 6521 (class 0 OID 0)
-- Dependencies: 296
-- Name: COLUMN catalog_determinations.calculation_formula; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_determinations.calculation_formula IS 'Fórmula personalizada de cálculo en formato JSON';


--
-- TOC entry 6522 (class 0 OID 0)
-- Dependencies: 296
-- Name: COLUMN catalog_determinations.formula_version; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_determinations.formula_version IS 'Versión de la fórmula para control de cambios';


--
-- TOC entry 6523 (class 0 OID 0)
-- Dependencies: 296
-- Name: COLUMN catalog_determinations.formula_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_determinations.formula_type IS 'default=fórmula estándar, custom=personalizada, template=basada en plantilla';


--
-- TOC entry 295 (class 1259 OID 26060)
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
-- TOC entry 6524 (class 0 OID 0)
-- Dependencies: 295
-- Name: catalog_determinations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.catalog_determinations_id_seq OWNED BY public.catalog_determinations.id;


--
-- TOC entry 300 (class 1259 OID 26122)
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
-- TOC entry 6525 (class 0 OID 0)
-- Dependencies: 300
-- Name: TABLE catalog_equipment_consumables; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.catalog_equipment_consumables IS 'Relación entre equipos, determinaciones y sus consumibles';


--
-- TOC entry 6526 (class 0 OID 0)
-- Dependencies: 300
-- Name: COLUMN catalog_equipment_consumables.consumption_rate; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_equipment_consumables.consumption_rate IS 'Tasa de consumo del consumible por determinación';


--
-- TOC entry 299 (class 1259 OID 26121)
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
-- TOC entry 6527 (class 0 OID 0)
-- Dependencies: 299
-- Name: catalog_equipment_consumables_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.catalog_equipment_consumables_id_seq OWNED BY public.catalog_equipment_consumables.id;


--
-- TOC entry 308 (class 1259 OID 26246)
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
-- TOC entry 6528 (class 0 OID 0)
-- Dependencies: 308
-- Name: TABLE catalog_investments; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.catalog_investments IS 'Catálogo de inversiones adicionales para sugerir automáticamente';


--
-- TOC entry 6529 (class 0 OID 0)
-- Dependencies: 308
-- Name: COLUMN catalog_investments.requires_lis; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_investments.requires_lis IS 'TRUE si esta inversión es recomendada cuando se incluye LIS';


--
-- TOC entry 6530 (class 0 OID 0)
-- Dependencies: 308
-- Name: COLUMN catalog_investments.requires_equipment; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.catalog_investments.requires_equipment IS 'TRUE si esta inversión es recomendada con equipo principal';


--
-- TOC entry 307 (class 1259 OID 26245)
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
-- TOC entry 6531 (class 0 OID 0)
-- Dependencies: 307
-- Name: catalog_investments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.catalog_investments_id_seq OWNED BY public.catalog_investments.id;


--
-- TOC entry 292 (class 1259 OID 25715)
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
-- TOC entry 291 (class 1259 OID 25714)
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
-- TOC entry 6532 (class 0 OID 0)
-- Dependencies: 291
-- Name: client_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.client_assignments_id_seq OWNED BY public.client_assignments.id;


--
-- TOC entry 270 (class 1259 OID 17130)
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
-- TOC entry 269 (class 1259 OID 17112)
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
-- TOC entry 268 (class 1259 OID 17111)
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
-- TOC entry 6533 (class 0 OID 0)
-- Dependencies: 268
-- Name: client_request_consents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.client_request_consents_id_seq OWNED BY public.client_request_consents.id;


--
-- TOC entry 267 (class 1259 OID 17084)
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
-- TOC entry 6534 (class 0 OID 0)
-- Dependencies: 267
-- Name: COLUMN client_requests.rejection_reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_requests.rejection_reason IS 'Motivo del rechazo si la solicitud fue rechazada';


--
-- TOC entry 6535 (class 0 OID 0)
-- Dependencies: 267
-- Name: COLUMN client_requests.data_processing_consent; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_requests.data_processing_consent IS 'Aceptación interna del tratamiento de datos';


--
-- TOC entry 6536 (class 0 OID 0)
-- Dependencies: 267
-- Name: COLUMN client_requests.establishment_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_requests.establishment_name IS 'Nombre del establecimiento registrado en la solicitud';


--
-- TOC entry 6537 (class 0 OID 0)
-- Dependencies: 267
-- Name: COLUMN client_requests.consent_capture_method; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_requests.consent_capture_method IS 'Método planificado para recolectar el consentimiento';


--
-- TOC entry 6538 (class 0 OID 0)
-- Dependencies: 267
-- Name: COLUMN client_requests.lopdp_consent_method; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_requests.lopdp_consent_method IS 'Método real utilizado para registrar la aceptación';


--
-- TOC entry 6539 (class 0 OID 0)
-- Dependencies: 267
-- Name: COLUMN client_requests.consent_recipient_email; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_requests.consent_recipient_email IS 'Correo al que se envió el código OTP LOPDP';


--
-- TOC entry 6540 (class 0 OID 0)
-- Dependencies: 267
-- Name: COLUMN client_requests.consent_email_token_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_requests.consent_email_token_id IS 'Token OTP verificado previamente para LOPDP';


--
-- TOC entry 6541 (class 0 OID 0)
-- Dependencies: 267
-- Name: COLUMN client_requests.approval_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_requests.approval_status IS 'Estado de aprobación: pendiente, aprobado, rechazado';


--
-- TOC entry 6542 (class 0 OID 0)
-- Dependencies: 267
-- Name: COLUMN client_requests.client_sector; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_requests.client_sector IS 'Sector del cliente: publico o privado';


--
-- TOC entry 6543 (class 0 OID 0)
-- Dependencies: 267
-- Name: COLUMN client_requests.approval_letter_file_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_requests.approval_letter_file_id IS 'ID del documento de oficio de aprobación generado en Drive';


--
-- TOC entry 6544 (class 0 OID 0)
-- Dependencies: 267
-- Name: COLUMN client_requests.consent_record_file_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_requests.consent_record_file_id IS 'Archivo generado con la declaración de consentimiento';


--
-- TOC entry 266 (class 1259 OID 17083)
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
-- TOC entry 6545 (class 0 OID 0)
-- Dependencies: 266
-- Name: client_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.client_requests_id_seq OWNED BY public.client_requests.id;


--
-- TOC entry 294 (class 1259 OID 25735)
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
-- TOC entry 293 (class 1259 OID 25734)
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
-- TOC entry 6546 (class 0 OID 0)
-- Dependencies: 293
-- Name: client_visit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.client_visit_logs_id_seq OWNED BY public.client_visit_logs.id;


--
-- TOC entry 276 (class 1259 OID 17244)
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
-- TOC entry 6547 (class 0 OID 0)
-- Dependencies: 276
-- Name: TABLE clients; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.clients IS 'Clientes aprobados con datos encriptados para máxima seguridad';


--
-- TOC entry 6548 (class 0 OID 0)
-- Dependencies: 276
-- Name: COLUMN clients.ruc_hash; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.clients.ruc_hash IS 'Hash SHA-256 del RUC para búsquedas sin exponer el dato real';


--
-- TOC entry 6549 (class 0 OID 0)
-- Dependencies: 276
-- Name: COLUMN clients.client_sector; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.clients.client_sector IS 'Sector del cliente: publico o privado';


--
-- TOC entry 275 (class 1259 OID 17243)
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
-- TOC entry 6550 (class 0 OID 0)
-- Dependencies: 275
-- Name: clients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;


--
-- TOC entry 302 (class 1259 OID 26152)
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
-- TOC entry 6551 (class 0 OID 0)
-- Dependencies: 302
-- Name: TABLE contract_determinations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.contract_determinations IS 'Inventario de determinaciones negociadas por Business Case';


--
-- TOC entry 6552 (class 0 OID 0)
-- Dependencies: 302
-- Name: COLUMN contract_determinations.alert_threshold_yellow; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contract_determinations.alert_threshold_yellow IS 'Porcentaje restante para alerta amarilla';


--
-- TOC entry 6553 (class 0 OID 0)
-- Dependencies: 302
-- Name: COLUMN contract_determinations.alert_threshold_red; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contract_determinations.alert_threshold_red IS 'Porcentaje restante para alerta roja';


--
-- TOC entry 301 (class 1259 OID 26151)
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
-- TOC entry 6554 (class 0 OID 0)
-- Dependencies: 301
-- Name: contract_determinations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.contract_determinations_id_seq OWNED BY public.contract_determinations.id;


--
-- TOC entry 263 (class 1259 OID 16959)
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
-- TOC entry 262 (class 1259 OID 16958)
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
-- TOC entry 6555 (class 0 OID 0)
-- Dependencies: 262
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;


--
-- TOC entry 304 (class 1259 OID 26188)
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
-- TOC entry 6556 (class 0 OID 0)
-- Dependencies: 304
-- Name: TABLE determination_consumption_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.determination_consumption_log IS 'Registro histórico de consumos de determinaciones';


--
-- TOC entry 6557 (class 0 OID 0)
-- Dependencies: 304
-- Name: COLUMN determination_consumption_log.source; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.determination_consumption_log.source IS 'Origen del registro: manual, lis_integration, auto';


--
-- TOC entry 303 (class 1259 OID 26187)
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
-- TOC entry 6558 (class 0 OID 0)
-- Dependencies: 303
-- Name: determination_consumption_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.determination_consumption_log_id_seq OWNED BY public.determination_consumption_log.id;


--
-- TOC entry 225 (class 1259 OID 16413)
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
-- TOC entry 6559 (class 0 OID 0)
-- Dependencies: 225
-- Name: TABLE document_signatures; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.document_signatures IS 'Firmas digitales PNG por documento/usuario/rol.';


--
-- TOC entry 226 (class 1259 OID 16422)
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
-- TOC entry 6560 (class 0 OID 0)
-- Dependencies: 226
-- Name: document_signatures_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.document_signatures_id_seq OWNED BY public.document_signatures.id;


--
-- TOC entry 227 (class 1259 OID 16423)
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
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.documents OWNER TO postgres;

--
-- TOC entry 6561 (class 0 OID 0)
-- Dependencies: 227
-- Name: TABLE documents; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.documents IS 'Documentos generados desde plantillas: DOCX/PDF/firma y carpeta Drive por request.';


--
-- TOC entry 228 (class 1259 OID 16435)
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
-- TOC entry 6562 (class 0 OID 0)
-- Dependencies: 228
-- Name: documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.documents_id_seq OWNED BY public.documents.id;


--
-- TOC entry 229 (class 1259 OID 16436)
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
-- TOC entry 230 (class 1259 OID 16444)
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
-- TOC entry 6563 (class 0 OID 0)
-- Dependencies: 230
-- Name: employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;


--
-- TOC entry 330 (class 1259 OID 26970)
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
-- TOC entry 6564 (class 0 OID 0)
-- Dependencies: 330
-- Name: TABLE equipment_price_history; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.equipment_price_history IS 'Historial completo de cambios de precios para trazabilidad';


--
-- TOC entry 6565 (class 0 OID 0)
-- Dependencies: 330
-- Name: COLUMN equipment_price_history.price_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_price_history.price_type IS 'Tipo de precio: base_price, unit_price, cost_per_test, maintenance';


--
-- TOC entry 329 (class 1259 OID 26969)
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
-- TOC entry 6566 (class 0 OID 0)
-- Dependencies: 329
-- Name: equipment_price_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.equipment_price_history_id_seq OWNED BY public.equipment_price_history.id;


--
-- TOC entry 286 (class 1259 OID 17468)
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
-- TOC entry 279 (class 1259 OID 17321)
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
-- TOC entry 6567 (class 0 OID 0)
-- Dependencies: 279
-- Name: TABLE equipment_purchase_requests; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.equipment_purchase_requests IS 'Business Cases de comodatos (públicos y privados) con cálculos automáticos de ROI';


--
-- TOC entry 6568 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN equipment_purchase_requests.equipment_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.equipment_type IS 'Tipo de equipo solicitado: new (nuevo) o cu (usado/reacondicionado)';


--
-- TOC entry 6569 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN equipment_purchase_requests.reservation_expires_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.reservation_expires_at IS 'Fecha de expiración de la reserva (60 días después de la última reserva/renovación)';


--
-- TOC entry 6570 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN equipment_purchase_requests.reservation_renewed_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.reservation_renewed_at IS 'Última fecha de renovación de la reserva';


--
-- TOC entry 6571 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN equipment_purchase_requests.reservation_renewal_count; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.reservation_renewal_count IS 'Número de veces que se ha renovado la reserva';


--
-- TOC entry 6572 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN equipment_purchase_requests.cancelled_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.cancelled_at IS 'Fecha de cancelación de la orden';


--
-- TOC entry 6573 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN equipment_purchase_requests.cancellation_reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.cancellation_reason IS 'Razón de la cancelación (manual, auto-expiración, etc)';


--
-- TOC entry 6574 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN equipment_purchase_requests.uses_modern_system; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.uses_modern_system IS 'true = usa sistema modernizado (BD), false = usa Google Sheets (legacy)';


--
-- TOC entry 6575 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN equipment_purchase_requests.bc_system_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.bc_system_type IS 'Tipo de sistema: legacy (Google Sheets) o modern (nuevo sistema con motor de cálculos)';


--
-- TOC entry 6576 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN equipment_purchase_requests.modern_bc_metadata; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.modern_bc_metadata IS 'Metadata adicional para BCs modernos (configuraciones, flags, etc.)';


--
-- TOC entry 6577 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN equipment_purchase_requests.bc_purchase_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.bc_purchase_type IS 'Tipo de Business Case: public, private_comodato o private_sale';


--
-- TOC entry 6578 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN equipment_purchase_requests.bc_duration_years; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.bc_duration_years IS 'Duración del comodato en años (solo para privados)';


--
-- TOC entry 6579 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN equipment_purchase_requests.bc_equipment_cost; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.bc_equipment_cost IS 'Costo del equipo utilizado para cálculos de ROI';


--
-- TOC entry 6580 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN equipment_purchase_requests.bc_target_margin_percentage; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.bc_target_margin_percentage IS 'Margen objetivo (%) para cálculos privados';


--
-- TOC entry 6581 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN equipment_purchase_requests.bc_amortization_months; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.bc_amortization_months IS 'Meses de amortización estimados';


--
-- TOC entry 6582 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN equipment_purchase_requests.bc_calculation_mode; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.bc_calculation_mode IS 'Modo de cálculo: monthly o annual';


--
-- TOC entry 6583 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN equipment_purchase_requests.bc_show_roi; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.bc_show_roi IS 'Flag para mostrar ROI en reportes';


--
-- TOC entry 6584 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN equipment_purchase_requests.bc_show_margin; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.bc_show_margin IS 'Flag para mostrar margen en reportes';


--
-- TOC entry 6585 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN equipment_purchase_requests.process_code; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.process_code IS 'Código del proceso (solo para comodatos públicos)';


--
-- TOC entry 6586 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN equipment_purchase_requests.contract_object; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.equipment_purchase_requests.contract_object IS 'Objeto de contratación (solo para comodatos públicos)';


--
-- TOC entry 340 (class 1259 OID 27223)
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
-- TOC entry 348 (class 1259 OID 27312)
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
-- TOC entry 347 (class 1259 OID 27311)
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
-- TOC entry 6587 (class 0 OID 0)
-- Dependencies: 347
-- Name: equipos_historial_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.equipos_historial_id_seq OWNED BY public.equipos_historial.id;


--
-- TOC entry 339 (class 1259 OID 27222)
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
-- TOC entry 6588 (class 0 OID 0)
-- Dependencies: 339
-- Name: equipos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.equipos_id_seq OWNED BY public.equipos.id;


--
-- TOC entry 344 (class 1259 OID 27274)
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
-- TOC entry 343 (class 1259 OID 27273)
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
-- TOC entry 6589 (class 0 OID 0)
-- Dependencies: 343
-- Name: equipos_modelo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.equipos_modelo_id_seq OWNED BY public.equipos_modelo.id;


--
-- TOC entry 342 (class 1259 OID 27245)
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
-- TOC entry 341 (class 1259 OID 27244)
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
-- TOC entry 6590 (class 0 OID 0)
-- Dependencies: 341
-- Name: equipos_movimientos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.equipos_movimientos_id_seq OWNED BY public.equipos_movimientos.id;


--
-- TOC entry 346 (class 1259 OID 27288)
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
-- TOC entry 345 (class 1259 OID 27287)
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
-- TOC entry 6591 (class 0 OID 0)
-- Dependencies: 345
-- Name: equipos_unidad_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.equipos_unidad_id_seq OWNED BY public.equipos_unidad.id;


--
-- TOC entry 231 (class 1259 OID 16445)
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
-- TOC entry 232 (class 1259 OID 16453)
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
-- TOC entry 6592 (class 0 OID 0)
-- Dependencies: 232
-- Name: inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventory_id_seq OWNED BY public.inventory.id;


--
-- TOC entry 233 (class 1259 OID 16454)
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
-- TOC entry 234 (class 1259 OID 16461)
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
-- TOC entry 6593 (class 0 OID 0)
-- Dependencies: 234
-- Name: inventory_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventory_movements_id_seq OWNED BY public.inventory_movements.id;


--
-- TOC entry 324 (class 1259 OID 26482)
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
    CONSTRAINT permisos_vacaciones_check1 CHECK ((((tipo_permiso = 'calamidad'::text) AND (subtipo_calamidad = ANY (ARRAY['fallecimiento'::text, 'accidente'::text, 'desastre'::text]))) OR (tipo_permiso <> 'calamidad'::text))),
    CONSTRAINT permisos_vacaciones_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'partially_approved'::text, 'pending_final'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT permisos_vacaciones_tipo_solicitud_check CHECK ((tipo_solicitud = ANY (ARRAY['permiso'::text, 'vacaciones'::text])))
);


ALTER TABLE public.permisos_vacaciones OWNER TO postgres;

--
-- TOC entry 323 (class 1259 OID 26481)
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
-- TOC entry 6594 (class 0 OID 0)
-- Dependencies: 323
-- Name: permisos_vacaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.permisos_vacaciones_id_seq OWNED BY public.permisos_vacaciones.id;


--
-- TOC entry 285 (class 1259 OID 17430)
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
-- TOC entry 284 (class 1259 OID 17429)
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
-- TOC entry 6595 (class 0 OID 0)
-- Dependencies: 284
-- Name: personnel_request_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.personnel_request_comments_id_seq OWNED BY public.personnel_request_comments.id;


--
-- TOC entry 283 (class 1259 OID 17407)
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
-- TOC entry 282 (class 1259 OID 17406)
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
-- TOC entry 6596 (class 0 OID 0)
-- Dependencies: 282
-- Name: personnel_request_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.personnel_request_history_id_seq OWNED BY public.personnel_request_history.id;


--
-- TOC entry 281 (class 1259 OID 17351)
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
-- TOC entry 6597 (class 0 OID 0)
-- Dependencies: 281
-- Name: TABLE personnel_requests; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.personnel_requests IS 'Solicitudes de personal con perfil profesional completo';


--
-- TOC entry 6598 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN personnel_requests.position_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.personnel_requests.position_type IS 'Tipo de contratación: permanente, temporal, reemplazo, proyecto';


--
-- TOC entry 6599 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN personnel_requests.urgency_level; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.personnel_requests.urgency_level IS 'Nivel de urgencia: baja, normal, alta, urgente';


--
-- TOC entry 6600 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN personnel_requests.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.personnel_requests.status IS 'Estado: pendiente, en_revision, aprobada, rechazada, en_proceso, completada, cancelada';


--
-- TOC entry 280 (class 1259 OID 17350)
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
-- TOC entry 6601 (class 0 OID 0)
-- Dependencies: 280
-- Name: personnel_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.personnel_requests_id_seq OWNED BY public.personnel_requests.id;


--
-- TOC entry 350 (class 1259 OID 27409)
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
-- TOC entry 6602 (class 0 OID 0)
-- Dependencies: 350
-- Name: TABLE private_purchase_requests; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.private_purchase_requests IS 'Solicitudes privadas de compra que recorren el flujo comercial → backoffice → ACP';


--
-- TOC entry 6603 (class 0 OID 0)
-- Dependencies: 350
-- Name: COLUMN private_purchase_requests.client_snapshot; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.private_purchase_requests.client_snapshot IS 'Snapshot JSON del cliente (temp o registrado) provisto por el asesor comercial';


--
-- TOC entry 6604 (class 0 OID 0)
-- Dependencies: 350
-- Name: COLUMN private_purchase_requests.equipment; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.private_purchase_requests.equipment IS 'Lista de equipos seleccionados para esta solicitud (solo activos sin cliente/serie asignada)';


--
-- TOC entry 6605 (class 0 OID 0)
-- Dependencies: 350
-- Name: COLUMN private_purchase_requests.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.private_purchase_requests.status IS 'Estado de la solicitud privada durante la negociación';


--
-- TOC entry 6606 (class 0 OID 0)
-- Dependencies: 350
-- Name: COLUMN private_purchase_requests.offer_document_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.private_purchase_requests.offer_document_id IS 'Document ID de la oferta generada en Drive';


--
-- TOC entry 6607 (class 0 OID 0)
-- Dependencies: 350
-- Name: COLUMN private_purchase_requests.offer_signed_document_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.private_purchase_requests.offer_signed_document_id IS 'Document ID de la oferta firmada cargada por el comercial';


--
-- TOC entry 6608 (class 0 OID 0)
-- Dependencies: 350
-- Name: COLUMN private_purchase_requests.forwarded_to_acp_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.private_purchase_requests.forwarded_to_acp_at IS 'Fecha en que backoffice envió la solicitud a ACP tras registro del cliente';


--
-- TOC entry 6609 (class 0 OID 0)
-- Dependencies: 350
-- Name: COLUMN private_purchase_requests.offer_valid_until; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.private_purchase_requests.offer_valid_until IS 'Fecha de expiración de la oferta propuesta';


--
-- TOC entry 6610 (class 0 OID 0)
-- Dependencies: 350
-- Name: COLUMN private_purchase_requests.offer_kind; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.private_purchase_requests.offer_kind IS 'Tipo de solicitud: venta, prestamo o comodato';


--
-- TOC entry 6611 (class 0 OID 0)
-- Dependencies: 350
-- Name: COLUMN private_purchase_requests.comodato_document_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.private_purchase_requests.comodato_document_id IS 'Documento de estadísticas cargado para comodatos, almacenado en Drive';


--
-- TOC entry 235 (class 1259 OID 16462)
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
-- TOC entry 236 (class 1259 OID 16469)
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
-- TOC entry 6612 (class 0 OID 0)
-- Dependencies: 236
-- Name: request_approvals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.request_approvals_id_seq OWNED BY public.request_approvals.id;


--
-- TOC entry 237 (class 1259 OID 16470)
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
-- TOC entry 238 (class 1259 OID 16477)
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
-- TOC entry 6613 (class 0 OID 0)
-- Dependencies: 238
-- Name: request_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.request_attachments_id_seq OWNED BY public.request_attachments.id;


--
-- TOC entry 239 (class 1259 OID 16478)
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
-- TOC entry 6614 (class 0 OID 0)
-- Dependencies: 239
-- Name: TABLE request_status_history; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.request_status_history IS 'Historial completo de estados por request.';


--
-- TOC entry 240 (class 1259 OID 16487)
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
-- TOC entry 6615 (class 0 OID 0)
-- Dependencies: 240
-- Name: request_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.request_status_history_id_seq OWNED BY public.request_status_history.id;


--
-- TOC entry 241 (class 1259 OID 16488)
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
-- TOC entry 242 (class 1259 OID 16497)
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
-- TOC entry 6616 (class 0 OID 0)
-- Dependencies: 242
-- Name: request_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.request_types_id_seq OWNED BY public.request_types.id;


--
-- TOC entry 243 (class 1259 OID 16498)
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
-- TOC entry 244 (class 1259 OID 16505)
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
-- TOC entry 6617 (class 0 OID 0)
-- Dependencies: 244
-- Name: request_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.request_versions_id_seq OWNED BY public.request_versions.id;


--
-- TOC entry 245 (class 1259 OID 16506)
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
-- TOC entry 246 (class 1259 OID 16519)
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
-- TOC entry 6618 (class 0 OID 0)
-- Dependencies: 246
-- Name: requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.requests_id_seq OWNED BY public.requests.id;


--
-- TOC entry 318 (class 1259 OID 26390)
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
-- TOC entry 317 (class 1259 OID 26389)
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
-- TOC entry 6619 (class 0 OID 0)
-- Dependencies: 317
-- Name: scheduled_visits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.scheduled_visits_id_seq OWNED BY public.scheduled_visits.id;


--
-- TOC entry 312 (class 1259 OID 26320)
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
-- TOC entry 6620 (class 0 OID 0)
-- Dependencies: 312
-- Name: TABLE technical_documents; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.technical_documents IS 'Registro de documentos técnicos generados por el área de Servicio Técnico';


--
-- TOC entry 6621 (class 0 OID 0)
-- Dependencies: 312
-- Name: COLUMN technical_documents.document_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.technical_documents.document_type IS 'Tipo de documento: DISINFECTION, TRAINING_ATTENDANCE, etc.';


--
-- TOC entry 6622 (class 0 OID 0)
-- Dependencies: 312
-- Name: COLUMN technical_documents.document_code; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.technical_documents.document_code IS 'Código del formato (Ej: F.ST-02, F.ST-05)';


--
-- TOC entry 6623 (class 0 OID 0)
-- Dependencies: 312
-- Name: COLUMN technical_documents.form_data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.technical_documents.form_data IS 'Datos del formulario en formato JSON';


--
-- TOC entry 6624 (class 0 OID 0)
-- Dependencies: 312
-- Name: COLUMN technical_documents.drive_file_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.technical_documents.drive_file_id IS 'ID del archivo en Google Drive';


--
-- TOC entry 311 (class 1259 OID 26319)
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
-- TOC entry 6625 (class 0 OID 0)
-- Dependencies: 311
-- Name: technical_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.technical_documents_id_seq OWNED BY public.technical_documents.id;


--
-- TOC entry 322 (class 1259 OID 26445)
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
-- TOC entry 321 (class 1259 OID 26444)
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
-- TOC entry 6626 (class 0 OID 0)
-- Dependencies: 321
-- Name: travel_segments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.travel_segments_id_seq OWNED BY public.travel_segments.id;


--
-- TOC entry 274 (class 1259 OID 17170)
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
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_attendance_records OWNER TO postgres;

--
-- TOC entry 6627 (class 0 OID 0)
-- Dependencies: 274
-- Name: TABLE user_attendance_records; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_attendance_records IS 'Daily attendance records per user with entry, lunch, and exit times. Integrates with user signatures from lopdp_internal_signature_file_id.';


--
-- TOC entry 6628 (class 0 OID 0)
-- Dependencies: 274
-- Name: COLUMN user_attendance_records.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_attendance_records.user_id IS 'Foreign key to users table';


--
-- TOC entry 6629 (class 0 OID 0)
-- Dependencies: 274
-- Name: COLUMN user_attendance_records.date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_attendance_records.date IS 'Date of the attendance record (without time component)';


--
-- TOC entry 6630 (class 0 OID 0)
-- Dependencies: 274
-- Name: COLUMN user_attendance_records.entry_time; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_attendance_records.entry_time IS 'Timestamp when user clocked in for the day';


--
-- TOC entry 6631 (class 0 OID 0)
-- Dependencies: 274
-- Name: COLUMN user_attendance_records.lunch_start_time; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_attendance_records.lunch_start_time IS 'Timestamp when user started lunch break (requires signature)';


--
-- TOC entry 6632 (class 0 OID 0)
-- Dependencies: 274
-- Name: COLUMN user_attendance_records.lunch_end_time; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_attendance_records.lunch_end_time IS 'Timestamp when user returned from lunch break';


--
-- TOC entry 6633 (class 0 OID 0)
-- Dependencies: 274
-- Name: COLUMN user_attendance_records.exit_time; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_attendance_records.exit_time IS 'Timestamp when user clocked out for the day (requires signature)';


--
-- TOC entry 6634 (class 0 OID 0)
-- Dependencies: 274
-- Name: COLUMN user_attendance_records.notes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_attendance_records.notes IS 'Optional notes for special circumstances (late arrival, early departure, etc.)';


--
-- TOC entry 273 (class 1259 OID 17169)
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
-- TOC entry 6635 (class 0 OID 0)
-- Dependencies: 273
-- Name: user_attendance_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_attendance_records_id_seq OWNED BY public.user_attendance_records.id;


--
-- TOC entry 278 (class 1259 OID 17298)
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
-- TOC entry 6636 (class 0 OID 0)
-- Dependencies: 278
-- Name: TABLE user_gmail_tokens; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_gmail_tokens IS 'Tokens OAuth 2.0 de Gmail para envío de emails por usuario';


--
-- TOC entry 6637 (class 0 OID 0)
-- Dependencies: 278
-- Name: COLUMN user_gmail_tokens.access_token; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_gmail_tokens.access_token IS 'Token de acceso temporal de Gmail API';


--
-- TOC entry 6638 (class 0 OID 0)
-- Dependencies: 278
-- Name: COLUMN user_gmail_tokens.refresh_token; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_gmail_tokens.refresh_token IS 'Token para renovar el access_token automáticamente';


--
-- TOC entry 6639 (class 0 OID 0)
-- Dependencies: 278
-- Name: COLUMN user_gmail_tokens.expiry_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_gmail_tokens.expiry_date IS 'Fecha de expiración del access_token';


--
-- TOC entry 277 (class 1259 OID 17297)
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
-- TOC entry 6640 (class 0 OID 0)
-- Dependencies: 277
-- Name: user_gmail_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_gmail_tokens_id_seq OWNED BY public.user_gmail_tokens.id;


--
-- TOC entry 272 (class 1259 OID 17155)
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
-- TOC entry 271 (class 1259 OID 17154)
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
-- TOC entry 6641 (class 0 OID 0)
-- Dependencies: 271
-- Name: user_lopdp_consents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_lopdp_consents_id_seq OWNED BY public.user_lopdp_consents.id;


--
-- TOC entry 261 (class 1259 OID 16947)
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
-- TOC entry 260 (class 1259 OID 16946)
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
-- TOC entry 6642 (class 0 OID 0)
-- Dependencies: 260
-- Name: user_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_sessions_id_seq OWNED BY public.user_sessions.id;


--
-- TOC entry 247 (class 1259 OID 16520)
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
    lopdp_internal_notes text
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 248 (class 1259 OID 16530)
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
-- TOC entry 6643 (class 0 OID 0)
-- Dependencies: 248
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 381 (class 1259 OID 28386)
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
-- TOC entry 6644 (class 0 OID 0)
-- Dependencies: 381
-- Name: VIEW v_bc_complete; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.v_bc_complete IS 'Vista completa del BC con todos los módulos';


--
-- TOC entry 353 (class 1259 OID 27528)
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
-- TOC entry 6645 (class 0 OID 0)
-- Dependencies: 353
-- Name: VIEW v_business_cases; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.v_business_cases IS 'Vista de Business Cases de comodatos (públicos y privados)';


--
-- TOC entry 356 (class 1259 OID 27543)
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
-- TOC entry 6646 (class 0 OID 0)
-- Dependencies: 356
-- Name: VIEW v_business_cases_complete; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.v_business_cases_complete IS 'Vista completa de Business Cases (alias de v_business_cases)';


--
-- TOC entry 355 (class 1259 OID 27538)
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
-- TOC entry 6647 (class 0 OID 0)
-- Dependencies: 355
-- Name: VIEW v_business_cases_private; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.v_business_cases_private IS 'Vista de comodatos privados (clientes privados)';


--
-- TOC entry 354 (class 1259 OID 27533)
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
-- TOC entry 6648 (class 0 OID 0)
-- Dependencies: 354
-- Name: VIEW v_business_cases_public; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.v_business_cases_public IS 'Vista de comodatos públicos (licitaciones)';


--
-- TOC entry 309 (class 1259 OID 26271)
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
-- TOC entry 257 (class 1259 OID 16583)
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
-- TOC entry 6649 (class 0 OID 0)
-- Dependencies: 257
-- Name: TABLE equipos; Type: COMMENT; Schema: servicio; Owner: postgres
--

COMMENT ON TABLE servicio.equipos IS 'Catálogo único de equipos manejados por el área de servicio técnico.';


--
-- TOC entry 6650 (class 0 OID 0)
-- Dependencies: 257
-- Name: COLUMN equipos.code; Type: COMMENT; Schema: servicio; Owner: postgres
--

COMMENT ON COLUMN servicio.equipos.code IS 'Código único del equipo (ej: c311, c501) - corresponde a hojas de Excel';


--
-- TOC entry 6651 (class 0 OID 0)
-- Dependencies: 257
-- Name: COLUMN equipos.capacity_per_hour; Type: COMMENT; Schema: servicio; Owner: postgres
--

COMMENT ON COLUMN servicio.equipos.capacity_per_hour IS 'Determinaciones que puede procesar por hora';


--
-- TOC entry 6652 (class 0 OID 0)
-- Dependencies: 257
-- Name: COLUMN equipos.max_daily_capacity; Type: COMMENT; Schema: servicio; Owner: postgres
--

COMMENT ON COLUMN servicio.equipos.max_daily_capacity IS 'Capacidad máxima de determinaciones por día';


--
-- TOC entry 6653 (class 0 OID 0)
-- Dependencies: 257
-- Name: COLUMN equipos.technical_specs; Type: COMMENT; Schema: servicio; Owner: postgres
--

COMMENT ON COLUMN servicio.equipos.technical_specs IS 'Especificaciones técnicas en JSON flexible (voltaje, dimensiones, etc.)';


--
-- TOC entry 6654 (class 0 OID 0)
-- Dependencies: 257
-- Name: COLUMN equipos.default_calculation_formula; Type: COMMENT; Schema: servicio; Owner: postgres
--

COMMENT ON COLUMN servicio.equipos.default_calculation_formula IS 'Fórmula por defecto para todas las determinaciones de este equipo';


--
-- TOC entry 6655 (class 0 OID 0)
-- Dependencies: 257
-- Name: COLUMN equipos.calculation_engine; Type: COMMENT; Schema: servicio; Owner: postgres
--

COMMENT ON COLUMN servicio.equipos.calculation_engine IS 'Motor de cálculo: standard, advanced, custom';


--
-- TOC entry 336 (class 1259 OID 27076)
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
-- TOC entry 6656 (class 0 OID 0)
-- Dependencies: 336
-- Name: VIEW v_determinations_with_formulas; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.v_determinations_with_formulas IS 'Vista de determinaciones mostrando origen de su fórmula de cálculo';


--
-- TOC entry 310 (class 1259 OID 26297)
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
-- TOC entry 6657 (class 0 OID 0)
-- Dependencies: 310
-- Name: VIEW v_equipment_determinations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.v_equipment_determinations IS 'Vista de equipos (servicio.equipos) con sus determinaciones';


--
-- TOC entry 333 (class 1259 OID 27033)
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
-- TOC entry 6658 (class 0 OID 0)
-- Dependencies: 333
-- Name: VIEW v_equipment_full_catalog; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.v_equipment_full_catalog IS 'Vista consolidada de equipos con conteo de determinaciones y consumibles disponibles';


--
-- TOC entry 349 (class 1259 OID 27341)
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
-- TOC entry 290 (class 1259 OID 25697)
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
-- TOC entry 289 (class 1259 OID 25696)
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
-- TOC entry 6659 (class 0 OID 0)
-- Dependencies: 289
-- Name: vacaciones_solicitudes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.vacaciones_solicitudes_id_seq OWNED BY public.vacaciones_solicitudes.id;


--
-- TOC entry 316 (class 1259 OID 26369)
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
-- TOC entry 315 (class 1259 OID 26368)
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
-- TOC entry 6660 (class 0 OID 0)
-- Dependencies: 315
-- Name: visit_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.visit_schedules_id_seq OWNED BY public.visit_schedules.id;


--
-- TOC entry 249 (class 1259 OID 16531)
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
-- TOC entry 6661 (class 0 OID 0)
-- Dependencies: 249
-- Name: VIEW vw_dashboard_requests; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.vw_dashboard_requests IS 'Vista de consolidación de solicitudes, incluyendo estados pending, in_review, approved, rejected y cancelled.';


--
-- TOC entry 250 (class 1259 OID 16536)
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
-- TOC entry 6662 (class 0 OID 0)
-- Dependencies: 250
-- Name: VIEW vw_request_metrics; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.vw_request_metrics IS 'Resumen de solicitudes agrupadas por estado (incluye cancelled).';


--
-- TOC entry 314 (class 1259 OID 26351)
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
-- TOC entry 313 (class 1259 OID 26350)
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
-- TOC entry 6663 (class 0 OID 0)
-- Dependencies: 313
-- Name: aplicaciones_tecnicas_id_seq; Type: SEQUENCE OWNED BY; Schema: servicio; Owner: postgres
--

ALTER SEQUENCE servicio.aplicaciones_tecnicas_id_seq OWNED BY servicio.aplicaciones_tecnicas.id;


--
-- TOC entry 251 (class 1259 OID 16540)
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
-- TOC entry 252 (class 1259 OID 16553)
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
-- TOC entry 6664 (class 0 OID 0)
-- Dependencies: 252
-- Name: cronograma_capacitacion_id_capacitacion_seq; Type: SEQUENCE OWNED BY; Schema: servicio; Owner: postgres
--

ALTER SEQUENCE servicio.cronograma_capacitacion_id_capacitacion_seq OWNED BY servicio.cronograma_capacitacion.id_capacitacion;


--
-- TOC entry 253 (class 1259 OID 16554)
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
-- TOC entry 6665 (class 0 OID 0)
-- Dependencies: 253
-- Name: TABLE cronograma_mantenimientos; Type: COMMENT; Schema: servicio; Owner: postgres
--

COMMENT ON TABLE servicio.cronograma_mantenimientos IS 'Registro de mantenimientos preventivos y correctivos asociados a cada equipo.';


--
-- TOC entry 254 (class 1259 OID 16568)
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
-- TOC entry 6666 (class 0 OID 0)
-- Dependencies: 254
-- Name: TABLE cronograma_mantenimientos_anuales; Type: COMMENT; Schema: servicio; Owner: postgres
--

COMMENT ON TABLE servicio.cronograma_mantenimientos_anuales IS 'Plan anual de mantenimiento preventivo por equipo.';


--
-- TOC entry 255 (class 1259 OID 16581)
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
-- TOC entry 6667 (class 0 OID 0)
-- Dependencies: 255
-- Name: cronograma_mantenimientos_anuales_id_mant_anual_seq; Type: SEQUENCE OWNED BY; Schema: servicio; Owner: postgres
--

ALTER SEQUENCE servicio.cronograma_mantenimientos_anuales_id_mant_anual_seq OWNED BY servicio.cronograma_mantenimientos_anuales.id_mant_anual;


--
-- TOC entry 256 (class 1259 OID 16582)
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
-- TOC entry 6668 (class 0 OID 0)
-- Dependencies: 256
-- Name: cronograma_mantenimientos_id_mantenimiento_seq; Type: SEQUENCE OWNED BY; Schema: servicio; Owner: postgres
--

ALTER SEQUENCE servicio.cronograma_mantenimientos_id_mantenimiento_seq OWNED BY servicio.cronograma_mantenimientos.id_mantenimiento;


--
-- TOC entry 288 (class 1259 OID 25678)
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
-- TOC entry 287 (class 1259 OID 25677)
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
-- TOC entry 6669 (class 0 OID 0)
-- Dependencies: 287
-- Name: disponibilidad_tecnicos_id_seq; Type: SEQUENCE OWNED BY; Schema: servicio; Owner: postgres
--

ALTER SEQUENCE servicio.disponibilidad_tecnicos_id_seq OWNED BY servicio.disponibilidad_tecnicos.id;


--
-- TOC entry 258 (class 1259 OID 16594)
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
-- TOC entry 6670 (class 0 OID 0)
-- Dependencies: 258
-- Name: equipos_id_equipo_seq; Type: SEQUENCE OWNED BY; Schema: servicio; Owner: postgres
--

ALTER SEQUENCE servicio.equipos_id_equipo_seq OWNED BY servicio.equipos.id_equipo;


--
-- TOC entry 259 (class 1259 OID 16595)
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
-- TOC entry 5423 (class 2604 OID 16989)
-- Name: logs id; Type: DEFAULT; Schema: auditoria; Owner: postgres
--

ALTER TABLE ONLY auditoria.logs ALTER COLUMN id SET DEFAULT nextval('auditoria.logs_id_seq'::regclass);


--
-- TOC entry 5559 (class 2604 OID 26422)
-- Name: advisor_location_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.advisor_location_history ALTER COLUMN id SET DEFAULT nextval('public.advisor_location_history_id_seq'::regclass);


--
-- TOC entry 5354 (class 2604 OID 16600)
-- Name: audit_trail id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_trail ALTER COLUMN id SET DEFAULT nextval('public.audit_trail_id_seq'::regclass);


--
-- TOC entry 5530 (class 2604 OID 26216)
-- Name: bc_alerts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_alerts ALTER COLUMN id SET DEFAULT nextval('public.bc_alerts_id_seq'::regclass);


--
-- TOC entry 5590 (class 2604 OID 27012)
-- Name: bc_audit_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_audit_log ALTER COLUMN id SET DEFAULT nextval('public.bc_audit_log_id_seq'::regclass);


--
-- TOC entry 5574 (class 2604 OID 26946)
-- Name: bc_calculations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_calculations ALTER COLUMN id SET DEFAULT nextval('public.bc_calculations_id_seq'::regclass);


--
-- TOC entry 5649 (class 2604 OID 27665)
-- Name: bc_deliveries id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_deliveries ALTER COLUMN id SET DEFAULT nextval('public.bc_deliveries_id_seq'::regclass);


--
-- TOC entry 5570 (class 2604 OID 26915)
-- Name: bc_determinations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_determinations ALTER COLUMN id SET DEFAULT nextval('public.bc_determinations_id_seq'::regclass);


--
-- TOC entry 5662 (class 2604 OID 28242)
-- Name: bc_economic_data id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_economic_data ALTER COLUMN id SET DEFAULT nextval('public.bc_economic_data_id_seq'::regclass);


--
-- TOC entry 5632 (class 2604 OID 27577)
-- Name: bc_equipment_details id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_equipment_details ALTER COLUMN id SET DEFAULT nextval('public.bc_equipment_details_id_seq'::regclass);


--
-- TOC entry 5598 (class 2604 OID 27142)
-- Name: bc_equipment_selection id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_equipment_selection ALTER COLUMN id SET DEFAULT nextval('public.bc_equipment_selection_id_seq'::regclass);


--
-- TOC entry 5627 (class 2604 OID 27504)
-- Name: bc_investments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_investments ALTER COLUMN id SET DEFAULT nextval('public.bc_investments_id_seq'::regclass);


--
-- TOC entry 5629 (class 2604 OID 27552)
-- Name: bc_lab_environment id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lab_environment ALTER COLUMN id SET DEFAULT nextval('public.bc_lab_environment_id_seq'::regclass);


--
-- TOC entry 5675 (class 2604 OID 28311)
-- Name: bc_lis_data id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lis_data ALTER COLUMN id SET DEFAULT nextval('public.bc_lis_data_id_seq'::regclass);


--
-- TOC entry 5644 (class 2604 OID 27628)
-- Name: bc_lis_equipment_interfaces id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lis_equipment_interfaces ALTER COLUMN id SET DEFAULT nextval('public.bc_lis_equipment_interfaces_id_seq'::regclass);


--
-- TOC entry 5638 (class 2604 OID 27603)
-- Name: bc_lis_integration id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lis_integration ALTER COLUMN id SET DEFAULT nextval('public.bc_lis_integration_id_seq'::regclass);


--
-- TOC entry 5668 (class 2604 OID 28276)
-- Name: bc_operational_data id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_operational_data ALTER COLUMN id SET DEFAULT nextval('public.bc_operational_data_id_seq'::regclass);


--
-- TOC entry 5646 (class 2604 OID 27645)
-- Name: bc_requirements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_requirements ALTER COLUMN id SET DEFAULT nextval('public.bc_requirements_id_seq'::regclass);


--
-- TOC entry 5683 (class 2604 OID 28353)
-- Name: bc_validations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_validations ALTER COLUMN id SET DEFAULT nextval('public.bc_validations_id_seq'::regclass);


--
-- TOC entry 5681 (class 2604 OID 28336)
-- Name: bc_workflow_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_workflow_history ALTER COLUMN id SET DEFAULT nextval('public.bc_workflow_history_id_seq'::regclass);


--
-- TOC entry 5592 (class 2604 OID 27052)
-- Name: calculation_templates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calculation_templates ALTER COLUMN id SET DEFAULT nextval('public.calculation_templates_id_seq'::regclass);


--
-- TOC entry 5509 (class 2604 OID 26097)
-- Name: catalog_consumables id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_consumables ALTER COLUMN id SET DEFAULT nextval('public.catalog_consumables_id_seq'::regclass);


--
-- TOC entry 5499 (class 2604 OID 26064)
-- Name: catalog_determinations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_determinations ALTER COLUMN id SET DEFAULT nextval('public.catalog_determinations_id_seq'::regclass);


--
-- TOC entry 5516 (class 2604 OID 26125)
-- Name: catalog_equipment_consumables id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_equipment_consumables ALTER COLUMN id SET DEFAULT nextval('public.catalog_equipment_consumables_id_seq'::regclass);


--
-- TOC entry 5534 (class 2604 OID 26249)
-- Name: catalog_investments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_investments ALTER COLUMN id SET DEFAULT nextval('public.catalog_investments_id_seq'::regclass);


--
-- TOC entry 5494 (class 2604 OID 25718)
-- Name: client_assignments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_assignments ALTER COLUMN id SET DEFAULT nextval('public.client_assignments_id_seq'::regclass);


--
-- TOC entry 5436 (class 2604 OID 17115)
-- Name: client_request_consents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_request_consents ALTER COLUMN id SET DEFAULT nextval('public.client_request_consents_id_seq'::regclass);


--
-- TOC entry 5427 (class 2604 OID 17087)
-- Name: client_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_requests ALTER COLUMN id SET DEFAULT nextval('public.client_requests_id_seq'::regclass);


--
-- TOC entry 5496 (class 2604 OID 25738)
-- Name: client_visit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_visit_logs ALTER COLUMN id SET DEFAULT nextval('public.client_visit_logs_id_seq'::regclass);


--
-- TOC entry 5447 (class 2604 OID 17247)
-- Name: clients id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);


--
-- TOC entry 5519 (class 2604 OID 26155)
-- Name: contract_determinations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_determinations ALTER COLUMN id SET DEFAULT nextval('public.contract_determinations_id_seq'::regclass);


--
-- TOC entry 5420 (class 2604 OID 16962)
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- TOC entry 5526 (class 2604 OID 26191)
-- Name: determination_consumption_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.determination_consumption_log ALTER COLUMN id SET DEFAULT nextval('public.determination_consumption_log_id_seq'::regclass);


--
-- TOC entry 5357 (class 2604 OID 16601)
-- Name: document_signatures id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_signatures ALTER COLUMN id SET DEFAULT nextval('public.document_signatures_id_seq'::regclass);


--
-- TOC entry 5359 (class 2604 OID 16602)
-- Name: documents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents ALTER COLUMN id SET DEFAULT nextval('public.documents_id_seq'::regclass);


--
-- TOC entry 5364 (class 2604 OID 16603)
-- Name: employees id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);


--
-- TOC entry 5588 (class 2604 OID 26973)
-- Name: equipment_price_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipment_price_history ALTER COLUMN id SET DEFAULT nextval('public.equipment_price_history_id_seq'::regclass);


--
-- TOC entry 5602 (class 2604 OID 27226)
-- Name: equipos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos ALTER COLUMN id SET DEFAULT nextval('public.equipos_id_seq'::regclass);


--
-- TOC entry 5617 (class 2604 OID 27315)
-- Name: equipos_historial id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_historial ALTER COLUMN id SET DEFAULT nextval('public.equipos_historial_id_seq'::regclass);


--
-- TOC entry 5610 (class 2604 OID 27277)
-- Name: equipos_modelo id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_modelo ALTER COLUMN id SET DEFAULT nextval('public.equipos_modelo_id_seq'::regclass);


--
-- TOC entry 5607 (class 2604 OID 27248)
-- Name: equipos_movimientos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_movimientos ALTER COLUMN id SET DEFAULT nextval('public.equipos_movimientos_id_seq'::regclass);


--
-- TOC entry 5612 (class 2604 OID 27291)
-- Name: equipos_unidad id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_unidad ALTER COLUMN id SET DEFAULT nextval('public.equipos_unidad_id_seq'::regclass);


--
-- TOC entry 5367 (class 2604 OID 16604)
-- Name: inventory id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory ALTER COLUMN id SET DEFAULT nextval('public.inventory_id_seq'::regclass);


--
-- TOC entry 5371 (class 2604 OID 16605)
-- Name: inventory_movements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_movements ALTER COLUMN id SET DEFAULT nextval('public.inventory_movements_id_seq'::regclass);


--
-- TOC entry 5564 (class 2604 OID 26485)
-- Name: permisos_vacaciones id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos_vacaciones ALTER COLUMN id SET DEFAULT nextval('public.permisos_vacaciones_id_seq'::regclass);


--
-- TOC entry 5482 (class 2604 OID 17433)
-- Name: personnel_request_comments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_request_comments ALTER COLUMN id SET DEFAULT nextval('public.personnel_request_comments_id_seq'::regclass);


--
-- TOC entry 5480 (class 2604 OID 17410)
-- Name: personnel_request_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_request_history ALTER COLUMN id SET DEFAULT nextval('public.personnel_request_history_id_seq'::regclass);


--
-- TOC entry 5473 (class 2604 OID 17354)
-- Name: personnel_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_requests ALTER COLUMN id SET DEFAULT nextval('public.personnel_requests_id_seq'::regclass);


--
-- TOC entry 5374 (class 2604 OID 16606)
-- Name: request_approvals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_approvals ALTER COLUMN id SET DEFAULT nextval('public.request_approvals_id_seq'::regclass);


--
-- TOC entry 5376 (class 2604 OID 16607)
-- Name: request_attachments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_attachments ALTER COLUMN id SET DEFAULT nextval('public.request_attachments_id_seq'::regclass);


--
-- TOC entry 5378 (class 2604 OID 16608)
-- Name: request_status_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_status_history ALTER COLUMN id SET DEFAULT nextval('public.request_status_history_id_seq'::regclass);


--
-- TOC entry 5380 (class 2604 OID 16609)
-- Name: request_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_types ALTER COLUMN id SET DEFAULT nextval('public.request_types_id_seq'::regclass);


--
-- TOC entry 5382 (class 2604 OID 16610)
-- Name: request_versions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_versions ALTER COLUMN id SET DEFAULT nextval('public.request_versions_id_seq'::regclass);


--
-- TOC entry 5384 (class 2604 OID 16611)
-- Name: requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requests ALTER COLUMN id SET DEFAULT nextval('public.requests_id_seq'::regclass);


--
-- TOC entry 5555 (class 2604 OID 26393)
-- Name: scheduled_visits id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scheduled_visits ALTER COLUMN id SET DEFAULT nextval('public.scheduled_visits_id_seq'::regclass);


--
-- TOC entry 5542 (class 2604 OID 26323)
-- Name: technical_documents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.technical_documents ALTER COLUMN id SET DEFAULT nextval('public.technical_documents_id_seq'::regclass);


--
-- TOC entry 5562 (class 2604 OID 26448)
-- Name: travel_segments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.travel_segments ALTER COLUMN id SET DEFAULT nextval('public.travel_segments_id_seq'::regclass);


--
-- TOC entry 5444 (class 2604 OID 17173)
-- Name: user_attendance_records id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_attendance_records ALTER COLUMN id SET DEFAULT nextval('public.user_attendance_records_id_seq'::regclass);


--
-- TOC entry 5455 (class 2604 OID 17301)
-- Name: user_gmail_tokens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_gmail_tokens ALTER COLUMN id SET DEFAULT nextval('public.user_gmail_tokens_id_seq'::regclass);


--
-- TOC entry 5442 (class 2604 OID 17158)
-- Name: user_lopdp_consents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_lopdp_consents ALTER COLUMN id SET DEFAULT nextval('public.user_lopdp_consents_id_seq'::regclass);


--
-- TOC entry 5418 (class 2604 OID 16950)
-- Name: user_sessions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions ALTER COLUMN id SET DEFAULT nextval('public.user_sessions_id_seq'::regclass);


--
-- TOC entry 5390 (class 2604 OID 16612)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 5489 (class 2604 OID 25700)
-- Name: vacaciones_solicitudes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vacaciones_solicitudes ALTER COLUMN id SET DEFAULT nextval('public.vacaciones_solicitudes_id_seq'::regclass);


--
-- TOC entry 5551 (class 2604 OID 26372)
-- Name: visit_schedules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.visit_schedules ALTER COLUMN id SET DEFAULT nextval('public.visit_schedules_id_seq'::regclass);


--
-- TOC entry 5546 (class 2604 OID 26354)
-- Name: aplicaciones_tecnicas id; Type: DEFAULT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.aplicaciones_tecnicas ALTER COLUMN id SET DEFAULT nextval('servicio.aplicaciones_tecnicas_id_seq'::regclass);


--
-- TOC entry 5394 (class 2604 OID 16613)
-- Name: cronograma_capacitacion id_capacitacion; Type: DEFAULT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_capacitacion ALTER COLUMN id_capacitacion SET DEFAULT nextval('servicio.cronograma_capacitacion_id_capacitacion_seq'::regclass);


--
-- TOC entry 5398 (class 2604 OID 16614)
-- Name: cronograma_mantenimientos id_mantenimiento; Type: DEFAULT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos ALTER COLUMN id_mantenimiento SET DEFAULT nextval('servicio.cronograma_mantenimientos_id_mantenimiento_seq'::regclass);


--
-- TOC entry 5405 (class 2604 OID 16615)
-- Name: cronograma_mantenimientos_anuales id_mant_anual; Type: DEFAULT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos_anuales ALTER COLUMN id_mant_anual SET DEFAULT nextval('servicio.cronograma_mantenimientos_anuales_id_mant_anual_seq'::regclass);


--
-- TOC entry 5486 (class 2604 OID 25681)
-- Name: disponibilidad_tecnicos id; Type: DEFAULT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.disponibilidad_tecnicos ALTER COLUMN id SET DEFAULT nextval('servicio.disponibilidad_tecnicos_id_seq'::regclass);


--
-- TOC entry 5409 (class 2604 OID 16616)
-- Name: equipos id_equipo; Type: DEFAULT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.equipos ALTER COLUMN id_equipo SET DEFAULT nextval('servicio.equipos_id_equipo_seq'::regclass);


--
-- TOC entry 5855 (class 2606 OID 16995)
-- Name: logs logs_pkey; Type: CONSTRAINT; Schema: auditoria; Owner: postgres
--

ALTER TABLE ONLY auditoria.logs
    ADD CONSTRAINT logs_pkey PRIMARY KEY (id);


--
-- TOC entry 5991 (class 2606 OID 26433)
-- Name: advisor_location_history advisor_location_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.advisor_location_history
    ADD CONSTRAINT advisor_location_history_pkey PRIMARY KEY (id);


--
-- TOC entry 5775 (class 2606 OID 16618)
-- Name: audit_trail audit_trail_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_trail
    ADD CONSTRAINT audit_trail_pkey PRIMARY KEY (id);


--
-- TOC entry 5958 (class 2606 OID 26229)
-- Name: bc_alerts bc_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_alerts
    ADD CONSTRAINT bc_alerts_pkey PRIMARY KEY (id);


--
-- TOC entry 6027 (class 2606 OID 27020)
-- Name: bc_audit_log bc_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_audit_log
    ADD CONSTRAINT bc_audit_log_pkey PRIMARY KEY (id);


--
-- TOC entry 6016 (class 2606 OID 26967)
-- Name: bc_calculations bc_calculations_business_case_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_calculations
    ADD CONSTRAINT bc_calculations_business_case_id_key UNIQUE (business_case_id);


--
-- TOC entry 6019 (class 2606 OID 26965)
-- Name: bc_calculations bc_calculations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_calculations
    ADD CONSTRAINT bc_calculations_pkey PRIMARY KEY (id);


--
-- TOC entry 6094 (class 2606 OID 27675)
-- Name: bc_deliveries bc_deliveries_business_case_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_deliveries
    ADD CONSTRAINT bc_deliveries_business_case_id_key UNIQUE (business_case_id);


--
-- TOC entry 6096 (class 2606 OID 27673)
-- Name: bc_deliveries bc_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_deliveries
    ADD CONSTRAINT bc_deliveries_pkey PRIMARY KEY (id);


--
-- TOC entry 6005 (class 2606 OID 26929)
-- Name: bc_determinations bc_determinations_business_case_id_determination_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_determinations
    ADD CONSTRAINT bc_determinations_business_case_id_determination_id_key UNIQUE (business_case_id, determination_id);


--
-- TOC entry 6009 (class 2606 OID 26927)
-- Name: bc_determinations bc_determinations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_determinations
    ADD CONSTRAINT bc_determinations_pkey PRIMARY KEY (id);


--
-- TOC entry 6107 (class 2606 OID 28254)
-- Name: bc_economic_data bc_economic_data_bc_master_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_economic_data
    ADD CONSTRAINT bc_economic_data_bc_master_id_key UNIQUE (bc_master_id);


--
-- TOC entry 6109 (class 2606 OID 28252)
-- Name: bc_economic_data bc_economic_data_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_economic_data
    ADD CONSTRAINT bc_economic_data_pkey PRIMARY KEY (id);


--
-- TOC entry 6075 (class 2606 OID 27593)
-- Name: bc_equipment_details bc_equipment_details_business_case_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_equipment_details
    ADD CONSTRAINT bc_equipment_details_business_case_id_key UNIQUE (business_case_id);


--
-- TOC entry 6077 (class 2606 OID 27591)
-- Name: bc_equipment_details bc_equipment_details_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_equipment_details
    ADD CONSTRAINT bc_equipment_details_pkey PRIMARY KEY (id);


--
-- TOC entry 6038 (class 2606 OID 27156)
-- Name: bc_equipment_selection bc_equipment_selection_business_case_id_equipment_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_equipment_selection
    ADD CONSTRAINT bc_equipment_selection_business_case_id_equipment_id_key UNIQUE (business_case_id, equipment_id);


--
-- TOC entry 6042 (class 2606 OID 27149)
-- Name: bc_equipment_selection bc_equipment_selection_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_equipment_selection
    ADD CONSTRAINT bc_equipment_selection_pkey PRIMARY KEY (id);


--
-- TOC entry 6066 (class 2606 OID 27517)
-- Name: bc_investments bc_investments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_investments
    ADD CONSTRAINT bc_investments_pkey PRIMARY KEY (id);


--
-- TOC entry 6070 (class 2606 OID 27567)
-- Name: bc_lab_environment bc_lab_environment_business_case_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lab_environment
    ADD CONSTRAINT bc_lab_environment_business_case_id_key UNIQUE (business_case_id);


--
-- TOC entry 6072 (class 2606 OID 27565)
-- Name: bc_lab_environment bc_lab_environment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lab_environment
    ADD CONSTRAINT bc_lab_environment_pkey PRIMARY KEY (id);


--
-- TOC entry 6117 (class 2606 OID 28326)
-- Name: bc_lis_data bc_lis_data_bc_master_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lis_data
    ADD CONSTRAINT bc_lis_data_bc_master_id_key UNIQUE (bc_master_id);


--
-- TOC entry 6119 (class 2606 OID 28324)
-- Name: bc_lis_data bc_lis_data_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lis_data
    ADD CONSTRAINT bc_lis_data_pkey PRIMARY KEY (id);


--
-- TOC entry 6085 (class 2606 OID 27635)
-- Name: bc_lis_equipment_interfaces bc_lis_equipment_interfaces_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lis_equipment_interfaces
    ADD CONSTRAINT bc_lis_equipment_interfaces_pkey PRIMARY KEY (id);


--
-- TOC entry 6080 (class 2606 OID 27618)
-- Name: bc_lis_integration bc_lis_integration_business_case_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lis_integration
    ADD CONSTRAINT bc_lis_integration_business_case_id_key UNIQUE (business_case_id);


--
-- TOC entry 6082 (class 2606 OID 27616)
-- Name: bc_lis_integration bc_lis_integration_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lis_integration
    ADD CONSTRAINT bc_lis_integration_pkey PRIMARY KEY (id);


--
-- TOC entry 6099 (class 2606 OID 28237)
-- Name: bc_master bc_master_bc_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_master
    ADD CONSTRAINT bc_master_bc_number_key UNIQUE (bc_number);


--
-- TOC entry 6101 (class 2606 OID 28235)
-- Name: bc_master bc_master_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_master
    ADD CONSTRAINT bc_master_pkey PRIMARY KEY (id);


--
-- TOC entry 6112 (class 2606 OID 28301)
-- Name: bc_operational_data bc_operational_data_bc_master_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_operational_data
    ADD CONSTRAINT bc_operational_data_bc_master_id_key UNIQUE (bc_master_id);


--
-- TOC entry 6114 (class 2606 OID 28299)
-- Name: bc_operational_data bc_operational_data_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_operational_data
    ADD CONSTRAINT bc_operational_data_pkey PRIMARY KEY (id);


--
-- TOC entry 6089 (class 2606 OID 27655)
-- Name: bc_requirements bc_requirements_business_case_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_requirements
    ADD CONSTRAINT bc_requirements_business_case_id_key UNIQUE (business_case_id);


--
-- TOC entry 6091 (class 2606 OID 27653)
-- Name: bc_requirements bc_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_requirements
    ADD CONSTRAINT bc_requirements_pkey PRIMARY KEY (id);


--
-- TOC entry 6125 (class 2606 OID 28362)
-- Name: bc_validations bc_validations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_validations
    ADD CONSTRAINT bc_validations_pkey PRIMARY KEY (id);


--
-- TOC entry 6122 (class 2606 OID 28343)
-- Name: bc_workflow_history bc_workflow_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_workflow_history
    ADD CONSTRAINT bc_workflow_history_pkey PRIMARY KEY (id);


--
-- TOC entry 6032 (class 2606 OID 27066)
-- Name: calculation_templates calculation_templates_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calculation_templates
    ADD CONSTRAINT calculation_templates_name_key UNIQUE (name);


--
-- TOC entry 6034 (class 2606 OID 27064)
-- Name: calculation_templates calculation_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calculation_templates
    ADD CONSTRAINT calculation_templates_pkey PRIMARY KEY (id);


--
-- TOC entry 5936 (class 2606 OID 26112)
-- Name: catalog_consumables catalog_consumables_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_consumables
    ADD CONSTRAINT catalog_consumables_pkey PRIMARY KEY (id);


--
-- TOC entry 5929 (class 2606 OID 26079)
-- Name: catalog_determinations catalog_determinations_name_roche_code_version_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_determinations
    ADD CONSTRAINT catalog_determinations_name_roche_code_version_key UNIQUE (name, roche_code, version);


--
-- TOC entry 5931 (class 2606 OID 26077)
-- Name: catalog_determinations catalog_determinations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_determinations
    ADD CONSTRAINT catalog_determinations_pkey PRIMARY KEY (id);


--
-- TOC entry 5941 (class 2606 OID 26290)
-- Name: catalog_equipment_consumables catalog_equipment_consumables_equipment_id_consumable_id_de_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_equipment_consumables
    ADD CONSTRAINT catalog_equipment_consumables_equipment_id_consumable_id_de_key UNIQUE (equipment_id, consumable_id, determination_id);


--
-- TOC entry 5943 (class 2606 OID 26131)
-- Name: catalog_equipment_consumables catalog_equipment_consumables_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_equipment_consumables
    ADD CONSTRAINT catalog_equipment_consumables_pkey PRIMARY KEY (id);


--
-- TOC entry 5965 (class 2606 OID 26263)
-- Name: catalog_investments catalog_investments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_investments
    ADD CONSTRAINT catalog_investments_pkey PRIMARY KEY (id);


--
-- TOC entry 5686 (class 2606 OID 16619)
-- Name: inventory_movements chk_inventory_movements_type; Type: CHECK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE public.inventory_movements
    ADD CONSTRAINT chk_inventory_movements_type CHECK ((type = ANY (ARRAY['in'::text, 'out'::text]))) NOT VALID;


--
-- TOC entry 5688 (class 2606 OID 16620)
-- Name: request_approvals chk_request_approvals_action; Type: CHECK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE public.request_approvals
    ADD CONSTRAINT chk_request_approvals_action CHECK (((action IS NULL) OR (action = ANY (ARRAY['approve'::text, 'reject'::text])))) NOT VALID;


--
-- TOC entry 5921 (class 2606 OID 25728)
-- Name: client_assignments client_assignments_client_request_id_assigned_to_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_assignments
    ADD CONSTRAINT client_assignments_client_request_id_assigned_to_email_key UNIQUE (client_request_id, assigned_to_email);


--
-- TOC entry 5923 (class 2606 OID 25726)
-- Name: client_assignments client_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_assignments
    ADD CONSTRAINT client_assignments_pkey PRIMARY KEY (id);


--
-- TOC entry 5868 (class 2606 OID 17146)
-- Name: client_request_consent_tokens client_request_consent_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_request_consent_tokens
    ADD CONSTRAINT client_request_consent_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 5866 (class 2606 OID 17124)
-- Name: client_request_consents client_request_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_request_consents
    ADD CONSTRAINT client_request_consents_pkey PRIMARY KEY (id);


--
-- TOC entry 5857 (class 2606 OID 17104)
-- Name: client_requests client_requests_lopdp_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_requests
    ADD CONSTRAINT client_requests_lopdp_token_key UNIQUE (lopdp_token);


--
-- TOC entry 5859 (class 2606 OID 17102)
-- Name: client_requests client_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_requests
    ADD CONSTRAINT client_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 5861 (class 2606 OID 17106)
-- Name: client_requests client_requests_ruc_cedula_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_requests
    ADD CONSTRAINT client_requests_ruc_cedula_key UNIQUE (ruc_cedula);


--
-- TOC entry 5925 (class 2606 OID 25752)
-- Name: client_visit_logs client_visit_logs_client_request_id_user_email_visit_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_visit_logs
    ADD CONSTRAINT client_visit_logs_client_request_id_user_email_visit_date_key UNIQUE (client_request_id, user_email, visit_date);


--
-- TOC entry 5927 (class 2606 OID 25750)
-- Name: client_visit_logs client_visit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_visit_logs
    ADD CONSTRAINT client_visit_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 5879 (class 2606 OID 17260)
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- TOC entry 5881 (class 2606 OID 17262)
-- Name: clients clients_ruc_hash_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_ruc_hash_key UNIQUE (ruc_hash);


--
-- TOC entry 5947 (class 2606 OID 26170)
-- Name: contract_determinations contract_determinations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_determinations
    ADD CONSTRAINT contract_determinations_pkey PRIMARY KEY (id);


--
-- TOC entry 5847 (class 2606 OID 16973)
-- Name: departments departments_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_code_key UNIQUE (code);


--
-- TOC entry 5849 (class 2606 OID 16971)
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- TOC entry 5953 (class 2606 OID 26203)
-- Name: determination_consumption_log determination_consumption_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.determination_consumption_log
    ADD CONSTRAINT determination_consumption_log_pkey PRIMARY KEY (id);


--
-- TOC entry 5780 (class 2606 OID 16622)
-- Name: document_signatures document_signatures_document_id_signer_user_id_role_at_sign_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_signatures
    ADD CONSTRAINT document_signatures_document_id_signer_user_id_role_at_sign_key UNIQUE (document_id, signer_user_id, role_at_sign);


--
-- TOC entry 5782 (class 2606 OID 16624)
-- Name: document_signatures document_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_signatures
    ADD CONSTRAINT document_signatures_pkey PRIMARY KEY (id);


--
-- TOC entry 5784 (class 2606 OID 16626)
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- TOC entry 5787 (class 2606 OID 16628)
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- TOC entry 6022 (class 2606 OID 26984)
-- Name: equipment_price_history equipment_price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipment_price_history
    ADD CONSTRAINT equipment_price_history_pkey PRIMARY KEY (id);


--
-- TOC entry 5913 (class 2606 OID 17477)
-- Name: equipment_purchase_bc_items equipment_purchase_bc_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipment_purchase_bc_items
    ADD CONSTRAINT equipment_purchase_bc_items_pkey PRIMARY KEY (id);


--
-- TOC entry 5895 (class 2606 OID 17334)
-- Name: equipment_purchase_requests equipment_purchase_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipment_purchase_requests
    ADD CONSTRAINT equipment_purchase_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 6059 (class 2606 OID 27322)
-- Name: equipos_historial equipos_historial_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_historial
    ADD CONSTRAINT equipos_historial_pkey PRIMARY KEY (id);


--
-- TOC entry 6051 (class 2606 OID 27284)
-- Name: equipos_modelo equipos_modelo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_modelo
    ADD CONSTRAINT equipos_modelo_pkey PRIMARY KEY (id);


--
-- TOC entry 6053 (class 2606 OID 27286)
-- Name: equipos_modelo equipos_modelo_sku_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_modelo
    ADD CONSTRAINT equipos_modelo_sku_key UNIQUE (sku);


--
-- TOC entry 6049 (class 2606 OID 27261)
-- Name: equipos_movimientos equipos_movimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_movimientos
    ADD CONSTRAINT equipos_movimientos_pkey PRIMARY KEY (id);


--
-- TOC entry 6045 (class 2606 OID 27241)
-- Name: equipos equipos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_pkey PRIMARY KEY (id);


--
-- TOC entry 6047 (class 2606 OID 27243)
-- Name: equipos equipos_sku_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_sku_key UNIQUE (sku);


--
-- TOC entry 6055 (class 2606 OID 27303)
-- Name: equipos_unidad equipos_unidad_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_unidad
    ADD CONSTRAINT equipos_unidad_pkey PRIMARY KEY (id);


--
-- TOC entry 6057 (class 2606 OID 27305)
-- Name: equipos_unidad equipos_unidad_serial_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_unidad
    ADD CONSTRAINT equipos_unidad_serial_key UNIQUE (serial);


--
-- TOC entry 5794 (class 2606 OID 16630)
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- TOC entry 5789 (class 2606 OID 16632)
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- TOC entry 5791 (class 2606 OID 16634)
-- Name: inventory inventory_sku_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_sku_key UNIQUE (sku);


--
-- TOC entry 6003 (class 2606 OID 26501)
-- Name: permisos_vacaciones permisos_vacaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos_vacaciones
    ADD CONSTRAINT permisos_vacaciones_pkey PRIMARY KEY (id);


--
-- TOC entry 5911 (class 2606 OID 17443)
-- Name: personnel_request_comments personnel_request_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_request_comments
    ADD CONSTRAINT personnel_request_comments_pkey PRIMARY KEY (id);


--
-- TOC entry 5908 (class 2606 OID 17418)
-- Name: personnel_request_history personnel_request_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_request_history
    ADD CONSTRAINT personnel_request_history_pkey PRIMARY KEY (id);


--
-- TOC entry 5903 (class 2606 OID 17378)
-- Name: personnel_requests personnel_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_requests
    ADD CONSTRAINT personnel_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 5905 (class 2606 OID 17380)
-- Name: personnel_requests personnel_requests_request_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_requests
    ADD CONSTRAINT personnel_requests_request_number_key UNIQUE (request_number);


--
-- TOC entry 5797 (class 2606 OID 16636)
-- Name: request_approvals request_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_approvals
    ADD CONSTRAINT request_approvals_pkey PRIMARY KEY (id);


--
-- TOC entry 5799 (class 2606 OID 16638)
-- Name: request_approvals request_approvals_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_approvals
    ADD CONSTRAINT request_approvals_token_key UNIQUE (token);


--
-- TOC entry 5802 (class 2606 OID 16640)
-- Name: request_attachments request_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_attachments
    ADD CONSTRAINT request_attachments_pkey PRIMARY KEY (id);


--
-- TOC entry 5805 (class 2606 OID 16642)
-- Name: request_status_history request_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_status_history
    ADD CONSTRAINT request_status_history_pkey PRIMARY KEY (id);


--
-- TOC entry 5808 (class 2606 OID 16644)
-- Name: request_types request_types_code_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_types
    ADD CONSTRAINT request_types_code_unique UNIQUE (code);


--
-- TOC entry 5810 (class 2606 OID 16646)
-- Name: request_types request_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_types
    ADD CONSTRAINT request_types_pkey PRIMARY KEY (id);


--
-- TOC entry 5812 (class 2606 OID 16648)
-- Name: request_versions request_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_versions
    ADD CONSTRAINT request_versions_pkey PRIMARY KEY (id);


--
-- TOC entry 5818 (class 2606 OID 16650)
-- Name: requests requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_pkey PRIMARY KEY (id);


--
-- TOC entry 5987 (class 2606 OID 26405)
-- Name: scheduled_visits scheduled_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scheduled_visits
    ADD CONSTRAINT scheduled_visits_pkey PRIMARY KEY (id);


--
-- TOC entry 5989 (class 2606 OID 26407)
-- Name: scheduled_visits scheduled_visits_schedule_id_client_request_id_planned_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scheduled_visits
    ADD CONSTRAINT scheduled_visits_schedule_id_client_request_id_planned_date_key UNIQUE (schedule_id, client_request_id, planned_date);


--
-- TOC entry 5974 (class 2606 OID 26335)
-- Name: technical_documents technical_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.technical_documents
    ADD CONSTRAINT technical_documents_pkey PRIMARY KEY (id);


--
-- TOC entry 5997 (class 2606 OID 26459)
-- Name: travel_segments travel_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.travel_segments
    ADD CONSTRAINT travel_segments_pkey PRIMARY KEY (id);


--
-- TOC entry 5886 (class 2606 OID 17264)
-- Name: clients unique_client_request; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT unique_client_request UNIQUE (client_request_id);


--
-- TOC entry 5875 (class 2606 OID 17184)
-- Name: user_attendance_records unique_user_date; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_attendance_records
    ADD CONSTRAINT unique_user_date UNIQUE (user_id, date);


--
-- TOC entry 5877 (class 2606 OID 17182)
-- Name: user_attendance_records user_attendance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_attendance_records
    ADD CONSTRAINT user_attendance_records_pkey PRIMARY KEY (id);


--
-- TOC entry 5890 (class 2606 OID 17311)
-- Name: user_gmail_tokens user_gmail_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_gmail_tokens
    ADD CONSTRAINT user_gmail_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 5892 (class 2606 OID 17313)
-- Name: user_gmail_tokens user_gmail_tokens_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_gmail_tokens
    ADD CONSTRAINT user_gmail_tokens_user_id_key UNIQUE (user_id);


--
-- TOC entry 5870 (class 2606 OID 17166)
-- Name: user_lopdp_consents user_lopdp_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_lopdp_consents
    ADD CONSTRAINT user_lopdp_consents_pkey PRIMARY KEY (id);


--
-- TOC entry 5845 (class 2606 OID 16957)
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 5820 (class 2606 OID 16652)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 5822 (class 2606 OID 16654)
-- Name: users users_google_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_google_id_key UNIQUE (google_id);


--
-- TOC entry 5824 (class 2606 OID 16656)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 5919 (class 2606 OID 25713)
-- Name: vacaciones_solicitudes vacaciones_solicitudes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vacaciones_solicitudes
    ADD CONSTRAINT vacaciones_solicitudes_pkey PRIMARY KEY (id);


--
-- TOC entry 5980 (class 2606 OID 26386)
-- Name: visit_schedules visit_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.visit_schedules
    ADD CONSTRAINT visit_schedules_pkey PRIMARY KEY (id);


--
-- TOC entry 5982 (class 2606 OID 26388)
-- Name: visit_schedules visit_schedules_user_email_month_year_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.visit_schedules
    ADD CONSTRAINT visit_schedules_user_email_month_year_key UNIQUE (user_email, month, year);


--
-- TOC entry 5976 (class 2606 OID 26363)
-- Name: aplicaciones_tecnicas aplicaciones_tecnicas_pkey; Type: CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.aplicaciones_tecnicas
    ADD CONSTRAINT aplicaciones_tecnicas_pkey PRIMARY KEY (id);


--
-- TOC entry 5826 (class 2606 OID 16658)
-- Name: cronograma_capacitacion cronograma_capacitacion_pkey; Type: CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_capacitacion
    ADD CONSTRAINT cronograma_capacitacion_pkey PRIMARY KEY (id_capacitacion);


--
-- TOC entry 5834 (class 2606 OID 16660)
-- Name: cronograma_mantenimientos_anuales cronograma_mantenimientos_anuales_pkey; Type: CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos_anuales
    ADD CONSTRAINT cronograma_mantenimientos_anuales_pkey PRIMARY KEY (id_mant_anual);


--
-- TOC entry 5828 (class 2606 OID 17052)
-- Name: cronograma_mantenimientos cronograma_mantenimientos_id_unique; Type: CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos
    ADD CONSTRAINT cronograma_mantenimientos_id_unique UNIQUE (id);


--
-- TOC entry 5830 (class 2606 OID 16662)
-- Name: cronograma_mantenimientos cronograma_mantenimientos_pkey; Type: CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos
    ADD CONSTRAINT cronograma_mantenimientos_pkey PRIMARY KEY (id_mantenimiento);


--
-- TOC entry 5915 (class 2606 OID 25688)
-- Name: disponibilidad_tecnicos disponibilidad_tecnicos_pkey; Type: CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.disponibilidad_tecnicos
    ADD CONSTRAINT disponibilidad_tecnicos_pkey PRIMARY KEY (id);


--
-- TOC entry 5917 (class 2606 OID 25690)
-- Name: disponibilidad_tecnicos disponibilidad_tecnicos_user_id_key; Type: CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.disponibilidad_tecnicos
    ADD CONSTRAINT disponibilidad_tecnicos_user_id_key UNIQUE (user_id);


--
-- TOC entry 5836 (class 2606 OID 16664)
-- Name: equipos equipos_nombre_key; Type: CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.equipos
    ADD CONSTRAINT equipos_nombre_key UNIQUE (nombre);


--
-- TOC entry 5838 (class 2606 OID 16666)
-- Name: equipos equipos_pkey; Type: CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.equipos
    ADD CONSTRAINT equipos_pkey PRIMARY KEY (id_equipo);


--
-- TOC entry 5843 (class 2606 OID 26881)
-- Name: equipos servicio_equipos_code_unique; Type: CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.equipos
    ADD CONSTRAINT servicio_equipos_code_unique UNIQUE (code);


--
-- TOC entry 5850 (class 1259 OID 16999)
-- Name: idx_auditoria_accion; Type: INDEX; Schema: auditoria; Owner: postgres
--

CREATE INDEX idx_auditoria_accion ON auditoria.logs USING btree (accion);


--
-- TOC entry 5851 (class 1259 OID 16996)
-- Name: idx_auditoria_fecha; Type: INDEX; Schema: auditoria; Owner: postgres
--

CREATE INDEX idx_auditoria_fecha ON auditoria.logs USING btree (fecha DESC);


--
-- TOC entry 5852 (class 1259 OID 16998)
-- Name: idx_auditoria_modulo; Type: INDEX; Schema: auditoria; Owner: postgres
--

CREATE INDEX idx_auditoria_modulo ON auditoria.logs USING btree (modulo);


--
-- TOC entry 5853 (class 1259 OID 16997)
-- Name: idx_auditoria_usuario; Type: INDEX; Schema: auditoria; Owner: postgres
--

CREATE INDEX idx_auditoria_usuario ON auditoria.logs USING btree (usuario_email);


--
-- TOC entry 6014 (class 1259 OID 27526)
-- Name: bc_calculations_business_case_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bc_calculations_business_case_id_idx ON public.bc_calculations USING btree (business_case_id);


--
-- TOC entry 6017 (class 1259 OID 27527)
-- Name: bc_calculations_calculated_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bc_calculations_calculated_at_idx ON public.bc_calculations USING btree (calculated_at DESC);


--
-- TOC entry 6006 (class 1259 OID 27497)
-- Name: bc_determinations_business_case_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bc_determinations_business_case_id_idx ON public.bc_determinations USING btree (business_case_id);


--
-- TOC entry 6007 (class 1259 OID 27498)
-- Name: bc_determinations_determination_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bc_determinations_determination_id_idx ON public.bc_determinations USING btree (determination_id);


--
-- TOC entry 6010 (class 1259 OID 27499)
-- Name: bc_determinations_unique_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX bc_determinations_unique_idx ON public.bc_determinations USING btree (business_case_id, determination_id);


--
-- TOC entry 6039 (class 1259 OID 27494)
-- Name: bc_equipment_selection_business_case_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bc_equipment_selection_business_case_id_idx ON public.bc_equipment_selection USING btree (business_case_id);


--
-- TOC entry 6040 (class 1259 OID 27495)
-- Name: bc_equipment_selection_equipment_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bc_equipment_selection_equipment_id_idx ON public.bc_equipment_selection USING btree (equipment_id);


--
-- TOC entry 6043 (class 1259 OID 27493)
-- Name: bc_equipment_selection_primary_unique_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX bc_equipment_selection_primary_unique_idx ON public.bc_equipment_selection USING btree (business_case_id) WHERE (is_primary = true);


--
-- TOC entry 6062 (class 1259 OID 27523)
-- Name: bc_investments_business_case_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bc_investments_business_case_id_idx ON public.bc_investments USING btree (business_case_id);


--
-- TOC entry 6063 (class 1259 OID 27525)
-- Name: bc_investments_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bc_investments_category_idx ON public.bc_investments USING btree (category);


--
-- TOC entry 6064 (class 1259 OID 27524)
-- Name: bc_investments_investment_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bc_investments_investment_type_idx ON public.bc_investments USING btree (investment_type);


--
-- TOC entry 5893 (class 1259 OID 27460)
-- Name: equipment_purchase_requests_bc_purchase_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX equipment_purchase_requests_bc_purchase_type_idx ON public.equipment_purchase_requests USING btree (bc_purchase_type);


--
-- TOC entry 5871 (class 1259 OID 17191)
-- Name: idx_attendance_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendance_date ON public.user_attendance_records USING btree (date DESC);


--
-- TOC entry 5872 (class 1259 OID 17192)
-- Name: idx_attendance_incomplete; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendance_incomplete ON public.user_attendance_records USING btree (user_id, date) WHERE (exit_time IS NULL);


--
-- TOC entry 5873 (class 1259 OID 17190)
-- Name: idx_attendance_user_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendance_user_date ON public.user_attendance_records USING btree (user_id, date DESC);


--
-- TOC entry 5776 (class 1259 OID 16826)
-- Name: idx_audit_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_created_at ON public.audit_trail USING btree (created_at DESC);


--
-- TOC entry 5777 (class 1259 OID 16825)
-- Name: idx_audit_module_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_module_action ON public.audit_trail USING btree (module, action);


--
-- TOC entry 5778 (class 1259 OID 16827)
-- Name: idx_audit_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_user ON public.audit_trail USING btree (user_id);


--
-- TOC entry 5959 (class 1259 OID 26244)
-- Name: idx_bc_alerts_acknowledged; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_alerts_acknowledged ON public.bc_alerts USING btree (acknowledged);


--
-- TOC entry 5960 (class 1259 OID 26240)
-- Name: idx_bc_alerts_bc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_alerts_bc ON public.bc_alerts USING btree (business_case_id);


--
-- TOC entry 5961 (class 1259 OID 26241)
-- Name: idx_bc_alerts_contract; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_alerts_contract ON public.bc_alerts USING btree (contract_determination_id);


--
-- TOC entry 5962 (class 1259 OID 26243)
-- Name: idx_bc_alerts_severity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_alerts_severity ON public.bc_alerts USING btree (severity);


--
-- TOC entry 5963 (class 1259 OID 26242)
-- Name: idx_bc_alerts_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_alerts_type ON public.bc_alerts USING btree (alert_type);


--
-- TOC entry 6028 (class 1259 OID 27027)
-- Name: idx_bc_audit_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_audit_action ON public.bc_audit_log USING btree (action);


--
-- TOC entry 6029 (class 1259 OID 27026)
-- Name: idx_bc_audit_bc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_audit_bc ON public.bc_audit_log USING btree (business_case_id);


--
-- TOC entry 6030 (class 1259 OID 27028)
-- Name: idx_bc_audit_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_audit_date ON public.bc_audit_log USING btree (changed_at);


--
-- TOC entry 6020 (class 1259 OID 26968)
-- Name: idx_bc_calculations_bc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_calculations_bc ON public.bc_calculations USING btree (business_case_id);


--
-- TOC entry 6097 (class 1259 OID 27686)
-- Name: idx_bc_deliveries_bc_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_deliveries_bc_id ON public.bc_deliveries USING btree (business_case_id);


--
-- TOC entry 6011 (class 1259 OID 26940)
-- Name: idx_bc_determinations_bc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_determinations_bc ON public.bc_determinations USING btree (business_case_id);


--
-- TOC entry 6012 (class 1259 OID 26941)
-- Name: idx_bc_determinations_det; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_determinations_det ON public.bc_determinations USING btree (determination_id);


--
-- TOC entry 6013 (class 1259 OID 28265)
-- Name: idx_bc_determinations_master; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_determinations_master ON public.bc_determinations USING btree (bc_master_id);


--
-- TOC entry 6110 (class 1259 OID 28377)
-- Name: idx_bc_economic_data_master; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_economic_data_master ON public.bc_economic_data USING btree (bc_master_id);


--
-- TOC entry 6078 (class 1259 OID 27682)
-- Name: idx_bc_equipment_details_bc_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_equipment_details_bc_id ON public.bc_equipment_details USING btree (business_case_id);


--
-- TOC entry 6067 (class 1259 OID 28393)
-- Name: idx_bc_investments_bc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_investments_bc ON public.bc_investments USING btree (business_case_id);


--
-- TOC entry 6068 (class 1259 OID 28271)
-- Name: idx_bc_investments_master; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_investments_master ON public.bc_investments USING btree (bc_master_id);


--
-- TOC entry 6073 (class 1259 OID 27681)
-- Name: idx_bc_lab_environment_bc_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_lab_environment_bc_id ON public.bc_lab_environment USING btree (business_case_id);


--
-- TOC entry 6120 (class 1259 OID 28379)
-- Name: idx_bc_lis_data_master; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_lis_data_master ON public.bc_lis_data USING btree (bc_master_id);


--
-- TOC entry 6086 (class 1259 OID 27684)
-- Name: idx_bc_lis_equipment_interfaces_lis_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_lis_equipment_interfaces_lis_id ON public.bc_lis_equipment_interfaces USING btree (bc_lis_data_id);


--
-- TOC entry 6083 (class 1259 OID 27683)
-- Name: idx_bc_lis_integration_bc_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_lis_integration_bc_id ON public.bc_lis_integration USING btree (business_case_id);


--
-- TOC entry 6087 (class 1259 OID 28382)
-- Name: idx_bc_lis_interfaces_lis; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_lis_interfaces_lis ON public.bc_lis_equipment_interfaces USING btree (bc_lis_data_id);


--
-- TOC entry 6102 (class 1259 OID 28374)
-- Name: idx_bc_master_client; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_master_client ON public.bc_master USING btree (client_id);


--
-- TOC entry 6103 (class 1259 OID 28376)
-- Name: idx_bc_master_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_master_created ON public.bc_master USING btree (created_at DESC);


--
-- TOC entry 6104 (class 1259 OID 28373)
-- Name: idx_bc_master_stage; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_master_stage ON public.bc_master USING btree (current_stage);


--
-- TOC entry 6105 (class 1259 OID 28375)
-- Name: idx_bc_master_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_master_type ON public.bc_master USING btree (bc_type);


--
-- TOC entry 6115 (class 1259 OID 28378)
-- Name: idx_bc_operational_data_master; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_operational_data_master ON public.bc_operational_data USING btree (bc_master_id);


--
-- TOC entry 6092 (class 1259 OID 27685)
-- Name: idx_bc_requirements_bc_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_requirements_bc_id ON public.bc_requirements USING btree (business_case_id);


--
-- TOC entry 6126 (class 1259 OID 28381)
-- Name: idx_bc_validations_master; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_validations_master ON public.bc_validations USING btree (bc_master_id, severity);


--
-- TOC entry 6123 (class 1259 OID 28380)
-- Name: idx_bc_workflow_history_master; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_workflow_history_master ON public.bc_workflow_history USING btree (bc_master_id, changed_at DESC);


--
-- TOC entry 6035 (class 1259 OID 27073)
-- Name: idx_calc_templates_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_calc_templates_active ON public.calculation_templates USING btree (is_active) WHERE (is_active = true);


--
-- TOC entry 6036 (class 1259 OID 27072)
-- Name: idx_calc_templates_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_calc_templates_category ON public.calculation_templates USING btree (category);


--
-- TOC entry 5937 (class 1259 OID 26120)
-- Name: idx_catalog_consumables_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_catalog_consumables_name ON public.catalog_consumables USING btree (name);


--
-- TOC entry 5938 (class 1259 OID 26118)
-- Name: idx_catalog_consumables_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_catalog_consumables_status ON public.catalog_consumables USING btree (status);


--
-- TOC entry 5939 (class 1259 OID 26119)
-- Name: idx_catalog_consumables_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_catalog_consumables_type ON public.catalog_consumables USING btree (type);


--
-- TOC entry 5932 (class 1259 OID 26283)
-- Name: idx_catalog_determinations_equipment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_catalog_determinations_equipment ON public.catalog_determinations USING btree (equipment_id);


--
-- TOC entry 5933 (class 1259 OID 26092)
-- Name: idx_catalog_determinations_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_catalog_determinations_name ON public.catalog_determinations USING btree (name);


--
-- TOC entry 5934 (class 1259 OID 26090)
-- Name: idx_catalog_determinations_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_catalog_determinations_status ON public.catalog_determinations USING btree (status);


--
-- TOC entry 5966 (class 1259 OID 26264)
-- Name: idx_catalog_inv_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_catalog_inv_category ON public.catalog_investments USING btree (category);


--
-- TOC entry 5967 (class 1259 OID 26265)
-- Name: idx_catalog_inv_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_catalog_inv_status ON public.catalog_investments USING btree (status);


--
-- TOC entry 5862 (class 1259 OID 17294)
-- Name: idx_client_requests_approval_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_client_requests_approval_status ON public.client_requests USING btree (approval_status);


--
-- TOC entry 5863 (class 1259 OID 17296)
-- Name: idx_client_requests_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_client_requests_created_by ON public.client_requests USING btree (created_by);


--
-- TOC entry 5864 (class 1259 OID 17295)
-- Name: idx_client_requests_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_client_requests_user_id ON public.client_requests USING btree (user_id);


--
-- TOC entry 5882 (class 1259 OID 17293)
-- Name: idx_clients_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clients_created_at ON public.clients USING btree (created_at DESC);


--
-- TOC entry 5883 (class 1259 OID 17291)
-- Name: idx_clients_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clients_estado ON public.clients USING btree (estado);


--
-- TOC entry 5884 (class 1259 OID 17292)
-- Name: idx_clients_ruc_hash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clients_ruc_hash ON public.clients USING btree (ruc_hash);


--
-- TOC entry 5954 (class 1259 OID 26209)
-- Name: idx_consumption_log_contract; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_consumption_log_contract ON public.determination_consumption_log USING btree (contract_determination_id);


--
-- TOC entry 5955 (class 1259 OID 26210)
-- Name: idx_consumption_log_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_consumption_log_date ON public.determination_consumption_log USING btree (consumption_date);


--
-- TOC entry 5956 (class 1259 OID 26211)
-- Name: idx_consumption_log_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_consumption_log_user ON public.determination_consumption_log USING btree (consumed_by_user_id);


--
-- TOC entry 5948 (class 1259 OID 26181)
-- Name: idx_contract_det_bc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contract_det_bc ON public.contract_determinations USING btree (business_case_id);


--
-- TOC entry 5949 (class 1259 OID 26182)
-- Name: idx_contract_det_client; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contract_det_client ON public.contract_determinations USING btree (client_id);


--
-- TOC entry 5950 (class 1259 OID 26183)
-- Name: idx_contract_det_determination; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contract_det_determination ON public.contract_determinations USING btree (determination_id);


--
-- TOC entry 5951 (class 1259 OID 26184)
-- Name: idx_contract_det_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contract_det_status ON public.contract_determinations USING btree (status);


--
-- TOC entry 5785 (class 1259 OID 16667)
-- Name: idx_documents_request_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_request_id ON public.documents USING btree (request_id);


--
-- TOC entry 5944 (class 1259 OID 26150)
-- Name: idx_eq_cons_determination; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_eq_cons_determination ON public.catalog_equipment_consumables USING btree (determination_id);


--
-- TOC entry 5945 (class 1259 OID 26291)
-- Name: idx_eq_cons_equipment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_eq_cons_equipment ON public.catalog_equipment_consumables USING btree (equipment_id);


--
-- TOC entry 5896 (class 1259 OID 27086)
-- Name: idx_equipment_purchase_requests_modern; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_equipment_purchase_requests_modern ON public.equipment_purchase_requests USING btree (uses_modern_system) WHERE (uses_modern_system = true);


--
-- TOC entry 5897 (class 1259 OID 27085)
-- Name: idx_equipment_purchase_requests_system_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_equipment_purchase_requests_system_type ON public.equipment_purchase_requests USING btree (bc_system_type) WHERE ((bc_system_type)::text = 'modern'::text);


--
-- TOC entry 5792 (class 1259 OID 16668)
-- Name: idx_inventory_movements_inventory; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_movements_inventory ON public.inventory_movements USING btree (inventory_id);


--
-- TOC entry 5992 (class 1259 OID 26477)
-- Name: idx_location_history_activity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_location_history_activity ON public.advisor_location_history USING btree (activity_type);


--
-- TOC entry 5993 (class 1259 OID 26476)
-- Name: idx_location_history_client; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_location_history_client ON public.advisor_location_history USING btree (client_request_id);


--
-- TOC entry 5994 (class 1259 OID 26475)
-- Name: idx_location_history_user_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_location_history_user_time ON public.advisor_location_history USING btree (user_email, "timestamp" DESC);


--
-- TOC entry 5998 (class 1259 OID 26505)
-- Name: idx_permisos_approver; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_permisos_approver ON public.permisos_vacaciones USING btree (approver_role);


--
-- TOC entry 5999 (class 1259 OID 26503)
-- Name: idx_permisos_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_permisos_status ON public.permisos_vacaciones USING btree (status);


--
-- TOC entry 6000 (class 1259 OID 26504)
-- Name: idx_permisos_tipo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_permisos_tipo ON public.permisos_vacaciones USING btree (tipo_solicitud);


--
-- TOC entry 6001 (class 1259 OID 26502)
-- Name: idx_permisos_user_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_permisos_user_email ON public.permisos_vacaciones USING btree (user_email);


--
-- TOC entry 5909 (class 1259 OID 17459)
-- Name: idx_personnel_request_comments_request; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_personnel_request_comments_request ON public.personnel_request_comments USING btree (personnel_request_id);


--
-- TOC entry 5906 (class 1259 OID 17458)
-- Name: idx_personnel_request_history_request; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_personnel_request_history_request ON public.personnel_request_history USING btree (personnel_request_id);


--
-- TOC entry 5898 (class 1259 OID 17457)
-- Name: idx_personnel_requests_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_personnel_requests_created_at ON public.personnel_requests USING btree (created_at DESC);


--
-- TOC entry 5899 (class 1259 OID 17455)
-- Name: idx_personnel_requests_department; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_personnel_requests_department ON public.personnel_requests USING btree (department_id);


--
-- TOC entry 5900 (class 1259 OID 17454)
-- Name: idx_personnel_requests_requester; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_personnel_requests_requester ON public.personnel_requests USING btree (requester_id);


--
-- TOC entry 5901 (class 1259 OID 17456)
-- Name: idx_personnel_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_personnel_requests_status ON public.personnel_requests USING btree (status);


--
-- TOC entry 6023 (class 1259 OID 27006)
-- Name: idx_price_history_consumable; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_price_history_consumable ON public.equipment_price_history USING btree (consumable_id) WHERE (consumable_id IS NOT NULL);


--
-- TOC entry 6024 (class 1259 OID 27007)
-- Name: idx_price_history_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_price_history_dates ON public.equipment_price_history USING btree (effective_from, effective_to);


--
-- TOC entry 6025 (class 1259 OID 27005)
-- Name: idx_price_history_equipment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_price_history_equipment ON public.equipment_price_history USING btree (equipment_id) WHERE (equipment_id IS NOT NULL);


--
-- TOC entry 5795 (class 1259 OID 16669)
-- Name: idx_request_approvals_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_request_approvals_pending ON public.request_approvals USING btree (used, token_expires_at);


--
-- TOC entry 5800 (class 1259 OID 16670)
-- Name: idx_request_attachments_request; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_request_attachments_request ON public.request_attachments USING btree (request_id);


--
-- TOC entry 5806 (class 1259 OID 16671)
-- Name: idx_request_types_schema_gin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_request_types_schema_gin ON public.request_types USING gin (schema);


--
-- TOC entry 5814 (class 1259 OID 16672)
-- Name: idx_requests_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requests_created_at ON public.requests USING btree (created_at);


--
-- TOC entry 5815 (class 1259 OID 16673)
-- Name: idx_requests_payload_gin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requests_payload_gin ON public.requests USING gin (payload);


--
-- TOC entry 5816 (class 1259 OID 16674)
-- Name: idx_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requests_status ON public.requests USING btree (status);


--
-- TOC entry 5803 (class 1259 OID 16675)
-- Name: idx_rsh_request_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsh_request_id ON public.request_status_history USING btree (request_id);


--
-- TOC entry 5983 (class 1259 OID 26474)
-- Name: idx_scheduled_visits_city; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scheduled_visits_city ON public.scheduled_visits USING btree (city);


--
-- TOC entry 5984 (class 1259 OID 26473)
-- Name: idx_scheduled_visits_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scheduled_visits_date ON public.scheduled_visits USING btree (planned_date);


--
-- TOC entry 5985 (class 1259 OID 26472)
-- Name: idx_scheduled_visits_schedule; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scheduled_visits_schedule ON public.scheduled_visits USING btree (schedule_id);


--
-- TOC entry 5968 (class 1259 OID 26343)
-- Name: idx_tech_docs_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tech_docs_created ON public.technical_documents USING btree (created_at DESC);


--
-- TOC entry 5969 (class 1259 OID 26344)
-- Name: idx_tech_docs_equipment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tech_docs_equipment ON public.technical_documents USING btree (equipment_name);


--
-- TOC entry 5970 (class 1259 OID 26345)
-- Name: idx_tech_docs_serial; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tech_docs_serial ON public.technical_documents USING btree (equipment_serial);


--
-- TOC entry 5971 (class 1259 OID 26341)
-- Name: idx_tech_docs_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tech_docs_type ON public.technical_documents USING btree (document_type);


--
-- TOC entry 5972 (class 1259 OID 26342)
-- Name: idx_tech_docs_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tech_docs_user ON public.technical_documents USING btree (user_id);


--
-- TOC entry 5995 (class 1259 OID 26478)
-- Name: idx_travel_segments_user_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_travel_segments_user_date ON public.travel_segments USING btree (user_email, travel_date);


--
-- TOC entry 5887 (class 1259 OID 17320)
-- Name: idx_user_gmail_tokens_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_gmail_tokens_email ON public.user_gmail_tokens USING btree (email);


--
-- TOC entry 5888 (class 1259 OID 17319)
-- Name: idx_user_gmail_tokens_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_gmail_tokens_user_id ON public.user_gmail_tokens USING btree (user_id);


--
-- TOC entry 5977 (class 1259 OID 26471)
-- Name: idx_visit_schedules_month_year; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_visit_schedules_month_year ON public.visit_schedules USING btree (year, month, status);


--
-- TOC entry 5978 (class 1259 OID 26470)
-- Name: idx_visit_schedules_user_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_visit_schedules_user_status ON public.visit_schedules USING btree (user_email, status);


--
-- TOC entry 6060 (class 1259 OID 27436)
-- Name: private_purchase_requests_created_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX private_purchase_requests_created_by_idx ON public.private_purchase_requests USING btree (created_by);


--
-- TOC entry 6061 (class 1259 OID 27435)
-- Name: private_purchase_requests_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX private_purchase_requests_status_idx ON public.private_purchase_requests USING btree (status);


--
-- TOC entry 5813 (class 1259 OID 16676)
-- Name: uidx_request_versions_req_ver; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uidx_request_versions_req_ver ON public.request_versions USING btree (request_id, version_number);


--
-- TOC entry 5831 (class 1259 OID 17071)
-- Name: idx_cronograma_mantenimientos_next_status; Type: INDEX; Schema: servicio; Owner: postgres
--

CREATE INDEX idx_cronograma_mantenimientos_next_status ON servicio.cronograma_mantenimientos USING btree (next_maintenance_status);


--
-- TOC entry 5832 (class 1259 OID 17053)
-- Name: idx_cronograma_mantenimientos_request_id; Type: INDEX; Schema: servicio; Owner: postgres
--

CREATE INDEX idx_cronograma_mantenimientos_request_id ON servicio.cronograma_mantenimientos USING btree (request_id);


--
-- TOC entry 5839 (class 1259 OID 26883)
-- Name: idx_equipos_category; Type: INDEX; Schema: servicio; Owner: postgres
--

CREATE INDEX idx_equipos_category ON servicio.equipos USING btree (category_type);


--
-- TOC entry 5840 (class 1259 OID 26882)
-- Name: idx_equipos_code; Type: INDEX; Schema: servicio; Owner: postgres
--

CREATE INDEX idx_equipos_code ON servicio.equipos USING btree (code);


--
-- TOC entry 5841 (class 1259 OID 26884)
-- Name: idx_equipos_estado; Type: INDEX; Schema: servicio; Owner: postgres
--

CREATE INDEX idx_equipos_estado ON servicio.equipos USING btree (estado);


--
-- TOC entry 6242 (class 2620 OID 27032)
-- Name: bc_determinations bc_determinations_audit; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER bc_determinations_audit AFTER INSERT OR DELETE OR UPDATE ON public.bc_determinations FOR EACH ROW EXECUTE FUNCTION public.bc_audit_trigger();


--
-- TOC entry 6245 (class 2620 OID 27157)
-- Name: bc_equipment_selection bc_equipment_audit; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER bc_equipment_audit AFTER INSERT OR DELETE OR UPDATE ON public.bc_equipment_selection FOR EACH ROW EXECUTE FUNCTION public.bc_audit_trigger();


--
-- TOC entry 6243 (class 2620 OID 28369)
-- Name: bc_determinations recalculate_on_determination_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER recalculate_on_determination_change AFTER INSERT OR DELETE OR UPDATE ON public.bc_determinations FOR EACH ROW EXECUTE FUNCTION public.trigger_mark_for_recalculation();


--
-- TOC entry 6250 (class 2620 OID 28372)
-- Name: bc_economic_data recalculate_on_economic_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER recalculate_on_economic_change AFTER UPDATE ON public.bc_economic_data FOR EACH ROW EXECUTE FUNCTION public.trigger_mark_for_recalculation();


--
-- TOC entry 6248 (class 2620 OID 28370)
-- Name: bc_investments recalculate_on_investment_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER recalculate_on_investment_change AFTER INSERT OR DELETE OR UPDATE ON public.bc_investments FOR EACH ROW EXECUTE FUNCTION public.trigger_mark_for_recalculation();


--
-- TOC entry 6251 (class 2620 OID 28371)
-- Name: bc_operational_data recalculate_on_operational_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER recalculate_on_operational_change AFTER UPDATE ON public.bc_operational_data FOR EACH ROW EXECUTE FUNCTION public.trigger_mark_for_recalculation();


--
-- TOC entry 6249 (class 2620 OID 28385)
-- Name: bc_master set_bc_number; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_bc_number BEFORE INSERT ON public.bc_master FOR EACH ROW EXECUTE FUNCTION public.generate_bc_number();


--
-- TOC entry 6241 (class 2620 OID 26347)
-- Name: technical_documents tech_docs_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tech_docs_updated_at BEFORE UPDATE ON public.technical_documents FOR EACH ROW EXECUTE FUNCTION public.update_tech_docs_timestamp();


--
-- TOC entry 6235 (class 2620 OID 17194)
-- Name: user_attendance_records trg_attendance_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_attendance_updated_at BEFORE UPDATE ON public.user_attendance_records FOR EACH ROW EXECUTE FUNCTION public.update_attendance_timestamp();


--
-- TOC entry 6223 (class 2620 OID 16677)
-- Name: documents trg_documents_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- TOC entry 6246 (class 2620 OID 27272)
-- Name: equipos trg_equipos_touch; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_equipos_touch BEFORE UPDATE ON public.equipos FOR EACH ROW EXECUTE FUNCTION public.equipos_touch_updated_at();


--
-- TOC entry 6247 (class 2620 OID 27340)
-- Name: equipos_unidad trg_equipos_touch; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_equipos_touch BEFORE UPDATE ON public.equipos_unidad FOR EACH ROW EXECUTE FUNCTION public.equipos_touch();


--
-- TOC entry 6237 (class 2620 OID 17461)
-- Name: personnel_requests trg_generate_personnel_request_number; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_generate_personnel_request_number BEFORE INSERT ON public.personnel_requests FOR EACH ROW EXECUTE FUNCTION public.generate_personnel_request_number();


--
-- TOC entry 6224 (class 2620 OID 17031)
-- Name: inventory_movements trg_inventory_after_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_inventory_after_delete AFTER DELETE ON public.inventory_movements FOR EACH ROW EXECUTE FUNCTION public.recalculate_inventory();


--
-- TOC entry 6225 (class 2620 OID 17029)
-- Name: inventory_movements trg_inventory_after_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_inventory_after_insert AFTER INSERT ON public.inventory_movements FOR EACH ROW EXECUTE FUNCTION public.recalculate_inventory();


--
-- TOC entry 6226 (class 2620 OID 17030)
-- Name: inventory_movements trg_inventory_after_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_inventory_after_update AFTER UPDATE ON public.inventory_movements FOR EACH ROW EXECUTE FUNCTION public.recalculate_inventory();


--
-- TOC entry 6238 (class 2620 OID 17465)
-- Name: personnel_requests trg_log_personnel_request_status_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_log_personnel_request_status_change AFTER UPDATE ON public.personnel_requests FOR EACH ROW EXECUTE FUNCTION public.log_personnel_request_status_change();


--
-- TOC entry 6228 (class 2620 OID 16678)
-- Name: requests trg_log_request_status; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_log_request_status AFTER UPDATE OF status ON public.requests FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION public.fn_log_request_status();


--
-- TOC entry 6227 (class 2620 OID 16679)
-- Name: request_types trg_request_types_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_request_types_updated_at BEFORE UPDATE ON public.request_types FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- TOC entry 6229 (class 2620 OID 16680)
-- Name: requests trg_requests_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_requests_updated_at BEFORE UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- TOC entry 6239 (class 2620 OID 17463)
-- Name: personnel_requests trg_update_personnel_request_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_update_personnel_request_timestamp BEFORE UPDATE ON public.personnel_requests FOR EACH ROW EXECUTE FUNCTION public.update_personnel_request_timestamp();


--
-- TOC entry 6240 (class 2620 OID 26186)
-- Name: contract_determinations trg_update_remaining_quantity; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_update_remaining_quantity BEFORE INSERT OR UPDATE OF consumed_quantity, annual_negotiated_quantity ON public.contract_determinations FOR EACH ROW EXECUTE FUNCTION public.update_remaining_quantity();


--
-- TOC entry 6230 (class 2620 OID 16681)
-- Name: users trg_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- TOC entry 6236 (class 2620 OID 27130)
-- Name: equipment_purchase_requests trigger_validate_bc_system; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_validate_bc_system BEFORE INSERT OR UPDATE ON public.equipment_purchase_requests FOR EACH ROW EXECUTE FUNCTION public.validate_bc_system_consistency();


--
-- TOC entry 6244 (class 2620 OID 27075)
-- Name: calculation_templates update_calc_templates_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_calc_templates_timestamp BEFORE UPDATE ON public.calculation_templates FOR EACH ROW EXECUTE FUNCTION public.update_calculation_templates_timestamp();


--
-- TOC entry 6231 (class 2620 OID 16682)
-- Name: cronograma_capacitacion capacitacion_update_timestamp; Type: TRIGGER; Schema: servicio; Owner: postgres
--

CREATE TRIGGER capacitacion_update_timestamp BEFORE UPDATE ON servicio.cronograma_capacitacion FOR EACH ROW EXECUTE FUNCTION servicio.update_timestamp();


--
-- TOC entry 6234 (class 2620 OID 16683)
-- Name: equipos equipos_update_timestamp; Type: TRIGGER; Schema: servicio; Owner: postgres
--

CREATE TRIGGER equipos_update_timestamp BEFORE UPDATE ON servicio.equipos FOR EACH ROW EXECUTE FUNCTION servicio.update_timestamp();


--
-- TOC entry 6233 (class 2620 OID 16684)
-- Name: cronograma_mantenimientos_anuales mantenimiento_anual_update_timestamp; Type: TRIGGER; Schema: servicio; Owner: postgres
--

CREATE TRIGGER mantenimiento_anual_update_timestamp BEFORE UPDATE ON servicio.cronograma_mantenimientos_anuales FOR EACH ROW EXECUTE FUNCTION servicio.update_timestamp();


--
-- TOC entry 6232 (class 2620 OID 16685)
-- Name: cronograma_mantenimientos mantenimiento_update_timestamp; Type: TRIGGER; Schema: servicio; Owner: postgres
--

CREATE TRIGGER mantenimiento_update_timestamp BEFORE UPDATE ON servicio.cronograma_mantenimientos FOR EACH ROW EXECUTE FUNCTION servicio.update_timestamp();


--
-- TOC entry 6187 (class 2606 OID 26434)
-- Name: advisor_location_history advisor_location_history_client_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.advisor_location_history
    ADD CONSTRAINT advisor_location_history_client_request_id_fkey FOREIGN KEY (client_request_id) REFERENCES public.client_requests(id) ON DELETE SET NULL;


--
-- TOC entry 6188 (class 2606 OID 26439)
-- Name: advisor_location_history advisor_location_history_visit_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.advisor_location_history
    ADD CONSTRAINT advisor_location_history_visit_log_id_fkey FOREIGN KEY (visit_log_id) REFERENCES public.client_visit_logs(id) ON DELETE SET NULL;


--
-- TOC entry 6182 (class 2606 OID 26230)
-- Name: bc_alerts bc_alerts_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_alerts
    ADD CONSTRAINT bc_alerts_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6183 (class 2606 OID 26235)
-- Name: bc_alerts bc_alerts_contract_determination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_alerts
    ADD CONSTRAINT bc_alerts_contract_determination_id_fkey FOREIGN KEY (contract_determination_id) REFERENCES public.contract_determinations(id) ON DELETE SET NULL;


--
-- TOC entry 6200 (class 2606 OID 27021)
-- Name: bc_audit_log bc_audit_log_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_audit_log
    ADD CONSTRAINT bc_audit_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- TOC entry 6217 (class 2606 OID 27676)
-- Name: bc_deliveries bc_deliveries_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_deliveries
    ADD CONSTRAINT bc_deliveries_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6191 (class 2606 OID 26935)
-- Name: bc_determinations bc_determinations_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_determinations
    ADD CONSTRAINT bc_determinations_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id);


--
-- TOC entry 6192 (class 2606 OID 28260)
-- Name: bc_determinations bc_determinations_bc_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_determinations
    ADD CONSTRAINT bc_determinations_bc_master_id_fkey FOREIGN KEY (bc_master_id) REFERENCES public.bc_master(id) ON DELETE CASCADE;


--
-- TOC entry 6193 (class 2606 OID 26930)
-- Name: bc_determinations bc_determinations_determination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_determinations
    ADD CONSTRAINT bc_determinations_determination_id_fkey FOREIGN KEY (determination_id) REFERENCES public.catalog_determinations(id) ON DELETE CASCADE;


--
-- TOC entry 6218 (class 2606 OID 28255)
-- Name: bc_economic_data bc_economic_data_bc_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_economic_data
    ADD CONSTRAINT bc_economic_data_bc_master_id_fkey FOREIGN KEY (bc_master_id) REFERENCES public.bc_master(id) ON DELETE CASCADE;


--
-- TOC entry 6213 (class 2606 OID 27594)
-- Name: bc_equipment_details bc_equipment_details_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_equipment_details
    ADD CONSTRAINT bc_equipment_details_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6203 (class 2606 OID 27150)
-- Name: bc_equipment_selection bc_equipment_selection_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_equipment_selection
    ADD CONSTRAINT bc_equipment_selection_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES servicio.equipos(id_equipo) ON DELETE CASCADE;


--
-- TOC entry 6210 (class 2606 OID 28266)
-- Name: bc_investments bc_investments_bc_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_investments
    ADD CONSTRAINT bc_investments_bc_master_id_fkey FOREIGN KEY (bc_master_id) REFERENCES public.bc_master(id) ON DELETE CASCADE;


--
-- TOC entry 6211 (class 2606 OID 27518)
-- Name: bc_investments bc_investments_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_investments
    ADD CONSTRAINT bc_investments_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6212 (class 2606 OID 27568)
-- Name: bc_lab_environment bc_lab_environment_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lab_environment
    ADD CONSTRAINT bc_lab_environment_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6220 (class 2606 OID 28327)
-- Name: bc_lis_data bc_lis_data_bc_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lis_data
    ADD CONSTRAINT bc_lis_data_bc_master_id_fkey FOREIGN KEY (bc_master_id) REFERENCES public.bc_master(id) ON DELETE CASCADE;


--
-- TOC entry 6215 (class 2606 OID 27636)
-- Name: bc_lis_equipment_interfaces bc_lis_equipment_interfaces_lis_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lis_equipment_interfaces
    ADD CONSTRAINT bc_lis_equipment_interfaces_lis_integration_id_fkey FOREIGN KEY (bc_lis_data_id) REFERENCES public.bc_lis_integration(id) ON DELETE CASCADE;


--
-- TOC entry 6214 (class 2606 OID 27619)
-- Name: bc_lis_integration bc_lis_integration_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_lis_integration
    ADD CONSTRAINT bc_lis_integration_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6219 (class 2606 OID 28302)
-- Name: bc_operational_data bc_operational_data_bc_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_operational_data
    ADD CONSTRAINT bc_operational_data_bc_master_id_fkey FOREIGN KEY (bc_master_id) REFERENCES public.bc_master(id) ON DELETE CASCADE;


--
-- TOC entry 6216 (class 2606 OID 27656)
-- Name: bc_requirements bc_requirements_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_requirements
    ADD CONSTRAINT bc_requirements_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6222 (class 2606 OID 28363)
-- Name: bc_validations bc_validations_bc_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_validations
    ADD CONSTRAINT bc_validations_bc_master_id_fkey FOREIGN KEY (bc_master_id) REFERENCES public.bc_master(id) ON DELETE CASCADE;


--
-- TOC entry 6221 (class 2606 OID 28344)
-- Name: bc_workflow_history bc_workflow_history_bc_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_workflow_history
    ADD CONSTRAINT bc_workflow_history_bc_master_id_fkey FOREIGN KEY (bc_master_id) REFERENCES public.bc_master(id) ON DELETE CASCADE;


--
-- TOC entry 6202 (class 2606 OID 27067)
-- Name: calculation_templates calculation_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calculation_templates
    ADD CONSTRAINT calculation_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 6175 (class 2606 OID 26113)
-- Name: catalog_consumables catalog_consumables_replaced_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_consumables
    ADD CONSTRAINT catalog_consumables_replaced_by_id_fkey FOREIGN KEY (replaced_by_id) REFERENCES public.catalog_consumables(id) ON DELETE SET NULL;


--
-- TOC entry 6173 (class 2606 OID 26284)
-- Name: catalog_determinations catalog_determinations_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_determinations
    ADD CONSTRAINT catalog_determinations_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES servicio.equipos(id_equipo) ON DELETE SET NULL;


--
-- TOC entry 6174 (class 2606 OID 26085)
-- Name: catalog_determinations catalog_determinations_replaced_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_determinations
    ADD CONSTRAINT catalog_determinations_replaced_by_id_fkey FOREIGN KEY (replaced_by_id) REFERENCES public.catalog_determinations(id) ON DELETE SET NULL;


--
-- TOC entry 6176 (class 2606 OID 26139)
-- Name: catalog_equipment_consumables catalog_equipment_consumables_consumable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_equipment_consumables
    ADD CONSTRAINT catalog_equipment_consumables_consumable_id_fkey FOREIGN KEY (consumable_id) REFERENCES public.catalog_consumables(id) ON DELETE CASCADE;


--
-- TOC entry 6177 (class 2606 OID 26144)
-- Name: catalog_equipment_consumables catalog_equipment_consumables_determination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_equipment_consumables
    ADD CONSTRAINT catalog_equipment_consumables_determination_id_fkey FOREIGN KEY (determination_id) REFERENCES public.catalog_determinations(id) ON DELETE CASCADE;


--
-- TOC entry 6178 (class 2606 OID 26292)
-- Name: catalog_equipment_consumables catalog_equipment_consumables_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_equipment_consumables
    ADD CONSTRAINT catalog_equipment_consumables_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES servicio.equipos(id_equipo) ON DELETE CASCADE;


--
-- TOC entry 6171 (class 2606 OID 25729)
-- Name: client_assignments client_assignments_client_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_assignments
    ADD CONSTRAINT client_assignments_client_request_id_fkey FOREIGN KEY (client_request_id) REFERENCES public.client_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6154 (class 2606 OID 17147)
-- Name: client_request_consent_tokens client_request_consent_tokens_used_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_request_consent_tokens
    ADD CONSTRAINT client_request_consent_tokens_used_request_id_fkey FOREIGN KEY (used_request_id) REFERENCES public.client_requests(id) ON DELETE SET NULL;


--
-- TOC entry 6153 (class 2606 OID 17125)
-- Name: client_request_consents client_request_consents_client_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_request_consents
    ADD CONSTRAINT client_request_consents_client_request_id_fkey FOREIGN KEY (client_request_id) REFERENCES public.client_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6150 (class 2606 OID 17276)
-- Name: client_requests client_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_requests
    ADD CONSTRAINT client_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 6151 (class 2606 OID 17281)
-- Name: client_requests client_requests_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_requests
    ADD CONSTRAINT client_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- TOC entry 6152 (class 2606 OID 17286)
-- Name: client_requests client_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_requests
    ADD CONSTRAINT client_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 6172 (class 2606 OID 25753)
-- Name: client_visit_logs client_visit_logs_client_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_visit_logs
    ADD CONSTRAINT client_visit_logs_client_request_id_fkey FOREIGN KEY (client_request_id) REFERENCES public.client_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6156 (class 2606 OID 17265)
-- Name: clients clients_client_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_client_request_id_fkey FOREIGN KEY (client_request_id) REFERENCES public.client_requests(id) ON DELETE SET NULL;


--
-- TOC entry 6157 (class 2606 OID 17270)
-- Name: clients clients_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 6179 (class 2606 OID 26171)
-- Name: contract_determinations contract_determinations_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_determinations
    ADD CONSTRAINT contract_determinations_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6180 (class 2606 OID 26176)
-- Name: contract_determinations contract_determinations_determination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_determinations
    ADD CONSTRAINT contract_determinations_determination_id_fkey FOREIGN KEY (determination_id) REFERENCES public.catalog_determinations(id) ON DELETE SET NULL;


--
-- TOC entry 6181 (class 2606 OID 26204)
-- Name: determination_consumption_log determination_consumption_log_contract_determination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.determination_consumption_log
    ADD CONSTRAINT determination_consumption_log_contract_determination_id_fkey FOREIGN KEY (contract_determination_id) REFERENCES public.contract_determinations(id) ON DELETE CASCADE;


--
-- TOC entry 6127 (class 2606 OID 16686)
-- Name: document_signatures document_signatures_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_signatures
    ADD CONSTRAINT document_signatures_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- TOC entry 6128 (class 2606 OID 16691)
-- Name: document_signatures document_signatures_signer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_signatures
    ADD CONSTRAINT document_signatures_signer_user_id_fkey FOREIGN KEY (signer_user_id) REFERENCES public.users(id);


--
-- TOC entry 6129 (class 2606 OID 16696)
-- Name: documents documents_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE CASCADE;


--
-- TOC entry 6130 (class 2606 OID 16701)
-- Name: documents documents_request_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_request_type_id_fkey FOREIGN KEY (request_type_id) REFERENCES public.request_types(id) ON DELETE CASCADE;


--
-- TOC entry 6196 (class 2606 OID 27000)
-- Name: equipment_price_history equipment_price_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipment_price_history
    ADD CONSTRAINT equipment_price_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- TOC entry 6197 (class 2606 OID 26990)
-- Name: equipment_price_history equipment_price_history_consumable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipment_price_history
    ADD CONSTRAINT equipment_price_history_consumable_id_fkey FOREIGN KEY (consumable_id) REFERENCES public.catalog_consumables(id);


--
-- TOC entry 6198 (class 2606 OID 26995)
-- Name: equipment_price_history equipment_price_history_determination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipment_price_history
    ADD CONSTRAINT equipment_price_history_determination_id_fkey FOREIGN KEY (determination_id) REFERENCES public.catalog_determinations(id);


--
-- TOC entry 6199 (class 2606 OID 26985)
-- Name: equipment_price_history equipment_price_history_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipment_price_history
    ADD CONSTRAINT equipment_price_history_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES servicio.equipos(id_equipo);


--
-- TOC entry 6168 (class 2606 OID 17478)
-- Name: equipment_purchase_bc_items equipment_purchase_bc_items_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipment_purchase_bc_items
    ADD CONSTRAINT equipment_purchase_bc_items_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6207 (class 2606 OID 27323)
-- Name: equipos_historial equipos_historial_unidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_historial
    ADD CONSTRAINT equipos_historial_unidad_id_fkey FOREIGN KEY (unidad_id) REFERENCES public.equipos_unidad(id) ON DELETE CASCADE;


--
-- TOC entry 6204 (class 2606 OID 27262)
-- Name: equipos_movimientos equipos_movimientos_equipo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_movimientos
    ADD CONSTRAINT equipos_movimientos_equipo_id_fkey FOREIGN KEY (equipo_id) REFERENCES public.equipos(id) ON DELETE CASCADE;


--
-- TOC entry 6205 (class 2606 OID 27306)
-- Name: equipos_unidad equipos_unidad_modelo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_unidad
    ADD CONSTRAINT equipos_unidad_modelo_id_fkey FOREIGN KEY (modelo_id) REFERENCES public.equipos_modelo(id) ON DELETE CASCADE;


--
-- TOC entry 6206 (class 2606 OID 27352)
-- Name: equipos_unidad equipos_unidad_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_unidad
    ADD CONSTRAINT equipos_unidad_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE SET NULL;


--
-- TOC entry 6201 (class 2606 OID 27102)
-- Name: bc_audit_log fk_bc_audit_log_bc; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_audit_log
    ADD CONSTRAINT fk_bc_audit_log_bc FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6195 (class 2606 OID 27097)
-- Name: bc_calculations fk_bc_calculations_bc; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_calculations
    ADD CONSTRAINT fk_bc_calculations_bc FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6194 (class 2606 OID 27092)
-- Name: bc_determinations fk_bc_determinations_bc; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bc_determinations
    ADD CONSTRAINT fk_bc_determinations_bc FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6169 (class 2606 OID 27107)
-- Name: equipment_purchase_bc_items fk_bc_items_request; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipment_purchase_bc_items
    ADD CONSTRAINT fk_bc_items_request FOREIGN KEY (request_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6158 (class 2606 OID 17314)
-- Name: user_gmail_tokens fk_user_gmail_tokens_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_gmail_tokens
    ADD CONSTRAINT fk_user_gmail_tokens_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 6142 (class 2606 OID 16974)
-- Name: users fk_users_department; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_department FOREIGN KEY (department_id) REFERENCES public.departments(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 6143 (class 2606 OID 16979)
-- Name: users fk_users_departments; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_departments FOREIGN KEY (department_id) REFERENCES public.departments(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 6131 (class 2606 OID 16706)
-- Name: inventory_movements inventory_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 6132 (class 2606 OID 16711)
-- Name: inventory_movements inventory_movements_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id);


--
-- TOC entry 6166 (class 2606 OID 17444)
-- Name: personnel_request_comments personnel_request_comments_personnel_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_request_comments
    ADD CONSTRAINT personnel_request_comments_personnel_request_id_fkey FOREIGN KEY (personnel_request_id) REFERENCES public.personnel_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6167 (class 2606 OID 17449)
-- Name: personnel_request_comments personnel_request_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_request_comments
    ADD CONSTRAINT personnel_request_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 6164 (class 2606 OID 17424)
-- Name: personnel_request_history personnel_request_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_request_history
    ADD CONSTRAINT personnel_request_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- TOC entry 6165 (class 2606 OID 17419)
-- Name: personnel_request_history personnel_request_history_personnel_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_request_history
    ADD CONSTRAINT personnel_request_history_personnel_request_id_fkey FOREIGN KEY (personnel_request_id) REFERENCES public.personnel_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6159 (class 2606 OID 17401)
-- Name: personnel_requests personnel_requests_approved_by_finance_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_requests
    ADD CONSTRAINT personnel_requests_approved_by_finance_fkey FOREIGN KEY (approved_by_finance) REFERENCES public.users(id);


--
-- TOC entry 6160 (class 2606 OID 17396)
-- Name: personnel_requests personnel_requests_approved_by_hr_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_requests
    ADD CONSTRAINT personnel_requests_approved_by_hr_fkey FOREIGN KEY (approved_by_hr) REFERENCES public.users(id);


--
-- TOC entry 6161 (class 2606 OID 17391)
-- Name: personnel_requests personnel_requests_approved_by_manager_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_requests
    ADD CONSTRAINT personnel_requests_approved_by_manager_fkey FOREIGN KEY (approved_by_manager) REFERENCES public.users(id);


--
-- TOC entry 6162 (class 2606 OID 17386)
-- Name: personnel_requests personnel_requests_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_requests
    ADD CONSTRAINT personnel_requests_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- TOC entry 6163 (class 2606 OID 17381)
-- Name: personnel_requests personnel_requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel_requests
    ADD CONSTRAINT personnel_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 6208 (class 2606 OID 27425)
-- Name: private_purchase_requests private_purchase_requests_client_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.private_purchase_requests
    ADD CONSTRAINT private_purchase_requests_client_request_id_fkey FOREIGN KEY (client_request_id) REFERENCES public.client_requests(id) ON DELETE SET NULL;


--
-- TOC entry 6209 (class 2606 OID 27430)
-- Name: private_purchase_requests private_purchase_requests_equipment_purchase_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.private_purchase_requests
    ADD CONSTRAINT private_purchase_requests_equipment_purchase_request_id_fkey FOREIGN KEY (equipment_purchase_request_id) REFERENCES public.equipment_purchase_requests(id);


--
-- TOC entry 6133 (class 2606 OID 16716)
-- Name: request_approvals request_approvals_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_approvals
    ADD CONSTRAINT request_approvals_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id);


--
-- TOC entry 6134 (class 2606 OID 16721)
-- Name: request_approvals request_approvals_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_approvals
    ADD CONSTRAINT request_approvals_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id);


--
-- TOC entry 6135 (class 2606 OID 16726)
-- Name: request_attachments request_attachments_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_attachments
    ADD CONSTRAINT request_attachments_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id);


--
-- TOC entry 6136 (class 2606 OID 16731)
-- Name: request_attachments request_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_attachments
    ADD CONSTRAINT request_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- TOC entry 6137 (class 2606 OID 16736)
-- Name: request_status_history request_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_status_history
    ADD CONSTRAINT request_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- TOC entry 6138 (class 2606 OID 16741)
-- Name: request_status_history request_status_history_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_status_history
    ADD CONSTRAINT request_status_history_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE CASCADE;


--
-- TOC entry 6139 (class 2606 OID 16746)
-- Name: request_versions request_versions_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_versions
    ADD CONSTRAINT request_versions_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id);


--
-- TOC entry 6140 (class 2606 OID 16751)
-- Name: requests requests_request_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_request_type_id_fkey FOREIGN KEY (request_type_id) REFERENCES public.request_types(id) ON DELETE CASCADE;


--
-- TOC entry 6141 (class 2606 OID 16756)
-- Name: requests requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id);


--
-- TOC entry 6185 (class 2606 OID 26413)
-- Name: scheduled_visits scheduled_visits_client_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scheduled_visits
    ADD CONSTRAINT scheduled_visits_client_request_id_fkey FOREIGN KEY (client_request_id) REFERENCES public.client_requests(id) ON DELETE CASCADE;


--
-- TOC entry 6186 (class 2606 OID 26408)
-- Name: scheduled_visits scheduled_visits_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scheduled_visits
    ADD CONSTRAINT scheduled_visits_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.visit_schedules(id) ON DELETE CASCADE;


--
-- TOC entry 6184 (class 2606 OID 26336)
-- Name: technical_documents technical_documents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.technical_documents
    ADD CONSTRAINT technical_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 6189 (class 2606 OID 26460)
-- Name: travel_segments travel_segments_from_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.travel_segments
    ADD CONSTRAINT travel_segments_from_client_id_fkey FOREIGN KEY (from_client_id) REFERENCES public.client_requests(id) ON DELETE SET NULL;


--
-- TOC entry 6190 (class 2606 OID 26465)
-- Name: travel_segments travel_segments_to_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.travel_segments
    ADD CONSTRAINT travel_segments_to_client_id_fkey FOREIGN KEY (to_client_id) REFERENCES public.client_requests(id) ON DELETE SET NULL;


--
-- TOC entry 6155 (class 2606 OID 17185)
-- Name: user_attendance_records user_attendance_records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_attendance_records
    ADD CONSTRAINT user_attendance_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 6147 (class 2606 OID 16761)
-- Name: cronograma_mantenimientos_anuales cronograma_mantenimientos_anuales_id_equipo_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos_anuales
    ADD CONSTRAINT cronograma_mantenimientos_anuales_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES servicio.equipos(id_equipo) ON DELETE CASCADE;


--
-- TOC entry 6144 (class 2606 OID 17059)
-- Name: cronograma_mantenimientos cronograma_mantenimientos_created_by_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos
    ADD CONSTRAINT cronograma_mantenimientos_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 6145 (class 2606 OID 16766)
-- Name: cronograma_mantenimientos cronograma_mantenimientos_id_equipo_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos
    ADD CONSTRAINT cronograma_mantenimientos_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES servicio.equipos(id_equipo) ON DELETE CASCADE;


--
-- TOC entry 6146 (class 2606 OID 17054)
-- Name: cronograma_mantenimientos cronograma_mantenimientos_request_fk; Type: FK CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos
    ADD CONSTRAINT cronograma_mantenimientos_request_fk FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE SET NULL;


--
-- TOC entry 6170 (class 2606 OID 25691)
-- Name: disponibilidad_tecnicos disponibilidad_tecnicos_user_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.disponibilidad_tecnicos
    ADD CONSTRAINT disponibilidad_tecnicos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 6148 (class 2606 OID 26870)
-- Name: equipos equipos_created_by_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.equipos
    ADD CONSTRAINT equipos_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 6149 (class 2606 OID 26875)
-- Name: equipos equipos_updated_by_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.equipos
    ADD CONSTRAINT equipos_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


-- Completed on 2025-12-15 10:10:19

--
-- PostgreSQL database dump complete
--

\unrestrict SdsbRB1GPKQtZ70JI1GYA0aWD30tg1wzA8L3dm2YDmAd6tZkKxXlOcqHBsi858O

