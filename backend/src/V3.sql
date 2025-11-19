--
-- PostgreSQL database dump
--

\restrict VkjFoPSLc2l6jg5iQinGtXi2bjMGk1rZZcUP4g3PdRExgef4Xol50hb3aDcm0XP

-- Dumped from database version 18.0
-- Dumped by pg_dump version 18.0

-- Started on 2025-11-17 13:05:24

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
-- TOC entry 8 (class 2615 OID 16984)
-- Name: auditoria; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA auditoria;


ALTER SCHEMA auditoria OWNER TO postgres;

--
-- TOC entry 7 (class 2615 OID 16385)
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
-- TOC entry 5361 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- TOC entry 939 (class 1247 OID 16387)
-- Name: approval_action_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.approval_action_enum AS ENUM (
    'approve',
    'reject'
);


ALTER TYPE public.approval_action_enum OWNER TO postgres;

--
-- TOC entry 942 (class 1247 OID 16392)
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
-- TOC entry 266 (class 1255 OID 16401)
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
-- TOC entry 306 (class 1255 OID 17028)
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
-- TOC entry 305 (class 1255 OID 16402)
-- Name: update_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now(); 
  RETURN NEW;
END; $$;


ALTER FUNCTION public.update_timestamp() OWNER TO postgres;

--
-- TOC entry 267 (class 1255 OID 16403)
-- Name: update_timestamp(); Type: FUNCTION; Schema: servicio; Owner: postgres
--

CREATE FUNCTION servicio.update_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION servicio.update_timestamp() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 264 (class 1259 OID 16986)
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
-- TOC entry 5362 (class 0 OID 0)
-- Dependencies: 264
-- Name: TABLE logs; Type: COMMENT; Schema: auditoria; Owner: postgres
--

COMMENT ON TABLE auditoria.logs IS 'Registra todas las acciones de usuarios del sistema SPI Fam (creaciones, modificaciones, logins, etc.)';


--
-- TOC entry 5363 (class 0 OID 0)
-- Dependencies: 264
-- Name: COLUMN logs.usuario_email; Type: COMMENT; Schema: auditoria; Owner: postgres
--

COMMENT ON COLUMN auditoria.logs.usuario_email IS 'Correo del usuario que realizó la acción';


--
-- TOC entry 5364 (class 0 OID 0)
-- Dependencies: 264
-- Name: COLUMN logs.modulo; Type: COMMENT; Schema: auditoria; Owner: postgres
--

COMMENT ON COLUMN auditoria.logs.modulo IS 'Módulo afectado (auth, solicitudes, mantenimientos, etc.)';


--
-- TOC entry 5365 (class 0 OID 0)
-- Dependencies: 264
-- Name: COLUMN logs.accion; Type: COMMENT; Schema: auditoria; Owner: postgres
--

COMMENT ON COLUMN auditoria.logs.accion IS 'Tipo de acción (CREATE, UPDATE, DELETE, LOGIN, APPROVE, etc.)';


--
-- TOC entry 5366 (class 0 OID 0)
-- Dependencies: 264
-- Name: COLUMN logs.descripcion; Type: COMMENT; Schema: auditoria; Owner: postgres
--

COMMENT ON COLUMN auditoria.logs.descripcion IS 'Descripción amigable de la acción realizada';


--
-- TOC entry 5367 (class 0 OID 0)
-- Dependencies: 264
-- Name: COLUMN logs.datos_anteriores; Type: COMMENT; Schema: auditoria; Owner: postgres
--

COMMENT ON COLUMN auditoria.logs.datos_anteriores IS 'JSON con los datos antes del cambio';


--
-- TOC entry 5368 (class 0 OID 0)
-- Dependencies: 264
-- Name: COLUMN logs.datos_nuevos; Type: COMMENT; Schema: auditoria; Owner: postgres
--

COMMENT ON COLUMN auditoria.logs.datos_nuevos IS 'JSON con los datos después del cambio';


--
-- TOC entry 5369 (class 0 OID 0)
-- Dependencies: 264
-- Name: COLUMN logs.fecha; Type: COMMENT; Schema: auditoria; Owner: postgres
--

COMMENT ON COLUMN auditoria.logs.fecha IS 'Fecha y hora del evento registrado';


--
-- TOC entry 263 (class 1259 OID 16985)
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
-- TOC entry 5370 (class 0 OID 0)
-- Dependencies: 263
-- Name: logs_id_seq; Type: SEQUENCE OWNED BY; Schema: auditoria; Owner: postgres
--

ALTER SEQUENCE auditoria.logs_id_seq OWNED BY auditoria.logs.id;


