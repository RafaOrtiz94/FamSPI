# PROTOCOLO DE EJECUCION IQ

## 1. Objetivo
Definir los pasos de ejecucion de la IQ para verificar montaje, dependencias y prerrequisitos tecnicos del Area 02.

## 2. Casos de ejecucion
| ID | Modulo | Verificacion | Resultado esperado |
|---|---|---|---|
| IQP-PT-001 | registerRoutes | Verificar montaje de rutas del area | Las rutas declaradas existen en el backend |
| IQP-PT-002 | frontend | Verificar paginas de talento, perfil, permisos y asistencia | Las rutas privadas del dashboard existen |
| IQP-PT-003 | base de datos | Verificar tablas nucleares del area | Las entidades requeridas estan presentes |
| IQP-PT-004 | jobs | Verificar jobs de overtime y recovery expiry | Los archivos existen y refieren al dominio correcto |
| IQP-PT-005 | reportes | Verificar capacidad de generar PDF de asistencia y certificaciones | Existen servicios o endpoints asociados |

## 3. Evidencias requeridas
- captura de rutas o codigo verificado
- extracto de tablas o consultas del modulo
- evidencia de existencia de jobs
- evidencia de componentes frontend consumidores

## 4. Criterio de aceptacion
Cada caso IQ se aprueba cuando el componente existe, esta conectado al dominio correcto y no presenta ausencia estructural bloqueante.
