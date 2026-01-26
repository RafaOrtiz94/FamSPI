import React from "react";
import { motion } from "framer-motion";
import Card from "../../../../../core/ui/components/Card";
import EquipmentPurchaseWidget from "../../../../comercial/components/EquipmentPurchaseWidget";

export const RequestsSection = () => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            {/* Header de la sección */}
            <Card className="p-6 border-0 shadow-xl shadow-green-100/50 rounded-2xl bg-gradient-to-br from-green-50 via-green-100 to-green-200 border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-green-900">Solicitudes de Compras Públicas</h2>
                        <p className="text-green-700 mt-1">Gestión completa del proceso de adquisiciones ACP</p>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-green-600">
                            Gestión integral del proceso
                        </div>
                    </div>
                </div>
            </Card>

            {/* Lista de Solicitudes */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
            >
                <Card className="overflow-hidden rounded-[24px] border border-green-100 bg-white shadow-xl shadow-green-200/60">
                    <EquipmentPurchaseWidget showCreation={false} compactList />
                </Card>
            </motion.div>

            {/* Información adicional */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
                <Card className="p-4 border-0 shadow-lg shadow-green-100/50 rounded-xl bg-gradient-to-br from-green-50 to-green-100">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-700 mb-2">📋</div>
                        <h3 className="font-semibold text-green-900">Seguimiento</h3>
                        <p className="text-sm text-green-700">Estado en tiempo real</p>
                    </div>
                </Card>

                <Card className="p-4 border-0 shadow-lg shadow-green-100/50 rounded-xl bg-gradient-to-br from-green-50 to-green-100">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-700 mb-2">⚡</div>
                        <h3 className="font-semibold text-green-900">Acciones</h3>
                        <p className="text-sm text-green-700">Gestión directa</p>
                    </div>
                </Card>

                <Card className="p-4 border-0 shadow-lg shadow-green-100/50 rounded-xl bg-gradient-to-br from-green-50 to-green-100">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-700 mb-2">📊</div>
                        <h3 className="font-semibold text-green-900">Reportes</h3>
                        <p className="text-sm text-green-700">Análisis detallado</p>
                    </div>
                </Card>
            </motion.div>
        </motion.div>
    );
};