--
-- TOC entry 222 (class 1259 OID 16404)
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
-- TOC entry 223 (class 1259 OID 16412)
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
-- TOC entry 5371 (class 0 OID 0)
-- Dependencies: 223
-- Name: audit_trail_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_trail_id_seq OWNED BY public.audit_trail.id;


--
-- TOC entry 262 (class 1259 OID 16959)
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
-- TOC entry 261 (class 1259 OID 16958)
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
-- TOC entry 5372 (class 0 OID 0)
-- Dependencies: 261
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;


--
-- TOC entry 224 (class 1259 OID 16413)
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
-- TOC entry 5373 (class 0 OID 0)
-- Dependencies: 224
-- Name: TABLE document_signatures; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.document_signatures IS 'Firmas digitales PNG por documento/usuario/rol.';


--
-- TOC entry 225 (class 1259 OID 16422)
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
-- TOC entry 5374 (class 0 OID 0)
-- Dependencies: 225
-- Name: document_signatures_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.document_signatures_id_seq OWNED BY public.document_signatures.id;


--
-- TOC entry 226 (class 1259 OID 16423)
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
-- TOC entry 5375 (class 0 OID 0)
-- Dependencies: 226
-- Name: TABLE documents; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.documents IS 'Documentos generados desde plantillas: DOCX/PDF/firma y carpeta Drive por request.';


--
-- TOC entry 227 (class 1259 OID 16435)
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
-- TOC entry 5376 (class 0 OID 0)
-- Dependencies: 227
-- Name: documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.documents_id_seq OWNED BY public.documents.id;


--
-- TOC entry 228 (class 1259 OID 16436)
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
-- TOC entry 229 (class 1259 OID 16444)
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
-- TOC entry 5377 (class 0 OID 0)
-- Dependencies: 229
-- Name: employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;


--
-- TOC entry 230 (class 1259 OID 16445)
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
-- TOC entry 231 (class 1259 OID 16453)
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
-- TOC entry 5378 (class 0 OID 0)
-- Dependencies: 231
-- Name: inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventory_id_seq OWNED BY public.inventory.id;


--
-- TOC entry 232 (class 1259 OID 16454)
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
-- TOC entry 233 (class 1259 OID 16461)
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
-- TOC entry 5379 (class 0 OID 0)
-- Dependencies: 233
-- Name: inventory_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventory_movements_id_seq OWNED BY public.inventory_movements.id;


--
-- TOC entry 234 (class 1259 OID 16462)
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
-- TOC entry 235 (class 1259 OID 16469)
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
-- TOC entry 5380 (class 0 OID 0)
-- Dependencies: 235
-- Name: request_approvals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.request_approvals_id_seq OWNED BY public.request_approvals.id;


--
-- TOC entry 236 (class 1259 OID 16470)
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
-- TOC entry 237 (class 1259 OID 16477)
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
-- TOC entry 5381 (class 0 OID 0)
-- Dependencies: 237
-- Name: request_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.request_attachments_id_seq OWNED BY public.request_attachments.id;


--
-- TOC entry 238 (class 1259 OID 16478)
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
-- TOC entry 5382 (class 0 OID 0)
-- Dependencies: 238
-- Name: TABLE request_status_history; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.request_status_history IS 'Historial completo de estados por request.';


--
-- TOC entry 239 (class 1259 OID 16487)
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
-- TOC entry 5383 (class 0 OID 0)
-- Dependencies: 239
-- Name: request_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.request_status_history_id_seq OWNED BY public.request_status_history.id;


--
-- TOC entry 240 (class 1259 OID 16488)
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
-- TOC entry 241 (class 1259 OID 16497)
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
-- TOC entry 5384 (class 0 OID 0)
-- Dependencies: 241
-- Name: request_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.request_types_id_seq OWNED BY public.request_types.id;


--
-- TOC entry 242 (class 1259 OID 16498)
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
-- TOC entry 243 (class 1259 OID 16505)
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
-- TOC entry 5385 (class 0 OID 0)
-- Dependencies: 243
-- Name: request_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.request_versions_id_seq OWNED BY public.request_versions.id;


--
-- TOC entry 244 (class 1259 OID 16506)
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
-- TOC entry 245 (class 1259 OID 16519)
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
-- TOC entry 5386 (class 0 OID 0)
-- Dependencies: 245
-- Name: requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.requests_id_seq OWNED BY public.requests.id;


--
-- TOC entry 260 (class 1259 OID 16947)
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
-- TOC entry 259 (class 1259 OID 16946)
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
-- TOC entry 5387 (class 0 OID 0)
-- Dependencies: 259
-- Name: user_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_sessions_id_seq OWNED BY public.user_sessions.id;


