/**
 * Migration: 076_reseed_equipment_catalog_from_json.sql
 * Purpose: DEV-only reseed of equipment catalog + determinations/consumables from provided JSON.
 * WARNING: This truncates catalog/inventory tables. Use only in development.
 *
 * Report (pendiente catalogo FULL):
 * - Equipos añadidos: PENDIENTE_CATALOGO_FULL.md
 * - Total equipos sembrados: ver query de validación al final
 * - Insumos sin id_fabricante: se aplicó fallback a id_fabricante o code FAM-*
 */

-- ====== 1) TRUNCATE (DEV ONLY) ======
TRUNCATE TABLE
  catalog_equipment_consumables,
  catalog_determinations,
  catalog_consumables,
  equipment_price_history,
  bc_equipment_selection,
  servicio.cronograma_mantenimientos,
  servicio.cronograma_mantenimientos_anuales,
  servicio.equipos,
  equipment_maintenance_parts,
  equipment_models,
  equipos_historial,
  equipos_movimientos,
  equipos_unidad,
  equipos_modelo
RESTART IDENTITY CASCADE;

-- ====== 2) SEED DATA (JSON) ======
CREATE TEMP TABLE tmp_equipment_seed (
  id_fabricante text,
  descripcion text,
  fabricante text,
  modelo text,
  categoria text,
  licenciamiento text,
  observaciones text,
  insumos jsonb
);

INSERT INTO tmp_equipment_seed (id_fabricante, descripcion, fabricante, modelo, categoria, licenciamiento, observaciones, insumos)
SELECT
  item->>'id_fabricante',
  item->>'descripcion',
  item->>'fabricante',
  item->>'modelo',
  item->>'categoria',
  item->>'licenciamiento',
  item->>'observaciones',
  COALESCE(item->'insumos', '[]'::jsonb)
