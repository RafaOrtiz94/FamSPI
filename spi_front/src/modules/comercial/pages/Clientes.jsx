import React, { useState, useEffect } from "react";
import { FiSearch, FiPlus, FiEdit2, FiTrash2, FiUser } from "react-icons/fi";

import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { useUI } from "../../../core/ui/useUI";

const ClientesPage = () => {
    const { showToast } = useUI();
    const [clientes, setClientes] = useState([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);

    // Datos de ejemplo - reemplazar con API real
    useEffect(() => {
        setClientes([
            {
                id: 1,
                nombre: "Empresa ABC S.A.",
                contacto: "Juan Pérez",
                email: "juan@empresaabc.com",
                telefono: "0999123456",
                direccion: "Av. Principal 123",
                estado: "activo",
            },
            {
                id: 2,
                nombre: "Corporación XYZ",
                contacto: "María González",
                email: "maria@xyz.com",
                telefono: "0987654321",
                direccion: "Calle Secundaria 456",
                estado: "activo",
            },
        ]);
    }, []);

    const filteredClientes = clientes.filter(
        (c) =>
            c.nombre.toLowerCase().includes(query.toLowerCase()) ||
            c.contacto.toLowerCase().includes(query.toLowerCase()) ||
            c.email.toLowerCase().includes(query.toLowerCase())
    );

    return (
        <div className="p-6 space-y-6">
            {/* HEADER */}
            <header className="flex flex-col md:flex-row justify-between items-center gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <FiUser className="text-blue-600" /> Gestión de Clientes
                    </h1>
                    <p className="text-sm text-gray-500">
                        Administra la información de tus clientes
                    </p>
                </div>
                <Button
                    variant="primary"
                    icon={FiPlus}
                    onClick={() => showToast("Función en desarrollo", "info")}
                >
                    Nuevo Cliente
                </Button>
            </header>

            {/* BUSCADOR */}
            <Card className="p-5">
                <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, contacto o email..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </Card>

            {/* ESTADÍSTICAS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 text-center">
                    <p className="text-sm text-gray-500">Total Clientes</p>
                    <p className="text-2xl font-bold text-gray-900">{clientes.length}</p>
                </Card>
                <Card className="p-4 text-center">
                    <p className="text-sm text-gray-500">Activos</p>
                    <p className="text-2xl font-bold text-green-600">
                        {clientes.filter((c) => c.estado === "activo").length}
                    </p>
                </Card>
                <Card className="p-4 text-center">
                    <p className="text-sm text-gray-500">Nuevos (mes)</p>
                    <p className="text-2xl font-bold text-blue-600">0</p>
                </Card>
                <Card className="p-4 text-center">
                    <p className="text-sm text-gray-500">Inactivos</p>
                    <p className="text-2xl font-bold text-gray-400">
                        {clientes.filter((c) => c.estado === "inactivo").length}
                    </p>
                </Card>
            </div>

            {/* TABLA DE CLIENTES */}
            <Card className="p-5">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-gray-200">
                            <tr>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                    Cliente
                                </th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                    Contacto
                                </th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                    Email
                                </th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                    Teléfono
                                </th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                    Estado
                                </th>
                                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredClientes.length > 0 ? (
                                filteredClientes.map((cliente) => (
                                    <tr
                                        key={cliente.id}
                                        className="border-b border-gray-100 hover:bg-gray-50"
                                    >
                                        <td className="py-3 px-4">
                                            <p className="font-semibold text-gray-900">
                                                {cliente.nombre}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {cliente.direccion}
                                            </p>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-700">
                                            {cliente.contacto}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-700">
                                            {cliente.email}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-700">
                                            {cliente.telefono}
                                        </td>
                                        <td className="py-3 px-4">
                                            <span
                                                className={`text-xs px-2 py-1 rounded-full ${cliente.estado === "activo"
                                                        ? "bg-green-100 text-green-700"
                                                        : "bg-gray-100 text-gray-700"
                                                    }`}
                                            >
                                                {cliente.estado}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() =>
                                                        showToast("Función en desarrollo", "info")
                                                    }
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                                >
                                                    <FiEdit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        showToast("Función en desarrollo", "info")
                                                    }
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                                >
                                                    <FiTrash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td
                                        colSpan="6"
                                        className="py-10 text-center text-gray-500"
                                    >
                                        No se encontraron clientes
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default ClientesPage;
