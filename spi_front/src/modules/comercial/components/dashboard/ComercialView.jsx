import { useNavigate } from "react-router-dom";
import { FiClipboard, FiUsers, FiCheckSquare, FiFileText } from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";

import { DashboardHeader } from "../../../shared/components/DashboardComponents";
import PurchaseHandoffWidget from "../PurchaseHandoffWidget";

const ComercialView = () => {
    const navigate = useNavigate();

    return (
        <>
            <DashboardHeader
                title="Mi Gestión Comercial"
                subtitle="Panel de control para asesores comerciales"
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4 border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 rounded-md text-emerald-600">
                            <FiCheckSquare size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">Registro de asistencia</p>
                            <p className="text-xs text-gray-500">Disponible desde el menú</p>
                        </div>
                    </div>
                </Card>

                <Card
                    className="p-4 cursor-pointer hover:shadow-sm transition border border-gray-200"
                    onClick={() => navigate("/dashboard/comercial/clientes")}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-50 rounded-md text-green-600">
                            <FiUsers size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">Clientes</p>
                            <p className="text-xs text-gray-500">Gestión desde navegación</p>
                        </div>
                    </div>
                </Card>

                <Card
                    className="p-4 cursor-pointer hover:shadow-sm transition border border-gray-200"
                    onClick={() => navigate("/dashboard/comercial/solicitudes")}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-md text-blue-600">
                            <FiClipboard size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">Solicitudes</p>
                            <p className="text-xs text-gray-500">Módulo dedicado</p>
                        </div>
                    </div>
                </Card>

                <Card
                    className="p-4 cursor-pointer hover:shadow-sm transition border border-gray-200"
                    onClick={() => navigate("/dashboard/business-case")}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-50 rounded-md text-orange-600">
                            <FiFileText size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">Business Case</p>
                            <p className="text-xs text-gray-500">Inicia y completa tu caso</p>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="p-4 border border-gray-200">
                    <PurchaseHandoffWidget />
                </Card>
            </div>
        </>
    );
};

export default ComercialView;