--
-- TOC entry 246 (class 1259 OID 16520)
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
    fullname text
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 247 (class 1259 OID 16530)
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
-- TOC entry 5388 (class 0 OID 0)
-- Dependencies: 247
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 265 (class 1259 OID 17035)
-- Name: v_inventario_completo; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_inventario_completo AS
 SELECT i.id AS inventory_id,
    i.name AS item_name,
    i.sku,
    i.quantity AS stock_actual,
    i.updated_at AS ultima_actualizacion,
    COALESCE(sum(
        CASE
            WHEN ((m.movement_type)::text = 'entrada'::text) THEN m.quantity
            ELSE 0
        END), (0)::bigint) AS total_entradas,
    COALESCE(sum(
        CASE
            WHEN ((m.movement_type)::text = 'salida'::text) THEN m.quantity
            ELSE 0
        END), (0)::bigint) AS total_salidas,
    max(m.created_at) AS fecha_ultimo_movimiento,
    ( SELECT um.movement_type
           FROM public.inventory_movements um
          WHERE (um.inventory_id = i.id)
          ORDER BY um.created_at DESC
         LIMIT 1) AS tipo_ultimo_movimiento,
    ( SELECT u.name
           FROM public.users u
          WHERE (u.id = ( SELECT um.created_by
                   FROM public.inventory_movements um
                  WHERE (um.inventory_id = i.id)
                  ORDER BY um.created_at DESC
                 LIMIT 1))) AS usuario_ultimo_movimiento
   FROM (public.inventory i
     LEFT JOIN public.inventory_movements m ON ((i.id = m.inventory_id)))
  GROUP BY i.id, i.name, i.sku, i.quantity, i.updated_at
  ORDER BY i.name;


ALTER VIEW public.v_inventario_completo OWNER TO postgres;

--
-- TOC entry 248 (class 1259 OID 16531)
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
-- TOC entry 5390 (class 0 OID 0)
-- Dependencies: 248
-- Name: VIEW vw_dashboard_requests; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.vw_dashboard_requests IS 'Vista de consolidación de solicitudes, incluyendo estados pending, in_review, approved, rejected y cancelled.';


--
-- TOC entry 249 (class 1259 OID 16536)
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
-- TOC entry 5391 (class 0 OID 0)
-- Dependencies: 249
-- Name: VIEW vw_request_metrics; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.vw_request_metrics IS 'Resumen de solicitudes agrupadas por estado (incluye cancelled).';


--
-- TOC entry 250 (class 1259 OID 16540)
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
-- TOC entry 251 (class 1259 OID 16553)
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
-- TOC entry 5392 (class 0 OID 0)
-- Dependencies: 251
-- Name: cronograma_capacitacion_id_capacitacion_seq; Type: SEQUENCE OWNED BY; Schema: servicio; Owner: postgres
--

ALTER SEQUENCE servicio.cronograma_capacitacion_id_capacitacion_seq OWNED BY servicio.cronograma_capacitacion.id_capacitacion;


--
-- TOC entry 252 (class 1259 OID 16554)
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
    CONSTRAINT cronograma_mantenimientos_estado_check CHECK ((estado = ANY (ARRAY['Pendiente'::text, 'En Proceso'::text, 'Cumplido'::text, 'No Cumplido'::text]))),
    CONSTRAINT cronograma_mantenimientos_tipo_check CHECK ((tipo = ANY (ARRAY['Preventivo'::text, 'Correctivo'::text])))
);


ALTER TABLE servicio.cronograma_mantenimientos OWNER TO postgres;

--
-- TOC entry 5393 (class 0 OID 0)
-- Dependencies: 252
-- Name: TABLE cronograma_mantenimientos; Type: COMMENT; Schema: servicio; Owner: postgres
--

COMMENT ON TABLE servicio.cronograma_mantenimientos IS 'Registro de mantenimientos preventivos y correctivos asociados a cada equipo.';


--
-- TOC entry 253 (class 1259 OID 16568)
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
-- TOC entry 5394 (class 0 OID 0)
-- Dependencies: 253
-- Name: TABLE cronograma_mantenimientos_anuales; Type: COMMENT; Schema: servicio; Owner: postgres
--

COMMENT ON TABLE servicio.cronograma_mantenimientos_anuales IS 'Plan anual de mantenimiento preventivo por equipo.';


--
-- TOC entry 254 (class 1259 OID 16581)
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
-- TOC entry 5395 (class 0 OID 0)
-- Dependencies: 254
-- Name: cronograma_mantenimientos_anuales_id_mant_anual_seq; Type: SEQUENCE OWNED BY; Schema: servicio; Owner: postgres
--

