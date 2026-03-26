# INFORME DE HALLAZGOS DEL ÁREA 02 (TALENTO HUMANO)

## 1. Introducción
Este informe detalla los hallazgos identificados durante la fase de auditoría técnica y su estado actual de resolución. El objetivo es proporcionar evidencia de que las desviaciones críticas han sido mitigadas antes del paso a producción.

## 2. Historial de Hallazgos y Resoluciones

### H-A02-001: Falta de Integridad Transaccional en Contratación
- **Severidad**: Alta
- **Estado**: ✅ **Cerrado**
- **Descripción**: El proceso de contratación realizaba múltiples inserciones en base de datos de forma independiente, arriesgando la integridad ante fallos parciales.
- **Resolución**: Se implementaron bloques `BEGIN/COMMIT` en el servicio de contratación, asegurando que el proceso sea atómico.

### H-A02-002: Inconsistencia por Dualidad de Modelos de Tiempo Libre
- **Severidad**: Media
- **Estado**: ⚠️ **Mitigado (En monitoreo)**
- **Descripción**: Coexistencia de tablas legacy para vacaciones.
- **Resolución**: Se unificaron los motores de cálculo en el backend para leer ambas fuentes de forma transparente al usuario. La migración física de tablas se programa para la fase post-producción.

### H-A02-003: Inestabilidad Visual (Layout Shift) en Command Center
- **Severidad**: Baja
- **Estado**: ✅ **Cerrado**
- **Descripción**: La carga de perfiles pesados causaba saltos en la interfaz.
- **Resolución**: Se implementaron **Skeleton Loaders** animados que mantienen la estructura visual mientras se sincronizan los datos.

### H-A02-004: Ausencia de Notificación Formal a TI
- **Severidad**: Media
- **Estado**: ✅ **Cerrado**
- **Descripción**: El área técnica no recibía avisos automáticos tras una contratación.
- **Resolución**: Se integró un trigger automático que envía los datos del nuevo colaborador al equipo de TI para la creación de credenciales.

## 3. Conclusión de Auditoría
Tras la implementación de las correcciones detalladas, el Área 02 no presenta hallazgos bloqueantes. El sistema cumple con los criterios de aceptación de seguridad, integridad y experiencia de usuario definidos para el entorno de producción.