FROM jsonb_array_elements(
  '[
    {"id_fabricante":"6908764001","descripcion":"XP 300","categoria":"hematology","insumos":[
      {"tipo":"reactivo","parametro":"Biometria básica","id_fabricante":"3145611001","producto":"CELLPACK 20L"},
      {"tipo":"reactivo","parametro":"Biometria básica","id_fabricante":"12216540001","producto":"STROMA WH KX21 x 500ML"},
      {"tipo":"control","parametro":"Biometria básica","id_fabricante":"3134466001","producto":"EIGHT CHECK-3WP XTRA (4 X 2 ML)"},
      {"tipo":"consumible","parametro":"Biometria básica","id_fabricante":"3113353180","producto":"PAPER ROLL F.PRINTER STP211-144 (10PCS.)"}
    ]},
    {"id_fabricante":"7744820001","descripcion":"XNL 550","categoria":"hematology","licenciamiento":"con","nota":"Aplica para XNL 350/450/550","insumos":[
      {"tipo":"reactivo","parametro":"Biometria básica","id_fabricante":"6510167001","producto":"CELLPACK DCL"},
      {"tipo":"reactivo","parametro":"Biometria básica","id_fabricante":"3337006001","producto":"SULFOLYSER REAGENT X 5L"},
      {"tipo":"reactivo","parametro":"Biometria básica","id_fabricante":"12215616001","producto":"SULFOLYSER REAGENT 500 ml"},
      {"tipo":"reactivo","parametro":"Biometria básica","id_fabricante":"7837984001","producto":"WDF Lysercell WDF"},
      {"tipo":"reactivo","parametro":"Biometria básica","id_fabricante":"6510256001","producto":"WDF Fluorocell WDF 2X42 ML"},
      {"tipo":"consumible","parametro":"Biometria básica","id_fabricante":"6952291001","producto":"CELLCLEAN AUTO 4 ML X 20"},
      {"tipo":"control","parametro":"Biometria básica","id_fabricante":"7051506001","producto":"XN Check 12x3.0ml Level 1,2,3"},
      {"tipo":"reactivo","parametro":"Reticulocitos","id_fabricante":"6510272001","producto":"FLUOROCELL RET 2 X 12ML"},
      {"tipo":"reactivo","parametro":"Reticulocitos","id_fabricante":"9426752001","producto":"CELLPACK DFL 1 L"},
      {"tipo":"control","parametro":"Líquidos","id_fabricante":"7051409001","producto":"XN-Check BF 6x3.0ml Level 1,2"}
    ]},
    {"id_fabricante":null,"descripcion":"XN-1000","categoria":"hematology","insumos":[
      {"tipo":"reactivo","parametro":"Biometria básica","id_fabricante":"6510167001","producto":"CELLPACK DCL"},
      {"tipo":"reactivo","parametro":"Biometria básica","id_fabricante":"3337006001","producto":"SULFOLYSER REAGENT X 5L"},
      {"tipo":"reactivo","parametro":"Biometria básica","id_fabricante":"12215616001","producto":"SULFOLYSER REAGENT 500 ml"},
      {"tipo":"reactivo","parametro":"Biometria básica","id_fabricante":"7837984001","producto":"WDF Lysercell WDF"},
      {"tipo":"reactivo","parametro":"Biometria básica","id_fabricante":"6510256001","producto":"WDF Fluorocell WDF 2X42 ML"},
      {"tipo":"reactivo","parametro":"Biometria básica","id_fabricante":"6510248001","producto":"FLUOROCELL WNR 2 X 82ML"},
      {"tipo":"reactivo","parametro":"Biometria básica","id_fabricante":"7838000001","producto":"LYSERCELL-WNR WNR-210A"},
      {"tipo":"consumible","parametro":"Biometria básica","id_fabricante":"6952291001","producto":"CELLCLEAN AUTO 4 ML X 20"},
      {"tipo":"control","parametro":"Biometria básica","id_fabricante":"7051506001","producto":"XN Check 12x3.0ml Level 1,2,3"},
      {"tipo":"reactivo","parametro":"Plaquetas Fluorescentes","id_fabricante":"6510299001","producto":"FLUOROCELL PLT 2 X 12ML"},
      {"tipo":"reactivo","parametro":"Plaquetas Fluorescentes","id_fabricante":"9426752001","producto":"CELLPACK DFL 1 L"},
      {"tipo":"reactivo","parametro":"Reticulocitos","id_fabricante":"6510272001","producto":"FLUOROCELL RET 2 X 12ML"},
      {"tipo":"reactivo","parametro":"Reticulocitos","id_fabricante":"9426752001","producto":"CELLPACK DFL 1 L"},
      {"tipo":"control","parametro":"Líquidos","id_fabricante":"7051409001","producto":"XN-Check BF 6x3.0ml Level 1,2"}
    ]},
    {"id_fabricante":"4528778001","descripcion":"cobas c111","categoria":"chemistry","insumos":[
      {"tipo":"reactivo","parametro":null,"id_fabricante":"4657527190","producto":"Glucosa"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"4657616190","producto":"Urea"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"5401755190","producto":"Creatinina"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"4657608190","producto":"Acido Úrico"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"4718917190","producto":"Colesterol"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"4657594190","producto":"Triglicéridos"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"4718569190","producto":"ALT - TGP"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"4657543190","producto":"AST - TGO"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"4657373190","producto":"Fosfatasa alcalina"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"5795648190","producto":"Bilirrubina Total"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"5589134190","producto":"Bilirrubina Directa"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"7528604190","producto":"HDL Colesterol"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"5401496190","producto":"AMILASA"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"5401704190","producto":"LIPASA"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"5401461190","producto":"GGT"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"4657357190","producto":"Albumina"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"7005806190","producto":"LDL Colesterol"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"5061504190","producto":"Calcio"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"7442017190","producto":"CK"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"5401674190","producto":"LDH"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"5336180190","producto":"HbA1c"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"5401658190","producto":"Hierro"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"4657586190","producto":"Proteinas totales"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"7876432190","producto":"PCR latex"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"5077753190","producto":"D-Dimer"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"5401780190","producto":"Phosforo"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"5401739190","producto":"NH3L Ammonia"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"7442050190","producto":"CK-MB"},
      {"tipo":"calibrador","parametro":null,"id_fabricante":"10759350190","producto":"Calibrator f.a.s. 12x3 ml"},
      {"tipo":"calibrador","parametro":null,"id_fabricante":"12172623122","producto":"Cfas Lipids 3x1ML"},
      {"tipo":"calibrador","parametro":null,"id_fabricante":"11355279216","producto":"Cfas Proteins"},
      {"tipo":"calibrador","parametro":null,"id_fabricante":"4528417190","producto":"Cfas HbA1c, 3x2ml"},
      {"tipo":"calibrador","parametro":null,"id_fabricante":"20751995190","producto":"Ammonia/Ethanol/CO2 Calibrator"},
      {"tipo":"calibrador","parametro":null,"id_fabricante":"5050901190","producto":"Cfas D- Dimer"},
      {"tipo":"calibrador","parametro":null,"id_fabricante":"11447394216","producto":"Calibrator f.a.s. CK-MB"},
      {"tipo":"control","parametro":null,"id_fabricante":"5947626190","producto":"PreciControl ClinChem Multi 1 4x5ml"},
      {"tipo":"control","parametro":null,"id_fabricante":"5947774190","producto":"PreciControl ClinChem Multi 2 4x5ml"},
      {"tipo":"control","parametro":null,"id_fabricante":"5479207190","producto":"PreciControl HBA1c Norm"},
      {"tipo":"control","parametro":null,"id_fabricante":"5912504190","producto":"PRECICONTROL HBA1C PATH"},
      {"tipo":"control","parametro":null,"id_fabricante":"20752401190","producto":"Ammonia/Ethanol/CO2 Control Normal"},
      {"tipo":"control","parametro":null,"id_fabricante":"20753009190","producto":"Ammonia/Ethanol/CO2 Control Normal"},
      {"tipo":"control","parametro":null,"id_fabricante":"5050936190","producto":"PreciControl D- Dimer"},
      {"tipo":"consumible","parametro":null,"id_fabricante":"4774230190","producto":"NaCL 9% cobas c 111"},
      {"tipo":"consumible","parametro":null,"id_fabricante":"5007232190","producto":"HAEMOLYSE REAGENT 800T COBAS C111"},
      {"tipo":"consumible","parametro":null,"id_fabricante":"4663632190","producto":"Activator for cobas c,Integra,c111"},
      {"tipo":"consumible","parametro":null,"id_fabricante":"11298500316","producto":"ISE CLEANING SOLUTION 5x100ml"},
      {"tipo":"consumible","parametro":null,"id_fabricante":"20754765322","producto":"Cobas Integra Cleaner"},
      {"tipo":"consumible","parametro":null,"id_fabricante":"4357108001","producto":"Micro Cuvette Segment"},
      {"tipo":"consumible","parametro":null,"id_fabricante":"4444191001","producto":"Sample cup 250 St"},
      {"tipo":"consumible","parametro":null,"id_fabricante":"4352483001","producto":"URISYS Thermo-printer paper 5"},
      {"tipo":"consumible","parametro":null,"id_fabricante":"5344620001","producto":"LAMP HALOGEN 12V/20W ASSY"}
    ]},
    {"id_fabricante":"3157334001","descripcion":"SYSTEM, GENERIC, 9180","categoria":"bgm","insumos":[
      {"tipo":"reactivo","parametro":null,"id_fabricante":"3112349180","producto":"SNAPPAK, 9180 9181"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"3110435180","producto":"DEPROTEINIZER (125 ML)"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"3111555180","producto":"CLEANING SOLUTION 988-4"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"3110362180","producto":"SODIUM CONDITIONER"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"3110249180","producto":"URINE DILUENT, 125ML (tiempo en uso 5 meses)"},
      {"tipo":"control","parametro":null,"id_fabricante":"3112888180","producto":"ISETROL ELECTROLYTE CTRL L 1-3"},
      {"tipo":"consumible","parametro":null,"id_fabricante":"3112292018","producto":"PAPER 91XX SERIES PRINTER 5/PKG"},
      {"tipo":"material","parametro":null,"id_fabricante":"3110419180","producto":"AVL NA+ ELECTRODE"},
      {"tipo":"material","parametro":null,"id_fabricante":"3110338180","producto":"AVL K+ ELECTRODE"},
      {"tipo":"material","parametro":null,"id_fabricante":"3110354180","producto":"AVL CA+ ELECTRODE"},
      {"tipo":"material","parametro":null,"id_fabricante":"3110451180","producto":"AVL CL ECTRODE"},
      {"tipo":"material","parametro":null,"id_fabricante":"3112306180","producto":"ELECTRODE, ISE REFERENCE, 91XX"},
      {"tipo":"material","parametro":null,"id_fabricante":"3112284180","producto":"REFERENCE HOUSING"}
    ]},
    {"id_fabricante":"6699120001","descripcion":"cobas t411","categoria":"coagulation","insumos":[
      {"tipo":"reactivo","parametro":null,"id_fabricante":"7103352190","producto":"PT screen cobas t411 (10x10ml)"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"7103425190","producto":"aPTT MedS cobas t411 (20x5ml)"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"7103433190","producto":"aPTT LowS cobas t411 (10x10ml)"},
      {"tipo":"calibrador","parametro":null,"id_fabricante":"7142056190","producto":"PT Calibrator Set cobas t411 (5x1x1ml)"},
      {"tipo":"control","parametro":null,"id_fabricante":"7105100190","producto":"Control 1 cobas t411 (20x1ml)"},
      {"tipo":"control","parametro":null,"id_fabricante":"7105339190","producto":"Control 2 cobas t411 (20x1ml)"},
      {"tipo":"control","parametro":null,"id_fabricante":"7106912190","producto":"Control 4 cobas t411 (20x1ml)"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"6589367190","producto":"D-Dimer Gen. 2 cobas t411"},
      {"tipo":"control","parametro":null,"id_fabricante":"7310498190","producto":"D-Dimer Gen.2 Control I/II for t411"},
      {"tipo":"calibrador","parametro":null,"id_fabricante":"7311320190","producto":"D-Dimer Gen.2 Calibrator for t411"},
      {"tipo":"consumible","parametro":null,"id_fabricante":"7103484190","producto":"CC 25mM cobas t411 (10x15ml)"},
      {"tipo":"consumible","parametro":null,"id_fabricante":"7204736190","producto":"Day Clean (12x11ml)"},
      {"tipo":"consumible","parametro":null,"id_fabricante":"7255926190","producto":"CleanSol cobas t411 (12x5ml)"},
      {"tipo":"consumible","parametro":null,"id_fabricante":"5064210001","producto":"CPC / t 411 Cuvette bar"},
      {"tipo":"consumible","parametro":null,"id_fabricante":"4444191001","producto":"SAMPLE CUP"},
      {"tipo":"material","parametro":null,"id_fabricante":"FAM4","producto":"AGUA DESTILADA X GALON"},
      {"tipo":"material","parametro":null,"id_fabricante":null,"producto":"AMPOLLA DE AGUA BIDESTILADA"}
    ]},
    {"id_fabricante":"4901142190","descripcion":"cobas h 232 POC system","categoria":"poc","insumos":[
      {"tipo":"reactivo","parametro":null,"id_fabricante":"4877802190","producto":"Roche Cardiac Dimero D"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"4877900190","producto":"ROCHE CARDIAC CK-MB 10 TESTS (COBAS)"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"5533643190","producto":"ROCHE CARDIAC PROBNP+ 10 TESTS (COBAS)"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"7007302190","producto":"ROCHE CARDIAC POC TROP T FOR NEW SW VER."},
      {"tipo":"consumible","parametro":null,"id_fabricante":null,"producto":"Tubo tapa verde"}
    ]},
    {"id_fabricante":"5122279001","descripcion":"cobas b 123 POC system","categoria":"bgm","insumos":[
      {"tipo":"reactivo","parametro":null,"id_fabricante":"5169992001","producto":"FLUID PACK COOX 200"},
      {"tipo":"control","parametro":null,"id_fabricante":"3321207001","producto":"Combitrol Plus B, Level 2, 30 pcs"},
      {"tipo":"control","parametro":null,"id_fabricante":"3321193001","producto":"Combitrol Plus B, Level 1, 30 pcs"},
      {"tipo":"control","parametro":null,"id_fabricante":"3321215001","producto":"Combitrol Plus B, Level 3, 30 pcs"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"5170478001","producto":"Sensor Cartridge, BG/ISE/GLU/LAC"},
      {"tipo":"consumible","parametro":null,"id_fabricante":"5082595001","producto":"Printer paper, b123"},
      {"tipo":"consumible","parametro":null,"id_fabricante":"5689856001","producto":"CLOT CATCHER PRO"},
      {"tipo":"consumible","parametro":null,"id_fabricante":"3066762001","producto":"AMPOULE ADAPTER (150 PCS)"}
    ]},
    {"id_fabricante":"6378668190","descripcion":"cobas b101 Instrument","categoria":"poc","insumos":[
      {"tipo":"reactivo","parametro":null,"id_fabricante":"8038694190","producto":"COBAS B101 HBA1C TEST 10PC (DIA CLAIM)"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"6380115190","producto":"COBAS B 101 LIPID PANEL 10PC"}
    ]},
    {"id_fabricante":"4826876001","descripcion":"cobas 4000 c311","categoria":"chemistry","insumos":[]},
    {"id_fabricante":"9031529001","descripcion":"cobas Pure <303>","categoria":"chemistry","insumos":[]},
    {"id_fabricante":"8463662001","descripcion":"cobas Pro <503> ISE","categoria":"chemistry","insumos":[]},
    {"id_fabricante":"4775201001","descripcion":"cobas e411 rack","categoria":"immunology","insumos":[]},
    {"id_fabricante":"4775279001","descripcion":"cobas e411 disk","categoria":"immunology","insumos":[]},
    {"id_fabricante":"9031553001","descripcion":"cobas Pure <402>","categoria":"immunology","insumos":[]},
    {"id_fabricante":"8454345001","descripcion":"cobas 8000 <801>","categoria":"immunology","insumos":[]},
    {"id_fabricante":null,"descripcion":"cobas Pure <303 + 402>","categoria":"configuracion","insumos":[]},
    {"id_fabricante":null,"descripcion":"cobas Pro <503+801> ISE","categoria":"configuracion","insumos":[]},
    {"id_fabricante":"7745052001","descripcion":"XNL 350","categoria":"hematology","licenciamiento":"con","insumos":[]},
    {"id_fabricante":"7745052001","descripcion":"XNL 350","categoria":"hematology","licenciamiento":"sin","insumos":[]},
    {"id_fabricante":"7744862001","descripcion":"XNL 450","categoria":"hematology","licenciamiento":"con","insumos":[]},
    {"id_fabricante":"7744862001","descripcion":"XNL 450","categoria":"hematology","licenciamiento":"sin","insumos":[]},
    {"id_fabricante":"7744820001","descripcion":"XNL 550","categoria":"hematology","licenciamiento":"con","insumos":[]},
    {"id_fabricante":"7744820001","descripcion":"XNL 550","categoria":"hematology","licenciamiento":"sin","insumos":[]},
    {"id_fabricante":null,"descripcion":"XN-1000","categoria":"hematology","licenciamiento":"con","observaciones":"WG","insumos":[]},
    {"id_fabricante":null,"descripcion":"XN-1000","categoria":"hematology","licenciamiento":"sin","observaciones":"WG","insumos":[]},
    {"id_fabricante":null,"descripcion":"XN-1000","categoria":"hematology","licenciamiento":"con","observaciones":"sin WG","insumos":[]},
    {"id_fabricante":null,"descripcion":"XN-1000","categoria":"hematology","licenciamiento":"sin","observaciones":"sin WG","insumos":[]},
    {"id_fabricante":"6356460001","descripcion":"cobas t511","categoria":"coagulation","insumos":[]},
    {"id_fabricante":"3337154001","descripcion":"cobas b 221 Roche OMNI S6 system","categoria":"bgm","insumos":[]},
    {"id_fabricante":"490696901","descripcion":"cobas U 411 analyser w barcode","categoria":"urinalysis","insumos":[]},
    {"id_fabricante":null,"descripcion":"cobas 6500","categoria":"urinalysis","insumos":[
      {"tipo":"reactivo","parametro":null,"id_fabricante":"6390552001","producto":"cobas u cuvette (400 pc)"},
      {"tipo":"reactivo","parametro":null,"id_fabricante":"6334601001","producto":"cobas u pack (400 strips)"},
      {"tipo":"consumible","parametro":null,"id_fabricante":"6390579001","producto":"cobas U Calibration Strip, 25 Str."},
      {"tipo":"control","parametro":null,"id_fabricante":"8181004001","producto":"DIP & SPIN URINE CONTROL (1470-01)"},
      {"tipo":"consumible","parametro":null,"id_fabricante":"6390544001","producto":"WASTE BOX CARTON"}
    ]}
  ]'::jsonb
) AS item;

