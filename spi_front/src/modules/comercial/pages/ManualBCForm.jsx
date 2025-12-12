import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiCheckCircle } from 'react-icons/fi';
import api from '../../../core/api';
import { useUI } from '../../../core/ui/UIContext';
import Section1ClientInfo from '../components/manual-bc/Section1ClientInfo';
import Section2LabEnvironment from '../components/manual-bc/Section2LabEnvironment';
import Section3Equipment from '../components/manual-bc/Section3Equipment';
import Section4LIS from '../components/manual-bc/Section4LIS';
import Section5Requirements from '../components/manual-bc/Section5Requirements';
import Section6Deliveries from '../components/manual-bc/Section6Deliveries';

const ManualBCForm = () => {
    const navigate = useNavigate();
    const { showToast, showLoader, hideLoader } = useUI();

    const [formData, setFormData] = useState({
        // Cliente
        clientId: null,
        bcType: 'comodato_publico',
        processCode: '',
        contractObject: '',

        // Lab Environment
        labEnvironment: {
            work_days_per_week: 5,
            shifts_per_day: 1,
            hours_per_shift: 8,
            quality_controls_per_shift: 2,
            control_levels: 2,
            routine_qc_frequency: 'Diaria',
            special_tests: '',
            special_qc_frequency: ''
        },

        // Equipment Details
        equipmentDetails: {
            equipmentId: null,
            equipment_status: 'new',
            ownership_status: 'new',
            reservation_image_url: '',
            backup_equipment_name: '',
            backup_status: '',
            backup_manufacture_year: null,
            install_with_primary: false,
            installation_location: '',
            allows_provisional: false,
            requires_complementary: false,
            complementary_test_purpose: ''
        },

        // LIS Integration
        lisIntegration: {
            includes_lis: false,
            lis_provider: 'orion',
            includes_hardware: false,
            monthly_patients: 0,
            current_system_name: '',
            current_system_provider: '',
            current_system_hardware: false,
            equipmentInterfaces: []
        },

        // Requirements
        requirements: {
            deadline_months: 12,
            projected_deadline_months: 12
        },

        // Deliveries
        deliveries: {
            delivery_type: 'total',
            effective_determination: false
        }
    });

    const [businessCaseId, setBusinessCaseId] = useState(null);
    const [currentSection, setCurrentSection] = useState(1);

    const updateFormData = (section, data) => {
        setFormData(prev => ({
            ...prev,
            [section]: { ...prev[section], ...data }
        }));
    };

    const handleSaveComplete = async () => {
        showLoader();
        try {
            // 1. Create BC base
            const bcPayload = {
                client_name: formData.clientName || 'Cliente',
                client_id: formData.clientId,
                bc_purchase_type: formData.bcType,
                process_code: formData.processCode,
                contract_object: formData.contractObject,
                bc_duration_years: 3,
                bc_target_margin_percentage: 25,
                bc_calculation_mode: 'annual',
                bc_show_roi: true,
                bc_show_margin: true,
                status: 'draft'
            };

            const bcRes = await api.post('/business-case', bcPayload);
            const bcId = bcRes.data?.id || bcRes.data?.data?.id;

            if (!bcId) {
                throw new Error('No se recibió el ID del Business Case');
            }

            setBusinessCaseId(bcId);

            // 2. Save all sections
            await Promise.all([
                api.post(`/business-case/${bcId}/lab-environment`, formData.labEnvironment),
                api.post(`/business-case/${bcId}/equipment-details`, formData.equipmentDetails),
                api.post(`/business-case/${bcId}/lis-integration`, formData.lisIntegration),
                api.post(`/business-case/${bcId}/requirements`, formData.requirements),
                api.post(`/business-case/${bcId}/deliveries`, formData.deliveries)
            ]);

            // 3. Save LIS equipment interfaces if any
            if (formData.lisIntegration.equipmentInterfaces.length > 0) {
                for (const iface of formData.lisIntegration.equipmentInterfaces) {
                    await api.post(`/business-case/${bcId}/lis-integration/equipment-interfaces`, iface);
                }
            }

            showToast('Business Case creado exitosamente', 'success');
            navigate('/comercial/business-cases');
        } catch (error) {
            console.error('Error saving BC:', error);
            showToast(error.response?.data?.message || 'Error al guardar el Business Case', 'error');
        } finally {
            hideLoader();
        }
    };

    const sections = [
        { id: 1, title: 'Información del Cliente', component: Section1ClientInfo },
        { id: 2, title: 'Ambiente de Laboratorio', component: Section2LabEnvironment },
        { id: 3, title: 'Equipamiento', component: Section3Equipment },
        { id: 4, title: 'LIS', component: Section4LIS },
        { id: 5, title: 'Requerimientos', component: Section5Requirements },
        { id: 6, title: 'Entregas', component: Section6Deliveries }
    ];

    const CurrentSectionComponent = sections[currentSection - 1].component;

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Formulario Manual de Business Case</h1>
                <p className="text-sm text-gray-500">Complete todas las secciones para crear un BC detallado</p>
            </div>

            {/* Progress Stepper */}
            <div className="mb-8 flex items-center justify-between overflow-x-auto pb-2">
                {sections.map((section, idx) => (
                    <div key={section.id} className="flex items-center">
                        <button
                            onClick={() => setCurrentSection(section.id)}
                            className={`flex flex-col items-center min-w-[100px] ${currentSection === section.id ? 'text-blue-600' : 'text-gray-400'
                                }`}
                        >
                            <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 mb-2 ${currentSection === section.id
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white border-gray-300'
                                    }`}
                            >
                                {section.id}
                            </div>
                            <span className="text-xs text-center">{section.title}</span>
                        </button>
                        {idx < sections.length - 1 && (
                            <div className="h-px w-12 bg-gray-200 mx-2 mt-[-20px]" />
                        )}
                    </div>
                ))}
            </div>

            {/* Current Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <CurrentSectionComponent
                    data={formData}
                    updateData={updateFormData}
                    bcType={formData.bcType}
                />
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center">
                <button
                    onClick={() => setCurrentSection(Math.max(1, currentSection - 1))}
                    disabled={currentSection === 1}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    Anterior
                </button>

                <div className="flex gap-2">
                    {currentSection < sections.length ? (
                        <button
                            onClick={() => setCurrentSection(Math.min(sections.length, currentSection + 1))}
                            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                        >
                            Siguiente
                        </button>
                    ) : (
                        <button
                            onClick={handleSaveComplete}
                            className="inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
                        >
                            <FiCheckCircle /> Guardar Business Case Completo
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ManualBCForm;
