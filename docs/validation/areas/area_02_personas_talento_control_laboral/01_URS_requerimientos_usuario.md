# URS - AREA 02 PERSONAS, TALENTO Y CONTROL LABORAL

## 1. Introduccion
El presente documento define los requerimientos de usuario del Area 02 del sistema SPI. El dominio agrupa las capacidades necesarias para administrar informacion de colaboradores, estructura organizacional, solicitudes de personal, perfil interno, certificaciones, control de asistencia, horas extra, permisos y vacaciones. Su elaboracion se basa en la evidencia real del backend montado, de los componentes frontend consumidores y de las reglas de negocio observables en las rutas y servicios vigentes.

La razon de existir de esta area es sostener el ciclo de vida interno del colaborador dentro del sistema. SPI necesita saber quien forma parte de la organizacion, en que departamento participa, cual es su informacion de perfil, que certificaciones mantiene vigentes, que requerimientos de personal se encuentran abiertos, como se registra su jornada y bajo que reglas se tramitan ausencias o vacaciones. Sin este dominio, el sistema perderia trazabilidad laboral, consistencia administrativa y capacidad de control operativo diario.

## 2. Objetivo
Definir los requerimientos de usuario de alto nivel para `talento_humano`, `personnel-requests`, `users`, `collaborators`, `departments`, `user-profile`, `user-certifications`, `attendance`, `permisos` y `vacaciones`, explicando para cada uno por que existe, como debe manifestarse para el usuario final y cuando debe intervenir en la operacion real.

## 3. Alcance
Incluye:
- backend Express montado para los modulos del area
- frontend React de talento humano, perfil, asistencia y solicitudes
- persistencia PostgreSQL asociada a usuarios, perfiles, asistencia, permisos y vacaciones
- jobs de horas extra y vencimiento de coordinacion de recuperacion
- reportes PDF de asistencia y saldos de vacaciones

Excluye:
- dominios comerciales, tecnicos, financieros y de compras
- respaldo de base de datos
- autenticacion federada como dominio principal, aunque se reconozca su dependencia para la autoentrada de asistencia

## 4. Actores
- Colaborador autenticado
- Colaborador con perfil propio
- Talento humano
- Jefe de talento humano
- Gerencia o gerencia general
- Jefes de area que solicitan personal
- Jefes inmediatos que aprueban permisos o vacaciones
- Finanzas con visibilidad de reportes de asistencia

## 5. Justificacion general del area
El area existe para ordenar la relacion entre la organizacion y sus colaboradores dentro del sistema. Desde la perspectiva del usuario, esto significa poder identificar personal activo, registrar cambios de estructura, mantener perfiles actualizados, controlar certificaciones, abrir procesos de contratacion interna, registrar jornadas y resolver ausencias sin perder trazabilidad. Desde la perspectiva operativa, significa que las decisiones laborales y administrativas queden soportadas por datos verificables y por flujos consistentes en el tiempo.

## 6. Justificacion por modulo
| Modulo | Por que existe | Como opera a alto nivel | Cuando aplica |
|---|---|---|---|
| `talento_humano` | Para conservar el submodulo HR legacy todavia utilizado en ciertos registros de empleados y soportes. | Opera bajo `/api/v1/talento-humano`, expone alta, listado, actualizacion y carga documental basica. | Cuando talento humano necesita operar registros heredados que aun no migraron al workspace moderno. |
| `personnel-requests` | Para canalizar necesidades de personal. | Registra solicitud, historial, comentarios, perfil, documentos y contratacion. | Cuando un area necesita cubrir una vacante o posicion. |
| `users` | Para administrar identidades internas y su relacion con la estructura organizacional. | Lista usuarios activos o inactivos segun el rol, valida departamento activo antes de crear o actualizar y permite desactivacion logica en lugar de borrado fisico en la operacion administrativa. | Cuando se gestiona acceso, rol, departamento o vigencia del usuario interno. |
| `collaborators` | Para consolidar el workspace integral del colaborador. | Lista colaboradores, estadisticas, completitud documental, alertas de certificaciones y datos sincronizados desde perfil propio y perfil laboral. | Cuando talento o gerencia revisan personal activo y su expediente operativo. |
| `departments` | Para sostener la estructura organizacional vigente sin perder historico. | Administra departamentos con estado activo/inactivo, permite listados con o sin inactivos y evita nuevas asignaciones a estructuras desactivadas. | Cuando se requiere crear, mantener, desactivar o reactivar unidades organizativas. |
| `user-profile` | Para que el colaborador mantenga su perfil propio sin romper el expediente laboral consolidado. | Lee y actualiza metadata, preferencias y avatar, y sincroniza claves compartidas hacia el perfil del colaborador mediante una utilidad comun. | Cuando el usuario corrige o revisa informacion personal y durante la revision anual del perfil. |
| `user-certifications` | Para registrar competencias, vigencias y evidencia documental de habilitaciones. | Crea, consulta, elimina logicamente y genera PDF consolidado para roles autorizados de negocio y gerencia. | Cuando se necesita evidencia de formacion, habilitacion o vigencia documental. |
| `attendance` | Para controlar la jornada diaria y separar la operacion del colaborador del reporte administrativo. | Registra entrada, almuerzo, salida, excepciones y overtime; ademas distingue consulta propia, consulta administrativa por estado y PDF oficial RH-09 por usuario. | Durante la operacion diaria del colaborador, el control de talento humano y la emision de respaldos formales. |
| `permisos` | Para gestionar ausencias justificadas y recuperables. | Crea solicitudes, matriculas, justificantes, aprobaciones y coordinacion. | Cuando un colaborador necesita ausentarse con soporte formal. |
| `vacaciones` | Para administrar el descanso anual y su saldo. | Crea solicitudes, resume saldo, aprueba, cancela y recalcula. | Cuando el colaborador solicita vacaciones o talento revisa disponibilidad. |

