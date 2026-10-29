import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FiChevronDown, FiLink, FiRefreshCw } from "react-icons/fi";

import { getOrphanApplicants, linkApplicantToRequest } from "../../../../core/api/applicantsApi";

const NO_CARGO = "Sin cargo indicado";

// Postulantes cuyo cargo del formulario no coincidio con ninguna solicitud de
// personal: se agrupan por cargo y se vinculan a mano a una solicitud.
const OrphanApplicantsPanel = ({ requests = [], onLinked }) => {
  const [loading, setLoading] = useState(true);
  const [applicants, setApplicants] = useState([]);
  const [openCargo, setOpenCargo] = useState(null);
  const [selection, setSelection] = useState({});
  const [linkingId, setLinkingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getOrphanApplicants();
      setApplicants(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      console.error("Error cargando postulantes sin solicitud:", err);
      toast.error("No se pudieron cargar los postulantes sin solicitud");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => {
    const map = new Map();
    applicants.forEach((a) => {
      const key = a.cargo || NO_CARGO;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    });
    return Array.from(map, ([cargo, items]) => ({ cargo, items })).sort((a, b) => b.items.length - a.items.length);
  }, [applicants]);

  // Solicitudes abiertas para vincular (las completadas/canceladas ya no reciben candidatos).
  const requestOptions = useMemo(
    () => requests.filter((r) => !["completada", "cancelada", "rechazada"].includes(String(r.status || "").toLowerCase())),
    [requests],
  );

  const handleLink = async (applicant) => {
    const requestId = selection[applicant.id];
    if (!requestId) return;
    setLinkingId(applicant.id);
    try {
      await linkApplicantToRequest(applicant.id, Number(requestId));
      setApplicants((prev) => prev.filter((a) => a.id !== applicant.id));
      toast.success("Postulante vinculado a la solicitud");
      onLinked?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || "No se pudo vincular el postulante");
    } finally {
      setLinkingId(null);
    }
  };

  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5">
        <div>
          <p className="text-sm font-semibold text-slate-900">Postulantes sin solicitud</p>
          <p className="text-xs text-slate-500">
            Aplicaron a un cargo que no coincide con ninguna solicitud de personal. Vincúlalos para que aparezcan en su proceso.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{applicants.length}</span>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            title="Actualizar"
            aria-label="Actualizar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
          >
            <FiRefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {loading && !applicants.length ? (
        <div className="h-20 animate-pulse bg-slate-50" />
      ) : groups.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">Todos los postulantes están vinculados a una solicitud.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {groups.map(({ cargo, items }) => {
            const isOpen = openCargo === cargo;
            return (
              <div key={cargo}>
                <button
                  type="button"
                  onClick={() => setOpenCargo(isOpen ? null : cargo)}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-3 text-left hover:bg-slate-50"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-slate-800">{cargo}</span>
                  <span className="flex flex-shrink-0 items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">{items.length}</span>
                    <FiChevronDown size={15} className="text-slate-400 transition-transform" style={{ transform: isOpen ? "rotate(180deg)" : "none" }} />
                  </span>
                </button>
                {isOpen && (
                  <ul className="space-y-2 bg-slate-50/60 px-5 py-3">
                    {items.map((a) => (
                      <li key={a.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{a.fullname || a.email}</p>
                          <p className="truncate text-[11px] text-slate-500">{a.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={selection[a.id] || ""}
                            onChange={(e) => setSelection((prev) => ({ ...prev, [a.id]: e.target.value }))}
                            className="min-w-0 max-w-[260px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-400"
                          >
                            <option value="">Selecciona solicitud…</option>
                            {requestOptions.map((r) => (
                              <option key={r.id} value={r.id}>#{r.id} · {r.position_title}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleLink(a)}
                            disabled={!selection[a.id] || linkingId === a.id}
                            title="Vincular a la solicitud"
                            aria-label="Vincular a la solicitud"
                            className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-40"
                          >
                            <FiLink size={13} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrphanApplicantsPanel;
