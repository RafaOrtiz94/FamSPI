-- Migration 267: normalize Business Case investment catalog names and display order.

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
    (18, 'Man', 'operativa'),
    (19, 'Tinta', 'operativa'),
    (20, 'Toner para impresora de equipos (en caso de dejar las impresoras)', 'operativa'),
    (21, 'Impresora Zebra Termica ZD230 ETHERNET Y USB', 'operativa'),
    (22, 'Lector inalambrico de codigo de barra', 'operativa'),
    (23, 'Sistema de destilación de agua pequeño', 'operativa'),
    (24, 'Sistema de osmosis', 'operativa'),
    (25, 'Mantenimiento sistema de osmosis', 'financiera'),
    (26, 'Sistema de prefiltracion', 'operativa'),
    (27, 'Mantenimiento sistema pre filtración', 'financiera'),
    (28, 'Tanque para resina mixta (muerta)', 'operativa'),
    (29, 'Estructura de proteccion para sistema de agua', 'operativa'),
    (30, 'MEMBRANE EQ.OSMOSIS, AG2521TF  2.5 diam', 'operativa'),
    (31, 'FILTER NOM. P/SEDIMENTS PX10-20XX  PURTR (CARBON - AZUL)', 'operativa'),
    (32, 'FILTER NOM.P/SEDIMENTS GX05-20XX  HYTREX (FIBRA - PAPEL - PAPEL)', 'operativa'),
    (33, 'RESINA IONICA REGENERADA 20 "', 'operativa'),
    (34, 'RESINA MUERTA 16kilos', 'operativa'),
    (35, 'Sal en grano x quintal', 'operativa'),
    (36, 'Modificaciones de espacio fisico - estructura', 'financiera'),
    (37, 'Modificaciones de espacio fisico - mobiliario', 'financiera'),
    (38, 'Climatizacion del area', 'financiera'),
    (39, 'Rollo de cable UTP CAT5e x 100m', 'operativa'),
    (40, 'Conector RJ45 Delta CAT5E x 50 unds', 'operativa'),
    (41, 'Rack Cerrado POWEST 5UR', 'operativa'),
    (42, 'Switch HP Aruba Ion 5 puertos', 'operativa'),
    (43, 'Switch HP Aruba Ion 1430 24 puertos', 'operativa'),
    (44, 'Extensiones y cortapicos', 'operativa'),
    (45, 'Extras (tairas, canaletas, espiral plastico)', 'operativa'),
    (46, 'Etiquetas', 'operativa'),
    (47, 'A4 printer paper', 'operativa'),
    (48, 'Refrigerador panorámico', 'operativa'),
    (49, 'Refrigerador médico', 'operativa'),
    (50, 'Termometro para refrigerador', 'operativa'),
    (51, 'Termohigrometros', 'operativa'),
    (52, 'Cronometros digitales', 'operativa'),
    (53, 'Centrifuga', 'operativa'),
    (54, 'Servicio Logisticos Proveedores', 'financiera'),
    (55, 'Servicio Logisticos Clientes', 'financiera'),
    (56, 'Ampolla de agua bidestilada', 'operativa'),
    (57, 'Agua destilada por galón', 'operativa'),
    (58, 'Hisopos x 100 uds', 'operativa'),
    (59, 'Gasas x 100 uds', 'operativa'),
    (60, 'Alcohol prepad 10 x 100 uds', 'operativa'),
    (61, 'Tubos eppendorf X 500 UDS', 'operativa'),
    (62, 'Otros', 'operativa')
)
UPDATE public.bc_investment_catalog c
SET name = d.name,
    code = lower(regexp_replace(translate(d.name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'), '[^a-zA-Z0-9]+', '_', 'g')),
    investment_class = d.investment_class,
    display_order = d.display_order,
    is_active = true,
    updated_at = now()
FROM desired d
WHERE c.id = d.display_order;

WITH desired(display_order) AS (
  SELECT generate_series(1, 62)
)
UPDATE public.bc_investment_catalog c
SET is_active = false,
    display_order = NULL,
    updated_at = now()
WHERE NOT EXISTS (
  SELECT 1
  FROM desired d
  WHERE d.display_order = c.id
);

CREATE INDEX IF NOT EXISTS idx_bc_investment_catalog_display_order
  ON public.bc_investment_catalog (display_order)
  WHERE is_active = true;
