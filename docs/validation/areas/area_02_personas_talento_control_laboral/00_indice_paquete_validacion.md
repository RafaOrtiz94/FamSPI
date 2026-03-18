# INDICE DEL PAQUETE DE VALIDACION

## Area 02: Personas, Talento y Control Laboral

## Objetivo del expediente
Consolidar la documentacion tecnica y funcional necesaria para validar el dominio de personas del sistema SPI, cubriendo gestion de usuarios internos, colaboradores, departamentos, perfiles, certificaciones, solicitudes de personal, asistencia, permisos, vacaciones y reportes asociados.

## Modulos cubiertos
- `talento_humano`
- `personnel-requests`
- `users`
- `collaborators`
- `departments`
- `user-profile`
- `user-certifications`
- `attendance`
- `permisos`
- `vacaciones`

## Documentos vigentes
1. URS - Requerimientos de usuario
2. FRS - Requerimientos funcionales
3. DDS - Diseno tecnico
4. DD - Diccionario de datos
5. IQ - Calificacion de instalacion
6. OQ - Calificacion operacional
7. PQ - Calificacion de desempeno
8. Informe de hallazgos vigentes del area

## Protocolos de ejecucion
1. Protocolo IQ
2. Protocolo OQ
3. Protocolo PQ
4. Registro de evidencias y desviaciones

## Referencia historica
- Revision historica de hallazgos de produccion del area

## Observaciones de alcance
- El area integra tanto la administracion de talento como el control laboral diario.
- `Permisos y Vacaciones` vive visualmente en `shared`, pero funcionalmente forma parte de este dominio.
- `Attendance` tiene dependencia operativa con autenticacion durante el login, pero el control diario pertenece a esta area.
- `talento_humano` existe como submodulo legacy y debe documentarse junto al workspace moderno de colaboradores y solicitudes de personal.
