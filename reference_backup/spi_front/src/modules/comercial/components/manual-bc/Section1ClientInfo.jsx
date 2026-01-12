import React, { useState, useEffect } from 'react';
import { FiUser, FiFileText } from 'react-icons/fi';
import api from '../../../../core/api';

const Section1ClientInfo = ({ data, updateData, bcType }) => {
    const [clients, setClients] = useState([]);
    const [loadingClients, setLoadingClients] = useState(false);

    useEffect(() => {
        const fetchClients = async () => {
            setLoadingClients(true);
            try {
                const res = await api.get('/clients');
                const payload = res.data?.data ?? res.data;
                const parsedClients = Array.isArray(payload?.items)
                    ? payload.items
                    : Array.isArray(payload?.clients)
                        ? payload.clients
                        : Array.isArray(payload)
                            ? payload
                            : [];
                setClients(parsedClients);
            } catch (err) {
                console.warn('No se pudieron cargar clientes', err.message);
            } finally {
                setLoadingClients(false);
            }
        };
        fetchClients();
    }, []);

    const formatClientLabel = (client) =>
        client?.nombre ||
        client?.commercial_name ||
        client?.name ||
        client?.display_name ||
        client?.email ||
        'Cliente';

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
                <FiUser className="text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Información del Cliente</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cliente */}
                <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-gray-700">Cliente *</span>
                    <select
                        value={data.clientId || ''}
                        onChange={(e) => {
                            const selectedClient = clients.find(c => String(c.id) === e.target.value);
                            updateData('root', {
                                clientId: selectedClient?.id,
                                clientName: formatClientLabel(selectedClient)
                            });
                        }}
                        className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Selecciona un cliente</option>
                        {clients.map((client) => (
                            <option key={client.id} value={client.id}>
                                {formatClientLabel(client)}
                            </option>
                        ))}
                    </select>
                    {loadingClients && <p className="text-xs text-gray-400">Cargando clientes...</p>}
                </label>

                {/* Tipo de Comodato */}
                <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-gray-700">Tipo de Comodato *</span>
                    <select
                        value={data.bcType}
                        onChange={(e) => updateData('root', { bcType: e.target.value })}
                        className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="comodato_publico">Comodato Público (Licitación)</option>
                        <option value="comodato_privado">Comodato Privado</option>
                    </select>
                </label>
            </div>

            {/* Campos específicos para Comodato Público */}
            {data.bcType === 'comodato_publico' && (
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 space-y-4">
                    <div className="flex items-center gap-2 text-blue-900">
                        <FiFileText />
                        <h4 className="font-semibold">Información de Licitación</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="flex flex-col gap-1">
                            <span className="text-sm font-medium text-blue-900">Código del Proceso</span>
                            <input
                                type="text"
                                value={data.processCode}
                                onChange={(e) => updateData('root', { processCode: e.target.value })}
                                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: LP-001-2024"
                            />
                        </label>

                        <label className="flex flex-col gap-1 md:col-span-2">
                            <span className="text-sm font-medium text-blue-900">Objeto de Contratación</span>
                            <textarea
                                rows={3}
                                value={data.contractObject}
                                onChange={(e) => updateData('root', { contractObject: e.target.value })}
                                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                                placeholder="Descripción del objeto de contratación..."
                            />
                        </label>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Section1ClientInfo;
