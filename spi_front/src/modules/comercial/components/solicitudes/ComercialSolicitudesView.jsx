import React, { useEffect, useState } from "react";
import { FiClipboard, FiCreditCard, FiUserPlus, FiTruck, FiUsers } from "react-icons/fi";
import { useUI } from "../../../../core/ui/UIContext";
import { useAuth } from "../../../../core/auth/useAuth";
import { createRequest, getClientRequests, getRequestById } from "../../../../core/api/requestsApi";
import { getDocumentsByRequest } from "../../../../core/api/documentsApi";
import { getFilesByRequest } from "../../../../core/api/filesApi";
import { createPrivatePurchase } from "../../../../core/api/privatePurchasesApi";
import { getEquipmentPurchaseMeta } from "../../../../core/api/equipmentPurchasesApi";
import Button from "../../../../core/ui/components/Button";
import CreateRequestModal from "../CreateRequestModal";
import Modal from "../../../../core/ui/components/Modal";
import RequestDetailModal from "../RequestDetailModal";
import ActionCard from "../../../../core/ui/patterns/ActionCard";
import PurchaseHandoffWidget from "../PurchaseHandoffWidget";
import PermisoVacacionModal from "../../../shared/solicitudes/modals/PermisoVacacionModal";
import RequestStatWidget from "../../../shared/solicitudes/components/RequestStatWidget";
import RequestsListModal from "../../../shared/solicitudes/components/RequestsListModal";
import BaseSolicitudesView from "../../../shared/solicitudes/BaseSolicitudesView";

const initialPrivateForm = {
    firstName: "",
    lastName: "",
    clientName: "",
    clientEmail: "",
    clientIdentifier: "",
    notes: "",
    clientType: "persona_natural",
};

const defaultOfferValidity = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 5);
    return date.toISOString().split("T")[0];
};

