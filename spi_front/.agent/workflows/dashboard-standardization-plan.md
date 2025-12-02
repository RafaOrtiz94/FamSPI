# 📋 Plan de Estandarización de Dashboards

## 🎯 Objetivo
Estandarizar todos los dashboards del sistema basándose en la estructura limpia y organizada de **ACPComercialView**, garantizando consistencia, mantenibilidad y una mejor UX.

---

## 📐 Modelo de Referencia: ACPComercialView

### Características Destacadas
1. **Estructura Minimalista**: Solo muestra lo esencial para el rol
2. **Navegación Clara**: Cards de acceso directo a funcionalidades
3. **Header Descriptivo**: Título, subtítulo y acciones relevantes
4. **Responsive**: Grid adaptable (2 cols móvil → 4 cols desktop)
5. **Iconografía Consistente**: Uso coherente de react-icons/fi
6. **Código Limpio**: Sin lógica de negocio, solo presentación

### Estructura Base
```jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { Icon1, Icon2, Icon3 } from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import { DashboardHeader } from "../../../shared/components/DashboardComponents";

const [RoleName]View = ({ onRefresh }) => {
    const navigate = useNavigate();

    return (
        <>
            {/* 1. HEADER */}
            <DashboardHeader
                title="[Título del Rol]"
                subtitle="[Descripción breve del rol]"
                actions={
                    <button
                        onClick={onRefresh}
                        className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
                    >
                        Actualizar
                    </button>
                }
            />

            {/* 2. QUICK ACCESS CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Navigation Cards */}
            </div>

            {/* 3. WIDGETS (opcional) */}
            {/* Widgets específicos del rol */}
        </>
    );
};

export default [RoleName]View;
```

---

## 🏗️ Arquitectura de Dashboards

### 1. Estructura de Carpetas (Por Módulo)
```
src/modules/[modulo]/
├── pages/
│   └── Dashboard.jsx          # Controlador principal
├── components/
│   └── dashboard/
│       ├── [Rol1]View.jsx     # Vista específica rol 1
│       ├── [Rol2]View.jsx     # Vista específica rol 2
│       └── ...
```

### 2. Dashboard Principal (Controlador)
**Responsabilidades:**
- Determinar el rol del usuario autenticado
- Renderizar la vista correspondiente
- Pasar funciones de callback (`onRefresh`, etc.)

**Patrón:**
```jsx
import React from "react";
import { useAuth } from "../../../core/auth/AuthContext";
import { DashboardLayout } from "../../shared/components/DashboardComponents";

// Views
import ManagerView from "../components/dashboard/ManagerView";
import EmployeeView from "../components/dashboard/EmployeeView";
import AdminView from "../components/dashboard/AdminView";

const [Module]Dashboard = () => {
    const { user } = useAuth();
    const handleRefresh = () => {
        // Lógica de refresh si es necesario
    };

    const renderView = () => {
        const role = user?.role?.toLowerCase() || "";

        if (role.includes("jefe") || role.includes("manager")) {
            return <ManagerView onRefresh={handleRefresh} />;
        }

        if (role.includes("admin")) {
            return <AdminView onRefresh={handleRefresh} />;
        }

        // Default view
        return <EmployeeView onRefresh={handleRefresh} />;
    };

    return (
        <DashboardLayout>
            {renderView()}
        </DashboardLayout>
    );
};

export default [Module]Dashboard;
```

### 3. Vistas Específicas de Rol
**Componentes Obligatorios:**
1. ✅ **DashboardHeader** - Siempre presente
2. ✅ **Quick Access Cards** - Grid de navegación rápida
3. 🔄 **Widgets** - Opcionales según necesidades del rol

---

## 📦 Componentes Estándar

### 1. DashboardHeader
**Props:**
- `title`: string (requerido)
- `subtitle`: string (requerido)
- `actions`: ReactNode (opcional)

**Uso:**
```jsx
<DashboardHeader
    title="Dashboard ACP Comercial"
    subtitle="Atención al Cliente y Soporte Comercial"
    actions={
        <button onClick={onRefresh}>
            Actualizar
        </button>
    }
/>
```

### 2. Quick Access Cards
**Patrón:**
```jsx
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <Card
        className="p-4 cursor-pointer hover:shadow-sm transition border border-gray-200"
        onClick={() => navigate("/path")}
    >
        <div className="flex items-center gap-3">
            <div className="p-2 bg-[color]-50 rounded-md text-[color]-600">
                <Icon size={18} />
            </div>
            <div>
                <p className="text-sm font-semibold text-gray-900">
                    Título
                </p>
                <p className="text-xs text-gray-500">
                    Descripción
                </p>
            </div>
        </div>
    </Card>
</div>
```

**Paleta de Colores Sugerida:**
- `blue`: Módulos principales, solicitudes
- `purple`: Gestión, asignaciones
- `green`: Aprobaciones, éxito
- `amber/yellow`: Pendientes, en proceso
- `red`: Rechazos, críticos
- `cyan`: Procesos, workflows
- `pink`: Clientes, contacto
- `lime`: Validaciones, verificaciones

