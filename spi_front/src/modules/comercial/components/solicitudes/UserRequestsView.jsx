import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  FiPlus,
  FiEye,
  FiRefreshCw
} from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import { useAuth } from "../../../../core/auth/useAuth";
import { getRequests, getMyClientRequests } from "../../../../core/api/requestsApi";
import { useUI } from "../../../../core/ui/UIContext";

// Importar configuraciones centralizadas
import { REQUEST_TYPES_CONFIG, getStatusColor, getStatusIcon, formatDate } from '../../config/requestConfig';

/**
 * Componente que muestra las solicitudes del usuario organizadas por tipo
 */
const UserRequestsView = ({ onCreateNew }) => {
  const { user } = useAuth();
  const { showToast } = useUI();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [clientRequests, setClientRequests] = useState([]);

  // Cargar solicitudes del usuario
  useEffect(() => {
    const loadUserRequests = async () => {
      setLoading(true);
      try {
        // Cargar solicitudes generales del usuario
        const generalRequests = await getRequests({ mine: true, pageSize: 100 });
        setRequests(generalRequests.rows || []);

        // Cargar solicitudes de clientes del usuario
        const clientReqs = await getMyClientRequests({ pageSize: 100 });
        setClientRequests(clientReqs.rows || clientReqs || []);
      } catch (error) {
        console.error("Error cargando solicitudes:", error);
        showToast("Error al cargar las solicitudes", "error");
      } finally {
        setLoading(false);
      }
    };

    loadUserRequests();
  }, [showToast]);

  // Determinar configuración basada en el rol del usuario
  const roleConfig = useMemo(() => {
    const roleName = (user?.role_name || user?.role || "").toLowerCase();
    const isACP = roleName.includes('acp');

    const baseActions = ["cliente", "compra", "permisos"];
    const acpActions = ["cliente", "compra", "permisos"];
    const fullActions = ["inspection", "retiro", ...baseActions];

    const availableActionIds = isACP ? acpActions : fullActions;

    return {
      isACP,
      availableTypes: availableActionIds
    };
  }, [user]);

  // Organizar solicitudes por tipo
  const requestsByType = useMemo(() => {
    const organized = {
      cliente: [],
      compra: [],
      inspection: [],
      retiro: [],
      permisos: []
    };

    // Procesar solicitudes de clientes
    clientRequests.forEach(request => {
      organized.cliente.push({
        id: request.id,
        type: 'cliente',
        title: request.client_name || request.commercial_name || 'Cliente',
        status: request.status,
        created_at: request.created_at,
        description: `Registro de cliente: ${request.client_name || request.commercial_name}`,
        data: request
      });
    });

    // Procesar solicitudes generales
    requests.forEach(request => {
      let type = 'compra'; // default
      let title = 'Solicitud';
      let description = '';

      // Determinar tipo basado en el request_type_id o payload
      if (request.request_type_id) {
        switch (request.request_type_id) {
          case 'cliente':
            type = 'cliente';
            title = 'Registro de Cliente';
            break;
          case 'compra':
            type = 'compra';
            title = 'Requerimiento de Compra';
            break;
          case 'inspection':
            type = 'inspection';
            title = 'Inspección Técnica';
            break;
          case 'retiro':
            type = 'retiro';
            title = 'Retiro de Equipo';
            break;
          default:
            type = 'compra';
        }
      }

      // Extraer información del payload si existe
      if (request.payload) {
        let payload = request.payload;
        if (typeof payload === 'string') {
          try {
            payload = JSON.parse(payload);
          } catch (e) {
            payload = {};
          }
        }

        if (payload.nombre_cliente || payload.client_name) {
          description = `Cliente: ${payload.nombre_cliente || payload.client_name}`;
        }
      }

      organized[type].push({
        id: request.id,
        type,
        title,
        status: request.status,
        created_at: request.created_at,
        description,
        data: request
      });
    });

    return organized;
  }, [requests, clientRequests]);



  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3">
          <FiRefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="text-gray-600">Cargando tus solicitudes...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Resumen general */}
      <Card className="p-6 border-0 shadow-xl shadow-slate-100/60 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Resumen de Solicitudes</h3>
            <p className="text-slate-600 mt-1">Estado de tus gestiones por tipo</p>
          </div>
        </div>

        <div className={`grid gap-4 ${
          roleConfig.availableTypes.length === 3 ? 'grid-cols-1 md:grid-cols-3' :
          roleConfig.availableTypes.length === 5 ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5' :
          'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'
        }`}>
          {Object.entries(REQUEST_TYPES_CONFIG)
            .filter(([type]) => roleConfig.availableTypes.includes(type))
            .map(([type, config]) => {
            const requestsOfType = requestsByType[type] || [];
            const Icon = config.icon;

            return (
              <div key={type} className="text-center">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-2 ${
                  config.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' :
                  config.color === 'indigo' ? 'bg-indigo-100 text-indigo-600' :
                  config.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                  config.color === 'amber' ? 'bg-amber-100 text-amber-600' :
                  'bg-orange-100 text-orange-600'
                }`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="text-2xl font-bold text-slate-900">{requestsOfType.length}</div>
                <div className="text-xs text-slate-600">{config.title.split(' ')[0]}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Solicitudes por tipo */}
      {Object.entries(REQUEST_TYPES_CONFIG)
        .filter(([type]) => roleConfig.availableTypes.includes(type))
        .map(([type, config]) => {
        const requestsOfType = requestsByType[type] || [];
        const Icon = config.icon;

        return (
          <Card key={type} className="border-0 shadow-xl shadow-slate-100/60 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    config.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' :
                    config.color === 'indigo' ? 'bg-indigo-100 text-indigo-600' :
                    config.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                    config.color === 'amber' ? 'bg-amber-100 text-amber-600' :
                    'bg-orange-100 text-orange-600'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{config.title}</h3>
                    <p className="text-sm text-slate-600">{requestsOfType.length} solicitudes</p>
                  </div>
                </div>

                <Button
                  onClick={() => onCreateNew && onCreateNew(type)}
                  className="flex items-center gap-2"
                  size="sm"
                >
                  <FiPlus className="w-4 h-4" />
                  Nueva
                </Button>
              </div>
            </div>

            <div className="p-6">
              {requestsOfType.length === 0 ? (
                <div className="text-center py-8">
                  <Icon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">{config.emptyMessage}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {requestsOfType.slice(0, 5).map((request) => (
                    <motion.div
                      key={request.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer group"
                      onClick={() => {
                        // Aquí iría la lógica para ver el detalle
                        console.log('Ver detalle de solicitud:', request);
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="font-semibold text-slate-900 truncate">
                            {request.title}
                          </h4>
                          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                            {getStatusIcon(request.status)}
                            {request.status || 'Pendiente'}
                          </div>
                        </div>
                        {request.description && (
                          <p className="text-sm text-slate-600 truncate mb-1">
                            {request.description}
                          </p>
                        )}
                        <p className="text-xs text-slate-500">
                          {formatDate(request.created_at)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="ghost">
                          <FiEye className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}

                  {requestsOfType.length > 5 && (
                    <div className="text-center pt-2">
                      <Button variant="ghost" size="sm">
                        Ver todas ({requestsOfType.length})
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default UserRequestsView;
