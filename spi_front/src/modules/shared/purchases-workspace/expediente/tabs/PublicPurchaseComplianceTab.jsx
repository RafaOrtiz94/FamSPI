import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiAlertCircle,
  FiCheck,
  FiExternalLink,
  FiFileText,
  FiLock,
  FiRefreshCw,
  FiUpload,
} from 'react-icons/fi';

import {
  getEquipmentPurchaseApiError,
  getPublicPurchaseCompliance,
  updatePublicPurchaseComplianceProcedure,
  updatePublicPurchaseComplianceStatus,
  uploadPublicPurchaseComplianceEvidence,
  uploadPublicPurchaseSharedDocument,
} from '../../../../../core/api/equipmentPurchasesApi';

const PROCEDURE_LABELS = {
  infima_cuantia: 'Ínfima cuantía',
  subasta_inversa_electronica: 'Subasta inversa electrónica',
};

const statusTone = {
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  not_applicable: 'border-slate-200 bg-slate-100 text-slate-600',
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
};

const statusLabel = {
  completed: 'Cumplido',
  not_applicable: 'No aplica',
  pending: 'Pendiente',
};

function InlineError({ message }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      <FiAlertCircle className="mt-0.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

function SharedDocumentsLibrary({ documents, busyKey, onUpload }) {
  const [files, setFiles] = useState({});

  return (
    <section className="rounded-xl border border-slate-200 bg-white" aria-labelledby="shared-documents-title">
      <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
        <h3 id="shared-documents-title" className="text-sm font-semibold text-ink-slate">Documentos habilitantes reutilizables</h3>
        <p className="mt-1 text-xs leading-5 text-warm-ash">
          Se conservan por versión, se reutilizan en otros procesos y pueden actualizarse en cualquier momento.
        </p>
      </div>
      <div className="divide-y divide-slate-100">
        {documents.map((entry) => {
          const current = entry.document;
          const isBusy = busyKey === `shared:${entry.key}`;
          return (
            <div key={entry.key} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-slate">{entry.label}</p>
                {current ? (
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-warm-ash">
                    <span>Versión {current.version}</span>
                    <span className="truncate">{current.document_name}</span>
                    {current.drive_file_url && (
                      <a className="inline-flex items-center gap-1 font-medium text-action-blue hover:underline" href={current.drive_file_url} target="_blank" rel="noreferrer">
                        Ver <FiExternalLink aria-hidden="true" />
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-amber-700">Sin documento vigente</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-ink-slate hover:bg-slate-50">
                  <input
                    className="sr-only"
                    type="file"
                    onChange={(event) => setFiles((value) => ({ ...value, [entry.key]: event.target.files?.[0] || null }))}
                  />
                  {files[entry.key]?.name || 'Seleccionar'}
                </label>
                <button
                  type="button"
                  disabled={!files[entry.key] || isBusy}
                  onClick={async () => {
                    const result = await onUpload(entry.key, files[entry.key]);
                    if (result) setFiles((value) => ({ ...value, [entry.key]: null }));
                  }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-naval-slate px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FiUpload aria-hidden="true" />
                  {isBusy ? 'Guardando…' : current ? 'Actualizar' : 'Cargar'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function PublicPurchaseComplianceTab({ purchase }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [files, setFiles] = useState({});
  const [naNotes, setNaNotes] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getPublicPurchaseCompliance(purchase.id));
    } catch (requestError) {
      setError(getEquipmentPurchaseApiError(requestError, 'No se pudo cargar el control documental.').message);
    } finally {
      setLoading(false);
    }
  }, [purchase.id]);

  useEffect(() => { load(); }, [load]);

  const act = async (key, callback) => {
    setBusyKey(key);
    setActionError('');
    try {
      const result = await callback();
      if (result?.items) setData(result);
      return result;
    } catch (requestError) {
      setActionError(getEquipmentPurchaseApiError(requestError, 'No se pudo guardar el cambio.').message);
      return null;
    } finally {
      setBusyKey('');
    }
  };

  const requiredSummary = useMemo(() => {
    if (!data) return '';
    if (data.purchase.procedure_type === 'infima_cuantia') return 'Obligatorios: 3, 8, 9 y 20.';
    if (data.purchase.procedure_type === 'subasta_inversa_electronica') return 'Obligatorios: numerales 2 al 20, con las condiciones indicadas.';
    return 'Selecciona el procedimiento para activar la secuencia obligatoria.';
  }, [data]);

  if (loading && !data) {
    return <div className="min-h-48 animate-pulse rounded-xl border border-slate-200 bg-slate-50" aria-label="Cargando control documental" />;
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
        <InlineError message={error} />
        <button type="button" onClick={load} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-ink-slate ring-1 ring-slate-300">
          <FiRefreshCw aria-hidden="true" /> Reintentar
        </button>
      </div>
    );
  }

  if (!data) return null;

  const handleSharedUpload = (documentType, file) => act(`shared:${documentType}`, async () => {
    const sharedDocuments = await uploadPublicPurchaseSharedDocument(documentType, file);
    setData((current) => ({ ...current, shared_documents: sharedDocuments }));
    return sharedDocuments;
  });

  return (
    <div className="space-y-5">
      <header className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-action-blue">Cumplimiento documental</p>
            <h2 className="mt-1 text-xl font-semibold text-ink-slate">Checklist de compras públicas</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-warm-ash">
              Cada requisito obligatorio se habilita cuando el anterior está cumplido. Necesidad de contratación se registra como ítem independiente.
            </p>
          </div>
          <label className="block text-sm font-medium text-ink-slate">
            Procedimiento
            <select
              value={data.purchase.procedure_type || ''}
              disabled={busyKey === 'procedure'}
              onChange={(event) => act('procedure', () => updatePublicPurchaseComplianceProcedure(purchase.id, event.target.value))}
              className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-action-blue focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Seleccionar…</option>
              {data.procedure_types.map((type) => <option key={type} value={type}>{PROCEDURE_LABELS[type] || type}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div>
            <div className="mb-2 flex items-center justify-between gap-4 text-xs text-warm-ash">
              <span>{requiredSummary}</span>
              <strong className="shrink-0 text-ink-slate">{data.progress.completed}/{data.progress.required}</strong>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={data.progress.percentage} aria-valuemin="0" aria-valuemax="100">
              <div className="h-full bg-action-blue transition-[width]" style={{ width: `${data.progress.percentage}%` }} />
            </div>
          </div>
          <span className="text-sm font-semibold text-action-blue">{data.progress.percentage}%</span>
        </div>
      </header>

      <InlineError message={actionError} />

      <SharedDocumentsLibrary documents={data.shared_documents} busyKey={busyKey} onUpload={handleSharedUpload} />

      <section className="rounded-xl border border-slate-200 bg-white" aria-label="Secuencia de requisitos">
        <div className="divide-y divide-slate-100">
          {data.items.map((item) => {
            const isBusy = busyKey === item.key;
            const canAct = item.required && item.is_unlocked && !item.condition_pending;
            return (
              <article key={item.key} className={`grid gap-4 px-4 py-5 sm:px-5 lg:grid-cols-[48px_minmax(0,1fr)_minmax(240px,320px)] ${!item.required ? 'bg-slate-50/70' : ''}`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-bold ${item.status === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'}`}>
                  {item.status === 'completed' ? <FiCheck aria-label="Cumplido" /> : item.code}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink-slate">{item.title}</h3>
                    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statusTone[item.status]}`}>{statusLabel[item.status]}</span>
                    {item.independent && <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-action-blue">Independiente</span>}
                    {!item.required && !item.independent && <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500">No obligatorio</span>}
                  </div>
                  {item.help && <p className="mt-1 text-xs leading-5 text-warm-ash">{item.help}</p>}
                  {item.condition_message && <p className="mt-1 text-xs font-medium text-amber-700">{item.condition_message}</p>}
                  {item.notes && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Justificación: {item.notes}</p>}
                  {!!item.evidence.length && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.evidence.map((document) => (
                        <a key={document.id} href={document.drive_file_url || '#'} target="_blank" rel="noreferrer" className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-action-blue hover:bg-slate-50">
                          <FiFileText className="shrink-0" aria-hidden="true" />
                          <span className="truncate">{document.document_name}</span>
                          <FiExternalLink className="shrink-0" aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {!item.required && !item.independent ? (
                    <p className="flex min-h-11 items-center gap-2 text-xs text-slate-500"><FiLock aria-hidden="true" /> No forma parte de la secuencia de este procedimiento.</p>
                  ) : item.status === 'completed' || item.status === 'not_applicable' ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => act(item.key, () => updatePublicPurchaseComplianceStatus(purchase.id, item.key, 'pending'))}
                      className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-ink-slate hover:bg-slate-50 disabled:opacity-50"
                    >
                      {isBusy ? 'Guardando…' : 'Reabrir requisito'}
                    </button>
                  ) : !canAct ? (
                    <p className="flex min-h-11 items-center gap-2 rounded-lg bg-slate-50 px-3 text-xs text-slate-600"><FiLock aria-hidden="true" /> Completa el requisito obligatorio anterior.</p>
                  ) : item.shared_library ? (
                    <button
                      type="button"
                      disabled={isBusy || data.shared_documents.some((entry) => !entry.document)}
                      onClick={() => act(item.key, () => updatePublicPurchaseComplianceStatus(purchase.id, item.key, 'completed'))}
                      className="min-h-11 w-full rounded-lg bg-naval-slate px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isBusy ? 'Vinculando…' : 'Vincular vigentes y completar'}
                    </button>
                  ) : (
                    <>
                      <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-ink-slate hover:bg-slate-50">
                        <input
                          className="sr-only"
                          type="file"
                          onChange={(event) => setFiles((value) => ({ ...value, [item.key]: event.target.files?.[0] || null }))}
                        />
                        {files[item.key]?.name || 'Seleccionar evidencia'}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={!files[item.key] || isBusy}
                          onClick={() => act(item.key, () => uploadPublicPurchaseComplianceEvidence(purchase.id, item.key, files[item.key]))}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-800 disabled:opacity-50"
                        >
                          <FiUpload aria-hidden="true" /> Subir
                        </button>
                        <button
                          type="button"
                          disabled={!item.evidence.length || isBusy}
                          onClick={() => act(item.key, () => updatePublicPurchaseComplianceStatus(purchase.id, item.key, 'completed'))}
                          className="min-h-11 rounded-lg bg-naval-slate px-3 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Completar
                        </button>
                      </div>
                      {item.allows_not_applicable && (
                        <div className="space-y-2 border-t border-slate-100 pt-2">
                          <input
                            value={naNotes[item.key] || ''}
                            onChange={(event) => setNaNotes((value) => ({ ...value, [item.key]: event.target.value }))}
                            placeholder="Justificación de No aplica"
                            className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-xs outline-none focus:border-action-blue"
                          />
                          <button
                            type="button"
                            disabled={!naNotes[item.key]?.trim() || isBusy}
                            onClick={() => act(item.key, () => updatePublicPurchaseComplianceStatus(purchase.id, item.key, 'not_applicable', naNotes[item.key]))}
                            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-50"
                          >
                            Marcar No aplica
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="compliance-history-title">
        <h3 id="compliance-history-title" className="text-sm font-semibold text-ink-slate">Trazabilidad reciente</h3>
        {data.events.length ? (
          <ol className="mt-3 divide-y divide-slate-100">
            {data.events.slice(0, 10).map((event) => (
              <li key={event.id} className="grid gap-1 py-3 text-xs sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4">
                <span className="text-slate-700">
                  {event.action === 'procedure_selected' && 'Procedimiento seleccionado'}
                  {event.action === 'evidence_uploaded' && 'Evidencia cargada'}
                  {event.action === 'requirement_resolved' && 'Requisito resuelto'}
                  {event.action === 'requirement_reopened' && 'Requisito reabierto'}
                  {!['procedure_selected', 'evidence_uploaded', 'requirement_resolved', 'requirement_reopened'].includes(event.action) && event.action}
                  {event.requirement_key ? ` · ${event.requirement_key}` : ''}
                  {event.actor_name ? ` · ${event.actor_name}` : ''}
                </span>
                <time className="text-warm-ash" dateTime={event.created_at}>
                  {new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.created_at))}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-xs text-warm-ash">Aún no existen acciones registradas en este control.</p>
        )}
      </section>
    </div>
  );
}