ALTER SEQUENCE servicio.cronograma_mantenimientos_anuales_id_mant_anual_seq OWNED BY servicio.cronograma_mantenimientos_anuales.id_mant_anual;


--
-- TOC entry 255 (class 1259 OID 16582)
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
-- TOC entry 5396 (class 0 OID 0)
-- Dependencies: 255
-- Name: cronograma_mantenimientos_id_mantenimiento_seq; Type: SEQUENCE OWNED BY; Schema: servicio; Owner: postgres
--

ALTER SEQUENCE servicio.cronograma_mantenimientos_id_mantenimiento_seq OWNED BY servicio.cronograma_mantenimientos.id_mantenimiento;


--
-- TOC entry 256 (class 1259 OID 16583)
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
    estado text DEFAULT 'Operativo'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT equipos_estado_check CHECK ((estado = ANY (ARRAY['Operativo'::text, 'En mantenimiento'::text, 'Fuera de servicio'::text])))
);


ALTER TABLE servicio.equipos OWNER TO postgres;

--
-- TOC entry 5397 (class 0 OID 0)
-- Dependencies: 256
-- Name: TABLE equipos; Type: COMMENT; Schema: servicio; Owner: postgres
--

COMMENT ON TABLE servicio.equipos IS 'Catálogo único de equipos manejados por el área de servicio técnico.';


--
-- TOC entry 257 (class 1259 OID 16594)
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
-- TOC entry 5398 (class 0 OID 0)
-- Dependencies: 257
-- Name: equipos_id_equipo_seq; Type: SEQUENCE OWNED BY; Schema: servicio; Owner: postgres
--

ALTER SEQUENCE servicio.equipos_id_equipo_seq OWNED BY servicio.equipos.id_equipo;


--
-- TOC entry 258 (class 1259 OID 16595)
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
-- TOC entry 5080 (class 2604 OID 16989)
-- Name: logs id; Type: DEFAULT; Schema: auditoria; Owner: postgres
--

ALTER TABLE ONLY auditoria.logs ALTER COLUMN id SET DEFAULT nextval('auditoria.logs_id_seq'::regclass);


--
-- TOC entry 5017 (class 2604 OID 16600)
-- Name: audit_trail id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_trail ALTER COLUMN id SET DEFAULT nextval('public.audit_trail_id_seq'::regclass);


--
-- TOC entry 5077 (class 2604 OID 16962)
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- TOC entry 5020 (class 2604 OID 16601)
-- Name: document_signatures id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_signatures ALTER COLUMN id SET DEFAULT nextval('public.document_signatures_id_seq'::regclass);


--
-- TOC entry 5022 (class 2604 OID 16602)
-- Name: documents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents ALTER COLUMN id SET DEFAULT nextval('public.documents_id_seq'::regclass);


--
-- TOC entry 5027 (class 2604 OID 16603)
-- Name: employees id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);


--
-- TOC entry 5030 (class 2604 OID 16604)
-- Name: inventory id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory ALTER COLUMN id SET DEFAULT nextval('public.inventory_id_seq'::regclass);


--
-- TOC entry 5034 (class 2604 OID 16605)
-- Name: inventory_movements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_movements ALTER COLUMN id SET DEFAULT nextval('public.inventory_movements_id_seq'::regclass);


--
-- TOC entry 5037 (class 2604 OID 16606)
-- Name: request_approvals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_approvals ALTER COLUMN id SET DEFAULT nextval('public.request_approvals_id_seq'::regclass);


--
-- TOC entry 5039 (class 2604 OID 16607)
-- Name: request_attachments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_attachments ALTER COLUMN id SET DEFAULT nextval('public.request_attachments_id_seq'::regclass);


--
-- TOC entry 5041 (class 2604 OID 16608)
-- Name: request_status_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_status_history ALTER COLUMN id SET DEFAULT nextval('public.request_status_history_id_seq'::regclass);


--
-- TOC entry 5043 (class 2604 OID 16609)
-- Name: request_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_types ALTER COLUMN id SET DEFAULT nextval('public.request_types_id_seq'::regclass);


--
-- TOC entry 5045 (class 2604 OID 16610)
-- Name: request_versions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_versions ALTER COLUMN id SET DEFAULT nextval('public.request_versions_id_seq'::regclass);


--
-- TOC entry 5047 (class 2604 OID 16611)
-- Name: requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requests ALTER COLUMN id SET DEFAULT nextval('public.requests_id_seq'::regclass);


