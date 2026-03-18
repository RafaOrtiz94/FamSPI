# DICCIONARIO DE DATOS

## Area 02: Personas, Talento y Control Laboral

## 1. Introduccion
El presente diccionario de datos documenta las estructuras persistentes que soportan el funcionamiento real del Area 02. Su objetivo es explicar que entidades existen, por que forman parte del dominio de personas, como se relacionan entre si y cuando intervienen dentro de los procesos del area.

## 2. Objetivo
Documentar las tablas, relaciones y estructuras de datos realmente consumidas por `talento_humano`, `personnel-requests`, `users`, `collaborators`, `departments`, `user-profile`, `user-certifications`, `attendance`, `permisos` y `vacaciones`.

## 3. Fuente de verdad
La base de este documento proviene de:
- consultas SQL reales presentes en controladores y servicios del area
- esquema disponible en `actualsindatos.sql`
- relaciones consumidas por frontend y backend
- utilidad compartida `backend/src/modules/shared/profileSync.js` para los campos sincronizados entre perfil propio y colaborador

## 4. Entidades nucleares
| Entidad | Uso principal | Modulos que la consumen |
|---|---|---|
| `users` | Identidad interna, rol, correo, nombre, departamento | users, collaborators, user-profile, user-certifications, personnel-requests, attendance, permisos, vacaciones |
| `departments` | Estructura organizacional | departments, users, collaborators, personnel-requests, attendance, vacaciones |
| `employees` | Registro basico legacy de empleados | talento_humano |
| `collaborator_profiles` | Perfil extendido del colaborador | collaborators, user-profile, vacaciones, permisos, personnel-requests |
| `collaborator_documents` | Soporte documental del colaborador | collaborators, personnel-requests |
| `user_profile` | Metadata propia, preferencias y avatar | user-profile, collaborators |
| `user_certifications` | Certificaciones del usuario | user-certifications, collaborators |

## 5. Entidades de talento y reclutamiento interno
| Entidad | Uso principal | Observacion |
|---|---|---|
| `personnel_requests` | Solicitud principal de personal | Nucleo del workflow de requerimiento |
| `personnel_request_history` | Historial de cambios | Trazabilidad de estados y acciones |
| `personnel_request_comments` | Comentarios asociados | Soporte colaborativo del proceso |
| `personnel_request_profiles` | Perfil especifico del cargo o persona requerida | Se completa antes de cierre o contratacion |
| `personnel_request_documents` | Documentos del expediente de la solicitud | Puede replicarse al colaborador al contratar |

## 6. Entidades de asistencia
| Entidad | Uso principal | Observacion |
|---|---|---|
| `user_attendance_records` | Registro diario de entrada, almuerzo y salida | Tabla central de la jornada |
| `attendance_status` | Estado derivado de la jornada | Se calcula a partir de las marcas y se usa para consulta administrativa |
| `attendance_status_label` | Etiqueta legible del estado derivado | Facilita la interpretacion en reportes y UI |
| `attendance_exceptions` | Salidas temporales fuera del flujo ordinario | Maneja estados ACTIVE, ON_SITE, RETURNING y COMPLETED |
| `attendance_overtime` | Horas extra registradas o calculadas | Soporte de overtime manual o automatizado |

## 7. Entidades de permisos y vacaciones
| Entidad | Uso principal | Observacion |
|---|---|---|
| `permisos_vacaciones` | Solicitudes de permisos y parte del control historico de vacaciones | Tabla central del modulo permisos |
| `permisos_vacaciones_firmas` | Evidencia de firma por etapa | Soporte juridico y de trazabilidad |
| `permisos_estudios_matriculas` | Matriculas academicas para permisos por estudios | Requisito previo para ese subtipo |
| `vacaciones_solicitudes` | Solicitudes de vacaciones del modulo dedicado | Convivencia con `permisos_vacaciones` en ciertos calculos |
| `vacaciones_saldos_historicos` | Referencia historica de saldos | Apoyo de calculo en vacaciones y permisos |

## 8. Dependencias de datos externas al area
| Entidad | Motivo de consumo | Modulo que la usa |
|---|---|---|
| `applicants` | Candidato asociado a solicitud de personal | personnel-requests |
| `applicant_documents` | Documentos del candidato | personnel-requests |

## 9. Relaciones funcionales principales
- `users.department_id -> departments.id`
- `collaborator_profiles.user_id -> users.id`
- `collaborator_documents.user_id -> users.id`
- `user_profile.user_id -> users.id`
- `user_certifications.user_id -> users.id`
- `personnel_requests.requester_id -> users.id`
- `personnel_requests.department_id -> departments.id`
- `personnel_requests.collaborator_user_id -> users.id`
- `user_attendance_records.user_id -> users.id`
- `attendance_exceptions.user_id -> users.id`
- `permisos_vacaciones.user_id / user_email -> users`
- `vacaciones_solicitudes.requester_id -> users.id`

## 10. Interpretacion del modelo
El modelo de datos del area se organiza en tres bloques:
1. identidad y estructura (`users`, `departments`, perfiles y certificaciones)
2. talento y relacion laboral (`personnel_requests`, collaborator workspaces, documentos)
3. control de tiempo y ausencias (`attendance`, `permisos`, `vacaciones`)

## 11. Riesgos documentados del modelo
- coexistencia de `vacaciones_solicitudes` y `permisos_vacaciones`
- dependencia cruzada con `applicants` durante contratacion
- convivencia entre submodulo HR legacy (`employees`) y modelo moderno basado en `users` y `collaborator_profiles`
- duplicacion historica de claves sincronizadas entre `user-profile` y `collaborators`, mitigada por una utilidad unica compartida

## 12. Conclusion
El diccionario de datos del Area 02 demuestra que la operacion de personas y control laboral se apoya en un conjunto definido de entidades, aunque con algunos componentes coexistentes que deben documentarse cuidadosamente para evitar ambiguedades durante la validacion.
