-- Migration 268: align Business Case investment catalog with March 2026 Sheet format.

ALTER TABLE public.bc_investment_catalog
  ADD COLUMN IF NOT EXISTS display_order integer;

WITH desired(display_order, name, investment_class) AS (
  VALUES
    (1, 'Control externo de tercera opinión', 'financiera'),
    (2, 'Control interno interlaboratorial', 'financiera'),
    (3, 'Póliza de Fiel Cumplimiento del Contrato', 'financiera'),
    (4, 'Póliza de seguro de equipos', 'financiera'),
    (5, 'Ups equipo', 'operativa'),
    (6, 'Ups servidor', 'operativa'),
    (7, 'LIS', 'financiera'),
    (8, 'Interfaz', 'financiera'),
    (9, 'Lantronix', 'operativa'),
    (10, 'IP publica', 'financiera'),
    (11, 'Punto de consulta web', 'operativa'),
    (12, 'Internet', 'financiera'),
    (13, 'Router para Internet', 'operativa'),
    (14, 'Servidor', 'operativa'),
    (15, 'Computadores', 'operativa'),
    (16, 'Mantenimiento Computador', 'financiera'),
    (17, 'Impresora', 'operativa'),
    (18, 'Mantenimiento Impresora', 'financiera'),
    (19, 'Tinta', 'operativa'),
    (20, 'Toner para impresora de equipos (en caso de dejar las impresoras)', 'operativa'),
    (21, 'Impresora Zebra Termica ZD230 ETHERNET Y USB', 'operativa'),
    (22, 'Mantenimiento Impresora Zebra Termica ZD230 ETHERNET Y USB', 'financiera'),
    (23, 'Lector inalambrico de codigo de barra', 'operativa'),
    (24, 'Sistema de destilación de agua pequeño', 'operativa'),
    (25, 'Sistema de osmosis', 'operativa'),
    (26, 'Mantenimiento sistema de osmosis', 'financiera'),
    (27, 'Sistema de prefiltracion', 'operativa'),
    (28, 'Mantenimiento sistema pre filtración', 'financiera'),
    (29, 'Tanque para resina mixta (muerta)', 'operativa'),
    (30, 'Estructura de proteccion para sistema de agua', 'operativa'),
    (31, 'MEMBRANE EQ.OSMOSIS, AG2521TF 2.5 diam', 'operativa'),
    (32, 'FILTER NOM. P/SEDIMENTS PX10-20XX PURTR (CARBON - AZUL)', 'operativa'),
    (33, 'FILTER NOM.P/SEDIMENTS GX05-20XX HYTREX (FIBRA - PAPEL - PAPEL)', 'operativa'),
    (34, 'RESINA IONICA REGENERADA 20 "', 'operativa'),
    (35, 'RESINA MUERTA 16kilos', 'operativa'),
    (36, 'Sal en grano x quintal', 'operativa'),
    (37, 'Modificaciones de espacio fisico - estructura', 'financiera'),
    (38, 'Modificaciones de espacio fisico - mobiliario', 'financiera'),
    (39, 'Climatizacion del area', 'financiera'),
    (40, 'Mantenimiento Climatizacion', 'financiera'),
    (41, 'Rollo de cable UTP CAT5e x 100m', 'operativa'),
    (42, 'Conector RJ45 Delta CAT5E x 50 unds', 'operativa'),
    (43, 'Rack Cerrado POWEST 5UR', 'operativa'),
    (44, 'Switch HP Aruba Ion 5 puertos', 'operativa'),
    (45, 'Switch HP Aruba Ion 1430 24 puertos', 'operativa'),
    (46, 'Extensiones y cortapicos', 'operativa'),
    (47, 'Extras (tairas, canaletas, espiral plastico)', 'operativa'),
    (48, 'Etiquetas', 'operativa'),
    (49, 'A4 printer paper', 'operativa'),
    (50, 'Refrigerador panorámico', 'operativa'),
    (51, 'Mantenimiento Refrigerador panorámico', 'financiera'),
    (52, 'Refrigerador médico', 'operativa'),
    (53, 'Mantenimiento Refrigerador médico', 'financiera'),
    (54, 'Termometro para refrigerador', 'operativa'),
    (55, 'Termohigrometros', 'operativa'),
    (56, 'Cronometros digitales', 'operativa'),
    (57, 'Centrifuga', 'operativa'),
    (58, 'Mantenimiento Centrifuga', 'financiera'),
    (59, 'Servicio Logisticos Proveedores', 'financiera'),
    (60, 'Servicio Logisticos Clientes', 'financiera'),
    (61, 'Ampolla de agua bidestilada', 'operativa'),
    (62, 'Agua destilada por galón', 'operativa'),
    (63, 'Hisopos x 100 uds', 'operativa'),
    (64, 'Gasas x 100 uds', 'operativa'),
    (65, 'Alcohol prepad 10 x 100 uds', 'operativa'),
    (66, 'Tubos eppendorf X 500 UDS', 'operativa'),
    (67, 'Otros', 'operativa')
),
updated AS (
  UPDATE public.bc_investment_catalog c
  SET name = d.name,
      code = lower(regexp_replace(translate(d.name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'), '[^a-zA-Z0-9]+', '_', 'g')),
      investment_class = d.investment_class,
      display_order = d.display_order,
      is_active = true,
      updated_at = now()
  FROM desired d
  WHERE c.display_order = d.display_order
  RETURNING c.display_order
)
INSERT INTO public.bc_investment_catalog (code, name, investment_class, display_order, is_active)
SELECT
  lower(regexp_replace(translate(d.name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'), '[^a-zA-Z0-9]+', '_', 'g')),
  d.name,
  d.investment_class,
  d.display_order,
  true
FROM desired d
WHERE NOT EXISTS (SELECT 1 FROM updated u WHERE u.display_order = d.display_order);

WITH desired(display_order) AS (
  SELECT generate_series(1, 67)
)
UPDATE public.bc_investment_catalog c
SET is_active = false,
    display_order = NULL,
    updated_at = now()
WHERE NOT EXISTS (
  SELECT 1
  FROM desired d
  WHERE d.display_order = c.display_order
);

CREATE INDEX IF NOT EXISTS idx_bc_investment_catalog_display_order
  ON public.bc_investment_catalog (display_order)
  WHERE is_active = true;
