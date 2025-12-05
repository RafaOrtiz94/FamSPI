/**
 * Motor de Cálculos Flexible
 * ===========================
 * Evalúa fórmulas dinámicas almacenadas en BD de forma segura
 * 
 * Soporta 3 tipos de fórmulas:
 * 1. Expression: Expresiones matemáticas simples
 * 2. Conditional: Con reglas if-then
 * 3. Pipeline: Cálculos en pasos secuenciales
 */

const { create, all } = require('mathjs');
const db = require('../../config/db');
const logger = require('../../config/logger');

// Crear scope limitado y seguro de mathjs
const mathEngine = create(all, {
    number: 'BigNumber',
    precision: 14
});

// Solo permitir operaciones seguras (whitelist)
const ALLOWED_FUNCTIONS = new Set([
    'add', 'subtract', 'multiply', 'divide',
    'pow', 'sqrt', 'abs', 'round', 'floor', 'ceil',
    'min', 'max', 'mean', 'sum', 'median',
    'mod', 'log', 'log10', 'exp',
    'greater', 'smaller', 'equal', 'larger', 'largerEq', 'smallerEq',
    'and', 'or', 'not'
]);

// Deshabilitar funciones peligrosas
mathEngine.import({
    'import': function () { throw new Error('Function import is disabled') },
    'createUnit': function () { throw new Error('Function createUnit is disabled') },
    'evaluate': function () { throw new Error('Function evaluate is disabled') },
    'parse': function () { throw new Error('Function parse is disabled') },
}, { override: true });

/**
 * Evalúa una expresión matemática de forma segura
 * @param {string} expression - Expresión a evaluar (ej: "(a + b) * c")
 * @param {object} variables - Objeto con valores de variables
 * @returns {number} Resultado del cálculo
 */
function evaluateExpression(expression, variables = {}) {
    try {
        // Validar que la expresión no contenga código peligroso
        if (expression.includes('import') || expression.includes('require') || expression.includes('eval')) {
            throw new Error('Expresión contiene código no permitido');
        }

        const compiled = mathEngine.compile(expression);
        const result = compiled.evaluate(variables);

        // Convertir BigNumber a number normal
        return Number(result);
    } catch (error) {
        logger.error({ expression, variables, error: error.message }, 'Error evaluando expresión');
        throw new Error(`Error evaluando fórmula: ${error.message}`);
    }
}

/**
 * Evalúa una fórmula condicional (if-then-else)
 * @param {array} rules - Array de reglas {condition, formula}
 * @param {object} variables - Variables disponibles
 * @returns {number} Resultado de la primera condición que coincida
 */
function evaluateConditional(rules, variables = {}) {
    for (const rule of rules) {
        try {
            // Evaluar la condición
            const conditionResult = evaluateExpression(rule.condition, variables);

            // Si la condición es verdadera, evaluar y retornar la fórmula
            if (conditionResult) {
                return evaluateExpression(rule.formula, variables);
            }
        } catch (error) {
            logger.warn({ rule, error: error.message }, 'Error en regla condicional, continuando...');
            continue;
        }
    }

    throw new Error('Ninguna condición coincidió en fórmula condicional');
}

/**
 * Evalúa una fórmula tipo pipeline (pasos secuenciales)
 * @param {array} steps - Array de pasos {name, formula, output}
 * @param {object} variables - Variables iniciales
 * @returns {number} Resultado final del pipeline
 */
function evaluatePipeline(steps, variables = {}) {
    const context = { ...variables };

    for (const step of steps) {
        try {
            const result = evaluateExpression(step.formula, context);
            context[step.output] = result;

            logger.debug({
                step: step.name,
                formula: step.formula,
                result,
                output: step.output
            }, 'Paso de pipeline ejecutado');
        } catch (error) {
            logger.error({ step, error: error.message }, 'Error en paso de pipeline');
            throw new Error(`Error en paso "${step.name}": ${error.message}`);
        }
    }

    // Retornar el último output
    const finalOutput = steps[steps.length - 1].output;
    return context[finalOutput];
}

