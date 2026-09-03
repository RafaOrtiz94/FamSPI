/**
 * roleSectionConfig.js
 *
 * Configuración de visibilidad y edición de secciones del Business Case por rol.
 *
 * LEYENDA:
 *   visible  → secciones que el rol puede ver (tab aparece en el navegador)
 *   canEdit  → secciones donde el rol puede guardar cambios directamente
 *
 * REGLAS GENERALES (documentadas en FLUJO_BUSINESS_CASE_COMPRAS.md v3):
 *   - comercial = asesor_comercial = analista_comercial (mismo nivel)
 *   - gerencia = gerencia_general (mismo nivel)
 *   - backoffice = backoffice_comercial (mismo nivel)
 *   - jefe_comercial = jefe_de_comercial (mismo nivel)
 *   - Secciones con 📩 (permiso requerido) están en canEdit pero el sistema de propiedad
 *     de ítems controla quién puede modificar qué dentro de la sección.
 *   - La sección "prices" SOLO la edita jefe_operaciones (regla absoluta, no configurable aquí).
 *   - investment_values: una sola vista; jefe_operaciones edita precio operativo y jefe_financiero precio financiero.
 *
 * CORRECCIONES APLICADAS (v3 — 2026-05-23):
 *   BC-02: analista_comercial mismo nivel que comercial
 *   BC-03: jefe_operaciones, jefe_tecnico, jefe_financiero, jefe_ti ven desde BORRADOR
 *   BC-04: gerencia = gerencia_general (configs idénticas)
 *   BC-05: solo comercial* edita general directamente; acp_comercial y backoffice con permiso
 *   BC-06: equipment → jefe_operaciones y jefe_tecnico son solo lectura
 *   BC-07: determinations → comercial es siempre solo lectura
 *   BC-08: determinations (reactivos) → acp_comercial edita solo en pública (lógica en componente)
 *   BC-09: determinations (reactivos) → backoffice edita solo en privada (lógica en componente)
 *   BC-10: jefe_ti puede ver y agregar ítems al carrito de inversiones
 *   BC-12: investment_values → solo jefe_operaciones y jefe_financiero; resto fuera de visible
 *   BC-14: feasibility → jefe_financiero y jefe_ti ven el resultado
 *   BC-15: emergency-transition → gerencia y gerencia_general tienen mismo nivel
 */

