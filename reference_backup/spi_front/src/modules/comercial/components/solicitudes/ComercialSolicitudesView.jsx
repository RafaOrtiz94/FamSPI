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
    const [showPrivateModal, setShowPrivateModal] = useState(false);
    const [creatingPrivate, setCreatingPrivate] = useState(false);
    const [privateForm, setPrivateForm] = useState(initialPrivateForm);
    const [selectedEquipment, setSelectedEquipment] = useState([]);
    const [equipmentCatalog, setEquipmentCatalog] = useState([]);
    const [offerValidity, setOfferValidity] = useState(defaultOfferValidity());
    const [offerKind, setOfferKind] = useState("venta");
    const [comodatoFile, setComodatoFile] = useState(null);
    useEffect(() => {
        let active = true;
        const loadEquipment = async () => {
            try {
                const meta = await getEquipmentPurchaseMeta();
                if (!active) return;
                setEquipmentCatalog(meta.equipment || []);
            } catch (error) {
                console.error(error);
                showToast("No se pudieron cargar los equipos disponibles", "error");
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
            return;
        }
        resetPrivateModalFields();
        setShowPrivateModal(true);
    };

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

        setCreatingPrivate(true);
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
            console.error(error);
            showToast("No pudimos crear la solicitud privada", "error");
        } finally {
            setCreatingPrivate(false);
        }
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
                        onClick={() => setShowPurchaseTypeModal(true)}
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

            <Modal
                open={showPurchaseTypeModal}
                onClose={() => setShowPurchaseTypeModal(false)}
                title="Selecciona el cliente"
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

            <Modal
                open={showPrivateModal}
                onClose={closePrivateModal}
                title="Registrar solicitud privada"
            >
                <div className="space-y-4 text-sm text-gray-700">
                    <p className="text-sm text-gray-600">
                        Registra los datos completos del cliente privado para que Backoffice continúe el proceso.
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                        <input
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            placeholder="Nombres"
                            value={privateForm.firstName}
                            onChange={(event) =>
                                setPrivateForm((prev) => ({ ...prev, firstName: event.target.value }))
                            }
                        />
                        <input
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            placeholder="Apellidos"
                            value={privateForm.lastName}
                            onChange={(event) =>
                                setPrivateForm((prev) => ({ ...prev, lastName: event.target.value }))
                            }
                        />
                    </div>
                    <input
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        placeholder="Nombre Comercial"
                        value={privateForm.clientName}
                        onChange={(event) =>
                            setPrivateForm((prev) => ({ ...prev, clientName: event.target.value }))
                        }
                    />
                    <div className="grid gap-3 md:grid-cols-2">
                        <input
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            placeholder="RUC / Cédula"
                            value={privateForm.clientIdentifier}
                            onChange={(event) =>
                                setPrivateForm((prev) => ({ ...prev, clientIdentifier: event.target.value }))
                            }
                        />
                        <input
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            placeholder="Correo de contacto"
                            value={privateForm.clientEmail}
                            onChange={(event) =>
                                setPrivateForm((prev) => ({ ...prev, clientEmail: event.target.value }))
                            }
                        />
                    </div>
                    <label className="flex flex-col text-sm text-gray-600 gap-1">
                        Tipo de cliente
                        <select
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            value={privateForm.clientType}
                            onChange={(event) =>
                                setPrivateForm((prev) => ({ ...prev, clientType: event.target.value }))
                            }
                        >
                            <option value="persona_natural">Persona natural</option>
                            <option value="persona_juridica">Persona jurídica</option>
                        </select>
                    </label>
                    <div className="space-y-2">
                        <p className="text-sm font-semibold text-gray-600">Equipos disponibles</p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {equipmentCatalog.map((equipment) => {
                                const selected = selectedEquipment.find((item) => item.id === `${equipment.id}`);
                                return (
                                    <div
                                        key={equipment.id}
                                        onClick={() => toggleEquipment(equipment.id)}
                                        className={`rounded-2xl border p-3 transition cursor-pointer ${
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
                                            <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                                                <span>Tipo:</span>
                                                <button
                                                    type="button"
                                                    className={`rounded-full px-2 py-1 ${
                                                        selected.type === "new"
                                                            ? "bg-blue-600 text-white"
                                                            : "border border-gray-300"
                                                    }`}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        updateEquipmentType(equipment.id, "new");
                                                    }}
                                                >
                                                    Nuevo
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`rounded-full px-2 py-1 ${
                                                        selected.type === "cu"
                                                            ? "bg-blue-600 text-white"
                                                            : "border border-gray-300"
                                                    }`}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
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
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-gray-500">
                            Renovación de la oferta
                        </label>
                        <input
                            type="date"
                            value={offerValidity}
                            onChange={(event) => setOfferValidity(event.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                        <p className="text-[11px] text-gray-500">
                            Vigencia sugerida: 5 años desde la fecha actual.
                        </p>
                    </div>
                    <label className="flex flex-col text-sm text-gray-600 gap-1">
                        Tipo de oferta
                        <select
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            value={offerKind}
                            onChange={(event) => setOfferKind(event.target.value)}
                        >
                            <option value="venta">Venta</option>
                            <option value="prestamo">Préstamo</option>
                            <option value="comodato">Comodato</option>
                        </select>
                    </label>
                    {offerKind === "comodato" && (
                        <label className="flex flex-col text-sm text-gray-600 gap-1">
                            Documento de estadística de consumo
                            <input
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg"
                                onChange={(event) => setComodatoFile(event.target.files?.[0] || null)}
                                className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm"
                            />
                        </label>
                    )}
                    <textarea
                        rows={3}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        placeholder="Notas adicionales (opcional)"
                        value={privateForm.notes}
                        onChange={(event) =>
                            setPrivateForm((prev) => ({ ...prev, notes: event.target.value }))
                        }
                    />
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={closePrivateModal}>
                            Cancelar
                        </Button>
                        <Button onClick={handlePrivateSubmit} loading={creatingPrivate}>
                            Crear solicitud privada
                        </Button>
                    </div>
                </div>
            </Modal>

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
