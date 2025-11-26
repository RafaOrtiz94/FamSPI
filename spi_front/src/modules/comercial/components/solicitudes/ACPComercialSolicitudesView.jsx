import React, { useState } from "react";
import { useUI } from "../../../../core/ui/UIContext";
import CreateRequestModal from "../CreateRequestModal";
import NewClientActionCard from "../NewClientActionCard";
import PurchaseRequestActionCard from "../PurchaseRequestActionCard";
import PurchaseHandoffWidget from "../PurchaseHandoffWidget";
import MyClientRequestsWidget from "../MyClientRequestsWidget";
import EquipmentPurchaseWidget from "../EquipmentPurchaseWidget";

const ACPComercialSolicitudesView = () => {
    const { showToast } = useUI();
    const [modalOpen, setModalOpen] = useState(false);
    const [presetRequestType, setPresetRequestType] = useState(null);
    const [showPurchaseHandoff, setShowPurchaseHandoff] = useState(false);

    const openRequestModal = (type) => {
        setPresetRequestType(type);
        setModalOpen(true);
    };

    const handleCreate = async (data) => {
        try {
            setModalOpen(false);
            showToast("Solicitud creada exitosamente", "success");
            // Aquí podrías recargar el widget de mis solicitudes si fuera necesario
            // pero el widget se recarga solo al montar o cambiar usuario
        } catch (error) {
            console.error("Error creando solicitud:", error);
            showToast("Error al crear la solicitud", "error");
        }
    };

    const handlePurchaseHandoffOpen = () => {
        setShowPurchaseHandoff(true);
    };

    return (
        <div className="space-y-8">
            {/* CREAR NUEVA SOLICITUD - Grid limitado para ACP Comercial */}
            <section>
                <div className="mb-5">
                    <h2 className="text-xl font-bold text-gray-900 mb-1">
                        Crear Nueva Solicitud
                    </h2>
                    <p className="text-sm text-gray-600">
                        Selecciona el tipo de solicitud que deseas crear
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="flex">
                        <NewClientActionCard
                            onClick={() => openRequestModal("cliente")}
                        />
                    </div>
                    <div className="flex">
                        <PurchaseRequestActionCard
                            onClick={handlePurchaseHandoffOpen}
                        />
                    </div>
                </div>
            </section>

            {/* WIDGET DE MIS SOLICITUDES DE CLIENTES */}
            <MyClientRequestsWidget />

            {/* WIDGET DE SEGUIMIENTO DE COMPRAS */}
            <div id="purchase-tracker">
                <EquipmentPurchaseWidget showCreation={false} compactList />
            </div>

            {/* PURCHASE HANDOFF MODAL */}
            <PurchaseHandoffWidget
                isOpen={showPurchaseHandoff}
                onOpenChange={setShowPurchaseHandoff}
                hideButton={true}
            />

            {/* MODALES */}
            <CreateRequestModal
                open={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setPresetRequestType(null);
                }}
                onSubmit={handleCreate}
                presetType={presetRequestType}
            />
        </div>
    );
};

export default ACPComercialSolicitudesView;
