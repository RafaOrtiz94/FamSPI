import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    FiCheckCircle, FiAlertTriangle, FiXCircle, FiClock,
    FiDollarSign, FiTrendingUp, FiCalendar, FiActivity,
    FiEdit, FiDownload
} from 'react-icons/fi';
import api from '../../../core/api';
import { useUI } from '../../../core/ui/UIContext';

const UnifiedBCView = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useUI();
    const [bc, setBc] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        loadBC();
    }, [id]);

    const loadBC = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/business-case/${id}/orchestrator/complete`);
            setBc(res.data.data);
        } catch (error) {
            showToast('Error cargando BC: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePromoteStage = async (newStage, notes) => {
        try {
            await api.post(`/business-case/${id}/orchestrator/promote-stage`, {
                stage: newStage,
                notes
            });
            showToast('Estado actualizado correctamente', 'success');
            await loadBC();
        } catch (error) {
            showToast('Error actualizando estado: ' + error.message, 'error');
        }
    };

    const handleRecalculate = async () => {
        try {
            const res = await api.post(`/business-case/${id}/orchestrator/recalculate`);
            showToast('BC recalculado correctamente', 'success');
            await loadBC();
        } catch (error) {
            showToast('Error recalculando: ' + error.message, 'error');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Cargando Business Case...</p>
                </div>
            </div>
        );
    }

    if (!bc) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800">No se pudo cargar el Business Case</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{bc.bc_number}</h1>
                        <p className="text-lg text-gray-600 mt-1">{bc.client_name}</p>
                        <p className="text-sm text-gray-500 mt-1">
                            {bc.bc_type === 'comodato_publico' ? 'Comodato Público' : 'Comodato Privado'}
                        </p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        <BCStatusBadge stage={bc.current_stage} />
                        {bc.risk_level && <BCRiskBadge level={bc.risk_level} />}
                    </div>
                </div>

                {/* Métricas Principales */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <MetricCard
                        icon={<FiTrendingUp />}
                        label="ROI"
                        value={bc.calculated_roi_percentage ? `${bc.calculated_roi_percentage.toFixed(2)}%` : 'N/A'}
                        subtitle={`Meta: ${bc.target_margin_percentage}%`}
                        status={bc.calculated_roi_percentage >= bc.target_margin_percentage ? 'success' : 'error'}
                    />
                    <MetricCard
                        icon={<FiClock />}
                        label="Payback"
                        value={bc.calculated_payback_months ? `${bc.calculated_payback_months.toFixed(1)} meses` : 'N/A'}
                    />
                    <MetricCard
                        icon={<FiDollarSign />}
                        label="Margen Anual"
                        value={bc.calculated_annual_margin ? `$${bc.calculated_annual_margin.toLocaleString()}` : 'N/A'}
                    />
                    <MetricCard
                        icon={<FiDollarSign />}
                        label="Inversión Total"
                        value={bc.total_investment ? `$${bc.total_investment.toLocaleString()}` : 'N/A'}
                    />
                </div>

                {/* Alertas de Validaciones */}
                {bc.validations && bc.validations.length > 0 && (
                    <div className="mt-4">
                        <ValidationAlerts validations={bc.validations} />
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-lg">
                <div className="border-b border-gray-200">
                    <nav className="flex gap-1 px-6" aria-label="Tabs">
                        <TabButton
                            active={activeTab === 'overview'}
                            onClick={() => setActiveTab('overview')}
                        >
                            Resumen
                        </TabButton>
                        <TabButton
                            active={activeTab === 'economic'}
                            onClick={() => setActiveTab('economic')}
                        >
                            Datos Económicos
                        </TabButton>
                        <TabButton
                            active={activeTab === 'operational'}
                            onClick={() => setActiveTab('operational')}
                        >
                            Datos Operativos
                        </TabButton>
                        <TabButton
                            active={activeTab === 'validations'}
                            onClick={() => setActiveTab('validations')}
                        >
                            Validaciones ({bc.validations?.length || 0})
                        </TabButton>
                        <TabButton
                            active={activeTab === 'workflow'}
                            onClick={() => setActiveTab('workflow')}
                        >
                            Historial
                        </TabButton>
                    </nav>
                </div>

                <div className="p-6">
                    {activeTab === 'overview' && <OverviewTab bc={bc} />}
                    {activeTab === 'economic' && <EconomicTab bc={bc} />}
                    {activeTab === 'operational' && <OperationalTab bc={bc} />}
                    {activeTab === 'validations' && <ValidationsTab validations={bc.validations} />}
                    {activeTab === 'workflow' && <WorkflowTab history={bc.workflowHistory} />}
                </div>
            </div>

            {/* Acciones */}
            <div className="mt-6 flex justify-between items-center">
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('/business-case')}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                        Volver a Lista
                    </button>
                    {bc.operational_data_complete && (
                        <button
                            onClick={handleRecalculate}
                            className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center gap-2"
                        >
                            <FiActivity /> Recalcular
                        </button>
                    )}
                </div>

                <div className="flex gap-3">
                    {bc.current_stage === 'pending_operational_data' && (
                        <button
                            onClick={() => navigate(`/business-case/${id}/manual-form`)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                        >
                            <FiEdit /> Completar Datos Operativos
                        </button>
                    )}

                    {bc.current_stage === 'pending_manager_approval' && (
                        <>
                            <button
                                onClick={() => handlePromoteStage('approved', 'Aprobado por gerencia')}
                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                            >
                                <FiCheckCircle /> Aprobar
                            </button>
                            <button
                                onClick={() => {
                                    const reason = prompt('Motivo del rechazo:');
                                    if (reason) handlePromoteStage('rejected', reason);
                                }}
                                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                            >
                                <FiXCircle /> Rechazar
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// ===== COMPONENTES AUXILIARES =====

const BCStatusBadge = ({ stage }) => {
    const statusConfig = {
        draft: { label: 'Borrador', color: 'gray', icon: FiEdit },
        pending_economic_approval: { label: 'Evaluación Económica', color: 'yellow', icon: FiClock },
        pending_operational_data: { label: 'Pendiente Datos Operativos', color: 'blue', icon: FiClock },
        pending_recalculation: { label: 'Recalculando', color: 'purple', icon: FiActivity },
        pending_technical_review: { label: 'Revisión Técnica', color: 'orange', icon: FiAlertTriangle },
        pending_manager_approval: { label: 'Aprobación Gerencial', color: 'indigo', icon: FiClock },
        approved: { label: 'Aprobado', color: 'green', icon: FiCheckCircle },
        rejected: { label: 'Rechazado', color: 'red', icon: FiXCircle }
    };

    const config = statusConfig[stage] || statusConfig.draft;
    const Icon = config.icon;

    const colorClasses = {
        gray: 'bg-gray-100 text-gray-800 border-gray-300',
        yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
        blue: 'bg-blue-100 text-blue-800 border-blue-300',
        purple: 'bg-purple-100 text-purple-800 border-purple-300',
        orange: 'bg-orange-100 text-orange-800 border-orange-300',
        indigo: 'bg-indigo-100 text-indigo-800 border-indigo-300',
        green: 'bg-green-100 text-green-800 border-green-300',
        red: 'bg-red-100 text-red-800 border-red-300'
    };

    return (
        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${colorClasses[config.color]}`}>
            <Icon className="w-4 h-4" />
            {config.label}
        </span>
    );
};

