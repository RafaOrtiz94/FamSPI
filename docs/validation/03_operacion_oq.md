# Operacion OQ

Documento vigente de calificacion operacional de FamSPI.

Fecha de emision: `16 de julio de 2026`

## 1. Objetivo

Confirmar que FamSPI opera correctamente en condiciones controladas para los flujos funcionales vigentes, incluyendo modulos ampliados, nuevas pantallas, workspaces nuevos y correcciones recientes.

## 2. Alcance OQ

OQ debe cubrir pruebas funcionales por flujo y por rol, no solo por modulo.

### Flujos minimos sugeridos

- autenticacion, sesion, expiracion, acceso y denegacion
- navegacion por dashboard y workspaces segun rol
- solicitudes, aprobaciones, rechazos y trazabilidad
- creacion, edicion, asignacion y consulta de registros criticos
- carga documental, firma, evidencia y recuperacion
- jobs o procesos automaticos con impacto funcional

## 3. Dominios funcionales a probar

| Dominio | Cobertura OQ requerida |
|---|---|
| Seguridad y acceso | login, rol, scope, rutas publicas/privadas, module access |
| Talento humano | perfiles, fichas, permisos, vacaciones, postulacion, offboarding, asistencia |
| Comercial | solicitudes, clientes, planificacion, opportunities, FamSheets, business case |
| Servicio tecnico | solicitudes, cronograma, mantenimientos, disponibilidad, aplicaciones, capacitaciones |
| Compras y activos | public/private purchases, equipos, inventario, tickets TI, activos TI, entregas |
| Finanzas | viaticos, revisiones, pagos y exportaciones en alcance |
| Calidad | workspaces CA y sus controles |
| Firma y documentos | workflows, sellos, verificadores publicos, adjuntos |
| CRM-FAM y work management | operaciones funcionales si estan productivas para el alcance |

## 4. Reglas de ejecucion OQ

- Cada caso debe indicar rol ejecutor.
- Cada caso debe indicar datos de prueba.
- Cada caso debe indicar resultado esperado medible.
- Cada caso debe capturar evidencia objetiva.
- Cada caso debe marcar desviacion si el sistema se comporta distinto a la documentacion vigente.

## 5. Plantilla minima de caso OQ

| Campo | Contenido requerido |
|---|---|
| ID | Identificador unico |
| Dominio | Area o modulo |
| Rol | Rol que ejecuta |
| Precondicion | Estado previo verificable |
| Pasos | Secuencia concreta |
| Resultado esperado | Medible y observable |
| Evidencia | captura, log, respuesta o registro |
| Estado | Conforme, No conforme, Bloqueado |

## 6. Casos criticos obligatorios 2026

| ID | Caso | Prioridad |
|---|---|---|
| OQ-001 | Login correcto e incorrecto | Critica |
| OQ-002 | Ruta privada sin token | Critica |
| OQ-003 | Ruta con rol no autorizado | Critica |
| OQ-004 | Cambio de estado con auditoria | Critica |
| OQ-005 | Flujo de solicitud y aprobacion | Critica |
| OQ-006 | Asignacion o reordenamiento segun reglas del dominio | Alta |
| OQ-007 | Guardado de ficha/perfil y persistencia correcta | Alta |
| OQ-008 | Flujo de documento o firma | Alta |
| OQ-009 | Carga o visualizacion de expediente | Alta |
| OQ-010 | Validaciones visuales y operativas de formularios criticos | Alta |

## 7. Brechas que OQ debe cerrar frente al expediente viejo

- ya no basta probar solo areas 01 y 02;
- los cambios recientes en clientes, planificacion, servicio tecnico y compras deben incorporarse;
- la navegacion y la experiencia por rol deben entrar en OQ porque afectan uso previsto;
- los portales publicos deben probarse solo si forman parte del alcance aprobado.

## 8. Criterio de aceptacion OQ

Un dominio no puede declararse conforme si:

- tiene flujos criticos no ejecutados,
- depende de documentos antiguos contradichos por el codigo actual,
- presenta errores bloqueantes sin desviacion aprobada,
- no genera evidencia suficiente.

## 9. SOPs y entrenamiento (WHO §11)

Previo a PQ/UAT y a la liberacion del sistema debe existir procedimiento escrito y material de entrenamiento vigente que defina el uso y control del sistema (WHO §11.1-11.2). En FamSPI esto se sustenta en:

| Tipo de procedimiento | Evidencia en FamSPI |
|---|---|
| Uso rutinario por modulo | `CONTEXT.md` por modulo backend (51 archivos al `20 de julio de 2026`), con endpoints, flujo y riesgos documentados |
| Administracion del sistema | `AGENTS.md` por modulo: alcance exacto, cuando activarse, limites de cambio y verificacion minima |
| Procedimientos operativos transversales | `CLAUDE.md` (arquitectura, comandos, RBAC, migraciones) y `DESIGN.md` (consistencia visual) |
| Procedimientos tecnicos especializados | `.agents/skills/*.md` (ej. conexion a Neon via gcloud Secret Manager, migraciones de base de datos, auditoria de seguridad) |
| Requisito de acceso previo entrenamiento | Todo usuario nuevo requiere asignacion de rol RBAC (`requireRole`) antes de operar cualquier modulo; el acceso mismo actua como control de que el usuario fue provisto conforme al procedimiento |

Estos documentos se consideran el equivalente funcional de SOPs y manuales de usuario exigidos por WHO §11.2 para este sistema de desarrollo interno.

## 10. Entregables de salida de OQ

- matriz de casos ejecutados,
- evidencias enlazadas,
- desviaciones abiertas,
- decision de paso o no paso a PQ por dominio.
