-- Rebuild equipment catalog views to rely on public.equipment_models
-- This keeps the business case and catalog APIs working while the legacy table is deprecated.

CREATE OR REPLACE VIEW public.v_determinations_with_formulas AS
 SELECT d.id,
    d.name,
    d.roche_code,
    d.category,
    d.equipment_id,
    e.name AS equipment_name,
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
     LEFT JOIN public.equipment_models e ON ((e.id = d.equipment_id)))
  WHERE (d.status = 'active');

CREATE OR REPLACE VIEW public.v_equipment_determinations AS
 SELECT e.id AS equipment_id,
    e.name AS equipment_name,
    e.model AS model,
    e.manufacturer AS manufacturer,
    d.id AS determination_id,
    d.name AS determination_name,
    d.roche_code,
    d.category,
    d.version AS determination_version,
    d.status AS determination_status
   FROM (public.equipment_models e
     LEFT JOIN public.catalog_determinations d ON ((d.equipment_id = e.id)))
  ORDER BY e.name, d.name;

CREATE OR REPLACE VIEW public.v_equipment_full_catalog AS
 SELECT e.id AS equipment_id,
    e.code AS equipment_code,
    e.name AS equipment_name,
    e.manufacturer AS manufacturer,
    e.model AS model,
    e.category_type AS category,
    e.capacity_per_hour,
    e.max_daily_capacity,
    e.base_price,
    e.status AS status,
    count(DISTINCT d.id) AS total_determinations,
    count(DISTINCT c.id) AS total_consumables
   FROM (((public.equipment_models e
     LEFT JOIN public.catalog_determinations d ON (((d.equipment_id = e.id) AND ((d.status)::text = 'active'::text))))
     LEFT JOIN public.catalog_equipment_consumables ec ON ((ec.equipment_id = e.id)))
     LEFT JOIN public.catalog_consumables c ON (((c.id = ec.consumable_id) AND ((c.status)::text = 'active'::text))))
  WHERE (e.status = 'operativo'::text)
  GROUP BY e.id, e.code, e.name, e.manufacturer, e.model, e.category_type, e.capacity_per_hour, e.max_daily_capacity, e.base_price, e.status;

CREATE OR REPLACE FUNCTION public.get_current_price(p_equipment_id integer DEFAULT NULL::integer, p_consumable_id integer DEFAULT NULL::integer, p_determination_id integer DEFAULT NULL::integer, p_price_type character varying DEFAULT NULL::character varying, p_date date DEFAULT CURRENT_DATE) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_price DECIMAL(12,2);
BEGIN
  -- Buscar en historial primero
  SELECT price INTO v_price
  FROM equipment_price_history
  WHERE ((p_equipment_id IS NOT NULL AND equipment_id = p_equipment_id) OR
         (p_consumable_id IS NOT NULL AND consumable_id = p_consumable_id) OR
         (p_determination_id IS NOT NULL AND determination_id = p_determination_id))
    AND (p_price_type IS NULL OR price_type = p_price_type)
    AND effective_from <= p_date
    AND (effective_to IS NULL OR effective_to >= p_date)
  ORDER BY effective_from DESC
  LIMIT 1;

  -- Si no hay en historial, buscar en tablas actuales
  IF v_price IS NULL THEN
    IF p_equipment_id IS NOT NULL THEN
      SELECT base_price INTO v_price FROM public.equipment_models WHERE id = p_equipment_id;
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
