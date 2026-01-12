import React, { useRef, useState, useEffect } from "react";
import PropTypes from "prop-types";
import { FiTrash2 } from "react-icons/fi";

/**
 * SignatureCapture Component
 * ---------------------------
 * Reusable canvas-based signature capture component
 * - Touch and mouse support
 * - Clear/reset functionality
 * - Returns base64 PNG data
 */
const SignatureCapture = ({ onSignatureChange, width = 500, height = 200 }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isEmpty, setIsEmpty] = useState(true);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Set canvas background to white
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, []);

    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        if (e.touches && e.touches.length > 0) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top) * scaleY,
            };
        }

        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    };

    const startDrawing = (e) => {
        e.preventDefault();
        setIsDrawing(true);
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext("2d");
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();

        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext("2d");
        ctx.lineTo(x, y);
        ctx.stroke();

        setIsEmpty(false);
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);

        // Get base64 data and notify parent
        const canvas = canvasRef.current;
        const base64 = canvas.toDataURL("image/png");
        if (onSignatureChange) {
            onSignatureChange(base64);
        }
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        // Clear and reset to white background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        setIsEmpty(true);
        if (onSignatureChange) {
            onSignatureChange(null);
        }
    };

    return (
        <div className="signature-capture-container">
            <div className="relative inline-block">
                <canvas
                    ref={canvasRef}
                    width={width}
                    height={height}
                    className="border-2 border-gray-300 rounded-lg cursor-crosshair bg-white touch-none"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />
                {!isEmpty && (
                    <button
                        type="button"
                        onClick={clearSignature}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                        title="Limpiar firma"
                    >
                        <FiTrash2 size={18} />
                    </button>
                )}
            </div>
            <p className="text-sm text-gray-500 mt-2">
                {isEmpty
                    ? "Dibuja tu firma en el recuadro usando el mouse o tu dedo"
                    : "Firma capturada. Haz clic en el ícono de basura para limpiar."}
            </p>
        </div>
    );
};

SignatureCapture.propTypes = {
    onSignatureChange: PropTypes.func,
    width: PropTypes.number,
    height: PropTypes.number,
};

export default SignatureCapture;
