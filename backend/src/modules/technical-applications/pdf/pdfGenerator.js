const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../../../config/logger');

/**
 * Generador de PDFs a partir de plantillas
 */
class PDFGenerator {

    /**
     * Genera un PDF rellenando una plantilla
     */
    async generate(documentType, formData) {
        try {
            logger.info('Generating PDF for type: %s', documentType);

            // Seleccionar generador específico según tipo
            switch (documentType) {
                case 'DISINFECTION':
                    return await this.generateDisinfection(formData);

                // Otros tipos usarán generador genérico por ahora
                default:
                    return await this.generateGeneric(documentType, formData);
            }

        } catch (error) {
            logger.error('Error generating PDF:', error);
            throw error;
        }
    }

    /**
     * Genera PDF de Desinfección
     */
    async generateDisinfection(formData) {
        try {
            const templatePath = path.join(
                __dirname,
                '../../../data/plantillas',
                'F.ST-02_V04_DESINFECCIÓN DE INSTRUMENTOS Y PARTES.pdf'
            );

            // Leer plantilla
            const existingPdfBytes = await fs.readFile(templatePath);
            const pdfDoc = await PDFDocument.load(existingPdfBytes);

            // Obtener el formulario
            const form = pdfDoc.getForm();

            // Rellenar campos de texto
            this.fillTextField(form, 'fecha_actual', formData.fecha_actual || new Date().toLocaleDateString('es-EC'));
            this.fillTextField(form, 'Equipo', formData.Equipo || '');
            this.fillTextField(form, 'Parte_repuesto', formData.Parte_repuesto || 'No aplica');
            this.fillTextField(form, 'Serie_E', formData.Serie_E || '');
            this.fillTextField(form, 'Responsable', formData.Responsable || '');

            // Rellenar checkboxes de pasos
            const checkboxes = [
                'x1', 'x2',
                'x3_1', 'x3_2',
                'x4_1', 'x4_2',
                'x5_1', 'x5_2',
                'x6_1', 'x6_2',
                'x7_1', 'x7_2',
                'x8_1', 'x8_2', 'x8_3',
                'x9_1', 'x9_2', 'x9_3',
                'x10',
                'x11_1', 'x11_2', 'x11_3',
                'x12_1', 'x12_2', 'x12_3'
            ];

            checkboxes.forEach(name => {
                if (formData[name]) {
                    this.checkCheckbox(form, name);
                }
            });

            // Insertar firma (si existe)
            if (formData.firma_ing) {
                await this.insertSignature(pdfDoc, form, 'firma_ing', formData.firma_ing);
            }

            // Insertar imagen de evidencia (si existe)
            if (formData.img) {
                await this.insertImage(pdfDoc, form, 'img', formData.img);
            }

            // Aplanar formulario para que no sea editable
            form.flatten();

            // Guardar PDF
            const pdfBytes = await pdfDoc.save();
            return Buffer.from(pdfBytes);

        } catch (error) {
            logger.error('Error in generateDisinfection:', error);
            throw error;
        }
    }

    /**
     * Genera PDF genérico (para otros tipos de documentos)
     */
    async generateGeneric(documentType, formData) {
        // Por ahora retorna un PDF simple con los datos
        // Esto se implementará cuando se soliciten las otras plantillas
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595, 842]); // A4

        page.drawText(`Documento: ${documentType}`, {
            x: 50,
            y: 750,
            size: 16
        });

        page.drawText('Este documento se generará con la plantilla correspondiente', {
            x: 50,
            y: 700,
            size: 12
        });

        const pdfBytes = await pdfDoc.save();
        return Buffer.from(pdfBytes);
    }

    /**
     * Rellena un campo de texto del formulario
     */
    fillTextField(form, fieldName, value) {
        try {
            const field = form.getTextField(fieldName);
            if (field) {
                field.setText(String(value));
            }
        } catch (error) {
            logger.warn('Field not found or error filling: %s', fieldName);
        }
    }

    /**
     * Marca un checkbox del formulario
     */
    checkCheckbox(form, fieldName) {
        try {
            const field = form.getCheckBox(fieldName);
            if (field) {
                field.check();
            }
        } catch (error) {
            logger.warn('Checkbox not found or error checking: %s', fieldName);
        }
    }

    /**
     * Inserta una firma en el PDF
     */
    async insertSignature(pdfDoc, form, fieldName, signatureBase64) {
        try {
            // La firma viene en base64, convertirla a imagen
            const signatureData = signatureBase64.replace(/^data:image\/png;base64,/, '');
            const signatureBytes = Buffer.from(signatureData, 'base64');

            const signatureImage = await pdfDoc.embedPng(signatureBytes);

            // Buscar el campo y obtener su posición
            const field = form.getButton(fieldName);
            if (!field) {
                logger.warn('Signature field not found: %s', fieldName);
                return;
            }

            const widgets = field.acroField.getWidgets();
            if (widgets.length === 0) return;

            const widget = widgets[0];
            const rect = widget.getRectangle();
            const page = pdfDoc.getPages()[0]; // Asumimos primera página

            // Dibujar firma
            page.drawImage(signatureImage, {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
            });

        } catch (error) {
            logger.error('Error inserting signature:', error);
        }
    }

    /**
     * Inserta una imagen en el PDF
     */
    async insertImage(pdfDoc, form, fieldName, imageBase64) {
        try {
            const imageData = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
            const imageBytes = Buffer.from(imageData, 'base64');

            // Detectar formato
            let image;
            if (imageBase64.includes('data:image/png')) {
                image = await pdfDoc.embedPng(imageBytes);
            } else {
                image = await pdfDoc.embedJpg(imageBytes);
            }

            const field = form.getButton(fieldName);
            if (!field) {
                logger.warn('Image field not found: %s', fieldName);
                return;
            }

            const widgets = field.acroField.getWidgets();
            if (widgets.length === 0) return;

            const widget = widgets[0];
            const rect = widget.getRectangle();
            const page = pdfDoc.getPages()[0];

            // Calcular dimensiones manteniendo aspect ratio
            const scale = Math.min(rect.width / image.width, rect.height / image.height);

            page.drawImage(image, {
                x: rect.x,
                y: rect.y,
                width: image.width * scale,
                height: image.height * scale
            });

        } catch (error) {
            logger.error('Error inserting image:', error);
        }
    }
}

module.exports = new PDFGenerator();
