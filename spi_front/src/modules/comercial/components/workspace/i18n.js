/**
 * Traducciones para el workspace del Business Case
 * Centraliza todos los textos en español para mantener consistencia
 */

export const WORKSPACE_TEXTS = {
  // Ownership Panel
  ownership: {
    title: 'Propiedad y Finalización',
    currentSection: 'Sección actual',
    owner: 'Responsable',
    lastModified: 'Última modificación',
    takeOwnership: 'Tomar propiedad',
    markComplete: 'Marcar como completado',
    sectionStatus: 'Estado por sección',
    refresh: 'Actualizar',
    errorLoading: 'Error cargando ownership',
    errorTaking: 'Error tomando ownership',
    errorCompleting: 'Error completando sección'
  },

  // UI Guidance Panel
  guidance: {
    title: 'Guía de interfaz',
    refresh: 'Actualizar',
    errorLoading: 'Error cargando guidance',
    noGuidance: 'No hay guidance disponible'
  },

  // Section Guidance
  sections: {
    general: {
      title: 'Datos Generales',
      description: 'Información básica del cliente y requerimientos del proyecto',
      tips: [
        'Complete toda la información del cliente',
        'Especifique claramente los requerimientos del proyecto',
        'Indique urgencia y fecha esperada de entrega'
      ],
      warnings: ['Complete esta sección primero']
    },
    lab: {
      title: 'Entorno Laboratorio',
      description: 'Configuración operativa y parámetros del laboratorio',
      tips: [
        'Defina horas operativas del laboratorio',
        'Indique capacidad para emergencias',
        'Especifique volumen de muestras esperado'
      ],
      warnings: ['Asegúrese de que los parámetros sean realistas']
    },
    equipment: {
      title: 'Equipamiento',
      description: 'Selección y configuración de equipos médicos',
      tips: [
        'Seleccione equipos compatibles',
        'Defina cantidades necesarias',
        'Considere equipos primarios vs respaldo'
      ],
      warnings: ['Verifique compatibilidad entre equipos']
    },
    lis: {
      title: 'Integración LIS',
      description: 'Sistema de información laboratorio y interfaces',
      tips: [
        'Defina el sistema LIS actual',
        'Especifique interfaces necesarias',
        'Calcule horas de entrenamiento requeridas'
      ],
      warnings: ['La integración LIS es crítica para el éxito del proyecto']
    },
    determinations: {
      title: 'Determinaciones',
      description: 'Análisis clínicos y cuantificaciones por período',
      tips: [
        'Especifique determinaciones por mes y año',
        'Indique pruebas de urgencia',
        'Considere picos de demanda'
      ],
      warnings: ['Los números deben ser realistas y justificables']
    },
    investments: {
      title: 'Inversiones Adicionales',
      description: 'Costos adicionales y presupuesto de inversiones',
      tips: [
        'Incluya todos los costos asociados',
        'Especifique tiempos de entrega',
        'Considere requerimientos de instalación'
      ],
      warnings: ['No subestime costos adicionales']
    },
    prices: {
      title: 'Definición de Precios',
      description: 'Establecimiento de precios y márgenes',
      tips: [
        'Calcule márgenes apropiados',
        'Considere competencia local',
        'Incluya costos operativos'
      ],
      warnings: ['Los precios deben ser competitivos pero rentables']
    },
    calculations: {
      title: 'Cálculos Técnicos',
      description: 'Análisis de viabilidad técnica y operativa',
      tips: [
        'Verifique todos los cálculos',
        'Compare con estándares de la industria',
        'Documente supuestos realizados'
      ],
      warnings: ['Los cálculos deben ser verificables']
    },
    rentability: {
      title: 'Análisis de Rentabilidad',
      description: 'ROI, payback y análisis financiero',
      tips: [
        'Calcule período de recuperación',
        'Analice sensibilidad de variables',
        'Compare con alternativas'
      ],
      warnings: ['El análisis financiero es crucial para la aprobación']
    }
  },

  // Common labels
  common: {
    tips: '💡 Consejos:',
    warnings: '⚠️ Advertencias:',
    currentStatus: 'Estado actual:',
    availableTransitions: 'Transiciones disponibles:',
    permissions: 'Permisos:',
    readOnly: '👁️ Solo lectura',
    edit: '✏️ Editar'
  },

  // Status mappings
  statusLabels: {
    draft: 'Borrador',
    waiting_proforma: 'Esperando proforma',
    new: 'Nuevo',
    promote: 'Promover',
    observe: 'Observar',
    complete: 'Completado'
  }
};

// Helper function para obtener guidance de sección
export const getSectionGuidance = (section) => {
  return WORKSPACE_TEXTS.sections[section] || {
    title: 'Sección',
    description: 'Seleccione una sección para ver guidance',
    tips: [],
    warnings: []
  };
};

// Helper function para mapear status
export const getStatusLabel = (status) => {
  return WORKSPACE_TEXTS.statusLabels[status] || status;
};