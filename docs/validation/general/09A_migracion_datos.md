# Migración de Datos

## Declaración de Aplicabilidad

FamSPI v1.0.0 constituye la **primera instalación** del sistema computarizado en la organización. No existe un sistema predecesor del cual migrar datos operativos hacia FamSPI. Por lo tanto, la migración formal de datos **no aplica** para esta validación inicial.

## Justificación

| Criterio | Evaluación |
|---|---|
| ¿Existe sistema predecesor a reemplazar? | No. FamSPI es el primer sistema de su tipo en la organización. |
| ¿Hay datos históricos que requieren transferencia a FamSPI? | No. Los datos históricos existentes (en papel o hojas de cálculo) no forman parte del alcance funcional de v1.0.0. |
| ¿Se requiere población inicial de datos maestros? | Sí — datos maestros de usuarios, departamentos y configuración inicial. Ver sección de configuración de línea base. |
| ¿Se requiere validación de migración? | No aplica para migración histórica. Los datos maestros iniciales se verifican en IQ. |

## Configuración de Datos Maestros Iniciales (Población de Línea Base)

Aunque no aplica migración de datos históricos, la configuración inicial del sistema requiere la carga de datos maestros de referencia antes de la ejecución de OQ/PQ. Estos incluyen:

| Dato Maestro | Responsable de Carga | Método | Verificación en IQ |
|---|---|---|---|
| Usuarios del sistema (administradores y roles iniciales) | Responsable TI | Interfaz administrativa | IQ-09 / IQ-10 |
| Estructura de departamentos | Responsable funcional | Interfaz administrativa | IQ-11 |
| Configuración de parámetros del sistema | Responsable TI | Variables de entorno / seed DB | IQ-02 / IQ-03 |
| Roles y permisos base (RBAC inicial) | Responsable TI | Seed de base de datos | IQ-04 |

## Criterio de Aceptación

La configuración de datos maestros iniciales se considera aceptada cuando:
- Todos los usuarios administradores definidos pueden autenticarse correctamente.
- La estructura organizacional (departamentos) se visualiza correctamente en el sistema.
- Los roles y permisos RBAC iniciales producen el comportamiento de acceso esperado.
- Las pruebas IQ correspondientes están marcadas como PASS.

## Firma de Aceptación

| Rol | Nombre | Firma | Fecha |
|---|---|---|---|
| Responsable técnico TI | __________________ | __________________ | __________ |
| Responsable funcional | __________________ | __________________ | __________ |
