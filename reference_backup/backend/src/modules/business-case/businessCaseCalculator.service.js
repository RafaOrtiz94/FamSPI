/**
 * Servicio de Business Case Calculator
 * =====================================
 * Utiliza el motor de cálculos flexible para procesar Business Cases
 */

const calculationEngine = require('./calculationEngine.service');
const db = require('../../config/db');
const logger = require('../../config/logger');
const investmentsService = require('./investments.service');
const { isComodato } = require('./businessCase.service');

/**
 * Calcula el consumo de una determinación usando el motor flexible
 * @param {object} params - Parámetros del cálculo
 * @param {number} params.determinationId - ID de la determinación
 * @param {number} params.equipmentId - ID del equipo
 * @param {number} params.monthlyQuantity - Cantidad mensual solicitada
 * @param {object} params.additionalContext - Contexto adicional (opcional)
 * @returns {Promise<object>} Resultado con {value, unit, formula_type}
 */
async function calculateDeterminationConsumption({
    determinationId,
    equipmentId,
    monthlyQuantity,
    additionalContext = {}
}) {
    logger.info({ determinationId, equipmentId, monthlyQuantity }, 'Calculando consumo de determinación');

    // Obtener datos de la determinación desde BD
    const detData = await db.query(
        `SELECT * FROM catalog_determinations WHERE id = $1`,
        [determinationId]
    );

    if (!detData.rows.length) {
        throw new Error(`Determinación ${determinationId} no encontrada`);
    }

    const determination = detData.rows[0];

    // Obtener fórmula aplicable (determinación > equipo > default)
    const formula = await calculationEngine.getApplicableFormula(
        determinationId,
        equipmentId,
        'consumption'
    );

    // Preparar contexto con todas las variables disponibles
    const context = {
        // Datos de la determinación
        volume_per_test: determination.volume_per_test || 0,
        reagent_consumption: determination.reagent_consumption || 0,
        processing_time: determination.processing_time || 0,
        wash_cycles: determination.wash_cycles || 0,
        blank_required: determination.blank_required ? 1 : 0,
        calibration_frequency: determination.calibration_frequency || 0,

        // Datos del Business Case
        monthly_quantity: monthlyQuantity,

        // IDs para lookups
        determination_id: determinationId,
        equipment_id: equipmentId,

        // Contexto adicional (por si la fórmula necesita más datos)
        ...additionalContext
    };

    // Ejecutar fórmula
    const consumption = await calculationEngine.executeFormula(formula, context);

    logger.info({ determinationId, consumption, unit: formula.unit }, 'Consumo calculado');

    return {
        value: consumption,
        unit: formula.unit || 'mL',
        formula_type: determination.formula_type || 'default',
        formula_description: formula.description,
        calculated_at: new Date(),
        calculation_details: {
            formula_expression: formula.expression || formula.type,
            variables_used: Object.keys(context)
        }
    };
}

/**
 * Calcula el costo de una determinación usando el motor flexible
 * @param {object} params - Parámetros del cálculo
 * @returns {Promise<object>} Resultado con {value, unit, formula_type}
 */
async function calculateDeterminationCost({
    determinationId,
    equipmentId,
    monthlyQuantity,
    additionalContext = {}
}) {
    logger.info({ determinationId, equipmentId, monthlyQuantity }, 'Calculando costo de determinación');

    // Obtener datos de la determinación
    const detData = await db.query(
        `SELECT * FROM catalog_determinations WHERE id = $1`,
        [determinationId]
    );

    if (!detData.rows.length) {
        throw new Error(`Determinación ${determinationId} no encontrada`);
    }

    const determination = detData.rows[0];

    // Obtener fórmula para costo
    const formula = await calculationEngine.getApplicableFormula(
        determinationId,
        equipmentId,
        'cost'
    );

    // Preparar contexto
    const context = {
        cost_per_test: determination.cost_per_test || 0,
        monthly_quantity: monthlyQuantity,
        determination_id: determinationId,
        equipment_id: equipmentId,
        ...additionalContext
    };

    // Ejecutar fórmula
    const cost = await calculationEngine.executeFormula(formula, context);

    logger.info({ determinationId, cost }, 'Costo calculado');

    return {
        value: cost,
        unit: formula.unit || 'USD',
        formula_type: determination.formula_type || 'default',
        calculated_at: new Date()
    };
}

