import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../core/api';

const ComplianceDashboard = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['ca01xx-compliance-stats'],
    queryFn: () => api.get('/ca01xx/compliance/dashboard'),
    refetchInterval: 60000,
  });

  const { data: pendingAlarms } = useQuery({
    queryKey: ['ca01xx-pending-alarms'],
    queryFn: () => api.get('/ca01xx/alarms?status=open'),
    refetchInterval: 30000,
  });

  const { data: overdueCalibrations } = useQuery({
    queryKey: ['ca0114-overdue'],
    queryFn: () => api.get('/ca0114/calibrations/overdue'),
  });

  const { data: upcomingMaintenance } = useQuery({
    queryKey: ['ca0114-upcoming'],
    queryFn: () => api.get('/ca0114/maintenance/upcoming?days=30'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const compliance = stats?.data || {
    temperature: { onTime: 0, total: 0 },
    cleaning: { onTime: 0, total: 0 },
    maintenance: { onTime: 0, total: 0 },
    calibrations: { onTime: 0, total: 0 },
  };

  const calculatePercentage = (metric) => {
    if (!metric.total) return 0;
    return Math.round((metric.onTime / metric.total) * 100);
  };

  const getStatusColor = (percentage) => {
    if (percentage >= 90) return 'bg-green-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const MetricCard = ({ title, metric, icon: Icon }) => {
    const percentage = calculatePercentage(metric);
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm">{title}</span>
          {Icon && <Icon className="w-5 h-5 text-gray-400" />}
        </div>
        <div className="text-3xl font-bold text-white mb-2">
          {percentage}%
        </div>
        <div className="text-sm text-gray-500">
          {metric.onTime} / {metric.total} registros a tiempo
        </div>
        <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${getStatusColor(percentage)} transition-all`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 rounded-lg p-4">
        <h2 className="text-xl font-bold text-white mb-4">
          Dashboard de Cumplimiento GXP
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard 
            title="Temperatura" 
            metric={compliance.temperature}
          />
          <MetricCard 
            title="Limpieza" 
            metric={compliance.cleaning}
          />
          <MetricCard 
            title="Mantenimiento" 
            metric={compliance.maintenance}
          />
          <MetricCard 
            title="Calibración" 
            metric={compliance.calibrations}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">
            Alarmas Pendientes
          </h3>
          {pendingAlarms?.data?.length > 0 ? (
            <div className="space-y-2">
              {pendingAlarms.data.slice(0, 5).map((alarm) => (
                <div key={alarm.id} className="flex items-center justify-between p-2 bg-red-900/30 rounded">
                  <div>
                    <div className="text-red-400 text-sm font-medium">
                      {alarm.alarmType}
                    </div>
                    <div className="text-gray-500 text-xs">
                      {alarm.deviceName} - {alarm.temperature}°C
                    </div>
                  </div>
                  <button className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded">
                    Reconocer
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-center py-4">
              Sin alarmas pendientes
            </div>
          )}
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">
            Calibraciones Vencidas
          </h3>
          {overdueCalibrations?.data?.length > 0 ? (
            <div className="space-y-2">
              {overdueCalibrations.data.slice(0, 5).map((eq) => (
                <div key={eq.id} className="flex items-center justify-between p-2 bg-yellow-900/30 rounded">
                  <div>
                    <div className="text-yellow-400 text-sm font-medium">
                      {eq.name}
                    </div>
                    <div className="text-gray-500 text-xs">
                      Vence: {eq.calibration_due_date}
                    </div>
                  </div>
                  <button className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded">
                    Programar
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-green-500 text-center py-4">
              Todas al día
            </div>
          )}
        </div>

        <div className="bg-gray-800 rounded-lg p-4 md:col-span-2">
          <h3 className="text-lg font-semibold text-white mb-3">
            Mantenimiento Próximo (30 días)
          </h3>
          {upcomingMaintenance?.data?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-2">Equipo</th>
                    <th className="text-left py-2">Tipo</th>
                    <th className="text-left py-2">Fecha</th>
                    <th className="text-left py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingMaintenance.data.slice(0, 10).map((m) => (
                    <tr key={m.id} className="border-b border-gray-700">
                      <td className="py-2 text-white">{m.equipment_name}</td>
                      <td className="py-2 text-gray-400">{m.maintenance_type}</td>
                      <td className="py-2 text-gray-400">{m.scheduled_date}</td>
                      <td className="py-2">
                        <span className="px-2 py-0.5 bg-blue-900 text-blue-400 rounded text-xs">
                          Programado
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-gray-500 text-center py-4">
              Sin mantenimientos programados
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComplianceDashboard;