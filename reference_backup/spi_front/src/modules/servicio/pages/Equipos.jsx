import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiRefreshCw, FiCpu, FiFileText, FiSearch } from "react-icons/fi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import api from "../../../core/api";

const estadoChip = (estado) => {
  const value = (estado || "").toString().toLowerCase();
  if (["operativo", "ok"].includes(value)) return "bg-green-100 text-green-700";
  if (["en_mantenimiento", "maintenance"].includes(value)) return "bg-amber-100 text-amber-700";
  return "bg-gray-100 text-gray-700";
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

  const operational = useMemo(
    () => rows.filter((r) => (r.estado || "").toLowerCase() === "operativo"),
    [rows]
  );

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
      const textFields = [
        row.nombre,
        row.serial,
        row.modelo,
        row.fabricante,
        row.categoria,
        row.descripcion,
        row.ubicacion,
        row.ubicacion_actual,
        row.responsable,
        row.estado,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const docs = normalizeDocs(row);
      const docText = docs.map((d) => `${d.label} ${d.name || ""}`).join(" ").toLowerCase();

      return textFields.includes(term) || docText.includes(term);
    });
  }, [normalizeDocs, query, rows]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-gray-500">Inventario técnico</p>
          <h1 className="text-2xl font-semibold text-gray-900">Equipos de servicio</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar equipo, ficha técnica o manual"
              className="pl-9 pr-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <Button variant="secondary" icon={FiRefreshCw} onClick={load} disabled={loading}>
            Actualizar
          </Button>
        </div>
      </div>

      <Card className="p-5">
        {loading ? (
          <p className="text-sm text-gray-500">Cargando equipos...</p>
        ) : rows.length ? (
          <div className="space-y-2 mb-4">
            <p className="text-sm text-gray-600">
              {operational.length} operativos de {rows.length} en total.
            </p>
            {query ? (
              <p className="text-xs text-gray-500">{filteredRows.length} coincidencia(s) para "{query}".</p>
            ) : null}
          </div>
        ) : null}

        {rows.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRows.map((eq) => {
              const docs = normalizeDocs(eq);

              return (
                <div key={eq.id || eq._id} className="border rounded-lg p-4 space-y-2 bg-white">
                  <div className="flex items-center gap-2 text-blue-600 font-semibold">
                    <FiCpu />
                    <span>{eq.nombre || eq.serial || "Equipo"}</span>
                  </div>
                  <p className="text-sm text-gray-600">Tipo: {eq.tipo || eq.category || "—"}</p>
                  <p className="text-sm text-gray-600">Ubicación: {eq.ubicacion || eq.location || "—"}</p>
                  <p className="text-sm text-gray-600">Responsable: {eq.responsable || "—"}</p>
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${estadoChip(eq.estado)}`}>
                    {eq.estado || "Sin estado"}
                  </span>
                  <div className="pt-2 border-t text-sm text-gray-700 space-y-1">
                    <p className="font-semibold text-gray-800">Fichas técnicas y manuales</p>
                    {docs.length ? (
                      <ul className="space-y-1">
                        {docs.map((doc, idx) => (
                          <li key={`${doc.url}-${idx}`} className="flex items-center gap-2 text-blue-600 truncate">
                            <FiFileText className="shrink-0" />
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate hover:underline"
                              title={doc.name || doc.label}
                            >
                              {doc.name || doc.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-gray-500">Sin documentos asociados.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No hay equipos registrados.</p>
        )}
        {rows.length && !filteredRows.length ? (
          <p className="text-sm text-gray-500 mt-4">No se encontraron equipos ni documentos que coincidan.</p>
        ) : null}
      </Card>
    </div>
  );
};

export default EquiposPage;
