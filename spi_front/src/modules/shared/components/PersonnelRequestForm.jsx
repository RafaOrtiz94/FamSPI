import React, { useState } from 'react';
import { FiX, FiSave, FiUser, FiBriefcase, FiFileText, FiDollarSign } from 'react-icons/fi';
import toast from 'react-hot-toast';
import Button from '../../../core/ui/components/Button';
import { createPersonnelRequest } from '../../../core/api/personnelRequestsApi';

const PersonnelRequestForm = ({ onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);

    const [formData, setFormData] = useState({
        // Información del puesto
        position_title: '',
        position_type: 'permanente',
        quantity: 1,
        start_date: '',
        end_date: '',

        // Perfil profesional
        education_level: '',
        career_field: '',
        years_experience: '',
        specific_skills: '',
        technical_knowledge: '',
        soft_skills: '',
        certifications: '',
        languages: '',

        // Responsabilidades
        main_responsibilities: '',
        specific_functions: '',
        reports_to: '',
        supervises: '',

        // Condiciones laborales
        work_schedule: '',
        salary_range: '',
        benefits: '',
        work_location: '',

        // Justificación
        justification: '',
        urgency_level: 'normal',
        priority: 3,
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validaciones básicas
        if (!formData.position_title || !formData.education_level || !formData.main_responsibilities || !formData.justification) {
            toast.error('Por favor completa todos los campos obligatorios');
            return;
        }

        setLoading(true);
        try {
            await createPersonnelRequest(formData);
            toast.success('Solicitud de personal creada exitosamente');
            onSuccess?.();
            onClose?.();
        } catch (error) {
            console.error('Error creando solicitud:', error);
            toast.error(error.response?.data?.message || 'Error al crear la solicitud');
        } finally {
            setLoading(false);
        }
    };

    const nextStep = () => {
        if (currentStep < 4) setCurrentStep(currentStep + 1);
    };

    const prevStep = () => {
        if (currentStep > 1) setCurrentStep(currentStep - 1);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Nueva Solicitud de Personal</h2>
                        <p className="text-sm text-gray-600 mt-1">Paso {currentStep} de 4</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <FiX size={24} />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="px-6 py-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                        {['Puesto', 'Perfil', 'Responsabilidades', 'Condiciones'].map((step, idx) => (
                            <div key={idx} className="flex items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${currentStep > idx + 1 ? 'bg-green-500 text-white' :
                                        currentStep === idx + 1 ? 'bg-blue-600 text-white' :
                                            'bg-gray-300 text-gray-600'
                                    }`}>
                                    {idx + 1}
                                </div>
                                <span className={`ml-2 text-sm ${currentStep === idx + 1 ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                                    {step}
                                </span>
                                {idx < 3 && <div className="w-12 h-1 bg-gray-300 mx-2" />}
                            </div>
                        ))}
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="px-6 py-6">
                        {/* Paso 1: Información del Puesto */}
                        {currentStep === 1 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <FiBriefcase className="text-blue-600" size={24} />
                                    <h3 className="text-lg font-semibold text-gray-900">Información del Puesto</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Título del Puesto <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="position_title"
                                            value={formData.position_title}
                                            onChange={handleChange}
                                            className="input-field"
                                            placeholder="Ej: Analista de Marketing Digital"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Tipo de Contratación <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            name="position_type"
                                            value={formData.position_type}
                                            onChange={handleChange}
                                            className="input-field"
                                            required
                                        >
                                            <option value="permanente">Permanente</option>
                                            <option value="temporal">Temporal</option>
                                            <option value="reemplazo">Reemplazo</option>
                                            <option value="proyecto">Por Proyecto</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Cantidad de Vacantes
                                        </label>
                                        <input
                                            type="number"
                                            name="quantity"
                                            value={formData.quantity}
                                            onChange={handleChange}
                                            className="input-field"
                                            min="1"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Fecha de Inicio Estimada
                                        </label>
                                        <input
                                            type="date"
                                            name="start_date"
                                            value={formData.start_date}
                                            onChange={handleChange}
                                            className="input-field"
                                        />
                                    </div>

                                    {formData.position_type === 'temporal' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Fecha de Fin Estimada
                                            </label>
                                            <input
                                                type="date"
                                                name="end_date"
                                                value={formData.end_date}
                                                onChange={handleChange}
                                                className="input-field"
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Nivel de Urgencia
                                        </label>
                                        <select
                                            name="urgency_level"
                                            value={formData.urgency_level}
                                            onChange={handleChange}
                                            className="input-field"
                                        >
                                            <option value="baja">Baja</option>
                                            <option value="normal">Normal</option>
                                            <option value="alta">Alta</option>
                                            <option value="urgente">Urgente</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Prioridad (1-5)
                                        </label>
                                        <input
                                            type="number"
                                            name="priority"
                                            value={formData.priority}
                                            onChange={handleChange}
                                            className="input-field"
                                            min="1"
                                            max="5"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Justificación de la Solicitud <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        name="justification"
                                        value={formData.justification}
                                        onChange={handleChange}
                                        className="input-field"
                                        rows="4"
                                        placeholder="Explica por qué es necesaria esta contratación..."
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        {/* Paso 2: Perfil Profesional */}
                        {currentStep === 2 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <FiUser className="text-blue-600" size={24} />
                                    <h3 className="text-lg font-semibold text-gray-900">Perfil Profesional Requerido</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Nivel de Educación <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            name="education_level"
                                            value={formData.education_level}
                                            onChange={handleChange}
                                            className="input-field"
                                            required
                                        >
                                            <option value="">Seleccionar...</option>
                                            <option value="Bachiller">Bachiller</option>
                                            <option value="Técnico">Técnico</option>
                                            <option value="Tecnólogo">Tecnólogo</option>
                                            <option value="Tercer Nivel">Tercer Nivel</option>
                                            <option value="Cuarto Nivel">Cuarto Nivel (Maestría)</option>
                                            <option value="Doctorado">Doctorado (PhD)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Campo de Estudio / Carrera
                                        </label>
                                        <input
                                            type="text"
                                            name="career_field"
                                            value={formData.career_field}
                                            onChange={handleChange}
                                            className="input-field"
                                            placeholder="Ej: Marketing, Ingeniería Industrial, etc."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Años de Experiencia Requeridos
                                        </label>
                                        <input
                                            type="number"
                                            name="years_experience"
                                            value={formData.years_experience}
                                            onChange={handleChange}
                                            className="input-field"
                                            min="0"
                                            placeholder="0"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Idiomas
                                        </label>
                                        <input
                                            type="text"
                                            name="languages"
                                            value={formData.languages}
                                            onChange={handleChange}
                                            className="input-field"
                                            placeholder="Ej: Español (nativo), Inglés (avanzado)"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Habilidades Específicas
                                        </label>
                                        <textarea
                                            name="specific_skills"
                                            value={formData.specific_skills}
                                            onChange={handleChange}
                                            className="input-field"
                                            rows="3"
                                            placeholder="Ej: Manejo de redes sociales, diseño gráfico, análisis de datos..."
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Conocimientos Técnicos
                                        </label>
                                        <textarea
                                            name="technical_knowledge"
                                            value={formData.technical_knowledge}
                                            onChange={handleChange}
                                            className="input-field"
                                            rows="3"
                                            placeholder="Ej: Excel avanzado, Power BI, SQL, Adobe Creative Suite..."
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Habilidades Blandas
                                        </label>
                                        <textarea
                                            name="soft_skills"
                                            value={formData.soft_skills}
                                            onChange={handleChange}
                                            className="input-field"
                                            rows="3"
                                            placeholder="Ej: Trabajo en equipo, liderazgo, comunicación efectiva..."
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Certificaciones
                                        </label>
                                        <textarea
                                            name="certifications"
                                            value={formData.certifications}
                                            onChange={handleChange}
                                            className="input-field"
                                            rows="2"
                                            placeholder="Ej: PMP, Google Analytics, Scrum Master..."
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Paso 3: Responsabilidades y Funciones */}
                        {currentStep === 3 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <FiFileText className="text-blue-600" size={24} />
                                    <h3 className="text-lg font-semibold text-gray-900">Responsabilidades y Funciones</h3>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Responsabilidades Principales <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        name="main_responsibilities"
                                        value={formData.main_responsibilities}
                                        onChange={handleChange}
                                        className="input-field"
                                        rows="5"
                                        placeholder="Describe las responsabilidades principales del puesto..."
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Funciones Específicas
                                    </label>
                                    <textarea
                                        name="specific_functions"
                                        value={formData.specific_functions}
                                        onChange={handleChange}
                                        className="input-field"
                                        rows="5"
                                        placeholder="Detalla las funciones específicas que realizará..."
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Reporta a
                                        </label>
                                        <input
                                            type="text"
                                            name="reports_to"
                                            value={formData.reports_to}
                                            onChange={handleChange}
                                            className="input-field"
                                            placeholder="Ej: Gerente de Marketing"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Supervisa a
                                        </label>
                                        <input
                                            type="text"
                                            name="supervises"
                                            value={formData.supervises}
                                            onChange={handleChange}
                                            className="input-field"
                                            placeholder="Ej: Asistentes de marketing (2)"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Paso 4: Condiciones Laborales */}
                        {currentStep === 4 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <FiDollarSign className="text-blue-600" size={24} />
                                    <h3 className="text-lg font-semibold text-gray-900">Condiciones Laborales</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Horario de Trabajo
                                        </label>
                                        <input
                                            type="text"
                                            name="work_schedule"
                                            value={formData.work_schedule}
                                            onChange={handleChange}
                                            className="input-field"
                                            placeholder="Ej: Lunes a Viernes 8:00-17:00"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Rango Salarial
                                        </label>
                                        <input
                                            type="text"
                                            name="salary_range"
                                            value={formData.salary_range}
                                            onChange={handleChange}
                                            className="input-field"
                                            placeholder="Ej: $800 - $1200"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Ubicación de Trabajo
                                        </label>
                                        <input
                                            type="text"
                                            name="work_location"
                                            value={formData.work_location}
                                            onChange={handleChange}
                                            className="input-field"
                                            placeholder="Ej: Oficina principal, Remoto, Híbrido"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Beneficios
                                        </label>
                                        <textarea
                                            name="benefits"
                                            value={formData.benefits}
                                            onChange={handleChange}
                                            className="input-field"
                                            rows="4"
                                            placeholder="Ej: Seguro médico, bonos por desempeño, capacitación continua..."
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer con botones */}
                    <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-between items-center">
                        <div>
                            {currentStep > 1 && (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={prevStep}
                                >
                                    Anterior
                                </Button>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={onClose}
                            >
                                Cancelar
                            </Button>

                            {currentStep < 4 ? (
                                <Button
                                    type="button"
                                    variant="primary"
                                    onClick={nextStep}
                                >
                                    Siguiente
                                </Button>
                            ) : (
                                <Button
                                    type="submit"
                                    variant="primary"
                                    icon={FiSave}
                                    disabled={loading}
                                >
                                    {loading ? 'Guardando...' : 'Crear Solicitud'}
                                </Button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PersonnelRequestForm;
