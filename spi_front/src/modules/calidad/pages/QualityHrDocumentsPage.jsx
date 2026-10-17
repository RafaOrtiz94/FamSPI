import React, { useCallback, useEffect, useState } from "react";
import { FiExternalLink, FiFileText, FiRefreshCw, FiSearch } from "react-icons/fi";
import { getQualityHrDocuments } from "../api/qualityHrDocumentsApi";

const DOCUMENTS = [
  ["SENESCYT_RECORD", "Registro SENESCYT"],
  ["CONTRACT_FAM", "Contrato FAM"],
  ["HR_RESUME", "Hoja de vida"],
  ["IMAGE_USE_AUTHORIZATION", "Autorización de uso de imagen"],
];

export default function QualityHrDocumentsPage() {
  const [rows, setRows] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [segment, setSegment] = useState("active");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getQualityHrDocuments(search ? { search } : {});
      setRows(Array.isArray(result?.data) ? result.data : []);
    } catch {
      setError("No se pudieron cargar los documentos de RRHH.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const visibleRows = rows.filter((row) => row.employment_segment === segment);
  const qualificationLabel = (type) => ({
    third_level_title: "Título de tercer nivel",
    fourth_level_title: "Título de cuarto nivel",
    certification: "Certificado",
  }[type] || "Título o certificado");

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Calidad</p>
          <h1 className="text-2xl font-bold text-slate-900">Documentos de RRHH</h1>
          <p className="mt-1 text-sm text-slate-600">Consulta de solo lectura de documentos, títulos y certificados del personal.</p>
        </header>

        <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2">
          {[['active', 'Activos'], ['disassociated', 'Desvinculados']].map(([value, label]) => (
            <button key={value} type="button" onClick={() => setSegment(value)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${segment === value ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              {label} ({rows.filter((row) => row.employment_segment === value).length})
            </button>
          ))}
        </div>

        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); setSearch(searchInput.trim()); }}>
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-3 text-slate-400" />
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Buscar por nombre o correo" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-400" />
          </div>
          <button type="submit" className="rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white">Buscar</button>
          <button type="button" onClick={load} className="rounded-xl border border-slate-200 bg-white px-3 text-slate-600" aria-label="Actualizar"><FiRefreshCw className={loading ? "animate-spin" : ""} /></button>
        </form>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {loading ? <div className="rounded-xl bg-white p-10 text-center text-sm text-slate-500">Cargando documentos...</div> : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Personal</th>{DOCUMENTS.map(([, label]) => <th key={label} className="px-4 py-3">{label}</th>)}<th className="px-4 py-3">Títulos y certificados</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.map((row) => <tr key={row.user_id} className="hover:bg-slate-50"><td className="px-4 py-3"><p className="font-semibold text-slate-900">{row.fullname}</p><p className="text-xs text-slate-500">{row.email}</p></td>{DOCUMENTS.map(([code]) => { const doc = row.documents?.[code]; return <td key={code} className="px-4 py-3">{doc?.drive_url ? <a href={doc.drive_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"><FiFileText /> Ver <FiExternalLink size={12} /></a> : <span className="text-xs text-slate-400">No registrado</span>}</td>; })}<td className="max-w-[300px] px-4 py-3">{row.qualifications?.length ? <div className="space-y-1">{row.qualifications.map((qualification) => <div key={`${qualification.id}-${qualification.title}`} className="text-xs"><span className="font-semibold text-slate-700">{qualificationLabel(qualification.qualification_type)}:</span>{" "}{qualification.drive_url ? <a href={qualification.drive_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{qualification.title || "Ver documento"}</a> : <span className="text-slate-600">{qualification.title || "Registrado"}</span>}</div>)}</div> : <span className="text-xs text-slate-400">No registrado</span>}</td></tr>)}
              </tbody>
            </table>
            {!visibleRows.length && <p className="p-10 text-center text-sm text-slate-500">No se encontraron colaboradores en esta categoría.</p>}
          </div>
        )}
      </div>
    </main>
  );
}
