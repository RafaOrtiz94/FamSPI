# Plan - Expediente Centralizado de Talento Humano

## Objetivo
Centralizar la fuente de verdad del expediente de colaborador en el dominio activo de Talento Humano para que cualquier actualización realizada desde `Mi Perfil` o desde el workspace de Talento Humano se refleje en los tabs `Ficha`, `Documentos`, `Checklist` y vistas relacionadas sin duplicidad ni sincronizaciones frágiles.

## Fuente de verdad
La fuente de verdad quedará centralizada en estructuras del dominio de Talento Humano:

- `collaborator_profiles`
  - Fuente única de `Ficha`
  - Datos personales, familiares, domicilio, emergencia, laborales y estudios estructurados
- `collaborator_documents`
  - Fuente única de `Documentos`
  - Documentos del colaborador, Talento Humano y Financiero
  - También alimenta la completitud documental del checklist
- `collaborator_qualifications` `nueva`
  - Fuente única de registros múltiples de credenciales
  - Títulos de 3er nivel
  - Títulos de 4to nivel
  - Certificaciones
  - Registro SENESCYT

## Fuera de la fuente de verdad HR
- `user_profile`
  - Solo avatar y preferencias UI
- `user_certifications`
  - Deja de ser fuente de verdad HR
  - Se migra o desactiva gradualmente como origen de datos del expediente

## Regla operativa
- Si el colaborador actualiza desde `Mi Perfil`, el write va a estructuras centrales de Talento Humano.
- Si Talento Humano actualiza desde el workspace, el write va a esas mismas estructuras.
- `Ficha`, `Documentos`, `Checklist`, contratación y vistas limitadas consumen solo esas estructuras centrales.

## Alcance funcional confirmado

### Documentos cargados por el colaborador desde Perfil
- Documento de Identidad
- Pasaporte
- Certificado de votación
- Servicio Básico Domicilio
- Acta de matrimonio
- Partida de nacimiento/cedula hijos
- Registro SENESCYT
- Curriculum vitae
- Títulos 3er nivel, múltiples
- Títulos 4to nivel, múltiples
- Certificaciones, múltiples con metadata y archivo

### Documentos cargados por Talento Humano
- Certificados Laborales
- Contrato FAM
- Contrato MDT
- IESS Aviso de entrada
- Acción del Personal
- Registro de Inducción
- Control de firmas
- Convenio de Confidencialidad
- Autorización de uso de imagen
- Acumulación / Mensualización décimos y fondos de reserva
- Hoja de vida

### Documentos cargados por Financiero
- Autorización de descuentos en roles

### Actas pendientes de integración automática
- Acta de entrega de herramientas de comunicación
- Acta de entrega de herramientas de logística
- Acta de entrega de herramientas de trabajo
- Acta de entrega de ropa de trabajo
- Acta de entrega de EPP

### Documentos eliminados del modelo operativo
- Carnet
- Certificado de nacimiento
- Foto tamaño carnet
- Historial laboral del IESS
- Oferta de salario firmada
- Compromiso de erradicación de discriminación

## Validación de evidencia en Neon
Validado en Neon con `gcloud secrets versions access latest --secret=DB_PASSWORD --project=famspi-sbox` y configuración activa de Cloud Run `spi-backend`.

### Tablas y estado actual relevante
- `collaborator_profiles`
  - Existe
  - `user_id` único
  - `profile JSONB`
- `collaborator_documents`
  - Existe
  - Sin clasificación por origen, área o grupo
- `personnel_request_profiles`
  - Existe
  - Fuente temporal de contratación
- `personnel_request_documents`
  - Existe
  - Fuente temporal de contratación
- `user_profile`
  - Existe
  - Hoy mezcla avatar/preferencias con metadata que contiene parte de datos HR
- `user_certifications`
  - Existe
  - Hoy almacena títulos/certificaciones fuera del dominio central de TH

### Hallazgo clave
El problema principal no es ausencia de tablas sino dispersión del expediente entre `user_profile`, `user_certifications`, `collaborator_profiles` y `collaborator_documents`.

## Modelo canónico objetivo

### 1. `collaborator_profiles`
Mantener como JSONB canónico de ficha.

Uso esperado:
- `personal`
- `laboral`
- `familiar`
- `domicilio`
- `emergencia`
- `estudios` solo para campos simples o derivados
- `onboarding`

Nota:
- Las listas múltiples de títulos/certificaciones no deben quedar como arrays arbitrarios dentro del JSONB si existe tabla dedicada.

### 2. `collaborator_documents`
Extender la tabla para clasificar documentos y soportar vistas limitadas sin duplicar lógica.

Campos nuevos propuestos:
- `category`
- `subtype`
- `owner_area`
- `source_channel`
- `visibility_scope`
- `group_key`
- `sort_order`
- `is_required`
- `is_active`

### 3. `collaborator_qualifications`
Nueva tabla del dominio TH para múltiples registros.

