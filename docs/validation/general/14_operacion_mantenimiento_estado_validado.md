# Operación, Mantenimiento y Estado Validado

**Sistema:** FamSPI  
**Versión:** 1.0  
**Alineación:** WHO TRS 1019, Annex 3, Appendix 5, Sección 14

---

## 1. Objetivo

Definir los criterios y responsabilidades para mantener FamSPI en estado validado durante su operación, establecer los procedimientos de monitoreo y mantenimiento, y describir los controles que aseguran que el sistema no se desvíe de su especificación validada.

---

## 2. Criterios para mantener el estado validado

Un sistema validado mantiene su estatus cuando:

| Criterio | Descripción |
|---|---|
| Sin cambios no controlados | Todo cambio al código, configuración o base de datos pasa por el proceso del capítulo 14A antes de implementarse |
| Evidencia operacional vigente | Los registros de uso, bitácora y logs del sistema están actualizados y accesibles |
| Desviaciones bajo control | Toda desviación detectada está registrada, clasificada y con plan de cierre activo |
| Entrenamiento vigente | Los usuarios activos en roles críticos tienen entrenamiento formal documentado (capítulo 12) |
| Revisión periódica ejecutada | Se realiza revisión periódica según capítulo 14B; el resultado no presenta hallazgos críticos sin cerrar |

---

## 3. Operación rutinaria del sistema

| Actividad | Descripción | Frecuencia | Responsable |
|---|---|---|---|
| Supervisión de disponibilidad | Verificar que el proceso PM2 está activo y el sistema responde | Diaria | TI |
| Revisión de logs de errores | Revisar logs del servidor por errores inesperados | Diaria | TI |
| Revisión de bitácora de auditoría | Consultar `auditoria.logs` por actividad sospechosa o anómala | Semanal | TI / Gerencia |
| Revisión de usuarios y roles activos | Comparar usuarios activos en sistema con nómina vigente | Mensual | TI + Talento Humano |
| Revisión de notificaciones pendientes | Verificar cola de dispatchers y que los workers estén activos | Semanal | TI |
| Exportación de bitácora para auditoría | Generar y preservar CSV de `auditoria.logs` | Por solicitud | TI |

---

## 4. Mantenimiento del sistema

### 4.1 Mantenimiento correctivo

Ante un defecto funcional detectado:

1. Registrar el incidente con descripción, módulo afectado y severidad
2. Clasificar como crítico / mayor / menor (ver capítulo 12 sección 2.4)
3. Si el defecto afecta el alcance validado: abrir desviación formal
4. Implementar corrección siguiendo el proceso de control de cambios (cap. 14A)
5. Ejecutar pruebas de regresión para el módulo afectado
6. Actualizar documentos de validación si el cambio lo requiere
7. Cerrar el incidente con evidencia de resolución

### 4.2 Mantenimiento preventivo

| Actividad | Frecuencia | Descripción |
|---|---|---|
| Actualización de dependencias npm | Trimestral | Revisar dependencias con vulnerabilidades conocidas (`npm audit`) |
| Verificación de certificado TLS | Mensual | Confirmar que el certificado HTTPS no está próximo a vencer |
| Revisión de accesos externos activos | Mensual | Revocar accesos de auditores externos no vigentes |
| Revisión del plan de respaldo | Semestral | Verificar que los respaldos de Neon se ejecutan correctamente |
| Prueba de restauración | Anual o por evento | Verificar que se puede restaurar la base de datos desde un respaldo |

---

## 5. Monitoreo de trazabilidad

El sistema cuenta con trazabilidad activa en tiempo real. Todo evento de negocio relevante queda registrado en `auditoria.logs`:

| Campo registrado | Fuente | Uso |
|---|---|---|
| `user_id` + `user_email` | JWT del request | Identificar el actor de la acción |
| `module` | Argumento de `auditMiddleware` | Identificar el módulo afectado |
| `action` | Argumento de `auditMiddleware` | Identificar el tipo de operación |
| `entity_id` | Dato del request o respuesta | Identificar el registro modificado |
| `timestamp` | Función de base de datos | Ordenamiento temporal de eventos |
| `payload` | Body del request (JSON) | Detalles de los datos modificados |

**Acceso:** `GET /api/v1/auditoria` (roles: `ti`, `gerencia`, `talento_humano`)  
**Exportación:** `GET /api/v1/auditoria/export/csv` (roles: `ti`, `gerencia`)

---

## 6. Control de incidentes que afecten el estado validado

| Tipo de evento | Acción requerida |
|---|---|
| Acceso no autorizado confirmado | Abrir desviación crítica; notificar a gerencia; revisar trail de auditoría |
| Pérdida de datos o corrupción | Abrir desviación crítica; restaurar desde respaldo; documentar alcance del impacto |
| Cambio no controlado al sistema | Abrir desviación mayor; revertir el cambio si es posible; iniciar proceso de control de cambios retroactivo |
| Error funcional en módulo validado | Abrir desviación mayor; suspender el módulo si impacta la integridad; corrección con regresión |
| Fallo de disponibilidad (>30 min) | Registrar como incidente; documentar causa raíz; evaluar impacto en evidencia operacional |

---

## 7. Continuidad y recuperación

| Elemento | Procedimiento | Responsable |
|---|---|---|
| Fallo del proceso PM2 | Reiniciar con `pm2 restart all`; si persiste, revisar logs de sistema | TI |
| Fallo de base de datos Neon | Verificar estado del servicio Neon; restaurar desde último respaldo disponible | TI |
| Pérdida del repositorio Git | Recuperar desde copia del repositorio remoto o espejo | TI |
| Pérdida de `.env` | Reconstruir desde bóveda de secretos documentada; nunca desde el repositorio | TI |

**Tiempo objetivo de recuperación (RTO):** Definir formalmente en el siguiente ciclo de revisión periódica (capítulo 14B).

---

## 8. Declaración de estado validado vigente

El sistema FamSPI v1.0.0 se considera en **estado validado parcial** para:

- Módulos de autenticación y sesiones
- Módulos de usuarios y perfiles  
- Módulos de talento humano (permisos y vacaciones)

Los módulos restantes están en operación productiva pero **pendientes de completar el ciclo OQ/PQ formal** para ser declarados en estado validado.

**Para mantener el estado validado se requiere:**

1. No introducir cambios al sistema sin seguir el proceso del capítulo 14A
2. Registrar todos los incidentes en la bitácora operacional
3. Ejecutar revisión periódica según capítulo 14B
4. Completar OQ/PQ de las áreas 03-06 pendientes
