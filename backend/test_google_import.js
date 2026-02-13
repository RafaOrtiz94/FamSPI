
const axios = require('axios');

async function testGoogleScriptImport() {
  console.log('--- Simulating Google Script POST ---');
  
  const payload = {
    "Dirección de correo electrónico": "google_test_" + Date.now() + "@example.com",
    "Nombres": "Google",
    "Apellidos": "Script Test",
    "Cédula de ciudadanía": "9998887776",
    "Puesto al que aplica": "QA Engineer",
    "Teléfono": "0987654321",
    "Estado Civil": "Soltero",
    "Género": "Masculino",
    "Tipo de Sangre": "O+",
    "Lugar de Nacimiento (Provincia / Ciudad)": "Quito",
    "Lugar de Residencia (Provincia / Ciudad)": "Guayaquil",
    "Vive con:": "Padres",
    "Personas que dependen de usted:": "0",
    "Número de hijos:": "0",
    "Tiene licencia de manejo?": "Si",
    "Escoja tipo licencia": "Tipo B",
    "Auto identificación": "Mestizo",
    "En cuanto tiempo podria incorporarse?": "Inmediato",
    "Aspiración Salarial": "1200",
    "Institución Educativa (Universidad)": "UCE",
    "Título recibido (Universidad)": "Ingeniero",
    "estado": "postulante"
  };

  try {
    const response = await axios.post('http://localhost:8080/api/applicants/import', payload, {
      headers: {
        'x-api-key': 'AFPSPI2026V1',
        'Content-Type': 'application/json'
      }
    });

    console.log('Response status:', response.status);
    console.log('Response data:', response.data);

    if (response.data.ok) {
      console.log('SUCCESS: Applicant imported correctly via simulated Google Script!');
    } else {
      console.log('FAILED: Response was not OK', response.data);
    }
  } catch (err) {
    console.error('Import failed:', err.response ? err.response.data : err.message);
  }
}

testGoogleScriptImport();
