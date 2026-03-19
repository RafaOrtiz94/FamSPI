import { useCallback } from 'react';
import { createBusinessCase } from '../../core/api/businessCaseApi';
import { getApiErrorMessage } from '../../core/utils/apiErrors';
import { PURCHASE_FAMILY } from './purchaseTypes';

export function usePreflowPurchaseStart({ navigate, showToast, showLoader, hideLoader }) {
 const startPreflow = useCallback(
 async ({ family, kind, origin = 'unknown' }) => {
 try {
 showLoader?.();
 const bcPayload = {
 client_name: 'Pendiente de definir',
 bc_purchase_type: family === PURCHASE_FAMILY.PUBLIC ? 'public' : 'private_comodato',
 status: 'draft',
 bc_stage: 'pending_comercial',
 modern_bc_metadata: {
 preflow_enabled: true,
 preflow_origin: 'purchase_selector',
 preflow_family: family,
 preflow_kind: kind,
 preflow_status: 'draft_commercial_sections',
 preflow_required_sections: ['general', 'lab', 'requirement', 'equipment', 'lis'],
 preflow_deadline_hours: 48,
 preflow_started_at: null,
 preflow_deadline_at: null,
 preflow_process_created: false,
 preflow_entry_origin: origin,
 },
 extra: {
 preflow: {
 enabled: true,
 family,
 kind,
 source: origin,
 },
 },
 };

 const created = await createBusinessCase(bcPayload);
 const bcId = created?.business_case_id || created?.id;
 if (!bcId) {
 throw new Error('No se pudo identificar el Business Case creado');
 }

 showToast?.('Business Case creado. Completa las secciones comerciales para iniciar el flujo de compras.', 'success');
 navigate?.(`/dashboard/business-case/workspace/${bcId}`);
 return { ok: true, businessCaseId: bcId };
 } catch (error) {
 showToast?.(getApiErrorMessage(error, 'No se pudo crear el Business Case'), 'error');
 return { ok: false, error };
 } finally {
 hideLoader?.();
 }
 },
 [hideLoader, navigate, showLoader, showToast],
 );

 return { startPreflow };
}
