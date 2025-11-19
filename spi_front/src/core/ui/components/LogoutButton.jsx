import React from "react";
import { FiLogOut } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import toast from "react-hot-toast";

const LogoutButton = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      // 🔹 Si tu backend tiene endpoint de logout, puedes usarlo:
      await fetch(`${import.meta.env.VITE_API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      // 🔹 Eliminar token o cookies locales
      Cookies.remove("token");
      localStorage.removeItem("user");

      toast.success("Sesión cerrada correctamente");
      navigate("/login");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      toast.error("No se pudo cerrar sesión");
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2 text-red-600 font-medium hover:bg-red-100 px-3 py-2 rounded-md transition"
    >
      <FiLogOut className="w-5 h-5" />
      Cerrar sesión
    </button>
  );
};

export default LogoutButton;
