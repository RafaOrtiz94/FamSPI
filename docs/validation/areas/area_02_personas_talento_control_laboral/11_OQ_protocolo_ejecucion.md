# PROTOCOLO DE EJECUCION OQ

## 1. Objetivo
Definir los pasos operativos para validar el comportamiento funcional del Area 02 bajo condiciones normales y de error controlado.

## 2. Casos de ejecucion
| ID | Modulo | Escenario | Resultado esperado |
|---|---|---|---|
| OQP-PT-001 | users/departments | Crear y editar estructura basica | La informacion persiste y puede recuperarse |
| OQP-PT-002 | collaborators | Consultar y actualizar perfil de colaborador | El workspace refleja cambios y documentos |
| OQP-PT-003 | user-profile | Actualizar perfil propio y avatar | El perfil se guarda con respuesta controlada |
| OQP-PT-004 | user-certifications | Crear certificacion y exportar PDF | La certificacion queda activa y el PDF responde |
| OQP-PT-005 | personnel-requests | Crear solicitud y agregar comentario o documento | El expediente se mantiene consistente |
| OQP-PT-006 | attendance | Registrar jornada completa | La secuencia diaria queda cerrada correctamente |
| OQP-PT-007 | attendance | Registrar excepcion y retorno | El estado cambia segun la secuencia permitida |
| OQP-PT-008 | permisos | Solicitar permiso y aprobarlo | El estado avanza segun la regla del tipo de permiso |
| OQP-PT-009 | permisos | Coordinar recovery plan | La coordinacion se guarda y puede cerrarse |
| OQP-PT-010 | vacaciones | Solicitar vacaciones y revisar estado | El saldo y la solicitud quedan actualizados |

## 3. Evidencias requeridas
- capturas de interfaz
- respuestas de endpoint
- registros en base de datos cuando aplique
- evidencia documental generada o cargada

## 4. Criterio de aceptacion
Cada caso OQ se aprueba cuando el flujo puede ejecutarse de inicio a fin con respuesta funcional coherente y manejo controlado del error.
