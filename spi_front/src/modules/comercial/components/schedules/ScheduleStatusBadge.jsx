const STATUS_CONFIG = {
  draft:            { label: "Borrador",  cls: "bg-[#F3F4F6] text-[#1F2937]" },
  pending_approval: { label: "Pendiente", cls: "bg-[#FEF3C7] text-[#D97706]" },
  approved:         { label: "Aprobado",  cls: "bg-[#DCFCE7] text-[#16A34A]" },
  rejected:         { label: "Rechazado", cls: "bg-[#FEE2E2] text-[#DC2626]" },
};

const ScheduleStatusBadge = ({ status, size = "sm" }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const textSize = size === "xs" ? "text-[11px]" : "text-xs";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium ${textSize} ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};

export default ScheduleStatusBadge;
