import React from "react";
import { FiEye, FiPaperclip } from "react-icons/fi";
import Button from "../../../core/ui/components/Button";

const RequestCard = ({ req, onView, onFiles }) => {
  const statusColor =
    req.status === "approved"
      ? "bg-green-100 text-green-800"
      : req.status === "rejected"
      ? "bg-red-100 text-red-800"
      : "bg-yellow-100 text-yellow-800";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-200 dark:border-gray-700 p-4 flex flex-col justify-between space-y-3 hover:shadow-hover hover:border-blue-400 dark:hover:border-blue-600 transition">
      <div className="flex justify-between items-center">
        <span className="font-bold text-base text-blue-600 dark:text-blue-400">
          Solicitud #{req.id}
        </span>
        <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${statusColor}`}>
          {req.status}
        </span>
      </div>

      <div className="text-sm">
        <p className="text-gray-500 dark:text-gray-400">
          Tipo: <span className="font-medium">{req.tipo}</span>
        </p>
        <p className="text-gray-500 dark:text-gray-400">
          Solicitante: <span className="font-medium">{req.solicitante}</span>
        </p>
        <p className="text-gray-500 dark:text-gray-400">
          Fecha:{" "}
          <span className="font-medium">
            {new Date(req.created_at).toLocaleDateString()}
          </span>
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
        <Button
          variant="secondary"
          icon={FiEye}
          onClick={() => onView(req.id)}
        >
          Ver
        </Button>
        {req.files?.length > 0 && (
          <Button variant="outline" icon={FiPaperclip} onClick={() => onFiles(req.files)}>
            Archivos
          </Button>
        )}
      </div>
    </div>
  );
};

export default RequestCard;
