import React from "react";
import Button from "../../../core/ui/components/Button";

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
    requestId
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
            <Button size="sm" onClick={onStartAvailability}>
                Enviar correo de disponibilidad
            </Button>
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
}) => {
    const { status } = request;

    switch (status) {
        case "waiting_provider_response":
            return (
                <Button size="sm" onClick={onOpenResponse} fullWidth>
                    Registrar respuesta
                </Button>
            );

        case "waiting_proforma":
            return (
                <div className="w-full space-y-2">
                    <Button size="sm" variant="secondary" onClick={onRequestProforma}>
                        Pedir proforma
                    </Button>
                    <FileUploadSection
                        requestId={request.id}
                        action="proforma"
                        onUpload={onUploadProforma}
                        inspectionDraft={inspectionDraft}
                    />
                </div>
            );

        case "proforma_received":
            return (
                <Button size="sm" onClick={onReserve} fullWidth>
                    Enviar reserva
                </Button>
            );

        case "waiting_signed_proforma":
            return (
                <Button
                    size="sm"
                    fullWidth
                    onClick={onOpenInspection}
                >
                    📄 Subir proforma firmada e inspección
                </Button>
            );

        case "pending_contract":
            return (
                <FileUploadSection
                    requestId={request.id}
                    action="contract"
                    onUpload={onUploadContract}
                    inspectionDraft={inspectionDraft}
                />
            );

        default:
            return null;
    }
};

/**
 * FileUploadSection Component
 * Handles file upload UI
 */
const FileUploadSection = ({ requestId, action, onUpload, inspectionDraft }) => {
    const fileKey = `${action}-${requestId}`;
    const hasFile = inspectionDraft[fileKey];

    if (action === "proforma") {
        return (
            <div className="flex items-center gap-2 flex-1">
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
                />
                <label
                    htmlFor={fileKey}
                    className="text-xs px-3 py-1 bg-white rounded cursor-pointer hover:bg-gray-50 transition-colors flex-1 text-center"
                >
                    Elegir archivo
                </label>
                {hasFile && (
                    <Button
                        size="sm"
                        onClick={() => onUpload(requestId, action, inspectionDraft[fileKey])}
                    >
                        Subir
                    </Button>
                )}
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
                />
                <label
                    htmlFor={fileKey}
                    className="text-xs px-3 py-1 bg-white rounded cursor-pointer hover:bg-gray-50 transition-colors"
                >
                    Elegir contrato
                </label>
                {hasFile && (
                    <Button
                        size="sm"
                        onClick={() => onUpload(requestId, action, inspectionDraft[fileKey])}
                        className="flex-1"
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
