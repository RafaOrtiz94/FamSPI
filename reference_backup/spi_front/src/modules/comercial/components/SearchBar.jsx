// src/modules/comercial/components/SearchBar.jsx

import React from "react";
import { FiSearch, FiRefreshCw, FiFilter } from "react-icons/fi";

const SearchBar = ({ value, onChange, status, setStatus, onRefresh }) => {
  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
      <div className="relative w-full md:w-2/3">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          placeholder="Busca por ID, cliente, contacto u observación…"
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2 w-full md:w-1/3">
        <div className="relative flex-1">
          <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 appearance-none" // appearance-none para mejor control del estilo
          >
            <option value="all">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="in_review">En revisión</option>
            <option value="approved">Aprobadas</option>
            <option value="rejected">Rechazadas</option>
            <option value="acta_generated">Acta generada</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </div>

        <button
          onClick={onRefresh}
          className="p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors"
          aria-label="Actualizar datos"
        >
          <FiRefreshCw />
        </button>
      </div>
    </div>
  );
};

export default SearchBar;