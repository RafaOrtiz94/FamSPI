const path = require('path');
const { google } = require('googleapis');
const logger = require('../../config/logger');

// Nota: Reutilizamos la autenticación de Gmail existente
const DRIVE_ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID || '1Hx_example';

class DriveService {

    /**
     * Obtiene el cliente de Drive autenticado
     */
    async getDriveClient(userEmail) {
        try {
            // Aquí reutilizamos la lógica de gmail/gmailService.js
            // para obtener el oauth2Client ya autenticado
            const gmailService = require('../gmail/gmailService');
            const oauth2Client = await gmailService.getAuthClient(userEmail);

            return google.drive({ version: 'v3', auth: oauth2Client });
        } catch (error) {
            logger.error('Error getting Drive client:', error);
            throw new Error('No se pudo autenticar con Google Drive');
        }
    }

    /**
     * Crea la estructura de carpetas para documentos técnicos
     */
    async ensureFolderStructure(drive, documentType, docConfig) {
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');

            // 1. Buscar/crear carpeta "Servicio Técnico"
            let servicioFolderId = await this.findOrCreateFolder(
                drive,
                'Servicio Técnico',
                DRIVE_ROOT_FOLDER_ID
            );

            // 2. Buscar/crear carpeta por tipo de documento
            const categoryFolder = this.getCategoryFolder(documentType);
            let categoryFolderId = await this.findOrCreateFolder(
                drive,
                categoryFolder,
                servicioFolderId
            );

            // 3. Buscar/crear carpeta por año
            let yearFolderId = await this.findOrCreateFolder(
                drive,
                year.toString(),
                categoryFolderId
            );

            // 4. Buscar/crear carpeta por mes
            let monthFolderId = await this.findOrCreateFolder(
                drive,
                month,
                yearFolderId
            );

            return monthFolderId;

        } catch (error) {
            logger.error('Error ensuring folder structure:', error);
            throw error;
        }
    }

    /**
     * Obtiene el nombre de la carpeta categoría según el tipo de documento
     */
    getCategoryFolder(documentType) {
        if (documentType.includes('DISINFECTION') || documentType.includes('ENVIRONMENT')) {
            return 'Técnicos';
        } else if (documentType.startsWith('F.AP')) {
            return 'Aplicaciones';
        } else if (documentType.startsWith('F.JT')) {
            return 'Jefe Técnico';
        }
        return 'Otros';
    }

    /**
     * Busca una carpeta o la crea si no existe
     */
    async findOrCreateFolder(drive, folderName, parentId) {
        try {
            // Buscar carpeta existente
            const response = await drive.files.list({
                q: `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: 'files(id, name)',
                spaces: 'drive'
            });

            if (response.data.files.length > 0) {
                return response.data.files[0].id;
            }

            // Crear carpeta si no existe
            const fileMetadata = {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parentId]
            };

            const folder = await drive.files.create({
                resource: fileMetadata,
                fields: 'id'
            });

            logger.info('Created folder: %s (ID: %s)', folderName, folder.data.id);
            return folder.data.id;

        } catch (error) {
            logger.error('Error finding/creating folder:', error);
            throw error;
        }
    }

    /**
     * Sube un documento PDF a Drive
     */
    async uploadDocument(pdfBuffer, documentType, formData, docConfig) {
        try {
            // Por ahora, usamos un email default del sistema
            // En producción, esto debería usar el token del usuario actual
            const systemEmail = process.env.SYSTEM_EMAIL || 'sistema@famspi.com';
            const drive = await this.getDriveClient(systemEmail);

            // Crear estructura de carpetas
            const folderId = await this.ensureFolderStructure(drive, documentType, docConfig);

            // Generar nombre de archivo
            const fileName = this.generateFileName(documentType, formData, docConfig);

            // Metadata del archivo
            const fileMetadata = {
                name: fileName,
                parents: [folderId],
                mimeType: 'application/pdf'
            };

            const media = {
                mimeType: 'application/pdf',
                body: pdfBuffer
            };

            // Subir archivo
            const file = await drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id, name, webViewLink'
            });

            logger.info('Uploaded file to Drive: %s (ID: %s)', fileName, file.data.id);

            return {
                fileId: file.data.id,
                fileName: file.data.name,
                webViewLink: file.data.webViewLink,
                folderId: folderId,
                filePath: `Servicio Técnico/${this.getCategoryFolder(documentType)}/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${fileName}`
            };

        } catch (error) {
            logger.error('Error uploading document to Drive:', error);
            throw error;
        }
    }

    /**
     * Genera el nombre del archivo según el tipo de documento
     */
    generateFileName(documentType, formData, docConfig) {
        const now = new Date();
        const timestamp = now.toISOString().split('T')[0].replace(/-/g, '');

        let baseName = docConfig.code;

        // Agregar información relevante según tipo
        if (formData.Equipo) {
            baseName += `_${formData.Equipo.replace(/[^a-zA-Z0-9]/g, '_')}`;
        }

        if (formData.Serie_E) {
            baseName += `_${formData.Serie_E}`;
        }

        return `${baseName}_${timestamp}.pdf`;
    }
}

module.exports = new DriveService();
