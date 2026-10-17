require('dotenv').config({ path: './.env' });
const db = require('../src/config/db');
const requests = require('../src/modules/requests/requests.service');

async function main() {
  try {
    const res = await requests.createRequest({
      requester_id: 1,
      request_type_id: 'F.ST-20',
      payload: {
        nombre_cliente: 'Cliente Demo',
        direccion_cliente: 'Av. Demo 123',
        persona_contacto: 'Juan Perez',
        celular_contacto: '099999999',
        fecha_instalacion: '2025-11-13',
        equipos: [{ nombre_equipo: 'Sensor', estado: 'OK' }],
        anotaciones: 'Prueba automática',
      },
      files: [
        {
          name: 'foto1.png',
          base64: Buffer.from('demo').toString('base64'),
          mimetype: 'image/png',
        },
      ],
    });
    console.log('Resultado:', res);
  } catch (err) {
    console.error('Falló:', err.message);
  } finally {
    db.pool?.end?.();
  }
}
main();