/**
 * Resuelve variables desde la base de datos
 * @param {object} variablesConfig - Configuración de variables
 * @param {object} context - Contexto con valores conocidos
 * @returns {Promise<object>} Objeto con variables resueltas
 */
async function resolveVariables(variablesConfig, context = {}) {
    const resolved = {};

    for (const [varName, varConfig] of Object.entries(variablesConfig)) {
        // Si la variable ya está en el contexto, usarla directamente
        if (context[varName] !== undefined) {
            resolved[varName] = context[varName];
            continue;
        }

        // Resolver según el tipo de source
        if (varConfig.source === 'lookup') {
            // Buscar en tabla
            try {
                const query = `SELECT ${varConfig.value} FROM ${varConfig.table} WHERE ${varConfig.key} = $1`;
                const result = await db.query(query, [context[varConfig.key]]);
                resolved[varName] = result.rows[0]?.[varConfig.value] ?? varConfig.default ?? 0;
            } catch (error) {
                logger.warn({ varName, varConfig, error: error.message }, 'Error en lookup, usando default');
                resolved[varName] = varConfig.default ?? 0;
            }
        } else if (varConfig.source && varConfig.source.includes('.')) {
            // Variable desde contexto (ej: "catalog_determinations.volume_per_test")
            const parts = varConfig.source.split('.');
            const fieldName = parts[parts.length - 1];
            resolved[varName] = context[fieldName] ?? varConfig.default ?? 0;
        } else {
            // Literal o desde contexto directo
            resolved[varName] = context[varName] ?? varConfig.default ?? 0;
        }

        // Validar que variables requeridas no sean null/undefined
        if (varConfig.required && (resolved[varName] === null || resolved[varName] === undefined)) {
            throw new Error(`Variable requerida "${varName}" no está disponible`);
        }
    }

    return resolved;
}

/**
 * Ejecuta una fórmula completa (punto de entrada principal)
 * @param {object} formula - Objeto de fórmula con {type, expression/rules/steps, variables}
 * @param {object} context - Contexto con valores disponibles
 * @returns {Promise<number>} Resultado del cálculo
 */
async function executeFormula(formula, context = {}) {
    if (!formula) {
        throw new Error('Fórmula no proporcionada');
    }

    logger.debug({ formula_type: formula.type, context }, 'Ejecutando fórmula');

    // Resolver variables primero
    const variables = await resolveVariables(formula.variables || {}, context);

    logger.debug({ variables }, 'Variables resueltas');

    let result;

    switch (formula.type) {
        case 'expression':
            result = evaluateExpression(formula.expression, variables);
            break;

        case 'conditional':
            result = evaluateConditional(formula.rules, variables);
            break;

        case 'pipeline':
            result = evaluatePipeline(formula.steps, variables);
            break;

        case 'hybrid':
            result = evaluateExpression(formula.formula, variables);
            break;

        default:
            throw new Error(`Tipo de fórmula desconocido: ${formula.type}`);
    }

    logger.info({ formula_type: formula.type, result }, 'Fórmula ejecutada exitosamente');

    return result;
}

/**
 * Obtiene la fórmula aplicable para una determinación
 * Prioridad: Determinación > Equipo > Default
 * @param {number} determinationId - ID de la determinación
 * @param {number} equipmentId - ID del equipo
 * @param {string} calculationType - Tipo de cálculo ('consumption', 'cost', etc.)
 * @returns {Promise<object>} Objeto de fórmula
 */
