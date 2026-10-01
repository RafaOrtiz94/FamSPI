# Revisión Periódica del Estado Validado

## Propósito

Establecer el proceso de revisión periódica del sistema FamSPI v1.0.0 para verificar que el sistema se mantiene en estado validado a lo largo de su ciclo de vida operativo, conforme a los requisitos de WHO TRS 1019 Annex 3, Appendix 5.

## Frecuencia de Revisión

| Tipo de Revisión | Frecuencia | Disparador | Responsable |
|---|---|---|---|
| Revisión anual estándar | Anual (cada 12 meses desde la fecha de liberación) | Calendario programado | Responsable TI + Funcional |
| Revisión post-cambio mayor | Dentro de 30 días de la implementación | Cambio Mayor o Emergencia | Responsable TI |
| Revisión post-incidente | Dentro de 15 días del incidente | Incidente crítico de datos o seguridad | Responsable TI + Gerencia |
| Revisión pre-actualización de plataforma | Antes de cualquier migración de infraestructura | Cambio de plataforma/nube | Responsable TI |

## Criterios de Revisión

En cada revisión periódica se evalúan los siguientes criterios:

| Criterio | Descripción | Fuente de Evidencia |
|---|---|---|
| Estado de los controles de seguridad | Verificar que OAuth2, JWT, RBAC siguen funcionando según lo validado | Logs de auditoría, pruebas OQ de regresión |
| Integridad de datos | Verificar que no hay corrupción en tablas críticas de la DB | Consultas de verificación DB, backups |
| Disponibilidad del sistema | Tiempo de actividad > 99% en el período | Registros de monitoreo Cloud Run |
| Cambios realizados | Revisar todos los cambios implementados desde la última revisión | Registro de Control de Cambios |
| Incidentes y desviaciones | Evaluar incidentes ocurridos y si están cerrados correctamente | Registro de Desviaciones |
| Vigencia de la documentación | Verificar que los documentos de validación reflejan el estado actual | Comparación doc vs. implementación |
| Entrenamiento del personal | Verificar que el personal clave está entrenado en la versión actual | Registros de entrenamiento |

## Proceso de Revisión Periódica

### Paso 1: Preparación (15 días antes)
- El Responsable TI convoca la revisión.
- Se recopilan: registros de cambios, incidentes, logs de auditoría del período.
- Se asignan revisores para cada criterio.

### Paso 2: Ejecución de la Revisión
- Se ejecutan pruebas de regresión básicas sobre los flujos críticos.
- Se revisan todos los cambios implementados en el período.
- Se verifica la integridad de la documentación de validación.

### Paso 3: Informe de Revisión Periódica
- Se elabora el Informe de Revisión Periódica.
- El informe concluye con una de las siguientes determinaciones:
  - **Estado validado mantenido**: Sin acciones correctivas requeridas.
  - **Estado validado mantenido con observaciones**: Acciones correctivas menores documentadas.
  - **Revalidación requerida**: Se identificaron cambios significativos no documentados o fallas en criterios críticos.

### Paso 4: Cierre y Archivo
- El informe es aprobado y archivado en el expediente de validación.
- Las acciones correctivas son registradas y monitoreadas hasta su cierre.

## Registro de Revisiones Periódicas

| ID Revisión | Tipo | Período Cubierto | Fecha Ejecución | Ejecutado por | Conclusión | Acciones Requeridas | Aprobado por |
|---|---|---|---|---|---|---|---|
| REV-001 | Anual | (Pendiente — primera revisión programada 12 meses post-liberación) | __________ | __________ | __________ | __________ | __________ |

## Criterio de Continuidad del Estado Validado

El sistema FamSPI v1.0.0 se considera en estado validado continuo cuando:
- Todas las revisiones periódicas concluyen con "Estado validado mantenido" o "mantenido con observaciones cerradas".
- No existen desviaciones críticas abiertas.
- Los cambios implementados han sido evaluados, aprobados y documentados conforme al procedimiento de Control de Cambios.
- El personal operativo está entrenado en la versión vigente.

## Firmas de Aprobación del Procedimiento

| Rol | Nombre | Firma | Fecha |
|---|---|---|---|
| Elaborado por | __________________ | __________________ | __________ |
| Revisado por | __________________ | __________________ | __________ |
| Aprobado por | __________________ | __________________ | __________ |
