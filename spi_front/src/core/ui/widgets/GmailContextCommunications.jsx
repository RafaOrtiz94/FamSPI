import React, { useEffect, useMemo, useState } from "react";
import { FiCheck, FiChevronRight, FiInbox, FiLink, FiLoader, FiRefreshCw, FiSearch } from "react-icons/fi";
import toast from "react-hot-toast";
import {
  getGmailContextClientSuggestions,
  linkGmailContextCommunication,
  listGmailContextCommunications,
  searchGmailContextClients,
  searchGmailContextProcesses,
} from "../../api/gmailContextApi";

const PROCESS_TYPES = [
  { value: "business_case", label: "Business Case" },
  { value: "public_purchase", label: "Compra pública" },
  { value: "private_purchase", label: "Compra privada" },
];

const dateTime = (value) => {
  if (!value) return "Sin fecha";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Sin fecha" : parsed.toLocaleString("es-EC");
};

export default function GmailContextCommunications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [clientQuery, setClientQuery] = useState("");
  const [clientMatches, setClientMatches] = useState([]);
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [clientId, setClientId] = useState(null);
  const [entityType, setEntityType] = useState("business_case");
  const [processQuery, setProcessQuery] = useState("");
  const [processMatches, setProcessMatches] = useState([]);
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const pendingItems = useMemo(() => items.filter((item) => item.status === "pending_link"), [items]);

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
    setProcessQuery("");
    setProcessMatches([]);
    setSelectedProcess(null);
    setLoadingSuggestions(true);
    getGmailContextClientSuggestions(communication.id)
      .then((suggestions) => setClientSuggestions(suggestions))
      .catch(() => toast.error("No se pudieron detectar coincidencias de cliente."))
      .finally(() => setLoadingSuggestions(false));
  };

  const selectClient = (client) => {
    setClientId(client.id);
    setClientQuery(client.label);
    setClientMatches([]);
  };

  const link = async () => {
    if (!selected || !selectedProcess) return;
    setSaving(true);
    try {
      await linkGmailContextCommunication(selected.id, {
        entity_type: selectedProcess.entity_type,
        entity_id: selectedProcess.entity_id,
        client_request_id: clientId,
      });
      toast.success("Correo vinculado al proceso y registrado en sus notas.");
      setSelected(null);
      await load();
    } catch (requestError) {
      toast.error(requestError?.response?.data?.message || "No se pudo vincular el correo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-slate-900">
            <FiInbox className="text-teal-700" />
            <h2 className="text-lg font-semibold">Comunicaciones de Gmail</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">Registra y vincula manualmente correos abiertos desde el Add-on. No crea clientes ni procesos.</p>
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
              <button key={item.id} type="button" onClick={() => selectCommunication(item)} className={`block w-full border-l-4 px-5 py-4 text-left transition hover:bg-slate-50 ${selected?.id === item.id ? "border-teal-600 bg-teal-50/60" : "border-transparent"}`}>
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
                <label className="block"><span className="text-sm font-medium text-slate-800">Cliente relacionado <span className="font-normal text-slate-500">(opcional)</span></span><div className="relative mt-1"><FiSearch className="absolute left-3 top-3 text-slate-400" /><input value={clientQuery} onChange={(event) => { setClientQuery(event.target.value); setClientId(null); }} placeholder="Busca por nombre, correo o RUC" className="min-h-10 w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" /></div></label>
                {loadingSuggestions ? <p className="text-xs text-slate-500">Detectando coincidencias verificables de cliente…</p> : null}
                {clientSuggestions.length > 0 ? <div className="rounded-lg border border-teal-200 bg-teal-50/60 p-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-800">Coincidencias detectadas en el correo</p>{clientSuggestions.map((client) => <button key={client.id} type="button" onClick={() => selectClient(client)} className={`block w-full rounded-md px-2 py-2 text-left text-sm hover:bg-white ${clientId === client.id ? "bg-white ring-1 ring-teal-500" : ""}`}><span className="font-medium text-slate-800">{client.label}</span><span className="ml-2 text-xs text-slate-500">{client.evidence.join(" · ")}</span></button>)}</div> : null}
                {clientMatches.length > 0 ? <div className="rounded-lg border border-slate-200">{clientMatches.map((client) => <button key={client.id} type="button" onClick={() => selectClient(client)} className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50 ${clientId === client.id ? "bg-teal-50" : ""}`}><span className="font-medium text-slate-800">{client.label}</span><span className="ml-2 text-xs text-slate-500">{client.ruc_cedula || client.client_email || ""}</span></button>)}</div> : null}
                <div className="grid gap-3 sm:grid-cols-3"><label className="sm:col-span-1"><span className="text-sm font-medium text-slate-800">Tipo de proceso</span><select value={entityType} onChange={(event) => setEntityType(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100">{PROCESS_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><label className="sm:col-span-2"><span className="text-sm font-medium text-slate-800">Proceso autorizado</span><input value={processQuery} onChange={(event) => setProcessQuery(event.target.value)} placeholder="Busca por cliente o identificador" className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" /></label></div>
                {processMatches.length > 0 ? <div className="rounded-lg border border-slate-200">{processMatches.map((process) => <button key={`${process.entity_type}-${process.entity_id}`} type="button" onClick={() => setSelectedProcess(process)} className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50 ${selectedProcess?.entity_id === process.entity_id && selectedProcess?.entity_type === process.entity_type ? "bg-teal-50" : ""}`}><span className="font-medium text-slate-800">{process.label}</span><span className="ml-2 text-xs text-slate-500">{process.status || "Sin estado"}</span></button>)}</div> : null}
                <button type="button" onClick={link} disabled={!selectedProcess || saving} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"><FiLink />{saving ? "Vinculando…" : "Vincular y registrar en notas"}</button>
                {searching ? <p className="text-xs text-slate-500">Buscando resultados autorizados…</p> : null}
                {selectedProcess ? <p className="inline-flex items-center gap-1 text-xs text-emerald-700"><FiCheck /> Se vinculará a {selectedProcess.label}.</p> : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
