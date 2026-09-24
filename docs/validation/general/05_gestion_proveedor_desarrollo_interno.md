# Gestión de Proveedor y Desarrollo Interno

**Sistema:** FamSPI  
**Versión:** 1.0  
**Alineación:** WHO TRS 1019, Annex 3, Appendix 5, Sección 5

---

## 1. Modelo de desarrollo

FamSPI v1.0.0 se gestiona como **desarrollo interno** para el alcance funcional validado. No aplica proveedor externo para el núcleo del sistema; todo el desarrollo, mantenimiento y control técnico recae en el equipo de TI de la organización.

**Stack tecnológico verificado:**
- Backend: Node.js / Express.js
- Base de datos: PostgreSQL (Neon serverless)
- Frontend: React 19 + Tailwind CSS + Bootstrap
- Autenticación: Google OAuth 2.0 + JWT
- Almacenamiento de archivos: Google Drive API
- Entorno de ejecución: servidor dedicado con PM2

---

## 2. Responsabilidades del equipo de TI

| Responsabilidad | Descripción | Responsable |
|---|---|---|
| Desarrollo de funcionalidades | Implementación de módulos y requerimientos según URS aprobados | TI (Desarrollo) |
| Control de calidad de código | Revisión de código, pruebas unitarias e integración | TI (Desarrollo) |
| Gestión del repositorio | Control de versiones en Git, ramas de desarrollo y producción | TI (Desarrollo) |
| Gestión de infraestructura | Servidor, base de datos, variables de entorno, PM2 | TI (Infraestructura) |
| Soporte a validación | Preparación de evidencia, ejecución de protocolos IQ/OQ/PQ | TI + Funcional |
| Documentación de cambios | Registro en bitácora y actualización de documentos de validación | TI |
| Entrenamiento | Capacitación inicial y continua a usuarios por perfil | TI + Funcional |

---

## 3. Gestión de versiones

El sistema usa control de versiones Git. La rama `main` representa el estado validado de producción. Los cambios pasan por ramas de trabajo (`feature/*`, `fix/*`, `codex/*`), revisión de código y merge controlado.

**Criterio de versión validada:**
- La versión debe tener commit etiquetado (`git tag`) en `main`
- Deben existir evidencias de ejecución de pruebas (`npm test`)
- Los documentos de validación (IQ/OQ/PQ) deben estar actualizados para el alcance del cambio

**Versión actual validada:** FamSPI v1.0.0  
**Rama de producción:** `main`  
**Ambiente de referencia:** producción con acceso controlado

---

## 4. Control de cambios del desarrollo

Todo cambio posterior al estado validado debe seguir el proceso de control de cambios documentado en [14A - Control de Cambios](14A_control_cambios.md):

1. Solicitud de cambio con descripción, motivación e impacto evaluado
2. Clasificación del cambio: menor (sin impacto en validación), mayor (requiere revalidación parcial), crítico (requiere revalidación completa)
3. Aprobación antes de implementación
4. Implementación con evidencia de pruebas
5. Actualización de documentos de validación afectados
6. Cierre del cambio con verificación de estado

---

## 5. Revisión del desarrollo

La revisión se sustenta en evidencia objetiva verificable:

| Tipo de evidencia | Fuente | Verificable |
|---|---|---|
| Código fuente | Repositorio Git | Sí — commit hash, historial |
| Pruebas automatizadas | `npm test` (Jest) | Sí — reporte de suites/casos |
| Logs de aplicación | PM2 / servidor | Sí — timestamp, nivel, módulo |
| Base de datos | PostgreSQL / Neon | Sí — esquema, datos, trazabilidad |
| Documentos de validación | Repositorio Git / carpeta `docs/validation` | Sí — historial de cambios |

---

## 6. Gestión de dependencias externas

FamSPI depende de servicios externos para funcionalidades no core. Estas dependencias tienen su propio ciclo de vida fuera del control del equipo TI:

| Servicio | Uso | Riesgo si no disponible |
|---|---|---|
| Google OAuth 2.0 | Autenticación de usuarios | Acceso al sistema bloqueado |
| Google Drive API | Almacenamiento de adjuntos | Carga/descarga de documentos bloqueada |
| Google Chat API | Canal de notificaciones | Canal de chat no disponible (in-app funciona) |
| SMTP/Gmail API | Canal de email en notificaciones | Canal email no disponible |
| Neon PostgreSQL | Base de datos en la nube | Sistema inoperativo |

**Mitigación:** El sistema maneja errores de Drive y canales externos sin perder consistencia local. Los fallos de autenticación OAuth se registran en `auditoria.logs`.

---

## 7. Política de entornos

| Entorno | Propósito | Datos | Acceso |
|---|---|---|---|
| Desarrollo local | Implementación y prueba por desarrollador | Datos de prueba locales | Solo TI (Desarrollo) |
| Producción | Operación real del sistema validado | Datos reales de la organización | Usuarios autorizados |

No existe entorno de staging formal en la versión actual. Los cambios se prueban en desarrollo local antes de despliegue a producción. Esta limitación está documentada como riesgo en el IQ general.