-- ====== 2b) NORMALIZE VARIANTS (HEMATOLOGY) ======
-- Remove empty variants to avoid duplicates
DELETE FROM tmp_equipment_seed
WHERE descripcion IN ('XNL 350','XNL 450','XNL 550')
  AND (insumos IS NULL OR insumos = '[]'::jsonb);

WITH base AS (
  SELECT insumos
  FROM tmp_equipment_seed
  WHERE descripcion = 'XNL 550'
    AND insumos <> '[]'::jsonb
  LIMIT 1
),
variants AS (
  SELECT * FROM (VALUES
    ('7744820001','XNL 550','sin',NULL),
    ('7745052001','XNL 350','con',NULL),
    ('7745052001','XNL 350','sin',NULL),
    ('7744862001','XNL 450','con',NULL),
    ('7744862001','XNL 450','sin',NULL)
  ) AS v(id_fabricante, descripcion, licenciamiento, observaciones)
)
INSERT INTO tmp_equipment_seed (id_fabricante, descripcion, fabricante, modelo, categoria, licenciamiento, observaciones, insumos)
SELECT
  v.id_fabricante,
  v.descripcion,
  NULL,
  NULL,
  'hematology',
  v.licenciamiento,
  v.observaciones,
  base.insumos
FROM base
JOIN variants v ON true
WHERE NOT EXISTS (
  SELECT 1
  FROM tmp_equipment_seed t
  WHERE t.descripcion = v.descripcion
    AND COALESCE(t.licenciamiento, '') = COALESCE(v.licenciamiento, '')
    AND COALESCE(t.observaciones, '') = COALESCE(v.observaciones, '')
);

