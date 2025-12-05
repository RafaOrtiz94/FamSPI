const STATUS_MAP = {
  draft: { label: "Borrador", color: "bg-yellow-100 text-yellow-800", icon: "🟡" },
  pending_approval: { label: "Pendiente", color: "bg-blue-100 text-blue-800", icon: "🔵" },
  approved: { label: "Aprobado", color: "bg-green-100 text-green-800", icon: "🟢" },
  rejected: { label: "Rechazado", color: "bg-red-100 text-red-800", icon: "🔴" },
};

const ScheduleStatusBadge = ({ status }) => {
  const meta = STATUS_MAP[status] || STATUS_MAP.draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${meta.color}`}>
      <span>{meta.icon}</span>
      {meta.label}
    </span>
  );
};

export default ScheduleStatusBadge;
