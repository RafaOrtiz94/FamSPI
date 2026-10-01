/**
 * Resuelve el estado agregado de un workflow de firma paralela.
 * Un rechazo individual no bloquea a los demas firmantes, pero un firmante
 * obligatorio rechazado tampoco puede contarse como una firma completada.
 */
function resolveParallelWorkflowState(signers = []) {
  const requiredSigners = signers.filter((signer) => signer?.is_required !== false);
  const unsignedRequired = requiredSigners.filter(
    (signer) => String(signer?.status || "").toLowerCase() !== "signed",
  );

  return {
    status: unsignedRequired.length ? "partially_signed" : "completed",
    canComplete: unsignedRequired.length === 0,
    unsignedRequiredIds: unsignedRequired.map((signer) => Number(signer.id)).filter(Number.isFinite),
    hasRequiredRejection: unsignedRequired.some(
      (signer) => String(signer?.status || "").toLowerCase() === "rejected",
    ),
  };
}

module.exports = { resolveParallelWorkflowState };