-- Remove base XN-1000 row without licenciamiento to avoid duplicates
DELETE FROM tmp_equipment_seed
WHERE descripcion = 'XN-1000'
  AND (licenciamiento IS NULL OR licenciamiento = '');

-- Make variant descriptions unique (licenciamiento/observaciones)
UPDATE tmp_equipment_seed
SET descripcion = trim(concat_ws(' ',
  descripcion,
  CASE
    WHEN licenciamiento = 'con' THEN '(con licencias)'
    WHEN licenciamiento = 'sin' THEN '(sin licencias)'
    WHEN licenciamiento IS NOT NULL THEN '(' || licenciamiento || ')'
    ELSE NULL
  END,
  CASE
    WHEN observaciones IS NOT NULL AND observaciones <> '' THEN '[' || observaciones || ']'
    ELSE NULL
  END
))
WHERE (licenciamiento IS NOT NULL AND licenciamiento <> '')
   OR (observaciones IS NOT NULL AND observaciones <> '');

-- Normalize XN-1000 variants (WG / sin WG, con/sin)
DELETE FROM tmp_equipment_seed
WHERE descripcion = 'XN-1000'
  AND (insumos IS NULL OR insumos = '[]'::jsonb);

WITH base AS (
  SELECT insumos
  FROM tmp_equipment_seed
  WHERE descripcion = 'XN-1000'
    AND insumos <> '[]'::jsonb
  LIMIT 1
),
variants AS (
  SELECT * FROM (VALUES
    (NULL,'XN-1000','con','WG'),
    (NULL,'XN-1000','sin','WG'),
    (NULL,'XN-1000','con','sin WG'),
    (NULL,'XN-1000','sin','sin WG')
  ) AS v(id_fabricante, descripcion, licenciamiento, observaciones)
)
INSERT INTO tmp_equipment_seed (id_fabricante, descripcion, fabricante, modelo, categoria, licenciamiento, observaciones, insumos)
SELECT
  v.id_fabricante,
  v.descripcion,
  NULL,
  NULL,
  'hematology',
  v.licenciamiento,
  v.observaciones,
  base.insumos
