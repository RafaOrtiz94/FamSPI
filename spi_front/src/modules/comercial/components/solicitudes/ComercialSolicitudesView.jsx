import React, { useState } from "react";
import { FiClipboard, FiCreditCard, FiUserPlus, FiTruck, FiUsers } from "react-icons/fi";
import { useUI } from "../../../../core/ui/UIContext";
import { useAuth } from "../../../../core/auth/useAuth";
import { createRequest, getClientRequests, getRequestById } from "../../../../core/api/requestsApi";
import { getDocumentsByRequest } from "../../../../core/api/documentsApi";
import { getFilesByRequest } from "../../../../core/api/filesApi";
import CreateRequestModal from "../CreateRequestModal";
import RequestDetailModal from "../RequestDetailModal";
import ActionCard from "../../../../core/ui/patterns/ActionCard";
import PurchaseHandoffWidget from "../PurchaseHandoffWidget";
import PermisoVacacionModal from "../../../shared/solicitudes/modals/PermisoVacacionModal";
import RequestStatWidget from "../../../shared/solicitudes/components/RequestStatWidget";
import RequestsListModal from "../../../shared/solicitudes/components/RequestsListModal";

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
        id: 'inspecciones',
        title: 'Inspecciones Técnicas',
        icon: FiClipboard,
        color: 'blue',
        type: 'inspeccion'
    },
    {
        id: 'retiros',
        title: 'Retiros y Devoluciones',
        icon: FiTruck,
        color: 'amber',
        type: 'retiro'
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

const ComercialSolicitudesView = () => {
    const { showToast, showLoader, hideLoader } = useUI();
    const { user } = useAuth();
    const normalizedRole = (user?.role || user?.role_name || "").toLowerCase();
    const isBackofficeUser = normalizedRole.includes("backoffice");
    const visibleStatWidgets = isBackofficeUser
        ? statWidgets.filter(
              (widget) => widget.id !== "inspecciones" && widget.id !== "retiros"
          )
        : statWidgets;
    const [modalOpen, setModalOpen] = useState(false);
    const [presetRequestType, setPresetRequestType] = useState(null);
    const [showPurchaseHandoff, setShowPurchaseHandoff] = useState(false);
    const [showPermisoModal, setShowPermisoModal] = useState(false);

    // Grid data states
    const [detail, setDetail] = useState({
        open: false,
        loading: false,
        data: null,
        error: null,
    });

    const handleViewRequest = async (request) => {
        setDetail({ open: true, loading: true, data: null, error: null });
        try {
            const requestData = await getRequestById(request.id);
            let documents = [];
            let files = [];
            try {
                documents = await getDocumentsByRequest(request.id);
            } catch (err) {
                console.warn("No se pudieron cargar los documentos:", err);
            }
            try {
                files = await getFilesByRequest(request.id);
            } catch (err) {
                console.warn("No se pudieron cargar los archivos:", err);
            }
            const normalizedRequest =
                requestData?.request || requestData || {};
            let payload = normalizedRequest.payload;
            if (typeof payload === "string") {
                try {
                    payload = JSON.parse(payload);
                } catch {
                    payload = {};
                }
            }
            payload = payload || {};
            setDetail({
                open: true,
                loading: false,
                data: {
                    request: { ...normalizedRequest, payload },
                    documents: documents || [],
                    files: files || [],
                },
                error: null,
            });
        } catch (error) {
            console.error("No se pudo cargar el detalle de la solicitud:", error);
            setDetail({
                open: true,
                loading: false,
                data: null,
                error: "No se pudo cargar el detalle de la solicitud",
            });
        }
    };

    // View Modal State
    const [viewType, setViewType] = useState(null);
    const [viewTitle, setViewTitle] = useState("");
    const [viewCustomFetcher, setViewCustomFetcher] = useState(null);

    // Request action cards configuration
    const requestActionCards = [
        {
            id: "inspection",
            subtitle: "Inspecciones",
            title: "Evalúa ambientes críticos",
            description:
                "Agenda la visita del equipo técnico y genera automáticamente la F.ST-INS para ambientes, LIS y periféricos.",
            chips: ["F.ST-INS", "Checklist"],
            color: "blue",
            icon: FiClipboard,
        },
        {
            id: "retiro",
            subtitle: "Retiros",
            title: "Coordina retiros y devoluciones",
            description:
                "Gestiona la logística inversa para equipos en campo y documenta las observaciones.",
            chips: ["Rutas"],
            color: "amber",
            icon: FiTruck,
        },
    ];
    const visibleActionCards = isBackofficeUser
        ? requestActionCards.filter((card) => card.id !== "inspection" && card.id !== "retiro")
        : requestActionCards;

    const handlePurchaseHandoffOpen = () => {
        setShowPurchaseHandoff(true);
    };

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

    const handleViewList = (type, title, fetcher = null) => {
        setViewType(type);
        setViewTitle(title);
        setViewCustomFetcher(() => fetcher);
    };



    return (
        <div className="space-y-8">
            {/* Encabezado */}
            <section>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <FiClipboard className="text-blue-600" />
                    Solicitudes comerciales
                </h1>
                <p className="text-sm text-gray-500">
                    Crea y da seguimiento a las solicitudes vinculadas a tus clientes y operaciones.
                </p>
            </section>

            {/* CREAR NUEVA SOLICITUD - Grid completo */}
            <section>
                <div className="mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">
                        Crear nueva solicitud
                    </h2>
                    <p className="text-sm text-gray-600">
                        Elige el flujo que necesitas según el tipo de gestión.
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                    {visibleActionCards.map((card) => (
                        <div key={card.id} className="flex">
                            <ActionCard
                                icon={card.icon}
                                subtitle={card.subtitle}
                                title={card.title}
                                color={card.color}
                                onClick={() => openRequestModal(card.id)}
                            />
                        </div>
                    ))}
                    <div className="flex">
                        <ActionCard
                            icon={FiUserPlus}
                            subtitle="Nuevo Cliente"
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
                            icon={FiUsers}
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
                        Resumen de Solicitudes
                    </h2>
                    <p className="text-sm text-gray-600">
                        Consulta el historial de solicitudes por tipo
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {visibleStatWidgets.map(widget => (
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
                onSuccess={() => { }}
            />

            {/* MODAL LISTADO DE SOLICITUDES */}
            <RequestsListModal
                open={!!viewType}
                onClose={() => setViewType(null)}
                type={viewType}
                title={viewTitle}
                customFetcher={viewCustomFetcher}
                onView={handleViewRequest}
            />

            {/* MODALES CREACION */}
            <CreateRequestModal
                open={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setPresetRequestType(null);
                }}
                onSubmit={handleCreate}
                presetType={presetRequestType}
            />

            <RequestDetailModal
                detail={detail}
                onClose={() =>
                    setDetail({ open: false, loading: false, data: null, error: null })
                }
            />
        </div>
    );
};

export default ComercialSolicitudesView;
