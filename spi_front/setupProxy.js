const { createProxyMiddleware } = require('http-proxy-middleware');

/**
 * ======================================================
 * 🔌 SPI Frontend Proxy Configuration (Development Mode)
 * ======================================================
 * Configura proxy para desarrollo local con backend local
 * ======================================================
 */

module.exports = function (app) {
    // ======================================================
    // 🌐 Proxy para API Backend (localhost)
    // ======================================================
    app.use(
        '/api',
        createProxyMiddleware({
            target: 'http://localhost:3000',
            changeOrigin: true,
            secure: false,
            headers: {
                'X-Forwarded-Proto': 'http',
                'X-Forwarded-Host': 'localhost:3001'
            },
            logLevel: 'debug'
        })
    );

    console.log('🔧 Proxy configurado para modo desarrollo local');
    console.log('📡 API: /api/* → http://localhost:3000/api/*');
    console.log('⚠️  Caddy NO se usa en modo dev - solo para build');
};
