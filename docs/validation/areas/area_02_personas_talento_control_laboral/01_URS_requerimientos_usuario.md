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

## 7. Requerimientos de usuario (URS) - 40 Requisitos para Producción

### 7.1 Gestión Organizacional y Usuarios
- **REQ-PT-001**: El sistema debe permitir a talento humano y roles autorizados administrar usuarios internos y departamentos.
- **REQ-PT-001A**: El sistema debe unificar la gestion de usuarios y departamentos en una sola entrada de navegacion para simplificar el acceso administrativo.
- **REQ-PT-001B**: El sistema debe restringir esa entrada unificada a Talento Humano y TI, tanto en navegacion como en acceso directo a la ruta.
- **REQ-PT-030**: El sistema debe impedir la eliminacion fisica de usuarios, permitiendo solo la desactivacion logica para preservar la integridad referencial historica.
- **REQ-PT-031**: El sistema debe validar la existencia y estado activo de un departamento antes de permitir la asignacion de un colaborador al mismo.

### 7.2 Workspace del Colaborador (REQ-PT-002)
- **REQ-PT-002**: El sistema debe permitir consolidar la informacion del colaborador en un workspace verificable.
- **REQ-PT-002A**: El sistema debe presentar solicitudes, postulantes y colaboradores dentro de una experiencia de trabajo unificada, evitando saltos entre pantallas.
- **REQ-PT-002B**: El sistema debe evitar layouts basados en sidebars persistentes que reduzcan el area util de trabajo efectiva.
- **REQ-PT-002C**: El sistema debe implementar una navegacion contextual basada en pestañas (Tabs) para cambiar entre Perfil, Documentos, Checklist e Historial.
- **REQ-PT-002D**: El sistema debe mostrar un encabezado operativo persistente con el contexto activo (Nombre, Foto, Estado, Responsable y Siguiente Accion).
- **REQ-PT-002E**: El sistema debe organizar el contenido siguiendo una jerarquia visual consistente (Resumen -> Detalle -> Acciones).
- **REQ-PT-032**: El sistema debe implementar Skeleton Loaders durante la carga de datos del workspace para evitar saltos visuales (Layout Shift).

### 7.3 Perfil y Certificaciones
- **REQ-PT-003**: El sistema debe permitir al propio usuario mantener actualizado su perfil personal y preferencias de sistema.
- **REQ-PT-004**: El sistema debe permitir registrar certificaciones con soporte documental y alertas de vencimiento.
- **REQ-PT-004A**: El sistema debe sincronizar automaticamente las claves compartidas entre el perfil del usuario y el expediente laboral del colaborador.
- **REQ-PT-033**: El sistema debe permitir la descarga de un "Dossier de Certificaciones" consolidado en formato PDF.

### 7.4 Solicitudes de Personal (Personnel Requests)
- **REQ-PT-005**: El sistema debe permitir abrir, revisar y cerrar solicitudes de personal con historial de cambios y comentarios.
- **REQ-PT-006**: El sistema debe permitir asociar postulantes externos o colaboradores internos a una solicitud de personal.
- **REQ-PT-007**: El sistema debe permitir la contratacion de un postulante, trasladando automaticamente su perfil al registro de colaborador.
- **REQ-PT-024**: El sistema debe impedir que una solicitud avance de etapa si el bloque de informacion actual no esta completo al 100%.
- **REQ-PT-026**: El sistema debe marcar visualmente como "Estancada" cualquier solicitud que supere el tiempo limite definido para su etapa actual (SLA).
- **REQ-PT-028**: El sistema debe permitir comentarios con visibilidad selectiva (Interno TH / Publico involucrados).
- **REQ-PT-029**: El sistema debe mostrar un Checklist de verificacion obligatoria antes de permitir el cierre de una contratacion.
- **REQ-PT-034**: El sistema debe asegurar que toda contratacion se realice bajo una transaccion atomica en base de datos para evitar registros inconsistentes.

### 7.5 Control de Asistencia y Jornada
- **REQ-PT-008**: El sistema debe permitir el registro de entrada, salida a almuerzo, retorno y salida final.
- **REQ-PT-035**: El sistema debe capturar la geolocalización del dispositivo al momento de realizar cualquier marcacion de asistencia.
- **REQ-PT-036**: El sistema debe permitir el acceso rapido a las marcaciones de asistencia mediante Atajos (Shortcuts) optimizados para dispositivos moviles.
- **REQ-PT-010**: El sistema debe calcular automaticamente las horas extra diarias y permitir su consulta por rangos de fecha.
- **REQ-PT-011**: El sistema debe generar el reporte oficial RH-09 de asistencia en formato PDF con firma de responsabilidad.
- **REQ-PT-021**: El sistema debe proveer una vista administrativa de asistencia para TH que permita filtrar por estado de jornada (Abierta, Almuerzo, Cerrada).
- **REQ-PT-037**: El sistema debe notificar automaticamente a TH cuando un colaborador registre una excepcion de jornada o salida inesperada.

### 7.6 Permisos y Vacaciones
- **REQ-PT-012**: El sistema debe permitir solicitar permisos (estudios, salud, calamidad) con validacion de campos obligatorios segun el tipo.
- **REQ-PT-013**: El sistema debe exigir el registro de matricula vigente antes de habilitar solicitudes de permiso por estudios.
- **REQ-PT-014**: El sistema debe permitir adjuntar evidencias digitales (justificantes) a las solicitudes de permiso.
- **REQ-PT-015**: El sistema debe implementar un flujo de aprobacion multinivel (Jefe Inmediato -> Talento Humano).
- **REQ-PT-016**: El sistema debe permitir la coordinacion de planes de recuperacion para permisos recuperables con seguimiento de cumplimiento.
- **REQ-PT-017**: El sistema debe mostrar al colaborador su saldo actualizado de vacaciones en tiempo real.
- **REQ-PT-038**: El sistema debe impedir solicitudes de vacaciones que excedan el saldo disponible del colaborador.
- **REQ-PT-039**: El sistema debe permitir la reprogramacion o cancelacion de vacaciones aprobadas antes de su fecha de inicio.

### 7.7 Seguridad y Auditoría
- **REQ-PT-020A**: El sistema debe registrar un log de auditoria detallado para cada accion critica, incluyendo: Actor, Modulo, Accion, Valor Anterior y Valor Nuevo.
- **REQ-PT-040**: El sistema debe renovar automaticamente el token de acceso (Refresh Token) con una vigencia de 30 dias para asegurar la continuidad operativa en dispositivos moviles.

## 8. Requerimientos no funcionales
- Toda operacion del area debe estar protegida por autenticacion y control de acceso basado en roles (RBAC).
- La navegacion debe ser responsiva y garantizar la funcionalidad completa en dispositivos moviles.
- Los formularios deben incluir validacion en cliente (frontend) y servidor (backend).
- Los documentos deben almacenarse de forma segura y vinculada al expediente del colaborador.

## 9. Conclusion
Este conjunto de 40 requerimientos asegura que el Area 02 de SPI cuente con la robustez necesaria para operar en produccion, garantizando trazabilidad, cumplimiento de procesos y una experiencia de usuario eficiente.
