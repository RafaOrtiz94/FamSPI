import React from "react";
import Modal from "../../../../../core/ui/components/Modal";
import PersonnelRequestReview from "../../workspace/PersonnelRequestReview";
import PersonnelRequestForm from "../../../../../core/ui/widgets/PersonnelRequestForm";

const ActionDrawersSection = ({
  createDrawerOpen = false,
  onCloseCreateDrawer,
  onRequestCreated,
  reviewModeOpen = false,
  reviewRequestData = null,
  canApprovePersonnel = false,
  onCloseReview,
  onRequestReviewed,
}) => (
  <>
    <Modal
      isOpen={createDrawerOpen}
      onClose={onCloseCreateDrawer}
      title="Nueva solicitud de personal"
      maxWidth="max-w-4xl"
    >
      <PersonnelRequestForm
        isModal
        onClose={onCloseCreateDrawer}
        onSuccess={onRequestCreated}
      />
    </Modal>

    <Modal
      isOpen={reviewModeOpen && Boolean(reviewRequestData)}
      onClose={onCloseReview}
      title="Revisar solicitud"
      maxWidth="max-w-4xl"
    >
      {reviewRequestData && (
        <PersonnelRequestReview
          request={reviewRequestData}
          onRequestCancel={onCloseReview}
          onRequestUpdate={onRequestReviewed}
          canApprove={canApprovePersonnel}
        />
      )}
    </Modal>
  </>
);

export default ActionDrawersSection;
