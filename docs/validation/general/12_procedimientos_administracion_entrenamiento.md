# Procedimientos de Administración y Entrenamiento

**Sistema:** FamSPI  
**Versión:** 1.0  
**Alineación:** WHO TRS 1019, Annex 3, Appendix 5, Sección 12

---

## 1. Objetivo

Establecer los procedimientos operativos estándar para la administración del sistema FamSPI en estado validado y los requerimientos mínimos de entrenamiento para cada perfil de usuario, garantizando el uso correcto del sistema dentro del alcance validado.

---

## 2. Procedimientos operativos del sistema

### 2.1 Administración de usuarios y roles

| Procedimiento | Responsable | Frecuencia | Registro |
|---|---|---|---|
| Alta de usuario nuevo | TI | Por evento | `users` table, `auditoria.logs` |
| Asignación o modificación de rol | TI (jefe_ti / admin_ti) | Por evento | `auditoria.logs` |
| Baja de usuario (desvinculación) | TI + Talento Humano | Por evento | Registro en perfil colaborador |
| Revisión de usuarios activos vs. nómina | TI + Talento Humano | Mensual | Acta de revisión |

**Regla:** Solo `jefe_ti` y `admin_ti` pueden asignar roles. Los cambios de rol se registran automáticamente en `auditoria.logs` mediante `auditMiddleware`.

### 2.2 Monitoreo y revisión de trazabilidad

| Procedimiento | Responsable | Frecuencia | Herramienta |
|---|---|---|---|
| Revisión de logs de auditoría | TI / Gerencia | Semanal | `GET /api/v1/auditoria` con filtros |
| Revisión de eventos de seguridad (logins fuera de horario) | TI (`jefe_ti`) | Diaria | Módulo de seguridad / notificaciones TI |
| Exportación de bitácora para auditoría interna | TI | Por solicitud | `GET /api/v1/auditoria/export/csv` |

### 2.3 Respaldo y recuperación

| Elemento | Procedimiento | Frecuencia | Responsable |
|---|---|---|---|
| Base de datos Neon | Respaldo automático según política de Neon | Automático (proveedor) | Neon + TI |
| Configuración del servidor | Documentar variables de entorno en bóveda segura | Por cambio | TI |
| Código fuente | Repositorio Git con historial completo | Continuo (push) | TI |
| Documentos de validación | Repositorio Git `docs/validation` | Por actualización | TI |

**Procedimiento de recuperación:** Ante falla de base de datos, restaurar desde último respaldo Neon. Documentar el incidente en `auditoria.logs` y registrar desviación si aplica al estado validado.

### 2.4 Gestión de incidentes

| Tipo de incidente | Severidad | Procedimiento | Tiempo de respuesta |
|---|---|---|---|
| Sistema inaccesible (HTTP 5xx global) | Crítica | Reiniciar PM2, revisar logs, notificar gerencia | < 30 min |
| Módulo funcional con error | Alta | Diagnosticar en logs, hotfix si necesario, documentar | < 4 h |
| Comportamiento inesperado reportado por usuario | Media | Reproducir, clasificar (bug/uso incorrecto), escalar si aplica | < 24 h |
| Solicitud de cambio funcional | Baja | Registrar en backlog, aplicar proceso de control de cambios | Por planificación |

### 2.5 Gestión del modo auditoría

Cuando se active un proceso de auditoría formal:
1. Activar modo auditoría mediante `PUT /api/v1/audit-prep/status` con fechas de vigencia
2. Crear o actualizar secciones del expediente de auditoría
3. Cargar documentos por sección según los requerimientos del auditor
4. Si el auditor es externo: conceder acceso temporal mediante `POST /api/v1/audit-prep/external-access`
5. Al concluir la auditoría: revocar accesos externos, actualizar estado de documentos y cerrar la ventana

---

## 3. Requerimientos de entrenamiento por perfil

### 3.1 Perfil: Solicitante general (comercial, técnico, backoffice, talento humano)

**Módulos a conocer:** Solicitudes y permisos, Viáticos (workspace y wizard), Notificaciones  
**Habilidades mínimas requeridas:**
- Navegar el dashboard y acceder a sus módulos asignados
- Crear y enviar solicitudes dentro del flujo correcto
- Usar el wizard de viáticos (carga TXT, notas manuales, compras sin factura, envío a revisión)
- Leer y marcar notificaciones

**Forma de entrenamiento:** Demostración en sistema real con casos de prueba guiados  
**Duración estimada:** 2-4 horas  
**Evidencia requerida:** Lista de asistencia firmada + verificación de acceso exitoso

### 3.2 Perfil: Aprobador / Jefe de área

**Módulos a conocer:** Todo lo del solicitante + flujos de aprobación de su área  
**Habilidades mínimas requeridas:**
- Revisar y aprobar/rechazar solicitudes pendientes
- Aprobar viáticos en primer nivel
- Consultar historial y trazabilidad de aprobaciones
- Entender las consecuencias de cada transición de estado

**Forma de entrenamiento:** Demostración guiada con escenarios de aprobación y rechazo  
**Duración estimada:** 3-5 horas  
**Evidencia requerida:** Lista de asistencia + verificación de operación exitosa en sistema

### 3.3 Perfil: Finanzas

**Módulos a conocer:** Viáticos (revisión financiera, categorización, pago), Reportes  
**Habilidades mínimas requeridas:**
- Categorizar facturas de viáticos
- Aprobar, rechazar o marcar como listo para pago
- Consultar reporte resumen y exportar ATS XML
- Usar el dashboard ejecutivo

**Forma de entrenamiento:** Demostración con casos reales de viáticos en revisión  
**Duración estimada:** 4-6 horas  
**Evidencia requerida:** Lista de asistencia + ejecución exitosa de flujo financiero completo

### 3.4 Perfil: TI (administrador)

**Módulos a conocer:** Todo el sistema con acceso de administrador  
**Habilidades mínimas requeridas:**
- Administrar usuarios y roles
- Revisar bitácora de auditoría y exportar logs
- Gestionar modo auditoría y expedientes
- Gestionar soporte tickets y activos TI
- Monitorear cola de notificaciones y jobs
- Procedimientos de respaldo y recuperación

**Forma de entrenamiento:** Capacitación técnica completa con acceso al backend y logs  
**Duración estimada:** 8-12 horas en sesiones  
**Evidencia requerida:** Lista de asistencia + verificación de tareas administrativas completadas

---

## 4. Estado de evidencias de capacitación

| Perfil | Estado | Fecha | Evidencia |
|---|---|---|---|
| Solicitantes generales | Pendiente de consolidar | — | Lista de asistencia pendiente |
| Aprobadores / Jefes | Pendiente de consolidar | — | Lista de asistencia pendiente |
| Finanzas | Pendiente de consolidar | — | Lista de asistencia pendiente |
| TI administrador | Parcial (entrenamiento en curso) | — | Sesiones de desarrollo continuo |

**Acción requerida:** Formalizar listas de asistencia y evidencias de capacitación por perfil antes de declarar cierre de PQ/UAT.

---

## 5. Periodicidad de revisión de procedimientos

| Procedimiento | Frecuencia de revisión | Disparador de revisión anticipada |
|---|---|---|
| Este documento | Anual o tras cambio mayor | Cambio de tecnología, rol nuevo, incidente grave |
| Plan de entrenamiento | Anual | Nuevo módulo, cambio de flujo, usuario nuevo en perfil crítico |
| Procedimiento de respaldo | Semestral | Cambio de proveedor de base de datos |
