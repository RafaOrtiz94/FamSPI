import React, { useState, useEffect, useCallback } from "react";
import { FiClipboard, FiSearch } from "react-icons/fi";
import { useUI } from "../../../../core/ui/UIContext";
import { getRequests } from "../../../../core/api/requestsApi";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import SolicitudesGrid from "../SolicitudesGrid";
import CreateRequestModal from "../CreateRequestModal";
import RequestDetailModal from "../RequestDetailModal";
import RequestTypeActionCard from "../RequestTypeActionCard";
import NewClientActionCard from "../NewClientActionCard";
import PurchaseRequestActionCard from "../PurchaseRequestActionCard";
import PurchaseHandoffWidget from "../PurchaseHandoffWidget";
import EquipmentPurchaseWidget from "../EquipmentPurchaseWidget";

const ComercialSolicitudesView = () => {
    const { showToast, confirm } = useUI();
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("all");
    const [modalOpen, setModalOpen] = useState(false);
    const [presetRequestType, setPresetRequestType] = useState(null);
    const [showPurchaseHandoff, setShowPurchaseHandoff] = useState(false);

    // Grid data states
    const [solicitudes, setSolicitudes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [detail, setDetail] = useState({
        open: false,
        loading: false,
        data: null,
        error: null,
    });

    // Request action cards configuration
    const requestActionCards = [
        {
            id: "inspection",
            subtitle: "Inspecciones",
            title: "Evalúa ambientes críticos",
            description:
                "Agenda la visita del equipo técnico y genera automáticamente la F.ST-INS para ambientes, LIS y periféricos.",
            chips: ["F.ST-INS", "Checklist"],
            tone: "blue",
            icon: FiClipboard,
        },
        {
            id: "retiro",
            subtitle: "Retiros",
            title: "Coordina retiros y devoluciones",
            description:
                "Gestiona la logística inversa para equipos en campo, notifica a inventario y documenta las observaciones.",
            chips: ["Rutas", "Inventario"],
            tone: "amber",
            icon: FiClipboard,
        },
    ];

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const filters = {};
            if (status !== "all") filters.status = status;

            // Aquí podrías agregar lógica de paginación real si la API lo soporta
            const response = await getRequests({ page: 1, limit: 50, ...filters });
            setSolicitudes(response.rows || []);
        } catch (error) {
            console.error("Error loading requests:", error);
            showToast("Error al cargar las solicitudes", "error");
        } finally {
            setLoading(false);
        }
    }, [status, showToast]);

    useEffect(() => {
        load();
    }, [load]);

    const handlePurchaseHandoffOpen = () => {
        setShowPurchaseHandoff(true);
    };

    const openRequestModal = (type) => {
        setPresetRequestType(type);
        setModalOpen(true);
    };

    const handleCreate = async (data) => {
        try {
            setModalOpen(false);
            showToast("Solicitud creada exitosamente", "success");
            load(); // Recargar la lista
        } catch (error) {
            console.error("Error creando solicitud:", error);
            showToast("Error al crear la solicitud", "error");
        }
    };

    const handleView = (item) => {
        // Implementar lógica de ver detalle si es necesario
        console.log("View item:", item);
    };

    const handleCancel = async (item) => {
        const confirmed = await confirm(
            "¿Estás seguro de cancelar esta solicitud?",
            "Esta acción no se puede deshacer."
        );
        if (confirmed) {
            showToast("Solicitud cancelada", "success");
            load();
        }
    };

    return (
        <div className="space-y-8">
            {/* CREAR NUEVA SOLICITUD - Grid completo */}
            <section>
                <div className="mb-5">
                    <h2 className="text-xl font-bold text-gray-900 mb-1">
                        Crear Nueva Solicitud
                    </h2>
                    <p className="text-sm text-gray-600">
                        Selecciona el tipo de solicitud que deseas crear
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                    {requestActionCards.map((card) => (
                        <div key={card.id} className="flex">
                            <RequestTypeActionCard
                                {...card}
                                onClick={() => openRequestModal(card.id)}
                                ctaLabel="Crear Solicitud"
                            />
                        </div>
                    ))}
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

            {/* WIDGET DE SEGUIMIENTO DE COMPRAS */}
            <div id="purchase-tracker">
                <EquipmentPurchaseWidget showCreation={false} compactList />
            </div>

            {/* FILTROS Y BÚSQUEDA */}
            <section>
                <div className="mb-5">
                    <h2 className="text-xl font-bold text-gray-900 mb-1">
                        Buscar Solicitudes
                    </h2>
                    <p className="text-sm text-gray-600">
                        Filtra y encuentra solicitudes específicas
                    </p>
                </div>
                <Card className="p-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Buscar solicitudes..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                        </div>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                        >
                            <option value="all">Todos los estados</option>
                            <option value="pending">Pendiente</option>
                            <option value="in_review">En revisión</option>
                            <option value="approved">Aprobado</option>
                            <option value="rejected">Rechazado</option>
                        </select>
                        <Button variant="secondary" onClick={load} className="w-full">
                            Actualizar Lista
                        </Button>
                    </div>
                </Card>
            </section>

            {/* GRID DE SOLICITUDES */}
            <section>
                <div className="mb-5">
                    <h2 className="text-xl font-bold text-gray-900 mb-1">
                        Todas las Solicitudes
                    </h2>
                    <p className="text-sm text-gray-600">
                        Listado completo de solicitudes registradas
                    </p>
                </div>
                {loading ? (
                    <Card className="p-12">
                        <div className="text-center">
                            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
                            <p className="text-gray-500">Cargando solicitudes...</p>
                        </div>
                    </Card>
                ) : (
                    <SolicitudesGrid
                        items={solicitudes}
                        onView={handleView}
                        onCancel={handleCancel}
                    />
                )}
            </section>

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