Campos propuestos:
- `id`
- `user_id`
- `qualification_type`
- `title`
- `institution`
- `issuer`
- `issue_date`
- `expiry_date`
- `registration_number`
- `metadata`
- `drive_file_id`
- `drive_url`
- `file_name`
- `mime_type`
- `uploaded_by`
- `is_active`
- `created_at`
- `updated_at`

Tipos iniciales:
- `third_level_title`
- `fourth_level_title`
- `certification`
- `senescyt_record`

## Plan por fases

### Fase 1 - Modelo canónico
Objetivo:
- Congelar la arquitectura final
- Definir catálogo documental
- Definir tabla `collaborator_qualifications`
- Definir extensión de `collaborator_documents`

Entregables:
- Este plan
- Migración no destructiva de Phase 1

Estado:
- Iniciado

### Fase 2 - Validación de schema en Neon
Objetivo:
- Confirmar diferencias exactas entre el modelo actual y el deseado
- Identificar índices, constraints y posibles conflictos

Entregables:
- Delta validado contra `information_schema` y `pg_indexes`
- Confirmación de tablas reutilizables

Estado:
- Iniciado y validado

### Fase 3 - Migración de schema
Objetivo:
- Crear `collaborator_qualifications`
- Extender `collaborator_documents`
- No ejecutar cambios destructivos todavía

Entregables:
- SQL idempotente en `backend/migrations/206_talento_humano_expediente_centralization_phase1.sql`

Estado:
- Iniciado

### Fase 4 - Migración de datos
Objetivo:
- Mover metadata HR desde `user_profile.metadata` a `collaborator_profiles`
- Mover títulos/certificaciones desde `user_certifications` a `collaborator_qualifications`
- Conservar `user_profile` solo para avatar y preferencias

Entregables:
- Script o migración de backfill
- Validación en Neon

Estado:
- Pendiente

### Fase 5 - Backend central de Talento Humano
Objetivo:
- Actualizar `collaborators`
- Actualizar `personnel-requests`
- Recalcular `Ficha`, `Documentos` y `Checklist` desde la nueva fuente única

Estado:
- En progreso

### Fase 6 - Autoservicio de Perfil
Objetivo:
- `Mi Perfil` deja de escribir HR en `user_profile.metadata`
- Reescribir para usar el expediente central

Estado:
- En progreso

### Fase 7 - Frontend del workspace activo
Objetivo:
- Refactor de `Ficha`
- Refactor de `Documentos`
- Refactor de `Checklist`
- Modales de Contrato e Inducción
- Vista limitada por área dentro del mismo workspace

Estado:
- En progreso

### Fase 8 - Deprecación de fuentes paralelas
Objetivo:
- Dejar `user_profile` solo para avatar/preferencias
- Sacar a `user_certifications` del flujo HR

Estado:
- Pendiente

## Archivos principales afectados

### Backend
- `backend/src/modules/collaborators/collaborators.service.js`
- `backend/src/modules/personnel-requests/personnel-requests.service.js`
- `backend/src/modules/user-profile/userProfile.service.js`
- `backend/src/modules/user-certifications/userCertifications.service.js`
- `backend/migrations/206_talento_humano_expediente_centralization_phase1.sql`

### Frontend
- `spi_front/src/modules/talento/components/collaboratorProfileDefinitions.js`
- `spi_front/src/modules/talento/components/workspace/PersonnelProfile.jsx`
- `spi_front/src/modules/talento/components/workspace/PersonnelDocuments.jsx`
- `spi_front/src/modules/talento/components/workspace/PersonnelChecklist.jsx`
- `spi_front/src/modules/talento/pages/CollaboratorCommandCenter.jsx`
- `spi_front/src/modules/profile/MyProfilePage.jsx`
- `spi_front/src/modules/profile/components/CertificationsBoard.jsx`

## Riesgos a controlar
- Dejar writes viejos hacia `user_profile.metadata`
- Dejar `Checklist` calculando con tipos documentales obsoletos
- Duplicar datos entre `user_certifications` y `collaborator_qualifications`
- Romper contratación por validaciones antiguas de completitud
- Mezclar visibilidad por área con permisos backend sin alineación

