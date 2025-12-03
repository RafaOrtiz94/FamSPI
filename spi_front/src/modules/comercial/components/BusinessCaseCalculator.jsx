import React, { useState, useEffect } from 'react';
import { catalogsApi } from '../../../core/api/catalogsApi';
import { businessCaseApi } from '../../../core/api/businessCaseApi';
import {
    BeakerIcon,
    CalculatorIcon,
    CurrencyDollarIcon,
    ArrowPathIcon,
    CheckCircleIcon
} from '@heroicons/react/24/outline';

const BusinessCaseCalculator = () => {
    // Estados
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [equipments, setEquipments] = useState([]);
    const [selectedEquipment, setSelectedEquipment] = useState(null);
    const [determinations, setDeterminations] = useState([]);
    const [selectedDeterminations, setSelectedDeterminations] = useState({}); // { id: { ...det, volume: 0 } }
    const [results, setResults] = useState(null);

    // Cargar equipos al inicio
    useEffect(() => {
        loadEquipments();
    }, []);

    const loadEquipments = async () => {
        try {
            setLoading(true);
            const data = await catalogsApi.getEquipment({ status: 'active' });
            setEquipments(data);
        } catch (error) {
            console.error('Error loading equipment:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEquipmentSelect = async (equipment) => {
        setSelectedEquipment(equipment);
        try {
            setLoading(true);
            const data = await catalogsApi.getDeterminationsByEquipment(equipment.id);
            setDeterminations(data);
            setStep(2);
        } catch (error) {
            console.error('Error loading determinations:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleDetermination = (det) => {
        setSelectedDeterminations(prev => {
            const next = { ...prev };
            if (next[det.id]) {
                delete next[det.id];
            } else {
                next[det.id] = { ...det, annualVolume: 0 };
            }
            return next;
        });
    };

    const updateVolume = (id, volume) => {
        setSelectedDeterminations(prev => ({
            ...prev,
            [id]: { ...prev[id], annualVolume: parseInt(volume) || 0 }
        }));
    };

    const handleCalculate = async () => {
        try {
            setLoading(true);
            const items = Object.values(selectedDeterminations).map(d => ({
                determinationId: d.id,
                annualVolume: d.annualVolume
            }));

            const data = await businessCaseApi.calculate(items);
            setResults(data);
            setStep(3);
        } catch (error) {
            console.error('Error calculating:', error);
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setStep(1);
        setSelectedEquipment(null);
        setSelectedDeterminations({});
        setResults(null);
    };

    // Renderizadores de pasos
    const renderStep1 = () => (
        <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">1. Selecciona un Equipo</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {equipments.map(eq => (
                    <button
                        key={eq.id}
                        onClick={() => handleEquipmentSelect(eq)}
                        className="p-4 border rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-colors text-left group"
                    >
                        <div className="font-semibold text-gray-900 group-hover:text-indigo-700">{eq.name}</div>
                        <div className="text-sm text-gray-500">{eq.manufacturer} - {eq.model}</div>
                    </button>
                ))}
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">2. Configura Determinaciones</h3>
                <button onClick={reset} className="text-sm text-gray-500 hover:text-gray-700">
                    Cambiar equipo
                </button>
            </div>

            <div className="bg-white border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                                Seleccionar
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Determinación
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Volumen Anual Estimado
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {determinations.map(det => {
                            const isSelected = !!selectedDeterminations[det.id];
                            return (
                                <tr key={det.id} className={isSelected ? 'bg-indigo-50' : ''}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleDetermination(det)}
                                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                        />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{det.name}</div>
                                        <div className="text-sm text-gray-500">{det.roche_code}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <input
                                            type="number"
                                            disabled={!isSelected}
                                            value={selectedDeterminations[det.id]?.annualVolume || ''}
                                            onChange={(e) => updateVolume(det.id, e.target.value)}
                                            placeholder="Ej: 5000"
                                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md disabled:bg-gray-100"
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handleCalculate}
                    disabled={Object.keys(selectedDeterminations).length === 0}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                    <CalculatorIcon className="h-5 w-5 mr-2" />
                    Calcular Business Case
                </button>
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">3. Resultados del Cálculo</h3>
                <button onClick={() => setStep(2)} className="text-sm text-indigo-600 hover:text-indigo-800">
                    ← Ajustar volúmenes
                </button>
            </div>

            {/* Resumen Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <BeakerIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Total Determinaciones</dt>
                                    <dd className="text-lg font-medium text-gray-900">{results.details.length}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <CheckCircleIcon className="h-6 w-6 text-green-400" aria-hidden="true" />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Total Kits Requeridos</dt>
                                    <dd className="text-lg font-medium text-gray-900">{results.summary.total_kits}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <CurrencyDollarIcon className="h-6 w-6 text-yellow-400" aria-hidden="true" />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Costo Estimado Anual</dt>
                                    <dd className="text-lg font-medium text-gray-900">
                                        ${results.summary.total_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detalle por Determinación */}
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Detalle de Materiales</h3>
                    <p className="mt-1 max-w-2xl text-sm text-gray-500">Desglose de reactivos, calibradores y controles.</p>
                </div>
                <div className="border-t border-gray-200">
                    <ul className="divide-y divide-gray-200">
                        {results.details.map((det, idx) => (
                            <li key={idx} className="px-4 py-4 sm:px-6">
                                <div className="mb-2">
                                    <h4 className="text-md font-bold text-gray-900">{det.determination.name}</h4>
                                    <p className="text-sm text-gray-500">Volumen: {det.determination.annual_volume.toLocaleString()}</p>
                                </div>

                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Kits</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Costo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {det.consumables.map((cons, cIdx) => (
                                            <tr key={cIdx}>
                                                <td className="px-3 py-2 text-sm text-gray-900">{cons.name}</td>
                                                <td className="px-3 py-2 text-sm text-gray-500 capitalize">{cons.type}</td>
                                                <td className="px-3 py-2 text-sm text-gray-900 text-right">{cons.kits_required}</td>
                                                <td className="px-3 py-2 text-sm text-gray-900 text-right">
                                                    ${cons.total_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );

    return (
        <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
                <div className="mb-8">
                    <nav aria-label="Progress">
                        <ol className="flex items-center">
                            <li className={`relative pr-8 sm:pr-20 ${step >= 1 ? 'text-indigo-600' : 'text-gray-400'}`}>
                                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                    <div className="h-0.5 w-full bg-gray-200" />
                                </div>
                                <a href="#" className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white border-2 border-current hover:border-indigo-600">
                                    <span className="h-2.5 w-2.5 rounded-full bg-current" aria-hidden="true" />
                                    <span className="sr-only">Paso 1</span>
                                </a>
                            </li>
                            <li className={`relative pr-8 sm:pr-20 ${step >= 2 ? 'text-indigo-600' : 'text-gray-400'}`}>
                                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                    <div className="h-0.5 w-full bg-gray-200" />
                                </div>
                                <a href="#" className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white border-2 border-current hover:border-indigo-600">
                                    <span className="h-2.5 w-2.5 rounded-full bg-current" aria-hidden="true" />
                                    <span className="sr-only">Paso 2</span>
                                </a>
                            </li>
                            <li className={`relative ${step >= 3 ? 'text-indigo-600' : 'text-gray-400'}`}>
                                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                    <div className="h-0.5 w-full bg-gray-200" />
                                </div>
                                <a href="#" className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white border-2 border-current hover:border-indigo-600">
                                    <span className="h-2.5 w-2.5 rounded-full bg-current" aria-hidden="true" />
                                    <span className="sr-only">Paso 3</span>
                                </a>
                            </li>
                        </ol>
                    </nav>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <ArrowPathIcon className="h-8 w-8 text-indigo-600 animate-spin" />
                    </div>
                ) : (
                    <>
                        {step === 1 && renderStep1()}
                        {step === 2 && renderStep2()}
                        {step === 3 && renderStep3()}
                    </>
                )}
            </div>
        </div>
    );
};

export default BusinessCaseCalculator;
