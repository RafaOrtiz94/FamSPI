import React, { useState } from "react";
import { FiUploadCloud, FiX } from "react-icons/fi";
import Modal from "../../../../core/ui/components/Modal";
import Button from "../../../../core/ui/components/Button";
import { useUI } from "../../../../core/ui/UIContext";
import { subirJustificantes } from "../../../../core/api/permisosApi";

const UploadJustificantesModal = ({ solicitud, open, onClose, onSuccess }) => {
    const { showToast } = useUI();
    const [files, setFiles] = useState({});
    const [uploading, setUploading] = useState(false);

    const justificantesRequeridos = solicitud?.justificacion_requerida || [];

    const handleFileChange = (tipo, file) => {
        setFiles((prev) => ({ ...prev, [tipo]: file }));
    };

    const handleSubmit = async () => {
        setUploading(true);
        try {
            const formData = new FormData();
            Object.entries(files).forEach(([tipo, file]) => {
                if (file) {
                    formData.append(tipo, file);
                }
            });
            await subirJustificantes(solicitud.id, formData);
            showToast("Justificantes subidos correctamente", "success");
            onSuccess?.();
            onClose?.();
        } catch (error) {
            console.error("Error uploading justificantes", error);
            showToast("Error al subir justificantes", "error");
        } finally {
            setUploading(false);
        }
    };

    return (
        <Modal open={open} onClose={onClose} title="Subir justificantes" size="lg">
            <div className="space-y-4">
                <p className="text-sm text-gray-600">
                    Adjunta los archivos requeridos para completar la solicitud.
                </p>

                <div className="space-y-3">
                    {justificantesRequeridos.length === 0 && (
                        <div className="text-sm text-gray-500">No hay justificantes solicitados.</div>
                    )}
                    {justificantesRequeridos.map((tipo) => (
                        <label
                            key={tipo}
                            className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-gray-300 px-4 py-3"
                        >
                            <div className="flex items-center gap-2 text-sm">
                                <FiUploadCloud className="text-blue-500" />
                                <span className="font-medium text-gray-800">{tipo}</span>
                            </div>
                            <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={(e) => handleFileChange(tipo, e.target.files?.[0])}
                                className="text-sm"
                            />
                        </label>
                    ))}
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                    <Button variant="ghost" onClick={onClose} icon={FiX}>
                        Cancelar
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        loading={uploading}
                        disabled={uploading || justificantesRequeridos.length === 0}
                    >
                        {uploading ? "Subiendo..." : "Subir documentos"}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default UploadJustificantesModal;
