import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiCalendar,
  FiChevronDown,
  FiDownload,
  FiEye,
  FiFileText,
  FiRefreshCw,
  FiSearch,
} from "react-icons/fi";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import Select from "../../../../core/ui/components/Select";
import { getResumenColaboradores } from "../../../../core/api/permisosApi";
import { DATA_UPDATE_SCOPES, useScopedAutoUpdate } from "../../../../core/api";
import { useUI } from "../../../../core/ui/UIContext";
import { formatVacationDaysHours } from "../utils/vacationDisplay";

// ── Accessors (tolerantes a distintas formas del payload) ────────────────────
const getName = (r = {}) => r.user_fullname || r.fullname || r.user_email || r.email || "Usuario";
const getEmail = (r = {}) => r.user_email || r.email || "";
const getDepartment = (r = {}) => r.department_name || "Sin departamento";
const getApprovedPermisos = (r = {}) => Number(r?.permisos?.summary?.total_approved ?? r?.permisos?.aprobacion_completa ?? r?.permisos?.aprobados ?? 0);
const getPendingPermisos = (r = {}) => Number(r?.permisos?.summary?.total_pending ?? r?.permisos?.pendientes ?? 0);
const getVacationAllowance = (r = {}) => Number(r?.vacaciones?.summary?.allowance ?? r?.vacaciones?.dias_disponibles ?? 0);
const getTakenVacation = (r = {}) => Number(r?.vacaciones?.summary?.taken ?? r?.vacaciones?.dias_aprobados ?? 0);
const getPendingVacation = (r = {}) => Number(r?.vacaciones?.summary?.pending ?? r?.vacaciones?.dias_pendientes ?? 0);
const getRemainingVacation = (r = {}) => Number(r?.vacaciones?.summary?.remaining ?? r?.vacaciones?.dias_restantes ?? getVacationAllowance(r));

const num = (v) => formatVacationDaysHours(Number(v) || 0).shortText;

// Traza de aprobación: solicitante → aprobación parcial → aprobación/rechazo final
const TraceLine = ({ item }) => {
  const status = String(item?.status || "").toLowerCase();
  const isRejected = ["rejected", "rechazado"].includes(status);
  const isCancelled = ["cancelled", "cancelado"].includes(status);
  const rows = [];

  if (item?.solicitante) {
    rows.push({ label: "Solicitó", value: item.solicitante, color: "#6B7280" });
  }
  if (item?.aprobacion_parcial_por) {
    rows.push({ label: "Aprob. parcial", value: item.aprobacion_parcial_por, color: "#D97706" });
  }
  if (item?.aprobacion_final_por && !isCancelled) {
    rows.push({
      label: isRejected ? "Rechazó" : "Aprobó",
      value: item.aprobacion_final_por,
      color: isRejected ? "#DC2626" : "#166534",
    });
  }
  if (isCancelled && item?.cancelado_por) {
    rows.push({ label: "Canceló", value: item.cancelado_por, color: "#6B7280" });
  }

  if (!rows.length) return null;
  return (
    <div className="mt-2 flex flex-col gap-1 border-t border-slate-100 pt-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-1.5 text-[11px]">
          <span className="font-semibold uppercase tracking-wide" style={{ color: "#9CA3AF", minWidth: 88 }}>{r.label}</span>
          <span className="font-medium truncate" style={{ color: r.color }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
};

// Badge de estado de una solicitud individual
const RequestStatusBadge = ({ status }) => {
  const s = String(status || "").toLowerCase();
  let style = { bg: "#F3F4F6", color: "#6B7280" };
  let label = status || "—";
  if (["approved", "aprobado", "aprobacion_completa"].includes(s)) { style = { bg: "#DCFCE7", color: "#166534" }; label = "Aprobado"; }
  else if (["rejected", "rechazado"].includes(s)) { style = { bg: "#FEE2E2", color: "#DC2626" }; label = "Rechazado"; }
  else if (["pending", "pendiente", "aprobacion_parcial"].includes(s)) { style = { bg: "#FEF3C7", color: "#D97706" }; label = "Pendiente"; }
  else if (["cancelled", "cancelado"].includes(s)) { style = { bg: "#F3F4F6", color: "#6B7280" }; label = "Cancelado"; }
  return (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: style.bg, color: style.color }}>
      {label}
    </span>
  );
};

