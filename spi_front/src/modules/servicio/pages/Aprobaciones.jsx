import React, { useCallback, useEffect, useState } from "react";
import { FiRefreshCw, FiCheckCircle, FiXCircle } from "react-icons/fi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import PendingApprovals from "../components/PendingApprovals";
import { getPendingApprovals } from "../../../core/api/approvalsApi";

const AprobacionesPage = () => {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPendingApprovals();
      if (Array.isArray(data?.rows)) return setApprovals(data.rows);
      if (Array.isArray(data?.result?.rows)) return setApprovals(data.result.rows);
      if (Array.isArray(data?.data?.rows)) return setApprovals(data.data.rows);
      if (Array.isArray(data)) return setApprovals(data);
      setApprovals([]);
    } catch (err) {
      console.warn("No se pudieron cargar aprobaciones", err);
      setApprovals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-gray-500">Control de aprobaciones</p>
          <h1 className="text-2xl font-semibold text-gray-900">Aprobaciones pendientes</h1>
        </div>
        <Button variant="secondary" icon={FiRefreshCw} onClick={load} disabled={loading}>
          Actualizar
        </Button>
      </div>

      <Card className="p-5 space-y-4">
        <p className="text-sm text-gray-600">Revisa el detalle de cada aprobación antes de aprobar o rechazar.</p>
        <p className="text-xs text-gray-500">
          {approvals.length ? `${approvals.length} solicitudes en espera` : "Sin aprobaciones pendientes en cola"}
        </p>
        <PendingApprovals onActionComplete={load} />
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5 space-y-2">
          <div className="flex items-center gap-2 text-green-700 font-semibold">
            <FiCheckCircle />
            <span>Buenas prácticas</span>
          </div>
          <p className="text-sm text-gray-600">
            Mantén trazabilidad: registra tus comentarios al aprobar o rechazar cada solicitud.
          </p>
        </Card>
        <Card className="p-5 space-y-2">
          <div className="flex items-center gap-2 text-red-700 font-semibold">
            <FiXCircle />
            <span>Evita reprocesos</span>
          </div>
          <p className="text-sm text-gray-600">
            Usa este panel para ordenar la cola de aprobaciones y responder antes de que venzan.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default AprobacionesPage;
