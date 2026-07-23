/**
 * Traducciones para el workspace del Business Case
 * Centraliza todos los textos en espanol para mantener consistencia
 */

export const WORKSPACE_TEXTS = {
  // UI Guidance Panel
  guidance: {
    title: 'Guia de interfaz',
    refresh: 'Actualizar',
    errorLoading: 'Error cargando guidance',
    noGuidance: 'No hay guidance disponible'
  },

  // Section Guidance
  sections: {
    general: {
      title: 'Datos Generales',
      description: 'Datos base del cliente y del proceso antes de iniciar el analisis',
      tips: [
        'Complete datos del cliente, entidad contratante y objeto de contratacion',
        'Indique el codigo del proceso y notas de contexto cuando aplique',
        'Verifique que la informacion coincida con el registro del cliente'
      ],
      warnings: [
        'Complete esta seccion antes de avanzar al resto',
        'Al guardar se notifica a ACP y Backoffice para revision'
      ]
    },
    lab: {
      title: 'Entorno Laboratorio',
      description: 'Operacion del laboratorio y condiciones tecnicas del servicio',
      tips: [
        'Defina horarios y volumen estimado de muestras',
        'Incluya informacion de personal, turnos y urgencias',
        'Registre cualquier restriccion operativa relevante'
      ],
      warnings: [
        'Use datos reales del laboratorio para evitar reprocesos',
        'ACP y Backoffice pueden bloquear la seccion tras revision'
      ]
    },
    requirement: {
      title: 'Requerimiento del BC',
      description: 'Plazos, entregas y observaciones clave antes del calculo',
      tips: [
        'Registre el plazo y la proyeccion de plazo solicitados',
        'Defina si las entregas son totales o parciales y el tiempo estimado',
        'Marque si la determinacion efectiva aplica y agregue observaciones'
      ],
      warnings: ['Sin plazos y entregas no se puede evaluar factibilidad']
    },
    equipment: {
      title: 'Equipamiento',
      description: 'Seleccion de equipos principales y respaldo (opcional)',
      tips: [
        'Seleccione el equipo principal obligatorio',
        'El respaldo es opcional y solo si el cliente lo solicita',
        'Revise que los equipos correspondan al requerimiento del laboratorio'
      ],
      warnings: ['Evite seleccionar respaldo si el cliente no lo requiere']
    },
    lis: {
      title: 'Integracion LIS',
      description: 'Datos del sistema LIS e interfaces con equipos',
      tips: [
        'Indique si incluye LIS y proveedor del sistema',
        'Registre interfaces con el sistema actual y modelos de equipos',
        'Complete numero de pacientes mensual y hardware requerido'
      ],
      warnings: ['La integracion LIS impacta el cronograma y costos']
    },
    determinations: {
      title: 'Consumos anuales',
      description: 'Registro anual de determinaciones, reactivos, controles, calibradores y consumibles',
      tips: [
        'Ingrese el consumo anual de cada item segun el laboratorio',
        'Puede editar, eliminar o agregar nuevos items',
        'Use nombres claros y unicos para identificar cada item'
      ],
      warnings: [
        'Sin consumos anuales no se puede evaluar factibilidad',
        'Los reactivos los completan Comercial/ACP/Backoffice, los demas items el area tecnica'
      ]
    },
    investments: {
      title: 'Inversiones Adicionales',
      description: 'Seleccion de inversiones y necesidades del cliente',
      tips: [
        'Use la barra de busqueda para agregar inversiones del catalogo',
        'Si no existe, cree una inversion nueva para reutilizarla en futuros casos',
        'Registre cantidad, caracteristicas y observaciones requeridas'
      ],
      warnings: ['Complete cantidad y caracteristicas para evitar retrabajos']
    },
    prices: {
      title: 'Definicion de Precios',
      description: 'Establecimiento de precios y margenes',
      tips: [
        'Calcule margenes apropiados',
        'Considere competencia local y costos operativos',
        'Documente supuestos de precios'
      ],
      warnings: ['Los precios deben ser competitivos y rentables']
    },
    calculations: {
      title: 'Calculos Tecnicos',
      description: 'Analisis de viabilidad tecnica y operativa',
      tips: [
        'Verifique consistencia de datos antes de calcular',
        'Compare contra estandares internos',
        'Documente supuestos y riesgos'
      ],
      warnings: ['Los calculos deben ser verificables']
    },
    rentability: {
      title: 'Analisis de Rentabilidad',
      description: 'ROI, payback y analisis financiero',
      tips: [
        'Calcule periodo de recuperacion',
        'Analice sensibilidad de variables',
        'Compare con alternativas'
      ],
      warnings: ['El analisis financiero es clave para aprobacion']
    },
    consumption_export: {
      title: 'Resumen del Business Case',
      description: 'Resumen de solo lectura de todo lo registrado hasta este punto (sin precios)',
      tips: [
        'Las cantidades de reactivos/calibradores/controles/materiales se sincronizan desde el Sheet oficial',
        'Usa el bloque de Sheets en el header superior para abrir o actualizar el documento'
      ],
      warnings: []
    },
    dispatch_workspace: {
      title: 'Cantidades Maximas',
      description: 'Sincronizacion posterior a factibilidad de cantidades maximas y control operativo de despacho',
      tips: [
        'Sincronice las cantidades maximas desde el Sheet oficial',
        'Jefe Operaciones registra cantidades a despachar y avance despachado',
        'Los ajustes manuales previos se conservan para evitar perdida de datos'
      ],
      warnings: ['Debe existir consumo anual para que los elementos aparezcan en este workspace']
    },
    feasibility: {
      title: 'Factibilidad',
      description: 'Decision final del Business Case para cierre y continuidad en compras',
      tips: [
        'Sincronice primero el Sheet oficial desde la seccion de Sincronizacion',
        'ACP Comercial o Jefe Comercial deben registrar la decision final',
        'Si no es factible, seleccione la alternativa comercial que continuara en compras'
      ],
      warnings: ['La decision de factibilidad cierra el Business Case y bloquea nuevas ediciones']
    }
  },

  // Common labels
  common: {
    tips: 'Consejos:',
    warnings: 'Advertencias:',
    currentStatus: 'Estado actual:',
    availableTransitions: 'Transiciones disponibles:',
    permissions: 'Permisos:',
    readOnly: 'Solo lectura',
    edit: 'Editar'
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

// Helper function para obtener guidance de seccion
export const getSectionGuidance = (section) => {
  return WORKSPACE_TEXTS.sections[section] || {
    title: 'Seccion',
    description: 'Seleccione una seccion para ver guidance',
    tips: [],
    warnings: []
  };
};

// Helper function para mapear status
export const getStatusLabel = (status) => {
  return WORKSPACE_TEXTS.statusLabels[status] || status;
};
