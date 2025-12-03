/**
 * Motor de Cálculo para Business Case Vivo
 * 
 * Este servicio encapsula la lógica para calcular cantidades de reactivos,
 * calibradores y controles necesarios basados en el volumen de pruebas.
 * 
 * Diseñado para ser fácil de entender y mantener.
 */

const logger = require('../../config/logger');

class BusinessCaseCalculator {

    /**
     * Calcula los requerimientos para una determinación específica
     * @param {Object} determination - Datos de la determinación (del catálogo)
     * @param {number} annualVolume - Volumen anual de pruebas estimado
     * @param {Array} consumables - Lista de consumibles asociados a esta determinación
     */
    calculateRequirements(determination, annualVolume, consumables) {
        const results = {
            determination: {
                id: determination.id,
                name: determination.name,
                annual_volume: annualVolume
            },
            consumables: [],
            total_cost: 0
        };

        // Si no hay consumibles, retornamos resultado vacío
        if (!consumables || consumables.length === 0) {
            return results;
        }

        consumables.forEach(consumable => {
            const calculation = this.calculateConsumable(consumable, annualVolume);
            results.consumables.push(calculation);
            results.total_cost += calculation.total_cost;
        });

        return results;
    }

    /**
     * Calcula la cantidad necesaria de un consumible específico
     * @param {Object} consumable - Datos del consumible (incluyendo rate de consumo)
     * @param {number} annualVolume - Volumen anual de pruebas
     */
    calculateConsumable(consumable, annualVolume) {
        // 1. Obtener datos base
        const unitsPerKit = consumable.units_per_kit || 1;
        const unitPrice = parseFloat(consumable.unit_price) || 0;
        const consumptionRate = parseFloat(consumable.consumption_rate) || 1.0; // Cuánto se usa por prueba

        // 2. Calcular consumo total anual (en unidades individuales, ej: ml, tests)
        // Ejemplo: 10,000 pruebas * 1.1 (rate) = 11,000 tests requeridos (incluyendo mermas/repetidos)
        const totalUnitsRequired = annualVolume * consumptionRate;

        // 3. Calcular kits necesarios
        // Ejemplo: 11,000 tests / 100 tests por kit = 110 kits
        const kitsRequired = Math.ceil(totalUnitsRequired / unitsPerKit);

        // 4. Calcular costo total
        const totalCost = kitsRequired * unitPrice;

        return {
            consumable_id: consumable.id,
            name: consumable.name,
            type: consumable.type, // 'reagent', 'calibrator', 'control', 'consumable'
            units_per_kit: unitsPerKit,
            unit_price: unitPrice,
            consumption_rate: consumptionRate,
            total_units_required: totalUnitsRequired,
            kits_required: kitsRequired,
            total_cost: totalCost
        };
    }

    /**
     * Calcula calibradores y controles basados en frecuencia (no solo volumen)
     * @param {Object} item - Datos del calibrador/control
     * @param {number} frequencyDays - Cada cuántos días se usa (ej: 1 = diario, 7 = semanal)
     * @param {number} quantityPerUse - Cuánto se usa cada vez
     */
    calculateQualityControl(item, frequencyDays, quantityPerUse = 1) {
        const daysInYear = 365;
        const usesPerYear = Math.ceil(daysInYear / frequencyDays);
        const totalUnitsRequired = usesPerYear * quantityPerUse;

        const unitsPerKit = item.units_per_kit || 1;
        const unitPrice = parseFloat(item.unit_price) || 0;

        const kitsRequired = Math.ceil(totalUnitsRequired / unitsPerKit);
        const totalCost = kitsRequired * unitPrice;

        return {
            consumable_id: item.id,
            name: item.name,
            type: item.type,
            frequency_days: frequencyDays,
            uses_per_year: usesPerYear,
            kits_required: kitsRequired,
            total_cost: totalCost
        };
    }
}

module.exports = new BusinessCaseCalculator();
