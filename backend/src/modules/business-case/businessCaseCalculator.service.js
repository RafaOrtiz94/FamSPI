/**
 * Servicio de Business Case Calculator
 * =====================================
 * Utiliza el motor de cálculos flexible para procesar Business Cases
 */

const calculationEngine = require('./calculationEngine.service');
const db = require('../../config/db');
const logger = require('../../config/logger');

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
        `SELECT capacity_per_hour, max_daily_capacity FROM servicio.equipos WHERE id_equipo = $1`,
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
async function calculateBusinessCase(businessCaseId) {
    logger.info({ businessCaseId }, 'Calculando Business Case completo');

    // 1. Obtener equipo seleccionado
    const equipmentResult = await db.query(
        `SELECT equipment_id FROM bc_equipment_selection 
     WHERE business_case_id = $1 AND is_primary = true`,
        [businessCaseId]
    );

    if (!equipmentResult.rows.length) {
        throw new Error('No hay equipo seleccionado para este Business Case');
    }

    const equipmentId = equipmentResult.rows[0].equipment_id;

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
            const consumption = await calculateDeterminationConsumption({
                determinationId: det.determination_id,
                equipmentId,
                monthlyQuantity: det.monthly_quantity
            });

            const cost = await calculateDeterminationCost({
                determinationId: det.determination_id,
                equipmentId,
                monthlyQuantity: det.monthly_quantity
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
                    JSON.stringify({ consumption, cost }),
                    det.id
                ]
            );

            return {
                id: det.id,
                determination_id: det.determination_id,
                monthly_quantity: det.monthly_quantity,
                calculated_consumption: consumption.value,
                calculated_cost: cost.value,
                consumption_unit: consumption.unit,
                cost_unit: cost.unit
            };
        })
    );

    // 4. Calcular totales
    const totals = {
        monthly_tests: calculatedDeterminations.reduce((sum, d) => sum + d.monthly_quantity, 0),
        reagent_consumption: calculatedDeterminations.reduce((sum, d) => sum + d.calculated_consumption, 0),
        monthly_cost: calculatedDeterminations.reduce((sum, d) => sum + d.calculated_cost, 0),
        annual_projection: 0,
        cost_per_test: 0
    };

    totals.annual_projection = totals.monthly_cost * 12;
    totals.cost_per_test = totals.monthly_tests > 0 ? totals.monthly_cost / totals.monthly_tests : 0;

    // 5. Calcular utilización del equipo
    const equipment = await calculateEquipmentUtilization({
        equipmentId,
        totalMonthlyTests: totals.monthly_tests
    });

    // 6. Generar warnings y recomendaciones
    const partialCalcs = { totals, equipment };
    const warnings = generateWarnings(partialCalcs);
    const recommendations = generateRecommendations(partialCalcs);

    // 7. Guardar en bc_calculations
    await db.query(
        `INSERT INTO bc_calculations (
      business_case_id, total_monthly_tests, total_reagent_consumption,
      total_monthly_cost, annual_projection, equipment_utilization_percentage,
      capacity_exceeded, underutilized, cost_per_test, warnings, recommendations,
      calculated_at, calculation_version
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), 1)
    ON CONFLICT (business_case_id) DO UPDATE SET
      total_monthly_tests = EXCLUDED.total_monthly_tests,
      total_reagent_consumption = EXCLUDED.total_reagent_consumption,
      total_monthly_cost = EXCLUDED.total_monthly_cost,
      annual_projection = EXCLUDED.annual_projection,
      equipment_utilization_percentage = EXCLUDED.equipment_utilization_percentage,
      capacity_exceeded = EXCLUDED.capacity_exceeded,
      underutilized = EXCLUDED.underutilized,
      cost_per_test = EXCLUDED.cost_per_test,
      warnings = EXCLUDED.warnings,
      recommendations = EXCLUDED.recommendations,
      calculated_at = now(),
      calculation_version = bc_calculations.calculation_version + 1`,
        [
            businessCaseId,
            totals.monthly_tests,
            totals.reagent_consumption,
            totals.monthly_cost,
            totals.annual_projection,
            equipment.utilization_percentage,
            equipment.capacity_exceeded,
            equipment.underutilized,
            totals.cost_per_test,
            JSON.stringify(warnings),
            JSON.stringify(recommendations)
        ]
    );

    logger.info({ businessCaseId, totals }, 'Business Case calculado exitosamente');

    // 8. Retornar resultado completo
    return {
        business_case_id: businessCaseId,
        totals,
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
    calculateBusinessCase,
    generateWarnings,
    generateRecommendations
};
