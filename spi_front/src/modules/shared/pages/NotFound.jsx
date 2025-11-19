import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FiAlertTriangle } from "react-icons/fi";

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-900 to-blue-600 dark:from-gray-900 dark:to-gray-800 text-white px-6 text-center">
      {/* Icono animado */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center"
      >
        <FiAlertTriangle className="text-yellow-400 text-6xl mb-4 drop-shadow-lg" />
        <h1 className="text-4xl font-bold mb-2">404 - Página No Encontrada</h1>
        <p className="text-gray-200 dark:text-gray-400 mb-8 max-w-md">
          La página que buscas no existe o fue movida.  
          Por favor, verifica la URL o regresa al inicio.
        </p>

        {/* Botón de regreso */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-white text-blue-600 dark:bg-gray-700 dark:text-white px-6 py-2 rounded-full font-medium shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
        >
          Volver al Inicio
        </Link>
      </motion.div>

      {/* Firma inferior */}
      <p className="absolute bottom-6 text-sm text-white/60 dark:text-gray-400">
        © {new Date().getFullYear()} FamProject
      </p>
    </div>
  );
};

export default NotFound;
