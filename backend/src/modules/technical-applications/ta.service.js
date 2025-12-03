const db = require('../../config/db');
const logger = require('../../config/logger');
const pdfGenerator = require('./pdf/pdfGenerator');
const driveService = require('./driveService');

/**
 * Tipos de documentos técnicos
 */
const DOCUMENT_TYPES = {
    DISINFECTION: {
        code: 'F.ST-02',
        name: 'Desinfección de Instrumentos y Partes',
        roles: ['tecnico'],
        template: 'F.ST-02_V04_DESINFECCIÓN DE INSTRUMENTOS Y PARTES.pdf'
    },
    ENVIRONMENT_INSPECTION: {
        code: 'F.ST-03',
        name: 'Inspección de Ambiente',
        roles: ['tecnico'],
        template: 'F.ST-03_INSPECCION_AMBIENTE.pdf'
    },
    TRAINING_COORDINATION: {
        code: 'F.AP-01',
        name: 'Coordinación de Fecha de Entrenamiento',
        roles: ['ing_aplicaciones'],
        template: 'F.AP-01_COORDINACION_ENTRENAMIENTO.pdf'
    },
    TRAINING_ATTENDANCE: {
        code: 'F.AP-02',
        name: 'Lista de Asistencia - Entrenamientos',
        roles: ['ing_aplicaciones'],
        template: 'F.AP-02_LISTA_ASISTENCIA.pdf'
    },
    TRAINING_SATISFACTION: {
        code: 'F.AP-03',
        name: 'Encuesta de Satisfacción de la Capacitación',
        roles: ['ing_aplicaciones'],
        template: 'F.AP-03_ENCUESTA_SATISFACCION.pdf'
    },
    EQUIPMENT_EVALUATION: {
        code: 'F.AP-04',
        name: 'Evaluación Entrenamiento de Equipos',
        roles: ['ing_aplicaciones'],
        template: 'F.AP-04_EVALUACION_ENTRENAMIENTO.pdf'
    },
    EQUIPMENT_VERIFICATION: {
        code: 'F.AP-05',
        name: 'Verificación de Equipos Nuevos',
        roles: ['ing_aplicaciones'],
        template: 'F.AP-05_VERIFICACION_EQUIPOS.pdf'
    },
    CONFORMITY_ACT: {
        code: 'F.AP-06',
        name: 'Acta de Conformidad',
        roles: ['ing_aplicaciones'],
        template: 'F.AP-06_ACTA_CONFORMIDAD.pdf'
    },
    INSTALLATION_REPORT: {
        code: 'F.AP-07',
        name: 'Informe de Instalación',
        roles: ['ing_aplicaciones'],
        template: 'F.AP-07_INFORME_INSTALACION.pdf'
    },
    SERVICE_REPORT: {
        code: 'F.AP-08',
        name: 'Reporte de Servicio',
        roles: ['ing_aplicaciones'],
        template: 'F.AP-08_REPORTE_SERVICIO.pdf'
    },
    ANNUAL_MAINTENANCE_SCHEDULE: {
        code: 'F.JT-01',
        name: 'Cronograma Anual de Mantenimiento Preventivo',
        roles: ['jefe_tecnico'],
        template: 'F.JT-01_CRONOGRAMA_ANUAL_MP.pdf'
    },
    MAINTENANCE_SCHEDULE: {
        code: 'F.JT-02',
        name: 'Cronograma de Mantenimiento Preventivo',
        roles: ['jefe_tecnico'],
        template: 'F.JT-02_CRONOGRAMA_MP.pdf'
    },
    TRAINING_SCHEDULE: {
        code: 'F.JT-03',
        name: 'Cronograma de Capacitación - Personal del Área de Servicio',
        roles: ['jefe_tecnico'],
        template: 'F.JT-03_CRONOGRAMA_CAPACITACION.pdf'
    }
};

class TechnicalApplicationsService {

