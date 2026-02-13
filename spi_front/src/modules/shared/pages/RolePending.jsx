import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FiClock, FiLogOut } from "react-icons/fi";
import { useAuth } from "../../../core/auth/useAuth";
import famLogo from "../../../assets/famproject_logo.png";

const RolePending = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 text-white px-6 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center max-w-lg w-full"
      >
        <img
          src={famLogo}
          alt="FamProject Logo"
          className="h-24 w-auto mb-8 drop-shadow-2xl"
        />

        <div className="bg-white/5 backdrop-blur-lg p-8 rounded-3xl border border-white/10 shadow-2xl w-full">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-500/20 p-4 rounded-full ring-4 ring-blue-500/10">
              <FiClock className="text-5xl text-blue-400" />
            </div>
          </div>

          <h1 className="text-2xl font-bold mb-4 text-white">Gracias por registrarte</h1>

          <p className="text-gray-300 mb-8 leading-relaxed text-lg">
            El departamento de TICs está realizando el registro de su rol empresarial.
            <span className="block mt-4 text-blue-200 font-medium">
              En las próximas horas ya podrá acceder a su dashboard.
            </span>
          </p>

          <button
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-6 py-3.5 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-blue-500/25 hover:-translate-y-0.5"
          >
            <FiLogOut className="text-lg" />
            Cerrar Sesión
          </button>
        </div>
      </motion.div>

      <p className="absolute bottom-6 text-sm text-slate-500">
        © {new Date().getFullYear()} FamProject - Departamento de TI
      </p>
    </div>
  );
};

export default RolePending;
