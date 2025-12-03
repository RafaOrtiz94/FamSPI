const alertsService = require('./alerts.service');

exports.getAlertsByBusinessCase = async (req, res) => {
    try {
        const { businessCaseId } = req.params;
        const alerts = await alertsService.getAlertsByBusinessCase(businessCaseId);
        res.json(alerts);
    } catch (error) {
        console.error('Error getting alerts:', error);
        res.status(500).json({ message: 'Error al obtener alertas', error: error.message });
    }
};

exports.getActiveAlerts = async (req, res) => {
    try {
        const alerts = await alertsService.getActiveAlerts();
        res.json(alerts);
    } catch (error) {
        console.error('Error getting active alerts:', error);
        res.status(500).json({ message: 'Error al obtener alertas activas', error: error.message });
    }
};

exports.acknowledgeAlert = async (req, res) => {
    try {
        const { alertId } = req.params;
        const alert = await alertsService.acknowledgeAlert(alertId, req.user.id);
        res.json({ message: 'Alerta reconocida', alert });
    } catch (error) {
        console.error('Error acknowledging alert:', error);
        res.status(500).json({ message: 'Error al reconocer alerta', error: error.message });
    }
};

exports.detectUnusualConsumption = async (req, res) => {
    try {
        const results = await alertsService.detectUnusualConsumptionForAll();
        res.json({
            message: 'Detección completada',
            alertsCreated: results.length,
            results
        });
    } catch (error) {
        console.error('Error detecting unusual consumption:', error);
        res.status(500).json({ message: 'Error al detectar consumos inusuales', error: error.message });
    }
};
