# CONTEXT.md — management

## 1. Descripción
Módulo de dashboard gerencial. Provee a la gerencia general estadísticas globales del sistema, listado completo de solicitudes, trazabilidad por ID y documentos asociados. Acceso exclusivo a gerencia general y admin.

## 2. Endpoints

Prefijo: `/api/v1/management`

Roles requeridos en todo el módulo: `gerente_general`, `admin`

- **GET /api/v1/management/stats** — `getGlobalStats`
- **GET /api/v1/management/requests** — `listAllRequests`
- **GET /api/v1/management/trace/:id** — `getRequestTrace`
- **GET /api/v1/management/documents/:id** — `getRequestDocuments`

## 3. Flujo principal

1. Gerente general consulta estadísticas globales del sistema
2. Lista todas las solicitudes con filtros
3. Obtiene trazabilidad completa de una solicitud específica
4. Accede a los documentos asociados a una solicitud

## 4. Validaciones
- `verifyToken` + `requireRole` a nivel de router completo
- Solo `gerente_general` y `admin` tienen acceso

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- Agrega datos de múltiples módulos: `requests`, `clients`, `business-case`
- `management.service.js` (3KB) — pequeño para la complejidad esperada de un dashboard global

## 7. Frontend asociado
- No verificado en frontend (probable integración en dashboard gerencial)

## 8. Riesgos detectados
- `management.service.js` (3KB) extremadamente pequeño — puede estar delegando consultas directas a DB
- `__tests__` presente

## 9. Notas técnicas
- Módulo de solo lectura — no hay endpoints de escritura
