import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiCheck, FiChevronRight, FiInbox, FiLink, FiLoader, FiRefreshCw, FiSearch, FiShoppingCart } from "react-icons/fi";
import toast from "react-hot-toast";
import {
  getGmailContextClientSuggestions,
  getGmailContextProcessCandidates,
  linkGmailContextCommunication,
  listGmailContextCommunications,
  searchGmailContextClients,
  searchGmailContextProcesses,
} from "../../api/gmailContextApi";
import PurchaseTypeSelector from "../../../shared/purchases/PurchaseTypeSelector";
import NewPurchaseRequestModal from "../../../shared/purchases/NewPurchaseRequestModal";
import { PURCHASE_FAMILY, PURCHASE_START_MODE } from "../../../shared/purchases/purchaseTypes";
import { usePreflowPurchaseStart } from "../../../shared/purchases/usePreflowPurchaseStart";
import { useUI } from "../useUI";

const PROCESS_TYPES = [
  { value: "business_case", label: "Business Case" },
  { value: "public_purchase", label: "Compra pública" },
  { value: "private_purchase", label: "Compra privada" },
];

const ENTITY_TYPE_LABELS = {
  business_case: "Business Case",
  public_purchase: "Compra pública",
  private_purchase: "Compra privada",
};

const STATUS_TONE_BY_KEYWORD = [
  { match: /rechaz|cancel|discard/i, tone: "bg-red-soft text-alert-red" },
  { match: /aprob|accept|complet|entreg|linked|activ/i, tone: "bg-green-soft text-operative-green" },
  { match: /pend|revis|borrador|draft/i, tone: "bg-amber-soft text-caution-amber" },
];

const statusTone = (status) => {
  const found = STATUS_TONE_BY_KEYWORD.find((entry) => entry.match.test(String(status || "")));
  return found?.tone || "bg-slate-100 text-warm-ash";
};

const dateTime = (value) => {
  if (!value) return "Sin fecha";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Sin fecha" : parsed.toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
};

