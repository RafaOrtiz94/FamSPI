import React, { useState } from "react";
import PermisosStatusWidget from "../components/PermisosStatusWidget";
import { FiCalendar } from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import PermisoVacacionModal from "../modals/PermisoVacacionModal";

const PermisosPage = () => {
    const [openModal, setOpenModal] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSuccess = () => {
        setSubmitted(true);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow">
                <h1 className="text-2xl font-bold">
                    Permisos y Vacaciones
                </h1>
                <p className="text-sm opacity-90 mt-1">
                    Gestiona solicitudes, aprobaciones y justificantes en un solo flujo.
                </p>
            </div>

            <Card className="border border-gray-200 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                            <FiCalendar size={20} />
                        </div>
                        <div>
                            <p className="text-lg font-semibold text-gray-900">
                                Solicita un permiso o vacaciones
                            </p>
                            <p className="text-sm text-gray-500">
                                Abre el flujo guiado y completa tu solicitud en unos pasos.
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="primary"
                        onClick={() => setOpenModal(true)}
                        className="ml-auto"
                    >
                        {submitted ? "Crear otra solicitud" : "Nueva solicitud"}
                    </Button>
                </div>
            </Card>

            {/* Widget principal */}
            <PermisosStatusWidget />

            <PermisoVacacionModal
                open={openModal}
                onClose={() => setOpenModal(false)}
                onSuccess={handleSuccess}
            />
        </div>
    );
};

export default PermisosPage;