const BCRiskBadge = ({ level }) => {
    if (!level) return null;

    const riskConfig = {
        low: { label: 'Riesgo Bajo', color: 'bg-green-100 text-green-800 border-green-300' },
        medium: { label: 'Riesgo Medio', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
        high: { label: 'Riesgo Alto', color: 'bg-red-100 text-red-800 border-red-300' }
    };

    const config = riskConfig[level];

    return (
        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${config.color}`}>
            <FiAlertTriangle className="w-4 h-4" />
            {config.label}
        </span>
    );
};

const MetricCard = ({ icon, label, value, subtitle, status }) => {
    const statusColors = {
        success: 'border-green-500 bg-green-50',
        error: 'border-red-500 bg-red-50',
        default: 'border-gray-200 bg-white'
    };

    return (
        <div className={`p-4 rounded-lg border-2 ${statusColors[status || 'default']}`}>
            <div className="flex items-center gap-2 text-gray-600 mb-2">
                {icon}
                <span className="text-sm font-medium">{label}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
        </div>
    );
};

const TabButton = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${active
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
    >
        {children}
    </button>
);

const ValidationAlerts = ({ validations }) => {
    const errors = validations.filter(v => v.severity === 'error');
    const warnings = validations.filter(v => v.severity === 'warning');

    return (
        <div className="space-y-2">
            {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
                        <FiXCircle /> {errors.length} Error(es)
                    </div>
                    <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                        {errors.map((v, i) => <li key={i}>{v.message}</li>)}
                    </ul>
                </div>
            )}
            {warnings.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-yellow-800 font-medium mb-2">
                        <FiAlertTriangle /> {warnings.length} Advertencia(s)
                    </div>
                    <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                        {warnings.map((v, i) => <li key={i}>{v.message}</li>)}
                    </ul>
                </div>
            )}
        </div>
    );
};

// ===== TABS =====

const OverviewTab = ({ bc }) => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoSection title="Información General">
                <InfoRow label="Número BC" value={bc.bc_number} />
                <InfoRow label="Cliente" value={bc.client_name} />
                <InfoRow label="Tipo" value={bc.bc_type === 'comodato_publico' ? 'Comodato Público' : 'Comodato Privado'} />
                <InfoRow label="Duración" value={`${bc.duration_years} años`} />
                <InfoRow label="Margen Objetivo" value={`${bc.target_margin_percentage}%`} />
                {bc.process_code && <InfoRow label="Código Proceso" value={bc.process_code} />}
            </InfoSection>

            <InfoSection title="Completitud">
                <CompletionRow label="Datos Económicos" complete={bc.economic_data_complete} />
                <CompletionRow label="Datos Operativos" complete={bc.operational_data_complete} />
                <CompletionRow label="Datos LIS" complete={bc.lis_data_complete} />
                <CompletionRow label="Plan de Entregas" complete={bc.delivery_plan_complete} />
            </InfoSection>
        </div>

        {bc.economicData && (
            <InfoSection title="Equipo">
                <InfoRow label="Equipo" value={bc.economicData.equipment_name || 'No seleccionado'} />
                <InfoRow label="Costo" value={bc.economicData.equipment_cost ? `$${bc.economicData.equipment_cost.toLocaleString()}` : 'N/A'} />
            </InfoSection>
        )}
    </div>
);

const EconomicTab = ({ bc }) => (
    <div className="space-y-6">
        <InfoSection title="Métricas Calculadas">
            <InfoRow label="ROI" value={bc.calculated_roi_percentage ? `${bc.calculated_roi_percentage.toFixed(2)}%` : 'N/A'} />
            <InfoRow label="Payback" value={bc.calculated_payback_months ? `${bc.calculated_payback_months.toFixed(1)} meses` : 'N/A'} />
            <InfoRow label="Margen Mensual" value={bc.calculated_monthly_margin ? `$${bc.calculated_monthly_margin.toLocaleString()}` : 'N/A'} />
            <InfoRow label="Margen Anual" value={bc.calculated_annual_margin ? `$${bc.calculated_annual_margin.toLocaleString()}` : 'N/A'} />
            <InfoRow label="Ingreso Mensual" value={bc.calculated_monthly_revenue ? `$${bc.calculated_monthly_revenue.toLocaleString()}` : 'N/A'} />
            <InfoRow label="Ingreso Anual" value={bc.calculated_annual_revenue ? `$${bc.calculated_annual_revenue.toLocaleString()}` : 'N/A'} />
            <InfoRow label="Costo Mensual" value={bc.calculated_monthly_cost ? `$${bc.calculated_monthly_cost.toLocaleString()}` : 'N/A'} />
            <InfoRow label="Costo Anual" value={bc.calculated_annual_cost ? `$${bc.calculated_annual_cost.toLocaleString()}` : 'N/A'} />
        </InfoSection>

        {bc.determinations && bc.determinations.length > 0 && (
            <div>
                <h3 className="text-lg font-semibold mb-4">Determinaciones ({bc.determinations.length})</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Determinación</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cantidad Anual</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo Unitario</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo Total</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {bc.determinations.map((det, i) => (
                                <tr key={i}>
                                    <td className="px-4 py-3 text-sm text-gray-900">{det.determination_name}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{det.annual_quantity?.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right">${det.unit_cost?.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right">${(det.annual_quantity * det.unit_cost)?.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {bc.investments && bc.investments.length > 0 && (
            <div>
                <h3 className="text-lg font-semibold mb-4">Inversiones ({bc.investments.length})</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Concepto</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {bc.investments.map((inv, i) => (
                                <tr key={i}>
                                    <td className="px-4 py-3 text-sm text-gray-900">{inv.concept}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{inv.investment_type}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right">${inv.amount?.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
    </div>
);

const OperationalTab = ({ bc }) => {
    if (!bc.operationalData) {
        return (
            <div className="text-center py-8 text-gray-500">
                <p>No hay datos operativos registrados</p>
            </div>
        );
    }

    const op = bc.operationalData;

    return (
        <div className="space-y-6">
            <InfoSection title="Ambiente de Laboratorio">
                <InfoRow label="Días por semana" value={op.work_days_per_week} />
                <InfoRow label="Turnos por día" value={op.shifts_per_day} />
                <InfoRow label="Horas por turno" value={op.hours_per_shift} />
                <InfoRow label="Controles QC por turno" value={op.quality_controls_per_shift} />
                <InfoRow label="Niveles de control" value={op.control_levels} />
                <InfoRow label="Frecuencia QC rutina" value={op.routine_qc_frequency} />
                <InfoRow label="Frecuencia QC especiales" value={op.special_qc_frequency} />
            </InfoSection>

            <InfoSection title="Equipamiento">
                <InfoRow label="Estado equipo" value={op.equipment_status} />
                <InfoRow label="Estado propiedad" value={op.ownership_status} />
                <InfoRow label="Equipo backup" value={op.backup_equipment_name || 'N/A'} />
                <InfoRow label="Ubicación" value={op.installation_location} />
                <InfoRow label="Permite provisional" value={op.allows_provisional ? 'Sí' : 'No'} />
                <InfoRow label="Requiere complementario" value={op.requires_complementary ? 'Sí' : 'No'} />
            </InfoSection>

            <InfoSection title="Requerimientos y Entregas">
                <InfoRow label="Plazo (meses)" value={op.deadline_months} />
                <InfoRow label="Proyección plazo (meses)" value={op.projected_deadline_months} />
                <InfoRow label="Tipo de entrega" value={op.delivery_type} />
                <InfoRow label="Determinación efectiva" value={op.effective_determination ? 'Sí' : 'No'} />
            </InfoSection>

            {bc.lisData && bc.lisData.includes_lis && (
                <InfoSection title="LIS">
                    <InfoRow label="Proveedor" value={bc.lisData.lis_provider} />
                    <InfoRow label="Incluye hardware" value={bc.lisData.includes_hardware ? 'Sí' : 'No'} />
                    <InfoRow label="Pacientes mensuales" value={bc.lisData.monthly_patients} />
                    <InfoRow label="Sistema actual" value={bc.lisData.current_system_name} />
                </InfoSection>
            )}
        </div>
    );
};

const ValidationsTab = ({ validations }) => {
    if (!validations || validations.length === 0) {
        return (
            <div className="text-center py-8">
                <FiCheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <p className="text-gray-600">No hay validaciones pendientes</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {validations.map((val, i) => (
                <ValidationCard key={i} validation={val} />
            ))}
        </div>
    );
};

const ValidationCard = ({ validation }) => {
    const severityConfig = {
        error: { color: 'red', icon: FiXCircle, label: 'Error' },
        warning: { color: 'yellow', icon: FiAlertTriangle, label: 'Advertencia' },
        info: { color: 'blue', icon: FiActivity, label: 'Información' }
    };

    const config = severityConfig[validation.severity] || severityConfig.info;
    const Icon = config.icon;

    return (
        <div className={`border-l-4 border-${config.color}-500 bg-${config.color}-50 p-4 rounded-r-lg`}>
            <div className="flex items-start gap-3">
                <Icon className={`w-5 h-5 text-${config.color}-600 mt-0.5`} />
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-medium text-${config.color}-800`}>{config.label}</span>
                        <span className="text-xs text-gray-500">{validation.validation_type}</span>
                    </div>
                    <p className={`text-sm text-${config.color}-700`}>{validation.message}</p>
                    {validation.details && (
                        <pre className="mt-2 text-xs text-gray-600 bg-white p-2 rounded">
                            {JSON.stringify(validation.details, null, 2)}
                        </pre>
                    )}
                </div>
            </div>
        </div>
    );
};

