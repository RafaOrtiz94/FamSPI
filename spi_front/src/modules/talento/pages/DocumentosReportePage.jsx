import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiArrowDown,
  FiArrowUp,
  FiCheckCircle,
  FiDownload,
  FiExternalLink,
  FiFilter,
  FiRefreshCw,
  FiSearch,
  FiUsers,
  FiX,
  FiXCircle,
} from "react-icons/fi";
import toast from "react-hot-toast";

import {
  generateDocumentsConsolidated,
  getDocumentsReport,
} from "../../../core/api/collaboratorsApi";
import { documentTypes } from "../components/collaboratorProfileDefinitions";

// ── Constantes ────────────────────────────────────────────────────────────────

const WORKSPACE_PAGE_CLASS = "flex min-w-0 flex-col";

const GROUP_LABELS = {
  profile: "Perfil personal",
  talento_humano: "Talento humano",
  contracts: "Contratos",
  induction: "Induccion",
  financiero: "Financiero",
  automatico: "Actas automaticas",
};

const MANUAL_DOC_TYPES = documentTypes.filter((d) => d.sourceChannel !== "integracion");
const ALL_OPTION = { key: "", label: "Todos los documentos" };
const DOC_OPTIONS = [ALL_OPTION, ...MANUAL_DOC_TYPES];

const QUALIFICATION_LABELS = {
  third_level_title: "Titulo de tercer nivel",
  fourth_level_title: "Titulo de cuarto nivel",
  certification: "Certificacion",
};

const CONSOLIDATION_OPTIONS = [
  ...MANUAL_DOC_TYPES.map((item) => ({
    key: item.key,
    label: item.label,
    group: GROUP_LABELS[item.group] || item.group,
  })),
  { key: "qualification:third_level_title", label: "Titulos de tercer nivel", group: "Titulos y certificaciones" },
  { key: "qualification:fourth_level_title", label: "Titulos de cuarto nivel", group: "Titulos y certificaciones" },
  { key: "qualification:certification", label: "Certificaciones", group: "Titulos y certificaciones" },
  { key: "qualification:pending", label: "Credenciales pendientes de clasificacion", group: "Titulos y certificaciones" },
];