FROM base
JOIN variants v ON true
WHERE NOT EXISTS (
  SELECT 1
  FROM tmp_equipment_seed t
  WHERE t.descripcion = v.descripcion
    AND COALESCE(t.licenciamiento, '') = COALESCE(v.licenciamiento, '')
    AND COALESCE(t.observaciones, '') = COALESCE(v.observaciones, '')
);

-- ====== 3) INSERT SERVICIO.EQUIPOS (CANONICAL) ======
WITH prep AS (
  SELECT
    id_fabricante,
    descripcion,
    CASE
      WHEN NULLIF(fabricante, '') IS NOT NULL THEN fabricante
      WHEN upper(COALESCE(categoria, '')) = 'HEMATOLOGY'
        OR upper(COALESCE(descripcion, '')) LIKE 'XN%'
        OR upper(COALESCE(descripcion, '')) LIKE 'XNL%'
        OR upper(COALESCE(descripcion, '')) LIKE 'XP%'
      THEN 'Sysmex'
      ELSE 'Roche'
    END AS fabricante,
    COALESCE(NULLIF(modelo, ''), descripcion) AS modelo,
    categoria,
    licenciamiento,
    observaciones,
    insumos,
    CASE
      WHEN id_fabricante IS NOT NULL AND id_fabricante <> '' THEN
        id_fabricante ||
        CASE
          WHEN (licenciamiento IS NOT NULL AND licenciamiento <> '') OR (observaciones IS NOT NULL AND observaciones <> '') THEN
            '-' ||
            COALESCE(
              NULLIF(upper(regexp_replace(COALESCE(licenciamiento, ''), '[^A-Za-z0-9]+', '', 'g')), ''),
              ''
            ) ||
            CASE
              WHEN observaciones IS NOT NULL AND observaciones <> '' THEN
                '-' || upper(regexp_replace(observaciones, '[^A-Za-z0-9]+', '', 'g'))
              ELSE ''
            END
          ELSE ''
        END
      ELSE
        'FAM-' || substr(upper(regexp_replace(descripcion, '[^A-Za-z0-9]+', '', 'g')), 1, 30) ||
        CASE WHEN licenciamiento IS NOT NULL THEN '-' || upper(licenciamiento) ELSE '' END ||
        CASE WHEN observaciones IS NOT NULL THEN '-' || upper(regexp_replace(observaciones, '[^A-Za-z0-9]+', '', 'g')) ELSE '' END
    END AS code_key
  FROM tmp_equipment_seed
)
INSERT INTO servicio.equipos (
  nombre,
  modelo,
  fabricante,
  categoria,
  descripcion,
  estado,
  code,
  manufacturer,
  category_type,
  notes,
  technical_specs
)
SELECT
  descripcion AS nombre,
  COALESCE(NULLIF(modelo, ''), descripcion) AS modelo,
  COALESCE(NULLIF(fabricante, ''), 'Roche') AS fabricante,
  categoria,
  concat_ws(' | ',
    NULLIF('id_fabricante: ' || id_fabricante, 'id_fabricante: '),
    NULLIF('modelo: ' || COALESCE(NULLIF(modelo, ''), descripcion), 'modelo: '),
    NULLIF(
      'descripcion: ' ||
      CASE
        WHEN descripcion IS NULL OR descripcion = '' THEN
          concat('Equipo ', COALESCE(NULLIF(modelo, ''), descripcion), ' de categoria ', COALESCE(categoria, ''))
        WHEN descripcion = COALESCE(NULLIF(modelo, ''), descripcion) THEN
          concat('Equipo ', COALESCE(NULLIF(modelo, ''), descripcion), ' de categoria ', COALESCE(categoria, ''))
        ELSE descripcion
      END,
      'descripcion: '
    ),
    NULLIF('fabricante: ' || COALESCE(NULLIF(fabricante, ''), 'Roche'), 'fabricante: '),
    NULLIF('categoria: ' || categoria, 'categoria: '),
    NULLIF('licenciamiento: ' || licenciamiento, 'licenciamiento: ')
  ) AS descripcion,
  'operativo',
  code_key,
  COALESCE(NULLIF(fabricante, ''), 'Roche') AS manufacturer,
  categoria AS category_type,
  NULLIF(TRIM(COALESCE(licenciamiento, '') || ' ' || COALESCE(observaciones, '')), '') AS notes,
  jsonb_build_object(
    'id_fabricante', id_fabricante,
    'licenciamiento', licenciamiento,
    'observaciones', observaciones
  )
