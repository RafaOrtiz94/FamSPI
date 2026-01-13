import React, { useCallback, useEffect, useState } from "react";
import { FiDownload } from "react-icons/fi";
import toast from "react-hot-toast";

import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import Select from "../../../core/ui/components/Select";
import { DashboardLayout, DashboardHeader } from "../../../core/ui/layouts/DashboardLayout";
import { getUsers } from "../../../core/api/usersApi";
import { downloadAttendancePDF } from "../../../core/api/attendanceApi";

const TalentoAsistenciaReportes = () => {
    console.log("[HR_UI][FASE2] entering AsistenciaReportes");

    useEffect(() => {
        console.log("[HR_UI][FASE3] lazy page loaded: AsistenciaReportes");
    }, []);

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);

    // Estados para reportes de asistencia
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [selectedUserId, setSelectedUserId] = useState("all");
    const [userOptions, setUserOptions] = useState([]);

    const loadUsers = useCallback(async () => {
        try {
            const res = await getUsers();
            const rows = Array.isArray(res?.data) ? res.data : res;
            setUsers(rows);
            setUserOptions([
                { id: "all", nombre: "Todos los usuarios" },
                ...rows.map((user) => ({
                    id: user.id,
                    nombre: user.fullname || user.email || `Usuario #${user.id}`,
                })),
            ]);
        } catch (err) {
            console.error("Error cargando usuarios:", err);
            toast.error("Error cargando usuarios");
        }
    }, []);

    useEffect(() => {
        loadUsers();

        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        setStartDate(firstDay.toISOString().split("T")[0]);
        setEndDate(today.toISOString().split("T")[0]);
    }, [loadUsers]);

    const handleDownloadPDF = useCallback(async () => {
        if (!startDate || !endDate) {
            return toast.error("Selecciona un rango de fechas.");
        }

        setLoading(true);
        try {
            await downloadAttendancePDF(selectedUserId, startDate, endDate);
            toast.success("PDF generado correctamente");
        } catch (err) {
            console.error("❌ Error descargando PDF:", err);
            toast.error("No se pudo generar el PDF.");
        } finally {
            setLoading(false);
        }
    }, [selectedUserId, startDate, endDate]);

    return (
        <DashboardLayout includeWidgets={false}>
            <DashboardHeader
                title="Reportes de Asistencia"
                subtitle="Generación y descarga de reportes oficiales de asistencia del personal"
            />

            <Card className="p-6 space-y-6">
                <div className="border-b border-gray-200 pb-4">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Generar Reporte de Asistencia
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                        Exporta registros oficiales de asistencia del personal en formato PDF.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Fecha Inicio
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Fecha Fin
                        </label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Usuario
                        </label>
                        <Select
                            value={selectedUserId}
                            options={userOptions.map((u) => ({ label: u.nombre, value: u.id }))}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            className="w-full"
                        />
                    </div>

                    <div className="flex items-end">
                        <Button
                            variant="primary"
                            icon={FiDownload}
                            onClick={handleDownloadPDF}
                            disabled={loading}
                            className="w-full py-2.5"
                        >
                            {loading ? "Generando..." : "Descargar PDF"}
                        </Button>
                    </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-blue-900 mb-2">ℹ️ Información del Reporte</h3>
                    <ul className="text-sm text-blue-800 space-y-1">
                        <li>• El reporte incluye entradas, salidas, almuerzos y horas trabajadas</li>
                        <li>• Se generan firmas electrónicas cuando están disponibles</li>
                        <li>• Formato: PDF oficial con plantilla RH-09</li>
                        <li>• Período: Desde {startDate || "fecha inicio"} hasta {endDate || "fecha fin"}</li>
                    </ul>
                </div>
            </Card>
        </DashboardLayout>
    );
};

export default TalentoAsistenciaReportes;