// Logica de flow_state compartida entre BusinessCasePicker y los widgets de
// "pendientes" de cada dashboard por rol. Unica fuente de verdad -- antes
// vivia solo dentro de BusinessCasePicker.jsx.

// Colores por codigo de flow_state (calculado en el backend, ver
// deriveBusinessCaseFlowState en businessCase.service.js).
export const FLOW_STATE_COLORS = {
  borrador: 'bg-gray-100 text-gray-800',
  pendiente_comercial: 'bg-blue-100 text-blue-800',
  pendiente_servicio: 'bg-purple-100 text-purple-800',
  pendiente_financiero: 'bg-amber-100 text-amber-800',
  en_evaluacion_viabilidad: 'bg-cyan-100 text-cyan-800',
  viable: 'bg-emerald-100 text-emerald-800',
  no_viable: 'bg-rose-100 text-rose-800',
  ajustes_operativos: 'bg-indigo-100 text-indigo-800',
  cerrado_aprobacion: 'bg-teal-100 text-teal-800',
  rechazado_gerencia: 'bg-red-100 text-red-800',
  cancelado: 'bg-slate-200 text-slate-700',
};

// De quien es el turno segun flow_state.code -- roles que deben actuar para
// que el BC avance. Mismos grupos de rol reales usados por el backend
// (DETERMINATIONS_REACTIVO_*_ROLES / DETERMINATIONS_TECH_EDIT_ROLES /
// INVESTMENT_VALUES_FIN_ROLES en businessCase.controller.js), no inventados.
export const FLOW_STATE_PENDING_ROLES = {
  pendiente_comercial: ['comercial', 'asesor_comercial', 'analista_comercial', 'acp_comercial', 'jefe_comercial', 'backoffice', 'backoffice_comercial'],
  pendiente_servicio: ['tecnico', 'ing_servicio', 'jefe_tecnico', 'jefe_servicio', 'jefe_servicio_tecnico'],
  pendiente_financiero: ['jefe_financiero', 'jefe_operaciones'],
  en_evaluacion_viabilidad: ['jefe_comercial', 'acp_comercial', 'gerencia', 'gerencia_general'],
};

export const isPendingForUser = (bc, role) => {
  const pendingRoles = FLOW_STATE_PENDING_ROLES[bc?.flow_state?.code];
  return Boolean(pendingRoles && pendingRoles.includes(role));
};

export const getFlowStateBadge = (bc) => {
  if (bc?.flow_state?.code) {
    return {
      label: bc.flow_state.label,
      className: FLOW_STATE_COLORS[bc.flow_state.code] || 'bg-gray-100 text-gray-800',
    };
  }
  return { label: bc?.current_stage || 'Sin estado', className: 'bg-gray-100 text-gray-800' };
};

// Unico resolver de origen de compra (publica/privada) -- antes existia
// duplicado con heuristicas ligeramente distintas en BusinessCasePicker.jsx
// y CaseHeader.jsx. Acepta tanto una fila de BC "plana" (como las del
// Picker) como un objeto uiGuidance con businessCase anidado (como en el
// workspace).
export const resolvePurchaseOrigin = (source = {}) => {
  const bc = source?.businessCase || source || {};
  const metadata = bc?.modern_bc_metadata || source?.modern_bc_metadata || {};
  const candidates = [
    bc?.bc_purchase_type,
    bc?.bcPurchaseType,
    bc?.purchase_type,
    metadata?.purchase_type,
    metadata?.source_module,
    metadata?.sourceModule,
    metadata?.origin,
    metadata?.workflow_origin,
    metadata?.flow_origin,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);

  const hasPublicSignal = candidates.some(
    (value) =>
      value.includes('public') ||
      value.includes('publico') ||
      value.includes('equipment_purchases') ||
      value.includes('public_purchase'),
  );
  if (hasPublicSignal) return 'publica';

  const hasPrivateSignal = candidates.some(
    (value) =>
      value.includes('private') ||
      value.includes('privado') ||
      value.includes('privada') ||
      value.includes('private_purchases') ||
      value.includes('private_purchase'),
  );
  if (hasPrivateSignal) return 'privada';

  return 'no_definida';
};

// Unico mapa rol->etiqueta legible del Business Case -- antes vivia solo
// dentro de CaseHeader.jsx y SectionContent.jsx mostraba el rol crudo
// (ej. "jefe_operaciones") sin pasar por ningun mapa.
export const roleToLabel = (role) => {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'acp_comercial') return 'Analista de Compras Publicas';
  if (normalized === 'backoffice_comercial') return 'Backoffice Comercial';
  if (normalized === 'jefe_servicio' || normalized === 'jefe_servicio_tecnico') return 'Jefe de Servicio';
  if (normalized === 'jefe_comercial') return 'Jefe Comercial';
  if (normalized === 'jefe_financiero') return 'Jefe Financiero';
  if (normalized === 'jefe_operaciones') return 'Jefe de Operaciones';
  if (normalized === 'jefe_tecnico') return 'Jefe Tecnico';
  if (normalized === 'comercial') return 'Comercial';
  if (normalized === 'gerencia') return 'Gerencia';
  if (normalized === 'gerencia_general') return 'Gerencia General';
  return normalized || 'N/D';
};

export const getPurchaseOriginBadge = (origin) => {
  if (origin === 'publica') return { label: 'Compra publica', className: 'bg-emerald-100 text-emerald-800' };
  if (origin === 'privada') return { label: 'Compra privada', className: 'bg-indigo-100 text-indigo-800' };
  return { label: 'Origen no definido', className: 'bg-slate-100 text-slate-700' };
};
