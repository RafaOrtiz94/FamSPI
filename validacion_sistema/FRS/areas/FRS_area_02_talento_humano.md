# DOCUMENTO DE ESPECIFICACION FUNCIONAL DEL SISTEMA (FRS)
## Area: Talento Humano

## 1. Introduccion
Este documento define la especificacion funcional detallada del area de Talento Humano del SPI a partir de la URS consolidada.

## 2. Referencias
- URS base: `validacion_sistema/URS/areas/area_02_talento_humano.md`
- Modulos fuente: `talento_humano`, `users`, `user-profile`, `user-certifications`, `collaborators`, `attendance`, `vacaciones`, `permisos`, `personnel-requests`, `applicants`, `departments`

## 3. Objetivo funcional
Especificar funciones de gestion de personal, estructura organizacional, asistencia y solicitudes laborales con control y trazabilidad.

## 4. Alcance funcional detallado
- Alta y administracion de usuarios/colaboradores.
- Administracion de perfiles y certificaciones.
- Control de asistencia y consulta historica.
- Gestion de permisos y vacaciones.
- Gestion de requerimientos de personal y postulantes.
- Gestion de departamentos y asignaciones.

## 5. Actores y perfiles
- Colaborador.
- Jefe de area.
- Analista de Talento Humano.
- Administrador de sistema.

## 6. Componentes funcionales involucrados
- Backend: modulos del dominio de personal y estructura.
- Frontend: pantallas de colaborador, asistencia, permisos/vacaciones y postulantes.
- Datos: usuarios, perfiles, certificados, departamentos, asistencia y solicitudes.

## 7. Especificaciones funcionales
### FR-TH-001 Gestion de colaboradores y usuarios
- Descripcion: Crear, actualizar y consultar datos de colaboradores y usuarios internos.
- Entradas: datos personales/laborales y estado.
- Salidas: registro persistido y disponible para consulta.
- Reglas: unicidad por identificador institucional y validaciones obligatorias.

### FR-TH-002 Asignacion organizacional
- Descripcion: Asociar colaboradores a departamentos y jerarquias validas.
- Entradas: colaborador, departamento, rol organizacional.
- Salidas: asignacion vigente con historial.
- Reglas: departamento activo y coherencia jerarquica.

### FR-TH-003 Control de asistencia
- Descripcion: Registrar marcas/asistencia y consultar historial por periodo.
- Entradas: colaborador, fecha, hora, tipo de registro.
- Salidas: registro de asistencia y resumen por rango.
- Reglas: ventanas horarias y politicas internas.

### FR-TH-004 Gestion de permisos y vacaciones
- Descripcion: Registrar solicitudes, evaluar aprobaciones y actualizar estado.
- Entradas: tipo solicitud, fechas, motivo, aprobador.
- Salidas: solicitud en estado correspondiente con historial.
- Reglas: validacion de cupos/politicas y flujo de aprobacion.

### FR-TH-005 Perfiles y certificaciones
- Descripcion: Mantener informacion de perfil y certificaciones del colaborador.
- Entradas: datos de perfil, certificacion, vigencia.
- Salidas: perfil consolidado y certificaciones trazables.
- Reglas: relacion obligatoria con colaborador existente.

### FR-TH-006 Requerimientos de personal
- Descripcion: Registrar y dar seguimiento a solicitudes de personal.
- Entradas: perfil requerido, area solicitante, prioridad.
- Salidas: solicitud con estados y responsables.
- Reglas: campos obligatorios y circuito de aprobacion.

### FR-TH-007 Gestion de postulantes
- Descripcion: Registrar postulantes y su avance en el flujo de seleccion.
- Entradas: datos postulante, vacante, etapa.
- Salidas: expediente y estado actual.
- Reglas: consistencia de etapas y trazabilidad.

### FR-TH-008 Exposicion controlada de datos de personal
- Descripcion: Entregar datos de talento humano a otros modulos segun permisos.
- Entradas: solicitud de consulta por modulo consumidor.
- Salidas: dataset autorizado.
- Reglas: minimizacion de datos y control por rol.

## 8. Validaciones de negocio y datos
- No se permite duplicidad de colaborador por identificador.
- Toda solicitud debe tener responsable y estado.
- No se aprueban vacaciones/permisos sin reglas de cupo vigentes.
- Datos de certificaciones requieren colaborador asociado.

## 9. Seguridad y control
- Acceso restringido por perfil de Talento Humano.
- Auditoria de cambios sobre datos personales y estados.
- Control de visibilidad para datos sensibles del colaborador.

## 10. Manejo de errores y excepciones
- `400/422`: datos incompletos o inconsistentes.
- `401`: acceso sin sesion valida.
- `403`: intento de operacion fuera del rol permitido.
- `404`: entidad no encontrada (colaborador, solicitud, departamento).
- `409`: conflicto de estado o duplicidad.

## 11. Interfaces e integraciones
- Integracion con area de Gobierno/Seguridad para autorizacion.
- Integracion con notificaciones para cambios de estado en solicitudes.
- Integracion con Finanzas y Operaciones para datos de colaboradores habilitados.

## 12. Matriz de trazabilidad URS -> FRS -> Prueba
| URS | FRS | Caso de prueba funcional |
|---|---|---|
| REQ-TH-001 | FR-TH-001 | Alta y edicion de colaborador con validaciones |
| REQ-TH-002 | FR-TH-002 | Asignar colaborador a departamento activo |
| REQ-TH-003 | FR-TH-003 | Registrar asistencia y consultar periodo |
| REQ-TH-004 | FR-TH-004 | Solicitar y aprobar permiso/vacacion |
| REQ-TH-005 | FR-TH-005 | Registrar certificacion y verificar relacion |
| REQ-TH-006 | FR-TH-006 | Crear requerimiento de personal y mover estados |
| REQ-TH-007 | FR-TH-007 | Registrar postulante y avanzar etapa |
| REQ-TH-008 | FR-TH-008 | Consumir datos de personal desde otro modulo |

## 13. Criterios de aceptacion del area
- Flujos de personal ejecutables de punta a punta con estados consistentes.
- Solicitudes laborales con trazabilidad completa.
- Integridad referencial entre usuarios, colaboradores y estructura.
- Control de acceso efectivo sobre datos sensibles.