const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

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
    const [showPurchaseTypeModal, setShowPurchaseTypeModal] = useState(false);

    // Private purchase modal states - RESTORED FROM REFERENCE VERSION
    const [privateForm, setPrivateForm] = useState(initialPrivateForm);
    const [selectedEquipment, setSelectedEquipment] = useState([]);
    const [equipmentCatalog, setEquipmentCatalog] = useState([]);
    const [loadingEquipment, setLoadingEquipment] = useState(false);
    const [offerValidity, setOfferValidity] = useState(defaultOfferValidity());
    const [offerKind, setOfferKind] = useState("venta");
    const [comodatoFile, setComodatoFile] = useState(null);
    const [showPrivateModal, setShowPrivateModal] = useState(false);
    const [creatingPrivate, setCreatingPrivate] = useState(false);

    // Cargar equipos disponibles al montar el componente - RESTORED FROM REFERENCE VERSION
    useEffect(() => {
        let active = true;
        const loadEquipment = async () => {
            setLoadingEquipment(true);
            try {
                const meta = await getEquipmentPurchaseMeta();
                if (!active) return;
                setEquipmentCatalog(meta.equipment || []);
            } catch (error) {
                console.error("Error cargando equipos:", error);
                showToast("No se pudieron cargar los equipos disponibles", "error");
            } finally {
                setLoadingEquipment(false);
            }
        };
        loadEquipment();
        return () => {
            active = false;
        };
    }, [showToast]);

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
            const normalizedRequest = requestData?.request || requestData || {};
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
            description: "Agenda la visita del equipo técnico y genera automáticamente la F.ST-INS.",
            color: "blue",
            icon: FiClipboard,
        },
        {
            id: "retiro",
            subtitle: "Retiros",
            title: "Coordina retiros y devoluciones",
            description: "Gestiona la logística inversa para equipos en campo.",
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

    const resetPrivateModalFields = () => {
        setPrivateForm(initialPrivateForm);
        setSelectedEquipment([]);
        setOfferValidity(defaultOfferValidity());
        setOfferKind("venta");
        setComodatoFile(null);
    };

    const closePrivateModal = () => {
        resetPrivateModalFields();
        setShowPrivateModal(false);
    };

    const handlePurchaseTypeSelection = (type) => {
        setShowPurchaseTypeModal(false);
        if (type === "public") {
            handlePurchaseHandoffOpen();
        } else if (type === "private") {
            // Abrir modal de compra privada detallado
            resetPrivateModalFields();
            setShowPrivateModal(true);
        }
    };

    // Funciones para manejo de equipos en modal privado
    const normalizeEquipmentId = (id) => `${id}`;

    const toggleEquipment = (id) => {
        setSelectedEquipment((prev) => {
            const normalizedId = normalizeEquipmentId(id);
            const exists = prev.find((item) => item.id === normalizedId);
            if (exists) {
                return prev.filter((item) => item.id !== normalizedId);
            }
            return [...prev, { id: normalizedId, type: "new" }];
        });
    };

    const updateEquipmentType = (id, type) => {
        setSelectedEquipment((prev) =>
            prev.map((item) =>
                item.id === normalizeEquipmentId(id) ? { ...item, type } : item)
        );
    };

    // Función para crear solicitud privada
    const handlePrivateSubmit = async () => {
        if (!privateForm.firstName.trim() || !privateForm.lastName.trim()) {
            showToast("Ingresa nombres y apellidos del cliente", "warning");
            return;
        }
        if (!privateForm.clientName.trim()) {
            showToast("Ingresa el nombre comercial del cliente", "warning");
            return;
        }
        if (!selectedEquipment.length) {
            showToast("Selecciona al menos un equipo", "warning");
            return;
        }
        if (offerKind === "comodato" && !comodatoFile) {
            showToast("Adjunta el documento de estadísticas para comodato", "warning");
            return;
        }

        showLoader();
        try {
            const equipmentPayload = selectedEquipment
                .map((selected) => {
                    const item = equipmentCatalog.find(
                        (equip) => `${equip.id}` === normalizeEquipmentId(selected.id)
                    );
                    return {
                        id: item?.id || selected.id,
                        name: item?.name || "Equipo",
                        sku: item?.sku || null,
                        type: selected.type || "new",
                    };
                })
                .filter(Boolean);

            const payload = {
                clientSnapshot: {
                    client_type: privateForm.clientType,
                    commercial_name: privateForm.clientName.trim(),
                    client_email: privateForm.clientEmail.trim() || null,
                    client_identifier: privateForm.clientIdentifier.trim() || null,
                    first_name: privateForm.firstName.trim(),
                    last_name: privateForm.lastName.trim(),
                },
                equipment: equipmentPayload,
                notes: privateForm.notes.trim() || null,
                offer_valid_until: new Date(offerValidity).toISOString(),
                offer_kind: offerKind,
            };

            if (offerKind === "comodato" && comodatoFile) {
                const base64 = await fileToBase64(comodatoFile);
                payload.comodato_document_base64 = base64;
                payload.comodato_document_name = comodatoFile.name;
                payload.comodato_document_mime = comodatoFile.type;
            }

            await createPrivatePurchase(payload);
            showToast("Solicitud privada registrada. Backoffice la revisará", "success");
            closePrivateModal();
        } catch (error) {
            console.error("Error creando solicitud privada:", error);
            showToast("No pudimos crear la solicitud privada", "error");
        } finally {
            hideLoader();
        }
    };

    const comercialActionCards = [
        ...visibleActionCards,
        {
            id: "cliente",
            subtitle: "Nuevo Cliente",
            title: "Registrar Cliente",
            color: "emerald",
            icon: FiUserPlus,
        },
        {
            id: "compra-total",
            subtitle: "Compras",
            title: "Requerimientos",
            color: "indigo",
            icon: FiCreditCard,
        },
        {
            id: "vacaciones",
            subtitle: "Talento Humano",
            title: "Permisos y Vacaciones",
            color: "orange",
            icon: FiUsers,
        }
    ];

    const handleActionClick = (id) => {
        if (id === "vacaciones") {
            setShowPermisoModal(true);
            return;
        }
        if (id === "compra-total") {
            setShowPurchaseTypeModal(true);
            return;
        }
        const mappedType = id;
        openRequestModal(mappedType);
    };

    return (
        <div className="space-y-8">
            <BaseSolicitudesView
                actionCards={comercialActionCards}
                onActionCardClick={(card) => handleActionClick(card.id)}
                createSectionTitle="Crear Nueva Solicitud"
                createSectionSubtitle="Elige el flujo que necesitas según el tipo de gestión"
                customSections={[
                    {
                        id: "resumen",
                        title: "Resumen de Solicitudes",
                        subtitle: "Consulta el historial de solicitudes por tipo",
                        content: (
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

            {/* MODAL DE COMPRA PRIVADA DETALLADO */}
            <Modal
                open={showPrivateModal}
                onClose={closePrivateModal}
                title="Registrar solicitud privada"
                size="large"
            >
                <div className="space-y-6 text-sm text-gray-700">
                    <p className="text-sm text-gray-600">
                        Registra los datos completos del cliente privado para que Backoffice continúe el proceso.
                    </p>

                    {/* Información del Cliente */}
                    <div className="border-b pb-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Información del Cliente</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                            <input
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Nombres"
                                value={privateForm.firstName}
                                onChange={(e) => setPrivateForm(prev => ({ ...prev, firstName: e.target.value }))}
                            />
                            <input
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Apellidos"
                                value={privateForm.lastName}
                                onChange={(e) => setPrivateForm(prev => ({ ...prev, lastName: e.target.value }))}
                            />
                        </div>
                        <input
                            className="w-full mt-4 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Nombre Comercial"
                            value={privateForm.clientName}
                            onChange={(e) => setPrivateForm(prev => ({ ...prev, clientName: e.target.value }))}
                        />
                        <div className="grid gap-4 md:grid-cols-2 mt-4">
                            <input
                                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="RUC / Cédula"
                                value={privateForm.clientIdentifier}
                                onChange={(e) => setPrivateForm(prev => ({ ...prev, clientIdentifier: e.target.value }))}
                            />
                            <input
                                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Correo de contacto"
                                value={privateForm.clientEmail}
                                onChange={(e) => setPrivateForm(prev => ({ ...prev, clientEmail: e.target.value }))}
                            />
                        </div>
                        <div className="mt-4">
                            <label className="flex flex-col text-sm text-gray-600 gap-1">
                                Tipo de cliente
                                <select
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={privateForm.clientType}
                                    onChange={(e) => setPrivateForm(prev => ({ ...prev, clientType: e.target.value }))}
                                >
                                    <option value="persona_natural">Persona natural</option>
                                    <option value="persona_juridica">Persona jurídica</option>
                                </select>
                            </label>
                        </div>
                    </div>

                    {/* Equipos */}
                    <div className="border-b pb-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">Equipos disponibles</h3>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {equipmentCatalog.map((equipment) => {
                                const selected = selectedEquipment.find(item => item.id === `${equipment.id}`);
                                return (
                                    <div
                                        key={equipment.id}
                                        onClick={() => toggleEquipment(equipment.id)}
                                        className={`rounded-2xl border p-4 transition cursor-pointer ${
                                            selected ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">
                                                    {equipment.name}
                                                </p>
                                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                                    SKU: {equipment.sku || "N/A"}
                                                </p>
                                            </div>
                                            <span className={`text-xs font-semibold ${selected ? "text-blue-700" : "text-gray-400"}`}>
                                                {selected ? "Seleccionado" : "Agregar"}
                                            </span>
                                        </div>
                                        {selected && (
                                            <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                                                <span>Tipo:</span>
                                                <button
                                                    type="button"
                                                    className={`rounded-full px-2 py-1 ${
                                                        selected.type === "new" ? "bg-blue-600 text-white" : "border border-gray-300"
                                                    }`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        updateEquipmentType(equipment.id, "new");
                                                    }}
                                                >
                                                    Nuevo
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`rounded-full px-2 py-1 ${
                                                        selected.type === "cu" ? "bg-blue-600 text-white" : "border border-gray-300"
                                                    }`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        updateEquipmentType(equipment.id, "cu");
                                                    }}
                                                >
                                                    CU
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {equipmentCatalog.length === 0 && (
                            <p className="text-sm text-gray-500 text-center py-4">
                                {loadingEquipment ? "Cargando equipos..." : "No hay equipos disponibles"}
                            </p>
                        )}
                    </div>

                    {/* Configuración de oferta */}
                    <div className="space-y-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-semibold text-gray-600">
                                Vigencia de la oferta
                            </label>
                            <input
                                type="date"
                                value={offerValidity}
                                onChange={(e) => setOfferValidity(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <p className="text-xs text-gray-500">
                                Vigencia sugerida: 5 años desde la fecha actual.
                            </p>
                        </div>

                        <div>
                            <label className="flex flex-col text-sm text-gray-600 gap-1">
                                Tipo de oferta
                                <select
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={offerKind}
                                    onChange={(e) => setOfferKind(e.target.value)}
                                >
                                    <option value="venta">Venta</option>
                                    <option value="prestamo">Préstamo</option>
                                    <option value="comodato">Comodato</option>
                                </select>
                            </label>
                        </div>

                        {offerKind === "comodato" && (
                            <div>
                                <label className="flex flex-col text-sm text-gray-600 gap-1">
                                    Documento de estadística de consumo
                                    <input
                                        type="file"
                                        accept=".pdf,.png,.jpg,.jpeg"
                                        onChange={(e) => setComodatoFile(e.target.files?.[0] || null)}
                                        className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm"
                                    />
                                </label>
                            </div>
                        )}

                        <div>
                            <label className="flex flex-col text-sm text-gray-600 gap-1">
                                Notas adicionales
                                <textarea
                                    rows={3}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Información adicional sobre la solicitud..."
                                    value={privateForm.notes}
                                    onChange={(e) => setPrivateForm(prev => ({ ...prev, notes: e.target.value }))}
                                />
                            </label>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="secondary" onClick={closePrivateModal}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handlePrivateSubmit}
                            disabled={!privateForm.clientName || selectedEquipment.length === 0}
                        >
                            Crear solicitud privada
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ComercialSolicitudesView;