--
-- TOC entry 5075 (class 2604 OID 16950)
-- Name: user_sessions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions ALTER COLUMN id SET DEFAULT nextval('public.user_sessions_id_seq'::regclass);


--
-- TOC entry 5053 (class 2604 OID 16612)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 5056 (class 2604 OID 16613)
-- Name: cronograma_capacitacion id_capacitacion; Type: DEFAULT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_capacitacion ALTER COLUMN id_capacitacion SET DEFAULT nextval('servicio.cronograma_capacitacion_id_capacitacion_seq'::regclass);


--
-- TOC entry 5060 (class 2604 OID 16614)
-- Name: cronograma_mantenimientos id_mantenimiento; Type: DEFAULT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos ALTER COLUMN id_mantenimiento SET DEFAULT nextval('servicio.cronograma_mantenimientos_id_mantenimiento_seq'::regclass);


--
-- TOC entry 5067 (class 2604 OID 16615)
-- Name: cronograma_mantenimientos_anuales id_mant_anual; Type: DEFAULT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos_anuales ALTER COLUMN id_mant_anual SET DEFAULT nextval('servicio.cronograma_mantenimientos_anuales_id_mant_anual_seq'::regclass);


--
-- TOC entry 5071 (class 2604 OID 16616)
-- Name: equipos id_equipo; Type: DEFAULT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.equipos ALTER COLUMN id_equipo SET DEFAULT nextval('servicio.equipos_id_equipo_seq'::regclass);


--
-- TOC entry 5171 (class 2606 OID 16995)
-- Name: logs logs_pkey; Type: CONSTRAINT; Schema: auditoria; Owner: postgres
--

ALTER TABLE ONLY auditoria.logs
    ADD CONSTRAINT logs_pkey PRIMARY KEY (id);


--
-- TOC entry 5096 (class 2606 OID 16618)
-- Name: audit_trail audit_trail_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_trail
    ADD CONSTRAINT audit_trail_pkey PRIMARY KEY (id);


--
-- TOC entry 5084 (class 2606 OID 16619)
-- Name: inventory_movements chk_inventory_movements_type; Type: CHECK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE public.inventory_movements
    ADD CONSTRAINT chk_inventory_movements_type CHECK ((type = ANY (ARRAY['in'::text, 'out'::text]))) NOT VALID;


--
-- TOC entry 5086 (class 2606 OID 16620)
-- Name: request_approvals chk_request_approvals_action; Type: CHECK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE public.request_approvals
    ADD CONSTRAINT chk_request_approvals_action CHECK (((action IS NULL) OR (action = ANY (ARRAY['approve'::text, 'reject'::text])))) NOT VALID;


--
-- TOC entry 5163 (class 2606 OID 16973)
-- Name: departments departments_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_code_key UNIQUE (code);


--
-- TOC entry 5165 (class 2606 OID 16971)
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- TOC entry 5101 (class 2606 OID 16622)
-- Name: document_signatures document_signatures_document_id_signer_user_id_role_at_sign_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_signatures
    ADD CONSTRAINT document_signatures_document_id_signer_user_id_role_at_sign_key UNIQUE (document_id, signer_user_id, role_at_sign);


--
-- TOC entry 5103 (class 2606 OID 16624)
-- Name: document_signatures document_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_signatures
    ADD CONSTRAINT document_signatures_pkey PRIMARY KEY (id);


--
-- TOC entry 5105 (class 2606 OID 16626)
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- TOC entry 5108 (class 2606 OID 16628)
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- TOC entry 5115 (class 2606 OID 16630)
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- TOC entry 5110 (class 2606 OID 16632)
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- TOC entry 5112 (class 2606 OID 16634)
-- Name: inventory inventory_sku_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_sku_key UNIQUE (sku);


--
-- TOC entry 5118 (class 2606 OID 16636)
-- Name: request_approvals request_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_approvals
    ADD CONSTRAINT request_approvals_pkey PRIMARY KEY (id);


--
-- TOC entry 5120 (class 2606 OID 16638)
-- Name: request_approvals request_approvals_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_approvals
    ADD CONSTRAINT request_approvals_token_key UNIQUE (token);


--
-- TOC entry 5123 (class 2606 OID 16640)
-- Name: request_attachments request_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_attachments
    ADD CONSTRAINT request_attachments_pkey PRIMARY KEY (id);


--
-- TOC entry 5126 (class 2606 OID 16642)
-- Name: request_status_history request_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_status_history
    ADD CONSTRAINT request_status_history_pkey PRIMARY KEY (id);


--
-- TOC entry 5129 (class 2606 OID 16644)
-- Name: request_types request_types_code_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_types
    ADD CONSTRAINT request_types_code_unique UNIQUE (code);


