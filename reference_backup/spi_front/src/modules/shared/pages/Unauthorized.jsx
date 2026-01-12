import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FiLock } from "react-icons/fi";

const Unauthorized = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-yellow-500 to-orange-600 dark:from-gray-900 dark:to-gray-800 text-white px-6 text-center">
      {/* Ícono con animación */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center"
      >
        <FiLock className="text-6xl text-white drop-shadow-lg mb-4" />
        <h1 className="text-4xl font-bold mb-2">Acceso Denegado</h1>
        <p className="text-white/90 dark:text-gray-300 mb-8 max-w-md">
          🚫 No tienes los permisos necesarios para ver esta página o realizar
          esta acción.
        </p>

        {/* Botón de regreso */}
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 bg-white text-yellow-700 dark:bg-gray-700 dark:text-white px-6 py-2 rounded-full font-medium shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
        >
          Volver al Dashboard
        </Link>
      </motion.div>

      {/* Firma inferior */}
      <p className="absolute bottom-6 text-sm text-white/70 dark:text-gray-400">
        © {new Date().getFullYear()} FamProject
      </p>
    </div>
  );
};

export default Unauthorized;