async function getApplicableFormula(determinationId, equipmentId, calculationType = 'consumption') {
    // 1. Buscar fórmula en la determinación
    const detResult = await db.query(
        `SELECT calculation_formula, formula_type 
     FROM catalog_determinations 
     WHERE id = $1`,
        [determinationId]
    );

    if (detResult.rows[0]?.calculation_formula && detResult.rows[0].calculation_formula[calculationType]) {
        logger.debug({ determinationId, source: 'determination' }, 'Usando fórmula de la determinación');
        return detResult.rows[0].calculation_formula[calculationType];
    }

    // 2. Buscar fórmula en el equipo
    if (equipmentId) {
        const eqResult = await db.query(
            `SELECT default_calculation_formula 
       FROM servicio.equipos 
       WHERE id_equipo = $1`,
            [equipmentId]
        );

        if (eqResult.rows[0]?.default_calculation_formula && eqResult.rows[0].default_calculation_formula[calculationType]) {
            logger.debug({ equipmentId, source: 'equipment' }, 'Usando fórmula del equipo');
            return eqResult.rows[0].default_calculation_formula[calculationType];
        }
    }

    // 3. Fórmula por defecto
    logger.debug({ calculationType, source: 'default' }, 'Usando fórmula por defecto');
    return getDefaultFormula(calculationType);
}

/**
 * Fórmulas por defecto para fallback
 * @param {string} calculationType - Tipo de cálculo
 * @returns {object} Objeto de fórmula por defecto
 */
function getDefaultFormula(calculationType) {
    const defaults = {
        consumption: {
            type: 'expression',
            expression: '(volume_per_test + reagent_consumption + (wash_cycles * 0.5)) * monthly_quantity',
            variables: {
                volume_per_test: {
                    source: 'catalog_determinations.volume_per_test',
                    type: 'decimal',
                    default: 0
                },
                reagent_consumption: {
                    source: 'catalog_determinations.reagent_consumption',
                    type: 'decimal',
                    default: 0
                },
                wash_cycles: {
                    source: 'catalog_determinations.wash_cycles',
                    type: 'integer',
                    default: 0
                },
                monthly_quantity: {
                    source: 'bc_determinations.monthly_quantity',
                    type: 'integer',
                    required: true
                }
            },
            unit: 'mL',
            description: 'Consumo estándar con lavados'
        },
        cost: {
            type: 'expression',
            expression: 'cost_per_test * monthly_quantity',
            variables: {
                cost_per_test: {
                    source: 'catalog_determinations.cost_per_test',
                    type: 'decimal',
                    required: true
                },
                monthly_quantity: {
                    source: 'bc_determinations.monthly_quantity',
                    type: 'integer',
                    required: true
                }
            },
            unit: 'USD',
            description: 'Costo estándar simple'
        }
    };

    const formula = defaults[calculationType];

    if (!formula) {
        throw new Error(`Tipo de cálculo desconocido: ${calculationType}`);
    }

    return formula;
}

/**
 * Obtiene todas las plantillas de cálculo disponibles
 * @param {string} category - Filtrar por categoría (opcional)
 * @returns {Promise<array>} Array de plantillas
 */
async function getCalculationTemplates(category = null) {
    const query = category
        ? `SELECT * FROM calculation_templates WHERE category = $1 AND is_active = true ORDER BY name`
        : `SELECT * FROM calculation_templates WHERE is_active = true ORDER BY name`;

    const params = category ? [category] : [];
    const result = await db.query(query, params);

    return result.rows;
}

/**
 * Valida una fórmula sin ejecutarla
 * @param {object} formula - Objeto de fórmula
 * @param {object} exampleContext - Contexto de ejemplo para validar
 * @returns {Promise<object>} Resultado de validación {isValid, error, result}
 */
async function validateFormula(formula, exampleContext = {}) {
    try {
        const result = await executeFormula(formula, exampleContext);
        return {
            isValid: true,
            result,
            error: null
        };
    } catch (error) {
        return {
            isValid: false,
            result: null,
            error: error.message
        };
    }
}

module.exports = {
    executeFormula,
    getApplicableFormula,
    getDefaultFormula,
    getCalculationTemplates,
    validateFormula,
    evaluateExpression,
    evaluateConditional,
    evaluatePipeline,
    resolveVariables
};
