# Guía de Estándar Visual de Solicitudes - FamSPI

Esta guía define la estructura visual y los estándares de UX/UI para las secciones de solicitudes en todo el sistema. El objetivo es mantener la consistencia y facilitar la navegación del usuario.

## 1. Estructura de la Página (Layout)

Todas las páginas de solicitudes deben seguir este orden jerárquico:

1.  **Header Principal**: Título grande, descripción breve y (opcionalmente) un resumen rápido de totales.
2.  **Navegación de Tabs** (Si aplica):
    *   **Vista General**: Dashboard con KPIs y acciones rápidas.
    *   **Mis Solicitudes**: La sección operativa principal.
    *   **Análisis**: Gráficos y reportes (reservado para roles de gerencia).
3.  **Contenido de "Mis Solicitudes"** (vía `BaseSolicitudesView`):
    *   **Sección de Creación**: Botones llamativos (Action Cards) para iniciar flujos.
    *   **Sección de Resumen (Widgets)**: Tarjetas pequeñas con contadores por categoría.
    *   **Sección de Listado (Filtros + Grid)**: Tabla o grid de tarjetas detallando cada solicitud.

---

## 2. Componentes Visuales Estándar

### A. Action Cards (Creación)
Se utilizan para representar las acciones que el usuario puede realizar.
*   **Colores Sugeridos**:
    *   `blue`: Inspecciones / Técnico
    *   `emerald`: Clientes / CRM
    *   `indigo`: Compras / Requerimientos
    *   `orange`: Talento Humano / Vacaciones
    *   `amber`: Logística / Retiros
    *   `purple`: Reportes / Especiales
*   **Iconografía**: Usar `react-icons/fi` (Feather Icons).

### B. Stat Widgets (Resumen)
Tarjetas de datos que muestran el estado actual de las solicitudes.
*   **Ubicación**: Entre la sección de creación y el listado general.
*   **Interacción**: Al hacer clic, deben abrir un `RequestsListModal` filtrado por ese tipo.

### C. Status Badges
Uso consistente de colores para estados:
*   **Pendiente**: Amber (Fondo claro, texto oscuro) `bg-amber-100 text-amber-700`.
*   **Aprobado**: Green `bg-green-100 text-green-700`.
*   **Rechazado**: Red `bg-red-100 text-red-700`.
*   **En Revisión**: Blue `bg-blue-100 text-blue-700`.
*   **Cancelado**: Gray `bg-gray-200 text-gray-600`.

---

## 3. Patrones de UX (Interacción)

### Creación de Solicitudes
1.  El usuario hace clic en una **Action Card**.
2.  Se abre un **Modal** específico para esa solicitud.
3.  El modal debe tener:
    *   Header con icono y título.
    *   Formulario con validaciones en tiempo real.
    *   Botón de cierre (X) y botones de acción al pie (Cancelar/Crear).
4.  Al éxito: Cerrar modal -> Mostrar Toast de éxito -> Recargar datos (`reload()`).

### Consulta de Solicitudes
1.  **Vista Rápida**: El usuario hace clic en un **Stat Widget**.
2.  Se abre un `RequestsListModal` que permite ver el grid filtrado sin cambiar de página.
3.  **Vista Detallada**: El usuario hace clic en una tarjeta del grid.
4.  Se abre un `RequestDetailModal` con toda la información técnica, documentos adjuntos y líneas de tiempo.

---

## 4. Implementación Técnica

Para implementar una nueva página, utilizar los componentes en `shared/solicitudes`:

| Componente | Propósito |
| :--- | :--- |
| `BaseSolicitudesView` | Organizador principal de secciones. |
| `useSolicitudes` | Hook para manejo de estado y carga de datos. |
| `useModalManager` | Hook para gestionar la apertura/cierre de múltiples modales. |
| `RequestStatWidget` | Widget para la sección de resumen. |
| `RequestsListModal` | Modal que encapsula el grid y filtros. |

---

## 5. Checklist de Verificación Visual

- [ ] ¿El Header tiene el título y descripción correctos?
- [ ] ¿Las Action Cards usan los colores del estándar?
- [ ] ¿Los iconos son consistentes (Feather Icons)?
- [ ] ¿Los estados (badges) siguen la paleta de colores definida?
- [ ] ¿Los modales se centran y tienen el overlay oscuro correcto?
- [ ] ¿Se utiliza el loader global al realizar peticiones (`showLoader`)?
- [ ] ¿Se muestran mensajes flotantes (Toasts) tras cada acción?