--
-- TOC entry 5131 (class 2606 OID 16646)
-- Name: request_types request_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_types
    ADD CONSTRAINT request_types_pkey PRIMARY KEY (id);


--
-- TOC entry 5133 (class 2606 OID 16648)
-- Name: request_versions request_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_versions
    ADD CONSTRAINT request_versions_pkey PRIMARY KEY (id);


--
-- TOC entry 5139 (class 2606 OID 16650)
-- Name: requests requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_pkey PRIMARY KEY (id);


--
-- TOC entry 5161 (class 2606 OID 16957)
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 5141 (class 2606 OID 16652)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 5143 (class 2606 OID 16654)
-- Name: users users_google_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_google_id_key UNIQUE (google_id);


--
-- TOC entry 5145 (class 2606 OID 16656)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 5147 (class 2606 OID 16658)
-- Name: cronograma_capacitacion cronograma_capacitacion_pkey; Type: CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_capacitacion
    ADD CONSTRAINT cronograma_capacitacion_pkey PRIMARY KEY (id_capacitacion);


--
-- TOC entry 5155 (class 2606 OID 16660)
-- Name: cronograma_mantenimientos_anuales cronograma_mantenimientos_anuales_pkey; Type: CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos_anuales
    ADD CONSTRAINT cronograma_mantenimientos_anuales_pkey PRIMARY KEY (id_mant_anual);


--
-- TOC entry 5149 (class 2606 OID 17052)
-- Name: cronograma_mantenimientos cronograma_mantenimientos_id_unique; Type: CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos
    ADD CONSTRAINT cronograma_mantenimientos_id_unique UNIQUE (id);


--
-- TOC entry 5151 (class 2606 OID 16662)
-- Name: cronograma_mantenimientos cronograma_mantenimientos_pkey; Type: CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos
    ADD CONSTRAINT cronograma_mantenimientos_pkey PRIMARY KEY (id_mantenimiento);


--
-- TOC entry 5157 (class 2606 OID 16664)
-- Name: equipos equipos_nombre_key; Type: CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.equipos
    ADD CONSTRAINT equipos_nombre_key UNIQUE (nombre);


--
-- TOC entry 5159 (class 2606 OID 16666)
-- Name: equipos equipos_pkey; Type: CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.equipos
    ADD CONSTRAINT equipos_pkey PRIMARY KEY (id_equipo);


--
-- TOC entry 5166 (class 1259 OID 16999)
-- Name: idx_auditoria_accion; Type: INDEX; Schema: auditoria; Owner: postgres
--

CREATE INDEX idx_auditoria_accion ON auditoria.logs USING btree (accion);


--
-- TOC entry 5167 (class 1259 OID 16996)
-- Name: idx_auditoria_fecha; Type: INDEX; Schema: auditoria; Owner: postgres
--

CREATE INDEX idx_auditoria_fecha ON auditoria.logs USING btree (fecha DESC);


--
-- TOC entry 5168 (class 1259 OID 16998)
-- Name: idx_auditoria_modulo; Type: INDEX; Schema: auditoria; Owner: postgres
--

CREATE INDEX idx_auditoria_modulo ON auditoria.logs USING btree (modulo);


--
-- TOC entry 5169 (class 1259 OID 16997)
-- Name: idx_auditoria_usuario; Type: INDEX; Schema: auditoria; Owner: postgres
--

CREATE INDEX idx_auditoria_usuario ON auditoria.logs USING btree (usuario_email);


--
-- TOC entry 5097 (class 1259 OID 16826)
-- Name: idx_audit_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_created_at ON public.audit_trail USING btree (created_at DESC);


--
-- TOC entry 5098 (class 1259 OID 16825)
-- Name: idx_audit_module_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_module_action ON public.audit_trail USING btree (module, action);


--
-- TOC entry 5099 (class 1259 OID 16827)
-- Name: idx_audit_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_user ON public.audit_trail USING btree (user_id);


--
-- TOC entry 5106 (class 1259 OID 16667)
-- Name: idx_documents_request_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_request_id ON public.documents USING btree (request_id);


--
-- TOC entry 5113 (class 1259 OID 16668)
-- Name: idx_inventory_movements_inventory; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_movements_inventory ON public.inventory_movements USING btree (inventory_id);


--
-- TOC entry 5116 (class 1259 OID 16669)
-- Name: idx_request_approvals_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_request_approvals_pending ON public.request_approvals USING btree (used, token_expires_at);


--
-- TOC entry 5121 (class 1259 OID 16670)
-- Name: idx_request_attachments_request; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_request_attachments_request ON public.request_attachments USING btree (request_id);


