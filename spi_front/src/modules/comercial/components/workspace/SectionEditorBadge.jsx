import React from "react";
import { FiUser } from "react-icons/fi";

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" });
}

// Muestra quien edito por ultima vez esta seccion, usando la misma info de
// ownership (completedBy/completedAt/currentOwner) que ya calcula el backend
// y que SectionNavigator ya usa en el sidebar -- aqui se hace visible tambien
// dentro de la seccion.
const SectionEditorBadge = ({ ownership = {} }) => {
  const isInProgress = Boolean(ownership.currentOwner) && !ownership.isCompleted;
  const name = isInProgress ? ownership.currentOwner : ownership.completedBy;
  if (!name) return null;

  const when = isInProgress ? "" : formatDateTime(ownership.completedAt);

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600">
      <FiUser size={12} className="text-gray-400" />
      <span>
        {isInProgress ? "Editando: " : "Última edición: "}
        <span className="font-semibold text-gray-800">{name}</span>
        {when ? ` — ${when}` : ""}
      </span>
    </div>
  );
};

export default SectionEditorBadge;
