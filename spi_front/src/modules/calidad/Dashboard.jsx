import React, { useCallback } from "react";
import { FiRefreshCw, FiClipboard, FiBookOpen, FiCheckSquare, FiActivity } from "react-icons/fi";

import { useUI } from "../../core/ui/useUI";

import AttendanceWidget from "../shared/components/AttendanceWidget";
import ClientRequestWidget from "../shared/components/ClientRequestWidget";
import Button from "../../core/ui/components/Button";
import Card from "../../core/ui/components/Card";
import { DashboardLayout, DashboardHeader } from "../shared/components/DashboardComponents";

const DashboardCalidad = () => {
  const { showToast } = useUI();

  const refresh = useCallback(() => {
    showToast("Panel actualizado correctamente.", "success");
  }, [showToast]);

  return (
    <DashboardLayout includeWidgets={false}>
      <DashboardHeader
        title="Calidad y Mejora Continua"
        subtitle="Seguimiento de procesos internos, certificaciones y control documental"
        actions={
          <Button variant="secondary" icon={FiRefreshCw} onClick={refresh}>
            Actualizar
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-3 border border-gray-200">
          <div className="p-2 bg-blue-50 rounded-md text-blue-600">
            <FiClipboard size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Procesos</p>
            <p className="text-xs text-gray-500">Checklists y auditorías.</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3 border border-gray-200">
          <div className="p-2 bg-emerald-50 rounded-md text-emerald-600">
            <FiBookOpen size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Documentos</p>
            <p className="text-xs text-gray-500">Normativas y manuales.</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3 border border-gray-200">
          <div className="p-2 bg-indigo-50 rounded-md text-indigo-600">
            <FiCheckSquare size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Certificaciones</p>
            <p className="text-xs text-gray-500">Seguimiento de requisitos.</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3 border border-gray-200">
          <div className="p-2 bg-amber-50 rounded-md text-amber-600">
            <FiActivity size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Indicadores</p>
            <p className="text-xs text-gray-500">KPIs de cumplimiento.</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AttendanceWidget />
        <ClientRequestWidget />
      </div>
    </DashboardLayout>
  );
};

export default DashboardCalidad;
