import React from "react";
import Button from "../../../core/ui/components/Button";

/**
 * PrivatePurchaseActions Component
 * Handles action buttons for private purchase requests
 * @param {Object} props
 * @param {Object} props.request - Request object
 * @param {boolean} props.isBackofficeUser - Whether user is backoffice
 * @param {boolean} props.isManagerUser - Whether user is manager
 * @param {boolean} props.isAcpUser - Whether user is ACP comercial
 * @param {boolean} props.isPureCommercial - Whether user is pure commercial
 * @param {Object} props.processingAction - Current processing action
 * @param {Function} props.onSendOffer - Send offer handler
 * @param {Function} props.onUploadSigned - Upload signed offer handler
 * @param {Function} props.onRegisterClient - Register client handler
 * @param {Function} props.onRequestAcpAvailability - Request ACP availability handler
 * @param {Function} props.onAcceptAvailability - Backoffice accept availability handler
 * @param {Function} props.onRejectAvailability - Backoffice reject availability handler
 * @param {Function} props.onSendAvailabilityEmail - ACP send availability email handler
 * @param {Function} props.onRegisterProviderResponse - ACP register provider response handler
 * @param {Function} props.onResubmitToGerencia - Resubmit to gerencia handler
 * @param {Function} props.onManagerReject - Manager reject handler
 * @param {Function} props.onUploadContract - Upload contract handler
 * @param {Function} props.onUploadClientSignedContract - Upload client-signed contract handler
 * @param {Function} props.onSubmitDeliveryDates - Submit delivery dates handler
 * @param {Function} props.onOpenClientRegistrationModal - Open client registration modal handler
 * @param {Function} props.onOpenInspectionModal - Open inspection request modal handler
 * @param {Function} props.onCommercialRejectOffer - Commercial reject offer handler
 * @param {Function} props.onManagerAcceptCommercialReject - Manager accept commercial rejection handler
 * @param {Function} props.onManagerRequestPriceImprovement - Manager request price improvement handler
 */
const PrivatePurchaseActions = ({
    request,
    isBackofficeUser,
    isManagerUser,
    isChiefCommercial,
    isAcpUser,
    isPureCommercial,
    processingAction,
    onSendOffer,
    onUploadSigned,
    onRegisterClient,
    onRequestAcpAvailability,
    onAcceptAvailability,
    onRejectAvailability,
    onSendAvailabilityEmail,
    onRegisterProviderResponse,
    onResubmitToGerencia,
    onManagerReject,
    onUploadContract,
    onUploadClientSignedContract,
    onSubmitDeliveryDates,
    onOpenClientRegistrationModal,
    onOpenInspectionModal,
    onCommercialRejectOffer,
    onManagerAcceptCommercialReject,
    onManagerRequestPriceImprovement,
}) => {
    const { status } = request;

    return (
        <div className="flex flex-wrap gap-2 pt-3 border-t border-white/50">
            {isBackofficeUser && (
                <BackofficeActions
                    status={status}
                    request={request}
                    processingAction={processingAction}
                    onSendOffer={onSendOffer}
                    onUploadSigned={onUploadSigned}
                    onRegisterClient={onRegisterClient}
                    onRequestAcpAvailability={onRequestAcpAvailability}
                    onAcceptAvailability={onAcceptAvailability}
                    onRejectAvailability={onRejectAvailability}
                    onResubmitToGerencia={onResubmitToGerencia}
                    onUploadContract={onUploadContract}
                />
            )}

            {isManagerUser && (
                <ManagerActions
                    status={status}
                    request={request}
                    processingAction={processingAction}
                    isChiefCommercial={isChiefCommercial}
                    onUploadContract={onUploadContract}
                    onManagerReject={onManagerReject}
                    onManagerAcceptCommercialReject={onManagerAcceptCommercialReject}
                    onManagerRequestPriceImprovement={onManagerRequestPriceImprovement}
                />
            )}

            {isAcpUser && (
                <AcpActions
                    status={status}
                    request={request}
                    processingAction={processingAction}
                    onSendAvailabilityEmail={onSendAvailabilityEmail}
                    onRegisterProviderResponse={onRegisterProviderResponse}
                    onSendOffer={onSendOffer}
                />
            )}

            {isPureCommercial && (
                <CommercialActions
                    status={status}
                    request={request}
                    onUploadSigned={onUploadSigned}
                    onUploadClientSignedContract={onUploadClientSignedContract}
                    onSubmitDeliveryDates={onSubmitDeliveryDates}
                    onOpenClientRegistrationModal={onOpenClientRegistrationModal}
                    onOpenInspectionModal={onOpenInspectionModal}
                    onCommercialRejectOffer={onCommercialRejectOffer}
                />
            )}
        </div>
    );
};