### 3. Widgets Compartidos
**Widgets Globales (deben estar en todos los dashboards):**
- ✅ **AttendanceWidget**: Registro de asistencia
- ✅ **PersonnelRequestWidget**: Solicitudes de personal (si aplica al rol)

**Ubicación:**
```jsx
{/* Después de Quick Access Cards */}
<div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
    <AttendanceWidget />
    {/* Otros widgets específicos */}
</div>
```

---

## 🎨 Guía de Diseño

### Espaciado
- **Gap entre cards**: `gap-4`
- **Margen superior widgets**: `mt-6`
- **Padding cards**: `p-4` o `p-5`

### Tipografía
- **Título principal**: `text-lg font-semibold text-gray-900`
- **Subtítulo**: `text-xs text-gray-500`
- **Labels**: `text-sm font-semibold text-gray-900`

### Colores (Tailwind)
- **Fondo cards**: `bg-white` + `border border-gray-200`
- **Hover cards**: `hover:shadow-sm transition`
- **Iconos**: Usar variantes `-50` para fondo y `-600` para ícono

---

## 🔄 Plan de Implementación

### Fase 1: Auditoría (Semana 1)
**Objetivo:** Identificar todos los dashboards existentes y su estado actual

**Tareas:**
1. Listar todos los módulos con dashboards
2. Documentar roles por módulo
3. Identificar vistas faltantes
4. Catalogar widgets utilizados

**Entregables:**
- [ ] Inventario completo de dashboards
- [ ] Matriz de roles por módulo
- [ ] Lista de widgets compartidos vs específicos

### Fase 2: Estandarización de Componentes Compartidos (Semana 2)
**Objetivo:** Garantizar que todos los componentes compartidos sean reutilizables

**Tareas:**
1. Verificar/actualizar `DashboardHeader`
2. Verificar/actualizar `DashboardLayout`
3. Estandarizar `AttendanceWidget`
4. Crear librería de Quick Access Card templates

**Entregables:**
- [ ] Componentes compartidos actualizados
- [ ] Documentación de uso
- [ ] Storybook (opcional)

### Fase 3: Refactorización por Módulo (Semanas 3-6)
**Objetivo:** Aplicar el patrón estándar a cada módulo

**Orden de Prioridad:**
1. ✅ **Comercial** - Ya implementado (modelo de referencia)
2. **Gerencia** - Revisar y estandarizar
3. **Servicio Técnico**
4. **Calidad**
5. **Operaciones**
6. **Finanzas**
7. **Talento Humano**
8. **Backoffice**
9. **Auditoría**

**Por cada módulo:**
1. Crear estructura de carpetas si no existe:
   ```
   src/modules/[modulo]/
   ├── pages/Dashboard.jsx
   ├── components/dashboard/
   ```

2. Identificar roles y crear vistas:
   ```
   components/dashboard/
   ├── ManagerView.jsx
   ├── EmployeeView.jsx
   └── AdminView.jsx
   ```

3. Implementar patrón de controlador en `Dashboard.jsx`

4. Implementar cada vista siguiendo el modelo ACPComercialView

5. Integrar widgets obligatorios (AttendanceWidget)

6. Testing de navegación y permisos

**Entregables por Módulo:**
- [ ] Dashboard refactorizado
- [ ] Vistas por rol implementadas
- [ ] Widgets integrados
- [ ] Tests de navegación pasados

### Fase 4: Widgets Específicos (Semana 7)
**Objetivo:** Crear/optimizar widgets específicos por rol

**Tareas:**
1. Identificar widgets únicos necesarios
2. Estandarizar estructura de widgets
3. Implementar widgets faltantes
4. Optimizar rendimiento de widgets con muchos datos

**Widgets Identificados:**
- ✅ `AttendanceWidget` (global)
- ✅ `PersonnelRequestWidget` (global)
- ✅ `ClientRequestWidget` (comercial)
- ✅ `MyClientRequestsWidget` (comercial)
- ✅ `EquipmentPurchaseWidget` (comercial)
- ✅ `PurchaseHandoffWidget` (comercial)
- 🔄 `PendingApprovalsWidget` (servicio) - revisar
- 🔄 `MaintenanceScheduleWidget` (servicio) - revisar

### Fase 5: Testing y Validación (Semana 8)
**Objetivo:** Garantizar que todos los dashboards funcionan correctamente

**Tareas:**
1. Testing por rol:
   - Verificar permisos de acceso
   - Validar navegación
   - Probar widgets
   - Verificar responsive

2. Testing de integración:
   - Cambios de rol
   - Actualización de datos
   - Performance

3. Testing de UX:
   - Consistencia visual
   - Tiempos de carga
   - Feedback de usuarios

**Entregables:**
- [ ] Suite de tests completa
- [ ] Reporte de bugs identificados
- [ ] Plan de fixes

### Fase 6: Documentación y Deployment (Semana 9)
**Objetivo:** Documentar y desplegar cambios

**Tareas:**
1. Documentación técnica:
   - Guía de creación de nuevas vistas
   - Documentación de componentes
   - Patrones de navegación

