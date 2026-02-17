import React, { useEffect, useMemo, useState } from "react";
import Button from "../../../core/ui/components/Button";

const PROFORMA_COOLDOWN_SECONDS = 4 * 60 * 60;

const parseDateMs = (value) => {
    const ms = new Date(value || "").getTime();
    return Number.isNaN(ms) ? null : ms;
};

const formatDuration = (seconds) => {
    const safe = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(safe / 3600);
    const minutes = Math.ceil((safe % 3600) / 60);
    if (hours <= 0) return `${minutes} min`;
    if (minutes <= 0) return `${hours} h`;
    return `${hours} h ${minutes} min`;
};

const formatDateTime = (ms) => {
    if (!Number.isFinite(ms)) return "";
    return new Date(ms).toLocaleString("es-EC", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
};

/**
 * RequestActions Component
 * Handles action buttons for equipment purchase requests
 * @param {Object} props
 * @param {Object} props.request - Request object
 * @param {boolean} props.isManager - Whether user is manager
 * @param {boolean} props.canAccessAttachments - Whether user can access attachments
 * @param {boolean} props.canUploadSignedProforma - Whether user can upload signed proforma
 * @param {Object} props.availabilityDrafts - Draft availability data
 * @param {Object} props.inspectionDraft - Draft inspection data
 * @param {Function} props.onStartAvailability - Start availability handler
 * @param {Function} props.onOpenResponse - Open response modal handler
 * @param {Function} props.onRequestProforma - Request proforma handler
 * @param {Function} props.onReserve - Reserve equipment handler
 * @param {Function} props.onUploadSignedProforma - Upload signed proforma handler
 * @param {Function} props.onUploadProforma - Upload proforma handler
 * @param {Function} props.onUploadContract - Upload contract handler
 * @param {Function} props.onRequestDeliveryDates - Request delivery dates handler
 * @param {Function} props.onSubmitDeliveryDates - Submit delivery dates handler
 * @param {Function} props.onMarkEquipmentArrived - Mark equipment arrived handler
 * @param {Function} props.onMarkDispatchReady - Mark dispatch ready handler
 * @param {Function} props.onCompleteDelivery - Complete delivery handler
 * @param {Object} props.deliveryDraft - Delivery draft data
 * @param {Function} props.onUpdateDeliveryDraft - Update delivery draft handler
 * @param {Function} props.onUpdateAvailabilityDraft - Update availability draft handler
 */
const RequestActions = ({
    request,
    isManager,
    canAccessAttachments,
    canUploadSignedProforma,
    availabilityDrafts,
    inspectionDraft,
    onStartAvailability,
    onOpenResponse,
    onRequestProforma,
    onReserve,
    onUploadSignedProforma,
    onUploadProforma,
    onUploadContract,
    onRequestDeliveryDates,
    onSubmitDeliveryDates,
    onMarkEquipmentArrived,
    onMarkDispatchReady,
    onCompleteDelivery,
    deliveryDraft,
    onUpdateDeliveryDraft,
    onUpdateAvailabilityDraft,
    checklistState,
    providerContacts = [],
    onRegisterProviderContact,
    savingProviderContact = false,
}) => {
    if (!isManager) return null;

    const availabilityDraft = availabilityDrafts[request.id] || {};
    const draftProviderEmail = availabilityDraft.provider_email ?? request.provider_email ?? "";
    const draftNotes = availabilityDraft.notes ?? request.notes ?? "";
    const pendingChecklist = Array.isArray(checklistState?.pending) ? checklistState.pending : [];
    const pendingForStartAvailability = pendingChecklist.filter((key) => {
        if (key === "provider_contact_verified" && draftProviderEmail) {
            return false;
        }
        return true;
    });
    const disableStartAvailability = pendingForStartAvailability.length > 0;

    return (
        <div className="flex flex-wrap gap-2 pt-3 border-t border-white/50">
            {request.status === "pending_provider_assignment" ? (
                <AvailabilitySetup
                    draftProviderEmail={draftProviderEmail}
                    draftNotes={draftNotes}
                    onUpdateDraft={onUpdateAvailabilityDraft}
                    onStartAvailability={() => onStartAvailability(request)}
                    requestId={request.id}
                    disabledAction={disableStartAvailability}
                    providerContacts={providerContacts}
                    onRegisterProviderContact={onRegisterProviderContact}
                    savingProviderContact={savingProviderContact}
                />
            ) : (
                <StatusBasedActions
                    request={request}
                    canAccessAttachments={canAccessAttachments}
                    canUploadSignedProforma={canUploadSignedProforma}
                    inspectionDraft={inspectionDraft}
                    onOpenResponse={() => onOpenResponse(request)}
                    onRequestProforma={() => onRequestProforma(request.id)}
                    onReserve={() => onReserve(request.id)}
                    onUploadSignedProforma={onUploadSignedProforma}
                    onUploadProforma={onUploadProforma}
                    onUploadContract={onUploadContract}
                    onRequestDeliveryDates={onRequestDeliveryDates}
                    onSubmitDeliveryDates={onSubmitDeliveryDates}
                    onMarkEquipmentArrived={onMarkEquipmentArrived}
                    onMarkDispatchReady={onMarkDispatchReady}
                    onCompleteDelivery={onCompleteDelivery}
                    deliveryDraft={deliveryDraft}
                    onUpdateDeliveryDraft={onUpdateDeliveryDraft}
                    checklistState={checklistState}
                />
            )}
        </div>
    );
};

/**
 * AvailabilitySetup Component
 * Handles provider assignment setup
 */
const AvailabilitySetup = ({
    draftProviderEmail,
    draftNotes,
    onUpdateDraft,
    onStartAvailability,
    requestId,
    disabledAction = false,
    providerContacts = [],
    onRegisterProviderContact,
    savingProviderContact = false,
}) => {
    const normalizedEmail = String(draftProviderEmail || "").trim().toLowerCase();
    const existingContact = providerContacts.find(
        (item) => String(item?.email || "").trim().toLowerCase() === normalizedEmail,
    );
    const canSaveContact = normalizedEmail && !existingContact && typeof onRegisterProviderContact === "function";

    return (
        <div className="w-full space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                    <label className="text-xs text-gray-600">Correo de proveedor</label>
                    {providerContacts.length > 0 && (
                        <select
                            className="w-full border rounded px-2 py-1 text-sm mb-2 bg-white"
                            value=""
                            onChange={(e) => {
                                const selected = e.target.value;
                                if (!selected) return;
                                onUpdateDraft(requestId, "provider_email", selected);
                                e.target.value = "";
                            }}
                        >
                            <option value="">Seleccionar proveedor guardado...</option>
                            {providerContacts.map((item) => (
                                <option key={`${item.id || item.email}`} value={item.email}>
                                    {item.display_name
                                        ? `${item.display_name} (${item.email})`
                                        : item.email}
                                </option>
                            ))}
                        </select>
                    )}
                    <input
                        type="email"
                        className="w-full border rounded px-2 py-1 text-sm"
                        value={draftProviderEmail}
                        onChange={(e) => onUpdateDraft(requestId, 'provider_email', e.target.value)}
                        placeholder="correo@proveedor.com"
                    />
                </div>
                <div>
                    <label className="text-xs text-gray-600">Notas para el correo</label>
                    <textarea
                        rows={2}
                        className="w-full border rounded px-2 py-1 text-sm"
                        value={draftNotes}
                        onChange={(e) => onUpdateDraft(requestId, 'notes', e.target.value)}
                        placeholder="Notas adicionales..."
                    />
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRegisterProviderContact?.({ email: normalizedEmail })}
                    disabled={!canSaveContact || savingProviderContact}
                >
                    Guardar proveedor
                </Button>
                {existingContact ? (
                    <span className="text-[11px] text-emerald-700">Proveedor guardado</span>
                ) : (
                    <span className="text-[11px] text-slate-500">Guarda el correo para reutilizarlo en futuras solicitudes.</span>
                )}
            </div>
            <Button size="sm" onClick={onStartAvailability} disabled={disabledAction}>
                Enviar correo de disponibilidad
            </Button>
            {disabledAction && (
                <p className="text-[11px] text-amber-700">
                    Checklist pendiente: completa los ítems requeridos para habilitar esta acción.
                </p>
            )}
        </div>
    );
};

