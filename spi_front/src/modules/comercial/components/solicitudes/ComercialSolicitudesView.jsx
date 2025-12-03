import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FiClipboard, FiSearch } from "react-icons/fi";
import { useUI } from "../../../../core/ui/UIContext";
import { getRequests } from "../../../../core/api/requestsApi";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import SolicitudesGrid from "../SolicitudesGrid";
import CreateRequestModal from "../CreateRequestModal";
import RequestDetailModal from "../RequestDetailModal";
import ActionCard from "../../../../core/ui/patterns/ActionCard";
import PurchaseHandoffWidget from "../PurchaseHandoffWidget";
import EquipmentPurchaseWidget from "../EquipmentPurchaseWidget";
import VacationRequestModal from "../../../shared/solicitudes/modals/VacationRequestModal";

const ComercialSolicitudesView = () => {
    const { showToast, confirm } = useUI();
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("all");
    const [modalOpen, setModalOpen] = useState(false);
    const [presetRequestType, setPresetRequestType] = useState(null);
    const [showPurchaseHandoff, setShowPurchaseHandoff] = useState(false);
    const [showVacationModal, setShowVacationModal] = useState(false);

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

    const filteredSolicitudes = useMemo(() => {
        if (!query) return solicitudes;
        const q = query.toLowerCase();
        return solicitudes.filter((s) => {
            const textoBase = `${s.title || ""} ${s.tipo || ""} ${s.requester_name || ""} ${s.id || ""}`.toLowerCase();
            return textoBase.includes(q);
        });
    }, [solicitudes, query]);

    const stats = useMemo(() => {
        const total = solicitudes.length;
        const pending = solicitudes.filter((s) => s.status === "pending").length;
        const inReview = solicitudes.filter((s) => s.status === "in_review").length;
        const approved = solicitudes.filter((s) => s.status === "approved").length;
        return { total, pending, inReview, approved };
    }, [solicitudes]);

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
            {/* Encabezado + resumen estilo Clientes */}
            <section className="space-y-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <FiClipboard className="text-blue-600" />
                        Solicitudes comerciales
                    </h1>
                    <p className="text-sm text-gray-500">
                        Crea y da seguimiento a las solicitudes vinculadas a tus clientes y operaciones.
                    </p>
                </div>

                <Card className="relative overflow-hidden border-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white">
                    <div className="pointer-events-none absolute inset-0 opacity-30">
                        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-3xl" />
                        <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-emerald-400/30 blur-3xl" />
                    </div>
                    <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
                                Resumen de solicitudes
                            </div>
                            <p className="text-sm text-blue-50 max-w-md">
                                Visualiza rápidamente cuántas solicitudes tienes en cada estado y utiliza el filtro para enfocarte en lo prioritario.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-gray-900 md:max-w-xl">
                            <div className="flex flex-col rounded-2xl bg-white/70 backdrop-blur px-4 py-3 border border-gray-100 shadow-sm">
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    Total
                                </span>
                                <span className="mt-1 text-2xl font-bold text-gray-900">{stats.total}</span>
                            </div>
                            <div className="flex flex-col rounded-2xl bg-white/70 backdrop-blur px-4 py-3 border border-gray-100 shadow-sm">
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    Pendientes
                                </span>
                                <span className="mt-1 text-2xl font-bold text-amber-600">{stats.pending}</span>
                            </div>
                            <div className="flex flex-col rounded-2xl bg-white/70 backdrop-blur px-4 py-3 border border-gray-100 shadow-sm">
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    En revisión
                                </span>
                                <span className="mt-1 text-2xl font-bold text-indigo-600">{stats.inReview}</span>
                            </div>
                            <div className="flex flex-col rounded-2xl bg-white/70 backdrop-blur px-4 py-3 border border-gray-100 shadow-sm">
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    Aprobadas
                                </span>
                                <span className="mt-1 text-2xl font-bold text-emerald-600">{stats.approved}</span>
                            </div>
                        </div>
                    </div>
                </Card>
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
                    {requestActionCards.map((card) => (
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
                            icon={FiClipboard}
                            subtitle="Nuevo Cliente"
                            title="Registrar Cliente"
                            color="emerald"
                            onClick={() => openRequestModal("cliente")}
                        />
                    </div>
                    <div className="flex">
                        <ActionCard
                            icon={FiClipboard}
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
                            title="Vacaciones"
                            color="orange"
                            onClick={() => setShowVacationModal(true)}
                        />
                    </div>
                </div>
            </section>

            {/* WIDGET DE SEGUIMIENTO DE COMPRAS */}
            <div id="purchase-tracker">
                <EquipmentPurchaseWidget showCreation={false} compactList />
            </div>

            {/* FILTROS + GRID DE SOLICITUDES */}
            <section className="space-y-4">
                <Card className="p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="relative flex-1 max-w-lg">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Buscar por título, tipo o solicitante..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white text-sm"
                            >
                                <option value="all">Todos los estados</option>
                                <option value="pending">Pendiente</option>
                                <option value="in_review">En revisión</option>
                                <option value="approved">Aprobado</option>
                                <option value="rejected">Rechazado</option>
                            </select>
                            <Button
                                variant="secondary"
                                onClick={load}
                                className="min-w-[140px] justify-center text-sm"
                            >
                                Actualizar lista
                            </Button>
                        </div>
                    </div>
                </Card>

                <section>
                    <div className="mb-3">
                        <h2 className="text-lg font-semibold text-gray-900">
                            Todas las solicitudes
                        </h2>
                        <p className="text-sm text-gray-500">
                            Vista consolidada de las solicitudes que puedes gestionar.
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
                            items={filteredSolicitudes}
                            onView={handleView}
                            onCancel={handleCancel}
                        />
                    )}
                </section>
            </section>

            {/* PURCHASE HANDOFF MODAL */}
            <PurchaseHandoffWidget
                isOpen={showPurchaseHandoff}
                onOpenChange={setShowPurchaseHandoff}
                hideButton={true}
            />

            {/* VACATION MODAL */}
            <VacationRequestModal
                open={showVacationModal}
                onClose={() => setShowVacationModal(false)}
                onSuccess={() => {
                    load();
                    // Opcional: recargar otros widgets si es necesario
                }}
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
