import React, { useEffect, useState } from 'react';
import { listBcAvailability } from '../../../../../core/api/bcAvailabilityApi';

const STATUS_LABELS = {
  requested: 'Pendiente de ACP',
  in_progress: 'ACP consultando proveedores',
  confirmed: 'Confirmada',
  rejected: 'No disponible',
  cu_pending: 'Disponible en CU (aprobación del cliente)',
  import_pending: 'Solo importación (compromiso del cliente)',
};
const SUPPLIER_RESULTS = {
  available_new: 'Disponible nuevo',
  available_cu: 'Disponible CU',
  import_only: 'Solo importación',
  unavailable: 'No disponible',
};

/**
 * Solo lectura: consultas de disponibilidad hechas desde el Business Case antes
 * de que existiera el expediente. La disponibilidad se gestiona en este tab; esto
 * evita repetir al proveedor una consulta que ACP ya respondió en el BC.
 * Roles sin acceso a esas solicitudes (403) simplemente no ven el bloque.
 */
const BusinessCaseAvailabilityHistory = ({ businessCaseId }) => {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    if (!businessCaseId) return undefined;
    let cancelled = false;
    listBcAvailability({ businessCaseId })
      .then((rows) => { if (!cancelled) setRequests(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (!cancelled) setRequests([]); });
    return () => { cancelled = true; };
  }, [businessCaseId]);

  if (!requests.length) return null;

  return (
    <div className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient">
      <h3 className="text-sm font-semibold text-ink-slate">Consultado en Business Case</h3>
      <p className="mt-1 mb-4 text-xs text-warm-ash">
        Consultas previas a este expediente. Revísalas antes de volver a consultar al proveedor.
      </p>
      <div className="space-y-3">
        {requests.map((request) => (
          <div key={request.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-ink-slate">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{request.equipment_name || `Equipo ${request.servicio_equipo_id}`}</span>
              <span className="font-medium">{STATUS_LABELS[request.status] || request.status}</span>
            </div>
            {request.result_notes && <p className="mt-1 text-slate-600">{request.result_notes}</p>}
            {(request.queries || []).map((query) => (
              <p key={query.id} className="mt-1 text-slate-600">
                {query.provider_email}: {SUPPLIER_RESULTS[query.response_result] || 'Sin respuesta'}
                {query.response_notes ? ` — ${query.response_notes}` : ''}
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BusinessCaseAvailabilityHistory;
