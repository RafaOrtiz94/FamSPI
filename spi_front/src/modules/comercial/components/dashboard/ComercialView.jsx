import { useNavigate } from "react-router-dom";
import { FiList, FiUsers, FiPackage } from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";

import { DashboardHeader, SectionTitle } from "../../../shared/components/DashboardComponents";
import PurchaseHandoffWidget from "../PurchaseHandoffWidget";

const ComercialView = () => {
    const navigate = useNavigate();

    return (
        <>
            <DashboardHeader
                title="Mi Gestión Comercial"
                subtitle="Panel de control para asesores comerciales"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card
                    className="p-6 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-green-500"
                    onClick={() => navigate("/dashboard/comercial/clientes")}
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-full text-green-600">
                            <FiUsers size={24} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Mis Clientes</h3>
                            <p className="text-sm text-gray-500">Gestionar cartera</p>
                        </div>
                    </div>
                </Card>

                <Card
                    className="p-6 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-purple-500"
                    onClick={() => navigate("/dashboard/comercial/inventario")}
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-100 rounded-full text-purple-600">
                            <FiPackage size={24} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Consultar Stock</h3>
                            <p className="text-sm text-gray-500">Ver disponibilidad</p>
                        </div>
                    </div>
                </Card>

                <Card
                    className="p-6 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-blue-500"
                    onClick={() => navigate("/dashboard/comercial/solicitudes")}
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-full text-blue-600">
                            <FiList size={24} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Solicitudes</h3>
                            <p className="text-sm text-gray-500">Gestiona y crea solicitudes</p>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                <Card className="p-5 h-full lg:col-span-2">
                    <SectionTitle
                        title="Gestiona las solicitudes desde su sección dedicada"
                        action={
                            <button
                                onClick={() => navigate("/dashboard/comercial/solicitudes")}
                                className="text-sm text-blue-600 hover:underline"
                            >
                                Ir a Solicitudes
                            </button>
                        }
                    />
                    <p className="text-sm text-gray-600 mt-2">
                        Consulta, crea y administra todas las solicitudes directamente desde el menú
                        "Solicitudes" en la barra de navegación.
                    </p>
                </Card>

                <div className="lg:col-span-1">
                    <Card className="p-5 h-full">
                        <SectionTitle title="Nueva solicitud de compra" />
                        <PurchaseHandoffWidget />
                    </Card>
                </div>
            </div>
        </>
    );
};

export default ComercialView;