FROM prep;

-- ====== 4) INSERT EQUIPOS_MODELO (INVENTORY) ======
INSERT INTO public.equipos_modelo (sku, nombre, fabricante, modelo, categoria)
SELECT
  se.code,
  se.nombre,
  se.fabricante,
  se.modelo,
  se.categoria
FROM servicio.equipos se;

-- ====== 5) INSERT EQUIPMENT_MODELS (BC CATALOG) ======
INSERT INTO public.equipment_models (
  code, sku, name, manufacturer, model, category, category_type, status, created_at, updated_at, notes, metadata
)
SELECT
  se.code,
  se.code AS sku,
  se.nombre,
  se.fabricante,
  se.modelo,
  se.categoria,
  se.category_type,
  'operativo',
  now(),
  now(),
  se.descripcion,
  se.technical_specs
FROM servicio.equipos se;

-- ====== 6) DETERMINATIONS ======
WITH prep AS (
  SELECT
    se.id_equipo,
    insumo->>'parametro' AS parametro,
    ts.categoria
  FROM tmp_equipment_seed ts
  JOIN servicio.equipos se
    ON se.code = COALESCE(NULLIF(ts.id_fabricante, ''), 'FAM-' || substr(upper(regexp_replace(ts.descripcion, '[^A-Za-z0-9]+', '', 'g')), 1, 30))
  CROSS JOIN LATERAL jsonb_array_elements(ts.insumos) AS insumo
  WHERE insumo->>'parametro' IS NOT NULL
)
INSERT INTO catalog_determinations (name, roche_code, category, equipment_id, version, status, valid_from, metadata)
SELECT DISTINCT
  parametro,
  NULL,
  categoria,
  id_equipo,
  '1',
  'active',
  CURRENT_DATE,
  '{}'::jsonb
