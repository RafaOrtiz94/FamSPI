// Comodato iniciado desde el selector de compras cuyo Business Case aun no
// genero expediente: el expediente real se crea al completar las secciones
// comerciales del BC (preflow). Mientras tanto se lista en el Workspace de
// Compras como fila "en preparacion" que abre el BC; no es un expediente.
const BC_TYPE_TO_PURCHASE_TYPE = {
  public: 'public',
  comodato_publico: 'public',
  private_comodato: 'private',
  comodato_privado: 'private',
};

export const normalizePreparingBusinessCase = (bc) => {
  const type = BC_TYPE_TO_PURCHASE_TYPE[String(bc?.bc_purchase_type || '').toLowerCase()];
  const metadata = bc?.modern_bc_metadata || {};
  const bcId = bc?.business_case_id || bc?.id;
  const hasPurchase = metadata.preflow_process_id || metadata.private_purchase_id || metadata.purchase_workspace?.purchase_id;
  // preflow_enabled: solo los BC nacidos del selector; deja fuera los BC historicos sin expediente.
  if (!type || !bcId || hasPurchase || !metadata.preflow_enabled) return null;
  if (String(bc?.bc_stage || '').toLowerCase() === 'cerrado_no_factible') return null;
  if (String(bc?.status || '').toLowerCase().includes('cancel')) return null;
  return {
    id: bcId,
    type,
    preparing: true,
    title: bc.client_name || 'Cliente sin registrar',
    subtitle: 'Business Case en curso, aun sin expediente de compras',
    status: 'en preparacion',
    modality: 'Comodato',
    purchase_type: type,
    created_at: bc.created_at,
    updated_at: bc.updated_at || bc.created_at,
    raw: bc,
  };
};