/**
 * Calcula la utilización del equipo
 * @param {object} params - Parámetros
 * @param {number} params.equipmentId - ID del equipo
 * @param {number} params.totalMonthlyTests - Total de pruebas mensuales
 * @returns {Promise<object>} Resultado con % de utilización y capacidad
 */
async function calculateEquipmentUtilization({ equipmentId, totalMonthlyTests }) {
    logger.info({ equipmentId, totalMonthlyTests }, 'Calculando utilización del equipo');

    // Obtener capacidades del equipo
    const eqData = await db.query(
        `SELECT capacity_per_hour, max_daily_capacity FROM public.equipment_models WHERE id = $1`,
        [equipmentId]
    );

    if (!eqData.rows.length) {
        throw new Error(`Equipo ${equipmentId} no encontrado`);
    }

    const equipment = eqData.rows[0];

    if (!equipment.max_daily_capacity) {
        logger.warn({ equipmentId }, 'Equipo sin capacidad máxima definida, usando estimación');
        // Estimación: capacity_per_hour * 8 horas
        equipment.max_daily_capacity = (equipment.capacity_per_hour || 100) * 8;
    }

    // Cálculo: Total mensual / (Capacidad diaria * 22 días laborables)
    const maxMonthlyCapacity = equipment.max_daily_capacity * 22;
    const utilizationPercentage = (totalMonthlyTests / maxMonthlyCapacity) * 100;

    // Determinar estado
    const status = utilizationPercentage > 90
        ? 'overload'
        : utilizationPercentage < 30
            ? 'underutilized'
            : 'optimal';

    return {
        utilization_percentage: Math.round(utilizationPercentage * 100) / 100,
        capacity_exceeded: utilizationPercentage > 100,
        underutilized: utilizationPercentage < 30,
        status,
        max_monthly_capacity: maxMonthlyCapacity,
        requested_monthly_tests: totalMonthlyTests,
        available_capacity: maxMonthlyCapacity - totalMonthlyTests
    };
}

/**
 * Genera warnings basados en los cálculos del BC
 * @param {object} calculations - Cálculos del BC
 * @returns {array} Array de warnings
 */
function generateWarnings(calculations) {
    const warnings = [];

    // Warning: Capacidad excedida
    if (calculations.equipment?.capacity_exceeded) {
        warnings.push({
            type: 'capacity_exceeded',
            severity: 'critical',
            message: 'La capacidad del equipo ha sido excedida. El equipo no podrá procesar todas las pruebas solicitadas.',
            recommendation: 'Considere seleccionar un equipo de mayor capacidad o reducir la cantidad de determinaciones.'
        });
    }

    // Warning: Casi al límite de capacidad
    if (calculations.equipment?.utilization_percentage > 90 && !calculations.equipment.capacity_exceeded) {
        warnings.push({
            type: 'near_capacity_limit',
            severity: 'warning',
            message: `El equipo estará al ${calculations.equipment.utilization_percentage.toFixed(1)}% de su capacidad.`,
            recommendation: 'Considere tener un equipo de backup o planificar mantenimientos con cuidado.'
        });
    }

    // Warning: Equipo subutilizado
    if (calculations.equipment?.underutilized) {
        warnings.push({
            type: 'underutilized',
            severity: 'info',
            message: `El equipo solo utilizará el ${calculations.equipment.utilization_percentage.toFixed(1)}% de su capacidad.`,
            recommendation: 'Podría considerar un equipo de menor capacidad para optimizar costos.'
        });
    }

    // Warning: Costo por prueba muy alto
    if (calculations.totals?.cost_per_test > 5) {
        warnings.push({
            type: 'high_cost_per_test',
            severity: 'warning',
            message: `El costo promedio por prueba es de $${calculations.totals.cost_per_test.toFixed(2)}, que está por encima del promedio.`,
            recommendation: 'Revise si hay determinaciones con costos excesivos o considere negociar con proveedores.'
        });
    }

    return warnings;
}

