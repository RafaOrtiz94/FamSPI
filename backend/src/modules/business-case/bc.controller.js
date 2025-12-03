const bcService = require('./bc.service');

exports.calculate = async (req, res) => {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Se requiere una lista de items { determinationId, annualVolume }' });
        }

        const result = await bcService.calculateBusinessCase(items);
        res.json(result);
    } catch (error) {
        console.error('Error calculating business case:', error);
        res.status(500).json({ message: 'Error en el cálculo', error: error.message });
    }
};