export const ROLE_SECTION_CONFIG = {

  // ─────────────────────────────────────────────────────────────────
  // GRUPO COMERCIAL — Editores principales de secciones comerciales
  // comercial = asesor_comercial = analista_comercial (BC-02)
  // ─────────────────────────────────────────────────────────────────
  comercial: {
    visible: [
      "general", "lab", "equipment", "lis", "determinations",
      "requirement", "investments", "consumption_export", "feasibility", "offer_workspace",
    ],
    canEdit: [
      // BC-07: NO edita determinations (solo lectura siempre)
      // BC-06: NO edita equipment (solo lectura)
      "general", "lab", "lis", "requirement", "investments", "consumption_export",
    ],
  },

  asesor_comercial: {
    // BC-02: mismo nivel que comercial
    visible: [
      "general", "lab", "equipment", "lis", "determinations",
      "requirement", "investments", "consumption_export", "feasibility", "offer_workspace",
    ],
    canEdit: [
      "general", "lab", "lis", "requirement", "investments", "consumption_export",
    ],
  },

  analista_comercial: {
    // BC-02: mismo nivel que comercial
    visible: [
      "general", "lab", "equipment", "lis", "determinations",
      "requirement", "investments", "consumption_export", "feasibility", "offer_workspace",
    ],
    canEdit: [
      "general", "lab", "lis", "requirement", "investments", "consumption_export",
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // ACP COMERCIAL — Punto de control. Puede editar con permiso (📩).
  // ─────────────────────────────────────────────────────────────────
  acp_comercial: {
    visible: [
      "general", "lab", "equipment", "lis", "determinations",
      "requirement", "investments", "consumption_export",
      "dispatch_workspace", "feasibility", "offer_workspace",
    ],
    canEdit: [
      // BC-05/BC-08: edición de general/equipment/determinations-reactivos con permiso (📩)
      // El sistema de propiedad de ítem controla acceso fino dentro de cada sección.
      "general", "lab", "equipment", "lis", "determinations",
      "requirement", "investments", "consumption_export",
      "dispatch_workspace", "feasibility",
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // BACKOFFICE — Soporte documental.
  // Puede editar determinations (reactivos) SOLO en compra privada (lógica en componente).
  // ─────────────────────────────────────────────────────────────────
  backoffice: {
    // BUG-04: backoffice NO accede a feasibility (PASO BC-7: sin acceso)
    visible: [
      "general", "lab", "requirement", "equipment", "lis",
      "determinations", "investments", "consumption_export",
    ],
    canEdit: [
      // BC-09: determinations incluido — la restricción pública/privada se evalúa en el componente
      // BC-06: equipment visible pero NO editable
      "general", "lab", "requirement", "lis",
      "determinations", "investments", "consumption_export",
    ],
  },

  backoffice_comercial: {
    // BC-04 equiv: backoffice = backoffice_comercial
    // BUG-04: backoffice_comercial tampoco accede a feasibility
    visible: [
      "general", "lab", "requirement", "equipment", "lis",
      "determinations", "investments", "consumption_export",
    ],
    canEdit: [
      "general", "lab", "requirement", "lis",
      "determinations", "investments", "consumption_export",
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // JEFE COMERCIAL — Puede editar directamente. Ve investment_values pero no los edita.
  // ─────────────────────────────────────────────────────────────────
  jefe_comercial: {
    visible: [
      "general", "lab", "equipment", "lis", "determinations",
      "requirement", "investments",
      "investment_values",   // BC-12: ve pero no guarda
      "consumption_export", "dispatch_workspace", "feasibility", "offer_workspace",
    ],
    canEdit: [
      // BC-12: investment_values NO en canEdit — jefe_comercial es solo lectura ahí
      "general", "lab", "equipment", "lis", "determinations",
      "requirement", "investments", "consumption_export",
      "dispatch_workspace", "feasibility",
    ],
  },

  jefe_de_comercial: {
    // BC-04 equiv: jefe_de_comercial = jefe_comercial
    visible: [
      "general", "lab", "equipment", "lis", "determinations",
      "requirement", "investments",
      "investment_values",
      "consumption_export", "dispatch_workspace", "feasibility", "offer_workspace",
    ],
    canEdit: [
      "general", "lab", "equipment", "lis", "determinations",
      "requirement", "investments", "consumption_export",
      "dispatch_workspace", "feasibility",
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // GERENCIA — BC-04: gerencia = gerencia_general (configs idénticas)
  // Solo lectura en todo excepto feasibility (puede emitir decisión).
  // ─────────────────────────────────────────────────────────────────
  gerencia: {
    visible: [
      "general", "lab", "equipment", "lis", "determinations",
      "requirement", "investments",
      "investment_values",
      "consumption_export", "dispatch_workspace", "feasibility",
    ],
    canEdit: ["feasibility"],
  },

  gerencia_general: {
    // BC-04: idéntico a gerencia
    visible: [
      "general", "lab", "equipment", "lis", "determinations",
      "requirement", "investments",
      "investment_values",
      "consumption_export", "dispatch_workspace", "feasibility",
    ],
    canEdit: ["feasibility"],
  },

  // ─────────────────────────────────────────────────────────────────
  // OPERACIONES — Solo lectura en secciones técnicas/comerciales.
  // dispatch_workspace editable (control operativo).
  // ─────────────────────────────────────────────────────────────────
  operaciones: {
    visible: ["equipment", "determinations", "investments", "dispatch_workspace", "feasibility"],
    canEdit: [
      // BC-06/BC-07: equipment y determinations son solo lectura
      "investments",
      "dispatch_workspace",
    ],
  },

  jefe_operaciones: {
    visible: [
      // BC-03: ve el BC desde BORRADOR — acceso a secciones relevantes
      "general", "lab", "equipment", "lis", "determinations",
      "requirement", "investments",
      "investment_values",  // BC-12: edita valores operativos
      "dispatch_workspace", "feasibility",
    ],
    canEdit: [
      // BC-06: equipment → solo lectura (antes era editable)
      // BC-07: determinations → solo lectura (antes era editable)
      "investments",
      "investment_values",
      "dispatch_workspace",
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // FINANCIERO — Edita precio financiero en investment_values y puede agregar al carrito.
  // BC-14: ve el resultado de feasibility.
  // ─────────────────────────────────────────────────────────────────
  jefe_financiero: {
    visible: [
      // BC-03: ve el BC desde BORRADOR
      "general", "lab", "equipment", "lis", "determinations",
      "investments",
      "investment_values",  // BC-12: edita valores financieros
      "feasibility",             // BC-14: ve resultado de viabilidad
    ],
    canEdit: [
      "investments",             // puede agregar ítems al carrito
      "investment_values",
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // TÉCNICO — Los roles válidos son solo: tecnico y jefe_tecnico.
  // BUG-08: servicio_tecnico y jefe_servicio_tecnico no son roles del sistema.
  // BC-06: equipment solo lectura. determinations editable (calibradores,
  //        controles, materiales — no reactivos). Lógica en componente.
  // ─────────────────────────────────────────────────────────────────
  jefe_tecnico: {
    visible: [
      // BC-03: ve el BC desde BORRADOR
      "general", "lab", "equipment", "lis", "determinations",
      "requirement", "investments", "feasibility",
    ],
    canEdit: [
      // BC-06: equipment → solo lectura (antes era editable)
      "determinations",   // calibradores, controles, materiales (no reactivos)
      "investments",      // puede agregar ítems al carrito
    ],
  },

  jefe_servicio: {
    visible: [
      "general", "lab", "equipment", "lis", "determinations",
      "requirement", "investments", "feasibility",
    ],
    canEdit: [
      "determinations",
      "investments",
    ],
  },

  ing_servicio: {
    visible: [
      "general", "lab", "equipment", "lis", "determinations",
      "requirement", "investments", "feasibility",
    ],
    canEdit: [
      "investments",
    ],
  },

  esp_app: {
    visible: [
      "general", "lab", "equipment", "lis", "determinations",
      "requirement", "investments", "feasibility",
    ],
    canEdit: [
      "investments",
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // TI — BC-10: puede ver secciones clave y agregar ítems al carrito.
  // BC-14: ve resultado de feasibility.
  // ─────────────────────────────────────────────────────────────────
  jefe_ti: {
    visible: [
      "general", "lab", "equipment", "lis", "determinations",
      "investments", "feasibility",
    ],
    canEdit: [
      "investments",  // BC-10: puede agregar ítems al carrito
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // ADMIN — Acceso completo a todo
  // ─────────────────────────────────────────────────────────────────
  admin: {
    visible: "all",
    canEdit: "all",
  },

  administrador: {
    visible: "all",
    canEdit: "all",
  },
};

/**
 * Resuelve la configuración de sección para un rol dado.
 * Soporta alias de roles (jefe_de_comercial → jefe_comercial, etc.).
 */
export function resolveRoleSectionConfig(role = "") {
  const normalizedRole = String(role || "").toLowerCase().trim();

  // Alias directos para roles equivalentes
  const roleAliases = {
    "jefe_de_comercial": "jefe_comercial",
    "backoffice_comercial": "backoffice",
    "administrador": "admin",
    // gerencia y gerencia_general ya están definidos por separado con configs idénticas
  };

  const resolvedRole = roleAliases[normalizedRole] ?? normalizedRole;
  return ROLE_SECTION_CONFIG[resolvedRole] || { visible: [], canEdit: [] };
}

/**
 * Verifica si un rol puede editar una sección específica.
 */
export function canRoleEditSection(roleConfig, sectionId) {
  if (!roleConfig) return false;
  if (roleConfig.canEdit === "all") return true;
  return Array.isArray(roleConfig.canEdit)
    ? roleConfig.canEdit.includes(sectionId)
    : false;
}

/**
 * Verifica si un rol puede ver una sección específica.
 */
export function canRoleViewSection(roleConfig, sectionId) {
  if (!roleConfig) return false;
  if (roleConfig.visible === "all") return true;
  return Array.isArray(roleConfig.visible)
    ? roleConfig.visible.includes(sectionId)
    : false;
}

/**
 * Retorna las secciones visibles para un rol, filtradas por las secciones disponibles.
 */
export function getVisibleSections(role = "", availableSections = []) {
  const config = resolveRoleSectionConfig(role);
  if (config?.visible === "all") return availableSections;
  if (Array.isArray(config?.visible)) {
    return availableSections.filter((s) => config.visible.includes(s));
  }
  return [];
}
