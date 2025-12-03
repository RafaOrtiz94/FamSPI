const db = require('../../config/db');
const calculator = require('./bc.calculator');
const catalogsService = require('../catalogs/catalogs.service');

class BusinessCaseService {

    /**
     * Calcula un Business Case completo basado en una lista de determinaciones y volúmenes
     * @param {Array} items - Lista de objetos { determinationId, annualVolume }
     */
    async calculateBusinessCase(items) {
        const results = {
            details: [],
            summary: {
                total_cost: 0,
                total_kits: 0
            }
        };

        for (const item of items) {
            // 1. Obtener datos de la determinación
            const determination = await catalogsService.getDeterminationById(item.determinationId);

            if (!determination) {
                throw new Error(`Determinación ID ${item.determinationId} no encontrada`);
            }

            // 2. Obtener consumibles asociados
            const consumables = await catalogsService.getConsumablesByDetermination(item.determinationId);

            // 3. Calcular requerimientos usando el motor de cálculo
            const calculation = calculator.calculateRequirements(
                determination,
                item.annualVolume,
                consumables
            );

            results.details.push(calculation);
            results.summary.total_cost += calculation.total_cost;

            calculation.consumables.forEach(c => {
                results.summary.total_kits += c.kits_required;
            });
        }

        return results;
    }
}

module.exports = new BusinessCaseService();
