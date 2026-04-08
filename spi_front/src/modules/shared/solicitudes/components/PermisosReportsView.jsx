import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { FiDownload, FiSearch, FiRefreshCw, FiFileText, FiTable } from "react-icons/fi";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import Select from "../../../../core/ui/components/Select";
import { getResumenColaboradores } from "../../../../core/api/permisosApi";
import { useUI } from "../../../../core/ui/UIContext";

const getCollaboratorName = (row = {}) =>
  row.user_fullname || row.fullname || row.user_email || row.email || "Usuario";

const getCollaboratorEmail = (row = {}) => row.user_email || row.email || "";

const getDepartmentName = (row = {}) => row.department_name || "Sin departamento";

const getApprovedPermisos = (row = {}) =>
  Number(
    row?.permisos?.summary?.total_approved ??
      row?.permisos?.aprobacion_completa ??
      row?.permisos?.aprobados ??
      0
  );

const getPendingPermisos = (row = {}) =>
  Number(
    row?.permisos?.summary?.total_pending ??
      row?.permisos?.pendientes ??
      0
  );

const getVacationAllowance = (row = {}) =>
  Number(
    row?.vacaciones?.summary?.allowance ??
      row?.vacaciones?.dias_disponibles ??
      0
  );

const getTakenVacation = (row = {}) =>
  Number(
    row?.vacaciones?.summary?.taken ??
      row?.vacaciones?.dias_aprobados ??
      0
  );

const getPendingVacation = (row = {}) =>
  Number(
    row?.vacaciones?.summary?.pending ??
      row?.vacaciones?.dias_pendientes ??
      0
  );

const getRemainingVacation = (row = {}) =>
  Number(
    row?.vacaciones?.summary?.remaining ??
      row?.vacaciones?.dias_restantes ??
      getVacationAllowance(row)
  );

