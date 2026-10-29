import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../core/api';

const TemperatureHeatMap = ({ area = 'CAMARA_FRIA', compact = false }) => {
  const [sessionId, setSessionId] = useState(null);
  const [mappingPoints, setMappingPoints] = useState([]);
  
  const { data: sessions, isLoading: loadingSessions } = useQuery({
    queryKey: ['ca01xx-mapping-sessions', area],
    queryFn: () => api.get(`/ca01xx/mapping/sessions?area=${area}`),
    enabled: !!area,
  });

  const { data: currentTemps, isLoading: loadingTemps } = useQuery({
    queryKey: ['ca01xx-current-temperatures'],
    queryFn: () => api.get('/ca01xx/devices/current'),
    refetchInterval: 600000, // >5min: deja hueco para que Neon autosuspenda entre polls
  });

  const startNewSession = async () => {
    try {
      const response = await api.post('/ca01xx/mapping/sessions', { area });
      setSessionId(response.data.id);
    } catch (error) {
      console.error('Error starting mapping session:', error);
    }
  };

  const getTempColor = (temp, min, max) => {
    if (temp < min) return 'bg-blue-500';
    if (temp > max) return 'bg-red-500';
    return 'bg-green-500';
  };

  const getStatus = (temp) => {
    const thresholds = {
      CAMARA_FRIA: { min: 2, max: 8 },
      REFRIGERADOR: { min: 2, max: 8 },
      CONGELADOR: { min: -25, max: -15 },
      BODEGA: { min: 15, max: 30 },
    };
    const { min, max } = thresholds[area] || thresholds.BODEGA;
    if (temp < min) return { label: 'Bajo', color: 'text-blue-400' };
    if (temp > max) return { label: 'Alto', color: 'text-red-400' };
    return { label: 'Normal', color: 'text-green-400' };
  };

  if (loadingSessions || loadingTemps) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const latestSession = sessions?.data?.[0];

  if (compact) {
    return (
      <div className="bg-gray-800 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">{area}</span>
          {currentTemps?.data?.[0] && (
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${getStatus(currentTemps.data[0].temperature).color}`}>
                {currentTemps.data[0].temperature?.toFixed(1)}°C
              </span>
              {currentTemps.data[0].isExcursion && (
                <span className="px-2 py-0.5 bg-red-600 text-white text-xs rounded">
                  EXCURSION
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          Mapa Térmico: {area}
        </h3>
        <button
          onClick={startNewSession}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
        >
          + Iniciar Mapeo
        </button>
      </div>

      {latestSession && (
        <div className="bg-gray-800 rounded p-3">
          <div className="grid grid-cols-4 gap-2 text-sm">
            <div>
              <span className="text-gray-400">Estado:</span>
              <span className="ml-2 text-white capitalize">
                {latestSession.status}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Mín:</span>
              <span className="ml-2 text-blue-400">
                {latestSession.min_temperature?.toFixed(1)}°C
              </span>
            </div>
            <div>
              <span className="text-gray-400">Máx:</span>
              <span className="ml-2 text-red-400">
                {latestSession.max_temperature?.toFixed(1)}°C
              </span>
            </div>
            <div>
              <span className="text-gray-400">Puntos:</span>
              <span className="ml-2 text-white">
                {latestSession.hot_spots?.length || 0} calor, {latestSession.cold_spots?.length || 0} frío
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {currentTemps?.data?.map((device) => (
          <div
            key={device.deviceId}
            className={`p-3 rounded-lg ${getTempColor(device.temperature, 
              device.thresholds?.min || 2, 
              device.thresholds?.max || 8
            )}`}
          >
            <div className="text-sm text-white opacity-90">{device.deviceName}</div>
            <div className="text-2xl font-bold text-white">
              {device.temperature?.toFixed(1)}°C
            </div>
            <div className="text-xs text-white opacity-75">
              {device.humidity ? `${device.humidity}% HR` : ''}
            </div>
            {device.isExcursion && (
              <div className="mt-2 px-2 py-1 bg-red-700 text-white text-xs text-center rounded">
                EXCURSION
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TemperatureHeatMap;