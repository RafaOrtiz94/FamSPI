const contractsService = require('./contracts.service');

exports.activateBusinessCase = async (req, res) => {
    try {
        const { businessCaseId } = req.params;
        const { determinations } = req.body; // [{ determination_id, annual_volume }]

        const inventory = await contractsService.activateBusinessCase(businessCaseId, determinations);

        res.status(201).json({
            message: 'Business Case activado e inventario creado',
            inventory
        });
    } catch (error) {
        console.error('Error activating business case:', error);
        res.status(500).json({ message: 'Error al activar Business Case', error: error.message });
    }
};

exports.registerConsumption = async (req, res) => {
    try {
        const { contract_determination_id, quantity, source = 'manual', notes } = req.body;

        const result = await contractsService.registerConsumption({
            contractDeterminationId: contract_determination_id,
            quantity,
            userId: req.user.id,
            source,
            notes
        });

        res.json({
            message: 'Consumo registrado correctamente',
            ...result
        });
    } catch (error) {
        console.error('Error registering consumption:', error);
        res.status(500).json({ message: 'Error al registrar consumo', error: error.message });
    }
};

exports.getInventoryByBusinessCase = async (req, res) => {
    try {
        const { businessCaseId } = req.params;
        const inventory = await contractsService.getInventoryByBusinessCase(businessCaseId);
        res.json(inventory);
    } catch (error) {
        console.error('Error getting inventory:', error);
        res.status(500).json({ message: 'Error al obtener inventario', error: error.message });
    }
};

exports.getInventoryByClient = async (req, res) => {
    try {
        const { clientId } = req.params;
        const inventory = await contractsService.getInventoryByClient(clientId);
        res.json(inventory);
    } catch (error) {
        console.error('Error getting client inventory:', error);
        res.status(500).json({ message: 'Error al obtener inventario del cliente', error: error.message });
    }
};

exports.updateAlertThresholds = async (req, res) => {
    try {
        const { contractDeterminationId } = req.params;
        const { alert_threshold_yellow, alert_threshold_red } = req.body;

        const updated = await contractsService.updateAlertThresholds(
            contractDeterminationId,
            { alert_threshold_yellow, alert_threshold_red }
        );

        res.json(updated);
    } catch (error) {
        console.error('Error updating thresholds:', error);
        res.status(500).json({ message: 'Error al actualizar umbrales', error: error.message });
    }
};