FROM prep;

-- ====== 7) CONSUMABLES ======
WITH ins AS (
  SELECT
    insumo->>'id_fabricante' AS id_fabricante,
    insumo->>'producto' AS producto,
    insumo->>'tipo' AS tipo
  FROM tmp_equipment_seed ts
  CROSS JOIN LATERAL jsonb_array_elements(ts.insumos) AS insumo
),
distinct_items AS (
  SELECT DISTINCT
    id_fabricante,
    producto,
    CASE WHEN lower(tipo) = 'consumible' THEN 'material' ELSE lower(tipo) END AS tipo_norm
  FROM ins
)
INSERT INTO catalog_consumables (name, type, status, metadata, supplier_code, valid_from)
SELECT
  producto,
  tipo_norm,
  'active',
  jsonb_build_object('id_fabricante', id_fabricante),
  id_fabricante,
  CURRENT_DATE
FROM distinct_items;

-- ====== 8) LINK EQUIPMENT <-> CONSUMABLES (AND OPTIONAL DETERMINATIONS) ======
WITH ins AS (
  SELECT
    ts.descripcion,
    ts.id_fabricante,
    ts.categoria,
    insumo->>'id_fabricante' AS insumo_id_fabricante,
    insumo->>'producto' AS producto,
    insumo->>'tipo' AS tipo,
    insumo->>'parametro' AS parametro
  FROM tmp_equipment_seed ts
  CROSS JOIN LATERAL jsonb_array_elements(ts.insumos) AS insumo
),
equip AS (
  SELECT
    se.id_equipo,
    se.code
  FROM servicio.equipos se
),
cons AS (
  SELECT
    id AS consumable_id,
    supplier_code,
    name,
    type
  FROM catalog_consumables
),
det AS (
  SELECT
    id AS determination_id,
    name,
    equipment_id
  FROM catalog_determinations
)
INSERT INTO catalog_equipment_consumables (equipment_id, consumable_id, determination_id, consumption_rate)
SELECT
  e.id_equipo,
  c.consumable_id,
  d.determination_id,
  1
