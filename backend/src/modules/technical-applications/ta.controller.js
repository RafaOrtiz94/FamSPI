const taService = require('./ta.service');
const logger = require('../../config/logger');

/**
 * Obtiene los tipos de documentos disponibles para el usuario
 */
exports.getAvailableDocuments = async (req, res) => {
    try {
        const userRole = req.user?.role || '';
        const documents = taService.getAvailableDocumentTypes(userRole);

        res.json({
            success: true,
            documents
        });
    } catch (error) {
        logger.error('Error getting available documents:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener documentos disponibles',
            error: error.message
        });
    }
};

/**
 * Crea un nuevo documento técnico
 */
exports.createDocument = async (req, res) => {
    try {
        const { documentType, formData } = req.body;
        const userId = req.user.id;
        const userEmail = req.user.email;
        const userName = req.user.name || req.user.fullname;

        if (!documentType || !formData) {
            return res.status(400).json({
                success: false,
                message: 'documentType y formData son requeridos'
            });
        }

        const result = await taService.createDocument(
            userId,
            userEmail,
            userName,
            documentType,
            formData
        );

        res.status(201).json(result);

    } catch (error) {
        logger.error('Error creating document:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear documento',
            error: error.message
        });
    }
};

/**
 * Obtiene el historial de documentos
 */
exports.getDocumentHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const filters = {
            myDocuments: req.query.myDocuments === 'true',
            documentType: req.query.documentType,
            equipmentName: req.query.equipmentName,
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };

        const documents = await taService.getDocumentHistory(userId, filters);

        res.json({
            success: true,
            documents
        });

    } catch (error) {
        logger.error('Error getting document history:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener historial',
            error: error.message
        });
    }
};

/**
 * Obtiene un documento específico por ID
 */
exports.getDocumentById = async (req, res) => {
    try {
        const { id } = req.params;
        const document = await taService.getDocumentById(id);

        if (!document) {
            return res.status(404).json({
                success: false,
                message: 'Documento no encontrado'
            });
        }

        res.json({
            success: true,
            document
        });

    } catch (error) {
        logger.error('Error getting document by ID:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener documento',
            error: error.message
        });
    }
};
