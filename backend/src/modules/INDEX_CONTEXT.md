# FamSPI — Índice Maestro de Módulos (CONTEXT.md)

Generado: 2026-04-27 | Fuente: código verificado en `registerRoutes.js`, archivos `*.routes.js` y `AppRoutes.jsx`

---

## Estado de documentación

| Módulo | CONTEXT.md | Rutas verificadas | DB verificada |
|--------|-----------|------------------|---------------|
| auth | ✅ | ✅ | ❌ |
| approvals | ✅ | ✅ | ❌ |
| attendance | ✅ | ✅ | ❌ |
| audit-prep | ✅ | ✅ | ❌ |
| auditoria | ✅ | ✅ | ❌ |
| business-case | ✅ | ✅ | ❌ |
| calidad | ✅ | ✅ (CA-01 al CA-17) | Parcial (migr.) |
| calendar | ✅ | N/A (solo service) | ❌ |
| clients | ✅ | ✅ | ❌ |
| collaborators | ✅ | ✅ | ❌ |
| contracts | ✅ (vacío) | N/A | ❌ |
| dashboard | ✅ | ✅ | ❌ |
| delivery-ceilings | ✅ | ✅ | ❌ |
| delivery-requests | ✅ | ✅ | ❌ |
| departments | ✅ | ✅ | ❌ |
| documents | ✅ | ❌ (pendiente) | ❌ |
| equipment-purchases | ✅ | ✅ | ❌ |
| files | ✅ | ✅ | ❌ |
| finanzas | ✅ | ✅ (bug detectado) | ❌ |
| gmail | ✅ | ✅ | ❌ |
| integrations | ✅ | ✅ | ❌ |
| inventario | ✅ | ✅ | ❌ |
| management | ✅ | ✅ | ❌ |
| mantenimientos | ✅ | ✅ | ❌ |
| notifications | ✅ | ✅ | ❌ |
| offboarding | ✅ | ✅ | ❌ |
| operaciones | ✅ | ✅ (legacy) | ❌ |
| applicants | ✅ | ✅ | ❌ |
| permisos | ✅ | ✅ | ❌ |
| personnel-requests | ✅ | ✅ | ❌ |
| private-purchases | ✅ | ✅ | ❌ |
| public-delivery-plans | ✅ | ✅ | ❌ |
| requests | ✅ | ✅ | ❌ |
| schedules | ✅ | ✅ | ❌ |
| security | ✅ | ✅ | ❌ |
| servicio | ✅ | ✅ | ❌ |
| signature | ✅ | ✅ | ❌ |
| support-tickets | ✅ | ✅ | ❌ |
| talent-search | ✅ (vacío) | N/A | ❌ |
| talento_humano | ✅ | ✅ | ❌ |
| technical-applications | ✅ | ✅ | ❌ |
| user-certifications | ✅ | ✅ | ❌ |
| user-profile | ✅ | ✅ | ❌ |
| users | ✅ | ✅ | ❌ |
| vacaciones | ✅ | ✅ | ❌ |
| viaticos | ✅ | ✅ | ❌ |

---

## Módulos solo frontend (sin backend propio)

| Módulo | Frontend | Backend cubierto por |
|--------|----------|---------------------|
| comercial | `spi_front/src/modules/comercial/` | `clients`, `requests`, `schedules`, `business-case`, `dashboard` |
| logistica | AppRoutes.jsx rutas `/logistica/` | `delivery-requests`, `delivery-ceilings`, `equipment-purchases` |

---

## Riesgos globales identificados

| Prioridad | Módulo | Riesgo |
|-----------|--------|--------|
| 🔴 Alta | files | `diskStorage /tmp` — pérdida de archivos en reinicios |
| 🔴 Alta | operaciones | Importa `auth.middleware` que puede no existir |
| 🔴 Alta | finanzas | Bug de doble prefijo `/api/v1/finanzas/api/v1/inventory` |
| 🟡 Media | applicants | `GET /` sin autenticación — datos de candidatos públicos |
| 🟡 Media | user-certifications | Conflicto de prefijo con módulo `users` |
| 🟡 Media | audit-prep | Documentos subibles sin `requireRole` |
| 🟡 Media | calidad | CA-01-04 no registrado en `registerRoutes.js` |
| 🟡 Media | signature | Doble prefijo (`/api` vs `/api/v1/signature`) |
| 🟡 Media | auditoria | Sin `verifyToken` explícito en el router |
| 🟡 Media | private-purchases | SSE con token en query param (workaround) |

---

## Módulos con mayor concentración de lógica (>50KB)

| Módulo | Archivo | Tamaño |
|--------|---------|--------|
| permisos | `permisos.service.js` | 161KB |
| private-purchases | `privatePurchases.service.js` | 211KB |
| equipment-purchases | `equipmentPurchases.service.js` | 169KB |
| requests | `requests.service.js` | 119KB |
| business-case | `businessCase.controller.js` | 115KB |
| servicio | `externalCases.service.js` | 75KB |
| clients | `clients.service.js` | 71KB |
| personnel-requests | `personnel-requests.service.js` | 72KB |
| viaticos | `viaticos.service.js` | 90KB |
| mantenimientos | `preventivePlanning.service.js` | 80KB |

---

## Próximos pasos pendientes

1. **Verificar DB real en Neon**: Confirmar tablas, columnas y constraints para los módulos críticos
2. **documents**: Leer `documents.routes.js` para completar documentación
3. **calidad CA-01-04**: Verificar si se registrará el backend o si el frontend debe desactivarse
4. **finanzas**: Corregir bug de doble prefijo de ruta
5. **operaciones**: Verificar si `auth.middleware` existe o si el módulo es legacy
6. **files**: Evaluar migración a Google Drive para persistencia en Cloud Run
