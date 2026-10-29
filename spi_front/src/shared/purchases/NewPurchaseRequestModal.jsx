import React, { useState } from "react";
import { PrivatePurchaseRequestModal } from "../../core/ui/components/RequestModals";
import NewPublicPurchaseRequestModal from "../../modules/comercial/components/NewPublicPurchaseRequestModal";

/**
 * NewPurchaseRequestModal
 * Wrapper unificado que reutiliza las modales oficiales de compra
 * para mantener exactamente la misma UI/UX que RequestModals.jsx.
 */
const NewPurchaseRequestModal = ({
 isOpen: externalIsOpen,
 onOpenChange,
 mode = "acp_required",
 onSuccess,
 initialClient,
 initialOfferKind,
 hideOfferKindSelector,
}) => {
 const [internalIsOpen, setInternalIsOpen] = useState(false);

 const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
 const setIsOpen = (value) => {
 if (typeof onOpenChange === "function") {
 onOpenChange(value);
 return;
 }
 setInternalIsOpen(value);
 };

 const handleClose = () => setIsOpen(false);
 const handleSuccess = (result) => {
 onSuccess?.(result);
 };

 if (mode === "private_direct") {
 return (
 <PrivatePurchaseRequestModal
 isOpen={isOpen}
 onClose={handleClose}
 onSuccess={handleSuccess}
 initialClient={initialClient}
 initialOfferKind={initialOfferKind}
 hideOfferKindSelector={hideOfferKindSelector}
 />
 );
 }

 return (
 <NewPublicPurchaseRequestModal
 isOpen={isOpen}
 onClose={handleClose}
 onSuccess={handleSuccess}
 initialClient={initialClient}
 />
 );
};

export default NewPurchaseRequestModal;
