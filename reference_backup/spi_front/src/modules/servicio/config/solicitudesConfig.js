import { FiTool, FiPackage, FiClipboard, FiSettings, FiCalendar } from "react-icons/fi";

/**
 * Configuración de action cards para el módulo de Servicio Técnico
 */
export const servicioActionCards = [
    {
        id: "orden-servicio",
        subtitle: "Mantenimiento",
        title: "Orden de Servicio",
        color: "blue",
        icon: FiTool,
        description: "Crear orden de trabajo para mantenimiento o reparación",
        chips: ["Urgente", "Programado"]
    },
    {
        id: "repuestos",
        subtitle: "Inventario",
        title: "Requerimiento de Repuestos",
        color: "purple",
        icon: FiPackage,
        description: "Solicitar partes y componentes necesarios"
    },
    {
        id: "inspeccion",
        subtitle: "Calidad",
        title: "Inspección Técnica",
        color: "amber",
        icon: FiClipboard,
        description: "Programar inspección preventiva o correctiva"
    },
    {
        id: "prestamo",
        subtitle: "Equipos",
        title: "Préstamo de Equipos",
        color: "indigo",
        icon: FiSettings,
        description: "Solicitar equipos temporales para clientes"
    },
    {
        id: "vacaciones",
        subtitle: "Talento Humano",
        title: "Vacaciones",
        color: "orange",
        icon: FiCalendar,
        description: "Solicitar días de vacaciones"
    }
];

/**
 * Mapeo de vistas por rol
 */
export const servicioRoleConfig = {
    // Jefe/Gerente/Director - Vista completa
    manager: {
        allowedCards: "all", // Todos los action cards
        features: {
            widgets: ["aprobaciones-pendientes", "equipo-disponibilidad"],
            gridScope: "all", // Ver todas las solicitudes del área
            canApprove: true,
            canAssign: true
        }
    },

    // Técnico - Vista limitada
    technician: {
        allowedCards: ["orden-servicio", "repuestos", "prestamo", "vacaciones"],
        features: {
            widgets: ["mis-solicitudes", "mi-disponibilidad"],
            gridScope: "own", // Solo sus solicitudes
            canApprove: false,
            canAssign: false
        }
    }
};

/**
 * Configuración de filtros para solicitudes de Servicio Técnico
 */
export const servicioFilterConfig = {
    enableSearch: true,
    searchPlaceholder: "Buscar por cliente, equipo o descripción...",
    statusFilter: {
        enabled: true,
        options: [
            { value: "pending", label: "Pendiente" },
            { value: "in_progress", label: "En Proceso" },
            { value: "completed", label: "Completado" },
            { value: "cancelled", label: "Cancelado" }
        ]
    },
    customFilters: [
        {
            id: "technician",
            type: "select",
            label: "Técnico Asignado",
            options: [] // Se cargará dinámicamente
        },
        {
            id: "priority",
            type: "select",
            label: "Prioridad",
            options: [
                { value: "low", label: "Baja" },
                { value: "medium", label: "Media" },
                { value: "high", label: "Alta" },
                { value: "urgent", label: "Urgente" }
            ]
        }
    ]
};
