# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Autenticacion

## 1. Introduccion
Este documento define la propuesta de requerimientos del modulo de Autenticacion del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente actual (backend y frontend).

## 2. Objetivo del modulo
Gestionar el ciclo de autenticacion y sesion de usuarios internos, incluyendo inicio de sesion con Google OAuth2, emision/renovacion de tokens JWT, cierre de sesion, consulta de perfil activo y controles de cumplimiento interno LOPDP.

## 3. Alcance funcional
- Inicio de sesion con proveedor OAuth2 (Google).
- Provisionamiento/actualizacion automatica del usuario interno durante el callback.
- Emision de `accessToken` y `refreshToken`.
- Renovacion de sesion via refresh token.
- Cierre de sesiones activas.
- Consulta de perfil autenticado (`/auth/me`).
- Registro de aceptacion LOPDP interna para colaboradores.
- Auditoria de sesiones y usuarios activos para roles de control.

## 4. Actores del sistema
- Colaborador interno autenticado.
- Nuevo colaborador en primer ingreso.
- Equipo TI.
- Gerencia.
- Sistema de identidad Google OAuth2.
- Sistema interno de notificaciones y auditoria.

## 5. Descripcion general del modulo
El modulo implementa autenticacion sin cookies, basada en headers JWT (`Authorization` y `x-refresh-token`). El backend valida claims (`iss`, `aud`, `sub`), mapea rol-departamento-dashboard, registra sesiones en `user_sessions`, genera auditoria de eventos y aplica controles adicionales: deteccion de logins fuera de horario, geolocalizacion aproximada y captura de consentimiento interno LOPDP con evidencia en Google Drive.

## 6. Funcionalidades identificadas
- Redireccion a Google OAuth (`GET /api/v1/auth/google`) y callback (`GET /api/v1/auth/google/callback`).
- Creacion/actualizacion de usuario en `users` por `google_id` o `email`.
- Restriccion por dominio corporativo (`ALLOWED_DOMAIN`) cuando aplica.
- Emision de JWT de acceso (8h) y refresh (7d).
- Registro y actualizacion de sesiones en `user_sessions`.
- Consulta de perfil actual (`GET /api/v1/auth/me`) con datos de rol, departamento y avatar.
- [Funcionalidad detectada en el sistema] Auto clock-in en `user_attendance_records` al consultar `/auth/me`.
- Renovacion de tokens (`POST /api/v1/auth/refresh`).
- Cierre de sesion (`POST /api/v1/auth/logout`).
- Aceptacion interna LOPDP (`POST /api/v1/auth/lopdp/accept`) con firma y PDF.
- Listado de sesiones y usuarios activos para TI/Gerencia.
- [Funcionalidad detectada en el sistema] Deteccion de login fuera de horario con notificacion a TI.

## 7. Requerimientos funcionales de alto nivel
- REQ-AUT-001: El sistema debe permitir al colaborador iniciar sesion mediante Google OAuth2 y completar el acceso a la plataforma con una cuenta verificada.
- REQ-AUT-002: El sistema debe crear o actualizar automaticamente el usuario interno cuando el callback OAuth2 sea exitoso, preservando la unicidad por correo y `google_id`.
- REQ-AUT-003: El sistema debe emitir tokens JWT de acceso y refresco al autenticar al usuario, incluyendo datos de rol y alcance funcional.
- REQ-AUT-004: El sistema debe permitir renovar la sesion con refresh token valido sin forzar un nuevo login OAuth.
- REQ-AUT-005: El sistema debe permitir cerrar sesiones activas del usuario autenticado y revocar continuidad de uso.
- REQ-AUT-006: El sistema debe exponer el perfil autenticado vigente para que el frontend inicialice el contexto de sesion.
- REQ-AUT-007: El sistema debe registrar cada sesion iniciada con correo, IP, agente de usuario y timestamps de inicio/cierre.
- REQ-AUT-008: El sistema debe permitir a TI y Gerencia consultar sesiones historicas y usuarios activos en tiempo real.
- REQ-AUT-009: El sistema debe permitir al colaborador registrar la aceptacion interna LOPDP con evidencia de firma y documento.
- REQ-AUT-010: El sistema debe almacenar y asociar la evidencia LOPDP al usuario y al historial de consentimientos.
- REQ-AUT-011: [Funcionalidad detectada en el sistema] El sistema debe registrar automaticamente una hora de entrada diaria cuando el usuario consulta su sesion por primera vez en el dia.
- REQ-AUT-012: [Funcionalidad detectada en el sistema] El sistema debe detectar logins fuera de horario laboral y notificar al area TI sin bloquear el acceso.
- REQ-AUT-013: El sistema debe registrar eventos de autenticacion y seguridad en auditoria para trazabilidad.
- REQ-AUT-014: El sistema debe denegar autenticaciones de dominios no autorizados cuando se configure restriccion de dominio.

## 8. Requerimientos no funcionales
- RNF-AUT-001: El modulo debe validar firma y claims de JWT antes de autorizar acceso a rutas protegidas.
- RNF-AUT-002: Los tokens de sesion deben gestionarse por headers HTTP; no se deben usar cookies de sesion.
- RNF-AUT-003: Las rutas de auditoria de sesion deben aplicar control de acceso estricto por rol (`ti`, `gerencia`).
- RNF-AUT-004: El modulo debe registrar logs tecnicos y de auditoria para eventos de login, refresh, logout y errores.
- RNF-AUT-005: Ante fallos no criticos (ej. auto clock-in), el sistema debe continuar la autenticacion y registrar advertencia.
- RNF-AUT-006: El consentimiento interno LOPDP debe conservar evidencia digital (firma/PDF) y metadatos de trazabilidad (IP, user-agent, fecha).
- RNF-AUT-007: El modulo debe responder con errores estandarizados (`NO_TOKEN`, `INVALID_TOKEN`, `FORBIDDEN`) para facilitar manejo frontend.
- RNF-AUT-008: Las operaciones de sesion deben ser compatibles con despliegue en Cloud Run y encabezados proxy.

## 9. Reglas de negocio
- RN-AUT-001: Solo usuarios con correo verificado por Google pueden autenticarse.
- RN-AUT-002: Cuando existe restriccion de dominio, solo cuentas del dominio autorizado pueden completar login.
- RN-AUT-003: El rol del usuario determina `scope` y `dashboard` de destino en sesion.
- RN-AUT-004: Solo roles `ti` y `gerencia` pueden consultar sesiones globales y usuarios activos.
- RN-AUT-005: La aceptacion LOPDP interna requiere `signature_base64`, `pdf_base64` y bandera de aceptacion.
- RN-AUT-006: Si el consentimiento LOPDP ya fue otorgado (`granted`), la operacion debe responder como ya aceptada sin duplicar evidencia.
- RN-AUT-007: [Funcionalidad detectada en el sistema] El login fuera de horario genera evento de seguridad y notificacion a TI.
- RN-AUT-008: [Funcionalidad detectada en el sistema] El auto clock-in no debe impedir el login si falla el registro de asistencia.

## 10. Dependencias con otros modulos
- Modulo Usuarios (`users`, `departments`, `user_profile`).
- Modulo Talento/Asistencia (`user_attendance_records`).
- Modulo Notificaciones (alertas de seguridad fuera de horario).
- Modulo Auditoria (`logAction`, auditoria de eventos).
- Integracion externa Google OAuth2 y Google Drive.
