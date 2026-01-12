import React from "react";
import { FiActivity, FiPlus, FiFileText, FiTruck, FiShoppingCart } from "react-icons/fi";

/**
 * 💼 Tarjeta ejecutiva para crear una nueva solicitud
 * Muestra un resumen descriptivo y atajos visuales de los tipos de solicitud.
 */
export default function ActionCreateCard({ onClick }) {
  return (
    <div className="rounded-2xl p-6 border border-blue-200 dark:border-gray-700 bg-gradient-to-r from-blue-100 via-blue-50 to-white dark:from-blue-950 dark:via-gray-900 dark:to-gray-800 shadow-sm">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-600 text-white rounded-xl">
            <FiActivity size={28} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
              Crear una nueva solicitud
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm max-w-xl leading-snug">
              Inicie un proceso de <b>Inspección</b>, <b>Retiro</b> o <b>Compra</b>. 
              El sistema generará automáticamente la plantilla F.ST correspondiente 
              y registrará la trazabilidad completa.
            </p>

            {/* Etiquetas informativas */}
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/70 dark:bg-white/10 border border-blue-200/70 dark:border-white/10 text-blue-700 dark:text-blue-200">
                <FiFileText /> Inspección
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/70 dark:bg-white/10 border border-blue-200/70 dark:border-white/10 text-blue-700 dark:text-blue-200">
                <FiTruck /> Retiro
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/70 dark:bg-white/10 border border-blue-200/70 dark:border-white/10 text-blue-700 dark:text-blue-200">
                <FiShoppingCart /> Compra
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onClick}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition"
        >
          <FiPlus /> Nueva Solicitud
        </button>
      </div>
    </div>
  );
}
