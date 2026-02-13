/**
 * PrivatePurchasesRoleView
 *
 * Componente para mostrar solicitudes de compra privada según rol del usuario.
 * Proporciona vista unificada para todos los roles del workflow.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useUI } from '../../../core/ui/useUI';
import Button from '../../../core/ui/components/Button';
import { formatDateEC } from '../../../core/utils/dateUtils';
import {
    getPrivatePurchasesByRole,
    getPrivatePurchaseStats,
    getPrivatePurchaseDocuments,
    transitionPrivatePurchaseState,
    requestDeliveryDates,
    markReadyForDelivery,
    completeDelivery,
    formatPrivatePurchaseState,
    getStateColor,
    checkClientApproval,
    uploadPrivatePurchaseContract,
    uploadPrivateSignedOffer,
    PRIVATE_PURCHASE_STATES
} from '../../../core/api/privatePurchasesApi';
import { usePurchaseSSE } from '../../../core/hooks/usePurchaseSSE';

const PrivatePurchasesRoleView = ({ role, title }) => {
    const { showToast } = useUI();
    const [purchases, setPurchases] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [transitioning, setTransitioning] = useState(null);
    const [clientApprovalStatuses, setClientApprovalStatuses] = useState({});
    const [offerDocs, setOfferDocs] = useState({});

    // Cargar datos iniciales
    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [purchasesData, statsData] = await Promise.all([
                getPrivatePurchasesByRole(role),
                getPrivatePurchaseStats(role)
            ]);

            setPurchases(purchasesData);
            setStats(statsData);
        } catch (error) {
            console.error('Error cargando datos:', error);
            showToast('Error cargando solicitudes', 'error');
        } finally {
            setLoading(false);
        }
    }, [role, showToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    usePurchaseSSE({
        type: 'private',
        debounceMs: 8000,
        onEvent: loadData
    });

    // Consultar estado de aprobación de clientes para backoffice_comercial
    useEffect(() => {
        if (role === 'backoffice_comercial') {
            console.log('[FRONTEND_CLIENT_APPROVAL] Iniciando consulta automática para backoffice_comercial');

            const checkClientApprovals = async () => {
                console.log('[FRONTEND_CLIENT_APPROVAL] Ejecutando consulta automática, purchases:', purchases.length);

                for (const purchase of purchases) {
                    console.log(`[FRONTEND_CLIENT_APPROVAL] Verificando purchase ${purchase.id}, cliente:`, purchase.client_snapshot?.name || 'sin nombre');

                    if (!clientApprovalStatuses[purchase.id]) {
                        try {
                            console.log(`[FRONTEND_CLIENT_APPROVAL] Consultando aprobación para purchase ${purchase.id}`);
                            const approvalStatus = await checkClientApproval(purchase.id);
                            console.log(`[FRONTEND_CLIENT_APPROVAL] Respuesta para purchase ${purchase.id}:`, approvalStatus);

                            setClientApprovalStatuses(prev => ({
                                ...prev,
                                [purchase.id]: approvalStatus
                            }));

                            console.log(`[FRONTEND_CLIENT_APPROVAL] Estado actualizado para purchase ${purchase.id}:`, approvalStatus.isApproved ? 'APROBADO' : 'PENDIENTE');
                        } catch (error) {
                            console.error(`[FRONTEND_CLIENT_APPROVAL] Error consultando aprobación para ${purchase.id}:`, error);
                        }
                    } else {
                        console.log(`[FRONTEND_CLIENT_APPROVAL] Purchase ${purchase.id} ya tiene estado cacheado:`, clientApprovalStatuses[purchase.id].isApproved ? 'APROBADO' : 'PENDIENTE');
                    }
                }
            };

            if (purchases.length > 0) {
                console.log('[FRONTEND_CLIENT_APPROVAL] Iniciando primera consulta');
                checkClientApprovals();

                // Consultar cada 30 segundos para actualizaciones en tiempo real
                console.log('[FRONTEND_CLIENT_APPROVAL] Configurando intervalo de 30 segundos');
                const interval = setInterval(() => {
                    console.log('[FRONTEND_CLIENT_APPROVAL] Ejecutando consulta por intervalo');
                    checkClientApprovals();
                }, 30000);
                return () => {
                    console.log('[FRONTEND_CLIENT_APPROVAL] Limpiando intervalo');
                    clearInterval(interval);
                };
            }
        }
    }, [role, purchases, clientApprovalStatuses]);

    const loadOfferDocument = async (purchaseId) => {
        if (offerDocs[purchaseId]) return;
        try {
            const docs = await getPrivatePurchaseDocuments(purchaseId);
            const offer = Array.isArray(docs) ? docs.find((doc) => doc.doc_type === 'OFFER') : null;
            setOfferDocs((prev) => ({
                ...prev,
                [purchaseId]: offer || null
            }));
        } catch (error) {
            console.error('Error cargando documento de oferta:', error);
        }
    };

    // Acciones disponibles según rol
    const getAvailableActions = (purchase) => {
        const actions = [];

        switch (role) {
            case 'asesor_comercial':
            case 'comercial':
                if (purchase.status === PRIVATE_PURCHASE_STATES.PENDING_COMMERCIAL) {
                    actions.push({
                        label: 'Enviar a BackOffice',
                        action: () => handleTransition(purchase.id, PRIVATE_PURCHASE_STATES.PENDING_BACKOFFICE),
                        variant: 'primary'
                    });
                }
                if (purchase.status === PRIVATE_PURCHASE_STATES.OFFER_SENT ||
                    purchase.status === PRIVATE_PURCHASE_STATES.PENDING_CLIENT_SIGNATURE) {
                    actions.push({
                        label: 'Subir oferta firmada',
                        action: () => handleUploadSignedOffer(purchase.id),
                        variant: 'primary'
                    });
                }
                break;

            case 'backoffice_comercial':
                if (purchase.status === PRIVATE_PURCHASE_STATES.PENDING_BACKOFFICE) {
                    actions.push({
                        label: 'Enviar Oferta',
                        action: () => handleTransition(purchase.id, PRIVATE_PURCHASE_STATES.OFFER_SENT),
                        variant: 'primary'
                    });
                }
                if (purchase.status === PRIVATE_PURCHASE_STATES.CONTRACT_REJECTED) {
                    actions.push({
                        label: 'Reenviar Contrato',
                        action: () => handleTransition(purchase.id, PRIVATE_PURCHASE_STATES.PENDING_CONTRACT_CLIENT_SIGNATURE),
                        variant: 'primary'
                    });
                }

                // Nueva lógica: permitir subir contrato cuando cliente esté aprobado
                const clientApproval = clientApprovalStatuses[purchase.id];
                if (clientApproval && clientApproval.isApproved &&
                    purchase.status === PRIVATE_PURCHASE_STATES.INSPECTION_REQUESTED) {
                    actions.push({
                        label: 'Subir Contrato',
                        action: () => handleUploadContract(purchase.id),
                        variant: 'primary'
                    });
                }
                break;

            case 'gerencia_general':
                if (purchase.status === PRIVATE_PURCHASE_STATES.PENDING_CONTRACT_APPROVAL) {
                    actions.push({
                        label: 'Rechazar',
                        action: () => handleRejectContract(purchase.id),
                        variant: 'danger'
                    });
                }
                break;

            case 'jefe_operaciones':
                if (purchase.status === PRIVATE_PURCHASE_STATES.CONTRACT_AVAILABLE) {
                    actions.push({
                        label: 'Solicitar Fechas',
                        action: () => handleRequestDeliveryDates(purchase.id),
                        variant: 'primary'
                    });
                }
                break;

            case 'jefe_logistica':
                if (purchase.status === PRIVATE_PURCHASE_STATES.WAITING_DISPATCH) {
                    actions.push({
                        label: 'Marcar Listo',
                        action: () => handleMarkReadyForDelivery(purchase.id),
                        variant: 'success'
                    });
                }
                if (purchase.status === PRIVATE_PURCHASE_STATES.DISPATCH_READY) {
                    actions.push({
                        label: 'Completar Entrega',
                        action: () => handleCompleteDelivery(purchase.id),
                        variant: 'primary'
                    });
                }
                break;
        }

        return actions;
    };

    const handleTransition = async (purchaseId, toState, reason = '') => {
        try {
            setTransitioning(purchaseId);
            await transitionPrivatePurchaseState(purchaseId, toState, reason);
            showToast('Estado actualizado correctamente', 'success');
            await loadData(); // Recargar datos
        } catch (error) {
            console.error('Error cambiando estado:', error);
            showToast(error.message || 'Error cambiando estado', 'error');
        } finally {
            setTransitioning(null);
        }
    };

    const handleRejectContract = async (purchaseId) => {
        const reason = window.prompt('Motivo de rechazo (obligatorio):');
        if (!reason) {
            showToast('Debes ingresar un motivo de rechazo', 'error');
            return;
        }
        await handleTransition(purchaseId, PRIVATE_PURCHASE_STATES.CONTRACT_REJECTED, reason);
    };

    const handleRequestDeliveryDates = async (purchaseId) => {
        try {
            setTransitioning(purchaseId);
            await requestDeliveryDates(purchaseId);
            showToast('Solicitud de fechas enviada', 'success');
            await loadData();
        } catch (error) {
            console.error('Error solicitando fechas:', error);
            showToast(error.message || 'Error solicitando fechas', 'error');
        } finally {
            setTransitioning(null);
        }
    };

    const handleMarkReadyForDelivery = async (purchaseId) => {
        try {
            setTransitioning(purchaseId);
            await markReadyForDelivery(purchaseId);
            showToast('Despacho marcado como listo', 'success');
            await loadData();
        } catch (error) {
            console.error('Error marcando despacho listo:', error);
            showToast(error.message || 'Error marcando despacho listo', 'error');
        } finally {
            setTransitioning(null);
        }
    };

    const handleCompleteDelivery = async (purchaseId) => {
        try {
            setTransitioning(purchaseId);
            await completeDelivery(purchaseId);
            showToast('Entrega completada', 'success');
            await loadData();
        } catch (error) {
            console.error('Error completando entrega:', error);
            showToast(error.message || 'Error completando entrega', 'error');
        } finally {
            setTransitioning(null);
        }
    };

    const handleUploadContract = async (purchaseId) => {
        // Crear un input de tipo file oculto
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,.doc,.docx';
        input.style.display = 'none';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                setTransitioning(purchaseId);

                // Convertir archivo a base64
                const base64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });

                // Subir contrato
                await uploadPrivatePurchaseContract(purchaseId, {
                    contract_base64: base64,
                    file_name: file.name,
                    mime_type: file.type,
                    reason: 'Contrato subido por backoffice tras aprobación del cliente'
                });

                showToast('Contrato subido correctamente', 'success');
                await loadData();
            } catch (error) {
                console.error('Error subiendo contrato:', error);
                showToast(error.message || 'Error subiendo contrato', 'error');
            } finally {
                setTransitioning(null);
                // Limpiar el input
                input.remove();
            }
        };

        // Agregar al DOM y hacer click
        document.body.appendChild(input);
        input.click();
    };

    const handleUploadSignedOffer = async (purchaseId) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,.png,.jpg,.jpeg';
        input.style.display = 'none';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                setTransitioning(purchaseId);
                const base64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });

                await uploadPrivateSignedOffer(purchaseId, {
                    signed_offer_base64: base64,
                    file_name: file.name,
                    mime_type: file.type || 'application/pdf'
                });

                showToast('Oferta firmada subida correctamente', 'success');
                await loadData();
            } catch (error) {
                console.error('Error subiendo oferta firmada:', error);
                showToast(error.message || 'Error subiendo oferta firmada', 'error');
            } finally {
                setTransitioning(null);
                input.remove();
            }
        };

        document.body.appendChild(input);
        input.click();
    };

    // Estadísticas calculadas
    const priorityCount = useMemo(() => {
        return purchases.filter(p =>
            p.status === PRIVATE_PURCHASE_STATES.PENDING_CONTRACT_APPROVAL ||
            p.status === PRIVATE_PURCHASE_STATES.DELIVERY_DATES_REQUESTED ||
            p.status === PRIVATE_PURCHASE_STATES.WAITING_DISPATCH
        ).length;
    }, [purchases]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header con estadísticas */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={loadData}
                        disabled={loading}
                    >
                        Actualizar
                    </Button>
                </div>

                {/* Estadísticas rápidas */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{stats.total || 0}</div>
                        <div className="text-sm text-gray-600">Total</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">{priorityCount}</div>
                        <div className="text-sm text-gray-600">Prioridad Alta</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{stats.last_week || 0}</div>
                        <div className="text-sm text-gray-600">Esta Semana</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                            {purchases.filter(p => p.offer_kind === 'comodato').length}
                        </div>
                        <div className="text-sm text-gray-600">Comodatos</div>
                    </div>
                </div>
            </div>

            {/* Lista de solicitudes */}
            <div className="bg-white rounded-lg shadow-sm border">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Solicitudes Activas</h3>
                </div>

                <div className="divide-y divide-gray-200">
                    {purchases.length === 0 ? (
                        <div className="px-6 py-8 text-center text-gray-500">
                            No hay solicitudes activas para este rol
                        </div>
                    ) : (
                        purchases.map((purchase) => {
                            const clientData = purchase.client_snapshot || {};
                            const actions = getAvailableActions(purchase);

                            return (
                                <div key={purchase.id} className="px-6 py-4 hover:bg-gray-50">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-3 mb-2">
                                                <h4 className="text-sm font-medium text-gray-900">
                                                    {clientData.name || 'Cliente sin nombre'}
                                                </h4>
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStateColor(purchase.status)}`}>
                                                    {formatPrivatePurchaseState(purchase.status)}
                                                </span>
                                                {purchase.offer_kind === 'comodato' && (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                        Comodato
                                                    </span>
                                                )}
                                            </div>

                                            <div className="text-sm text-gray-600 mb-2">
                                                <div>ID: {purchase.id.slice(0, 8)}...</div>
                                                <div>Creado: {formatDateEC(purchase.created_at, 'Sin fecha')}</div>
                                                {purchase.equipment && (
                                                    <div>Equipos: {JSON.parse(purchase.equipment || '[]').length}</div>
                                                )}
                                                {/* Mostrar estado de aprobación del cliente para backoffice_comercial */}
                                                {role === 'backoffice_comercial' && clientApprovalStatuses[purchase.id] && (
                                                    <div className={`font-medium ${clientApprovalStatuses[purchase.id].isApproved ? 'text-green-600' : 'text-orange-600'}`}>
                                                        Cliente: {clientApprovalStatuses[purchase.id].isApproved ? 'Aprobado' : 'Pendiente aprobación'}
                                                    </div>
                                                )}
                                            </div>

                                            {purchase.notes && (
                                                <div className="text-sm text-gray-500 italic">
                                                    "{purchase.notes}"
                                                </div>
                                            )}

                                            {(role === 'asesor_comercial' || role === 'comercial') &&
                                                (purchase.status === PRIVATE_PURCHASE_STATES.OFFER_SENT ||
                                                 purchase.status === PRIVATE_PURCHASE_STATES.PENDING_CLIENT_SIGNATURE) && (
                                                <div className="mt-2 text-sm">
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => loadOfferDocument(purchase.id)}
                                                        disabled={transitioning === purchase.id}
                                                    >
                                                        Ver oferta enviada
                                                    </Button>
                                                    {offerDocs[purchase.id]?.link && (
                                                        <a
                                                            className="ml-3 text-blue-600 text-sm underline"
                                                            href={offerDocs[purchase.id].link}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                        >
                                                            Abrir oferta
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex space-x-2 ml-4">
                                            {actions.map((action, index) => (
                                                <Button
                                                    key={index}
                                                    size="sm"
                                                    variant={action.variant}
                                                    onClick={action.action}
                                                    disabled={transitioning === purchase.id}
                                                    loading={transitioning === purchase.id}
                                                >
                                                    {action.label}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default PrivatePurchasesRoleView;
