import React from 'react';
import { FiTruck, FiCheckSquare } from 'react-icons/fi';

const Section6Deliveries = ({ data, updateData }) => {
    const delData = data.deliveries;

    const handleChange = (field, value) => {
        updateData('deliveries', { [field]: value });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
                <FiTruck className="text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Entregas</h3>
                <p className="text-sm text-gray-500 ml-auto">Modalidad de entrega y determinaciÃ³n</p>
            </div>

            <div className="space-y-4">
                {/* Tipo de Entrega */}
                <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700">Tipo de Entrega *</label>

                    <div className="space-y-2">
                        <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                            <input
                                type="radio"
                                name="delivery_type"
                                value="total"
                                checked={delData.delivery_type === 'total'}
                                onChange={(e) => handleChange('delivery_type', e.target.value)}
                                className="w-4 h-4 text-blue-600"
                            />
                            <div>
                                <p className="font-medium text-gray-900">Total</p>
                                <p className="text-xs text-gray-500">Entrega completa en una sola vez</p>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                            <input
                                type="radio"
                                name="delivery_type"
                                value="partial_time"
                                checked={delData.delivery_type === 'partial_time'}
                                onChange={(e) => handleChange('delivery_type', e.target.value)}
                                className="w-4 h-4 text-blue-600"
                            />
                            <div>
                                <p className="font-medium text-gray-900">Parcial - Tiempo</p>
                                <p className="text-xs text-gray-500">Entregas parciales segÃºn cronograma definido</p>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                            <input
                                type="radio"
                                name="delivery_type"
                                value="partial_need"
                                checked={delData.delivery_type === 'partial_need'}
                                onChange={(e) => handleChange('delivery_type', e.target.value)}
                                className="w-4 h-4 text-blue-600"
                            />
                            <div>
                                <p className="font-medium text-gray-900">Parcial - A Necesidad</p>
                                <p className="text-xs text-gray-500">Entregas parciales segÃºn necesidad del laboratorio</p>
                            </div>
                        </label>
                    </div>
                </div>

                {/* DeterminaciÃ³n Efectiva */}
                <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={delData.effective_determination}
                            onChange={(e) => handleChange('effective_determination', e.target.checked)}
                            className="w-5 h-5 text-green-600"
                        />
                        <div>
                            <p className="font-medium text-green-900 flex items-center gap-2">
                                <FiCheckSquare /> DeterminaciÃ³n Efectiva
                            </p>
                            <p className="text-sm text-green-700">
                                Marcar si se requiere determinaciÃ³n efectiva para este Business Case
                            </p>
                        </div>
                    </label>
                </div>
            </div>

            {/* Resumen */}
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">Resumen de ConfiguraciÃ³n</h4>
                <div className="space-y-1 text-sm text-blue-800">
                    <p>
                        <strong>Tipo de Entrega:</strong>{' '}
                        {delData.delivery_type === 'total'
                            ? 'Total'
                            : delData.delivery_type === 'partial_time'
                                ? 'Parcial - Tiempo'
                                : 'Parcial - A Necesidad'}
                    </p>
                    <p>
                        <strong>DeterminaciÃ³n Efectiva:</strong> {delData.effective_determination ? 'SÃ­' : 'No'}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Section6Deliveries;

