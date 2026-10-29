/**
 * Migration: 082_add_bc_investment_catalog.sql
 * Catalogo fijo de inversiones adicionales + selecciones por Business Case
 */

CREATE TABLE IF NOT EXISTS public.bc_investment_catalog (
  id serial PRIMARY KEY,
  code text UNIQUE,
  name text NOT NULL,
  category text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bc_investment_selections (
  id serial PRIMARY KEY,
  business_case_id uuid NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  catalog_id integer NOT NULL REFERENCES public.bc_investment_catalog(id) ON DELETE CASCADE,
  selected boolean NOT NULL DEFAULT true,
  notes text,
  updated_by_role text,
  updated_by_email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_bc_investment_selections
  ON public.bc_investment_selections (business_case_id, catalog_id);

CREATE INDEX IF NOT EXISTS idx_bc_investment_selections_bc
  ON public.bc_investment_selections (business_case_id);

CREATE INDEX IF NOT EXISTS idx_bc_investment_selections_catalog
  ON public.bc_investment_selections (catalog_id);

WITH items(name) AS (
  VALUES
    ('Control externo de tercera opinión'),
    ('Control interno interlaboratorial'),
    ('Póliza de Fiel Cumplimiento del Contrato'),
    ('Póliza de seguro de equipos'),
    ('Ups equipo'),
    ('Ups servidor'),
    ('LIS'),
    ('Interfaz'),
    ('Lantronix'),
    ('IP publica'),
    ('Punto de consulta web'),
    ('Internet'),
    ('Router para Internet'),
    ('Servidor'),
    ('Computadores'),
    ('Mantenimiento Computador'),
    ('Impresora'),
    ('Man'),
    ('Tinta'),
    ('Toner para impresora de equipos (en caso de dejar las impresoras)'),
    ('Impresora Zebra Termica ZD230 ETHERNET Y USB'),
    ('Lector inalambrico de codigo de barra'),
    ('Sistema de destilación de agua pequeño'),
    ('Sistema de osmosis'),
    ('Mantenimiento sistema de osmosis'),
    ('Sistema de prefiltracion'),
    ('Mantenimiento sistema pre filtración'),
    ('Tanque para resina mixta (muerta)'),
    ('Estructura de proteccion para sistema de agua'),
    ('MEMBRANE EQ.OSMOSIS, AG2521TF  2.5 diam'),
    ('FILTER NOM. P/SEDIMENTS PX10-20XX  PURTR (CARBON - AZUL)'),
    ('FILTER NOM.P/SEDIMENTS GX05-20XX  HYTREX (FIBRA - PAPEL - PAPEL)'),
    ('RESINA IONICA REGENERADA 20 "'),
    ('RESINA MUERTA 16kilos'),
    ('Sal en grano x quintal'),
    ('Modificaciones de espacio fisico - estructura'),
    ('Modificaciones de espacio fisico - mobiliario'),
    ('Climatizacion del area'),
    ('Rollo de cable UTP CAT5e x 100m'),
    ('Conector RJ45 Delta CAT5E x 50 unds'),
    ('Rack Cerrado POWEST 5UR'),
    ('Switch HP Aruba Ion 5 puertos'),
    ('Switch HP Aruba Ion 1430 24 puertos'),
    ('Extensiones y cortapicos'),
    ('Extras (tairas, canaletas, espiral plastico)'),
    ('Etiquetas'),
    ('A4 printer paper'),
    ('Refrigerador panorámico'),
    ('Refrigerador médico'),
    ('Termometro para refrigerador'),
    ('Termohigrometros'),
    ('Cronometros digitales'),
    ('Centrifuga'),
    ('Servicio Logisticos Proveedores'),
    ('Servicio Logisticos Clientes'),
    ('Ampolla de agua bidestilada'),
    ('Agua destilada por galón'),
    ('Hisopos x 100 uds'),
    ('Gasas x 100 uds'),
    ('Alcohol prepad 10 x 100 uds'),
    ('Tubos eppendorf X 500 UDS'),
    ('Otros')
)
INSERT INTO public.bc_investment_catalog (code, name)
SELECT
  lower(regexp_replace(name, '[^a-zA-Z0-9]+', '_', 'g')),
  name
FROM items
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE public.bc_investment_catalog IS 'Catálogo fijo de inversiones adicionales para Business Case';
COMMENT ON TABLE public.bc_investment_selections IS 'Selecciones de inversiones por Business Case';
