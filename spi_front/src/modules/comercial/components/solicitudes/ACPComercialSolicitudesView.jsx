import React, { useState, useContext } from "react";
import { FiCreditCard, FiUserPlus, FiUsers, FiBriefcase, FiUser } from "react-icons/fi";
import { getClientRequests } from "../../../../core/api/requestsApi";
import Modal from "../../../../core/ui/components/Modal";
import Button from "../../../../core/ui/components/Button";

import PermisoVacacionModal from "../../../shared/solicitudes/modals/PermisoVacacionModal";
import RequestStatWidget from "../../../shared/solicitudes/components/RequestStatWidget";
import RequestsListModal from "../../../shared/solicitudes/components/RequestsListModal";
import BaseSolicitudesView from "../../../shared/solicitudes/BaseSolicitudesView";
import { useUI } from "../../../../core/ui/useUI";
import { AuthContext } from "../../../../core/auth/AuthContext";

const ACPComercialSolicitudesView = () => {
    // UI States
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

    const handleWidgetClick = (widget) => {
        console.log('FASE6: handleWidgetClick called with widget:', widget.id);
        if (widget.id === 'compras') {
            console.log('FASE6: Opening NEW purchase type modal for compras widget');
            // ✅ NUEVO: Usar la nueva funcionalidad del dashboard
            setShowPurchaseTypeModal(true);
        } else {
            console.log('FASE6: Opening view list for widget:', widget.type);
            handleViewList(widget.type, widget.title, widget.fetcher);
        }
    };

    const handlePurchaseTypeSelection = (type) => {
        console.log('FASE6: handlePurchaseTypeSelection called with type:', type);
        setShowPurchaseTypeModal(false);
        if (type === "public") {
            console.log('FASE6: Opening public purchase handoff');
            handlePurchaseHandoffOpen();
        } else if (type === "private") {
            console.log('FASE6: Dispatching private purchase modal event');
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
                                        onClick={() => handleWidgetClick(widget)}
                                    />
                                ))}
                            </div>
                        )
                    }
                ]}
            />

            {/* PURCHASE HANDOFF MODAL REMOVED - Now using global modals */}

            <Modal
                open={showPurchaseTypeModal}
                onClose={() => setShowPurchaseTypeModal(false)}
                title="Selecciona el tipo de cliente"
                size="md"
            >
                <div className="space-y-6">
                    <div className="text-center">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            ¿Qué tipo de cliente requiere la compra?
                        </h3>
                        <p className="text-sm text-gray-600">
                            Selecciona el tipo de cliente para continuar con el proceso de compra
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Opción Pública */}
                        <button
                            onClick={() => handlePurchaseTypeSelection("public")}
                            className="group relative p-6 border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            aria-label="Seleccionar cliente público - Administración de Contratación Pública"
                        >
                            <div className="flex flex-col items-center space-y-3">
                                <div className="p-3 bg-blue-100 rounded-full group-hover:bg-blue-200 transition-colors">
                                    <FiBriefcase className="w-8 h-8 text-blue-600" />
                                </div>
                                <div className="text-center">
                                    <h4 className="font-semibold text-gray-900 mb-1">Cliente Público</h4>
                                    <p className="text-xs text-gray-600 leading-tight">
                                        Proceso formal vía Administración de Contratación Pública
                                    </p>
                                </div>
                            </div>
                        </button>

                        {/* Opción Privada */}
                        <button
                            onClick={() => handlePurchaseTypeSelection("private")}
                            className="group relative p-6 border-2 border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            aria-label="Seleccionar cliente privado - Proceso directo"
                        >
                            <div className="flex flex-col items-center space-y-3">
                                <div className="p-3 bg-indigo-100 rounded-full group-hover:bg-indigo-200 transition-colors">
                                    <FiUser className="w-8 h-8 text-indigo-600" />
                                </div>
                                <div className="text-center">
                                    <h4 className="font-semibold text-gray-900 mb-1">Cliente Privado</h4>
                                    <p className="text-xs text-gray-600 leading-tight">
                                        Gestión directa con el cliente
                                    </p>
                                </div>
                            </div>
                        </button>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-gray-100">
                        <Button
                            variant="secondary"
                            onClick={() => setShowPurchaseTypeModal(false)}
                            className="px-4 py-2"
                        >
                            Cancelar
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
