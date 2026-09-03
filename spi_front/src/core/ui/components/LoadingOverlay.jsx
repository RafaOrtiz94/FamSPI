import React from "react";
import { motion } from "framer-motion";
import { FiLoader } from "react-icons/fi";

const LoadingOverlay = ({ message }) => {
  if (!message) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="mx-4 flex max-w-lg flex-col items-center gap-4 rounded-2xl bg-gray-800/85 p-6 text-white sm:p-8"
      >
        <FiLoader className="animate-spin text-4xl text-blue-400" />
        <p className="text-center text-base font-semibold tracking-wide sm:text-lg">{message}</p>
      </motion.div>
    </div>
  );
};

export default LoadingOverlay;