/**
 * Genera recomendaciones automáticas
 * @param {object} calculations - Cálculos del BC
 * @returns {array} Array de recomendaciones
 */
function generateRecommendations(calculations) {
    const recommendations = [];

    // Recomendación: Descuentos por volumen
    if (calculations.totals?.monthly_tests > 1000) {
        recommendations.push({
            type: 'volume_discount',
            message: 'Con este volumen de pruebas, podría negociar descuentos por volumen con los proveedores de reactivos.',
            potential_savings: calculations.totals.monthly_cost * 0.05 // 5% estimado
        });
    }

    // Recomendación: Contrato anual
    if (calculations.totals?.annual_projection > 50000) {
        recommendations.push({
            type: 'annual_contract',
            message: 'El volumen anual proyectado justifica negociar un contrato anual con mejores condiciones.',
            potential_savings: calculations.totals.annual_projection * 0.08 // 8% estimado
        });
    }

    return recommendations;
}

/**
 * Calcula todo el Business Case (función maestra)
 * @param {string} businessCaseId - UUID del Business Case
 * @returns {Promise<object>} Cálculos completos del BC
 */
/**
 * Calcula rentabilidad para Business Cases de comodato
 * @param {string} businessCaseId - UUID del Business Case
 * @param {object} bc - Datos del Business Case
 * @param {number} annualCost - Costo anual operativo
 * @returns {Promise<object>} Métricas de rentabilidad
 */
async function calculateComodatoRentability(businessCaseId, bc, annualCost) {
    logger.info({ businessCaseId }, 'Calculando rentabilidad de comodato');

    // 1. Obtener inversiones adicionales
    const investmentTotals = await investmentsService.getInvestmentTotals(businessCaseId);

    // 2. Calcular inversión total
    const equipmentInvestment = bc.bc_equipment_cost || 0;
    const totalInvestment = equipmentInvestment + investmentTotals.one_time;

    // 3. Calcular costos operativos anuales
    const recurringMonthlyCost = investmentTotals.recurring_monthly * 12;
    const recurringAnnualCost = investmentTotals.recurring_annual;
    const annualOperatingCost = annualCost + recurringMonthlyCost + recurringAnnualCost;
    const monthlyOperatingCost = annualOperatingCost / 12;

    // 4. Calcular ingreso necesario para alcanzar margen objetivo
    const targetMarginDecimal = (bc.bc_target_margin_percentage || 0) / 100;
    const monthlyRevenue = targetMarginDecimal > 0 && targetMarginDecimal < 1
        ? monthlyOperatingCost / (1 - targetMarginDecimal)
        : monthlyOperatingCost * 1.25; // Default 25% margin if not set

    const annualRevenue = monthlyRevenue * 12;

    // 5. Calcular margen real
    const monthlyMargin = monthlyRevenue - monthlyOperatingCost;
    const annualMargin = monthlyMargin * 12;

    // 6. Calcular ROI
    const durationYears = bc.bc_duration_years || 3;
    const totalMarginOverDuration = annualMargin * durationYears;
    const roiPercentage = totalInvestment > 0
        ? ((totalMarginOverDuration - totalInvestment) / totalInvestment) * 100
        : 0;

    // 7. Calcular payback period (meses para recuperar inversión)
    const paybackMonths = monthlyMargin > 0
        ? Math.ceil(totalInvestment / monthlyMargin)
        : null;

    return {
        equipment_investment: equipmentInvestment,
        total_investment: totalInvestment,
        monthly_revenue: monthlyRevenue,
        annual_revenue: annualRevenue,
        monthly_margin: monthlyMargin,
        annual_margin: annualMargin,
        roi_percentage: roiPercentage,
        payback_months: paybackMonths,
        annual_operating_cost: annualOperatingCost,
        monthly_operating_cost: monthlyOperatingCost,
    };
}

