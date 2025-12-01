import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { FiPlus, FiCheckCircle, FiDownload, FiPaperclip, FiTool, FiX } from "react-icons/fi";
import { useApi } from "../../../core/hooks/useApi";
import { useUI } from "../../../core/ui/useUI";
import {
  getMantenimientos,
  createMantenimiento,
  approveMantenimiento,
  exportMantenimientoPDF,
} from "../../../core/api/mantenimientosApi";
import FirmaDigital from "../components/FirmaDigital";
import api from "../../../core/api";

const badge = (s) => {
  const value = (s || "").toString().toLowerCase();
  switch (value) {
    case "aprobado":
    case "approved":
    case "done":
      return "bg-green-100 text-green-700";
    case "pendiente":
    case "pending":
      return "bg-amber-100 text-amber-700";
    case "rechazado":
    case "rejected":
      return "bg-red-100 text-red-700";
    case "cumplido":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

const nextStatusChip = (status) => {
  const value = (status || "").toString().toLowerCase();
  switch (value) {
    case "conflicto":
      return "bg-red-100 text-red-700";
    case "notificado":
      return "bg-green-100 text-green-700";
    case "pendiente":
    default:
      return "bg-amber-100 text-amber-700";
  }
};

const formatDate = (value, withTime = false) => {
  if (!value) return "—";
  try {
    const date = new Date(value);
    return withTime
      ? date.toLocaleString("es-EC")
      : date.toLocaleDateString("es-EC", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
  } catch (_err) {
    return value;
  }
};

const Mantenimientos = ({ initialRows = null, onRefresh }) => {
  const { showToast, confirm } = useUI();

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const { data, loading, execute: fetchList, setData } = useApi(getMantenimientos, {
    errorMsg: "Error al cargar mantenimientos",
  });

  const load = useCallback(async () => {
    await fetchList({ page: 1, pageSize: 25, q: query || undefined });
  }, [fetchList, query]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (Array.isArray(initialRows)) {
      setData({ rows: initialRows });
    }
  }, [initialRows, setData]);

  useEffect(() => {
    if (open) {
      loadEquipos();
    }
  }, [open, loadEquipos]);

  const rows = useMemo(() => data?.rows || data?.result?.rows || data || [], [data]);

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    id_equipo: "",
    tipo: "preventivo",
    responsable: "",
    fecha_programada: "",
    frecuencia: "6m",
    observaciones: "",
    firma_responsable: null,
    firma_receptor: null,
    evidencias: [],
  });

  const sigRespRef = useRef(null);
  const sigRecRef = useRef(null);

  const [equipos, setEquipos] = useState([]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const loadEquipos = useCallback(async () => {
    try {
      const { data } = await api.get("/servicio/equipos");
      const rows = Array.isArray(data?.rows)
        ? data.rows
        : Array.isArray(data?.result?.rows)
        ? data.result.rows
        : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
        ? data
        : [];
      setEquipos(rows);
    } catch (err) {
      console.warn("No se pudo cargar equipos", err?.message || err);
    }
  }, []);

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    setField("evidencias", files);
  };

  const send = async (e) => {
    e?.preventDefault();
    try {
      setSaving(true);

      const firma_responsable = sigRespRef.current?.getBase64() || "";
      const firma_receptor = sigRecRef.current?.getBase64() || "";

    const fd = new FormData();
    fd.append("id_equipo", Number(form.id_equipo));
    fd.append("tipo", form.tipo);
    fd.append("responsable", form.responsable);
    fd.append("observaciones", form.observaciones || "");
    fd.append("frecuencia", form.frecuencia || "6m");
    if (form.fecha_programada) fd.append("fecha_programada", form.fecha_programada);
      if (firma_responsable) fd.append("firma_responsable", firma_responsable);
      if (firma_receptor) fd.append("firma_receptor", firma_receptor);
      (form.evidencias || []).forEach((f) => fd.append("evidencias", f));

    const response = await createMantenimiento(fd);
    const nextInfo = response?.nextMaintenance || response?.mantenimiento?.nextMaintenance || {};

    showToast(response?.message || "Mantenimiento creado y enviado a Drive ✅", "success");

    if (!nextInfo?.date) {
      const baseDate = form.fecha_programada ? new Date(form.fecha_programada) : new Date();
      const monthsToAdd = form.frecuencia === "12m" ? 12 : 6;
      baseDate.setMonth(baseDate.getMonth() + monthsToAdd);
      nextInfo.date = baseDate.toISOString();
    }

    if (nextInfo?.status === "conflicto") {
      showToast(
        nextInfo?.conflictMessage ||
          `El recordatorio programado para ${formatDate(nextInfo?.date)} tiene conflicto.`,
        "warning"
      );
    } else if (nextInfo?.date) {
      showToast(`Programaremos un siguiente mantenimiento para ${formatDate(nextInfo?.date)}.`, "info");
    }

      setOpen(false);
      setForm({
        id_equipo: "",
        tipo: "preventivo",
        responsable: "",
        fecha_programada: "",
        frecuencia: "6m",
        observaciones: "",
        firma_responsable: null,
        firma_receptor: null,
        evidencias: [],
      });
      sigRespRef.current?.clear?.();
      sigRecRef.current?.clear?.();
      await load();
      await onRefresh?.();
    } catch (e) {
      console.error(e);
      showToast(e?.response?.data?.error || "No se pudo crear el mantenimiento", e?.response?.status === 409 ? "warning" : "error");
    } finally {
      setSaving(false);
    }
  };

  const approve = async (row) => {
    const ok = await confirm(`¿Aprobar mantenimiento #${row.id}?`);
    if (!ok) return;
    try {
      await approveMantenimiento(row.id);
      showToast(`Mantenimiento #${row.id} aprobado`, "success");
      await load();
      await onRefresh?.();
    } catch (e) {
      console.error(e);
      showToast("No se pudo aprobar", "error");
    }
  };

  const toPDF = async (row) => {
    try {
      const res = await exportMantenimientoPDF(row.id);
      const link = res?.pdf_link || res?.drive_link || res?.link;
      if (link) window.open(link, "_blank");
      else showToast("PDF generado (sin link en respuesta)", "info");
    } catch (e) {
      console.error(e);
      showToast("No se pudo exportar el PDF", "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="flex items-center gap-2 text-xl font-bold text-gray-800 dark:text-white">
          <FiTool /> Mantenimientos
        </h2>
        <button
          onClick={() => setOpen(true)}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
        >
          <FiPlus /> Nuevo
        </button>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Equipo</th>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2">Responsable</th>
              <th className="px-4 py-2">Fecha programada</th>
              <th className="px-4 py-2">Próximo recordatorio</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((r) => (
              <tr key={r.id} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-4 py-2">{r.id}</td>
                <td className="px-4 py-2">
                  {r.equipo_nombre || r.equipo || `Equipo ${r.id_equipo}`}
                </td>
                <td className="px-4 py-2 capitalize">{r.tipo}</td>
                <td className="px-4 py-2">{r.responsable}</td>
                <td className="px-4 py-2">{formatDate(r.fecha_programada || r.fecha)}</td>
                <td className="px-4 py-2">
                  {r.next_maintenance_date ? (
                    <div className="space-y-1">
                      <p>{formatDate(r.next_maintenance_date)}</p>
                      <span
                        className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full ${nextStatusChip(
                          r.next_maintenance_status
                        )}`}
                      >
                        {r.next_maintenance_status || "pendiente"}
                      </span>
                      {r.next_maintenance_conflict && (
                        <p className="text-xs text-red-600">
                          {r.next_maintenance_conflict}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">Sin programar</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge(r.estado || r.status)}`}>
                    {r.estado || r.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-right space-x-2">
                  <button
                    onClick={() => approve(r)}
                    className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100"
                  >
                    <FiCheckCircle />
                  </button>
                  <button
                    onClick={() => toPDF(r)}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    <FiDownload />
                  </button>
                </td>
              </tr>
            ))}

            {!loading && rows?.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                  No hay mantenimientos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <Transition.Root show={open} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <Dialog.Title className="text-lg font-bold text-gray-900 dark:text-white">
                    Nuevo mantenimiento
                  </Dialog.Title>
                  <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                    <FiX />
                  </button>
                </div>

                <form onSubmit={send} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-300">Equipo</label>
                      <select
                        value={form.id_equipo}
                        onChange={(e) => setField("id_equipo", e.target.value)}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                        required
                      >
                        <option value="">Selecciona un equipo…</option>
                        {equipos.map(eq => (
                          <option key={eq.id} value={eq.id}>{eq.nombre || `Equipo ${eq.id}`}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-300">Tipo</label>
                      <select
                        value={form.tipo}
                        onChange={(e) => setField("tipo", e.target.value)}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                      >
                        <option value="preventivo">Preventivo</option>
                        <option value="correctivo">Correctivo</option>
                      </select>
                    </div>
                    <div className="md:col-span-1">
                      <label className="text-sm text-gray-600 dark:text-gray-300">Responsable</label>
                      <input
                        value={form.responsable}
                        onChange={(e) => setField("responsable", e.target.value)}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-300">Fecha programada</label>
                      <input
                        type="date"
                        value={form.fecha_programada}
                        onChange={(e) => setField("fecha_programada", e.target.value)}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-300">Programar próximo mantenimiento</label>
                      <select
                        value={form.frecuencia}
                        onChange={(e) => setField("frecuencia", e.target.value)}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                      >
                        <option value="6m">Recordar en 6 meses</option>
                        <option value="12m">Recordar en 1 año</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Usaremos esta frecuencia para sugerir el próximo recordatorio automáticamente.
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm text-gray-600 dark:text-gray-300">Observaciones</label>
                      <textarea
                        rows={3}
                        value={form.observaciones}
                        onChange={(e) => setField("observaciones", e.target.value)}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                      />
                    </div>
                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-600 dark:text-gray-300">Firma responsable</label>
                        <div className="mt-1">
                          <FirmaDigital ref={sigRespRef} />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm text-gray-600 dark:text-gray-300">Firma receptor</label>
                        <div className="mt-1">
                          <FirmaDigital ref={sigRecRef} />
                        </div>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm text-gray-600 dark:text-gray-300">Evidencias</label>
                      <div className="mt-1 flex flex-col gap-2">
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={handleFiles}
                          className="file:border-0 file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900 dark:file:text-blue-300"
                          multiple
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Adjuntar imágenes o PDFs como evidencias del mantenimiento.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-4">
                    <button
                      onClick={() => setOpen(false)}
                      className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                    >
                      {saving && <span className="animate-spin">⏳</span>} Guardar mantenimiento
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>
    </div>
  );
};

export default Mantenimientos;
