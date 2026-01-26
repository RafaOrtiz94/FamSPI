import React from "react";
import { DashboardHeader } from "../../../../core/ui/layouts/DashboardLayout";

const JefeComercialView = ({ onRefresh }) => (
    <>
        {/* ==============================
            HEADER
        =============================== */}
        <DashboardHeader
            title="Dashboard Gerencia Comercial"
            subtitle="Gestion y seguimiento del talento humano en el area comercial."
            actions={
                <button
                    onClick={onRefresh}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                    Actualizar
                </button>
            }
        />
    </>
);

export default JefeComercialView;