/**
 * BackofficeActions Component
 * Shows actions for backoffice users
 */
const BackofficeActions = ({
    status,
    request,
    processingAction,
    onSendOffer,
    onUploadSigned,
    onRegisterClient,
    onRequestAcpAvailability,
    onAcceptAvailability,
    onRejectAvailability,
    onResubmitToGerencia,
    onUploadContract,
}) => {
    switch (status) {
        case "pending_backoffice":
            return (
                <Button
                    size="sm"
                    variant="primary"
                    onClick={() => onRequestAcpAvailability(request.id)}
                    loading={processingAction?.type === "forward" && processingAction?.id === request.id}
                >
                    Solicitar disponibilidad ACP
                </Button>
            );

        case "acp_availability_requested":
            if (request.provider_response_at) {
                return (
                    <div className="flex flex-wrap gap-2">
                        <Button
                            size="sm"
                            variant="success"
                            onClick={() => onAcceptAvailability(request.id)}
                            loading={processingAction?.type === "availability_accept" && processingAction?.id === request.id}
                        >
                            Aceptar disponibilidad
                        </Button>
                        <Button
                            size="sm"
                            variant="danger"
                            onClick={() => onRejectAvailability(request.id)}
                            loading={processingAction?.type === "availability_reject" && processingAction?.id === request.id}
                        >
                            Rechazar disponibilidad
                        </Button>
                    </div>
                );
            }
            return (
                <Button size="sm" variant="outline" disabled>
                    Esperando respuesta proveedor
                </Button>
            );

        case "acp_availability_confirmed":
            return (
                <Button size="sm" variant="primary" onClick={() => onSendOffer(request.id)}>
                    Enviar oferta
                </Button>
            );

        case "contract_rejected":
            return (
                <Button
                    size="sm"
                    variant="warning"
                    onClick={() => onResubmitToGerencia(request.id)}
                    loading={processingAction?.type === "resubmit" && processingAction?.id === request.id}
                >
                    Reenviar a gerencia
                </Button>
            );
        case "inspection_requested":
            if (request.contract_document_id) {
                return (
                    <Button
                        size="sm"
                        variant="warning"
                        disabled={!request.inspection_scheduled_date}
                        onClick={() => onResubmitToGerencia(request.id)}
                    >
                        Enviar a gerencia
                    </Button>
                );
            }
            return (
                <div className="space-y-1">
                    <Button
                        size="sm"
                        variant="success"
                        disabled={!request.inspection_scheduled_date}
                        onClick={() => onUploadContract(request.id)}
                    >
                        Subir contrato
                    </Button>
                    {!request.inspection_scheduled_date && (
                        <span className="text-[11px] text-amber-600">
                            Coordina la fecha de inspección antes de contrato.
                        </span>
                    )}
                </div>
            );
        case "client_registration_requested":
            return null;

        default:
            return null;
    }
};

/**
 * AcpActions Component
 * Shows actions for ACP Comercial users
 */
const AcpActions = ({
    status,
    request,
    processingAction,
    onSendAvailabilityEmail,
    onRegisterProviderResponse,
    onSendOffer,
}) => {
    switch (status) {
        case "acp_availability_requested":
            return (
                <div className="flex flex-wrap gap-2">
                    <Button
                        size="sm"
                        variant="success"
                        onClick={() => onSendAvailabilityEmail(request.id)}
                        loading={processingAction?.type === "acp_send_email" && processingAction?.id === request.id}
                        disabled={Boolean(request.availability_email_sent_at)}
                    >
                        {request.availability_email_sent_at ? "Correo enviado" : "Enviar correo proveedor"}
                    </Button>
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onRegisterProviderResponse(request.id)}
                        loading={processingAction?.type === "acp_response" && processingAction?.id === request.id}
                        disabled={
                            Boolean(request.provider_response_at) ||
                            !request.availability_email_sent_at
                        }
                    >
                        {request.provider_response_at ? "Respuesta registrada" : "Registrar respuesta"}
                    </Button>
                    {!request.availability_email_sent_at && (
                        <span className="text-[11px] text-amber-600">
                            Envia el correo al proveedor antes de registrar respuesta.
                        </span>
                    )}
                </div>
            );

        case "price_improvement_requested":
            return (
                <Button
                    size="sm"
                    variant="primary"
                    onClick={() => onSendOffer(request.id)}
                >
                    Subir oferta mejorada
                </Button>
            );

        default:
            return null;
    }
};