const PermisosConsolidadoView = () => {
  const { showLoader, hideLoader, showToast } = useUI();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [expanded, setExpanded] = useState(null); // email de fila expandida
  const reportTableRef = useRef(null);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await getResumenColaboradores();
      setData(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      console.error("Error cargando informe consolidado:", err);
      showToast?.("No se pudo cargar el informe consolidado", "warning");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData]);
  useScopedAutoUpdate(
    [DATA_UPDATE_SCOPES.PERMISOS, DATA_UPDATE_SCOPES.VACACIONES],
    () => loadData({ silent: true }),
  );

  const departments = useMemo(() => {
    const deps = new Set(data.map(getDepartment).filter(Boolean));
    return ["all", ...Array.from(deps)].map((d) => ({ label: d === "all" ? "Todos los departamentos" : d, value: d }));
  }, [data]);

  const filteredData = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return data
      .filter((item) => {
        const matchesSearch = getName(item).toLowerCase().includes(term) || getEmail(item).toLowerCase().includes(term);
        const matchesDep = selectedDepartment === "all" || getDepartment(item) === selectedDepartment;
        return matchesSearch && matchesDep;
      })
      .sort((a, b) => getName(a).localeCompare(getName(b)));
  }, [data, searchTerm, selectedDepartment]);

  const stats = useMemo(() => {
    let permAprob = 0, permPend = 0, vacTotal = 0, vacPend = 0;
    filteredData.forEach((c) => {
      permAprob += getApprovedPermisos(c);
      permPend += getPendingPermisos(c);
      vacTotal += getVacationAllowance(c);
      vacPend += getPendingVacation(c);
    });
    return [
      { label: "Colaboradores", value: filteredData.length },
      { label: "Permisos aprobados", value: permAprob },
      { label: "Permisos pendientes", value: permPend },
      { label: "Vacaciones asignadas", value: vacTotal },
      { label: "Vacaciones pendientes", value: vacPend },
    ];
  }, [filteredData]);

  const hasFilters = Boolean(searchTerm.trim() || selectedDepartment !== "all");

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (filteredData.length === 0) return toast.error("No hay datos para exportar");
    const headers = ["Colaborador", "Departamento", "Email", "Permisos Aprobados", "Permisos Pendientes", "Vacaciones Disponibles", "Vacaciones Tomadas", "Vacaciones Pendientes"];
    const rows = filteredData.map((c) => [getName(c), getDepartment(c), getEmail(c) || "-", getApprovedPermisos(c), getPendingPermisos(c), getRemainingVacation(c), getTakenVacation(c), getPendingVacation(c)]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.body.appendChild(document.createElement("a"));
    link.href = url;
    link.download = `reporte_permisos_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Reporte CSV exportado");
  };

  const handleExportPDF = async () => {
    if (!reportTableRef.current) return;
    showLoader?.("Generando reporte PDF...");
    try {
      const canvas = await html2canvas(reportTableRef.current, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height);
      pdf.setFontSize(16);
      pdf.text("Informe Consolidado de Permisos y Vacaciones", 10, 15);
      pdf.setFontSize(10);
      pdf.text(`Generado el: ${new Date().toLocaleString()}`, 10, 22);
      pdf.addImage(imgData, "PNG", 0, 30, canvas.width * ratio, canvas.height * ratio);
      pdf.save(`reporte_permisos_${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("Reporte PDF exportado");
    } catch (err) {
      console.error("Error generando PDF:", err);
      toast.error("Error al generar el PDF");
    } finally {
      hideLoader?.();
    }
  };

  // ── Detalle expandido de un colaborador ──────────────────────────────────────
  const renderDetail = (row) => {
    const permisos = row?.permisos?.items || [];
    const vacaciones = row?.vacaciones?.items || [];
    return (
      <div className="grid gap-5 px-5 py-4 md:grid-cols-2" style={{ background: "#F9FAFB" }}>
        {/* Permisos */}
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            <FiCalendar size={13} /> Permisos con fechas
          </p>
          {permisos.length ? (
            <div className="space-y-2">
              {permisos.map((item) => (
                <div key={`p-${item.id}`} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-800">{item.tipo_permiso || "Permiso"}</span>
                    <RequestStatusBadge status={item.status} />
                  </div>
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    {item.fecha_inicio || "Sin fecha"} — {item.fecha_fin || "Sin fecha"}
                  </p>
                  {Array.isArray(item.justificantes_urls) && item.justificantes_urls.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.justificantes_urls.map((url, idx) => (
                        <a key={`${item.id}-doc-${idx}`} href={url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-50">
                          <FiEye size={11} /> Documento {idx + 1}
                        </a>
                      ))}
                    </div>
                  )}
                  {Array.isArray(item.external_coordination_urls) && item.external_coordination_urls.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.external_coordination_urls.map((url, idx) => (
                        <a key={`${item.id}-coord-${idx}`} href={url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50">
                          <FiEye size={11} /> Coordinación {idx + 1}
                        </a>
                      ))}
                    </div>
                  )}
                  <TraceLine item={item} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">No registra permisos.</p>
          )}
        </div>

        {/* Vacaciones */}
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            <FiCalendar size={13} /> Vacaciones con fechas
          </p>
          {vacaciones.length ? (
            <div className="space-y-2">
              {vacaciones.map((item) => (
                <div key={`v-${item.id}`} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-800">{item.duracion_dias} día(s)</span>
                    <RequestStatusBadge status={item.status} />
                  </div>
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    {item.fecha_inicio || "Sin fecha"} — {item.fecha_fin || "Sin fecha"}
                  </p>
                  <TraceLine item={item} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">No registra vacaciones.</p>
          )}
        </div>

        {row?.vacaciones?.missing_hire_date && (
          <div className="md:col-span-2 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <FiAlertCircle size={14} />
            Falta la fecha de ingreso en el perfil para calcular vacaciones.
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Toolbar: filtros + acciones */}
      <Card className="p-4 shadow-soft sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto]">
          <div className="relative">
            <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o correo"
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <Select
            value={selectedDepartment}
            options={departments}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            includePlaceholder={false}
            containerClassName="mb-0"
            className="min-h-[44px]"
          />
          <div className="flex gap-2">
            <Button variant="secondary" leftIcon={FiRefreshCw} onClick={() => loadData()} disabled={loading} size="sm" className="flex-1 justify-center lg:flex-none">
              Actualizar
            </Button>
            <Button leftIcon={FiDownload} onClick={handleExportCSV} disabled={loading || filteredData.length === 0} size="sm" className="flex-1 justify-center lg:flex-none">
              CSV
            </Button>
            <Button variant="secondary" leftIcon={FiFileText} onClick={handleExportPDF} disabled={loading || filteredData.length === 0} size="sm" className="flex-1 justify-center lg:flex-none">
              PDF
            </Button>
          </div>
        </div>
        {hasFilters && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-xs font-medium text-slate-500">{filteredData.length} registro(s)</span>
            <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(""); setSelectedDepartment("all"); }}>
              Limpiar filtros
            </Button>
          </div>
        )}
      </Card>

      {/* Métricas — strip en una sola superficie */}
      <Card className="overflow-hidden p-0 shadow-soft">
        <div className="grid divide-y divide-slate-100 grid-cols-2 sm:grid-cols-3 sm:divide-x lg:grid-cols-5 lg:divide-y-0">
          {stats.map((s, i) => (
            <div key={s.label} className="px-5 py-4"
              style={i >= 2 ? { borderTop: "1px solid #F3F4F6" } : undefined}>
              <p className="text-[11px] font-medium text-slate-500 truncate">{s.label}</p>
              <p className="text-xl font-semibold text-slate-900 leading-tight mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Tabla consolidada con filas expandibles */}
      <Card className="overflow-hidden shadow-soft p-0" ref={reportTableRef}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4" style={{ background: "#1E293B" }}>
          <div>
            <h3 className="text-sm font-semibold text-white">Consolidado de colaboradores</h3>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.5)" }}>
              Talento Humano · Recursos Humanos & Finanzas
            </p>
          </div>
          <span className="rounded-full px-3 py-1 text-xs font-medium text-white" style={{ background: "rgba(255,255,255,0.12)" }}>
            {filteredData.length} registros
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-14">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: "#2563EB transparent transparent transparent" }} />
            <p className="text-sm text-slate-500">Cargando información consolidada...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <FiSearch size={28} className="text-slate-300" />
            <p className="text-sm font-medium text-slate-600">
              {hasFilters ? "No se encontraron colaboradores con esos filtros" : "No hay solicitudes registradas"}
            </p>
          </div>
        ) : (
          <>
            {/* Escritorio: tabla */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3 font-semibold">Colaborador</th>
                    <th className="px-5 py-3 font-semibold">Departamento</th>
                    <th className="px-4 py-3 text-center font-semibold">Perm. aprob.</th>
                    <th className="px-4 py-3 text-center font-semibold">Perm. pend.</th>
                    <th className="px-4 py-3 text-center font-semibold">Vac. disp.</th>
                    <th className="px-4 py-3 text-center font-semibold">Vac. tom.</th>
                    <th className="px-4 py-3 text-center font-semibold">Vac. pend.</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredData.map((row) => {
                    const key = getEmail(row) || row.user_id || row.id;
                    const isOpen = expanded === key;
                    return (
                      <React.Fragment key={key}>
                        <tr className="cursor-pointer transition-colors hover:bg-slate-50" onClick={() => setExpanded(isOpen ? null : key)}>
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-slate-900">{getName(row)}</div>
                            <div className="text-[11px] text-slate-500">{getEmail(row) || "-"}</div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">{getDepartment(row)}</span>
                          </td>
                          <td className="px-4 py-3.5 text-center font-semibold text-slate-700">{getApprovedPermisos(row)}</td>
                          <td className="px-4 py-3.5 text-center font-semibold text-slate-700">{getPendingPermisos(row)}</td>
                          <td className="px-4 py-3.5 text-center font-semibold text-slate-700">{num(getRemainingVacation(row))}</td>
                          <td className="px-4 py-3.5 text-center font-semibold text-slate-700">{num(getTakenVacation(row))}</td>
                          <td className="px-4 py-3.5 text-center font-semibold text-slate-700">{num(getPendingVacation(row))}</td>
                          <td className="px-4 py-3.5 text-right">
                            <FiChevronDown size={16} className="inline text-slate-400 transition-transform" style={{ transform: isOpen ? "rotate(180deg)" : "none" }} />
                          </td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={8} className="p-0">{renderDetail(row)}</td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Móvil: tarjetas expandibles */}
            <div className="divide-y divide-slate-100 lg:hidden">
              {filteredData.map((row) => {
                const key = getEmail(row) || row.user_id || row.id;
                const isOpen = expanded === key;
                return (
                  <div key={key}>
                    <button type="button" onClick={() => setExpanded(isOpen ? null : key)}
                      className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{getName(row)}</p>
                        <p className="truncate text-[11px] text-slate-500">{getDepartment(row)}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5">Perm: {getApprovedPermisos(row)}/{getPendingPermisos(row)}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5">Vac: {num(getRemainingVacation(row))}</span>
                        </div>
                      </div>
                      <FiChevronDown size={16} className="flex-shrink-0 text-slate-400 transition-transform" style={{ transform: isOpen ? "rotate(180deg)" : "none" }} />
                    </button>
                    {isOpen && renderDetail(row)}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default PermisosConsolidadoView;
