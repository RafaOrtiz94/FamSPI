import React from "react";
import { motion } from "framer-motion";

export const DashboardLayout = ({ children, className = "" }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-6 space-y-6 bg-gradient-to-b from-gray-50 to-white min-h-screen ${className}`}
        >
            {children}
        </motion.div>
    );
};

export const DashboardHeader = ({ title, subtitle, actions }) => {
    return (
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    {title}
                </h1>
                {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
    );
};

export const SectionTitle = ({ title, action }) => {
    return (
        <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {action}
        </div>
    );
};