/**
 * ManagerActions Component
 * Shows actions for manager users
 */
const ManagerActions = ({
    status,
    request,
    processingAction,
    isChiefCommercial,
    onUploadContract,
    onManagerReject,
    onManagerAcceptCommercialReject,
    onManagerRequestPriceImprovement,
}) => {
    switch (status) {
        case "pending_contract_approval":
            return (
                <div className="flex flex-wrap gap-2">
                    <Button
                        size="sm"
                        variant="success"
                        onClick={() => onUploadContract(request.id)}
                        disabled={Boolean(request.contract_signed_document_id)}
                    >
                        {request.contract_signed_document_id ? "Contrato ya subido" : "Subir contrato"}
                    </Button>
                    <Button
                        size="sm"
                        variant="danger"
                        onClick={() => onManagerReject(request.id)}
                        loading={processingAction?.type === "reject" && processingAction?.id === request.id}
                    >
                        Rechazar
                    </Button>
                </div>
            );

        case "offer_rejected_by_commercial":
            if (!isChiefCommercial) return null;
            return (
                <div className="flex flex-wrap gap-2">
                    <Button
                        size="sm"
                        variant="danger"
                        onClick={() => onManagerAcceptCommercialReject(request.id)}
                        loading={processingAction?.type === "commercial_reject_accept" && processingAction?.id === request.id}
                    >
                        Aceptar rechazo
                    </Button>
                    <Button
                        size="sm"
                        variant="warning"
                        onClick={() => onManagerRequestPriceImprovement(request.id)}
                        loading={processingAction?.type === "price_improvement_request" && processingAction?.id === request.id}
                    >
                        Solicitar mejora de precio
                    </Button>
                </div>
            );

        default:
            return null;
    }
};

/**
 * CommercialActions Component
 * Shows actions for pure commercial users
 */
const CommercialActions = ({
    status,
    request,
    onUploadSigned,
    onUploadClientSignedContract,
    onSubmitDeliveryDates,
    onOpenClientRegistrationModal,
    onOpenInspectionModal,
    onCommercialRejectOffer,
}) => {
    switch (status) {
        case "offer_sent":
        case "pending_client_signature":
            return (
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="success" onClick={() => onUploadSigned(request.id)}>
                        Subir firma cliente
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => onCommercialRejectOffer(request.id)}>
                        Rechazar oferta
                    </Button>
                </div>
            );
        case "offer_signed":
            if (!request.client_registered_at) {
                return (
                    <Button size="sm" variant="primary" onClick={() => onOpenClientRegistrationModal(request.id)}>
                        Solicitar registro cliente
                    </Button>
                );
            }
            return null;
        case "pending_contract_client_signature":
            return (
                <Button size="sm" variant="primary" onClick={() => onUploadClientSignedContract(request.id)}>
                    Subir contrato firmado cliente
                </Button>
            );
        case "delivery_dates_requested":
            return (
                <Button size="sm" variant="primary" onClick={() => onSubmitDeliveryDates(request.id)}>
                    Ingresar fecha
                </Button>
            );
        case "client_registered":
            return (
                <Button size="sm" variant="primary" onClick={() => onOpenInspectionModal(request.id)}>
                    Generar inspeccion automatica
                </Button>
            );
        case "client_registration_requested":
            return (
                <Button size="sm" variant="primary" onClick={() => onOpenClientRegistrationModal(request.id)}>
                    Solicitar registro cliente
                </Button>
            );

        default:
            return null;
    }
};

export default PrivatePurchaseActions;