## 7. Requerimientos de usuario
- REQ-PT-001: El sistema debe permitir a talento humano y roles autorizados administrar usuarios internos y departamentos.
- REQ-PT-002: El sistema debe permitir consolidar la informacion del colaborador en un workspace verificable.
- REQ-PT-003: El sistema debe permitir al propio usuario mantener actualizado su perfil y preferencias.
- REQ-PT-004: El sistema debe permitir registrar certificaciones con soporte documental y consultar su vigencia.
- REQ-PT-004A: El sistema debe sincronizar de forma controlada las claves compartidas entre el perfil propio del usuario y el expediente laboral del colaborador.
- REQ-PT-005: El sistema debe permitir abrir, revisar y cerrar solicitudes de personal con historial y comentarios.
- REQ-PT-006: El sistema debe permitir asociar postulantes o colaboradores a una solicitud de personal y completar su perfil.
- REQ-PT-007: El sistema debe permitir contratar un postulante y trasladar informacion relevante al colaborador resultante.
- REQ-PT-008: El sistema debe permitir registrar entrada, salida a almuerzo, retorno y salida final de la jornada.
- REQ-PT-009: El sistema debe permitir gestionar salidas inesperadas y retorno al sitio.
- REQ-PT-010: El sistema debe permitir registrar o calcular horas extra y consultarlas por rango.
- REQ-PT-011: El sistema debe permitir generar reportes PDF oficiales de asistencia por usuario y rango.
- REQ-PT-021: El sistema debe permitir consultar asistencia administrativa por usuario, rango y estado de jornada sin mezclarla con el PDF oficial.
- REQ-PT-022: El sistema debe mostrar el estado de jornada derivado para distinguir entre sin entrada, jornada abierta, almuerzo abierto y jornada cerrada.
- REQ-PT-023: El sistema debe separar de forma clara la consulta administrativa de asistencia del reporte oficial RH-09 para evitar interpretaciones incorrectas.
- REQ-PT-023A: El sistema debe alinear la visibilidad de reportes de asistencia con los roles realmente autorizados en backend y frontend.
- REQ-PT-024: El sistema debe impedir que una solicitud de personal avance de paso si el bloque actual no tiene la informacion obligatoria completa.
- REQ-PT-025: El sistema debe mostrar de forma visible el estado actual, el responsable de la etapa y el proximo paso de una solicitud de personal.
- REQ-PT-026: El sistema debe indicar cuando una solicitud de personal esta estancada o excedio el tiempo operativo esperado para su etapa.
- REQ-PT-027: El sistema debe permitir reasignar el responsable operativo de una solicitud de personal cuando el rol autorizado lo requiera.
- REQ-PT-028: El sistema debe permitir registrar comentarios trazables asociados al usuario, fecha y visibilidad interna o externa.
- REQ-PT-029: El sistema debe mostrar el progreso de contratacion y el checklist de documentos y validaciones requeridas antes de cerrar la contratacion.
- REQ-PT-012: El sistema debe permitir solicitar permisos por estudios, salud, calamidad y motivos personales con los campos que correspondan.
- REQ-PT-013: El sistema debe permitir registrar matriculas de estudio y exigirlas antes de habilitar permisos por estudios.
- REQ-PT-014: El sistema debe permitir subir justificantes cuando un permiso lo requiera.
- REQ-PT-015: El sistema debe permitir aprobacion parcial, aprobacion final, rechazo y cancelacion de permisos.
- REQ-PT-016: El sistema debe permitir coordinar planes de recuperacion para permisos recuperables y cerrarlos por acuerdo o vencimiento.
- REQ-PT-017: El sistema debe permitir solicitar vacaciones, consultar saldo disponible y conocer dias u horas restantes.
- REQ-PT-018: El sistema debe permitir aprobar, rechazar, cancelar y revisar cancelaciones de vacaciones.
- REQ-PT-019: El sistema debe permitir a talento humano y gerencia ver resumen consolidado por colaborador en permisos y vacaciones.
- REQ-PT-020: El sistema debe conservar trazabilidad suficiente sobre acciones criticas del area y sus soportes documentales.

## 8. Requerimientos no funcionales
- Toda operacion del area debe estar protegida por autenticacion y, cuando corresponda, por control de rol.
- La informacion personal y laboral debe tratarse con criterio de minima exposicion y trazabilidad.
- Los formularios del area deben permitir calculo automatico de fechas, horas o duraciones cuando la logica del proceso asi lo exija.
- Los procesos diarios como asistencia deben ser simples de usar y no depender de pasos manuales innecesarios.
- Los documentos y archivos asociados a colaboradores, solicitudes, permisos o certificaciones deben quedar vinculados de forma recuperable.
- El area debe sostener reportes y evidencia objetiva suficiente para fines administrativos y de control interno.

## 9. Conclusion
Los requerimientos de usuario del Area 02 responden a la necesidad de administrar el ciclo laboral interno del colaborador dentro de SPI. El dominio no solo existe para almacenar datos de personas, sino para hacer operables los procesos de talento, asistencia, permisos y vacaciones con trazabilidad, criterios de aprobacion y soporte documental verificable.
