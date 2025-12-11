import React, { useState } from "react";
import Card from "../../../../core/ui/components/Card";
import { DashboardHeader } from "../../../../core/ui/layouts/DashboardLayout";
import PersonnelRequestWidget from "../../../../core/ui/widgets/PersonnelRequestWidget";
import PersonnelRequestForm from "../../../../core/ui/widgets/PersonnelRequestForm";

const JefeComercialView = ({ onRefresh }) => {
    const [showPersonnelForm, setShowPersonnelForm] = useState(false);

    return (
        <>
            {/* ==============================
                HEADER
            =============================== */}
            <DashboardHeader
                title="Dashboard Gerencia Comercial"
                subtitle="Gestión y seguimiento del talento humano en el área comercial."
                actions={
                    <button
                        onClick={onRefresh}
                        className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
                    >
                        Actualizar
                    </button>
                }
            />

            {/* ==============================
                SOLICITUDES DE PERSONAL
            =============================== */}
            <section className="mt-6">
                <Card className="p-6">
                    <PersonnelRequestWidget
                        openModal={() => setShowPersonnelForm(true)}
                    />
                </Card>
            </section>

            {/* ==============================
                MODAL: FORMULARIO SOLICITUD PERSONAL
            =============================== */}
            {showPersonnelForm && (
                <PersonnelRequestForm
                    onClose={() => setShowPersonnelForm(false)}
                    onSuccess={() => {
                        setShowPersonnelForm(false);
                        onRefresh?.();
                    }}
                />
            )}
        </>
    );
};

export default JefeComercialView;
