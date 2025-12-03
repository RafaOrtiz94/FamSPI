---
description: Workflow para agregar sección de solicitudes estandarizada a un módulo
---

# Workflow: Agregar Sección de Solicitudes a un Módulo

Este workflow describe cómo agregar una sección de solicitudes estandarizada a cualquier módulo del sistema FamSPI.

## Prerrequisitos

- Los componentes compartidos en `src/modules/shared/solicitudes/` deben estar implementados
- El módulo debe tener un dashboard funcional
- Identificar los roles del módulo y sus permisos

## Paso 1: Crear Estructura de Carpetas

```bash
# Crear carpeta de configuración
mkdir src/modules/[modulo]/config

# Crear carpetas de componentes de solicitudes
mkdir src/modules/[modulo]/components/solicitudes
mkdir src/modules/[modulo]/components/solicitudes/modals
```

## Paso 2: Configuración de Action Cards

Crear archivo `src/modules/[modulo]/config/solicitudesConfig.js`:

```javascript
import { FiIcon1, FiIcon2 } from "react-icons/fi";

export const [modulo]ActionCards = [
  {
    id: "tipo-solicitud-1",
    subtitle: "Categoría",
    title: "Título de la Solicitud",
    color: "blue", // blue, emerald, purple, amber, indigo, orange, red
    icon: FiIcon1,
    description: "Descripción de qué hace esta solicitud",
    chips: ["Tag1", "Tag2"] // Opcional
  },
  // ... más action cards
  {
    id: "vacaciones",
    subtitle: "Talento Humano",
    title: "Vacaciones",
    color: "orange",
    icon: FiCalendar,
    description: "Solicitar días de vacaciones"
  }
];

export const [modulo]RoleConfig = {
  manager: {
    allowedCards: "all",
    features: {
      widgets: ["widget1", "widget2"],
      gridScope: "all",
      canApprove: true
    }
  },
  employee: {
    allowedCards: ["tipo-solicitud-1", "vacaciones"],
    features: {
      widgets: ["mis-solicitudes"],
      gridScope: "own",
      canApprove: false
    }
  }
};

export const [modulo]FilterConfig = {
  enableSearch: true,
  searchPlaceholder: "Buscar solicitudes...",
  statusFilter: {
    enabled: true,
    options: [
      { value: "pending", label: "Pendiente" },
      { value: "approved", label: "Aprobado" },
      { value: "rejected", label: "Rechazado" }
    ]
  },
  customFilters: [
    // Filtros adicionales específicos del módulo
  ]
};
```

## Paso 3: Crear Vistas por Rol

### Vista Manager

Crear `src/modules/[modulo]/components/solicitudes/[Rol]ManagerSolicitudesView.jsx`:

```javascript
import React, { useState } from "react";
import { BaseSolicitudesView } from "../../../shared/solicitudes/BaseSolicitudesView";
import { [modulo]ActionCards, [modulo]FilterConfig } from "../../config/solicitudesConfig";
import { useSolicitudes } from "../../../shared/solicitudes/hooks/useSolicitudes";
import { useModalManager } from "../../../shared/solicitudes/hooks/useModalManager";
import { getRequests } from "../../../../core/api/requestsApi";
import VacationRequestModal from "../../../shared/solicitudes/modals/VacationRequestModal";
// Importar modales específicos
import TipoSolicitud1Modal from "./modals/TipoSolicitud1Modal";

const [Rol]ManagerSolicitudesView = () => {
  const [filters, setFilters] = useState({});

  const { solicitudes, loading, reload } = useSolicitudes({
    fetchFunction: async (filters) => {
      const response = await getRequests({ page: 1, limit: 100, ...filters });
      return response;
    },
    parseResponse: (res) => res.rows || res.data || [],
    autoLoad: true
  });

  const { openModal, closeModal, isOpen } = useModalManager();

  return (
    <>
      <BaseSolicitudesView
        actionCards={[modulo]ActionCards}
        onActionCardClick={(cardId) => openModal(cardId)}
        enableFilters={true}
        filterConfig={[modulo]FilterConfig}
        filters={filters}
        onFilterChange={setFilters}
        onRefresh={reload}
        enableGrid={true}
        solicitudes={solicitudes}
        loading={loading}
      />

      {/* Modales */}
      <TipoSolicitud1Modal
        open={isOpen("tipo-solicitud-1")}
        onClose={() => closeModal("tipo-solicitud-1")}
        onSuccess={reload}
      />
      
      <VacationRequestModal
        open={isOpen("vacaciones")}
        onClose={() => closeModal("vacaciones")}
        onSuccess={reload}
      />
    </>
  );
};

export default [Rol]ManagerSolicitudesView;
```

