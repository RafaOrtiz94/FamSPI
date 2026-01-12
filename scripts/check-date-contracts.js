#!/usr/bin/env node

/**
 * Script de validación de contratos de fechas
 * Verifica que las APIs retornen fechas en formato ISO válido
 */

const http = require('http');
const https = require('https');

// Configuración - ajustar según entorno
const API_BASE = process.env.API_BASE || 'http://localhost:3001/api/v1';

// Endpoints a validar
const ENDPOINTS_TO_CHECK = [
    '/requests?page=1&pageSize=5',  // Listado de solicitudes
    '/requests/1',                  // Detalle de solicitud (puede fallar si no existe)
    '/client-requests?page=1&pageSize=5', // Listado de solicitudes de clientes
];

/**
 * Valida si un string es una fecha ISO válida
 */
function isValidISODate(str) {
    if (typeof str !== 'string') return false;

    // Regex básico para formato ISO 8601
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    if (!isoRegex.test(str)) return false;

    // Validar que sea una fecha real
    const date = new Date(str);
    return !isNaN(date.getTime());
}

/**
 * Valida si un valor es fecha válida (ISO string, null o undefined)
 */
function isValidDateContract(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return isValidISODate(value);
    return false;
}

/**
 * Recorre recursivamente un objeto y valida campos de fecha
 */
function validateDateFields(obj, path = '', results = { valid: true, issues: [] }) {
    if (!obj || typeof obj !== 'object') return results;

    for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;

        // Validar campos que probablemente contengan fechas
        if (key.endsWith('_at') || key.includes('date') || key === 'created_at' || key === 'updated_at') {
            if (!isValidDateContract(value)) {
                results.valid = false;
                results.issues.push({
                    field: currentPath,
                    value: value,
                    type: typeof value,
                    issue: value === null || value === undefined ? 'null/undefined' : 'invalid ISO format'
                });
            }
        }

        // Recursión para arrays y objetos
        if (Array.isArray(value)) {
            value.forEach((item, index) => {
                if (typeof item === 'object' && item !== null) {
                    validateDateFields(item, `${currentPath}[${index}]`, results);
                }
            });
        } else if (typeof value === 'object' && value !== null) {
            validateDateFields(value, currentPath, results);
        }
    }

    return results;
}

/**
 * Hace una petición HTTP y valida la respuesta
 */
function checkEndpoint(endpoint) {
    return new Promise((resolve) => {
        const url = `${API_BASE}${endpoint}`;
        console.log(`🔍 Verificando: ${url}`);

        const protocol = url.startsWith('https:') ? https : http;

        const req = protocol.get(url, {
            headers: {
                'Authorization': process.env.AUTH_TOKEN || 'Bearer test-token',
                'Content-Type': 'application/json'
            },
            timeout: 10000
        }, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) {
                        console.log(`⚠️  Endpoint ${endpoint} retornó status ${res.statusCode} - omitiendo`);
                        resolve({ endpoint, valid: true, issues: [] });
                        return;
                    }

                    const jsonData = JSON.parse(data);

                    // Solo validar el campo 'data' de la respuesta
                    const validation = validateDateFields(jsonData.data || jsonData);

                    resolve({
                        endpoint,
                        valid: validation.valid,
                        issues: validation.issues,
                        sampleData: validation.issues.length === 0 ? null : jsonData.data
                    });

                } catch (error) {
                    console.log(`❌ Error parseando respuesta de ${endpoint}: ${error.message}`);
                    resolve({
                        endpoint,
                        valid: false,
                        issues: [{ issue: `JSON parse error: ${error.message}` }]
                    });
                }
            });
        });

        req.on('error', (error) => {
            console.log(`❌ Error conectando a ${endpoint}: ${error.message}`);
            resolve({
                endpoint,
                valid: false,
                issues: [{ issue: `Connection error: ${error.message}` }]
            });
        });

        req.on('timeout', () => {
            req.destroy();
            console.log(`⏰ Timeout conectando a ${endpoint}`);
            resolve({
                endpoint,
                valid: false,
                issues: [{ issue: 'Timeout' }]
            });
        });
    });
}

/**
 * Función principal
 */
async function main() {
    console.log('🚀 Iniciando validación de contratos de fechas...\n');
    console.log(`📡 API Base: ${API_BASE}\n`);

    const results = [];

    for (const endpoint of ENDPOINTS_TO_CHECK) {
        try {
            const result = await checkEndpoint(endpoint);
            results.push(result);

            if (result.valid) {
                console.log(`✅ ${endpoint} - OK`);
            } else {
                console.log(`❌ ${endpoint} - PROBLEMAS ENCONTRADOS:`);
                result.issues.forEach(issue => {
                    console.log(`   - ${issue.field || 'General'}: ${issue.issue}`);
                    if (issue.value !== undefined) {
                        console.log(`     Valor: ${JSON.stringify(issue.value)}`);
                    }
                });
            }
        } catch (error) {
            console.log(`💥 Error inesperado en ${endpoint}: ${error.message}`);
            results.push({
                endpoint,
                valid: false,
                issues: [{ issue: `Unexpected error: ${error.message}` }]
            });
        }
    }

    // Resumen
    console.log('\n📊 RESUMEN:');
    const totalEndpoints = results.length;
    const validEndpoints = results.filter(r => r.valid).length;
    const invalidEndpoints = totalEndpoints - validEndpoints;
    const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);

    console.log(`Total endpoints verificados: ${totalEndpoints}`);
    console.log(`Endpoints válidos: ${validEndpoints}`);
    console.log(`Endpoints con problemas: ${invalidEndpoints}`);
    console.log(`Total de problemas encontrados: ${totalIssues}`);

    if (invalidEndpoints > 0) {
        console.log('\n❌ VALIDACIÓN FALLIDA - Se encontraron problemas de formato de fechas');
        process.exit(1);
    } else {
        console.log('\n✅ VALIDACIÓN EXITOSA - Todos los contratos de fechas cumplidos');
        process.exit(0);
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Error fatal:', error);
        process.exit(1);
    });
}

module.exports = { isValidISODate, isValidDateContract, validateDateFields };