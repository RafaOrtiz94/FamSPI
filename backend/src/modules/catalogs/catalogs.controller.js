const catalogsService = require('./catalogs.service');

// ===== EQUIPOS (solo lectura) =====
exports.getEquipment = async (req, res) => {
    try {
        const { status, name } = req.query;
        const equipment = await catalogsService.getEquipment({ status, name });
        res.json(equipment);
    } catch (error) {
        console.error('Error getting equipment:', error);
        res.status(500).json({ message: 'Error al obtener equipos', error: error.message });
    }
};

exports.getEquipmentById = async (req, res) => {
    try {
        const equipment = await catalogsService.getEquipmentById(req.params.id);
        if (!equipment) {
            return res.status(404).json({ message: 'Equipo no encontrado' });
        }
        res.json(equipment);
    } catch (error) {
        console.error('Error getting equipment by ID:', error);
        res.status(500).json({ message: 'Error al obtener equipo', error: error.message });
    }
};

// ===== DETERMINACIONES =====
exports.getDeterminations = async (req, res) => {
    try {
        const { status, equipmentId, name } = req.query;
        const determinations = await catalogsService.getDeterminations({ status, equipmentId, name });
        res.json(determinations);
    } catch (error) {
        console.error('Error getting determinations:', error);
        res.status(500).json({ message: 'Error al obtener determinaciones', error: error.message });
    }
};

exports.getDeterminationById = async (req, res) => {
    try {
        const determination = await catalogsService.getDeterminationById(req.params.id);
        if (!determination) {
            return res.status(404).json({ message: 'Determinación no encontrada' });
        }
        res.json(determination);
    } catch (error) {
        console.error('Error getting determination by ID:', error);
        res.status(500).json({ message: 'Error al obtener determinación', error: error.message });
    }
};

exports.getDeterminationsByEquipment = async (req, res) => {
    try {
        const determinations = await catalogsService.getDeterminationsByEquipment(req.params.equipmentId);
        res.json(determinations);
    } catch (error) {
        console.error('Error getting determinations by equipment:', error);
        res.status(500).json({ message: 'Error al obtener determinaciones por equipo', error: error.message });
    }
};

exports.createDetermination = async (req, res) => {
    try {
        const determination = await catalogsService.createDetermination(req.body);
        res.status(201).json(determination);
    } catch (error) {
        console.error('Error creating determination:', error);
        res.status(500).json({ message: 'Error al crear determinación', error: error.message });
    }
};

exports.updateDetermination = async (req, res) => {
    try {
        const determination = await catalogsService.updateDetermination(req.params.id, req.body);
        res.json(determination);
    } catch (error) {
        console.error('Error updating determination:', error);
        res.status(500).json({ message: 'Error al actualizar determinación', error: error.message });
    }
};

exports.deleteDetermination = async (req, res) => {
    try {
        await catalogsService.deleteDetermination(req.params.id);
        res.json({ message: 'Determinación eliminada correctamente' });
    } catch (error) {
        console.error('Error deleting determination:', error);
        res.status(500).json({ message: 'Error al eliminar determinación', error: error.message });
    }
};

exports.discontinueDetermination = async (req, res) => {
    try {
        const { replacedById } = req.body;
        const determination = await catalogsService.discontinueDetermination(req.params.id, replacedById);
        res.json(determination);
    } catch (error) {
        console.error('Error discontinuing determination:', error);
        res.status(500).json({ message: 'Error al discontinuar determinación', error: error.message });
    }
};

// ===== CONSUMIBLES =====
exports.getConsumables = async (req, res) => {
    try {
        const { status, type, name } = req.query;
        const consumables = await catalogsService.getConsumables({ status, type, name });
        res.json(consumables);
    } catch (error) {
        console.error('Error getting consumables:', error);
        res.status(500).json({ message: 'Error al obtener consumibles', error: error.message });
    }
};

exports.getConsumableById = async (req, res) => {
    try {
        const consumable = await catalogsService.getConsumableById(req.params.id);
        if (!consumable) {
            return res.status(404).json({ message: 'Consumible no encontrado' });
        }
        res.json(consumable);
    } catch (error) {
        console.error('Error getting consumable by ID:', error);
        res.status(500).json({ message: 'Error al obtener consumible', error: error.message });
    }
};

