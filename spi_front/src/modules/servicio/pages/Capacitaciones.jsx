import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiRefreshCw, FiArrowRight } from "react-icons/fi";
import Button from "../../../core/ui/components/Button";
import api from "../../../core/api";
import ServicioCard from "../design/ServicioCard";
import ServicioEmptyState from "../design/ServicioEmptyState";
import "../design/tokens.css";

const inputClass = "rounded-[var(--st-radius-md)] border px-3 py-2 text-sm outline-none";
const inputStyle = { borderColor: "var(--st-border)", color: "var(--st-text)", background: "var(--st-surface)" };

const MODALIDAD_TAG = { presencial: "PRE", virtual: "VIR", hibrida: "HIB" };

const normalizeText = (value) => String(value || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Decision §6 del plan de rework, tomada tras revisar el codigo real: esta
// pagina y el card "Entrenamiento ST-01-01" de Aplicaciones.jsx (Fase 5) NO
// son la misma funcionalidad con 2 entradas -- consumen endpoints distintos
// con proposito distinto. Esta es CATALOGO/AGENDA de solo lectura
// (`/servicio/capacitaciones`); la otra es EJECUCION del flujo F.ST-
// 04/05/06/08/12 (`TrainingWorkflowWorkspace`, con timeline y expediente
// documental). Se mantienen separadas pero se cruzan: cada fila de aqui
// enlaza a la ejecucion real, no duplica su formulario.
const CapacitacionesPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [modalidadFilter, setModalidadFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/servicio/capacitaciones");
      if (Array.isArray(data?.rows)) return setRows(data.rows);
      if (Array.isArray(data?.result?.rows)) return setRows(data.result.rows);
      if (Array.isArray(data?.data)) return setRows(data.data);
      if (Array.isArray(data)) return setRows(data);
      setRows([]);
    } catch (err) {
      console.warn("No se pudieron cargar capacitaciones", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const modalidadOptions = useMemo(() => {
    const set = new Set(rows.map((row) => normalizeText(row.modalidad || row.mode)).filter(Boolean));
    return Array.from(set);
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = normalizeText(query);
    return rows
      .filter((row) => (modalidadFilter === "all" ? true : normalizeText(row.modalidad || row.mode) === modalidadFilter))
      .filter((row) => {
        if (!term) return true;
        const text = normalizeText([row.area, row.tema, row.title, row.responsable, row.owner].filter(Boolean).join(" "));
        return text.includes(term);
      })
      .sort((a, b) => String(a.fecha || a.date || "").localeCompare(String(b.fecha || b.date || "")));
  }, [rows, query, modalidadFilter]);

  return (
    <div className="st-scope space-y-6 p-6" style={{ background: "var(--st-bg)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm" style={{ color: "var(--st-text-muted)" }}>Plan de formación</p>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>Capacitaciones</h1>
        </div>
        <Button variant="secondary" icon={FiRefreshCw} onClick={load} disabled={loading}>Actualizar</Button>
      </div>

      <ServicioCard className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm" style={{ color: "var(--st-text-muted)" }}>
          Este es el catálogo/agenda de formación. Para ejecutar el flujo (coordinación, asistencia, evaluación, certificado) de un entrenamiento puntual, usa el workflow integrado.
        </p>
        <Link
          to="/dashboard/servicio-tecnico/aplicaciones?open=trainingWorkflow"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold"
          style={{ color: "var(--st-accent)" }}
        >
          Ejecutar workflow F.ST-04/05/06/08/12 <FiArrowRight size={14} />
        </Link>
      </ServicioCard>

      <ServicioCard className="p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por tema, área o responsable"
            className={`flex-1 ${inputClass}`}
            style={{ ...inputStyle, minWidth: 200 }}
          />
          {modalidadOptions.length > 1 ? (
            <select value={modalidadFilter} onChange={(event) => setModalidadFilter(event.target.value)} className={inputClass} style={inputStyle}>
              <option value="all">Toda modalidad</option>
              {modalidadOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          ) : null}
        </div>

        {loading ? (
          <p className="text-sm" style={{ color: "var(--st-text-muted)" }}>Cargando capacitaciones...</p>
        ) : filteredRows.length ? (
          <div className="divide-y" style={{ borderColor: "var(--st-border)" }}>
            {filteredRows.map((cap) => {
              const modalidad = normalizeText(cap.modalidad || cap.mode);
              return (
                <div key={cap.id || cap._id} className="flex flex-wrap items-start gap-3 py-3">
                  <span
                    className="font-mono-data mt-0.5 shrink-0 rounded-[3px] px-1.5 py-0.5 text-[10px] font-bold tracking-wide"
                    style={{ background: "var(--st-surface-sunken)", color: "var(--st-accent-strong)" }}
                  >
                    {MODALIDAD_TAG[modalidad] || "CAP"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold" style={{ color: "var(--st-text)" }}>{cap.tema || cap.title}</p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--st-text-muted)" }}>
                      {cap.area || "Equipo"} · Responsable: {cap.responsable || cap.owner || "—"}
                    </p>
                  </div>
                  <span className="font-mono-data shrink-0 text-xs tabular-nums" style={{ color: "var(--st-text-faint)" }}>
                    {cap.fecha || cap.date || "Por definir"}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <ServicioEmptyState
            title="Sin capacitaciones para este filtro."
            description="Ajusta la búsqueda o la modalidad, o revisa el workflow de ejecución si buscas registrar una nueva."
          />
        )}
      </ServicioCard>
    </div>
  );
};

export default CapacitacionesPage;
