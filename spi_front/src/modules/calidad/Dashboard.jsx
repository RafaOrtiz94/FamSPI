import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FiRefreshCw, FiThermometer, FiWind, FiShield, FiAlertTriangle, FiFileText, FiCheckSquare, FiActivity, FiTarget, FiAlertOctagon, FiUser, FiMail, FiMap, FiSearch, FiPackage, FiHeart } from "react-icons/fi";

import { useUI } from "../../core/ui/useUI";
import Button from "../../core/ui/components/Button";
import Card from "../../core/ui/components/Card";
import { DashboardLayout, DashboardHeader } from "../../core/ui/layouts/DashboardLayout";

const calidadModules = [
  { id: "ca0101", title: "Temperatura", subtitle: "Control de sistemas", icon: FiThermometer, path: "/dashboard/calidad/temperatura" },
  { id: "ca0102", title: "Limpieza", subtitle: "Limpieza de áreas", icon: FiWind, path: "/dashboard/calidad/limpieza" },
  { id: "ca0103", title: "Buenas Prácticas", subtitle: "Buenas prácticas", icon: FiShield, path: "/dashboard/calidad/buenas-practicas" },
  { id: "ca0104", title: "Control de Plagas", subtitle: "Control de plagas", icon: FiAlertTriangle, path: "/dashboard/calidad/plagas" },
  { id: "ca0105", title: "Documentos", subtitle: "Gestión documental", icon: FiFileText, path: "/dashboard/calidad/documentos" },
  { id: "ca0106", title: "Recall", subtitle: "Retiro del mercado", icon: FiAlertOctagon, path: "/dashboard/calidad/recall" },
  { id: "ca0107", title: "Quejas", subtitle: "Quejas y reclamos", icon: FiActivity, path: "/dashboard/calidad/quejas" },
  { id: "ca0108", title: "Refrigerados", subtitle: "Plan contingencia", icon: FiThermometer, path: "/dashboard/calidad/refrigerados" },
  { id: "ca0109", title: "CAPA", subtitle: "Acciones correctivas", icon: FiCheckSquare, path: "/dashboard/calidad/capa" },
  { id: "ca0110", title: "Riesgos", subtitle: "Gestión de riesgos", icon: FiTarget, path: "/dashboard/calidad/riesgos" },
  { id: "ca0111", title: "Incidentes", subtitle: "Derrames e incidentes", icon: FiAlertOctagon, path: "/dashboard/calidad/incidentes" },
  { id: "ca0112", title: "Higiene", subtitle: "Prácticas de higiene", icon: FiUser, path: "/dashboard/calidad/higiene" },
  { id: "ca0113", title: "Comunicaciones", subtitle: "Comunicación", icon: FiMail, path: "/dashboard/calidad/comunicaciones" },
  { id: "ca0114", title: "Áreas Calificadas", subtitle: "Calificación áreas", icon: FiMap, path: "/dashboard/calidad/areas" },
  { id: "ca0115", title: "Auditorías", subtitle: "Auditorías", icon: FiSearch, path: "/dashboard/calidad/auditorias" },
  { id: "ca0116", title: "Muestreo", subtitle: "Muestreo y aprobación", icon: FiPackage, path: "/dashboard/calidad/muestreo" },
  { id: "ca0117", title: "Tecnovigilancia", subtitle: "Tecnovigilancia", icon: FiHeart, path: "/dashboard/calidad/tecnovigilancia" },
];

const DashboardCalidad = () => {
  const { showToast } = useUI();
  const navigate = useNavigate();

  const refresh = useCallback(() => {
    showToast("Panel actualizado correctamente.", "success");
  }, [showToast]);

  const handleModuleClick = (path) => {
    navigate(path);
  };

  return (
    <DashboardLayout includeWidgets={false}>
      <DashboardHeader
        title="Calidad y Mejora Continua"
        subtitle="Módulos GXP - Sistema de gestión de calidad"
        actions={
          <Button variant="secondary" icon={FiRefreshCw} onClick={refresh}>
            Actualizar
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {calidadModules.slice(0, 4).map((mod) => {
          const Icon = mod.icon;
          return (
            <Card key={mod.id} className="p-4 flex items-center gap-3 border border-gray-200 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all" onClick={() => handleModuleClick(mod.path)}>
              <div className="p-2 bg-blue-50 rounded-md text-blue-600">
                <Icon size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{mod.title}</p>
                <p className="text-xs text-gray-500">{mod.subtitle}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {calidadModules.slice(4, 8).map((mod) => {
          const Icon = mod.icon;
          return (
            <Card key={mod.id} className="p-4 flex items-center gap-3 border border-gray-200 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all" onClick={() => handleModuleClick(mod.path)}>
              <div className="p-2 bg-emerald-50 rounded-md text-emerald-600">
                <Icon size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{mod.title}</p>
                <p className="text-xs text-gray-500">{mod.subtitle}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {calidadModules.slice(8, 12).map((mod) => {
          const Icon = mod.icon;
          return (
            <Card key={mod.id} className="p-4 flex items-center gap-3 border border-gray-200 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all" onClick={() => handleModuleClick(mod.path)}>
              <div className="p-2 bg-indigo-50 rounded-md text-indigo-600">
                <Icon size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{mod.title}</p>
                <p className="text-xs text-gray-500">{mod.subtitle}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {calidadModules.slice(12, 16).map((mod) => {
          const Icon = mod.icon;
          return (
            <Card key={mod.id} className="p-4 flex items-center gap-3 border border-gray-200 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all" onClick={() => handleModuleClick(mod.path)}>
              <div className="p-2 bg-amber-50 rounded-md text-amber-600">
                <Icon size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{mod.title}</p>
                <p className="text-xs text-gray-500">{mod.subtitle}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {calidadModules.slice(16, 17).map((mod) => {
          const Icon = mod.icon;
          return (
            <Card key={mod.id} className="p-4 flex items-center gap-3 border border-gray-200 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all" onClick={() => handleModuleClick(mod.path)}>
              <div className="p-2 bg-rose-50 rounded-md text-rose-600">
                <Icon size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{mod.title}</p>
                <p className="text-xs text-gray-500">{mod.subtitle}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600">
          <strong>Nota:</strong> Haz clic en cualquier módulo para acceder a su workspace. Los módulos requieren permisos de rol "calidad" o "jefe_calidad".
        </p>
      </div>
    </DashboardLayout>
  );
};

export default DashboardCalidad;