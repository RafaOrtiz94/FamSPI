// src/modules/private-purchases/PrivatePurchasesList.jsx
import React, { useEffect, useMemo } from "react";
import { FiSearch } from "react-icons/fi";
import { motion } from "framer-motion";

import { useApi } from "../../../core/hooks/useApi";
import { getPrivatePurchases } from "../../../core/api/privatePurchasesApi";

import Card from "../../../core/ui/components/Card";
import Select from "../../../core/ui/components/Select";

const statusStyles = {
  pending_commercial: "bg-yellow-100 text-yellow-800",
  pending_backoffice: "bg-blue-100 text-blue-800",
  offer_sent: "bg-indigo-100 text-indigo-800",
  pending_manager_signature: "bg-purple-100 text-purple-800",
  pending_client_signature: "bg-pink-100 text-pink-800",
  offer_signed: "bg-green-100 text-green-800",
  client_registered: "bg-teal-100 text-teal-800",
  sent_to_acp: "bg-gray-100 text-gray-800",
  rejected: "bg-red-100 text-red-800",
};

const StatusBadge = ({ status }) => (
  <span
    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
      statusStyles[status] || "bg-gray-100 text-gray-700"
    }`}
  >
    {status.replace(/_/g, " ")}
  </span>
);

const PrivatePurchasesList = ({ onSelectItem }) => {
  const {
    data: listData,
    loading: loadingList,
    execute: fetchRequests,
  } = useApi(getPrivatePurchases, {
    globalLoader: true,
    errorMsg: "Error al cargar las solicitudes de compra privada.",
  });

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const requests = useMemo(() => listData || [], [listData]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        Listado de Compras Privadas
      </h1>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Cliente
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Estado
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Fecha de Creación
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Ver</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-800">
              {loadingList ? (
                <tr>
                  <td colSpan="4" className="text-center py-4">
                    Cargando...
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                    onClick={() => onSelectItem(req)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {req.client_snapshot?.commercial_name || "N/A"}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {req.client_snapshot?.contact_person || ""}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(req.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => onSelectItem(req)}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </motion.div>
  );
};

export default PrivatePurchasesList;