export default function GmailContextCommunications({ initialCommunicationId = null }) {
  const navigate = useNavigate();
  const { showToast, showLoader, hideLoader } = useUI();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [clientQuery, setClientQuery] = useState("");
  const [clientMatches, setClientMatches] = useState([]);
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [clientId, setClientId] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [processCandidates, setProcessCandidates] = useState([]);
  const [loadingProcessCandidates, setLoadingProcessCandidates] = useState(false);
  const [entityType, setEntityType] = useState("business_case");
  const [processQuery, setProcessQuery] = useState("");
  const [processMatches, setProcessMatches] = useState([]);
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [purchaseSelectorOpen, setPurchaseSelectorOpen] = useState(false);
  const [newPurchaseModalOpen, setNewPurchaseModalOpen] = useState(false);
  const [newPurchaseMode, setNewPurchaseMode] = useState("private_direct");
  const [privateOfferKind, setPrivateOfferKind] = useState("venta");
  const { startPreflow } = usePreflowPurchaseStart({ navigate, showToast, showLoader, hideLoader });

  const pendingItems = useMemo(() => items.filter((item) => item.status === "pending_link"), [items]);
  const isSearchingProcess = processQuery.trim().length >= 2;
  const visibleProcesses = isSearchingProcess ? processMatches : processCandidates;
  const visibleProcessesLoading = isSearchingProcess ? searching : loadingProcessCandidates;
  const visibleProcessesLabel = isSearchingProcess
    ? "Resultados de búsqueda"
    : selectedClient
      ? `Procesos de ${selectedClient.nombre || selectedClient.label || "este cliente"}`
      : "Procesos disponibles";

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await listGmailContextCommunications({ page_size: 50 });
      setItems(result.items || []);
      setSelected((current) => (current ? (result.items || []).find((item) => item.id === current.id) || null : null));
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "No se pudieron cargar las comunicaciones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (clientQuery.trim().length < 2) {
      setClientMatches([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        setClientMatches(await searchGmailContextClients(clientQuery.trim()));
      } catch (requestError) {
        toast.error(requestError?.response?.data?.message || "No se pudieron buscar clientes.");
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [clientQuery]);

  useEffect(() => {
    setSelectedProcess(null);
    if (processQuery.trim().length < 2) {
      setProcessMatches([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        setProcessMatches(await searchGmailContextProcesses({ entityType, q: processQuery.trim() }));
      } catch (requestError) {
        toast.error(requestError?.response?.data?.message || "No se pudieron buscar procesos autorizados.");
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [entityType, processQuery]);

  const selectCommunication = (communication) => {
    setSelected(communication);
    setClientQuery("");
    setClientMatches([]);
    setClientSuggestions([]);
    setClientId(null);
    setSelectedClient(null);
    setProcessCandidates([]);
    setProcessQuery("");
    setProcessMatches([]);
    setSelectedProcess(null);
    setLoadingSuggestions(true);
    getGmailContextClientSuggestions(communication.id)
      .then((suggestions) => {
        setClientSuggestions(suggestions);
        if (suggestions.length === 1) selectClient(suggestions[0], communication.id);
      })
      .catch(() => toast.error("No se pudieron detectar coincidencias de cliente."))
      .finally(() => setLoadingSuggestions(false));
  };

  useEffect(() => {
    if (!initialCommunicationId || selected?.id === initialCommunicationId) return;
    const communication = pendingItems.find((item) => item.id === initialCommunicationId);
    if (communication) selectCommunication(communication);
  }, [initialCommunicationId, pendingItems, selected?.id]);

  const selectClient = (client, communicationId = selected?.id) => {
    const normalizedClient = {
      ...client,
      nombre: client.nombre || client.commercial_name || client.label || "",
      identificador: client.identificador || client.ruc_cedula || "",
    };
    setClientId(normalizedClient.id);
    setSelectedClient(normalizedClient);
    setClientQuery(normalizedClient.label || normalizedClient.nombre);
    setClientMatches([]);
    setProcessCandidates([]);
    setSelectedProcess(null);
    setLoadingProcessCandidates(true);
    if (!communicationId) {
      setLoadingProcessCandidates(false);
      return;
    }
    getGmailContextProcessCandidates(communicationId, normalizedClient.id)
      .then((candidates) => setProcessCandidates(candidates))
      .catch((requestError) => toast.error(requestError?.response?.data?.message || "No se pudieron consultar los procesos del cliente."))
      .finally(() => setLoadingProcessCandidates(false));
  };

  const linkToProcess = async (process) => {
    if (!selected || !process) return;
    await linkGmailContextCommunication(selected.id, {
      entity_type: process.entity_type,
      entity_id: process.entity_id,
      client_request_id: clientId,
    });
    toast.success("Correo vinculado al proceso y registrado en sus notas.");
    setSelected(null);
    await load();
  };

  const link = async () => {
    if (!selected || !selectedProcess) return;
    setSaving(true);
    try {
      await linkToProcess(selectedProcess);
    } catch (requestError) {
      toast.error(requestError?.response?.data?.message || "No se pudo vincular el correo.");
    } finally {
      setSaving(false);
    }
  };

  const handlePurchaseTypeSelection = async (selection) => {
    if (!selected || !selectedClient) return;
    const family = selection?.purchaseFamily;
    const kind = selection?.purchaseKind;
    if (selection?.startFrom === PURCHASE_START_MODE.EXISTING_MODAL && family === PURCHASE_FAMILY.PRIVATE) {
      setPrivateOfferKind(kind || "venta");
      setNewPurchaseMode("private_direct");
      setNewPurchaseModalOpen(true);
      return;
    }
    if (selection?.startFrom === PURCHASE_START_MODE.BUSINESS_CASE_PREFLOW) {
      await startPreflow({
        family,
        kind,
        origin: "gmail_context",
        client: selectedClient,
        onCreated: async ({ businessCaseId }) => linkToProcess({ entity_type: "business_case", entity_id: businessCaseId }),
      });
    }
  };

  const handlePurchaseCreated = async (result) => {
    const payload = result?.data || result || {};
    const entityId = payload?.id || payload?.purchase_id || payload?.request_id;
    if (!entityId) {
      toast.error("La compra fue creada, pero SPI no devolvió su identificador para vincular el correo.");
      return;
    }
    await linkToProcess({ entity_type: newPurchaseMode === "private_direct" ? "private_purchase" : "public_purchase", entity_id: entityId });
    setNewPurchaseModalOpen(false);
  };

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-slate-900">
            <FiInbox className="text-action-blue" />
            <h2 className="text-lg font-semibold">Comunicaciones de Gmail</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">Categoriza los correos registrados desde Gmail y vincúlalos al proceso correcto.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
          <FiRefreshCw className={loading ? "animate-spin" : ""} /> Actualizar
        </button>
      </header>

      {loading ? <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-slate-600"><FiLoader className="animate-spin" /> Cargando comunicaciones…</div> : null}
      {error ? <div className="m-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div> : null}
      {!loading && !error && pendingItems.length === 0 ? <div className="px-5 py-12 text-center text-sm text-slate-600">No tienes comunicaciones pendientes de vinculación.</div> : null}

      {!loading && !error && pendingItems.length > 0 ? (
        <div className="grid divide-y divide-slate-200 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:divide-x lg:divide-y-0">
          <div className="max-h-[36rem] overflow-y-auto">
            {pendingItems.map((item) => (
              <button key={item.id} type="button" onClick={() => selectCommunication(item)} className={`block w-full border-l-4 px-5 py-4 text-left transition hover:bg-slate-50 ${selected?.id === item.id ? "border-action-blue bg-action-blue/5" : "border-transparent"}`}>
                <div className="flex items-start justify-between gap-3"><p className="line-clamp-1 font-medium text-slate-900">{item.subject || "Sin asunto"}</p><FiChevronRight className="mt-1 shrink-0 text-slate-400" /></div>
                <p className="mt-1 line-clamp-1 text-sm text-slate-600">{item.sender_email || "Remitente no disponible"}</p>
                <p className="mt-2 text-xs text-slate-500">{dateTime(item.received_at || item.created_at)}</p>
              </button>
            ))}
          </div>

          <div className="min-h-[24rem] p-5">
            {!selected ? <div className="flex h-full items-center justify-center text-center text-sm text-slate-500">Selecciona una comunicación para decidir su cliente y proceso.</div> : (
              <div className="space-y-4">
                <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Correo seleccionado</p><h3 className="mt-1 font-semibold text-slate-900">{selected.subject || "Sin asunto"}</h3><p className="mt-1 text-sm text-slate-600">{selected.sender_email || "Remitente no disponible"}</p></div>
                <label className="block">
                  <span className="text-sm font-medium text-slate-800">Cliente relacionado <span className="font-normal text-slate-500">(opcional)</span></span>
                  <div className="relative mt-1">
                    <FiSearch className="absolute left-3 top-3 text-slate-400" />
                    <input
                      value={clientQuery}
                      onChange={(event) => { setClientQuery(event.target.value); setClientId(null); }}
                      placeholder="Busca por nombre, correo o RUC"
                      className="min-h-10 w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-action-blue focus:ring-2 focus:ring-action-blue/15"
                    />
                  </div>
                </label>

                {loadingSuggestions ? <p className="text-xs text-slate-500">Detectando coincidencias verificables de cliente…</p> : null}
                {clientSuggestions.length > 0 ? (
                  <div className="rounded-lg border border-action-blue/20 bg-action-blue/5 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-action-blue">Coincidencias detectadas en el correo</p>
                    {clientSuggestions.map((client) => (
                      <button key={client.id} type="button" onClick={() => selectClient(client)} className={`block w-full rounded-md px-2 py-2 text-left text-sm hover:bg-white ${clientId === client.id ? "bg-white ring-1 ring-action-blue" : ""}`}>
                        <span className="font-medium text-slate-800">{client.label}</span>
                        <span className="ml-2 text-xs text-slate-500">{client.evidence.join(" · ")}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {clientMatches.length > 0 ? (
                  <div className="rounded-lg border border-slate-200">
                    {clientMatches.map((client) => (
                      <button key={client.id} type="button" onClick={() => selectClient(client)} className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50 ${clientId === client.id ? "bg-action-blue/5" : ""}`}>
                        <span className="font-medium text-slate-800">{client.label}</span>
                        <span className="ml-2 text-xs text-slate-500">{client.ruc_cedula || client.client_email || ""}</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {clientId && !loadingProcessCandidates && processCandidates.length === 0 && !isSearchingProcess ? (
                  <div className="rounded-lg border border-caution-amber/30 bg-amber-soft p-3">
                    <p className="text-sm font-medium text-caution-amber">Este cliente no tiene un proceso de compra disponible.</p>
                    <p className="mt-1 text-xs text-caution-amber">Puedes iniciar una solicitud de compra y el correo quedará vinculado al nuevo expediente.</p>
                    <button type="button" onClick={() => setPurchaseSelectorOpen(true)} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-caution-amber px-3 text-sm font-semibold text-white transition hover:opacity-90">
                      <FiShoppingCart /> Crear solicitud de compra
                    </button>
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="sm:col-span-1">
                    <span className="text-sm font-medium text-slate-800">Tipo de proceso</span>
                    <select value={entityType} onChange={(event) => setEntityType(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-action-blue focus:ring-2 focus:ring-action-blue/15">
                      {PROCESS_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                  </label>
                  <label className="sm:col-span-2">
                    <span className="text-sm font-medium text-slate-800">Buscar otro proceso autorizado</span>
                    <input
                      value={processQuery}
                      onChange={(event) => setProcessQuery(event.target.value)}
                      placeholder="Busca por cliente o identificador"
                      className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-action-blue focus:ring-2 focus:ring-action-blue/15"
                    />
                  </label>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{visibleProcessesLabel}</p>
                  {visibleProcessesLoading ? (
                    <p className="text-xs text-slate-500">Consultando procesos autorizados…</p>
                  ) : visibleProcesses.length > 0 ? (
                    <div className="rounded-lg border border-slate-200">
                      {visibleProcesses.map((process) => {
                        const isSelected = selectedProcess?.entity_id === process.entity_id && selectedProcess?.entity_type === process.entity_type;
                        return (
                          <button
                            key={`${process.entity_type}-${process.entity_id}`}
                            type="button"
                            onClick={() => setSelectedProcess(process)}
                            className={`flex w-full items-start justify-between gap-3 border-b border-slate-100 px-3 py-2.5 text-left text-sm last:border-0 hover:bg-slate-50 ${isSelected ? "bg-action-blue/5 ring-1 ring-inset ring-action-blue" : ""}`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-slate-800">{process.label}</span>
                              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                                <span>{ENTITY_TYPE_LABELS[process.entity_type] || process.entity_type}</span>
                                <span aria-hidden="true">·</span>
                                <span>{dateTime(process.created_at)}</span>
                              </span>
                            </span>
                            <span className={`inline-flex shrink-0 rounded-sm px-2 py-0.5 text-[11px] font-semibold ${statusTone(process.status)}`}>
                              {process.status || "Sin estado"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500">
                      {isSearchingProcess ? "Sin resultados para esa búsqueda." : "Selecciona un cliente o busca un proceso directamente para ver opciones aquí."}
                    </p>
                  )}
                </div>

                <button type="button" onClick={link} disabled={!selectedProcess || saving} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-action-blue px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-slate-300">
                  <FiLink />{saving ? "Vinculando…" : "Vincular y registrar en notas"}
                </button>
                {selectedProcess ? <p className="inline-flex items-center gap-1 text-xs text-operative-green"><FiCheck /> Se vinculará a {selectedProcess.label}.</p> : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
      <PurchaseTypeSelector isOpen={purchaseSelectorOpen} onClose={() => setPurchaseSelectorOpen(false)} origin="gmail_context" onSelect={handlePurchaseTypeSelection} />
      <NewPurchaseRequestModal isOpen={newPurchaseModalOpen} onOpenChange={setNewPurchaseModalOpen} mode={newPurchaseMode} initialClient={selectedClient} initialOfferKind={privateOfferKind} hideOfferKindSelector={Boolean(privateOfferKind)} onSuccess={handlePurchaseCreated} />
    </section>
  );
}
