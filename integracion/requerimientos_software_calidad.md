# 📋 REQUERIMIENTOS DE SOFTWARE - MÓDULOS DE CALIDAD FAMSPI

**Proyecto:** Sistema de Gestión de Calidad FAMSPI  
**Versión del Documento:** 1.0  
**Fecha:** 2026-04-16  
**Elaborado Por:** Equipo de Desarrollo FAMSPI  
**Clasificación:** Requerimientos Técnicos y Funcionales  

---

## TABLA DE CONTENIDO

1. [Información General del Proyecto](#1-información-general-del-proyecto)
2. [Alcance del Sistema](#2-alcance-del-sistema)
3. [Definiciones y Abreviaciones](#3-definiciones-y-abreviaciones)
4. [Arquitectura del Sistema](#4-arquitectura-del-sistema)
5. [Requerimientos Funcionales por Módulo](#5-requerimientos-funcionales-por-módulo)
6. [Requerimientos No Funcionales](#6-requerimientos-no-funcionales)
7. [Interfaces de Usuario](#7-interfaces-de-usuario)
8. [Requerimientos de Integración](#8-requerimientos-de-integración)
9. [Seguridad y Permisos](#9-seguridad-y-permisos)
10. [Requerimientos de Datos](#10-requerimientos-de-datos)
11. [Requerimientos de Rendimiento](#11-requerimientos-de-rendimiento)
12. [Regulatorios y de Cumplimiento](#12-regulatorios-y-de-cumplimiento)
13. [Casos de Uso Principales](#13-casos-de-uso-principales)
14. [Matriz de Trazabilidad](#14-matriz-de-trazabilidad)
15. [Glosario](#15-glosario)

---

## 1. INFORMACIÓN GENERAL DEL PROYECTO

### 1.1 Propósito del Sistema

El Sistema de Gestión de Calidad FAMSPI tiene como propósito principal proporcionar una plataforma integral para la administración, control y auditoría de todos los procesos relacionados con la calidad en una organización GXP (Good Practices). Este sistema abarca 17 procedimientos normalizados de calidad que abarcan desde el control de temperatura hasta la tecnovigilancia médica.

### 1.2 Alcance del Proyecto

**Enclude:**
- 17 módulos de gestión de calidad (CA0101-CA0117)
- Dashboard centralizado de calidad
- Gestión documental integrada
- Sistema de reportes y métricas
- Workflows de aprobación
- Integración con sistemas externos (SITRAD, Datalogger)
- Portal de auditorías

**No Incluye:**
- Sistema financiero
- Gestión de nómina
- CRM externo
- SAP/ERP integration

### 1.3 Usuarios Objetivo

| Tipo de Usuario | Roles | Cantidad Estimada |
|---------------|-------|------------------|
| Administrador de Calidad | admin_calidad, jefe_calidad | 5 |
| Coordinador de Área | calidad | 15 |
| Técnico de Calidad | calidad_tecnico | 30 |
| Auditor Interno | calidad, gerencia | 10 |
| Gerente de Planta | gerencia | 5 |
| Técnicos de Áreas | servicio_tecnico, operaciones | 50 |

---

## 2. ALCANCE DEL SISTEMA

### 2.1 Módulos Incluidos

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                        MÓDULOS DEL SISTEMA DE CALIDAD                       │
├────────────────────────────────────────────────────────────────────────────────┤
│ Codigo │ Nombre Modulo                     │ Tipo Proceso   │ Prioridad     │
├────────┼────────────────────────────────────┼────────────────┼──────────────┤
│ CA0101 │ Control de Temperatura            │ Monitoreo     │ CRÍTICA      │
│ CA0102 │ Limpieza de Áreas                  │ Validación     │ ALTA         │
│ CA0103 │ Buenas Prácticas de Manufactura   │ Capacitación  │ MEDIA        │
│ CA0104 │ Control de Plagas                  │ Monitoreo     │ MEDIA        │
│ CA0105 │ Gestión Documental                 │ Administración  │ CRÍTICA      │
│ CA0106 │ Recall                             │ Retiro        │ CRÍTICA      │
│ CA0107 │ Quejas y Reclamos                  │ Atención      │ ALTA         │
│ CA0108 │ Refrigerados                      │ Contingencia  │ CRÍTICA      │
│ CA0109 │ CAPA                               │ Mejora        │ ALTA         │
│ CA0110 │ Gestión de Riesgos                 │Análisis      │ MEDIA        │
│ CA0111 │ Incidentes                        │Respuesta      │ ALTA         │
│ CA0112 │ Higiene Personal                  │ Validación    │ MEDIA        │
│ CA0113 │ Comunicaciones                       │ Información   │ BAJA         │
│ CA0114 │ Áreas Calificadas                  │ Calificación  │ ALTA         │
│ CA0115 │ Auditorías                        │ Verificación  │ CRÍTICA      │
│ CA0116 │ Muestreo y Aprobación              │ Liberación    │ ALTA         │
│ CA0117 │ Tecnovigilancia                    │ Regulación    │ CRÍTICA      │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Funcionalidades Core del Sistema

1. **Gestión de Registros**
   - Create, Read, Update, Delete de registros por módulo
   - Workflow de estados con transiciones controladas
   - Versionamiento de registros

2. **Autenticación y Autorizaciones**
   - Login con credentials o Google SSO
   - RBAC granular por módulo y por acción
   - Autenticación de dos factores (TOTP)

3. **Reporting y Métricas**
   - Dashboard ejecutivo por módulo
   - Métricas agregadas globales
   - Exportación a PDF, Excel

4. **Integración Externa**
   - API SITRAD para temperatura
   - Parser Datalogger
   - Google Maps para geolocalización

---

## 3. DEFINICIONES Y ABREVIACIONES

### 3.1 Términos Clave

| Término | Definición |
|---------|------------|
| GXP | Good Practices ( GMP, GLP, GCP, etc.) |
| CA | Código de Área / Procedimiento |
| CAPA | Corrective Action Preventive Action |
| CRM | Customer Relationship Management |
| RBAC | Role-Based Access Control |
| SSO | Single Sign-On |
| TOTP | Time-based One-Time Password |
| WHO | World Health Organization |
| FDA | Food and Drug Administration |
| ISO | International Organization for Standardization |
| BPM | Buenas Prácticas de Manufactura |
| HACCP | Hazard Analysis Critical Control Point |
| COA | Certificate of Analysis |

### 3.2 Abreviaciones Técnicas

| Abreviatura | Significado |
|-------------|------------|
| API | Application Programming Interface |
| JWT | JSON Web Token |
| RBAC | Role-Based Access Control |
| CRUD | Create, Read, Update, Delete |
| ORM | Object-Relational Mapping |
| SSR | Server-Side Rendering |
| CSR | Client-Side Rendering |
| PWA | Progressive Web App |
| WCAG | Web Content Accessibility Guidelines |
| A11y | Accessibility |
| SEO | Search Engine Optimization |

---

## 4. ARQUITECTURA DEL SISTEMA

### 4.1 Stack Tecnológico

| Capa | Tecnología | Versión |
|------|------------|---------|
| Frontend Framework | React | 19.x |
| State Management | TanStack Query v5 | 5.x |
| UI Framework | Tailwind CSS | 3.x |
| Icons | React Icons | 5.x |
| Forms | React Hook Form | 7.x |
| PDF Generation | jsPDF | 3.x |
| Date Handling | date-fns | 4.x |
| Backend Runtime | Node.js | LTS |
| API Framework | Express | 4.x |
| Database | PostgreSQL | 15.x |
| Authentication | JWT + Refresh Token | Custom |
| File Storage | Google Drive API | v3 |

### 4.2 Arquitectura de Capas

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                    │
│  │   Pages     │   │ Components  │   │   Hooks     │                    │
│  │ (Workspaces)│   │ (UI Kit)   │   │ (Queries)  │                    │
│  └─────────────┘   └─────────────┘   └─────────────┘                    │
├─────────────────────────────────────────────────────────────────────────┤
│                      STATE MANAGEMENT                                   │
│  ┌─────────────┐   ┌─────────────┐                                        │
│  │ React Query │   │  Context   │   ← TanStack Query + State           │
│  │ (Server)    │   │  (Local)   │                                        │
│  └─────────────┘   └─────────────┘                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                      CORE SERVICES                                      │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                    │
│  │  API       │   │   Auth      │   │   UI        │                    │
│  │  Client   │   │  Provider  │   │  Provider  │                    │
│  └─────────────┘   └─────────────┘   └─────────────┘                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      BACKEND (Node.js + Express)                        │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                    │
│  │  Routes    │   │Controllers │   │ Middleware  │                    │
│  │(Express)   │   │ (Lógica)   │   │ (Auth/JWT)  │                    │
│  └─────────────┘   └─────────────┘   └─────────────┘                    │
├─────────────────────────────────────────────────────────────────────────┤
│                      SERVICE LAYER                                     │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                    │
│  │  Services   │   │StateMachine │   │   Helper    │                    │
│  │ (Negocio)   │   │(Workflows) │   │  Utilities  │                    │
│  └─────────────┘   └─────────────┘   └─────────────┘                    │
├─────────────────────────────────────────────────────────────────────────┤
│                      REPOSITORY LAYER                                   │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                    │
│  │ Repositories│   │  Queries   │   │ Migrations  │                    │
│  │  (CRUD)     │   │ (Raw SQL)  │   │  (Schema)   │                    │
│  └─────────────┘   └─────────────┘   └─────────────┘                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────��──────┐
│                      DATABASE (PostgreSQL)                             │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Diagrama de Integración

```
┌──────────────────┐     ┌──────────────────┐
│   User Browser  │────▶│  Load Balancer  │
└──────────────────┘     └────────┬────────┘
                                  │
        ┌─────────────────────────┼─────────────────────┐
        ▼                       ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  CDN/Cloud   │    │  Static UI   │    │  API Server  │
│   (AWS)      │    │   (Build)    │    │  (Node.js)   │
└───────────────┘    └───────────────┘    └──────┬──────┘
                                               │
                    ┌──────────────────────────┼──────────────────┐
                    ▼                          ▼                  ▼
           ┌───────────────┐         ┌───────────────┐     ┌───────────────┐
           │ PostgreSQL    │         │    Redis      │     │  External    │
           │   (Primary)   │◀──────▶│   (Cache)     │     │   APIs       │
           └───────────────┘         └───────────────┘     └───────────────┘
                                                                  │
                                                                  ▼
                    ┌───────────────────────────────────────────────────┐
                    │               EXTERNAL APIS                        │
                    ├─────────────┬─────────────┬───────────────────────┤
                    │   SITRAD    │  Datalogger │   Google Drive      │
                    │  (Temp)    │  (Logger)    │   (Files)            │
                    └─────────────┴─────────────┴───────────────────────┘
```

---

## 5. REQUERIMIENTOS FUNCIONALES POR MÓDULO

### 5.1 Requerimientos Comunes (Todos los Módulos)

| Req.ID | Descripción | Prioridad | Tipo |
|--------|-------------|----------|------|
| CORE-001 | Como usuario, quiero iniciar sesión con credenciales para acceder al sistema | CRÍTICA | Autenticación |
| CORE-002 | Como usuario, quiero cerrar sesión de forma segura | CRÍTICA | Autenticación |
| CORE-003 | Como usuario, quiero recuperar mi contraseña por email | ALTA | Autenticación |
| CORE-004 | Como usuario, quiero ver todos los módulos de calidad en un dashboard | CRÍTICA | Navegación |
| CORE-005 | Como usuario, quiero acceder a un módulo específico desde el dashboard | CRÍTICA | Navegación |
| CORE-006 | Como usuario, quiero buscar registros dentro de un módulo | ALTA | Búsqueda |
| CORE-007 | Como usuario, quiero filtrar registros por estado/fecha/tipo | ALTA | Filtrado |
| CORE-008 | Como usuario, quiero exportar registros a PDF | MEDIA | Exportación |
| CORE-009 | Como usuario, quiero exportar registros a Excel | MEDIA | Exportación |
| CORE-010 | Como usuario, quiero ver métricas agregadas del módulo | ALTA | Reporting |
| CORE-011 | Como administrador, quiero gestionar usuarios del sistema | CRÍTICA | Administración |
| CORE-012 | Como administrador, quiero configurar permisos por rol | CRÍTICA | Seguridad |
| CORE-013 | Como usuario, quiero recibir notificaciones en tiempo real | MEDIA | Notificaciones |

### 5.2 CA0101 - Control de Temperatura

| Req.ID | Descripción | Prioridad | Tipo |
|--------|-------------|----------|------|
| CA0101-001 | Como usuario, quiero ver el dashboard de temperatura en tiempo real | CRÍTICA | Visualización |
| CA0101-002 | Como usuario, quiero registrar una lectura de temperatura manualmente | CRÍTICA | Registro |
| CA0101-003 | Como usuario, quiero recibir alertas cuando la temperatura exceda límites siempre y cuando el hardware me lo permita | CRÍTICA | Alerta |
| CA0101-004 | Como usuario, quiero evaluar una alarma de temperatura | CRÍTICA | Workflow |
| CA0101-005 | Como usuario, quiero escalar una alarma al departamento apropiado | CRÍTICA | Workflow |
| CA0101-006 | Como usuario, quiero cerrar una alarma con evidencia | CRÍTICA | Registro |
| CA0101-007 | Como usuario, quiero ver el histórico de temperaturas | ALTA | Reporting |
| CA0101-008 | Como usuario, quiero generar un reporte PDF de cadena térmica | ALTA | Reporting |
| CA0101-009 | Como administrador, quiero integrar con sensores Datalogger buscando un metodo real de extraccion de la informacion de los datallogers a SPI | MEDIA | Integración |
| CA0101-010 | Como administradores, quiero integrar datos de SITRAD API si corresponde segun la version o a su vez crear la herramienta correspondeinte en windows para conectarla | MEDIA |Integración |

### 5.3 CA0105 - Gestión Documental

| Req.ID | Descripción | Prioridad | Tipo |
|--------|-------------|----------|------|
| CA0105-001 | Como usuario, quiero crear una carpeta documental | CRÍTICA | Creación |
| CA0105-002 | Como usuario, quiero subir documentos PDF/Word/Excel | CRÍTICA | Archivo |
| CA0105-003 | Como usuario, quiero versionar un documento | CRÍTICA | Versionamiento |
| CA0105-004 | Como usuario, quiero aprobar un documento mediante workflow | CRÍTICA | Workflow |
| CA0105-005 | Como usuario, quiero buscar documentos por contenido | ALTA | Búsqueda |
| CA0105-006 | Como usuario, quiero establecer permisos de acceso granular | ALTA | Seguridad |
| CA0105-007 | Como usuario, quiero ver el árbol de documentación | MEDIA | Visualización |
| CA0105-008 | Como administrador, quiero crear plantillas de documentos | MEDIA | Administración |

### 5.4 CA0115 - Auditorías

| Req.ID | Descripción | Prioridad | Tipo |
|--------|-------------|----------|------|
| CA0115-001 | Como usuario, quiero crear un plan de auditoría | CRÍTICA | Registro |
| CA0115-002 | Como usuario, quiero crear checklist de auditoría | CRÍTICA | Registro |
| CA0115-003 | Como usuario, quiero registrar Hallazgos (NC, OFI, Obs) | CRÍTICA | Registro |
| CA0115-004 | Como usuario, quiero adjuntar evidencias (fotos/PDFs) a hallazgos | ALTA | Archivo |
| CA0115-005 | Como usuario, quiero asignar acciones correctivas a hallazgos | CRÍTICA | Integración |
| CA0115-006 | Como usuario, quiero hacer seguimiento de acciones correctivas | ALTA | Tracking |
| CA0115-007 | Como usuario, quiero cerrar una auditoría con informe final | CRÍTICA | Workflow |
| CA0115-008 | Como usuario, quiero exportar el informe de auditoría a PDF | ALTA | Reporting |
| CA0115-009 | Como usuario, quiero métricas de auditoría por período | MEDIA | Reporting |

### 5.5 CA0117 - Tecnovigilancia

| Req.ID | Descripción | Prioridad | Tipo |
|--------|-------------|----------|------|
| CA0117-001 | Como usuario, quiero registrar un evento adverso | CRÍTICA | Registro |
| CA0117-002 | Como usuario, quiero investigar un evento adverso | CRÍTICA | Workflow |
| CA0117-003 | Como usuario, quiero crear acciones correctivas | CRÍTICA | Integración |
| CA0117-004 | Como usuario, quiero reportar a las autoridades regulatorias (FDA) | CRÍTICA |Reporting |
| CA0117-005 | Como usuario, quiero hacer seguimiento del caso | ALTA | Tracking |
| CA0117-006 | Como usuario, quiero métricas de eventos adversos | MEDIA | Reporting |

**Nota:** Para los módulos restantes (CA0102-CA0116), aplican principios similares con campos específicos del procedimiento.

---

## 6. REQUERIMIENTOS NO FUNCIONALES

### 6.1 Requerimientos de Rendimiento

| Req.ID | Métrica | Target | Condición |
|--------|--------|--------|-----------|
| REND-001 | Tiempo de carga inicial | <3 segundos | Conexión 4G |
| REND-002 | Tiempo de respuesta API | <500ms | P95 |
| REND-003 | Time to Interactive | <2 segundos | Lighthouse |
| REND-004 | Bundle size inicial | <250 KB gzipped | Después de code splitting |
| REND-005 | Memoria heap usage | <100 MB | En aplicación activa |
| REND-006 | DB query time | <100ms | P95 queries complejas |

### 6.2 Requerimientos de Escalabilidad

| Req.ID | Métrica | Target |
|--------|--------|--------|
| ESC-001 | Usuarios concurrentes | 200 usuarios simultáneos |
| ESC-002 | Requests por segundo | 100 RPS sostenidos |
| ESC-003 | Tamaño de DB | Soportar 10 años de datos |
| ESC-004 | Archivos storage | 100 GB inicialmente |

### 6.3 Requerimientos de Seguridad

| Req.ID | Descripción | Target |
|--------|------------|--------|
| SEG-001 | SSL/TLS | Todas las conexiones |
| SEG-002 | JWT expiry | Access: 15 min, Refresh: 7 días |
| SEG-003 | Password policy | Mayúscula, número, símbolo, 8+ chars |
| SEG-004 | Session timeout | 30 minutos inactividad |
| SEG-005 | Rate limiting | 100 requests/minuto por IP |
| SEG-006 | Audit logging | Todas las transacciones |

### 6.4 Requerimientos de Disponibilidad

| Req.ID | Descripción | Target |
|--------|------------|--------|
| DISP-001 | Uptime | 99.5% mensual |
| DISP-002 | Recovery Time Object (RTO) | <4 horas |
| DISP-003 | Recovery Point Object (RPO) | <1 hora |
| DISP-004 | Backup frequency | Cada 6 horas |

### 6.5 Requerimientos de Accesibilidad

| Req.ID | Estándar | Target |
|--------|---------|--------|
| A11Y-001 | WCAG 2.1 Level AA | Cumplimiento mínimo |
| A11Y-002 | Contraste texto | Ratio 4.5:1 mínimo |
| A11Y-003 | Navegación keyboard | Todos los elementos |
| A11Y-004 | Screen reader | NVDA/JAWS compatible |
| A11Y-005 | Focus management | Todos los modales |

---

## 7. INTERFACES DE USUARIO

### 7.1 Requerimientos de UI

| Req.ID | Descripción | Target |
|--------|------------|--------|
| UI-001 | Responsive design | Mobile, Tablet, Desktop |
| UI-002 | Dark mode toggle | Preferencias de usuario |
| UI-003 | Loading skeletons | Todos los componentes |
| UI-004 | Empty states | Todos los listados |
| UI-005 | Error states | Todos los formularios |
| UI-006 | Confirm dialogs | Todas las acciones destructivas |

### 7.2 Componentes UI Requeridos

1. **CAStepper** - Componente stepper genérico
   - Estados: pending, active, completed, error
   - Orientación: horizontal (desktop), vertical (mobile)
   - Animaciones suaves

2. **CARecordTable** - Tabla de registros
   - Sorting por columnas
   - Filtradoadvanced
   - Paginación (25, 50, 100 items)
   - Export CSV/PDF
   - Selection multiple

3. **CAAuthModal** - Modal de autenticación
   - PIN de 6 dígitos
   - Password como backup
   - Timeout warning

4. **CARecordCard** - Card de registro
   - Estados vis明显
   - Actions inline
   - Expandible details

5. **CAWorkspace** - Layout workspace base
   - Header con breadcrumbs
   - Sidebar con menú
   - Content área
   - Footer contextual

---

## 8. REQUERIMIENTOS DE INTEGRACIÓN

### 8.1 API SITRAD

| Endpoint | Frecuencia | Datos |
|----------|-----------|-------|
| GET /temperaturas | 5 minutos | Readings temporales |
| GET /alarmas | Tiempo real | alertas activas |

### 8.2 Datalogger

| Formato | Frecuencia | Puerto |
|---------|-----------|--------|
| CSV/JSON | 1 minuto | FTP push |

### 8.3 Google Drive

| Operación | Uso |
|-----------|-----|
| POST /files | Guardar documentos |
| GET /files | Listar adjuntos |
| DELETE /files | Eliminar archivos |

---

## 9. SEGURIDAD Y PERMISOS

### 9.1 Matriz de Permisos

| Rol | CA0101 | CA0102 | CA0103 | CA0104 | CA0105 | CA0106 | CA0107 | CA0108 | CA0109 | CA0110 | CA0111 | CA0112 | CA0113 | CA0114 | CA0115 | CA0116 | CA0117 |
|-----|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|
| admin | CRUDR | CRUDR | CRUDR | CRUDR | CRUDR | CRUDR | CRUDR | CRUDR | CRUDR | CRUDR | CRUDR | CRUDR | CRUDR | CRUDR | CRUDR | CRUDR | CRUDR |
| jefe_calidad | RUDR | RUDR | R | R | CRUD | RUD | RUD | RUDR | RUDR | RUDR | RUD | R | R | RUDR | RUD | RUDR | RUDR |
| calidad | R | R | R | R | R | R | R | R | R | R | R | R | R | R | R | R | R | R |
| auditor | R | - | R | R | R | R | R | - | R | - | R | - | - | R | R | - | R |
| operations | R | R | R | R | R | - | R | R | - | - | R | R | - | - | - | R | - |

**Leyenda:**
- C = Create
- R = Read
- U = Update
- D = Delete
- (espacio) = Sin acceso

---

## 10. REQUERIMIENTOS DE DATOS

### 10.1 Modelo de Datos Principal

**Tabla: calidad_registros (Genérica)**

| Campo | Tipo | Restricciones |
|-------|------|--------------|
| id | UUID | PK, auto-generated |
| modulo | VARCHAR(10) | NOT NULL, CA0101-CA0117 |
| estado | VARCHAR(20) | NOT NULL, FK estados |
| titulo | TEXT | NOT NULL |
| descripcion | TEXT | Nullable |
| data | JSONB | Flexible |
| created_by | UUID | FK users |
| updated_by | UUID | FK users |
| created_at | TIMESTAMP | NOT NULL |
| updated_at | TIMESTAMP | NOT NULL |

### 10.2Tablas de Auditoría

| Tabla | Propósito |
|------|----------|
| calidad_audit_log | Tracking de cambios |
| calidad_sessions | Sesiones activas |
| calidad_api_logs | Integraciones |

---

## 11. REQUERIMIENTOS DE RENDIMIENTO

| Escenario | Target | Métrica |
|-----------|--------|---------|
| Login | <500ms | Tiempo respuesta |
| Carga módulo | <3s | Time to Interactive |
| Búsqueda 1000 regs | <1s | renderizado tabla |
| Export PDF 100 regs | <5s | Generación archivo |
| API calls | <200ms | P95 latencia |

---

## 12. REQUERIMIENTOS REGULATORIOS

| Estándar | Requisito | Cumplimiento | Target Fecha |
|---------|----------|-------------|-------------|
| FDA 21 CFR Part 11 | Firmas electrónicas | ❌ | Q3 2026 |
| ISO 9001:2015 | Auditorías | ⚠️ Parcial | Q2 2026 |
| BPM WHO | GXP | ⚠️ Parcial | Q2 2026 |
| HACCP | Análisis | ❌ | Q4 2026 |

---

## 13. CASOS DE USO PRINCIPALES

### CU-001: Registro de Temperatura
```
Actor: Técnico de Calidad
Flujo:
1. Acceder a CA0101 (Temperatura)
2. Seleccionar área/sensor
3. Ingresar lectura actual
4. Validar dentro de rango
5. Guardar registro
6. Verificar SI es alarma -> Ir CU-002
```

### CU-002: Escalado de Alarma
```
Actor: Coordinador
1. Recibir notificación de alarma
2. Visualizar detalles
3. Evaluar severidad
4. Seleccionar departamento destino
5. Agregar comentarios
6. Escalar
7. Cerrar tarea
```

### CU-003: Aprobación de Documento
```
Actor: Jefe de Calidad
1. Ir a CA0105 (Gestión Documental)
2. Buscar documento
3. Revisar contenido
4. Aprobar/Rechazar con comentarios
5. Si aprobado -> Versionar
6. Notificar autor
```

---

## 14. MATRIZ DE TRAZABILIDAD

| ID Requerimiento | Módulo | Prioridad | Estado | Sprint |
|-----------------|--------|---------|--------|--------|
| CORE-001 a CORE-013 | Todos | CRÍTICA | En Desarrollo | Sprint 1-2 |
| CA0101-001 a CA0101-010 | CA0101 | CRÍTICA | 85% Completo | Sprint 2 |
| CA0105-001 a CA0105-008 | CA0105 | CRÍTICA | 80% Completo | Sprint 3 |
| CA0115-001 a CA0115-009 | CA0115 | CRÍTICA | 85% Completo | Sprint 3 |

---

## 15. GLOSARIO

| Término | Definición |
|--------|------------|
| GXP | Good Practices - Familia de estándares de calidad |
| RBAC | Role-Based Access Control |
| Workflow | Secuencia de pasos predefinidos |
| State Machine | Modelo de estados y transiciones |
| State | Condición actual de un registro |
| Estado | Fase del workflow |
| Transición | Cambio de un estado a otro |
|Hallazgo | Resultado de una auditoría |
| NC | No Conformidad |
| OFI | Oportunidad de Mejora |
| Obs | Observación |

---

*Documento de requerimientos elaborado según estándares IEEE 830*  
*Versión: 1.0*  
*Fecha de elaboración: 2026-04-16*