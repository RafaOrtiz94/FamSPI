// src/core/layout/PublicLayout.jsx
import React from "react";
import { Outlet } from "react-router-dom";

/**
 * 🧭 PublicLayout — versión limpia y flexible
 * -------------------------------------------------
 * • Permite que las vistas públicas controlen su fondo (como Login)
 * • Quita el límite de ancho (`max-w-md`)
 * • Mantiene centrado el contenido y modo oscuro
 */
const PublicLayout = () => {
  return (
    <div className="min-h-screen w-full flex flex-col bg-gray-100 dark:bg-gray-900 transition-colors">
      {/* Las vistas públicas (Login, Unauthorized, etc.) se encargan de su propio layout */}
      <Outlet />
    </div>
  );
};

export default PublicLayout;
