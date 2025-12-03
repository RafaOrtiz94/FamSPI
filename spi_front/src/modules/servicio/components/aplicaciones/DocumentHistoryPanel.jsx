import React, { useState, useEffect } from 'react';
import { technicalApplicationsApi } from '../../../../core/api/technicalApplicationsApi';
import toast from 'react-hot-toast';

const DocumentHistoryPanel = () => {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        myDocuments: false,
        documentType: '',
        equipmentName: '',
    });

    useEffect(() => {
        loadDocuments();
    }, [filters]);

    const loadDocuments = async () => {
        try {
            setLoading(true);
            const response = await technicalApplicationsApi.getDocumentHistory(filters);
            setDocuments(response.documents || []);
        } catch (error) {
            console.error('Error loading documents:', error);
            toast.error('Error al cargar historial');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('es-EC', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white shadow rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={filters.myDocuments}
                                onChange={(e) => setFilters({ ...filters, myDocuments: e.target.checked })}
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">Solo mis documentos</span>
                        </label>
                    </div>

                    <div>
                        <input
                            type="text"
                            placeholder="Buscar por equipo..."
                            value={filters.equipmentName}
                            onChange={(e) => setFilters({ ...filters, equipmentName: e.target.value })}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                    </div>
                ) : documents.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-gray-500">No se encontraron documentos</p>
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Tipo
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Equipo
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Serie
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Creado por
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Fecha
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {documents.map((doc) => (
                                <tr key={doc.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {doc.document_code}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {doc.equipment_name || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {doc.equipment_serial || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {doc.user_name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {formatDate(doc.created_at)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600">
                                        <a
                                            href={`https://drive.google.com/file/d/${doc.drive_file_id}/view`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:text-indigo-900"
                                        >
                                            Ver en Drive
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default DocumentHistoryPanel;