exports.getConsumablesByDetermination = async (req, res) => {
    try {
        const consumables = await catalogsService.getConsumablesByDetermination(req.params.determinationId);
        res.json(consumables);
    } catch (error) {
        console.error('Error getting consumables by determination:', error);
        res.status(500).json({ message: 'Error al obtener consumibles por determinación', error: error.message });
    }
};

exports.createConsumable = async (req, res) => {
    try {
        const consumable = await catalogsService.createConsumable(req.body);
        res.status(201).json(consumable);
    } catch (error) {
        console.error('Error creating consumable:', error);
        res.status(500).json({ message: 'Error al crear consumible', error: error.message });
    }
};

exports.updateConsumable = async (req, res) => {
    try {
        const consumable = await catalogsService.updateConsumable(req.params.id, req.body);
        res.json(consumable);
    } catch (error) {
        console.error('Error updating consumable:', error);
        res.status(500).json({ message: 'Error al actualizar consumible', error: error.message });
    }
};

exports.deleteConsumable = async (req, res) => {
    try {
        await catalogsService.deleteConsumable(req.params.id);
        res.json({ message: 'Consumible eliminado correctamente' });
    } catch (error) {
        console.error('Error deleting consumable:', error);
        res.status(500).json({ message: 'Error al eliminar consumible', error: error.message });
    }
};

exports.discontinueConsumable = async (req, res) => {
    try {
        const { replacedById } = req.body;
        const consumable = await catalogsService.discontinueConsumable(req.params.id, replacedById);
        res.json(consumable);
    } catch (error) {
        console.error('Error discontinuing consumable:', error);
        res.status(500).json({ message: 'Error al discontinuar consumible', error: error.message });
    }
};

// ===== RELACIONES =====
exports.getEquipmentConsumables = async (req, res) => {
    try {
        const { equipmentId, determinationId } = req.query;
        const relations = await catalogsService.getEquipmentConsumables({ equipmentId, determinationId });
        res.json(relations);
    } catch (error) {
        console.error('Error getting equipment consumables:', error);
        res.status(500).json({ message: 'Error al obtener relaciones', error: error.message });
    }
};

exports.createEquipmentConsumable = async (req, res) => {
    try {
        const relation = await catalogsService.createEquipmentConsumable(req.body);
        res.status(201).json(relation);
    } catch (error) {
        console.error('Error creating equipment consumable relation:', error);
        res.status(500).json({ message: 'Error al crear relación', error: error.message });
    }
};

exports.deleteEquipmentConsumable = async (req, res) => {
    try {
        await catalogsService.deleteEquipmentConsumable(req.params.id);
        res.json({ message: 'Relación eliminada correctamente' });
    } catch (error) {
        console.error('Error deleting equipment consumable relation:', error);
        res.status(500).json({ message: 'Error al eliminar relación', error: error.message });
    }
};

// ===== INVERSIONES CATALOGADAS =====
exports.getInvestments = async (req, res) => {
    try {
        const { status, category, requiresLis, requiresEquipment } = req.query;
        const investments = await catalogsService.getInvestments({ status, category, requiresLis, requiresEquipment });
        res.json(investments);
    } catch (error) {
        console.error('Error getting investments:', error);
        res.status(500).json({ message: 'Error al obtener inversiones', error: error.message });
    }
};

exports.createInvestment = async (req, res) => {
    try {
        const investment = await catalogsService.createInvestment(req.body);
        res.status(201).json(investment);
    } catch (error) {
        console.error('Error creating investment:', error);
        res.status(500).json({ message: 'Error al crear inversión', error: error.message });
    }
};

exports.updateInvestment = async (req, res) => {
    try {
        const investment = await catalogsService.updateInvestment(req.params.id, req.body);
        res.json(investment);
    } catch (error) {
        console.error('Error updating investment:', error);
        res.status(500).json({ message: 'Error al actualizar inversión', error: error.message });
    }
};

// ===== VISTAS =====
exports.getEquipmentWithDeterminations = async (req, res) => {
    try {
        const data = await catalogsService.getEquipmentWithDeterminations();
        res.json(data);
    } catch (error) {
        console.error('Error getting equipment with determinations:', error);
        res.status(500).json({ message: 'Error al obtener equipos con determinaciones', error: error.message });
    }
};
