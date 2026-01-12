import React, { useState, useMemo } from 'react';
import { FiClock, FiCheckCircle, FiXCircle, FiAlertTriangle, FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * PurchaseTimelinePanel - Componente para visualizar el timeline completo de una compra privada
 * Incluye eventos, decisiones, correcciones y checklist computado
 */
const PurchaseTimelinePanel = ({ timelineData, compact = false }) => {
  const [expandedSections, setExpandedSections] = useState({});

  // Agrupar eventos por fecha
  const groupedEvents = useMemo(() => {
    if (!timelineData?.timeline) return {};

    const groups = {};
    timelineData.timeline.forEach(event => {
      const date = format(new Date(event.timestamp), 'yyyy-MM-dd');
      if (!groups[date]) groups[date] = [];
      groups[date].push(event);
    });

    // Ordenar fechas descendente
    return Object.keys(groups)
      .sort((a, b) => new Date(b) - new Date(a))
      .reduce((acc, date) => {
        acc[date] = groups[date].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return acc;
      }, {});
  }, [timelineData]);

  // Calcular checklist completitud
  const checklistStats = useMemo(() => {
    if (!timelineData?.checklist) return { total: 0, present: 0, percentage: 0 };

    const present = timelineData.checklist.filter(item => item.present).length;
    const total = timelineData.checklist.length;
    return {
      total,
      present,
      percentage: total > 0 ? Math.round((present / total) * 100) : 0
    };
  }, [timelineData]);

  const getEventIcon = (eventType) => {
    switch (eventType) {
      case 'client_registered':
      case 'client_approved':
        return <FiCheckCircle className="w-4 h-4 text-green-500" />;
      case 'offer_created':
      case 'offer_signed':
        return <FiCheckCircle className="w-4 h-4 text-blue-500" />;
      case 'contract_uploaded':
        return <FiCheckCircle className="w-4 h-4 text-purple-500" />;
      case 'correction_submitted':
        return <FiAlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'manager_decision':
        return event.includes('approved') ?
          <FiCheckCircle className="w-4 h-4 text-green-600" /> :
          <FiXCircle className="w-4 h-4 text-red-500" />;
      default:
        return <FiClock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    const statusColors = {
      'pending_commercial': 'bg-gray-100 text-gray-800',
      'client_approved': 'bg-green-100 text-green-800',
      'offer_sent': 'bg-blue-100 text-blue-800',
      'offer_signed': 'bg-blue-200 text-blue-900',
      'contract_approved_pending_upload': 'bg-purple-100 text-purple-800',
      'contract_rejected_needs_correction': 'bg-orange-100 text-orange-800',
      'pending_operations_schedule': 'bg-yellow-100 text-yellow-800',
      'awaiting_dispatch': 'bg-indigo-100 text-indigo-800',
      'delivered_pending_signatures': 'bg-teal-100 text-teal-800',
      'completed': 'bg-green-200 text-green-900'
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  if (!timelineData) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <p className="text-gray-500 text-sm">No hay datos de timeline disponibles</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Checklist Summary */}
      {!compact && (
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Documentos Requeridos</h3>
            <div className="flex items-center space-x-2">
              <div className="text-sm text-gray-600">
                {checklistStats.present}/{checklistStats.total} completos
              </div>
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                checklistStats.percentage === 100 ? 'bg-green-100 text-green-800' :
                checklistStats.percentage >= 75 ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {checklistStats.percentage}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {timelineData.checklist?.map((item, index) => (
              <div key={index} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                <div className={`w-2 h-2 rounded-full ${item.present ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className={`text-sm ${item.present ? 'text-gray-900' : 'text-gray-500'}`}>
                  {item.docType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Historial de Eventos</h3>
        </div>

        <div className="p-4 space-y-6">
          {Object.entries(groupedEvents).map(([date, events]) => (
            <div key={date} className="space-y-3">
              <div className="flex items-center space-x-2">
                <div className="text-sm font-medium text-gray-900">
                  {format(new Date(date), 'EEEE, dd/MM/yyyy', { locale: es })}
                </div>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <div className="space-y-2 ml-4">
                {events.map((event, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getEventIcon(event.event)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-900">
                          {event.event.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </p>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(event.status)}`}>
                          {event.status?.replace(/_/g, ' ') || 'N/A'}
                        </span>
                      </div>

                      <p className="text-sm text-gray-600 mt-1">
                        {event.details}
                      </p>

                      <p className="text-xs text-gray-400 mt-1">
                        {format(new Date(event.timestamp), 'HH:mm:ss')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Decisions Section */}
      {timelineData.decisions && timelineData.decisions.length > 0 && (
        <div className="bg-white rounded-lg border">
          <div
            className="p-4 border-b cursor-pointer flex items-center justify-between"
            onClick={() => toggleSection('decisions')}
          >
            <h3 className="text-lg font-semibold text-gray-900">Decisiones de Gerencia</h3>
            {expandedSections.decisions ?
              <FiChevronDown className="w-5 h-5 text-gray-500" /> :
              <FiChevronRight className="w-5 h-5 text-gray-500" />
            }
          </div>

          {expandedSections.decisions && (
            <div className="p-4 space-y-3">
              {timelineData.decisions.map((decision, index) => (
                <div key={index} className="border-l-4 border-gray-200 pl-4">
                  <div className="flex items-center space-x-2 mb-2">
                    {decision.decision === 'approved' ?
                      <FiCheckCircle className="w-4 h-4 text-green-500" /> :
                      <FiXCircle className="w-4 h-4 text-red-500" />
                    }
                    <span className="text-sm font-medium text-gray-900">
                      {decision.decision === 'approved' ? 'Aprobado' : 'Rechazado'}
                    </span>
                    <span className="text-sm text-gray-500">
                      por {decision.user}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600">{decision.reason}</p>

                  <p className="text-xs text-gray-400 mt-1">
                    {format(new Date(decision.timestamp), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Corrections Section */}
      {timelineData.corrections && timelineData.corrections.length > 0 && (
        <div className="bg-white rounded-lg border">
          <div
            className="p-4 border-b cursor-pointer flex items-center justify-between"
            onClick={() => toggleSection('corrections')}
          >
            <h3 className="text-lg font-semibold text-gray-900">Correcciones</h3>
            {expandedSections.corrections ?
              <FiChevronDown className="w-5 h-5 text-gray-500" /> :
              <FiChevronRight className="w-5 h-5 text-gray-500" />
            }
          </div>

          {expandedSections.corrections && (
            <div className="p-4 space-y-3">
              {timelineData.corrections.map((correction, index) => (
                <div key={index} className="border-l-4 border-orange-200 pl-4 bg-orange-50 p-3 rounded">
                  <div className="flex items-center space-x-2 mb-2">
                    <FiAlertTriangle className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-medium text-gray-900">
                      {correction.status === 'resolved' ? 'Resuelta' : 'Pendiente'}
                    </span>
                  </div>

                  <p className="text-sm text-gray-700 mb-2">{correction.reason}</p>

                  {correction.correction_details && (
                    <div className="text-sm text-gray-600 mb-2">
                      <strong>Detalles:</strong>
                      <ul className="list-disc list-inside mt-1">
                        {Object.entries(correction.correction_details).map(([key, value]) => (
                          <li key={key}>{key}: {String(value)}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="text-xs text-gray-400">
                    {format(new Date(correction.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PurchaseTimelinePanel;