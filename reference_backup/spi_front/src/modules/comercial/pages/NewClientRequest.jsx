import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";

import NewClientRequestForm from "../components/NewClientRequestForm";

const NewClientRequest = () => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="p-4 sm:p-6"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Registro de Clientes • Comercial</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Solicitud de creación de nuevo cliente
          </h1>
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
        >
          <FiArrowLeft /> Regresar
        </button>
      </div>

      <NewClientRequestForm
        onCancel={() => navigate("/dashboard/comercial")}
        onSuccess={() => navigate("/dashboard/comercial")}
      />
    </motion.div>
  );
};

export default NewClientRequest;
