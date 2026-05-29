# Control de Cambios en Estado Validado

## Propósito

Establecer el procedimiento formal para gestionar cambios en el sistema FamSPI v1.0.0 una vez que ha sido liberado en estado validado, garantizando que cualquier modificación sea evaluada, aprobada y documentada antes de su implementación, y que el impacto sobre la validación sea determinado formalmente.

## Alcance

Este procedimiento aplica a todos los cambios en:
- Código fuente del backend o frontend de FamSPI.
- Infraestructura de despliegue (Cloud Run, base de datos, variables de entorno).
- Configuración del sistema (parámetros operativos, roles, permisos).
- Integraciones con servicios externos (Google OAuth, Gmail, Drive).
- Documentación de validación controlada.

## Clasificación de Cambios

| Tipo | Descripción | Nivel de Evaluación | Revalidación Requerida |
|---|---|---|---|
| Menor | Corrección de errores tipográficos, ajustes de UI sin impacto funcional | Revisión TI | No — solo actualización documental |
| Moderado | Corrección de bugs funcionales, ajustes de rendimiento, actualizaciones de dependencias menores | Revisión TI + Funcional | OQ parcial sobre módulos afectados |
| Mayor | Nuevas funcionalidades, cambios de arquitectura, migración de plataforma, actualizaciones mayores | Revisión TI + Funcional + Gerencia | Revalidación completa del área afectada |
| Emergencia | Corrección crítica de seguridad o falla que afecta integridad de datos | Aprobación verbal + documentación posterior en 24h | OQ de regresión post-implementación |

## Proceso de Gestión de Cambios

```
Solicitud de cambio --> Evaluación de impacto --> Clasificación --> Aprobación --> Implementación --> Pruebas --> Documentación --> Cierre
```

### Paso 1: Solicitud de Cambio
- Todo cambio debe iniciarse mediante una Solicitud de Cambio (SC) documentada.
- La SC debe incluir: descripción del cambio, justificación, módulos/áreas afectadas, impacto estimado en la validación y solicitante.

### Paso 2: Evaluación de Impacto
- El Responsable TI evalúa el impacto técnico.
- El Responsable Funcional evalúa el impacto operativo y sobre los requerimientos URS/FRS.
- Se determina la clasificación del cambio.

### Paso 3: Aprobación
- Cambios Menores: aprobados por Responsable TI.
- Cambios Moderados: aprobados por Responsable TI y Responsable Funcional.
- Cambios Mayores: aprobados por Gerencia General.

### Paso 4: Implementación y Pruebas
- Los cambios se implementan en ambiente de desarrollo/staging antes de producción.
- Se ejecutan las pruebas requeridas según la clasificación.
- Los resultados se documentan en el Registro de Cambios.

### Paso 5: Documentación y Cierre
- Se actualizan los documentos de validación afectados (URS, FRS, DDS, protocolos).
- Se actualiza la versión del documento y el historial de revisiones.
- Se registra el cambio en el Registro de Control de Cambios.

## Registro de Control de Cambios

| ID Cambio | Fecha Solicitud | Descripción | Tipo | Módulos Afectados | Solicitante | Aprobado por | Fecha Implementación | Estado | Revalidación |
|---|---|---|---|---|---|---|---|---|---|
| CC-001 | __________ | (Sin cambios registrados al momento de emisión inicial) | — | — | — | — | — | — | — |

## Criterios de Revalidación

Un cambio requiere revalidación formal (ejecución de nuevos protocolos) cuando:
- Afecta funcionalidades cubiertas por los protocolos IQ, OQ o PQ existentes.
- Modifica la lógica de negocio validada en el URS o FRS.
- Cambia la infraestructura de despliegue o configuración de entorno.
- Introduce nuevas integraciones con sistemas externos.
- Modifica el esquema de base de datos en tablas críticas para la validación.

## Firmas de Aprobación del Procedimiento

| Rol | Nombre | Firma | Fecha |
|---|---|---|---|
| Elaborado por | __________________ | __________________ | __________ |
| Revisado por | __________________ | __________________ | __________ |
| Aprobado por | __________________ | __________________ | __________ |
