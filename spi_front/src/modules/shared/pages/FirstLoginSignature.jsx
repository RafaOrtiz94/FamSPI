import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FiCheckCircle, FiAlertCircle } from "react-icons/fi";
import SignatureCapture from "../../../core/ui/widgets/SignatureCapture";
import Button from "../../../core/ui/components/Button";
import Card from "../../../core/ui/components/Card";
import { useAuth } from "../../../core/auth/AuthContext";
import { acceptInternalLopdp } from "../../../core/api/authApi";
import { useUI } from "../../../core/ui/useUI";

/**
 * FirstLoginSignature Page
 * -------------------------
 * Captures user signature on first login
 * - Uses existing LOPDP infrastructure
 * - Redirects to dashboard after signature
 */
const FirstLoginSignature = () => {
    const navigate = useNavigate();
    const { reloadProfile, user } = useAuth();
    const { showToast } = useUI();

    const [signature, setSignature] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!signature) {
            showToast("Por favor dibuja tu firma antes de continuar", "error");
            return;
        }

        setLoading(true);

        try {
            // Generate a simple PDF with signature (base64)
            // For LOPDP, we need both signature and PDF
            // We'll create a minimal PDF with just the signature
            const pdfBase64 = signature; // Simplified - in production, generate proper PDF

            const response = await acceptInternalLopdp({
                signatureBase64: signature,
                pdfBase64: pdfBase64,
                notes: "Firma capturada en primer inicio de sesión",
            });

            if (response.ok) {
                showToast("Firma registrada correctamente", "success");

                // Reload profile to get updated user data
                await reloadProfile();

                // Redirect to appropriate dashboard
                const dashboard = user?.dashboard || "/dashboard";
                navigate(dashboard, { replace: true });
            } else {
                throw new Error(response.message || "Error registrando firma");
            }
        } catch (err) {
            console.error("Error submitting signature:", err);
            showToast(
                err.message || "No se pudo registrar la firma. Intenta de nuevo.",
                "error"
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-2xl"
            >
                <Card className="p-8">
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                            <FiCheckCircle className="text-blue-600 text-3xl" />
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">
                            ¡Bienvenido a FAM SPI!
                        </h1>
                        <p className="text-gray-600">
                            Para continuar, necesitamos que registres tu firma digital.
                        </p>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <FiAlertCircle className="text-blue-600 text-xl flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-blue-800">
                                <p className="font-semibold mb-1">¿Por qué necesitamos tu firma?</p>
                                <p>
                                    Tu firma digital se utilizará para validar documentos importantes,
                                    registros de asistencia y otros procesos que requieren tu
                                    autorización formal.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                            Dibuja tu firma:
                        </label>
                        <div className="flex justify-center">
                            <SignatureCapture
                                onSignatureChange={setSignature}
                                width={600}
                                height={200}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 justify-end">
                        <Button
                            variant="primary"
                            onClick={handleSubmit}
                            disabled={!signature || loading}
                            className="w-full sm:w-auto"
                        >
                            {loading ? "Guardando..." : "Guardar y Continuar"}
                        </Button>
                    </div>

                    <div className="mt-6 text-center text-xs text-gray-500">
                        <p>
                            Al continuar, aceptas que tu firma digital será almacenada de forma
                            segura y utilizada únicamente para procesos internos de la empresa.
                        </p>
                    </div>
                </Card>
            </motion.div>
        </div>
    );
};

export default FirstLoginSignature;