2. Documentación de usuario:
   - Guías por rol
   - Changelog

3. Deployment:
   - Release notes
   - Migration guide (si aplica)

**Entregables:**
- [ ] Documentación completa
- [ ] Release package
- [ ] Training materials

---

## 📊 Checklist de Implementación por Dashboard

Para cada dashboard/vista, verificar:

### Estructura
- [ ] Sigue estructura de carpetas estándar
- [ ] Tiene controlador (`Dashboard.jsx`)
- [ ] Tiene vistas separadas por rol
- [ ] Usa `DashboardLayout` wrapper

### Componentes
- [ ] Usa `DashboardHeader` con props correctos
- [ ] Implementa Quick Access Cards
- [ ] Grid responsive (2 → 4 cols)
- [ ] Integra `AttendanceWidget`
- [ ] Integra widgets específicos necesarios

### Navegación
- [ ] Cards navegan a rutas correctas
- [ ] Rutas están registradas en router
- [ ] Permisos por rol configurados

### Estilo
- [ ] Sigue paleta de colores estándar
- [ ] Usa espaciado consistente
- [ ] Tipografía estandarizada
- [ ] Iconografía de react-icons/fi

### Funcionalidad
- [ ] `onRefresh` funciona correctamente
- [ ] Widgets cargan datos correctamente
- [ ] No hay errores en consola
- [ ] Performance aceptable (< 2s carga inicial)

### Testing
- [ ] Funciona en todos los tamaños de pantalla
- [ ] Todos los roles pueden acceder a su vista
- [ ] No hay fugas de información entre roles
- [ ] Navegación funciona correctamente

---

## 🎯 Métricas de Éxito

### Cuantitativas
- ✅ 100% de dashboards siguen estructura estándar
- ✅ 0 errores de consola en dashboards
- ✅ < 2s tiempo de carga inicial
- ✅ 100% cobertura de roles con vistas dedicadas
- ✅ AttendanceWidget presente en todos los dashboards

### Cualitativas
- ✅ Código más mantenible
- ✅ Menor curva de aprendizaje para desarrolladores
- ✅ UX consistente entre módulos
- ✅ Fácil creación de nuevas vistas

---

## 🚀 Guía Rápida: Crear Nueva Vista de Dashboard

### 1. Crear archivo de vista
```bash
# Ubicación
src/modules/[modulo]/components/dashboard/[Rol]View.jsx
```

### 2. Template inicial
```jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { FiIcon1, FiIcon2 } from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import { DashboardHeader } from "../../../shared/components/DashboardComponents";
import AttendanceWidget from "../../../shared/components/AttendanceWidget";

const [Rol]View = ({ onRefresh }) => {
    const navigate = useNavigate();

    return (
        <>
            <DashboardHeader
                title="Dashboard [Rol]"
                subtitle="[Descripción del rol]"
                actions={
                    <button
                        onClick={onRefresh}
                        className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
                    >
                        Actualizar
                    </button>
                }
            />

            {/* Quick Access */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Cards de navegación */}
            </div>

            {/* Widgets */}
            <div className="mt-6">
                <AttendanceWidget />
            </div>
        </>
    );
};

export default [Rol]View;
```

### 3. Registrar en controlador
```jsx
// En Dashboard.jsx del módulo
import [Rol]View from "../components/dashboard/[Rol]View";

const renderView = () => {
    const role = user?.role?.toLowerCase() || "";

    if (role.includes("[palabra_clave]")) {
        return <[Rol]View onRefresh={handleRefresh} />;
    }
    
    // ...otros roles
};
```

### 4. Verificar checklist
Ver sección "Checklist de Implementación por Dashboard"

---

## 📝 Notas Adicionales

### Widgets Globales a Verificar
Al implementar dashboards, verificar que estos widgets estén presentes cuando sea relevante:
- `AttendanceWidget`: **Obligatorio en todos los dashboards**
- `PersonnelRequestWidget`: En dashboards de gestión/gerencia

### Manejo de Estados
- Los dashboards NO deben manejar estado complejo
- Delegar lógica de negocio a widgets
- Usar hooks personalizados para datos compartidos

### Performance
- Lazy load de widgets pesados
- Implementar skeleton screens mientras carga
- Cachear datos cuando sea posible

### Accesibilidad
- Usar HTML semántico
- A todos los iconos dar aria-label
- Navegación por teclado funcional

---

## 🔗 Referencias

### Componentes Clave
- `DashboardLayout`: `/src/modules/shared/components/DashboardComponents.jsx`
- `DashboardHeader`: `/src/modules/shared/components/DashboardComponents.jsx`
- `Card`: `/src/core/ui/components/Card.jsx`

### Ejemplos de Referencia
- **Mejor implementación**: `/src/modules/comercial/components/dashboard/ACPComercialView.jsx`
- **Dashboard complejo**: `/src/modules/gerencia/Dashboard.jsx`
- **Controlador limpio**: `/src/modules/comercial/pages/Dashboard.jsx`

---

**Última actualización:** Diciembre 2025
**Responsable:** Equipo de Desarrollo FamSPI
**Estado:** 🟢 Activo
