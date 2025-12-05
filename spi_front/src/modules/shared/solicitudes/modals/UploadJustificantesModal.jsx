import React, { useState } from "react";
import { FiX, FiUpload, FiFile, FiCheck } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../../../../core/ui/components/Button";
import Card from "../../../../core/ui/components/Card";
import { useUI } from "../../../../core/ui/UIContext";
import { subirJustificantes } from "../../../../core/api/permisosApi";

/**
 * Modal para subir documentos justificantes
 */
const UploadJustificantesModal = ({ open, onClose, solicitud, onSuccess }) => {
    const { showToast } = useUI();
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);

    const justificantesRequeridos = solicitud?.justificacion_requerida || [];

    const getJustificanteLabel = (tipo) => {
        const labels = {
            certificado_institucion: "Certificado de la Institución Educativa",
            evidencia_general: "Evidencia (documento, foto, etc.)",
            certificado_medico: "Certificado Médico",
            certificado_medico_iess: "Certificado Médico avalado por IESS",
            certificado_defuncion: "Certificado de Defunción",
            documento_parentesco: "Documento que acredite parentesco",
            certificado_medico_familiar: "Certificado Médico del Familiar",
            evidencia_fotografica: "Evidencia Fotográfica (con fecha y hora)",
        };
        return labels[tipo] || tipo;
    };

    const handleFileChange = (tipo, file) => {
        setFiles((prev) => {
            const filtered = prev.filter((f) => f.tipo !== tipo);
            if (file) {
                return [...filtered, { tipo, file }];
            }
            return filtered;
        });
    };

    const handleSubmit = async () => {
        if (files.length === 0) {
            showToast("Debes subir al menos un documento", "warning");
            return;
        }

        setUploading(true);
        try {
            const fileList = files.map((f) => f.file);
            const response = await subirJustificantes(solicitud.id, fileList);

            if (response.ok) {
                showToast("Documentos subidos correctamente", "success");
                onSuccess?.();
                handleClose();
            } else {
                throw new Error(response.message || "Error al subir documentos");
            }
        } catch (error) {
            console.error("Error uploading files:", error);
            showToast(error.response?.data?.message || error.message || "Error al subir documentos", "error");
        } finally {
            setUploading(false);
        }
    };

    const handleClose = () => {
        setFiles([]);
        onClose();
    };

    if (!open || !solicitud) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-2xl"
                >
                    <Card className="relative max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <FiUpload className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">Subir Justificantes</h2>
                                    <p className="text-sm text-gray-500">Solicitud #{solicitud.id}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                disabled={uploading}
                            >
                                <FiX className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4">
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-sm text-amber-800">
                                    <strong>Importante:</strong> Debes subir los siguientes documentos para que tu solicitud
                                    pueda ser aprobada definitivamente.
                                </p>
                            </div>

                            {justificantesRequeridos.length === 0 ? (
                                <div className="p-4 bg-gray-50 rounded-lg text-center">
                                    <p className="text-sm text-gray-500">No se requieren justificantes para esta solicitud.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {justificantesRequeridos.map((tipo) => {
                                        const hasFile = files.some((f) => f.tipo === tipo);
                                        return (
                                            <div key={tipo} className="border border-gray-200 rounded-lg p-4">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex-1">
                                                        <label className="block text-sm font-medium text-gray-700">
                                                            {getJustificanteLabel(tipo)}
                                                        </label>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            Formatos aceptados: PDF, JPG, PNG (máx 10MB)
                                                        </p>
                                                    </div>
                                                    {hasFile && (
                                                        <div className="flex items-center gap-1 text-green-600">
                                                            <FiCheck className="w-4 h-4" />
                                                            <span className="text-xs font-medium">Listo</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="relative">
                                                    <input
                                                        type="file"
                                                        accept=".pdf,.jpg,.jpeg,.png"
                                                        onChange={(e) => handleFileChange(tipo, e.target.files[0])}
                                                        className="hidden"
                                                        id={`file-${tipo}`}
                                                    />
                                                    <label
                                                        htmlFor={`file-${tipo}`}
                                                        className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${hasFile
                                                                ? "border-green-300 bg-green-50"
                                                                : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                                                            }`}
                                                    >
                                                        <FiFile className={hasFile ? "text-green-600" : "text-gray-400"} />
                                                        <span className={`text-sm ${hasFile ? "text-green-700 font-medium" : "text-gray-600"}`}>
                                                            {hasFile
                                                                ? files.find((f) => f.tipo === tipo)?.file.name
                                                                : "Haz clic para seleccionar archivo"}
                                                        </span>
                                                    </label>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Info */}
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-xs text-blue-700">
                                    <strong>Nota:</strong> Los documentos se guardarán en Google Drive y estarán disponibles
                                    para revisión de tu jefe inmediato.
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex gap-3 p-6 border-t border-gray-200 bg-gray-50">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={handleClose}
                                className="flex-1"
                                disabled={uploading}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                variant="primary"
                                onClick={handleSubmit}
                                className="flex-1"
                                disabled={uploading || files.length === 0}
                            >
                                {uploading ? "Subiendo..." : `Subir ${files.length} Documento(s)`}
                            </Button>
                        </div>
                    </Card>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default UploadJustificantesModal;
