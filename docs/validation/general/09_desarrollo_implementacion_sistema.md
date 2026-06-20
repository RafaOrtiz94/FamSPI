# Desarrollo e Implementación del Sistema

**Sistema:** FamSPI  
**Versión:** 1.0  
**Alineación:** WHO TRS 1019, Annex 3, Appendix 5, Sección 9

---

## 1. Objetivo

Documentar el modelo de desarrollo utilizado para FamSPI v1.0.0, los controles aplicados durante la implementación, la evidencia de código revisada, y el estado del repositorio y las pruebas automatizadas como base de la calificación de instalación y operación.

---

## 2. Tipo de desarrollo

FamSPI v1.0.0 es un **desarrollo interno institucional**. No existe proveedor externo para el núcleo del sistema. Todo el desarrollo, mantenimiento y control técnico recae en el equipo de TI.

**Stack tecnológico verificado en código fuente:**

| Componente | Tecnología | Versión verificada |
|---|---|---|
| Backend runtime | Node.js | Declarado en `package.json` |
| Framework API | Express.js | `backend/src/app.js` |
| Base de datos | PostgreSQL (Neon serverless) | `backend/src/config/db.js` |
| Frontend framework | React 19 | `spi_front/package.json` |
| Frontend estilos | Tailwind CSS + Bootstrap | `spi_front/src/` |
| Autenticación | Google OAuth 2.0 + JWT | `backend/src/middlewares/auth.js` |
| Archivos | Google Drive API | `backend/src/modules/documents/` |
| Proceso gestor | PM2 | Configuración en servidor |
| Build tool | Vite | `spi_front/vite.config.js` |

---

## 3. Evidencia de implementación

| Elemento | Evidencia | Estado |
|---|---|---|
| Repositorio | Git — rama `main` para producción validada | Activo |
| Versión del sistema | `backend/package.json` → `"version": "1.0.0"` | Confirmado |
| Número de módulos | 12 módulos en `backend/src/modules/` | Confirmado |
| Commit de referencia | Ver `git log --oneline -1` en `main` | Verificar al cierre |
| Tag de versión validada | Pendiente de crear (`git tag v1.0.0`) | Pendiente |
| Rama activa en sesión | `codex/task-title-s8unft` (desarrollo) | Pendiente merge a `main` |

---

## 4. Estructura del código fuente

| Directorio | Contenido |
|---|---|
| `backend/src/app.js` | Configuración central de Express, middlewares globales |
| `backend/src/server.js` | Punto de entrada, inicialización del servidor |
| `backend/src/routes/registerRoutes.js` | Registro centralizado de todos los routers de módulo |
| `backend/src/routes/publicPaths.js` | Rutas que no requieren autenticación |
| `backend/src/middlewares/` | `auth.js`, `roles.js`, `auditMiddleware.js`, `asyncHandler.js` |
| `backend/src/modules/` | 12 módulos, cada uno con `routes.js`, `controller.js`, `service.js` |
| `backend/src/config/` | `db.js`, `logger.js`, `security.js` |
| `spi_front/src/` | Componentes React, páginas, rutas, servicios API |

---

## 5. Controles del proceso de desarrollo

| Control | Descripción | Herramienta |
|---|---|---|
| Control de versiones | Git con historial completo y trazabilidad de cambios | Git |
| Gestión de ramas | Ramas `feature/*`, `fix/*`, `codex/*` → merge a `main` | Git |
| Revisión de código | Revisión antes de merge a rama principal | Manual / equipo TI |
| Pruebas automatizadas | Suite Jest para módulos del backend | `npm test` |
| Gestión de dependencias | `package.json` + `package-lock.json` con versiones fijadas | npm |
| Trazabilidad de cambios | Mensajes de commit descriptivos + historial Git | Git |

---

## 6. Revisión de código y pruebas internas

### 6.1 Alcance de las pruebas automatizadas

Las pruebas automatizadas cubren módulos del backend. Los resultados de referencia registrados son:

| Ejecución | Fecha | Suites | Tests pass | Tests fail | Tests skip |
|---|---|---|---|---|---|
| Corrida de referencia | 2026-05-13 | 21 (16 pass / 5 fail) | 76 | 22 | 2 |

Las suites fallidas no pertenecen al alcance funcional validado de Área 01 y Área 02. Los módulos de permisos, vacaciones y autenticación tienen cobertura de pruebas conforme.

### 6.2 Auditoría de código de módulos de alcance

Se realizó revisión estática de código de los módulos en el alcance validado:

| Módulo | Archivos revisados | Resultado |
|---|---|---|
| Autenticación | `auth.routes.js`, `auth.controller.js`, `auth.service.js` | Conforme |
| Permisos y vacaciones (TH) | `talento-humano.routes.js`, `*.service.js` | Conforme |
| Middlewares de seguridad | `auth.js`, `roles.js`, `auditMiddleware.js` | Conforme |
| Configuración de rutas | `registerRoutes.js`, `publicPaths.js` | Conforme |

---

## 7. Gestión de ramas y control de implementación

| Elemento | Descripción |
|---|---|
| Rama de producción | `main` — representa el estado validado |
| Ramas de trabajo | `feature/*`, `fix/*`, `codex/*` — desarrollo activo |
| Proceso de integración | Merge a `main` con revisión; no se hace deploy directo desde ramas de trabajo |
| Entorno de despliegue | Servidor con PM2; archivos compilados de frontend con Vite |

---

## 8. Evidencia de release y restricciones

| Ítem | Estado | Acción requerida |
|---|---|---|
| Tag de versión `v1.0.0` en `main` | No creado | Crear `git tag v1.0.0` al cierre del proceso de validación |
| Acta de release institucional | Pendiente | Emitir al cerrar el proceso DQ/IQ/OQ/PQ |
| Todos los cambios mergeados a `main` | Verificar estado | Asegurar que la rama de desarrollo se consolide en `main` antes del cierre |
