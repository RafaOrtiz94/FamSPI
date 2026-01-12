/**
 * Tests HTTP en-proceso para endpoint GET /api/v1/dashboard/comercial/summary
 * Pruebas sin servidor persistente usando Supertest
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock Google dependencies before importing app
jest.mock('../backend/src/utils/drive', () => ({}));
jest.mock('../backend/src/config/google', () => ({
    gmailClient: {},
    driveClient: {}
}));

// Importar app Express (sin listen) después de mocks
const app = require('../backend/src/app');

// Mock de middlewares de autenticación para testing
const originalVerifyToken = require('../backend/src/middlewares/auth').verifyToken;
const originalRequireRole = require('../backend/src/middlewares/auth').requireRole;

// Usuario de prueba con rol comercial
const testUser = {
    id: 1,
    email: 'test@famproject.com.ec',
    role: 'comercial',
    name: 'Usuario Test'
};

// Token JWT de prueba (válido para testing)
const testToken = jwt.sign(testUser, process.env.SECRET_KEY || 'test_secret_key');

describe('GET /api/v1/dashboard/comercial/summary', () => {
    beforeAll(() => {
        // Mock verifyToken para testing
        require('../backend/src/middlewares/auth').verifyToken = (req, res, next) => {
            req.user = testUser;
            next();
        };

        // Mock requireRole para testing
        require('../backend/src/middlewares/auth').requireRole = (allowedRoles) => {
            return (req, res, next) => {
                if (allowedRoles.includes(testUser.role)) {
                    next();
                } else {
                    res.status(403).json({ ok: false, message: 'Forbidden' });
                }
            };
        };
    });

    afterAll(() => {
        // Restaurar middlewares originales
        require('../backend/src/middlewares/auth').verifyToken = originalVerifyToken;
        require('../backend/src/middlewares/auth').requireRole = originalRequireRole;
    });

    describe('Autenticación y autorización', () => {
        test('debe responder 200 con token válido', async () => {
            const response = await request(app)
                .get('/api/v1/dashboard/comercial/summary')
                .set('Authorization', `Bearer ${testToken}`);

            expect(response.status).toBe(200);
            expect(response.body.ok).toBe(true);
            expect(response.body.message).toBe('Resumen del dashboard comercial obtenido correctamente');
        });

        test('debe fallar sin token de autorización', async () => {
            const response = await request(app)
                .get('/api/v1/dashboard/comercial/summary');

            expect(response.status).toBe(500); // O el código que maneje verifyToken sin token
        });
    });

    describe('Estructura de respuesta', () => {
        test('debe contener KPIs requeridos', async () => {
            const response = await request(app)
                .get('/api/v1/dashboard/comercial/summary')
                .set('Authorization', `Bearer ${testToken}`);

            expect(response.body.data.kpis).toBeDefined();
            expect(typeof response.body.data.kpis.totalBC).toBe('number');
            expect(typeof response.body.data.kpis.bcActivos).toBe('number');
            expect(typeof response.body.data.kpis.bcCompletados).toBe('number');
            expect(typeof response.body.data.kpis.solicitudesPendientes).toBe('number');
            expect(typeof response.body.data.kpis.clientesNuevos30d).toBe('number');
        });

        test('debe contener charts con estructura correcta', async () => {
            const response = await request(app)
                .get('/api/v1/dashboard/comercial/summary')
                .set('Authorization', `Bearer ${testToken}`);

            expect(response.body.data.charts).toBeDefined();
            expect(response.body.data.charts.bcStatus).toBeDefined();
            expect(response.body.data.charts.requestsMonthly).toBeDefined();

            // Verificar estructura de charts
            expect(Array.isArray(response.body.data.charts.bcStatus.labels)).toBe(true);
            expect(Array.isArray(response.body.data.charts.bcStatus.data)).toBe(true);
            expect(Array.isArray(response.body.data.charts.requestsMonthly.labels)).toBe(true);
            expect(Array.isArray(response.body.data.charts.requestsMonthly.data)).toBe(true);
        });

        test('debe contener metadata con mappings', async () => {
            const response = await request(app)
                .get('/api/v1/dashboard/comercial/summary')
                .set('Authorization', `Bearer ${testToken}`);

            expect(response.body.data._metadata).toBeDefined();
            expect(response.body.data._metadata.stateMappings).toBeDefined();
            expect(response.body.data._metadata.dataSources).toBeDefined();
        });
    });

    describe('Cache functionality', () => {
        test('primera llamada debe tener cache.hit = false', async () => {
            const response = await request(app)
                .get('/api/v1/dashboard/comercial/summary')
                .set('Authorization', `Bearer ${testToken}`);

            expect(response.body.data._metadata.cache).toBeDefined();
            expect(response.body.data._metadata.cache.hit).toBe(false);
            expect(response.body.data._metadata.cache.bypassed).toBe(false);
            expect(response.body.data._metadata.cache.ttlSeconds).toBe(60);
        });

        test('segunda llamada inmediata debe tener cache.hit = true', async () => {
            // Primera llamada para popular cache
            await request(app)
                .get('/api/v1/dashboard/comercial/summary')
                .set('Authorization', `Bearer ${testToken}`);

            // Segunda llamada debería venir del cache
            const response = await request(app)
                .get('/api/v1/dashboard/comercial/summary')
                .set('Authorization', `Bearer ${testToken}`);

            expect(response.body.data._metadata.cache.hit).toBe(true);
            expect(response.body.data._metadata.cache.bypassed).toBe(false);
        });

        test('llamada con ?fresh=1 debe tener cache.bypassed = true', async () => {
            const response = await request(app)
                .get('/api/v1/dashboard/comercial/summary?fresh=1')
                .set('Authorization', `Bearer ${testToken}`);

            expect(response.body.data._metadata.cache.hit).toBe(false);
            expect(response.body.data._metadata.cache.bypassed).toBe(true);
        });
    });

    describe('Datos reales de DB', () => {
        test('KPIs deben coincidir con valores esperados de DB real', async () => {
            const response = await request(app)
                .get('/api/v1/dashboard/comercial/summary')
                .set('Authorization', `Bearer ${testToken}`);

            const { kpis } = response.body.data;

            // Valores basados en datos reales de DB (según validación previa)
            expect(kpis.totalBC).toBe(6); // COUNT(*) bc_master
            expect(kpis.bcActivos).toBe(6); // Todos los 'draft' son activos
            expect(kpis.bcCompletados).toBe(0); // No hay estados completados
            expect(kpis.solicitudesPendientes).toBe(32); // status='pendiente'
            expect(kpis.clientesNuevos30d).toBe(0); // No hay registros en clients
        });

        test('charts deben tener datos correctos', async () => {
            const response = await request(app)
                .get('/api/v1/dashboard/comercial/summary')
                .set('Authorization', `Bearer ${testToken}`);

            const { charts } = response.body.data;

            // BC Status chart
            expect(charts.bcStatus.labels).toEqual(['draft']);
            expect(charts.bcStatus.data).toEqual([6]);
            expect(charts.bcStatus.hasData).toBe(true);

            // Requests Monthly chart
            expect(charts.requestsMonthly.labels.length).toBeGreaterThan(0);
            expect(charts.requestsMonthly.data.length).toBeGreaterThan(0);
            expect(charts.requestsMonthly.hasData).toBe(true);
        });
    });

    describe('Performance y robustez', () => {
        test('debe responder en tiempo razonable', async () => {
            const startTime = Date.now();

            const response = await request(app)
                .get('/api/v1/dashboard/comercial/summary')
                .set('Authorization', `Bearer ${testToken}`);

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            expect(response.status).toBe(200);
            expect(responseTime).toBeLessThan(5000); // Menos de 5 segundos
        });

        test('debe manejar errores de DB gracefully', async () => {
            // Mock de pool.connect para simular error de DB
            const originalPool = require('../backend/src/config/database');
            require('../backend/src/config/database').connect = jest.fn().mockRejectedValue(new Error('DB Connection Error'));

            const response = await request(app)
                .get('/api/v1/dashboard/comercial/summary')
                .set('Authorization', `Bearer ${testToken}`);

            expect(response.status).toBe(500);
            expect(response.body.ok).toBe(false);

            // Restaurar pool original
            require('../backend/src/config/database').connect = originalPool.connect;
        });
    });
});