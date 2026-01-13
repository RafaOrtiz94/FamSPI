import React, { useState } from "react";
import { FiCreditCard, FiUserPlus, FiUsers } from "react-icons/fi";
import { getClientRequests } from "../../../../core/api/requestsApi";
import Modal from "../../../../core/ui/components/Modal";
import Button from "../../../../core/ui/components/Button";
import PurchaseHandoffWidget from "../PurchaseHandoffWidget";
import PermisoVacacionModal from "../../../shared/solicitudes/modals/PermisoVacacionModal";
import RequestStatWidget from "../../../shared/solicitudes/components/RequestStatWidget";
import RequestsListModal from "../../../shared/solicitudes/components/RequestsListModal";
import BaseSolicitudesView from "../../../shared/solicitudes/BaseSolicitudesView";

const ACPComercialSolicitudesView = () => {
    const [showPurchaseHandoff, setShowPurchaseHandoff] = useState(false);
    const [showPermisoModal, setShowPermisoModal] = useState(false);
    const [showPurchaseTypeModal, setShowPurchaseTypeModal] = useState(false);

    // View Modal State
    const [viewType, setViewType] = useState(null);
    const [viewTitle, setViewTitle] = useState("");
    const [viewCustomFetcher, setViewCustomFetcher] = useState(null);

    const handlePurchaseHandoffOpen = () => {
        setShowPurchaseHandoff(true);
    };

    const handleViewList = (type, title, fetcher = null) => {
        setViewType(type);
        setViewTitle(title);
        setViewCustomFetcher(() => fetcher);
    };

    const handlePurchaseTypeSelection = (type) => {
        setShowPurchaseTypeModal(false);
        if (type === "public") {
            handlePurchaseHandoffOpen();
        } else if (type === "private") {
            // ✅ USAR MODAL GLOBAL
            window.dispatchEvent(new CustomEvent('open-request-modal', { detail: { type: 'PRIVATE_PURCHASE' } }));
        }
    };

    const statWidgets = [
        {
            id: 'clientes',
            title: 'Solicitudes de Clientes',
            icon: FiUserPlus,
            color: 'emerald',
            type: 'client_request',
            fetcher: async (params) => {
                const res = await getClientRequests(params);
                return res;
            }
        },
        {
            id: 'compras',
            title: 'Mis Requerimientos',
            icon: FiCreditCard,
            color: 'indigo',
            type: 'compra',
            initialFilters: { mine: true }
        },
        {
            id: 'vacaciones',
            title: 'Mis Permisos',
            icon: FiUsers,
            color: 'orange',
            type: 'vacaciones',
            initialFilters: { mine: true }
        }
    ];

    return (
        <>
            <BaseSolicitudesView
                customSections={[
                    {
                        id: "historial",
                        title: "Historial de Solicitudes",
                        subtitle: "Consulta el estado de tus gestiones",
                        content: (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {statWidgets.map(widget => (
                                    <RequestStatWidget
                                        key={widget.id}
                                        title={widget.title}
                                        icon={widget.icon}
                                        color={widget.color}
                                        onClick={() => handleViewList(widget.type, widget.title, widget.fetcher)}
                                    />
                                ))}
                            </div>
                        )
                    }
                ]}
            />

            {/* PURCHASE HANDOFF MODAL */}
            <PurchaseHandoffWidget
                isOpen={showPurchaseHandoff}
                onOpenChange={setShowPurchaseHandoff}
                hideButton={true}
            />

            <Modal
                open={showPurchaseTypeModal}
                onClose={() => setShowPurchaseTypeModal(false)}
                title="Selecciona el tipo de cliente"
            >
                <div className="space-y-3">
                    <p>¿El cliente pertenece a la red pública o es un cliente privado?</p>
                    <div className="flex flex-wrap gap-3">
                        <Button variant="secondary" onClick={() => handlePurchaseTypeSelection("public")}>
                            Público
                        </Button>
                        <Button variant="primary" onClick={() => handlePurchaseTypeSelection("private")}>
                            Privado
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* PERMISOS/VACACIONES MODAL */}
            <PermisoVacacionModal
                open={showPermisoModal}
                onClose={() => setShowPermisoModal(false)}
            />

            {/* MODAL LISTADO DE SOLICITUDES */}
            <RequestsListModal
                open={!!viewType}
                onClose={() => setViewType(null)}
                type={viewType}
                title={viewTitle}
                customFetcher={viewCustomFetcher}
            />
        </>
    );
};

export default ACPComercialSolicitudesView;