const WorkflowTab = ({ history }) => {
    if (!history || history.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                <p>No hay historial de cambios</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {history.map((item, i) => (
                <div key={i} className="flex gap-4 pb-4 border-b last:border-0">
                    <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <FiActivity className="text-blue-600" />
                        </div>
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900">
                                {item.from_stage || 'Inicio'} → {item.to_stage}
                            </span>
                            <span className="text-xs text-gray-500">
                                {new Date(item.changed_at).toLocaleString()}
                            </span>
                        </div>
                        <p className="text-sm text-gray-600">{item.notes}</p>
                        <p className="text-xs text-gray-500 mt-1">Por: {item.changed_by}</p>
                    </div>
                </div>
            ))}
        </div>
    );
};

// Helper Components
const InfoSection = ({ title, children }) => (
    <div>
        <h3 className="text-lg font-semibold mb-4 text-gray-900">{title}</h3>
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            {children}
        </div>
    </div>
);

const InfoRow = ({ label, value }) => (
    <div className="flex justify-between items-center">
        <span className="text-sm text-gray-600">{label}:</span>
        <span className="text-sm font-medium text-gray-900">{value || 'N/A'}</span>
    </div>
);

const CompletionRow = ({ label, complete }) => (
    <div className="flex justify-between items-center">
        <span className="text-sm text-gray-600">{label}:</span>
        <span className={`text-sm font-medium flex items-center gap-1 ${complete ? 'text-green-600' : 'text-gray-400'}`}>
            {complete ? <><FiCheckCircle /> Completo</> : <>Pendiente</>}
        </span>
    </div>
);

export default UnifiedBCView;
