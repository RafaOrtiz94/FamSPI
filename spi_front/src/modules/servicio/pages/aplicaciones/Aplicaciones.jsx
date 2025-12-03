import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../../core/auth/AuthContext';
import { technicalApplicationsApi } from '../../../../core/api/technicalApplicationsApi';
import ApplicationActionCard from '../../components/aplicaciones/ApplicationActionCard';
import DisinfectionModal from '../../components/aplicaciones/DisinfectionModal';
import DocumentHistoryPanel from '../../components/aplicaciones/DocumentHistoryPanel';
import toast from 'react-hot-toast';

const AplicacionesPage = () => {
    const { user } = useAuth();
    const [availableDocuments, setAvailableDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeModal, setActiveModal] = useState(null);
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        loadAvailableDocuments();
    }, []);

    const loadAvailableDocuments = async () => {
        try {
            setLoading(true);
            const response = await technicalApplicationsApi.getAvailableDocuments();
            setAvailableDocuments(response.documents || []);
        } catch (error) {
            console.error('Error loading documents:', error);
            toast.error('Error al cargar documentos disponibles');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (documentType) => {
        setActiveModal(documentType);
    };

    const handleCloseModal = () => {
        setActiveModal(null);
    };

    const handleDocumentCreated = () => {
        toast.success('Documento generado exitosamente');
        handleCloseModal();
        // Opcionalmente recargar historial
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">
                        Aplicaciones Técnicas
                    </h1>
                    <p className="mt-2 text-sm text-gray-600">
                        Genera y gestiona documentos técnicos del área de servicio
                    </p>
                </div>

                {/* Tabs */}
                <div className="mb-6 border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                        <button
                            onClick={() => setShowHistory(false)}
                            className={`${!showHistory
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        >
                            Generar Documentos
                        </button>
                        <button
                            onClick={() => setShowHistory(true)}
                            className={`${showHistory
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        >
                            Historial
                        </button>
                    </nav>
                </div>

                {/* Content */}
                {!showHistory ? (
                    <div>
                        {loading ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                            </div>
                        ) : availableDocuments.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-gray-500">No hay documentos disponibles para tu rol</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {availableDocuments.map((doc) => (
                                    <ApplicationActionCard
                                        key={doc.type}
                                        title={doc.name}
                                        description={`Código: ${doc.code}`}
                                        icon={getIconForDocument(doc.type)}
                                        onClick={() => handleOpenModal(doc.type)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <DocumentHistoryPanel />
                )}
            </div>

            {/* Modals */}
            {activeModal === 'DISINFECTION' && (
                <DisinfectionModal
                    isOpen={true}
                    onClose={handleCloseModal}
                    onSuccess={handleDocumentCreated}
                />
            )}

            {/* Otros modales se agregarán aquí */}
        </div>
    );
};

/**
 * Helper function to get icon based on document type
 */
const getIconForDocument = (type) => {
    const iconMap = {
        DISINFECTION: '🧼',
        ENVIRONMENT_INSPECTION: '🏢',
        TRAINING_COORDINATION: '📅',
        TRAINING_ATTENDANCE: '✅',
        TRAINING_SATISFACTION: '📊',
        EQUIPMENT_EVALUATION: '⚙️',
        EQUIPMENT_VERIFICATION: '🔍',
        CONFORMITY_ACT: '📋',
        INSTALLATION_REPORT: '🔧',
        SERVICE_REPORT: '📝',
        ANNUAL_MAINTENANCE_SCHEDULE: '📆',
        MAINTENANCE_SCHEDULE: '🗓️',
        TRAINING_SCHEDULE: '📚',
    };
    return iconMap[type] || '📄';
};

export default AplicacionesPage;
