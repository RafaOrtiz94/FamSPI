import React, { useState, useEffect } from "react";
import { FiSearch, FiPackage, FiTrendingUp, FiTrendingDown, FiAlertCircle } from "react-icons/fi";

import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { useUI } from "../../../core/ui/useUI";

const InventarioPage = () => {
    const { showToast } = useUI();
    const [items, setItems] = useState([]);
    const [query, setQuery] = useState("");

    // Datos de ejemplo - reemplazar con API real
    useEffect(() => {
        setItems([
            {
                id: 1,
                codigo: "EQ-001",
                nombre: "Laptop Dell Latitude",
                categoria: "Equipos",
                cantidad: 15,
                minimo: 5,
                ubicacion: "Bodega A",
                estado: "disponible",
            },
            {
                id: 2,
                codigo: "ACC-002",
                nombre: "Mouse Inalámbrico",
                categoria: "Accesorios",
                cantidad: 3,
                minimo: 10,
                ubicacion: "Bodega B",
                estado: "bajo",
            },
            {
                id: 3,
                codigo: "EQ-003",
                nombre: "Monitor LG 24\"",
                categoria: "Equipos",
                cantidad: 0,
                minimo: 5,
                ubicacion: "Bodega A",
                estado: "agotado",
            },
        ]);
    }, []);

    const filteredItems = items.filter(
        (item) =>
            item.nombre.toLowerCase().includes(query.toLowerCase()) ||
            item.codigo.toLowerCase().includes(query.toLowerCase()) ||
            item.categoria.toLowerCase().includes(query.toLowerCase())
    );

    const totalItems = items.reduce((sum, item) => sum + item.cantidad, 0);
    const itemsBajos = items.filter((item) => item.cantidad < item.minimo && item.cantidad > 0).length;
    const itemsAgotados = items.filter((item) => item.cantidad === 0).length;

    return (
        <div className="p-6 space-y-6">
            {/* HEADER */}
            <header className="flex flex-col md:flex-row justify-between items-center gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <FiPackage className="text-blue-600" /> Control de Inventario
                    </h1>
                    <p className="text-sm text-gray-500">
                        Gestiona el stock de equipos y materiales
                    </p>
                </div>
                <Button
                    variant="primary"
                    onClick={() => showToast("Función en desarrollo", "info")}
                >
                    Registrar Movimiento
                </Button>
            </header>

            {/* BUSCADOR */}
            <Card className="p-5">
                <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, código o categoría..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </Card>

            {/* ESTADÍSTICAS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Total Items</p>
                            <p className="text-2xl font-bold text-gray-900">{totalItems}</p>
                        </div>
                        <FiPackage className="text-3xl text-blue-600" />
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Disponibles</p>
                            <p className="text-2xl font-bold text-green-600">
                                {items.filter((i) => i.estado === "disponible").length}
                            </p>
                        </div>
                        <FiTrendingUp className="text-3xl text-green-600" />
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Stock Bajo</p>
                            <p className="text-2xl font-bold text-amber-600">{itemsBajos}</p>
                        </div>
                        <FiTrendingDown className="text-3xl text-amber-600" />
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Agotados</p>
                            <p className="text-2xl font-bold text-red-600">{itemsAgotados}</p>
                        </div>
                        <FiAlertCircle className="text-3xl text-red-600" />
                    </div>
                </Card>
            </div>

            {/* TABLA DE INVENTARIO */}
            <Card className="p-5">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-gray-200">
                            <tr>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                    Código
                                </th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                    Nombre
                                </th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                    Categoría
                                </th>
                                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                                    Cantidad
                                </th>
                                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                                    Mínimo
                                </th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                    Ubicación
                                </th>
                                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                                    Estado
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.length > 0 ? (
                                filteredItems.map((item) => (
                                    <tr
                                        key={item.id}
                                        className="border-b border-gray-100 hover:bg-gray-50"
                                    >
                                        <td className="py-3 px-4 text-sm font-mono text-gray-700">
                                            {item.codigo}
                                        </td>
                                        <td className="py-3 px-4">
                                            <p className="font-semibold text-gray-900">{item.nombre}</p>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-700">
                                            {item.categoria}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span
                                                className={`font-bold ${item.cantidad === 0
                                                        ? "text-red-600"
                                                        : item.cantidad < item.minimo
                                                            ? "text-amber-600"
                                                            : "text-green-600"
                                                    }`}
                                            >
                                                {item.cantidad}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center text-sm text-gray-500">
                                            {item.minimo}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-700">
                                            {item.ubicacion}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span
                                                className={`text-xs px-2 py-1 rounded-full ${item.estado === "disponible"
                                                        ? "bg-green-100 text-green-700"
                                                        : item.estado === "bajo"
                                                            ? "bg-amber-100 text-amber-700"
                                                            : "bg-red-100 text-red-700"
                                                    }`}
                                            >
                                                {item.estado}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="7" className="py-10 text-center text-gray-500">
                                        No se encontraron items
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* ALERTAS */}
            {(itemsBajos > 0 || itemsAgotados > 0) && (
                <Card className="p-5 bg-amber-50 border-amber-200">
                    <div className="flex items-start gap-3">
                        <FiAlertCircle className="text-amber-600 text-xl mt-1" />
                        <div>
                            <h3 className="font-semibold text-amber-900 mb-1">
                                Alertas de Inventario
                            </h3>
                            <ul className="text-sm text-amber-800 space-y-1">
                                {itemsAgotados > 0 && (
                                    <li>• {itemsAgotados} item(s) agotado(s)</li>
                                )}
                                {itemsBajos > 0 && (
                                    <li>• {itemsBajos} item(s) con stock bajo</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
};

export default InventarioPage;