    /**
     * Obtiene los tipos de documentos disponibles para un rol
     */
    getAvailableDocumentTypes(userRole) {
        const normalizedRole = (userRole || '').toLowerCase().replace(/ /g, '_');

        const available = [];
        for (const [key, doc] of Object.entries(DOCUMENT_TYPES)) {
            if (doc.roles.includes(normalizedRole)) {
                available.push({
                    type: key,
                    ...doc
                });
            }
        }

        return available;
    }

    /**
     * Crea un documento técnico
     */
    async createDocument(userId, userEmail, userName, documentType, formData) {
        try {
            const docConfig = DOCUMENT_TYPES[documentType];

            if (!docConfig) {
                throw new Error(`Tipo de documento inválido: ${documentType}`);
            }

            // 1. Generar PDF
            logger.info('Generating PDF for document type: %s', documentType);
            const pdfBuffer = await pdfGenerator.generate(documentType, formData);

            // 2. Subir a Drive
            logger.info('Uploading PDF to Google Drive');
            const driveResult = await driveService.uploadDocument(
                pdfBuffer,
                documentType,
                formData,
                docConfig
            );

            // 3. Guardar registro en BD
            const { rows } = await db.query(
                `INSERT INTO technical_documents 
         (document_type, document_code, user_id, user_email, user_name, 
          form_data, file_name, file_path, drive_file_id, drive_folder_id,
          equipment_name, equipment_serial, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
                [
                    documentType,
                    docConfig.code,
                    userId,
                    userEmail,
                    userName,
                    JSON.stringify(formData),
                    driveResult.fileName,
                    driveResult.filePath,
                    driveResult.fileId,
                    driveResult.folderId,
                    formData.equipment_name || formData.Equipo || null,
                    formData.equipment_serial || formData.Serie_E || null,
                    'generated'
                ]
            );

            logger.info('Technical document created: ID %s', rows[0].id);

            return {
                success: true,
                document: rows[0],
                driveUrl: driveResult.webViewLink
            };

        } catch (error) {
            logger.error('Error creating technical document:', error);
            throw error;
        }
    }

    /**
     * Obtiene el historial de documentos
     */
    async getDocumentHistory(userId, filters = {}) {
        let query = `
      SELECT 
        td.*,
        u.name as created_by_name,
        u.email as created_by_email
      FROM technical_documents td
      LEFT JOIN users u ON td.user_id = u.id
      WHERE 1=1
    `;

        const params = [];
        let paramCount = 1;

        // Filtro por usuario (opcional)
        if (filters.myDocuments) {
            params.push(userId);
            query += ` AND td.user_id = $${paramCount}`;
            paramCount++;
        }

        // Filtro por tipo de documento
        if (filters.documentType) {
            params.push(filters.documentType);
            query += ` AND td.document_type = $${paramCount}`;
            paramCount++;
        }

        // Filtro por equipo
        if (filters.equipmentName) {
            params.push(`%${filters.equipmentName}%`);
            query += ` AND td.equipment_name ILIKE $${paramCount}`;
            paramCount++;
        }

        // Filtro por fecha
        if (filters.startDate) {
            params.push(filters.startDate);
            query += ` AND td.created_at >= $${paramCount}`;
            paramCount++;
        }

        if (filters.endDate) {
            params.push(filters.endDate);
            query += ` AND td.created_at <= $${paramCount}`;
            paramCount++;
        }

        query += ' ORDER BY td.created_at DESC LIMIT 100';

        const { rows } = await db.query(query, params);
        return rows;
    }

    /**
     * Obtiene un documento por ID
     */
    async getDocumentById(id) {
        const { rows } = await db.query(
            `SELECT 
        td.*,
        u.name as created_by_name,
        u.email as created_by_email
      FROM technical_documents td
      LEFT JOIN users u ON td.user_id = u.id
      WHERE td.id = $1`,
            [id]
        );

        return rows[0] || null;
    }
}

module.exports = new TechnicalApplicationsService();
module.exports.DOCUMENT_TYPES = DOCUMENT_TYPES;
