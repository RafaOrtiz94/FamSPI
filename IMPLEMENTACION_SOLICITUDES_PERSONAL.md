# Implementación de Solicitudes de Personal con Perfil Profesional

## Resumen

Se ha implementado un sistema completo para gestionar solicitudes de personal con perfil profesional detallado. Esta funcionalidad permite a los jefes de área crear solicitudes de personal especificando el perfil completo del candidato requerido, y a Talento Humano gestionar y aprobar estas solicitudes.

## Componentes Implementados

### Backend

1. **Base de Datos** (`backend/migrations/create_personnel_requests.sql`)
   - Tabla `personnel_requests`: Almacena las solicitudes con perfil profesional completo
   - Tabla `personnel_request_history`: Historial de cambios de estado
   - Tabla `personnel_request_comments`: Comentarios y notas
   - Triggers automáticos para numeración y auditoría

2. **Servicio** (`backend/src/modules/personnel-requests/personnel-requests.service.js`)
   - Crear solicitudes de personal
   - Obtener solicitudes con filtros
   - Actualizar estados
   - Agregar comentarios
   - Estadísticas

3. **Controlador** (`backend/src/modules/personnel-requests/personnel-requests.controller.js`)
   - Endpoints HTTP para todas las operaciones

4. **Rutas** (`backend/src/modules/personnel-requests/personnel-requests.routes.js`)
   - `/api/v1/personnel-requests` - CRUD completo
   - Control de acceso por rol

### Frontend

1. **API Cliente** (`spi_front/src/core/api/personnelRequestsApi.js`)
   - Cliente axios para interactuar con el backend

2. **Formulario de Creación** (`spi_front/src/modules/shared/components/PersonnelRequestForm.jsx`)
   - Formulario multi-paso (4 pasos)
   - Paso 1: Información del puesto
   - Paso 2: Perfil profesional
   - Paso 3: Responsabilidades y funciones
   - Paso 4: Condiciones laborales

3. **Widget para Jefes** (`spi_front/src/modules/shared/components/PersonnelRequestWidget.jsx`)
   - Vista de solicitudes propias
   - Estadísticas rápidas
   - Botón para crear nueva solicitud

4. **Widget para Talento Humano** (`spi_front/src/modules/shared/components/HRPersonnelRequestsWidget.jsx`)
   - Vista de todas las solicitudes
   - Filtros por estado
   - Modal de detalles completos
   - Aprobación/rechazo
   - Sistema de comentarios

## Instalación

### 1. Ejecutar Migración de Base de Datos

Ejecuta el siguiente comando en PostgreSQL (ajusta la ruta según tu instalación):

```bash
# Opción 1: Usando psql desde línea de comandos
psql -U postgres -d spi_db -f "c:\Users\Departamento de TI\Desktop\PROYECTOS\FamSPI\backend\migrations\create_personnel_requests.sql"

# Opción 2: Desde pgAdmin
# 1. Abre pgAdmin
# 2. Conecta a la base de datos spi_db
# 3. Abre Query Tool
# 4. Carga el archivo create_personnel_requests.sql
# 5. Ejecuta el script
```

### 2. Configurar Variables de Entorno

Agrega al archivo `.env` del backend:

```env
# Notificaciones de Talento Humano
HR_NOTIFICATION_EMAILS=rh@empresa.com,talentohumano@empresa.com
```

### 3. Reiniciar el Backend

El backend ya está configurado para cargar las nuevas rutas. Solo necesitas reiniciarlo si estaba corriendo.

## Uso

### Para Jefes de Área

1. **Acceder al Dashboard**: El widget de solicitudes de personal aparece automáticamente en los dashboards de:
   - Jefe Comercial
   - Jefe de Servicio Técnico
   - Otros jefes de área

2. **Crear Solicitud**:
   - Click en "Nueva Solicitud"
   - Completar el formulario de 4 pasos:
     - **Paso 1**: Información básica del puesto (título, tipo, urgencia, justificación)
     - **Paso 2**: Perfil profesional (educación, experiencia, habilidades)
     - **Paso 3**: Responsabilidades y funciones del puesto
     - **Paso 4**: Condiciones laborales (horario, salario, beneficios)
   - Click en "Crear Solicitud"

3. **Ver Solicitudes**: El widget muestra:
   - Estadísticas: Pendientes, En Revisión, Aprobadas, Rechazadas
   - Lista de solicitudes recientes con estado

### Para Talento Humano

1. **Acceder al Dashboard**: El widget aparece en el Dashboard de Talento Humano

