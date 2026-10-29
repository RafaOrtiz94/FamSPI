const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const run = async () => {
    try {
        const pdfPath = path.join(__dirname, 'src', 'data', 'plantillas', 'F.RH-09_V01_REGISTRO DE ASISTENCIA .pdf');
        const pdfBytes = fs.readFileSync(pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const form = pdfDoc.getForm();
        const fields = form.getFields();

        console.log('--- PDF Fields ---');
        fields.forEach(field => {
            const type = field.constructor.name;
            const name = field.getName();
            console.log(`Type: ${type}, Name: ${name}`);
        });
        console.log('------------------');
    } catch (err) {
        console.error('Error inspecting PDF:', err);
    }
};

run();
