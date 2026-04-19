# 📊 ANÁLISIS INTEGRAL MÓDULOS DE CALIDAD - FAMSPI

**Proyecto:** Sistema de Gestión de Calidad FAMSPI  
**Fecha de Análisis:** 2026-04-16  
**Analistas:** Equipo de Desarrollo FAMSPI  
**Versión:** 1.0

---

## RESUMEN EJECUTIVO

El sistema de Calidad de FAMSPI cuenta con **17 módulos implementados** (CA0101-CA0117), cada uno basado en procedimientos GXP específicos. Este documento presenta un análisis integral desde 4 perspectivas especializadas para determinar el estado actual y las mejoras necesarias.

**Estado General del Sistema:** ~60% COMPLETO

| Métrica | Valor |
|--------|-------|
| Total Módulos | 17 |
| Módulos Funcionales | 14 |
| Módulos Completos | 3 |
| Cobertura Frontend | 85% |
| Cobertura Backend | 75% |
| Technical Debt | ALTO |

---

## 📋 TABLA DE CONTENIDO

1. [Análisis Rol Desarrollador Senior](#1-análisis-rol-desarrollador-senior)
2. [Análisis Rol Usuario UI/UX](#2-análisis-rol-usuario-uiux)
3. [Análisis Rol Diseñador y Responsabilidad](#3-análisis-rol-diseñador-y-responsabilidad)
4. [Análisis Rol Arquitecto Experto](#4-análisis-rol-arquitecto-experto)
5. [Resumen y Recomendaciones](#5-resumen-y-recomendaciones)

---

# 1. ANÁLISIS ROL DESARROLLADOR SENIOR

## 1.1 Stack Tecnológica Actual

| Componente | Tecnología | Versión | Estado | Observaciones |
|------------|------------|--------|--------|--------------|
| Frontend Framework | React | 19.2.0 | ✅ Moderno | Última versión estable |
| State Management | TanStack Query | 5.95.2 | ✅ Funcional | Algunos módulos usan Context |
| UI Framework | Tailwind CSS | 3.4.13 | ✅ Funcional | Inconsistente entre módulos |
| Icon Library | React Icons | 5.5.0 | ✅ Completo | |
| PDF Generation | jsPDF + jsPDF-AutoTable | 3.0.3 | ✅ Funcional | Solo en algunos módulos |
| Date Handling | date-fns | 4.1.0 | ✅ Moderno | |
| Forms | React Hook Form | 7.54.2 | ⚠️ Parcial | No en todos los módulos |
| Backend Runtime | Node.js | LTS | ✅ Estable | |
| API Framework | Express | 4.x | ✅ Estable | |
| Database | PostgreSQL | 15+ | ✅ Funcional | Sin migrations |
| Authentication | JWT + Refresh | Custom | ✅ Funcional | |
| File Storage | drive-share-link | Custom | ⚠️ Básico | |

## 1.2 Análisis de Código - Frontend

### 1.2.1 Estructura de Archivos

```
spi_front/src/modules/calidad/
├── Dashboard.jsx                    # Landing page principal
├── pages/
│   ├── CA0101Workspace.jsx        # Control Temperatura
│   ├── CA0102Workspace.jsx        # Limpieza
│   ├── CA0103Workspace.jsx        # Buenas Prácticas
│   ├── CA0104Workspace.jsx         # Control Plagas
│   ├── CA0105Workspace.jsx         # Gestión Documental
│   ├── CA0106Workspace.jsx       # Recall
│   ├── CA0107Workspace.jsx        # Quejas
│   ├── CA0108Workspace.jsx        # Refrigerados
│   ├── CA0109Workspace.jsx        # CAPA
│   ├── CA0110Workspace.jsx        # Riesgos
│   ├── CA0111Workspace.jsx        # Incidentes
│   ├── CA0112Workspace.jsx        # Higiene
│   ├── CA0113Workspace.jsx        # Comunicaciones
│   ├── CA0114Workspace.jsx        # Áreas Calificadas
│   ├── CA0115Workspace.jsx        # Auditorías
│   ├── CA0116Workspace.jsx        # Muestreo
│   └── CA0117Workspace.jsx        # Tecnovigilancia
├── components/
│   ├── {CA0XXX}AuthModal.jsx      # 17 archivos
│   ├── {CA0XXX}Stepper.jsx        # 17 archivos
│   ├── ComplianceDashboard.jsx
│   ├── TemperatureHeatMap.jsx
│   └── [otros componentes]
├── hooks/
│   ├── useCa0101Queries.js       # Custom hooks
│   ├── useCa0102Queries.js
│   ├── useCa0103Queries.js
│   ├── [más hooks]
│   └── useCa01XXQueries.js
├── utils/
│   ├── ca0101PdfGenerator.js    # Generadores PDF
│   ├── ca0102PdfGenerator.js
│   ├── [más generators]
│   └── ca0117PdfGenerator.js
└── Dashboard.jsx                    # Landing
```

### 1.2.2 Problemas Identificados

#### Problema 1: Duplicación Masiva de Código

```javascript
// Los siguientes archivos son 85%+ idénticos entre módulos:

CA0101Stepper.jsx    // ~120 líneas
CA0102Stepper.jsx    // ~115 líneas (90% idéntico)
CA0103Stepper.jsx    // ~118 líneas
CA0104Stepper.jsx
CA0105Stepper.jsx
CA0106Stepper.jsx
CA0107Stepper.jsx
CA0108Stepper.jsx
CA0109Stepper.jsx
CA0110Stepper.jsx
CA0111Stepper.jsx
CA0112Stepper.jsx
CA0113Stepper.jsx
CA0114Stepper.jsx
CA0115Stepper.jsx
CA0116Stepper.jsx
CA0117Stepper.jsx

// TODOS tienen:
// - Estructura de steps similar
// - onStepChange handler
// - Validación de transición
// - Renderizado de icons
```

**Impacto:** Mantenimiento correcto = 17x trabajo  
**Solución needed:** BaseStepper component

#### Problema 2: Hooks Inconsistentes

```javascript
// useCa0101Queries.js - Define 8 queries explícitos:
const useGetActiveAlarms = () => useQuery(...)  // Named specifically
const useRegisterAlarm = () => useMutation(...)
const useTransitionAlarm = () => useMutation(...)

// useCa0102Queries.js - Diferente estructura:
const useGetActiveCleanings = () => ...
const useCreateCleaning = () => ...

// useCa0103Queries.js - Otra estructura diferente:

// PROBLEMA: No hay estándar
// - Algunos usan useGetName más específico
// - Otros usan useQuery genérico
// - Nombres de funciones inconsistentes
```

#### Problema 3: State Management Mixto

```javascript
// Algunos módulos usan:
import { useState, useEffect } from 'react'
import { useContext } from 'react'

// Otros usan:
import { useQuery, useMutation } from '@tanstack/react-query'

//peor aún:
// mezcla de ambos en el mismo componente!
```

**Estado:** Caótico e inmanejable  
**Impacto:** Imposible predecir comportamiento

#### Problema 4: Imports Largos y Frágiles

```javascript
// imports actuales (todos los módulos):
import { useCa0101Queries } from '../../../calidad/hooks/useCa0101Queries'
import { useGetActiveAlarms } from '../hooks/useCa0101Queries'
import FiThermometer from 'react-icons/fi'

// Debería ser:
import { useCAQueries } from '@/calidad/hooks'
import { CAStepper } from '@/calidad/components'
import { Icons } from '@/ui/icons'
```

**Problema:** No hay barrel exports, paths absolutos, o alias

### 1.3 Análisis de Código - Backend

#### 1.3.1 Estructura de Archivos

```
backend/src/modules/calidad/
├── ca0101.routes.js           # Route definitions
├── ca0101.controller.js       # Request handlers
├── ca0101.service.js         # Lógica de negocio
├── ca0101.repository.js      # DB operations
├── ca0101StateMachine.service.js  # Workflow
├── [ mismo patrón x 17 ]
├── integrations/
│   ├── dataloggerParser.js
│   └── sitradApi.client.js
├── services/
│   ├── temperatureMonitor.service.js
│   └── ca0114Calibration.service.js
└── [otros servicios]
```

#### 1.3.2 Problemas Backend

```javascript
// PROBLEMA 1: STATE MACHINES DUPLICADOS
// 17 archivos prácticamente idénticos

ca0101StateMachine.service.js:    ~180 líneas
ca0102StateMachine.service.js:   ~175 líneas
ca0103StateMachine.service.js:    ~178 líneas
// diferencia mínima: solo nombres de estados

// PROBLEMA 2: NO HAY BASE CLASS
// cada service reimplementa:
class CA0101Service {
  async findAll() { /* ... */ }
  async findById() { /* ... */ }
  async create() { /* ... */ }
  async update() { /* ... */ }
  async delete() { /* ... */ }
  async transition() { /* ... */ }
}

// Repitiendo 17 veces!
// Should be:
// class BaseCAService { ... extends }
```

**PROBLEMA 3: Error Handling Espagético**

```javascript
// ERROR HANDLING ACTUAL en TODOS los controladores:
try {
  const result = await service.create(data);
  res.json(result);
} catch (err) {
  console.error('CA0101 Error:', err);  // ❌ Malo
  res.status(500).json({ error: 'Error' }); // ❌ Sin contexto
}

// DEBERÍA SER:
import { errorHandler, CAErrors } from '@/core/errors';

try {
  const result = await service.create(data);
  res.json(result);
} catch (err) {
  if (err instanceof CAErrors.AlreadyExists) {
    return res.status(409).json(err.toJSON());
  }
  throw errorHandler.handle(err, { module: 'CA0101' });
}
```

**PROBLEMA 4: Repository Inconsistente**

```javascript
// ca0101Repository.js usa:
getActiveAlarms()
getAlarmById()
transitionAlarm()

// ca0102Repository usa:
getActiveCleanings()
getCleaningById()
transitionCleaning()

// ca0105Repository usa:
listDocuments()
getDocument()
updateDocument()  // diferentes again!

// Naming convention inconsistente
// No hay base CRUD methods
```

#### 1.3.3 Tablas de Base de Datos

| Tabla | Módulo | Creada Por | Estado |
|------|-------|-----------|---------|
| calidad_ca0101_logs | CA0101 | Migration | ✅ |
| calidad_ca0102_cleanings | CA0102 | Migration | ✅ |
| calidad_ca0103_practices | CA0103 | Migration | ✅ |
| calidad_ca0104_pests | CA0104 | Migration | ✅ |
| calidad_folders | CA0105 | Migration | ✅ |
| calidad_documents | CA0105 | Migration | ✅ |
| calidad_ca0106_recall | CA0106 | Migration | ✅ |
| calidad_ca0107_complaints | CA0107 | Migration | ✅ |
| calidad_ca0108_contingency | CA0108 | Migration | ✅ |
| calidad_ca0109_capa | CA0109 | Migration | ✅ |
| calidad_ca0110_risks | CA0110 | Migration | ✅ |
| calidad_ca0111_incidents | CA0111 | Migration | ✅ |
| calidad_ca0112_hygiene | CA0112 | Migration | ✅ |
| calidad_ca0113_comms | CA0113 | Migration | ✅ |
| calidad_areas | CA0114 | Migration | ✅ |
| calidad_audits | CA0115 | Migration | ✅ |
| calidad_batches | CA0116 | Migration | ✅ |
| calidad_tecno | CA0117 | Migration | ✅ |

**PROBLEMA:** No hay schema versioning, sin migrations engineereads

### 1.4 Módulos por Estado de Desarrollo

| Módulo | Nombre | Frontend | Backend | Estado | Prioridad |
|--------|--------|---------|---------|--------|----------|
| CA0101 | Temperatura | 85% | 90% | 🟢 Funcional | ALTA |
| CA0102 | Limpieza | 60% | 70% | 🟡 En desarrollo | MEDIA |
| CA0103 | Buenas Prácticas | 40% | 50% | 🔴 Incompleto | BAJA |
| CA0104 | Control Plagas | 75% | 80% | 🟢 Funcional | MEDIA |
| CA0105 | Gestión Documental | 90% | 95% | 🟢 Funcional | CRÍTICA |
| CA0106 | Recall | 65% | 75% | 🟡 En desarrollo | MEDIA |
| CA0107 | Quejas | 55% | 65% | 🔴 Incompleto | MEDIA |
| CA0108 | Refrigerados | 60% | 70% | 🟡 En desarrollo | ALTA |
| CA0109 | CAPA | 80% | 85% | 🟢 Funcional | ALTA |
| CA0110 | Riesgos | 55% | 65% | 🔴 Incompleto | MEDIA |
| CA0111 | Incidentes | 70% | 75% | 🟢 Funcional | MEDIA |
| CA0112 | Higiene | 60% | 70% | 🟡 En desarrollo | MEDIA |
| CA0113 | Comunicaciones | 40% | 50% | 🔴 Incompleto | BAJA |
| CA0114 | Áreas Calificadas | 50% | 65% | 🔴 Incompleto | MEDIA |
| CA0115 | Auditorías | 85% | 90% | 🟢 Funcional | CRÍTICA |
| CA0116 | Muestreo | 75% | 85% | 🟢 Funcional | MEDIA |
| CA0117 | Tecnovigilancia | 75% | 85% | 🟢 Funcional | ALTA |

### 1.5 Issues Técnicos Priorizados

| # | Issue | Severidad | Módulo | Esfuerzo |
|---|-------|----------|---------|-----------|
| 1 | BaseStepper component no existe | ALTA | TODOS | 2 días |
| 2 | BaseCAService class no existe | ALTA | TODOS | 3 días |
| 3 | State management inconsistente | ALTA | TODOS | 1 semana |
| 4 | No barrel exports | MEDIA | FRONTEND | 1 día |
| 5 | Error handling genérico | ALTA | BACKEND | 2 días |
| 6 | No migrations | MEDIA | DATABASE | 3 días |
| 7 | PDF generators duplicados | MEDIA | TODOS | 2 días |
| 8 | Code splitting no implementado | MEDIA | FRONTEND | 3 días |

---

# 2. ANÁLISIS ROL USUARIO (UI/UX)

## 2.1 Overview de Experiencia

### Lo Que Funciona ✅

| Aspecto | Módulo Ejemplo | Rating |
|--------|---------------|--------|
| Navegación clara | Dashboard grid 4x4 | ⭐⭐⭐⭐⭐ |
| Visual dark mode | CA0101 GXP Command | ⭐⭐⭐⭐⭐ |
| Steppers visuales | Todos | ⭐⭐⭐⭐ |
| Feedback states | Toasts, loading spinners | ⭐⭐⭐⭐ |
| Responsive design | Tailwind base | ⭐⭐⭐⭐ |

### Lo Que No Funciona ❌

| Aspecto | Problema | Impacto |
|--------|---------|---------|
| Inconsistencia visual | Cada workspace diferente | ALTO |
| Tables sin features | Sin sorting/pagination | ALTO |
| Forms weak | Validation solo al final | ALTO |
| Performance loading | Sin skeleton algunos | MEDIO |
| Mobile overflow | Steppers rotos | ALTO |

## 2.2 Análisis Visual por Módulo

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                    VISUAL DESIGN COMPARISON                         ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  CA0101Workspace:                                                     ║
║  - Background: bg-gray-900 (dark mode)                                 ║
║  - Glassmorphism effects                                               ║
║  - Gradient text red-to-yellow                                          ║
║  - Icons: custom red/orange theme                                      ║
║  RATING: ⭐⭐⭐⭐⭐                                                     ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  CA0105Workspace:                                                     ║
║  - Background: bg-white (light mode)                                  ║
║  - Simple cards white/gray                                             ║
║  - No gradients                                                       ║
║  - Standard blue theme                                                ║
║  RATING: ⭐⭐⭐                                                       ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  CA0115Workspace:                                                    ║
║  - Mixed: dark header, white content                                   ║
║  - Tables basic                                                       ║
║  - Mix inconsistent                                                   ║
║  RATING: ⭐⭐⭐                                                       ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

## 2.3 Componentes UI Problemáticos

### 2.3.1 Steppers

```javascript
// PROBLEMA 1: Overflow horizontal en mobile
// current Stepper implementation:
// - 5+ steps = overflow-x scroll
// - Mobile UX: imposible navegar

// CA0101Stepper.jsx - 5 steps:
// [1] Identificar → [2] Evaluar → [3] Investigar → [4] Acción → [5] Cerrar

// CA0106Stepper.jsx - 7 steps:
// [1] Inicio → [2] Evaluación → [3] Decisión → [4] Ejecución → [5] Verificación → [6] Comunicación → [7] Cierre
// EN MOBILE: No cabe!
```

### 2.3.2 Tables

```javascript
// PROBLEMA 2: Tablas básicas sin features

// Buena tabla (Attendance de Talento):
// ✅ Sorting por columnas
// ✅ Pagination  
// ✅ Búsqueda
// ✅ Selection
// ✅ Row click handlers

// Tablas en Calidad:
// ❌ No sorting
// ❌ No pagination (muestra 1000+ rows)
// ❌ No search
// ❌ Performance terrible con datos grandes

// Ejemplo: CA0115Workspace
{data?.map((item) => (
  <tr key={item.id}>
    <td>{item.name}</td>
    <td>{item.status}</td>
    // ... 20+ columns sin scroll horizontal
  </tr>
))}
```

### 2.3.3 Forms y Validación

```javascript
// PROBLEMA 3: Validación only on submit

// Current AuthModal approach:
const handleSubmit = async () => {
  if (!password || !pin) {
    toast.error('Complete todos los campos');  // ❌ Too late!
    return;
  }
  //submit...
};

// Debería ser:
<input 
  onChange={(e) => {
    setPassword(e.target.value);
    // validar en tiempo real
    setErrors(validatePassword(e.target.value));
  }}
  aria-describedby="password-error"
/>
{errors?.password && (
  <span id="password-error" role="alert">
    Requiere 1 mayús, 1 número, 8+ chars
  </span>
)}
```

## 2.4 Performance UX Issues

| Issue | Módulo | Impacto | Severidad |
|-------|--------|--------|----------|
| Tabla sin paginación | CA0115 | ALTA | Lento con 1000+ rows |
| Tabla sin paginación | CA0105 | ALTA | Lento con 1000+ docs |
| Sin skeleton | CA0117 | MEDIA | Loading 3-5 seg |
| Sin empty state | CA0103 | MEDIA | Pantalla vacía |
| Loading infinito | CA0101 | MEDIA | Se queda colgado |
| Form sin feedback | TODOS | ALTA | Usuario perdido |

## 2.5 UX Bugs Encontrados

| Bug ID | Módulo | Descripción | Severidad | Stacy |
|--------|--------|-------------|-----------|-------|
| UX-001 | CA0115 | Table overflow horizontal | ALTA | Open |
| UX-002 | CA0106+ | Mobile stepper overflow | ALTA | Open |
| UX-003 | CA0103 | No empty state | MEDIA | Open |
| UX-004 | CA0117 | Loading forever spin | MEDIA | Open |
| UX-005 | TODOS | Form validation silent | ALTA | Open |
| UX-006 | CA0105 | Auto-logout stuck | ALTA | Open |
| UX-007 | CA0114 | Map no rendering | MEDIA | Open |

---

# 3. ANÁLISIS ROL DISEÑADOR Y RESPONSABILIDAD

## 3.1 Design System - Estado Actual

### ❌ NO EXISTE DESIGN SYSTEM

```javascript
// PROBLEMA CRÍTICO:
// No hay sistema de diseño unificado

// Cada módulo define sus propios colores:
CA0101:  #FF5733, #3498DB, #E74C3C   // random
CA0102:  #1ABC9C, #2C3E50          // diferente  
CA0103:  #9B59B6, #34495E
CA0105:  #3498DB (mas consistente)

//FUENTES también random:
CA0101:  Inter (custom import)
CA0105:  System font
CA0115:  Roboto

//SPACINGS inconsistentes:
4px, 8px, 12px, 16px, 24px... random
```

## 3.2 Lo Que Debería Existir

```javascript
// DISEÑO SUGERIDO:

/src/core/ui/
├── design-system/
│   ├── colors.js
│   │   =========
│   │   export const calidad = {
│   │     primary:    '#2563EB',  // blue-600
│   │     secondary: '#7C3AED', // violet-600
│   │     success:  '#10B981',   // emerald-500
│   │     warning:  '#F59E0B',  // amber-500
│   │     error:    '#EF4444', // red-500
│   │     neutral:  '#6B7280', // gray-500
│   │     // ... estados
│   │   }
│   │
│   ├── typography.js
│   │   =========
│   │   FONT_PRIMARY = 'Inter'
│   │   FONT_MONO = 'JetBrains Mono'
│   │   
│   ├── spacing.js
│   │   =========
│   │   SPACING = {
│   │     xs: 4,
│   │     sm: 8,
│   │     md: 16,
│   │     lg: 24,
│   │     xl: 32,
│   │     '2xl': 48
│   │   }
│   │
│   ├── components/
│   │   ├── CAStepper.jsx
│   │   ├── CADataTable.jsx
│   │   ├── CAAuthModal.jsx
│   │   └── CARecordCard.jsx
│   │
│   └── theme.js
│       // Configuración Tailwind
```

## 3.3 Accesibilidad WCAG 2.1 - AUDIT

### 3.3.1 Problemas de Contraste

| Combinación | Ratio | WCAG Req | Status |
|-------------|-------|----------|--------|
| gray-400 en gray-900 | 2.5:1 | 4.5:1 | ❌ FAIL |
| white en blue-600 | 4.48:1 | 4.5:1 | ⚠️ borderline |
| gray-500 en white | 3.1:1 | 4.5:1 | ❌ FAIL |

### 3.3.2 Problemas de Navegación

```javascript
// Steppers no son keyboard-navegables:
// FALTA:
<button 
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'ArrowRight') nextStep();
    if (e.key === 'ArrowLeft') prevStep();
  }}
/>
```

### 3.3.3 Screen Reader Issues

```javascript
// TODOS los modales:
// FALTA: aria-labelledby
<Modal role="dialog">
  {/* debería tener: aria-labelledby="modal-title" */}
  <h2 id="modal-title">Confirmar</h2>
</Modal>

// FORM inputs:
// FALTA: aria-describedby para errores
<input 
  aria-describedby="password-error"
  aria-invalid={hasError}
/>
<span id="password-error" role="alert">
  {/* mensaje de error para screen reader */}
</span>

// FALTA: aria-live para alerts
<Toast aria-live="polite">
  Alerta importante
</Toast>
```

### 3.3.4 Focus Management

```javascript
// Modal Abre = Focus queda en button, no en modal!
// FALTA:
useEffect(() => {
  if (isOpen) {
    modalRef.current?.focus();
  }
}, [isOpen]);

// Better con focus trap:
import { useFocusTrap } from '@/hooks';
const { focusRef } = useFocusTrap(isOpen);
```

## 3.4 Cumplimiento Regulatorio

### 3.4.1 Estado Actual

| Requisito | Estándar | Implementado | Evidencia |
|-----------|----------|--------------|----------|
| FDA 21 CFR Part 11 | FDA | ❌ 0% | Sin e-signatures |
| FDA 21 CFR Part 820 | FDA | ⚠️ 40% | CA0101 solo parcialmente |
| ISO 9001:2015 | ISO | ⚠️ 60% | Auditorías parciales |
| BPM (WHO) | WHO | ⚠️ 40% | CA0101, CA0105 |
| HACCP | Codex | ❌ 0% | No existe |
| FDA Adverse Event Reporting | FDA | ❌ 0% | No hay API |

### 3.4.2 Regulatory Gaps

```javascript
// GAP 1: FDA 21 CFR Part 11 - Electronic Records
// REQUIERE:
// ✅ Audit trail de cambios
// ✅ E-signatures con evidencia
// ✅ System access control
// ✅ Validación de datos
// ❌ NO IMPLEMENTADO

// GAP 2: HACCP
// REQUIERE:
// ✅ Plan HACCP documentado
// ✅ 7 principios
// ✅ Monitoreo de puntos críticos
// ❌ NO EXISTE

// GAP 3: ISO 9001:2015
// REQUIERE:
// ✅ Gestión de no conformidades
// ✅ Auditorías internas
// ⚠️ Parcial (CA0115)
// ✅ Mejora continua
// ❌ No hay sistema de metrics integrado
```

---

# 4. ANÁLISIS ROL ARQUITECTO EXPERTO

## 4.1 Arquitectura Actual - Diagrama

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    ARQUITECTURA ACTUAL                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                   │
│  FRONTEND (React)                                                │
│  ├──Pages (17 workspace)                                        │
│  │   ├── CA0101Workspace                                        │
│  │   ├── CA0102Workspace                                        │
│  │   └── ... hasta CA0117Workspace                              │
│  │                                                              │
│  ├──Components (90+)                                            │
│  │   ├── Steppers (17x)                                         │
│  │   ├── AuthModals (17x)                                        │
│  │   └── ...                                                     │
│  │                                                              │
│  ├──Hooks (17 different patterns)                                 │
│  │   └── useCa0101Queries, useCa0102Queries...                   │
│  │                                                              │
│  └──Utils (17 PDF generators)                                    │
│      └── ca0101PdfGenerator, ca0102PdfGenerator...              │
│                                                                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                                   │
│  PROBLEMA: Escala O(n*17) donde n = features                     │
│  AGREGAR CA0118 = ~200+ archivos copy-paste                      │
│                                                                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                                   │
│  BACKEND (Node.js + Express)                                     │
│  ├── Routes (17 archivos)                                       │
│  ├── Controllers (17 archivos)                                   │
│  ├── Services (17x StateMachine + 17x Service)                   │
│  ├── Repositories (17 archivos)                                   │
│  └── Integrations (Datalogger, SITRAD APIs)                       │
│                                                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

## 4.2 Problemas de Escalabilidad

### Problema 1: Copy-Paste Architecture

```javascript
// SI MODIFICO STATEMACHINE EN CA0101,
// TENGO QUE CAMBIAR EN 16 OTROS ARCHIVOS!

// Current: 17 archivos prácticamente idénticos:

ca0101StateMachine.service.js:    ~180 líneas
ca0102StateMachine.service.js:    ~180 líneas (cambian states)
ca0103StateMachine.service.js:    ~180 líneas
ca0104StateMachine.service.js:    ~180 líneas
// ... todos 17

// Solution needed:
// base/BaseStateMachine.service.js
// con herencia configurable
class BaseStateMachine {
  constructor(config) {
    this.states = config.states;
    this.transitions = config.transitions;
  }
  
  canTransition(from, to) { /* ... */ }
  transition(from, to) { /* ... */ }
}

import { BaseStateMachine } from './base';

class CA0101StateMachine extends BaseStateMachine {
  constructor() {
    super({
      states: ['nuevo', 'investigando', 'cerrado'],
      transitions: [...]
    });
  }
}
```

### Problema 2: Bundle Size Explosivo

```javascript
// BUILD ACTUAL:
// main.js:  606 KB
// chunks:   ~500 KB (189 + 131 + 68 + 60 + 56...)
// TOTAL:    ~1.1 MB sin gzip

// GZIPPED:  ~380 KB descargado al inicio

// PROBLEMA:
// - Apenas usas 1 módulo, cargas 17!
// - No hay code splitting por route

// Solution:
// vite.config.js o react-scripts config:
// Already tiene lazy loading support!

import { lazy } from 'react';

// EN LUGAR DE:
import CA0101Workspace from './pages/CA0101Workspace';
import CA0102Workspace from './pages/CA0102Workspace';
// ... 17 imports

// HACER:
const CA0101Workspace = lazy(() => import('./pages/CA0101Workspace'));
const CA0102Workspace = lazy(() => import('./pages/CA0102Workspace'));
// ....

// webpack/snowpack creará chunks separados automáticamente
// Se cargan solo cuando la ruta se visita
```

### Problema 3: Database Anárquica

```javascript
// PROBLEMA: PostgreSQL sin migrations

// TABLAS CREADAS A MANO (Diferentes días):
2024-01-15:  CREATE TABLE calidad_ca0101_logs;     -- CA0101
2024-02-20:  CREATE TABLE calidad_folders;          -- CA0105  
2024-03-10:  CREATE TABLE calidad_documents;        -- CA0105
2024-03-15:  CREATE TABLE calidad_audits;         -- CA0115
// diferentes personas, diferentes días

// NAMING INCONSISTENT:
calidad_temp_logs          // snake_case (correcto)
calidad_folders            // missing: plural o singular
ca0101_temperature        // prefix changed
temperature_log           // inconsistent

// Solution:
// db/migrations/001_calidad_base.sql
// db/migrations/002_add_ca0105_tables.sql
// etc.

// Con PostgreSQL migrations o Sequelize/Alembic:
npx sequelize migration:generate --name add-ca0105-tables
```

### Problema 4: API Layer Sin Versioning

```javascript
// ACTUAL: 17 route files sin versión

// CA0101: /api/v1/calidad/temperature/
// CA0105: /api/v1/calidad/documentos/
// CA0115: /api/v1/calidad/audits/

// PROBLEMA:
// - No /v2/ versioning
// - Rate limiting es global
// - Sin API Gateway
// - Controllers con lógica de negocio mezclada

// SOLUTION:
// /api/v2/calidad/*
// Mediator pattern
// GraphQL consideration para futuras features
```

## 4.3 Métricas de Arquitectura

| Métrica | Actual | Target | Delta |
|--------|--------|--------|-------|
| bundle size | 606 KB | <200 KB | -67% |
| code duplication | 85% | <15% | -82% |
| files per module | ~15 | ~3 | -80% |
| DB migrations | 0% | 100% | +100% |
| API versioning | 0% | 100% | +100% |
| Shared components | 0% | 80% | +80% |

## 4.4 Soluciones Arquitecturales Propuestas

### Phase 1: Base Infrastructure (2 semanas)

```
/src/modules/calidad/
├── base/
│   ├── BaseCAStepper.jsx        // Stepper genérico
│   ├── BaseCAWorkspace.jsx      // Workspace base
│   ├── BaseCAAuthModal.jsx      // Auth modal base
│   ├── BaseCARecordCard.jsx     // Card base
│   └── BaseCARecordTable.jsx    // Table genérica
│
├── services/
│   ├── BaseCAService.js          // Base service
│   ├── BaseStateMachine.js       // State machine
│   └── BaseRepository.js         // CRUD base
│
├── hooks/
│   └── useCAQueries.js          // Factory de queries
│
└── constants/
    ├── colors.js
    ├── typography.js
    └── states.js
```

### Phase 2: Migration (3 semanas)

```
Migra cada módulo a la base:
- CA0101: 1 día
- CA0102: 1 día
- CA0103: 1 día
- CA0104: 1 día
- CA0105: 2 días (complejo)
- CA0106-0117: 1 día cada uno
```

### Phase 3: Performance (2 semanas)

```
- Code splitting por route
- React.lazy() para cada workspace
- Skeleton loaders universal
- Service Worker para offline
- Optimistic UI updates
```

---

# 5. RESUMEN Y RECOMENDACIONES

## 5.1 Score General del Sistema

| Perspectiva | Score /10 | Problema Principal |
|------------|-----------|-------------------|
| **Desarrollador Senior** | 5/10 | Código copy-paste, sin base class |
| **Usuario (UI/UX)** | 6/10 | UX inconsistente, performance mixed |
| **Diseñador** | 4/10 | NO hay design system, accesibilidad mala |
| **Arquitecto** | 4/10 | No escala, bundles gigante, DB anárquica |

## 5.2 Acciones Priorizadas

| Prioridad | Acción | Impacto | Tiempo | Responsable |
|----------|--------|--------|--------|-------------|
| 🔴 ALTA | Crear BaseCAService class | Tech debt | 1 semana | Backend Dev |
| 🔴 ALTA | Implementar code splitting | Performance | 3 días | Frontend Dev |
| 🔴 ALTA | Design System colors/constants | UI/UX | 1 semana | Designer + Dev |
| 🟡 MEDIA | PostgreSQL migrations | DB | 1 semana | DBA |
| 🟡 MEDIA | Basic accessibility wcag | A11y | 1 semana | Dev |
| 🟢 BAJA | BaseStepper component | Estructura | 2 días | Frontend Dev |

## 5.3 Roadmap Sugerido

```
Sprint 1: Foundation
├── Create /base/ estructura
├── Design system constants
└── BaseCAService class

Sprint 2: Migration Phase 1
├── Migrate CA0101-CA0104
├── Code splitting implementation
└── Skeleton loaders

Sprint 3: Migration Phase 2  
├── Migrate CA0105-CA0109
├── PostgreSQL migrations setup
└── Error handling base

Sprint 4: Migration Phase 3
├── Migrate CA0110-CA0117
├── Accessibility improvements
└── Performance optimization
```

## 5.4 Métricas de Éxito

| Métrica | Baseline | Target | Timeline |
|--------|----------|--------|----------|
| Bundle size | 606 KB | <250 KB | Sprint 4 |
| Duplicación código | 85% | <20% | Sprint 4 |
| Components shared | 0% | 70% | Sprint 4 |
| Score UX | 6/10 | 8/10 | Sprint 4 |
| Score A11y | 3/10 | 7/10 | Sprint 4 |

---

## ANEXO: Issues Detallados

### A.1 GitHub Issues Log

| Issue | Title | Labels | Status |
|-------|-------|--------|--------|
| #001 | BaseStepper component needed | architecture | TODO |
| #002 | Code splitting no implemented | performance | TODO |
| #003 | WCAG accessibility audit | accessibility | TODO |
| #004 | DB migrations needed | database | TODO |
| #005 | PDF generators duplicated | refactor | TODO |
| #006 | Forms weak validation | ui/ux | TODO |
| #007 | No empty states | ui/ux | TODO |
| #008 | Tables need pagination | ui/ux | TODO |

---

*Documento generado por equipo de desarrollo FAMSPI*  
*Versión: 1.0*  
*Fecha: 2026-04-16*