const fmt = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("es-EC", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

// ── Helpers ───────────────────────────────────────────────────────────────────

const StatusBadge = ({ estatus = "" }) => {
  const s = String(estatus || "").toLowerCase();
  const passive = s === "pasivo" || s === "desvinculado" || s === "inactivo";
  return passive ? (
    <span className="inline-flex items-center rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-medium text-[#6B7280]">
      Pasivo
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[11px] font-medium text-[#16A34A]">
      Activo
    </span>
  );
};

// ── Vista filtrada (un documento) ─────────────────────────────────────────────

const SingleDocView = ({ rows, docDef }) => {
  const { key, label } = docDef;
  const withDoc = rows.filter((r) => r.documents[key]);
  const withoutDoc = rows.filter((r) => !r.documents[key]);

  return (
    <div className="flex flex-col gap-4">
      {/* Resumen — strip horizontal, no hero-cards */}
      <div className="grid grid-cols-3 divide-x divide-[#E5E7EB] overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
        <div className="px-4 py-4 sm:px-6">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#6B7280]">Total</p>
          <p className="mt-0.5 text-2xl font-bold text-[#1F2937]">{rows.length}</p>
        </div>
        <div className="px-4 py-4 sm:px-6">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#16A34A]">Con documento</p>
          <p className="mt-0.5 text-2xl font-bold text-[#16A34A]">{withDoc.length}</p>
        </div>
        <div className="px-4 py-4 sm:px-6">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#DC2626]">Sin documento</p>
          <p className="mt-0.5 text-2xl font-bold text-[#DC2626]">{withoutDoc.length}</p>
        </div>
      </div>

      {/* Alerta faltantes */}
      {withoutDoc.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-[#FEF3C7] bg-[#FEF3C7] px-4 py-3 text-sm text-[#D97706]">
          <FiAlertCircle size={15} className="shrink-0" />
          <span>
            <strong>{withoutDoc.length}</strong> colaborador{withoutDoc.length !== 1 ? "es" : ""}{" "}
            no tiene <strong>{label}</strong>.
          </span>
        </div>
      )}

      {/* Tabla desktop / Tarjetas mobile */}
      <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
        {/* Tabla — solo sm+ */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
                  Colaborador
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
                  Cargo / Area
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
                  Estatus
                </th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
                  {label}
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
                  Fecha subida
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
                  Enlace
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {rows.map((row) => {
                const doc = row.documents[key];
                const fecha = fmt(doc?.created_at);
                return (
                  <tr
                    key={row.user_id}
                    className={`transition-colors hover:bg-[#F9FAFB] ${!doc ? "bg-[#FEE2E2]/20" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#1F2937]">{row.fullname}</p>
                      <p className="text-[11px] text-[#6B7280]">{row.email}</p>
                    </td>
                    <td className="px-4 py-3 text-[#1F2937]">
                      <p>{row.cargo || "—"}</p>
                      {row.area && <p className="text-[11px] text-[#6B7280]">{row.area}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge estatus={row.estatus_empleado} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {doc ? (
                        <FiCheckCircle size={18} className="mx-auto text-[#16A34A]" />
                      ) : (
                        <FiXCircle size={18} className="mx-auto text-[#DC2626]" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[#6B7280]">
                      {fecha ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {doc?.drive_url ? (
                        <a
                          href={doc.drive_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex cursor-pointer items-center gap-1 text-[12px] text-[#2563EB] hover:text-[#1D4ED8] hover:underline"
                        >
                          <FiExternalLink size={12} />
                          Abrir
                        </a>
                      ) : (
                        <span className="text-[12px] text-[#6B7280]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Tarjetas mobile — solo <sm */}
        <div className="divide-y divide-[#E5E7EB] sm:hidden">
          {rows.map((row) => {
            const doc = row.documents[key];
            const fecha = fmt(doc?.created_at);
            return (
              <div
                key={row.user_id}
                className={`px-4 py-4 ${!doc ? "bg-[#FEE2E2]/20" : ""}`}
              >
                {/* Fila superior: nombre + icono estado */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[#1F2937]">{row.fullname}</p>
                    <p className="truncate text-[11px] text-[#6B7280]">{row.cargo || row.area || row.email}</p>
                  </div>
                  <div className="shrink-0 pt-0.5">
                    {doc ? (
                      <FiCheckCircle size={20} className="text-[#16A34A]" />
                    ) : (
                      <FiXCircle size={20} className="text-[#DC2626]" />
                    )}
                  </div>
                </div>

                {/* Fila inferior: estatus + fecha + enlace */}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <StatusBadge estatus={row.estatus_empleado} />
                  {fecha && (
                    <span className="font-mono text-[11px] text-[#6B7280]">{fecha}</span>
                  )}
                  {doc?.drive_url && (
                    <a
                      href={doc.drive_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex cursor-pointer items-center gap-1 text-[12px] text-[#2563EB] hover:underline"
                    >
                      <FiExternalLink size={11} />
                      Abrir documento
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── Vista global (todos los documentos, matriz por grupo) ─────────────────────

const AllDocsView = ({ rows }) => {
  const groups = useMemo(() => {
    const map = {};
    MANUAL_DOC_TYPES.forEach((dt) => {
      if (!map[dt.group]) map[dt.group] = [];
      map[dt.group].push(dt);
    });
    return map;
  }, []);

  const groupKeys = Object.keys(groups);

  return (
    <div className="flex flex-col gap-6">
      {/* Aviso en mobile */}
      <div className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[13px] text-[#6B7280] sm:hidden">
        <FiFilter size={14} className="shrink-0" />
        <span>
          Para ver el detalle en movil, selecciona un documento especifico en el filtro de arriba.
        </span>
      </div>

      {groupKeys.map((groupKey) => {
        const defs = groups[groupKey];
        return (
          <div
            key={groupKey}
            className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)]"
          >
            <div className="border-b border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
                {GROUP_LABELS[groupKey] || groupKey}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]/60">
                    <th className="sticky left-0 bg-[#F9FAFB]/90 px-4 py-2 text-left text-[11px] font-semibold text-[#6B7280] backdrop-blur-sm">
                      Colaborador
                    </th>
                    {defs.map((dt) => (
                      <th
                        key={dt.key}
                        className="px-3 py-2 text-center text-[11px] font-semibold text-[#6B7280]"
                        title={dt.label}
                      >
                        <span className="block max-w-[88px] truncate">{dt.label}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {rows.map((row) => {
                    const total = defs.length;
                    const done = defs.filter((dt) => row.documents[dt.key]).length;
                    const allDone = done === total;
                    return (
                      <tr key={row.user_id} className="hover:bg-[#F9FAFB]">
                        <td className="sticky left-0 bg-white px-4 py-2">
                          <div className="flex min-w-[140px] items-center gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-medium text-[#1F2937]">
                                {row.fullname}
                              </p>
                              <p className="truncate text-[10px] text-[#6B7280]">
                                {row.cargo || row.area || ""}
                              </p>
                            </div>
                            <span
                              className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                                allDone
                                  ? "bg-[#DCFCE7] text-[#16A34A]"
                                  : done === 0
                                  ? "bg-[#FEE2E2] text-[#DC2626]"
                                  : "bg-[#FEF3C7] text-[#D97706]"
                              }`}
                            >
                              {done}/{total}
                            </span>
                          </div>
                        </td>
                        {defs.map((dt) => {
                          const doc = row.documents[dt.key];
                          return (
                            <td key={dt.key} className="px-3 py-2 text-center">
                              {doc ? (
                                <span className="flex items-center justify-center gap-1">
                                  <FiCheckCircle size={15} className="text-[#16A34A]" />
                                  {doc.drive_url && (
                                    <a
                                      href={doc.drive_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="cursor-pointer text-[#2563EB] hover:text-[#1D4ED8]"
                                    >
                                      <FiExternalLink size={12} />
                                    </a>
                                  )}
                                </span>
                              ) : (
                                <FiXCircle size={15} className="mx-auto text-[#DC2626]" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const QualificationsView = ({ rows }) => {
  const qualifications = rows.flatMap((row) =>
    (Array.isArray(row.qualifications) ? row.qualifications : []).map((item) => ({
      ...item,
      fullname: row.fullname,
      email: row.email,
      cargo: row.cargo,
    })),
  );

  const totals = Object.keys(QUALIFICATION_LABELS).reduce((acc, type) => {
    acc[type] = qualifications.filter((item) => item.qualification_type === type).length;
    return acc;
  }, {});
  const pendingCount = qualifications.filter((item) => item.pending_classification).length;
  const qualificationLabel = (item) =>
    item.pending_classification
      ? "Pendiente de clasificar"
      : QUALIFICATION_LABELS[item.qualification_type] || item.qualification_type || "Sin clasificacion";

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)] sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h2 className="text-base font-semibold text-[#1F2937]">Titulos y certificaciones</h2>
          <p className="mt-1 text-[13px] text-[#6B7280]">
            Credenciales academicas y profesionales registradas en el expediente central.
          </p>
        </div>
        <span className="text-[12px] font-medium text-[#6B7280]">
          {qualifications.length} registro{qualifications.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ["Titulo de tercer nivel", totals.third_level_title, "#2563EB"],
          ["Titulo de cuarto nivel", totals.fourth_level_title, "#4F46E5"],
          ["Certificaciones", totals.certification, "#D97706"],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3">
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
            <p className="mt-1 text-[12px] text-[#6B7280]">{label}</p>
          </div>
        ))}
      </div>

      {pendingCount > 0 && (
        <div className="rounded-xl border border-[#FEF3C7] bg-[#FFFBEB] px-4 py-3 text-[13px] text-[#B45309]">
          <strong>{pendingCount}</strong> registro{pendingCount === 1 ? "" : "s"} historico{pendingCount === 1 ? "" : "s"} requiere{pendingCount === 1 ? "" : "n"} clasificacion antes de considerarse titulo o certificacion validada.
        </div>
      )}

      {qualifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D1D5DB] px-4 py-8 text-center text-[13px] text-[#6B7280]">
          No hay titulos o certificaciones activas para los colaboradores filtrados.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E5E7EB]">
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  {['Colaborador', 'Tipo', 'Titulo o certificacion', 'Institucion', 'Emision', 'Enlace'].map((label) => (
                    <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]}">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {qualifications.map((item) => (
                  <tr key={`${item.user_id || item.email}-${item.id}`} className="hover:bg-[#F9FAFB]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#1F2937]">{item.fullname}</p>
                      <p className="text-[11px] text-[#6B7280]">{item.email}</p>
                    </td>
                    <td className="px-4 py-3 text-[#374151]">{qualificationLabel(item)}</td>
                    <td className="max-w-[240px] px-4 py-3 text-[#1F2937]">{item.title || "Sin titulo registrado"}</td>
                    <td className="px-4 py-3 text-[#374151]">{item.institution || item.issuer || "No registrada"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-[12px] text-[#6B7280]">{fmt(item.issue_date) || "—"}</td>
                    <td className="px-4 py-3">
                      {item.drive_url ? (
                        <a href={item.drive_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] text-[#2563EB] hover:underline">
                          <FiExternalLink size={12} /> Abrir
                        </a>
                      ) : <span className="text-[12px] text-[#6B7280]">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-[#E5E7EB] sm:hidden">
            {qualifications.map((item) => (
              <article key={`${item.user_id || item.email}-${item.id}`} className="flex flex-col gap-2 px-4 py-4">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[#1F2937]">{item.fullname}</p>
                    <p className="truncate text-[11px] text-[#6B7280]">{item.email}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#EFF6FF] px-2 py-1 text-[10px] font-medium text-[#2563EB]">
                    {qualificationLabel(item)}
                  </span>
                </div>
                <p className="text-sm font-medium text-[#1F2937]">{item.title || "Sin titulo registrado"}</p>
                <p className="text-[12px] text-[#6B7280]">{item.institution || item.issuer || "Institucion no registrada"} · {fmt(item.issue_date) || "Fecha no registrada"}</p>
                {item.drive_url && (
                  <a href={item.drive_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 self-start text-[12px] text-[#2563EB] hover:underline">
                    <FiExternalLink size={11} /> Abrir respaldo
                  </a>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

const ConsolidatedBuilder = ({ rows }) => {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [generating, setGenerating] = useState(false);

  const userIds = useMemo(() => rows.map((row) => Number(row.user_id)).filter(Boolean), [rows]);
  const documentOptions = useMemo(
    () => CONSOLIDATION_OPTIONS.map((option) => ({
      ...option,
      count: rows.reduce((total, row) => {
        if (option.key.startsWith("qualification:")) {
          const qualificationType = option.key.replace("qualification:", "");
          return total + (row.qualifications || []).filter((item) =>
            qualificationType === "pending"
              ? item.pending_classification
              : item.qualification_type === qualificationType,
          ).length;
        }
        return total + (row.documents?.[option.key] ? 1 : 0);
      }, 0),
    })),
    [rows],
  );

  const allUsersSelected = userIds.length > 0 && selectedUsers.length === userIds.length;
  const allDocumentsSelected = selectedKeys.length === documentOptions.length;
  const orderedDocumentOptions = useMemo(() => {
    const byKey = new Map(documentOptions.map((option) => [option.key, option]));
    const selected = selectedKeys.map((key) => byKey.get(key)).filter(Boolean);
    const pending = documentOptions.filter((option) => !selectedKeys.includes(option.key));
    return [...selected, ...pending];
  }, [documentOptions, selectedKeys]);

  const toggleUser = (userId) => {
    setSelectedUsers((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  };

  const toggleDocument = (key) => {
    setSelectedKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  };

  const moveDocument = (key, direction) => {
    setSelectedKeys((current) => {
      const index = current.indexOf(key);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const downloadResponse = (response) => {
    const contentType = response.headers?.["content-type"] || "application/octet-stream";
    const disposition = response.headers?.["content-disposition"] || "";
    const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
    const filename = filenameMatch?.[1] || (contentType.includes("zip") ? "consolidados_documentacion.zip" : "consolidado_documentacion.pdf");
    const blob = new Blob([response.data], { type: contentType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleGenerate = async () => {
    if (!selectedUsers.length) {
      toast.error("Selecciona al menos un colaborador");
      return;
    }
    if (!selectedKeys.length) {
      toast.error("Selecciona al menos un documento");
      return;
    }

    setGenerating(true);
    try {
      const response = await generateDocumentsConsolidated({
        user_ids: selectedUsers,
        document_keys: selectedKeys,
      });
      downloadResponse(response);
      toast.success(selectedUsers.length === 1 ? "Consolidado generado" : "Consolidados generados en un ZIP");
    } catch (error) {
      toast.error(error?.response?.data?.message || "No se pudo generar el consolidado");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)] sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#1F2937]">
            <FiDownload className="text-[#2563EB]" size={17} />
            Generar consolidado
          </h2>
          <p className="mt-1 text-[13px] text-[#6B7280]">
            Selecciona los colaboradores y los documentos que deben unirse en cada expediente PDF.
          </p>
        </div>
        <span className="text-[12px] font-medium text-[#6B7280]">
          {selectedUsers.length} colaborador{selectedUsers.length === 1 ? "" : "es"} · {selectedKeys.length} documento{selectedKeys.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">
              <FiUsers size={14} /> Colaboradores
            </p>
            <button
              type="button"
              onClick={() => setSelectedUsers(allUsersSelected ? [] : userIds)}
              className="cursor-pointer text-[12px] font-medium text-[#2563EB] hover:underline"
            >
              {allUsersSelected ? "Limpiar" : "Seleccionar todos"}
            </button>
          </div>
          <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white">
            {rows.map((row) => {
              const userId = Number(row.user_id);
              return (
                <label key={userId} className="flex cursor-pointer items-start gap-3 border-b border-[#F3F4F6] px-3 py-2.5 last:border-b-0 hover:bg-[#F9FAFB]">
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(userId)}
                    onChange={() => toggleUser(userId)}
                    className="mt-0.5 h-4 w-4 cursor-pointer accent-[#2563EB]"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[#1F2937]">{row.fullname}</span>
                    <span className="block truncate text-[11px] text-[#6B7280]">{row.email}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">Documentos a unir</p>
            <button
              type="button"
              onClick={() => setSelectedKeys(allDocumentsSelected ? [] : documentOptions.map((option) => option.key))}
              className="cursor-pointer text-[12px] font-medium text-[#2563EB] hover:underline"
            >
              {allDocumentsSelected ? "Limpiar" : "Seleccionar todos"}
            </button>
          </div>
          <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white">
            {orderedDocumentOptions.map((option) => {
              const selectedIndex = selectedKeys.indexOf(option.key);
              const isSelected = selectedIndex >= 0;
              return (
              <div key={option.key} className="flex items-start gap-3 border-b border-[#F3F4F6] px-3 py-2.5 last:border-b-0 hover:bg-[#F9FAFB]">
                <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleDocument(option.key)}
                  className="mt-0.5 h-4 w-4 cursor-pointer accent-[#2563EB]"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    {isSelected && (
                      <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] px-1.5 text-[10px] font-semibold text-[#1D4ED8]">
                        {selectedIndex + 1}
                      </span>
                    )}
                    <span className="block truncate text-sm font-medium text-[#1F2937]">{option.label}</span>
                  </span>
                  <span className="block truncate text-[11px] text-[#6B7280]">{option.group} · {option.count} disponible{option.count === 1 ? "" : "s"}</span>
                </span>
                </label>
                {isSelected && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveDocument(option.key, -1)}
                      disabled={selectedIndex === 0}
                      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#D1D5DB] bg-white text-[#6B7280] hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40"
                      title="Subir documento en el consolidado"
                    >
                      <FiArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDocument(option.key, 1)}
                      disabled={selectedIndex === selectedKeys.length - 1}
                      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#D1D5DB] bg-white text-[#6B7280] hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40"
                      title="Bajar documento en el consolidado"
                    >
                      <FiArrowDown size={14} />
                    </button>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] text-[#1E40AF]">
          Para varios colaboradores se descargara un ZIP con un PDF independiente por cada persona.
        </p>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || !selectedUsers.length || !selectedKeys.length}
          className="inline-flex min-h-[42px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 text-sm font-medium text-white shadow-sm transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiDownload size={15} className={generating ? "animate-bounce" : ""} />
          {generating ? "Generando..." : "Generar consolidado"}
        </button>
      </div>
    </section>
  );
};

// ── Componente principal ──────────────────────────────────────────────────────

export default function DocumentosReportePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      const res = await getDocumentsReport(params);
      setRows(Array.isArray(res?.data) ? res.data : []);
    } catch {
      toast.error("No se pudo cargar el reporte de documentacion");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  const clearSearch = () => {
    setSearch("");
    setSearchInput("");
  };

  const selectedDef = useMemo(
    () => MANUAL_DOC_TYPES.find((d) => d.key === selectedDocType) || null,
    [selectedDocType],
  );

  return (
    <div className={`${WORKSPACE_PAGE_CLASS} gap-6`}>
      {/* Cabecera */}
      <div className="flex flex-col gap-1">
        <h1 className="text-[clamp(1.25rem,3vw,1.5rem)] font-bold leading-tight tracking-tight text-[#1F2937]">
          Reporte de documentacion
        </h1>
        <p className="text-[13px] text-[#6B7280]">
          Consulta que colaboradores tienen o no cada documento del expediente laboral. Filtra por tipo para ver
          el estado de todos.
        </p>
      </div>

      {/* Controles — apilados en mobile, fila en desktop */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        {/* Filtro por documento */}
        <div className="flex-1 sm:min-w-[220px]">
          <label className="mb-1 block text-[11px] font-medium text-[#6B7280]">
            <FiFilter size={10} className="mr-1 inline" />
            Filtrar por documento
          </label>
          <select
            value={selectedDocType}
            onChange={(e) => setSelectedDocType(e.target.value)}
            className="w-full cursor-pointer rounded-xl border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm text-[#1F2937] shadow-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
          >
            {DOC_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Buscar colaborador */}
        <form onSubmit={handleSearch} className="flex flex-col gap-1 sm:flex-row sm:items-end sm:gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-[11px] font-medium text-[#6B7280]">
              <FiSearch size={10} className="mr-1 inline" />
              Buscar colaborador
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Nombre o email..."
                className="w-full min-h-[44px] rounded-xl border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm text-[#1F2937] shadow-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 sm:w-52"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-[#6B7280] hover:text-[#1F2937]"
                >
                  <FiX size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#2563EB] px-4 text-sm font-medium text-white shadow-sm transition-transform duration-[120ms] cubic-bezier(0.23,1,0.32,1) active:scale-[0.97] hover:bg-[#1D4ED8] sm:flex-none"
            >
              <FiSearch size={14} />
              Buscar
            </button>
            {search && (
              <button
                type="button"
                onClick={clearSearch}
                className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#D1D5DB] bg-white px-3 text-sm text-[#1F2937] transition-transform duration-[120ms] active:scale-[0.97] hover:bg-[#F9FAFB]"
              >
                <FiX size={14} />
                <span className="hidden sm:inline">Limpiar</span>
              </button>
            )}
          </div>
        </form>

        {/* Actualizar */}
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 self-end rounded-xl border border-[#D1D5DB] bg-white px-3 text-sm text-[#6B7280] transition-transform duration-[120ms] active:scale-[0.97] hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span className="hidden sm:inline">{loading ? "Cargando..." : "Actualizar"}</span>
        </button>
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#6B7280]">
          <FiRefreshCw size={24} className="animate-spin text-[#2563EB]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#D1D5DB] py-20 text-[#6B7280]">
          <FiSearch size={32} className="text-[#D1D5DB]" />
          <p className="text-sm font-medium text-[#1F2937]">No se encontraron colaboradores</p>
          <p className="text-[13px] text-[#6B7280]">Ajusta los filtros o actualiza el reporte.</p>
        </div>
      ) : selectedDef ? (
        <>
          <ConsolidatedBuilder rows={rows} />
          <SingleDocView rows={rows} docDef={selectedDef} />
          <QualificationsView rows={rows} />
        </>
      ) : (
        <>
          <ConsolidatedBuilder rows={rows} />
          <AllDocsView rows={rows} />
          <QualificationsView rows={rows} />
        </>
      )}
    </div>
  );
}
