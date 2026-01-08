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
      className={`p-6 border-0 shadow-xl ${shadowColor} rounded-2xl bg-gradient-to-br ${colors} border-l-4 ${borderColor} ${onClick ? 'cursor-pointer hover:scale-[1.02] transition-transform' : ''} ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-semibold ${textColor} uppercase tracking-wide`}>{title}</p>
          <p className={`text-3xl font-bold ${valueColor} mt-2`}>{value}</p>
          <p className={`text-xs ${textColor} mt-1`}>{subtitle}</p>
        </div>
        <div className={`p-3 ${iconBg} rounded-xl`}>
          <Icon className="text-white" size={24} />
        </div>
      </div>
    </Card>
  );
};

export default StatsCard;