FROM ins i
JOIN equip e
  ON e.code = COALESCE(NULLIF(i.id_fabricante, ''), 'FAM-' || substr(upper(regexp_replace(i.descripcion, '[^A-Za-z0-9]+', '', 'g')), 1, 30))
JOIN cons c
  ON (c.supplier_code IS NOT NULL AND c.supplier_code = i.insumo_id_fabricante)
  OR (c.supplier_code IS NULL AND c.name = i.producto)
LEFT JOIN det d
  ON d.equipment_id = e.id_equipo
 AND i.parametro IS NOT NULL
 AND d.name = i.parametro;

DROP TABLE tmp_equipment_seed;

-- ====== 9) VALIDATIONS (non-blocking) ======
SELECT COUNT(*) AS total_equipos FROM servicio.equipos;
SELECT code, nombre FROM servicio.equipos WHERE fabricante IS NULL OR modelo IS NULL;
SELECT COUNT(*) AS equipos_sin_code FROM servicio.equipos WHERE code IS NULL OR code = '';
SELECT COUNT(*) AS consumibles_sin_supplier_code FROM catalog_consumables WHERE supplier_code IS NULL;
SELECT c.id, c.name
FROM catalog_consumables c
LEFT JOIN catalog_equipment_consumables ec ON ec.consumable_id = c.id
WHERE ec.id IS NULL
ORDER BY c.id
LIMIT 30;


