import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { FiRefreshCw } from "react-icons/fi";
import DashboardLayout from "../../../core/layout/DashboardLayout";
import { useUI } from "../../../core/ui/useUI";
import { useApi } from "../../../core/hooks/useApi";
import { getClientRequests } from "../../../core/api/requestsApi";
import { useNavigate } from "react-router-dom";

const ClientRequests = () => {
  const { showToast } = useUI();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ q: "", status: "pending_approval" });
  const { data, loading, execute: fetchRequests } = useApi(getClientRequests, {
    errorMsg: "Error al cargar las solicitudes de clientes",
  });

  const loadRequests = useCallback(async () => {
    await fetchRequests(filters);
  }, [fetchRequests, filters]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleViewDetails = (id) => {
    navigate(`/dashboard/backoffice/client-request/${id}`);
  };

  const requests = data?.rows || [];

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-6"
      >
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Solicitudes de Nuevos Clientes
          </h1>
          <button
            onClick={loadRequests}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-4 mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <input
            type="text"
            name="q"
            placeholder="Buscar por cliente, RUC o ID..."
            value={filters.q}
            onChange={handleFilterChange}
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
          />
          <select
            name="status"
            value={filters.status}
            onChange={handleFilterChange}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
          >
            <option value="all">Todos</option>
            <option value="pending_consent">Pendiente Consentimiento</option>
            <option value="pending_approval">Pendiente Aprobación</option>
            <option value="approved">Aprobadas</option>
            <option value="rejected">Rechazadas</option>
          </select>
        </div>

        {/* Tabla de Solicitudes */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <Th>ID</Th>
                <Th>Cliente</Th>
                <Th>RUC/Cédula</Th>
                <Th>Creado por</Th>
                <Th>Estado</Th>
                <Th>Fecha</Th>
                <Th>Acciones</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan="7" className="text-center py-10">Cargando...</td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-10">No hay solicitudes.</td></tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <Td>{req.id}</Td>
                    <Td>{req.commercial_name}</Td>
                    <Td>{req.ruc_cedula}</Td>
                    <Td>{req.created_by}</Td>
                    <Td><StatusBadge status={req.status} /></Td>
                    <Td>{new Date(req.created_at).toLocaleDateString()}</Td>
                    <Td>
                      <button
                        onClick={() => handleViewDetails(req.id)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Ver Detalles
                      </button>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </DashboardLayout>
  );
};

const Th = ({ children }) => (
  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
    {children}
  </th>
);

const Td = ({ children }) => (
  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
    {children}
  </td>
);

const statusStyles = {
  pending_consent: "bg-yellow-100 text-yellow-800",
  pending_approval: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const StatusBadge = ({ status }) => (
  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusStyles[status] || 'bg-gray-100 text-gray-800'}`}>
    {status.replace(/_/g, ' ')}
  </span>
);

export default ClientRequests;