2. **Gestionar Solicitudes**:
   - Ver todas las solicitudes con filtros por estado
   - Click en "Ver Detalles" para abrir el modal completo
   - Revisar perfil profesional completo
   - Agregar comentarios
   - Aprobar o rechazar solicitudes
   - Marcar como "En Proceso" o "Completada"

## Estructura de Datos

### Solicitud de Personal

```javascript
{
  // Información del puesto
  position_title: "Analista de Marketing Digital",
  position_type: "permanente", // permanente, temporal, reemplazo, proyecto
  quantity: 1,
  start_date: "2025-12-01",
  urgency_level: "alta", // baja, normal, alta, urgente
  
  // Perfil profesional
  education_level: "Tercer Nivel",
  career_field: "Marketing, Comunicación",
  years_experience: 3,
  specific_skills: "Manejo de redes sociales, diseño gráfico...",
  technical_knowledge: "Adobe Creative Suite, Google Analytics...",
  soft_skills: "Trabajo en equipo, creatividad...",
  certifications: "Google Ads, Facebook Blueprint",
  languages: "Español (nativo), Inglés (avanzado)",
  
  // Responsabilidades
  main_responsibilities: "Gestionar campañas digitales...",
  specific_functions: "Crear contenido, analizar métricas...",
  reports_to: "Gerente de Marketing",
  supervises: "Asistente de Marketing",
  
  // Condiciones laborales
  work_schedule: "Lunes a Viernes 8:00-17:00",
  salary_range: "$800 - $1200",
  benefits: "Seguro médico, bonos...",
  work_location: "Oficina principal",
  
  // Justificación
  justification: "Necesitamos expandir nuestro equipo..."
}
```

## Estados de Solicitud

1. **pendiente**: Solicitud creada, esperando revisión de Talento Humano
2. **en_revision**: Talento Humano está revisando la solicitud
3. **aprobada**: Solicitud aprobada, lista para iniciar proceso de reclutamiento
4. **rechazada**: Solicitud rechazada con motivo
5. **en_proceso**: Proceso de reclutamiento en curso
6. **completada**: Vacante cubierta
7. **cancelada**: Solicitud cancelada

## Permisos por Rol

### Crear Solicitudes
- jefe_comercial
- jefe_servicio
- jefe_operaciones
- jefe_finanzas
- jefe_calidad
- gerente
- admin

### Gestionar Solicitudes (Aprobar/Rechazar)
- talento_humano
- gerente
- admin

### Ver Solicitudes
- Todos los usuarios autenticados (filtrado por pertenencia)

## Notificaciones

Cuando se crea una nueva solicitud:
- Se envía email a los correos configurados en `HR_NOTIFICATION_EMAILS`
- Se intenta primero con Gmail API
- Fallback a SMTP si falla Gmail API

## Próximos Pasos Sugeridos

1. **Integración con Drive**: Subir descripciones de puesto y CVs a carpetas organizadas
2. **Workflow de Aprobaciones**: Agregar aprobación de Gerencia y Finanzas
3. **Dashboard de Métricas**: Tiempo promedio de contratación, tasa de éxito
4. **Plantillas de Perfiles**: Perfiles pre-configurados para puestos comunes
5. **Integración con Portales de Empleo**: Publicación automática de vacantes

## Archivos Modificados/Creados

### Backend
- ✅ `backend/migrations/create_personnel_requests.sql`
- ✅ `backend/src/modules/personnel-requests/personnel-requests.service.js`
- ✅ `backend/src/modules/personnel-requests/personnel-requests.controller.js`
- ✅ `backend/src/modules/personnel-requests/personnel-requests.routes.js`
- ✅ `backend/src/app.js` (agregadas rutas)

### Frontend
- ✅ `spi_front/src/core/api/personnelRequestsApi.js`
- ✅ `spi_front/src/modules/shared/components/PersonnelRequestForm.jsx`
- ✅ `spi_front/src/modules/shared/components/PersonnelRequestWidget.jsx`
- ✅ `spi_front/src/modules/shared/components/HRPersonnelRequestsWidget.jsx`
- ✅ `spi_front/src/modules/talento/Dashboard.jsx` (agregado widget)
- ✅ `spi_front/src/modules/comercial/components/dashboard/JefeComercialView.jsx` (agregado widget)
- ✅ `spi_front/src/modules/servicio/components/dashboard/JefeTecnicoView.jsx` (agregado widget)

## Soporte

Para cualquier duda o problema, contacta al equipo de desarrollo.
