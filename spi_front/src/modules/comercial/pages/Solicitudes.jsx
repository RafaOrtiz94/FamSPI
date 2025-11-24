import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiSearch, FiX, FiFileText, FiPaperclip, FiClipboard } from "react-icons/fi";

import { useUI } from "../../../core/ui/useUI";
import { useApi } from "../../../core/hooks/useApi";

import {
    getRequests,
    getRequestById,
    createRequest,
    cancelRequest,
} from "../../../core/api/requestsApi";
import { getDocumentsByRequest } from "../../../core/api/documentsApi";
import { getFilesByRequest } from "../../../core/api/filesApi";

import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import SolicitudesGrid from "../components/SolicitudesGrid";
import CreateRequestModal from "../components/CreateRequestModal";
import RequestTypeActionCard from "../components/RequestTypeActionCard";
import NewClientActionCard from "../components/NewClientActionCard";
import LoadingOverlay from "../../../core/ui/components/LoadingOverlay";

const safeJSON = (txt) => {
    try {
        return JSON.parse(txt);
    } catch {
        return {};
    }
};

const SolicitudesPage = () => {
    const { showToast, confirm } = useUI();
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("all");
    const [modalOpen, setModalOpen] = useState(false);
    const [presetRequestType, setPresetRequestType] = useState(null);
    const [loadingMessage, setLoadingMessage] = useState("");
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
        {
            id: "compra",
            subtitle: "Compras",
            title: "Activa procesos de compra",
            description:
                "Solicita nuevos equipos o accesorios, asigna fechas tentativas y comparte especificaciones con abastecimiento.",
            chips: ["CapEx", "Prioridades"],
            tone: "violet",
            icon: FiClipboard,
        },
    ];

    const {
        data: listData,
        loading,
        execute: fetchList,
    } = useApi(getRequests, { errorMsg: "Error al cargar solicitudes" });

    const load = useCallback(() => {
        const filters = {
            page: 1,
            pageSize: 50,
            status: status === "all" ? undefined : status,
            q: query || undefined,
        };
        fetchList(filters);
    }, [fetchList, status, query]);

    useEffect(() => {
        load();
    }, [load]);

    const solicitudes = useMemo(
        () =>
            (listData?.rows || []).map((r) => ({
                ...r,
                payload: typeof r.payload === "string" ? safeJSON(r.payload) : r.payload,
            })),
        [listData]
    );

    const handleCreate = async ({ request_type_id, payload, files }) => {
        try {
            setLoadingMessage("Creando solicitud...");
            await createRequest({ request_type_id, payload, files });
            showToast("Solicitud creada correctamente ✅", "success");
            setModalOpen(false);
            setPresetRequestType(null);
            await load();
        } catch {
            showToast("No se pudo crear la solicitud", "error");
        } finally {
            setLoadingMessage("");
        }
    };

    const handleView = async (req) => {
        setDetail({ open: true, loading: true, data: null, error: null });
        try {
            const data = await getRequestById(req.id);
            const docs = await getDocumentsByRequest(req.id);
            const files = await getFilesByRequest(req.id);

            const parsed = {
                request: { ...(data.request || data) },
                documents: docs || [],
                attachments: files || [],
            };
            setDetail({ open: true, loading: false, data: parsed, error: null });
        } catch (e) {
            console.error(e);
            setDetail({
                open: true,
                loading: false,
                data: null,
                error: "No se pudo cargar el detalle",
            });
        }
    };

    const handleCancel = async (req) => {
        const ok = await confirm(`¿Cancelar la solicitud #${req.id}?`);
        if (!ok) return;
        try {
            await cancelRequest(req.id);
            showToast(`Solicitud #${req.id} cancelada`, "success");
            await load();
        } catch {
            showToast("No se pudo cancelar la solicitud", "error");
        }
    };

    const openRequestModal = (type) => {
        setPresetRequestType(type);
        setModalOpen(true);
    };

    return (
        <div className="p-6 space-y-6">
            <LoadingOverlay message={loadingMessage} />

            {/* HEADER */}
            <header className="flex flex-col md:flex-row justify-between items-center gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Gestión de Solicitudes
                    </h1>
                    <p className="text-sm text-gray-500">
                        Crea y administra todas las solicitudes comerciales
                    </p>
                </div>
            </header>

            {/* TARJETAS DE ACCIÓN RÁPIDA */}
            <Card className="p-5">
                <div className="mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">
                        Crear Nueva Solicitud
                    </h2>
                    <p className="text-sm text-gray-500">
                        Selecciona el tipo de solicitud que deseas crear
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {requestActionCards.map((card) => (
                        <RequestTypeActionCard
                            key={card.id}
                            {...card}
                            onClick={() => openRequestModal(card.id)}
                            ctaLabel="Crear Solicitud"
                        />
                    ))}
                    <NewClientActionCard
                        className="h-full"
                        onClick={() => openRequestModal("cliente")}
                    />
                </div>
            </Card>

            {/* FILTROS */}
            <Card className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar solicitudes..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">Todos los estados</option>
                        <option value="pending">Pendiente</option>
                        <option value="in_review">En revisión</option>
                        <option value="approved">Aprobado</option>
                        <option value="rejected">Rechazado</option>
                    </select>
                    <Button variant="secondary" onClick={load}>
                        Actualizar
                    </Button>
                </div>
            </Card>

            {/* ESTADÍSTICAS RÁPIDAS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 text-center">
                    <p className="text-sm text-gray-500">Total</p>
                    <p className="text-2xl font-bold text-gray-900">{solicitudes.length}</p>
                </Card>
                <Card className="p-4 text-center">
                    <p className="text-sm text-gray-500">Pendientes</p>
                    <p className="text-2xl font-bold text-amber-600">
                        {solicitudes.filter((s) => s.status === "pending").length}
                    </p>
                </Card>
                <Card className="p-4 text-center">
                    <p className="text-sm text-gray-500">Aprobadas</p>
                    <p className="text-2xl font-bold text-green-600">
                        {solicitudes.filter((s) => s.status === "approved").length}
                    </p>
                </Card>
                <Card className="p-4 text-center">
                    <p className="text-sm text-gray-500">Rechazadas</p>
                    <p className="text-2xl font-bold text-red-600">
                        {solicitudes.filter((s) => s.status === "rejected").length}
                    </p>
                </Card>
            </div>

            {/* GRID DE SOLICITUDES */}
            {loading ? (
                <div className="text-gray-500 py-10 text-center">Cargando…</div>
            ) : (
                <SolicitudesGrid
                    items={solicitudes}
                    onView={handleView}
                    onCancel={handleCancel}
                />
            )}

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

export default SolicitudesPage;

const RequestDetailModal = ({ detail, onClose }) => {
    if (!detail.open) return null;

    const request = detail.data?.request || {};
    const payload =
        typeof request.payload === "string"
            ? safeJSON(request.payload)
            : request.payload || {};
    const documents = Array.isArray(detail.data?.documents)
        ? detail.data.documents
        : [];
    const attachments = Array.isArray(detail.data?.attachments)
        ? detail.data.attachments
        : [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                    <div>
                        <h2 className="text-2xl font-semibold text-gray-900">
                            Solicitud #{request.id || "—"}
                        </h2>
                        <p className="text-sm text-gray-500">
                            {request.type_title || request.type_name || "Detalle completo"}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full border border-gray-200 p-2 text-gray-600 hover:bg-gray-100"
                    >
                        <FiX size={18} />
                    </button>
                </div>

                <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-6">
                    {detail.loading ? (
                        <p className="py-10 text-center text-gray-500">Cargando detalle…</p>
                    ) : detail.error ? (
                        <p className="py-10 text-center text-red-500">{detail.error}</p>
                    ) : (
                        <>
                            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <Card className="p-4">
                                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                                        Información general
                                    </h3>
                                    <ul className="space-y-2 text-sm text-gray-700">
                                        <li>
                                            <span className="font-medium">Estado:</span>{" "}
                                            {request.status || "—"}
                                        </li>
                                        <li>
                                            <span className="font-medium">Tipo:</span>{" "}
                                            {request.type_title || request.type_name || "—"}
                                        </li>
                                        <li>
                                            <span className="font-medium">Creado:</span>{" "}
                                            {request.created_at
                                                ? new Date(request.created_at).toLocaleString("es-EC")
                                                : "—"}
                                        </li>
                                        <li>
                                            <span className="font-medium">Solicitante:</span>{" "}
                                            {request.requester_email || "—"}
                                        </li>
                                    </ul>
                                </Card>

                                <Card className="p-4">
                                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                                        Cliente
                                    </h3>
                                    <ul className="space-y-2 text-sm text-gray-700">
                                        <li>
                                            <span className="font-medium">Nombre:</span>{" "}
                                            {payload?.nombre_cliente || "—"}
                                        </li>
                                        <li>
                                            <span className="font-medium">Contacto:</span>{" "}
                                            {payload?.persona_contacto || "—"}
                                        </li>
                                        <li>
                                            <span className="font-medium">Dirección:</span>{" "}
                                            {payload?.direccion_cliente || "—"}
                                        </li>
                                        <li>
                                            <span className="font-medium">Observación:</span>{" "}
                                            {payload?.observacion || "—"}
                                        </li>
                                    </ul>
                                </Card>
                            </section>

                            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <Card className="p-4">
                                    <div className="mb-3 flex items-center gap-2">
                                        <FiFileText />
                                        <h3 className="font-semibold text-gray-800">Documentos</h3>
                                    </div>
                                    {documents.length ? (
                                        <ul className="space-y-2 text-sm">
                                            {documents.map((doc) => (
                                                <li
                                                    key={doc.id || doc.doc_drive_id}
                                                    className="rounded-xl border border-gray-200 px-3 py-2"
                                                >
                                                    <p className="font-medium">{doc.title || doc.name || "Documento"}</p>
                                                    {doc.link && (
                                                        <a
                                                            href={doc.link}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs text-blue-600 hover:underline"
                                                        >
                                                            Abrir
                                                        </a>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-gray-500">Sin documentos generados.</p>
                                    )}
                                </Card>

                                <Card className="p-4">
                                    <div className="mb-3 flex items-center gap-2">
                                        <FiPaperclip />
                                        <h3 className="font-semibold text-gray-800">Adjuntos</h3>
                                    </div>
                                    {attachments.length ? (
                                        <ul className="space-y-2 text-sm">
                                            {attachments.map((file) => (
                                                <li
                                                    key={file.id || file.drive_file_id}
                                                    className="rounded-xl border border-gray-200 px-3 py-2"
                                                >
                                                    <p className="font-medium">{file.title || file.filename}</p>
                                                    {file.drive_link && (
                                                        <a
                                                            href={file.drive_link}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs text-blue-600 hover:underline"
                                                        >
                                                            Descargar
                                                        </a>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-gray-500">No hay archivos cargados.</p>
                                    )}
                                </Card>
                            </section>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
