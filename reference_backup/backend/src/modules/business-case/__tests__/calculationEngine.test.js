/**
 * Tests del Motor de Cálculos Flexible
 * =====================================
 */

const calculationEngine = require('../calculationEngine.service');

describe('Calculation Engine', () => {
    describe('evaluateExpression', () => {
        it('should evaluate simple arithmetic', () => {
            const result = calculationEngine.evaluateExpression('2 + 3 * 4', {});
            expect(result).toBe(14);
        });

        it('should evaluate with variables', () => {
            const result = calculationEngine.evaluateExpression(
                '(a + b) * c',
                { a: 5, b: 3, c: 2 }
            );
            expect(result).toBe(16);
        });

        it('should handle decimals correctly', () => {
            const result = calculationEngine.evaluateExpression(
                '(0.5 + 0.3) * 100',
                {}
            );
            expect(result).toBe(80);
        });

        it('should prevent dangerous code execution', () => {
            expect(() => {
                calculationEngine.evaluateExpression('import("fs")', {});
            }).toThrow();
        });
    });

    describe('evaluateConditional', () => {
        it('should evaluate first matching condition', async () => {
            const formula = {
                type: 'conditional',
                rules: [
                    { condition: 'monthly_quantity > 1000', formula: 'monthly_quantity * 0.9' },
                    { condition: 'monthly_quantity > 500', formula: 'monthly_quantity * 0.95' },
                    { condition: 'true', formula: 'monthly_quantity * 1.0' }
                ],
                variables: {
                    monthly_quantity: { source: 'context', type: 'integer' }
                }
            };

            const result1 = await calculationEngine.executeFormula(formula, { monthly_quantity: 1500 });
            expect(result1).toBe(1350); // Con 10% descuento

            const result2 = await calculationEngine.executeFormula(formula, { monthly_quantity: 800 });
            expect(result2).toBe(760); // Con 5% descuento

            const result3 = await calculationEngine.executeFormula(formula, { monthly_quantity: 300 });
            expect(result3).toBe(300); // Sin descuento
        });
    });

    describe('evaluatePipeline', () => {
        it('should execute steps in order', async () => {
            const formula = {
                type: 'pipeline',
                steps: [
                    { name: 'step1', formula: 'a * 2', output: 'result1' },
                    { name: 'step2', formula: 'result1 + b', output: 'result2' },
                    { name: 'step3', formula: 'result2 * 3', output: 'final' }
                ],
                variables: {
                    a: { source: 'context' },
                    b: { source: 'context' }
                }
            };

            const result = await calculationEngine.executeFormula(formula, { a: 5, b: 10 });
            expect(result).toBe(60); // (5*2 + 10) * 3 = 60
        });
    });

    describe('Real-world formulas', () => {
        it('should calculate standard consumption', async () => {
            const formula = {
                type: 'expression',
                expression: '(volume_per_test + reagent_consumption) * monthly_quantity',
                variables: {
                    volume_per_test: { source: 'context', default: 0 },
                    reagent_consumption: { source: 'context', default: 0 },
                    monthly_quantity: { source: 'context', required: true }
                }
            };

            const result = await calculationEngine.executeFormula(formula, {
                volume_per_test: 0.180,
                reagent_consumption: 0.250,
                monthly_quantity: 1000
            });

            expect(result).toBe(430); // (0.18 + 0.25) * 1000
        });

        it('should calculate with wash cycles', async () => {
            const formula = {
                type: 'expression',
                expression: '(volume_per_test + reagent_consumption + (wash_cycles * 0.5)) * monthly_quantity',
                variables: {
                    volume_per_test: { source: 'context', default: 0 },
                    reagent_consumption: { source: 'context', default: 0 },
                    wash_cycles: { source: 'context', default: 0 },
                    monthly_quantity: { source: 'context', required: true }
                }
            };

            const result = await calculationEngine.executeFormula(formula, {
                volume_per_test: 0.180,
                reagent_consumption: 0.250,
                wash_cycles: 2,
                monthly_quantity: 1000
            });

            expect(result).toBe(1430); // (0.18 + 0.25 + (2*0.5)) * 1000
        });
    });

    describe('getApplicableFormula', () => {
        // Estos tests requieren BD mock o base de datos de test
        it.skip('should get formula from determination if exists', async () => {
            // TODO: Implementar con mock de BD
        });

        it.skip('should fallback to equipment formula', async () => {
            // TODO: Implementar con mock de BD
        });

        it('should return default formula as fallback', () => {
            const defaultFormula = calculationEngine.getDefaultFormula('consumption');
            expect(defaultFormula).toHaveProperty('type');
            expect(defaultFormula).toHaveProperty('expression');
            expect(defaultFormula).toHaveProperty('variables');
        });
    });

    describe('Security tests', () => {
        it('should prevent eval injection', () => {
            expect(() => {
                calculationEngine.evaluateExpression('eval("console.log(1)")', {});
            }).toThrow();
        });

        it('should prevent require injection', () => {
            expect(() => {
                calculationEngine.evaluateExpression('require("fs")', {});
            }).toThrow();
        });

        it('should prevent import injection', () => {
            const formula = {
                type: 'expression',
                expression: 'import("crypto")',
                variables: {}
            };

            expect(async () => {
                await calculationEngine.executeFormula(formula, {});
            }).rejects.toThrow();
        });
    });
});
