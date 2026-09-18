import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import GmailContextCommunications from "../core/ui/widgets/GmailContextCommunications";
import Modal from "../core/ui/components/Modal";

export default function GmailContextPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  return (
    <Modal
      open
      title="Categorizar comunicación de Gmail"
      maxWidth="max-w-6xl"
      closeOnBackdrop={false}
      onClose={() => navigate(-1)}
    >
      <GmailContextCommunications initialCommunicationId={searchParams.get("communication_id")} />
    </Modal>
  );
}