/**
 * StatusBasedActions Component
 * Shows actions based on request status
 */
const StatusBasedActions = ({
    request,
    canAccessAttachments,
    canUploadSignedProforma,
    inspectionDraft,
    onOpenResponse,
    onRequestProforma,
    onReserve,
    onUploadSignedProforma,
    onUploadProforma,
    onUploadContract,
    onRequestDeliveryDates,
    onSubmitDeliveryDates,
    onMarkEquipmentArrived,
    onMarkDispatchReady,
    onCompleteDelivery,
    deliveryDraft,
    onUpdateDeliveryDraft,
    checklistState,
}) => {
    const { status } = request;
    const [nowMs, setNowMs] = useState(() => Date.now());
    const hasChecklistPending = Array.isArray(checklistState?.pending) && checklistState.pending.length > 0;
    useEffect(() => {
        const intervalId = setInterval(() => setNowMs(Date.now()), 30000);
        return () => clearInterval(intervalId);
    }, []);

    const proformaLockState = useMemo(() => {
        const hasProformaResponse = Boolean(request?.proforma_file_id || request?.proforma_uploaded_at);
        const retryAvailableAtMs =
            parseDateMs(request?.proforma_retry_available_at) ??
            (parseDateMs(request?.proforma_requested_at) !== null
                ? parseDateMs(request?.proforma_requested_at) + PROFORMA_COOLDOWN_SECONDS * 1000
                : null);
        const timeLocked = !hasProformaResponse && Number.isFinite(retryAvailableAtMs) && retryAvailableAtMs > nowMs;
        const serverRemaining = Number(request?.proforma_retry_remaining_seconds);
        const remainingSeconds = timeLocked
            ? Math.max(0, Math.ceil((retryAvailableAtMs - nowMs) / 1000))
            : Number.isFinite(serverRemaining) && serverRemaining > 0
                ? serverRemaining
                : 0;

        return {
            locked: Boolean(request?.proforma_request_locked) || timeLocked,
            remainingSeconds,
            retryAvailableAtMs,
        };
    }, [nowMs, request]);

    const pendingMessage = hasChecklistPending ? (
        <p className="text-[11px] text-amber-700">
            Checklist pendiente: completa los ítems requeridos para habilitar esta acción.
        </p>
    ) : null;

    switch (status) {
        case "waiting_provider_response":
            return (
                <div className="w-full space-y-2">
                    <Button
                        size="sm"
                        onClick={onOpenResponse}
                        fullWidth
                        disabled={!request.availability_email_sent_at || hasChecklistPending}
                    >
                        Registrar respuesta
                    </Button>
                    {!request.availability_email_sent_at && (
                        <p className="text-[11px] text-amber-600">
                            Envia el correo al proveedor antes de registrar respuesta.
                        </p>
                    )}
                    {pendingMessage}
                </div>
            );

        case "waiting_proforma":
            return (
                <div className="w-full space-y-2">
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={onRequestProforma}
                        disabled={hasChecklistPending || proformaLockState.locked}
                    >
                        Pedir proforma
                    </Button>
                    <FileUploadSection
                        requestId={request.id}
                        action="proforma"
                        onUpload={onUploadProforma}
                        inspectionDraft={inspectionDraft}
                    />
                    {proformaLockState.locked && (
                        <p className="text-[11px] text-slate-600">
                            Ya se envió una solicitud de proforma. Se habilita nuevamente en{" "}
                            {formatDuration(proformaLockState.remainingSeconds)}
                            {Number.isFinite(proformaLockState.retryAvailableAtMs)
                                ? ` (${formatDateTime(proformaLockState.retryAvailableAtMs)})`
                                : ""}.
                        </p>
                    )}
                    {pendingMessage}
                </div>
            );

        case "proforma_received":
            return (
                <div className="w-full space-y-2">
                    <Button size="sm" onClick={onReserve} fullWidth disabled={hasChecklistPending}>
                        Enviar reserva
                    </Button>
                    {pendingMessage}
                </div>
            );

        case "waiting_signed_proforma":
            return (
                <div className="w-full space-y-2">
                    {canUploadSignedProforma ? (
                        <FileUploadSection
                            requestId={request.id}
                            action="signed"
                            onUpload={onUploadSignedProforma}
                            inspectionDraft={inspectionDraft}
                            disabled={hasChecklistPending}
                        />
                    ) : (
                        <p className="text-[11px] text-slate-600">
                            La proforma firmada la carga únicamente ACP Comercial.
                        </p>
                    )}
                    {pendingMessage}
                </div>
            );

        case "pending_contract":
            return (
                <div className="w-full space-y-2">
                    <FileUploadSection
                        requestId={request.id}
                        action="contract"
                        onUpload={onUploadContract}
                        inspectionDraft={inspectionDraft}
                        disabled={hasChecklistPending}
                    />
                    {pendingMessage}
                </div>
            );

        case "contract_available":
            return (
                <div className="w-full space-y-2">
                    <textarea
                        rows={2}
                        className="w-full border rounded px-2 py-1 text-sm"
                        value={deliveryDraft?.notes || ""}
                        onChange={(e) => onUpdateDeliveryDraft(request.id, "notes", e.target.value)}
                        placeholder="Notas para solicitar fechas de entrega (opcional)"
                        disabled={hasChecklistPending}
                    />
                    <Button size="sm" onClick={onRequestDeliveryDates} fullWidth disabled={hasChecklistPending}>
                        Solicitar fechas de entrega
                    </Button>
                    {pendingMessage}
                </div>
            );

        case "delivery_dates_requested":
            return (
                <div className="w-full space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs text-gray-600">Fecha inicio</label>
                            <input
                                type="date"
                                className="w-full border rounded px-2 py-1 text-sm"
                                value={deliveryDraft?.delivery_start_at || ""}
                                onChange={(e) => onUpdateDeliveryDraft(request.id, "delivery_start_at", e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-600">Fecha fin</label>
                            <input
                                type="date"
                                className="w-full border rounded px-2 py-1 text-sm"
                                value={deliveryDraft?.delivery_end_at || ""}
                                onChange={(e) => onUpdateDeliveryDraft(request.id, "delivery_end_at", e.target.value)}
                            />
                        </div>
                    </div>
                    <textarea
                        rows={2}
                        className="w-full border rounded px-2 py-1 text-sm"
                        value={deliveryDraft?.notes || ""}
                        onChange={(e) => onUpdateDeliveryDraft(request.id, "notes", e.target.value)}
                        placeholder="Notas de entrega (opcional)"
                    />
                    <Button size="sm" onClick={onSubmitDeliveryDates} fullWidth>
                        Registrar fechas de entrega
                    </Button>
                </div>
            );

        case "delivery_dates_submitted":
            return (
                <div className="w-full space-y-2">
                    <Button size="sm" onClick={onMarkEquipmentArrived} fullWidth disabled={hasChecklistPending}>
                        Marcar equipo arribado
                    </Button>
                    {pendingMessage}
                </div>
            );

        case "waiting_dispatch":
            return (
                <div className="w-full space-y-2">
                    <Button size="sm" onClick={onMarkDispatchReady} fullWidth disabled={hasChecklistPending}>
                        Marcar despacho listo
                    </Button>
                    {pendingMessage}
                </div>
            );

        case "dispatch_ready":
            return (
                <div className="w-full space-y-2">
                    <Button size="sm" onClick={onCompleteDelivery} fullWidth disabled={hasChecklistPending}>
                        Completar entrega
                    </Button>
                    {pendingMessage}
                </div>
            );

        default:
            return null;
    }
};

/**
 * FileUploadSection Component
 * Handles file upload UI
 */
const FileUploadSection = ({ requestId, action, onUpload, inspectionDraft, disabled = false }) => {
    const fileKey = `${action}-${requestId}`;
    const hasFile = inspectionDraft[fileKey];

    if (action === "proforma") {
        return (
            <div className="w-full rounded-lg border border-slate-200 bg-slate-50/70 p-2">
                <input
                    type="file"
                    id={fileKey}
                    onChange={(e) => {
                        // This would be handled by parent component
                        const file = e.target.files?.[0];
                        if (file) onUpload(requestId, action, file);
                    }}
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    disabled={disabled}
                />
                <label
                    htmlFor={fileKey}
                    className={`inline-flex w-full items-center justify-center rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                        disabled
                            ? "cursor-not-allowed bg-slate-200 text-slate-500"
                            : "cursor-pointer bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                >
                    Subir proforma
                </label>
                {hasFile && (
                    <p className="mt-1 text-[11px] text-slate-500">
                        Archivo seleccionado: {inspectionDraft[fileKey]?.name || "listo para subir"}
                    </p>
                )}
                <p className="mt-1 text-[11px] text-slate-500">Formatos permitidos: PDF, JPG, JPEG, PNG.</p>
            </div>
        );
    }

    if (action === "contract") {
        return (
            <div className="flex items-center gap-2 w-full">
                <input
                    type="file"
                    id={fileKey}
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onUpload(requestId, action, file);
                    }}
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    disabled={disabled}
                />
                <label
                    htmlFor={fileKey}
                    className={`text-xs px-3 py-1 bg-white rounded transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-gray-50"}`}
                >
                    Elegir contrato
                </label>
                {hasFile && (
                    <Button
                        size="sm"
                        onClick={() => onUpload(requestId, action, inspectionDraft[fileKey])}
                        className="flex-1"
                        disabled={disabled}
                    >
                        Subir contrato
                    </Button>
                )}
            </div>
        );
    }

    if (action === "signed") {
        return (
            <div className="w-full rounded-lg border border-slate-200 bg-slate-50/70 p-2">
                <input
                    type="file"
                    id={fileKey}
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onUpload(requestId, action, file);
                    }}
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    disabled={disabled}
                />
                <label
                    htmlFor={fileKey}
                    className={`inline-flex w-full items-center justify-center rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                        disabled
                            ? "cursor-not-allowed bg-slate-200 text-slate-500"
                            : "cursor-pointer bg-indigo-600 text-white hover:bg-indigo-700"
                    }`}
                >
                    Subir proforma firmada
                </label>
                {hasFile && (
                    <p className="mt-1 text-[11px] text-slate-500">
                        Archivo seleccionado: {inspectionDraft[fileKey]?.name || "listo para subir"}
                    </p>
                )}
                <p className="mt-1 text-[11px] text-slate-500">Formatos permitidos: PDF, JPG, JPEG, PNG.</p>
            </div>
        );
    }

    return null;
};

export default RequestActions;