## Criterio de éxito
- Un solo expediente HR por colaborador
- Cualquier cambio desde Perfil aparece en TH sin sincronización secundaria
- `Ficha`, `Documentos` y `Checklist` leen del mismo origen
- TH, colaborador y Financiero trabajan sobre el mismo expediente con distinta visibilidad
- No quedan fuentes paralelas para datos HR
## Estado actual
- Completado: validacion del workspace activo, backend real, frontend real y Neon productivo.
- Completado: definicion del modelo centralizado con `collaborator_profiles`, `collaborator_documents` y `collaborator_qualifications`.
- Completado: borrador de migracion `206_talento_humano_expediente_centralization_phase1.sql`.
- Completado: catalogo canonico de documentos y normalizacion backend para dejar de depender de tipos legacy dispersos.
- Completado: doble escritura y lectura centralizada para credenciales desde `user-certifications` hacia `collaborator_qualifications`.
- Completado: `Mi Perfil` ya deja de persistir campos HR en `user_profile.metadata` y escribe esos campos al expediente central `collaborator_profiles`.
- Completado: el workspace de colaboradores deja de replicar ficha HR a `user_profile`, manteniendo la centralizacion del write.
- Completado: documentos autoservicio desde `Mi Perfil` hacia `collaborator_documents`.
- Completado: el workspace activo ya hidrata tipos documentales canónicos para checklist y validación de contratos obligatorios.
- Completado: la ficha activa ya visualiza credenciales centralizadas desde `collaborator_qualifications` sin abrir una segunda fuente de edición.
- Completado: en colaboradores activos la ficha deja de exponer campos legacy simples de títulos y pasa a mostrar el bloque centralizado; en solicitudes se conserva temporalmente el formato simple por dependencia de `personnel_request_profiles`.
- Completado: los componentes frontend nuevos ajustados en esta fase se revisaron contra `DESIGN.md` y se alinearon al estándar visual base.
- Completado: `Mi Perfil` ahora captura credenciales con categorías explícitas alineadas al modelo central (`third_level_title`, `fourth_level_title`, `certification`) en lugar de depender de un selector legacy ambiguo.
- Completado: la carga individual de credenciales ya serializa y parsea `metadata` correctamente para que backend pueda clasificar sin ambigüedad el tipo de credencial centralizada.
- Completado: `Registro SENESCYT` queda tratado como documento en `Mi Perfil` y en el workspace de Talento Humano; se excluye del board de credenciales para no mezclar documentos con calificaciones.
- Completado: el workspace activo ya soporta vista limitada por área dentro del mismo command center, filtrando tabs, checklist, documentos y acciones primarias según el alcance operativo del rol sin crear una segunda interfaz.
- Completado: el workspace activo ya expone las cinco actas automáticas del expediente central dentro de `Documentos`, agrupadas por bloque operativo y en modo de visualización sin carga manual desde Talento Humano.
- Completado: `Contratos`, `Induccion` y `Actas automaticas` ya funcionan como bloques modales dentro del tab `Documentos` del workspace activo, manteniendo el resto del expediente en la misma vista centralizada.
- Completado: `collaborators.service` ya deja de usar `user_certifications` para resúmenes de listados y métricas del workspace; esas vistas ahora toman su estado de `collaborator_qualifications`.
- Completado: el cálculo de completitud de ficha en el workspace activo ya no exige los cuatro campos legacy de títulos/universidades simples, evitando falsos pendientes después de mover estudios al bloque central de calificaciones.
- Completado: `user-certifications.service` ya consume `collaborator_qualifications` como fuente principal para listados, dossier exportado y eliminación lógica; `user_certifications` queda solo como compatibilidad transitoria y espejo durante la migración.
- Completado: la carga masiva de credenciales ya retorna el registro completo legacy antes de sincronizar al expediente central, evitando altas parciales en `collaborator_qualifications`.
- Completado: el workspace activo ya expone dentro de la ficha los registros legacy de credenciales que siguen sin migrarse, con motivo de revisión manual, en lugar de ocultarlos o asumir una clasificación no verificada.
- Validado en Neon: al 2026-06-17 existen `7` registros activos en `user_certifications`, `4` ya enlazados a `collaborator_qualifications` y `3` pendientes manuales por falta de nivel explícito o por requerir reclasificación documental.
- Completado: `personnel_request_profiles` ya separa `qualifications` del `profile` JSONB y el flujo de contratación migra esos títulos temporales a `collaborator_qualifications` en lugar de seguir contaminando `collaborator_profiles` con campos simples de estudios.
- Completado: el workspace de solicitudes ya puede devolver `qualifications` desde backend sin requerir cambios de interfaz adicionales, manteniendo compatibilidad temporal con el formulario legacy de pre-contratación.
- Completado: el workspace activo ya permite resolver pendientes legacy de credenciales desde Talento Humano sin SQL manual, soportando `migrate_qualification` para títulos y `reclassify_document` para mover SENESCYT a `collaborator_documents`.
- Completado: la ficha detallada de colaboradores ya no usa `user_certifications` como fallback de lectura; las calificaciones visibles salen solo de `collaborator_qualifications` y los remanentes se exponen aparte como pendientes de migración.
- Completado: el formulario de solicitudes ya desacopla visualmente los estudios del perfil simple y captura credenciales temporales en `qualifications`, que luego se migran al expediente central en la contratación.
- Pendiente operativo externo: resolver en datos productivos los dos títulos legacy restantes que no tienen nivel académico verificable; el sistema ya expone la acción manual, pero no se clasificaron automáticamente para evitar asumir 3er o 4to nivel.
- Regla aplicada al backfill: los `title` legacy sin evidencia explicita de 3er o 4to nivel no se migran automaticamente para evitar clasificacion asumida.
