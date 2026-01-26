import React from "react";
import { getStatusConfig } from "./EquipmentPurchaseWidget.utils";

/**
 * StatusBadge Component
 * Displays status information with icon, color coding and accessibility
 * @param {Object} props
 * @param {string} props.status - Status key from STATUS_CONFIG
 * @param {string} props.className - Additional CSS classes
 */
const StatusBadge = ({ status, className = "" }) => {
    const statusConfig = getStatusConfig(status);
    const { Icon, label, badgeBg, badgeText } = statusConfig;

    return (
        <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${badgeBg} ${badgeText} shadow-sm ${className}`}
            role="status"
            aria-label={`Estado: ${label}`}
        >
            <Icon size={14} aria-hidden="true" />
            <span className="text-xs font-semibold">{label}</span>
        </div>
    );
};

export default StatusBadge;
