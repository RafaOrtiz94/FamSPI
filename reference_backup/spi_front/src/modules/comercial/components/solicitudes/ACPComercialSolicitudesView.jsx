import React, { useState } from "react";
import { FiClipboard, FiCreditCard, FiUserPlus, FiUsers } from "react-icons/fi";
import { useUI } from "../../../../core/ui/UIContext";
import { createRequest, getClientRequests } from "../../../../core/api/requestsApi";
import CreateRequestModal from "../CreateRequestModal";
import ActionCard from "../../../../core/ui/patterns/ActionCard";
import PurchaseHandoffWidget from "../PurchaseHandoffWidget";
import PermisoVacacionModal from "../../../shared/solicitudes/modals/PermisoVacacionModal";
import RequestStatWidget from "../../../shared/solicitudes/components/RequestStatWidget";
import RequestsListModal from "../../../shared/solicitudes/components/RequestsListModal";

const ACPComercialSolicitudesView = () => {
const { showToast, showLoader, hideLoader } = useUI();
    const [modalOpen, setModalOpen] = useState(false);
    const [presetRequestType, setPresetRequestType] = useState(null);
    const [showPurchaseHandoff, setShowPurchaseHandoff] = useState(false);
    const [showPermisoModal, setShowPermisoModal] = useState(false);

    // View Modal State
    const [viewType, setViewType] = useState(null);
    const [viewTitle, setViewTitle] = useState("");
    const [viewCustomFetcher, setViewCustomFetcher] = useState(null);

    const openRequestModal = (type) => {
        setPresetRequestType(type);
        setModalOpen(true);
    };

    const handleCreate = async (data) => {
        showLoader();
        try {
            await createRequest(data);
            showToast("Solicitud creada exitosamente", "success");
            setModalOpen(false);
        } catch (error) {
            console.error("Error creando solicitud:", error);
            showToast("Error al crear la solicitud", "error");
        } finally {
            hideLoader();
        }
    };

    const handlePurchaseHandoffOpen = () => {
        setShowPurchaseHandoff(true);
    };

    const handleViewList = (type, title, fetcher = null) => {
        setViewType(type);
        setViewTitle(title);
        setViewCustomFetcher(() => fetcher);
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    <div className="flex">
                        <ActionCard
                            icon={FiUserPlus}
                            subtitle="Clientes"
                            title="Registrar Cliente"
                            color="emerald"
                            onClick={() => openRequestModal("cliente")}
                        />
                    </div>
                    <div className="flex">
                        <ActionCard
                            icon={FiCreditCard}
                            subtitle="Compras"
                            title="Requerimientos"
                            color="indigo"
                            onClick={handlePurchaseHandoffOpen}
                        />
                    </div>
                    <div className="flex">
                        <ActionCard
                            icon={FiClipboard}
                            subtitle="Talento Humano"
                            title="Permisos y Vacaciones"
                            color="orange"
                            onClick={() => setShowPermisoModal(true)}
                        />
                    </div>
                </div>
            </section>

            {/* RESUMEN DE SOLICITUDES (NUEVO) */}
            <section>
                <div className="mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">
                        Historial de Solicitudes
                    </h2>
                    <p className="text-sm text-gray-600">
                        Consulta el estado de tus gestiones
                    </p>
                </div>
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
            </section>

            {/* PURCHASE HANDOFF MODAL */}
            <PurchaseHandoffWidget
                isOpen={showPurchaseHandoff}
                onOpenChange={setShowPurchaseHandoff}
                hideButton={true}
            />

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
