import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiRefreshCw, FiCpu, FiFileText, FiSearch } from "react-icons/fi";
import Button from "../../../core/ui/components/Button";
import api from "../../../core/api";
import ServicioCard from "../design/ServicioCard";
import ServicioBadge from "../design/ServicioBadge";
import "../design/tokens.css";

const estadoTone = (estado) => {
  const value = (estado || "").toString().toLowerCase();
  if (["operativo", "ok"].includes(value)) return "success";
  if (["en_mantenimiento", "maintenance"].includes(value)) return "warning";
  return "neutral";
};

const EquiposPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/servicio/equipos");
      if (Array.isArray(data?.rows)) return setRows(data.rows);
      if (Array.isArray(data?.result?.rows)) return setRows(data.result.rows);
      if (Array.isArray(data?.data)) return setRows(data.data);
      if (Array.isArray(data)) return setRows(data);
      setRows([]);
    } catch (err) {
      console.warn("No se pudieron cargar equipos", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const operational = useMemo(() => rows.filter((r) => (r.estado || "").toLowerCase() === "operativo"), [rows]);

  const normalizeDocs = useCallback((row) => {
    const docs = [];

    const pushDoc = (label, value) => {
      if (!value) return;
      if (Array.isArray(value)) {
        value.filter(Boolean).forEach((entry, idx) => pushDoc(`${label} ${idx + 1}`, entry));
        return;
      }
      if (typeof value === "string") {
        docs.push({ label, url: value, name: value });
        return;
      }
      if (typeof value === "object") {
        const name = value.name || value.label || label;
        const url = value.url || value.link || value.path;
        if (url) docs.push({ label: name, url, name });
      }
    };

    pushDoc("Ficha técnica", row.ficha_tecnica || row.fichaTecnica || row.ficha || row.fichas_tecnicas);
    pushDoc("Manual", row.manual || row.manual_usuario || row.manuales);
    pushDoc("Documento", row.documento || row.documentos);

    return docs;
  }, []);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;

    return rows.filter((row) => {
      const textFields = [row.nombre, row.serial, row.modelo, row.fabricante, row.categoria, row.descripcion, row.ubicacion, row.ubicacion_actual, row.responsable, row.estado]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const docs = normalizeDocs(row);
      const docText = docs.map((d) => `${d.label} ${d.name || ""}`).join(" ").toLowerCase();

      return textFields.includes(term) || docText.includes(term);
    });
  }, [normalizeDocs, query, rows]);

  return (
    <div className="st-scope space-y-6 p-6" style={{ background: "var(--st-bg)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm" style={{ color: "var(--st-text-muted)" }}>Inventario técnico</p>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>Equipos de servicio</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--st-text-faint)" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar equipo, ficha técnica o manual"
              className="rounded-[var(--st-radius-md)] border py-2 pl-9 pr-3 text-sm outline-none"
              style={{ borderColor: "var(--st-border)", color: "var(--st-text)", background: "var(--st-surface)" }}
            />
          </div>
          <Button variant="secondary" icon={FiRefreshCw} onClick={load} disabled={loading}>Actualizar</Button>
        </div>
      </div>

      <ServicioCard className="p-5">
        {loading ? (
          <p className="text-sm" style={{ color: "var(--st-text-muted)" }}>Cargando equipos...</p>
        ) : rows.length ? (
          <div className="mb-4 space-y-2">
            <p className="text-sm" style={{ color: "var(--st-text-muted)" }}>{operational.length} operativos de {rows.length} en total.</p>
            {query ? <p className="text-xs" style={{ color: "var(--st-text-faint)" }}>{filteredRows.length} coincidencia(s) para "{query}".</p> : null}
          </div>
        ) : null}

        {rows.length ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredRows.map((eq) => {
              const docs = normalizeDocs(eq);
              return (
                <ServicioCard key={eq.id || eq._id} className="space-y-2 p-4">
                  <div className="flex items-center gap-2 font-semibold" style={{ color: "var(--st-accent)" }}>
                    <FiCpu />
                    <span>{eq.nombre || eq.serial || "Equipo"}</span>
                  </div>
                  <p className="text-sm" style={{ color: "var(--st-text-muted)" }}>Tipo: {eq.tipo || eq.category || "—"}</p>
                  <p className="text-sm" style={{ color: "var(--st-text-muted)" }}>Ubicación: {eq.ubicacion || eq.location || "—"}</p>
                  <p className="text-sm" style={{ color: "var(--st-text-muted)" }}>Responsable: {eq.responsable || "—"}</p>
                  <ServicioBadge tone={estadoTone(eq.estado)}>{eq.estado || "Sin estado"}</ServicioBadge>
                  <div className="space-y-1 pt-2 text-sm" style={{ borderTop: "1px solid var(--st-border)", color: "var(--st-text-muted)" }}>
                    <p className="font-semibold" style={{ color: "var(--st-text)" }}>Fichas técnicas y manuales</p>
                    {docs.length ? (
                      <ul className="space-y-1">
                        {docs.map((doc, idx) => (
                          <li key={`${doc.url}-${idx}`} className="flex items-center gap-2 truncate" style={{ color: "var(--st-accent)" }}>
                            <FiFileText className="shrink-0" />
                            <a href={doc.url} target="_blank" rel="noreferrer" className="truncate hover:underline" title={doc.name || doc.label}>
                              {doc.name || doc.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs" style={{ color: "var(--st-text-faint)" }}>Sin documentos asociados.</p>
                    )}
                  </div>
                </ServicioCard>
              );
            })}
          </div>
        ) : (
          <p className="text-sm" style={{ color: "var(--st-text-muted)" }}>No hay equipos registrados.</p>
        )}
        {rows.length && !filteredRows.length ? (
          <p className="mt-4 text-sm" style={{ color: "var(--st-text-muted)" }}>No se encontraron equipos ni documentos que coincidan.</p>
        ) : null}
      </ServicioCard>
    </div>
  );
};

export default EquiposPage;