/**
 * Calcula todo el Business Case (función maestra)
 * Soporta tanto cálculos mensuales (públicos) como anuales (privados)
 * @param {string} businessCaseId - UUID del Business Case
 * @returns {Promise<object>} Cálculos completos del BC
 */
async function calculateBusinessCase(businessCaseId) {
    logger.info({ businessCaseId }, 'Calculando Business Case completo');

    // 0. Obtener datos del BC para determinar tipo y modo de cálculo
    const bcResult = await db.query(
        `SELECT * FROM equipment_purchase_requests WHERE id = $1`,
        [businessCaseId]
    );

    if (!bcResult.rows.length) {
        throw new Error('Business Case no encontrado');
    }

    const bc = bcResult.rows[0];
    const isAnnual = bc.bc_calculation_mode === 'annual';
    const isPrivate = bc.bc_purchase_type === 'comodato_privado';

    // 1. Obtener equipo seleccionado
    const equipmentResult = await db.query(
        `SELECT equipment_id, quantity FROM bc_equipment_selection 
     WHERE business_case_id = $1 AND is_primary = true`,
        [businessCaseId]
    );

    if (!equipmentResult.rows.length) {
        throw new Error('No hay equipo seleccionado para este Business Case');
    }

    const { equipment_id: equipmentId, quantity: equipmentQty } = equipmentResult.rows[0];

    // 2. Obtener todas las determinaciones solicitadas
    const determinationsResult = await db.query(
        `SELECT * FROM bc_determinations WHERE business_case_id = $1`,
        [businessCaseId]
    );

    if (!determinationsResult.rows.length) {
        throw new Error('No hay determinaciones agregadas a este Business Case');
    }

    const determinations = determinationsResult.rows;

    // 3. Calcular consumo y costo para cada determinación
    const calculatedDeterminations = await Promise.all(
        determinations.map(async (det) => {
            // Usar cantidad anual o mensual según el modo
            const quantity = isAnnual ? det.annual_quantity : det.monthly_quantity;

            if (!quantity) {
                throw new Error(`Determinación ${det.determination_id} no tiene cantidad ${isAnnual ? 'anual' : 'mensual'}`);
            }

            const consumption = await calculateDeterminationConsumption({
                determinationId: det.determination_id,
                equipmentId,
                monthlyQuantity: quantity // El motor usa este nombre pero puede ser anual
            });

            const cost = await calculateDeterminationCost({
                determinationId: det.determination_id,
                equipmentId,
                monthlyQuantity: quantity
            });

            // Actualizar bd con los cálculos
            await db.query(
                `UPDATE bc_determinations 
         SET calculated_consumption = $1, 
             calculated_cost = $2,
             calculation_details = $3,
             updated_at = now()
         WHERE id = $4`,
                [
                    consumption.value,
                    cost.value,
                    JSON.stringify({ consumption, cost, calculation_mode: isAnnual ? 'annual' : 'monthly' }),
                    det.id
                ]
            );

            return {
                id: det.id,
                determination_id: det.determination_id,
                quantity: quantity,
                calculated_consumption: consumption.value,
                calculated_cost: cost.value,
                consumption_unit: consumption.unit,
                cost_unit: cost.unit
            };
        })
    );

    // 4. Calcular totales según modo
    let calculations = {};
    const totalTests = calculatedDeterminations.reduce((sum, d) => sum + d.quantity, 0);
    const totalCost = calculatedDeterminations.reduce((sum, d) => sum + d.calculated_cost, 0);
    const totalConsumption = calculatedDeterminations.reduce((sum, d) => sum + d.calculated_consumption, 0);

    if (isAnnual) {
        // Cálculos anuales (comodatos)
        calculations.total_annual_tests = totalTests;
        calculations.total_annual_cost = totalCost;
        calculations.total_monthly_tests = Math.round(totalTests / 12);
        calculations.total_monthly_cost = totalCost / 12;
        calculations.annual_projection = totalCost;
    } else {
        // Cálculos mensuales (públicos)
        calculations.total_monthly_tests = totalTests;
        calculations.total_monthly_cost = totalCost;
        calculations.total_reagent_consumption = totalConsumption;
        calculations.annual_projection = totalCost * 12;
    }

    calculations.cost_per_test = totalTests > 0 ? totalCost / totalTests : 0;

    // 5. Calcular utilización del equipo
    const testsForUtilization = isAnnual ? Math.round(totalTests / 12) : totalTests;
    const equipment = await calculateEquipmentUtilization({
        equipmentId,
        totalMonthlyTests: testsForUtilization
    });

    calculations.equipment_utilization_percentage = equipment.utilization_percentage;
    calculations.capacity_exceeded = equipment.capacity_exceeded;
    calculations.underutilized = equipment.underutilized;

    // 6. Calcular rentabilidad (ambos tipos de comodato usan ROI)
    const rentability = await calculateComodatoRentability(
        businessCaseId,
        bc,
        calculations.total_annual_cost || (calculations.total_monthly_cost * 12)
    );
    calculations = { ...calculations, ...rentability };

    // 7. Generar warnings y recomendaciones
    const partialCalcs = { calculations, equipment, bc };
    const warnings = generateWarnings(partialCalcs);
    const recommendations = generateRecommendations(partialCalcs);

    calculations.warnings = warnings;
    calculations.recommendations = recommendations;

    // 8. Guardar en bc_calculations
    const fields = [
        'business_case_id',
        'total_monthly_tests',
        'total_reagent_consumption',
        'total_monthly_cost',
        'total_annual_tests',
        'total_annual_cost',
        'annual_projection',
        'equipment_utilization_percentage',
        'capacity_exceeded',
        'underutilized',
        'cost_per_test',
        'equipment_investment',
        'total_investment',
        'monthly_revenue',
        'annual_revenue',
        'monthly_margin',
        'annual_margin',
        'roi_percentage',
        'payback_months',
        'annual_operating_cost',
        'monthly_operating_cost',
        'warnings',
        'recommendations'
    ];

    const values = [
        businessCaseId,
        calculations.total_monthly_tests || null,
        calculations.total_reagent_consumption || null,
        calculations.total_monthly_cost || null,
        calculations.total_annual_tests || null,
        calculations.total_annual_cost || null,
        calculations.annual_projection || null,
        calculations.equipment_utilization_percentage || null,
        calculations.capacity_exceeded || false,
        calculations.underutilized || false,
        calculations.cost_per_test || null,
        calculations.equipment_investment || null,
        calculations.total_investment || null,
        calculations.monthly_revenue || null,
        calculations.annual_revenue || null,
        calculations.monthly_margin || null,
        calculations.annual_margin || null,
        calculations.roi_percentage || null,
        calculations.payback_months || null,
        calculations.annual_operating_cost || null,
        calculations.monthly_operating_cost || null,
        JSON.stringify(warnings),
        JSON.stringify(recommendations)
    ];

    const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
    const updateSets = fields.slice(1).map(f => `${f} = EXCLUDED.${f}`).join(', ');

    await db.query(
        `INSERT INTO bc_calculations (${fields.join(', ')}, calculated_at, calculation_version)
         VALUES (${placeholders}, now(), 1)
         ON CONFLICT (business_case_id) DO UPDATE SET
         ${updateSets},
         calculated_at = now(),
         calculation_version = bc_calculations.calculation_version + 1`,
        values
    );

    logger.info({ businessCaseId, isAnnual }, 'Business Case calculado exitosamente');

    // 9. Retornar resultado completo
    return {
        business_case_id: businessCaseId,
        calculation_mode: isAnnual ? 'annual' : 'monthly',
        bc_type: bc.bc_purchase_type,
        calculations,
        equipment,
        determinations: calculatedDeterminations,
        warnings,
        recommendations,
        calculated_at: new Date()
    };
}

module.exports = {
    calculateDeterminationConsumption,
    calculateDeterminationCost,
    calculateEquipmentUtilization,
    calculateComodatoRentability,
    calculateBusinessCase,
    generateWarnings,
    generateRecommendations
};