const PermisosReportsView = () => {
  const { showLoader, hideLoader } = useUI();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [searchTerm, setSearchInput] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const reportTableRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getResumenColaboradores();
      if (res?.ok) {
        setData(res.data || []);
      }
    } catch (err) {
      console.error("Error cargando informe:", err);
      toast.error("No se pudo cargar el informe consolidado");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const departments = useMemo(() => {
    const deps = new Set(data.map((d) => getDepartmentName(d)).filter(Boolean));
    return ["all", ...Array.from(deps)].map((d) => ({
      label: d === "all" ? "Todos los departamentos" : d,
      value: d,
    }));
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const collaboratorName = getCollaboratorName(item).toLowerCase();
      const collaboratorEmail = getCollaboratorEmail(item).toLowerCase();
      const collaboratorDepartment = getDepartmentName(item);
      const matchesSearch =
        collaboratorName.includes(searchTerm.toLowerCase()) ||
        collaboratorEmail.includes(searchTerm.toLowerCase());
      const matchesDep = selectedDepartment === "all" || collaboratorDepartment === selectedDepartment;
      return matchesSearch && matchesDep;
    });
  }, [data, searchTerm, selectedDepartment]);

  const stats = useMemo(() => {
    let totalP = 0;
    let totalV = 0;
    let pendP = 0;
    let pendV = 0;
    filteredData.forEach((colab) => {
      totalP += getApprovedPermisos(colab);
      totalV += getVacationAllowance(colab);
      pendP += getPendingPermisos(colab);
      pendV += getPendingVacation(colab);
    });
    return [
      { label: "Colaboradores", value: filteredData.length, color: "blue" },
      { label: "Permisos Aprobados", value: totalP, color: "emerald" },
      { label: "Permisos Pendientes", value: pendP, color: "amber" },
      { label: "Vacaciones Totales", value: totalV, color: "indigo" },
      { label: "Vacaciones Pendientes", value: pendV, color: "rose" },
    ];
  }, [filteredData]);

  const handleExportCSV = () => {
    if (filteredData.length === 0) return toast.error("No hay datos para exportar");
    
    const headers = [
      "Colaborador",
      "Departamento",
      "Email",
      "Permisos Aprobados",
      "Permisos Pendientes",
      "Vacaciones Disponibles",
      "Vacaciones Tomadas",
      "Vacaciones Pendientes"
    ];
    
    const rows = filteredData.map((colab) => [
      getCollaboratorName(colab),
      getDepartmentName(colab),
      getCollaboratorEmail(colab) || "-",
      getApprovedPermisos(colab),
      getPendingPermisos(colab),
      getRemainingVacation(colab),
      getTakenVacation(colab),
      getPendingVacation(colab),
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
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
    showLoader("Generando reporte PDF...");
    try {
      const canvas = await html2canvas(reportTableRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const finalWidth = imgWidth * ratio;
      const finalHeight = imgHeight * ratio;
      
      pdf.setFontSize(16);
      pdf.text("Informe Consolidado de Permisos y Vacaciones", 10, 15);
      pdf.setFontSize(10);
      pdf.text(`Generado el: ${new Date().toLocaleString()}`, 10, 22);
      pdf.addImage(imgData, "PNG", 0, 30, finalWidth, finalHeight);
      pdf.save(`reporte_permisos_${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("Reporte PDF exportado");
    } catch (err) {
      console.error("Error generando PDF:", err);
      toast.error("Error al generar el PDF");
    } finally {
      hideLoader();
    }
  };

  return (
    <div className="space-y-6">
      {/* Filtros y Acciones */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 block">Buscar colaborador</label>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Nombre o correo..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
              />
            </div>
          </div>
          
          <div className="w-full md:w-64">
            <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 block">Departamento</label>
            <Select
              value={selectedDepartment}
              options={departments}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <Button
              variant="secondary"
              icon={FiRefreshCw}
              onClick={loadData}
              disabled={loading}
              className="flex-1 md:flex-none"
            >
              Actualizar
            </Button>
            <Button
              variant="primary"
              icon={FiDownload}
              onClick={handleExportCSV}
              disabled={loading || filteredData.length === 0}
              className="flex-1 md:flex-none"
            >
              Exportar
            </Button>
            <Button
              variant="secondary"
              icon={FiFileText}
              onClick={handleExportPDF}
              disabled={loading || filteredData.length === 0}
              className="flex-1 md:flex-none border-red-200 text-red-600 hover:bg-red-50"
            >
              PDF
            </Button>
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{stat.label}</p>
            <p className={`text-2xl font-black text-${stat.color}-600`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Table Section */}
      <Card className="overflow-hidden border-gray-200 shadow-xl" ref={reportTableRef}>
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <FiTable className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold">Listado de Consolidado</h3>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">Recursos Humanos & Finanzas</p>
            </div>
          </div>
          <span className="text-xs bg-white/10 px-3 py-1 rounded-full font-medium">
            {filteredData.length} registros encontrados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-left font-bold text-slate-600">Colaborador</th>
                <th className="px-6 py-4 text-left font-bold text-slate-600">Departamento</th>
                <th className="px-6 py-4 text-center font-bold text-emerald-600 bg-emerald-50/30">Permisos Aprob.</th>
                <th className="px-6 py-4 text-center font-bold text-amber-600 bg-amber-50/30">Permisos Pend.</th>
                <th className="px-6 py-4 text-center font-bold text-blue-600 bg-blue-50/30">Vacaciones Disp.</th>
                <th className="px-6 py-4 text-center font-bold text-indigo-600 bg-indigo-50/30">Vacaciones Tom.</th>
                <th className="px-6 py-4 text-center font-bold text-rose-600 bg-rose-50/30">Vacaciones Pend.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-slate-500 font-medium animate-pulse">Cargando información consolidada...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <FiSearch className="w-12 h-12 opacity-20" />
                      <p className="font-medium">No se encontraron colaboradores con esos filtros</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((row) => (
                  <tr key={row.user_id || row.user_email || row.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{getCollaboratorName(row)}</div>
                      <div className="text-[11px] text-slate-500 font-medium">{getCollaboratorEmail(row) || "-"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-[11px] font-bold border border-slate-200 uppercase">
                        {getDepartmentName(row)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-black text-emerald-700 bg-emerald-50/10">
                      {getApprovedPermisos(row)}
                    </td>
                    <td className="px-6 py-4 text-center font-black text-amber-700 bg-amber-50/10">
                      {getPendingPermisos(row)}
                    </td>
                    <td className="px-6 py-4 text-center font-black text-blue-700 bg-blue-50/10">
                      {getRemainingVacation(row)}
                    </td>
                    <td className="px-6 py-4 text-center font-black text-indigo-700 bg-indigo-50/10">
                      {getTakenVacation(row)}
                    </td>
                    <td className="px-6 py-4 text-center font-black text-rose-700 bg-rose-50/10">
                      {getPendingVacation(row)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default PermisosReportsView;
