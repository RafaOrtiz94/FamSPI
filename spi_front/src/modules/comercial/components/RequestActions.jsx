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
 * @param {Object} props.availabilityDrafts - Draft availability data
 * @param {Object} props.inspectionDraft - Draft inspection data
 * @param {Function} props.onStartAvailability - Start availability handler
 * @param {Function} props.onOpenResponse - Open response modal handler
 * @param {Function} props.onRequestProforma - Request proforma handler
 * @param {Function} props.onReserve - Reserve equipment handler
 * @param {Function} props.onOpenInspection - Open inspection modal handler
 * @param {Function} props.onUploadProforma - Upload proforma handler
 * @param {Function} props.onUploadContract - Upload contract handler
 * @param {Function} props.onUpdateAvailabilityDraft - Update availability draft handler
 */
const RequestActions = ({
    request,
    isManager,
    canAccessAttachments,
    availabilityDrafts,
    inspectionDraft,
    onStartAvailability,
    onOpenResponse,
    onRequestProforma,
    onReserve,
    onOpenInspection,
    onUploadProforma,
    onUploadContract,
    onUpdateAvailabilityDraft,
    checklistState,
}) => {
    if (!isManager) return null;

    const availabilityDraft = availabilityDrafts[request.id] || {};
    const draftProviderEmail = availabilityDraft.provider_email ?? request.provider_email ?? "";
    const draftNotes = availabilityDraft.notes ?? request.notes ?? "";

    return (
        <div className="flex flex-wrap gap-2 pt-3 border-t border-white/50">
            {request.status === "pending_provider_assignment" ? (
                <AvailabilitySetup
                    draftProviderEmail={draftProviderEmail}
                    draftNotes={draftNotes}
                    onUpdateDraft={onUpdateAvailabilityDraft}
                    onStartAvailability={() => onStartAvailability(request)}
                    requestId={request.id}
                    disabled={Array.isArray(checklistState?.pending) && checklistState.pending.length > 0}
                />
            ) : (
                <StatusBasedActions
                    request={request}
                    canAccessAttachments={canAccessAttachments}
                    inspectionDraft={inspectionDraft}
                    onOpenResponse={() => onOpenResponse(request)}
                    onRequestProforma={() => onRequestProforma(request.id)}
                    onReserve={() => onReserve(request.id)}
                    onOpenInspection={() => onOpenInspection(request)}
                    onUploadProforma={onUploadProforma}
                    onUploadContract={onUploadContract}
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
    disabled = false,
}) => {
    return (
        <div className="w-full space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                    <label className="text-xs text-gray-600">Correo de proveedor</label>
                    <input
                        type="email"
                        className="w-full border rounded px-2 py-1 text-sm"
                        value={draftProviderEmail}
                        onChange={(e) => onUpdateDraft(requestId, 'provider_email', e.target.value)}
                        placeholder="correo@proveedor.com"
                        disabled={disabled}
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
                        disabled={disabled}
                    />
                </div>
            </div>
            <Button size="sm" onClick={onStartAvailability} disabled={disabled}>
                Enviar correo de disponibilidad
            </Button>
            {disabled && (
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
    inspectionDraft,
    onOpenResponse,
    onRequestProforma,
    onReserve,
    onOpenInspection,
    onUploadProforma,
    onUploadContract,
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
                    <Button
                        size="sm"
                        fullWidth
                        onClick={onOpenInspection}
                        disabled={hasChecklistPending}
                    >
                        📄 Subir proforma firmada e inspección
                    </Button>
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

    return null;
};

export default RequestActions;