--
-- TOC entry 5127 (class 1259 OID 16671)
-- Name: idx_request_types_schema_gin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_request_types_schema_gin ON public.request_types USING gin (schema);


--
-- TOC entry 5135 (class 1259 OID 16672)
-- Name: idx_requests_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requests_created_at ON public.requests USING btree (created_at);


--
-- TOC entry 5136 (class 1259 OID 16673)
-- Name: idx_requests_payload_gin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requests_payload_gin ON public.requests USING gin (payload);


--
-- TOC entry 5137 (class 1259 OID 16674)
-- Name: idx_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requests_status ON public.requests USING btree (status);


--
-- TOC entry 5124 (class 1259 OID 16675)
-- Name: idx_rsh_request_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsh_request_id ON public.request_status_history USING btree (request_id);


--
-- TOC entry 5134 (class 1259 OID 16676)
-- Name: uidx_request_versions_req_ver; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uidx_request_versions_req_ver ON public.request_versions USING btree (request_id, version_number);


--
-- TOC entry 5152 (class 1259 OID 17071)
-- Name: idx_cronograma_mantenimientos_next_status; Type: INDEX; Schema: servicio; Owner: postgres
--

CREATE INDEX idx_cronograma_mantenimientos_next_status ON servicio.cronograma_mantenimientos USING btree (next_maintenance_status);


--
-- TOC entry 5153 (class 1259 OID 17053)
-- Name: idx_cronograma_mantenimientos_request_id; Type: INDEX; Schema: servicio; Owner: postgres
--

CREATE INDEX idx_cronograma_mantenimientos_request_id ON servicio.cronograma_mantenimientos USING btree (request_id);


--
-- TOC entry 5193 (class 2620 OID 16677)
-- Name: documents trg_documents_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- TOC entry 5194 (class 2620 OID 17031)
-- Name: inventory_movements trg_inventory_after_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_inventory_after_delete AFTER DELETE ON public.inventory_movements FOR EACH ROW EXECUTE FUNCTION public.recalculate_inventory();


--
-- TOC entry 5195 (class 2620 OID 17029)
-- Name: inventory_movements trg_inventory_after_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_inventory_after_insert AFTER INSERT ON public.inventory_movements FOR EACH ROW EXECUTE FUNCTION public.recalculate_inventory();


--
-- TOC entry 5196 (class 2620 OID 17030)
-- Name: inventory_movements trg_inventory_after_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_inventory_after_update AFTER UPDATE ON public.inventory_movements FOR EACH ROW EXECUTE FUNCTION public.recalculate_inventory();


--
-- TOC entry 5198 (class 2620 OID 16678)
-- Name: requests trg_log_request_status; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_log_request_status AFTER UPDATE OF status ON public.requests FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION public.fn_log_request_status();


--
-- TOC entry 5197 (class 2620 OID 16679)
-- Name: request_types trg_request_types_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_request_types_updated_at BEFORE UPDATE ON public.request_types FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- TOC entry 5199 (class 2620 OID 16680)
-- Name: requests trg_requests_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_requests_updated_at BEFORE UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- TOC entry 5200 (class 2620 OID 16681)
-- Name: users trg_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- TOC entry 5201 (class 2620 OID 16682)
-- Name: cronograma_capacitacion capacitacion_update_timestamp; Type: TRIGGER; Schema: servicio; Owner: postgres
--

CREATE TRIGGER capacitacion_update_timestamp BEFORE UPDATE ON servicio.cronograma_capacitacion FOR EACH ROW EXECUTE FUNCTION servicio.update_timestamp();


--
-- TOC entry 5204 (class 2620 OID 16683)
-- Name: equipos equipos_update_timestamp; Type: TRIGGER; Schema: servicio; Owner: postgres
--

CREATE TRIGGER equipos_update_timestamp BEFORE UPDATE ON servicio.equipos FOR EACH ROW EXECUTE FUNCTION servicio.update_timestamp();


--
-- TOC entry 5203 (class 2620 OID 16684)
-- Name: cronograma_mantenimientos_anuales mantenimiento_anual_update_timestamp; Type: TRIGGER; Schema: servicio; Owner: postgres
--

CREATE TRIGGER mantenimiento_anual_update_timestamp BEFORE UPDATE ON servicio.cronograma_mantenimientos_anuales FOR EACH ROW EXECUTE FUNCTION servicio.update_timestamp();


--
-- TOC entry 5202 (class 2620 OID 16685)
-- Name: cronograma_mantenimientos mantenimiento_update_timestamp; Type: TRIGGER; Schema: servicio; Owner: postgres
--

