import React from "react";
import Card from "../../../../core/ui/components/Card";

/**
 * Componente reutilizable para mostrar cards de estadísticas/KPIs
 * Elimina duplicación de estilos y estructura en toda la aplicación
 */
const StatsCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  colors = "from-blue-50 via-blue-100 to-blue-200",
  borderColor = "border-blue-500",
  shadowColor = "shadow-blue-100/50",
  iconBg = "bg-blue-600",
  textColor = "text-blue-800",
  valueColor = "text-blue-900",
  className = "",
  onClick
}) => {
  return (
    <Card
      className={`p-1 sm:p-3 border-0 shadow-xl ${shadowColor} rounded-2xl bg-gradient-to-br ${colors} border-l-4 ${borderColor} min-h-[80px] sm:min-h-[108px] ${onClick ? 'cursor-pointer hover:scale-[1.02] transition-transform' : ''} ${className}`}
      onClick={onClick}
    >
      <div className="grid grid-cols-[1fr_auto] items-start gap-1.5 sm:gap-2">
        <div className="min-w-0">
          <p className={`text-[9px] sm:text-xs font-semibold ${textColor} uppercase tracking-wide truncate`}>{title}</p>
          <p className={`text-[20px] sm:text-3xl font-bold ${valueColor} mt-0.5 leading-none`}>{value}</p>
          <p className={`text-[9px] sm:text-xs ${textColor} mt-0.5 leading-snug max-h-[2.2em] overflow-hidden`}>{subtitle}</p>
        </div>
        <div className={`p-1.5 sm:p-2.5 ${iconBg} rounded-xl self-start`}>
          <Icon className="text-white" size={16} />
        </div>
      </div>
    </Card>
  );
};

export default StatsCard;