### Vista Employee

Crear `src/modules/[modulo]/components/solicitudes/[Rol]EmployeeSolicitudesView.jsx`:

Seguir el mismo patrón pero:
- Filtrar action cards permitidos según `roleConfig`
- Filtrar solicitudes para mostrar solo las del usuario
- Personalizar títulos y configuración

## Paso 4: Implementar Modales Específicos

Para cada tipo de solicitud, crear un modal en `src/modules/[modulo]/components/solicitudes/modals/`:

```javascript
import React, { useState } from "react";
import { FiX, FiIcon } from "react-icons/fi";
import { useUI } from "../../../../../core/ui/UIContext";
import Button from "../../../../../core/ui/components/Button";

const TipoSolicitudModal = ({ open, onClose, onSuccess }) => {
  const { showToast } = useUI();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    campo1: "",
    campo2: ""
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // TODO: Llamar al API
      // await createSolicitud(formData);
      
      showToast("Solicitud creada exitosamente", "success");
      onSuccess?.();
      onClose();
    } catch (error) {
      showToast("Error al crear la solicitud", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FiIcon className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold">Título del Modal</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Campos del formulario */}
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? "Creando..." : "Crear"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TipoSolicitudModal;
```

## Paso 5: Crear Página de Solicitudes

Crear `src/modules/[modulo]/pages/Solicitudes.jsx`:

```javascript
import React from "react";
import { useAuth } from "../../../core/auth/AuthContext";
import [Rol]ManagerSolicitudesView from "../components/solicitudes/[Rol]ManagerSolicitudesView";
import [Rol]EmployeeSolicitudesView from "../components/solicitudes/[Rol]EmployeeSolicitudesView";

const SolicitudesPage = () => {
  const { user } = useAuth();

  const renderView = () => {
    const role = (user?.role ||user?.role_name || "").toLowerCase();

    if (role.includes("jefe") || role.includes("gerente") || role.includes("director")) {
      return <[Rol]ManagerSolicitudesView />;
    }

    return <[Rol]EmployeeSolicitudesView />;
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Solicitudes
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Gestiona y da seguimiento a todas las solicitudes de [Módulo]
        </p>
      </div>

      {renderView()}
    </div>
  );
};

export default SolicitudesPage;
```

## Paso 6: Agregar Ruta al Router

En el archivo de rutas del módulo (ej: `src/modules/[modulo]/[Modulo]Routes.jsx`):

```javascript
import Solicitudes from './pages/Solicitudes';

// Dentro del router
<Route path="/[modulo]/solicitudes" element={<Solicitudes />} />
```

## Paso 7: Agregar Link en NavigationBar

En `NavigationBar.jsx` o el componente de navegación del módulo:

```javascript
{
  path: "/[modulo]/solicitudes",
  label: "Solicitudes",
  icon: FiClipboard
}
```

## Paso 8: Verificación

### Checklist de Verificación:

- [ ] Action cards se muestran correctamente
- [ ] Click en cada action card abre el modal correspondiente
- [ ] Modales tienen validación correcta
- [ ] Vista manager ve todas las solicitudes
- [ ] Vista employee ve solo sus solicitudes
- [ ] Filtros funcionan correctamente
- [ ] Grid de solicitudes se renderiza
- [ ] Paginación funciona
- [ ] Diseño responsive funciona en mobile/tablet
- [ ] Sin errores en consola
- [ ] Hot reload funciona sin errores

### Comandos de Verificación:

```bash
# Compilar sin errores
npm run build

# Ejecutar en desarrollo
npm start
```

## Notas Importantes

1. **Vacaciones siempre debe estar incluido**: Es un action card común a todos los módulos
2. **Colores disponibles**: blue, emerald, purple, amber, indigo, orange, red
3. **Iconos**: Usar react-icons/fi para consistencia
4. **Nombres de archivos**: Usar PascalCase para componentes
5. **IDs de action cards**: Usar kebab-case (ej: "orden-servicio")

## Ejemplo Completo: Finanzas

Ver implementación completa de Servicio Técnico como referencia en:
- `src/modules/servicio/config/solicitudesConfig.js`
- `src/modules/servicio/components/solicitudes/`
- `src/modules/servicio/pages/Solicitudes.jsx`