CREATE TRIGGER mantenimiento_update_timestamp BEFORE UPDATE ON servicio.cronograma_mantenimientos FOR EACH ROW EXECUTE FUNCTION servicio.update_timestamp();


--
-- TOC entry 5172 (class 2606 OID 16686)
-- Name: document_signatures document_signatures_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_signatures
    ADD CONSTRAINT document_signatures_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- TOC entry 5173 (class 2606 OID 16691)
-- Name: document_signatures document_signatures_signer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_signatures
    ADD CONSTRAINT document_signatures_signer_user_id_fkey FOREIGN KEY (signer_user_id) REFERENCES public.users(id);


--
-- TOC entry 5174 (class 2606 OID 16696)
-- Name: documents documents_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE CASCADE;


--
-- TOC entry 5175 (class 2606 OID 16701)
-- Name: documents documents_request_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_request_type_id_fkey FOREIGN KEY (request_type_id) REFERENCES public.request_types(id) ON DELETE CASCADE;


--
-- TOC entry 5187 (class 2606 OID 16974)
-- Name: users fk_users_department; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_department FOREIGN KEY (department_id) REFERENCES public.departments(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 5188 (class 2606 OID 16979)
-- Name: users fk_users_departments; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_departments FOREIGN KEY (department_id) REFERENCES public.departments(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 5176 (class 2606 OID 16706)
-- Name: inventory_movements inventory_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 5177 (class 2606 OID 16711)
-- Name: inventory_movements inventory_movements_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id);


--
-- TOC entry 5178 (class 2606 OID 16716)
-- Name: request_approvals request_approvals_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_approvals
    ADD CONSTRAINT request_approvals_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id);


--
-- TOC entry 5179 (class 2606 OID 16721)
-- Name: request_approvals request_approvals_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_approvals
    ADD CONSTRAINT request_approvals_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id);


--
-- TOC entry 5180 (class 2606 OID 16726)
-- Name: request_attachments request_attachments_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_attachments
    ADD CONSTRAINT request_attachments_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id);


--
-- TOC entry 5181 (class 2606 OID 16731)
-- Name: request_attachments request_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_attachments
    ADD CONSTRAINT request_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- TOC entry 5182 (class 2606 OID 16736)
-- Name: request_status_history request_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_status_history
    ADD CONSTRAINT request_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- TOC entry 5183 (class 2606 OID 16741)
-- Name: request_status_history request_status_history_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_status_history
    ADD CONSTRAINT request_status_history_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE CASCADE;


--
-- TOC entry 5184 (class 2606 OID 16746)
-- Name: request_versions request_versions_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_versions
    ADD CONSTRAINT request_versions_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id);


--
-- TOC entry 5185 (class 2606 OID 16751)
-- Name: requests requests_request_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_request_type_id_fkey FOREIGN KEY (request_type_id) REFERENCES public.request_types(id) ON DELETE CASCADE;


--
-- TOC entry 5186 (class 2606 OID 16756)
-- Name: requests requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id);


--
-- TOC entry 5192 (class 2606 OID 16761)
-- Name: cronograma_mantenimientos_anuales cronograma_mantenimientos_anuales_id_equipo_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos_anuales
    ADD CONSTRAINT cronograma_mantenimientos_anuales_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES servicio.equipos(id_equipo) ON DELETE CASCADE;


--
-- TOC entry 5189 (class 2606 OID 17059)
-- Name: cronograma_mantenimientos cronograma_mantenimientos_created_by_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos
    ADD CONSTRAINT cronograma_mantenimientos_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5190 (class 2606 OID 16766)
-- Name: cronograma_mantenimientos cronograma_mantenimientos_id_equipo_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos
    ADD CONSTRAINT cronograma_mantenimientos_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES servicio.equipos(id_equipo) ON DELETE CASCADE;


--
-- TOC entry 5191 (class 2606 OID 17054)
-- Name: cronograma_mantenimientos cronograma_mantenimientos_request_fk; Type: FK CONSTRAINT; Schema: servicio; Owner: postgres
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos
    ADD CONSTRAINT cronograma_mantenimientos_request_fk FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE SET NULL;


--
-- TOC entry 5389 (class 0 OID 0)
-- Dependencies: 265
-- Name: TABLE v_inventario_completo; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.v_inventario_completo TO PUBLIC;


-- Completed on 2025-11-17 13:05:24

--
-- PostgreSQL database dump complete
--

\unrestrict VkjFoPSLc2l6jg5iQinGtXi2bjMGk1rZZcUP4g3PdRExgef4Xol50hb3aDcm0XP

