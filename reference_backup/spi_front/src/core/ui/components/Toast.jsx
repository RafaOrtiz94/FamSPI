import React from "react";

const Toast = ({ message, type = "info" }) => {
  const styles = {
    success: "bg-green-500 text-white",
    error: "bg-red-500 text-white",
    info: "bg-blue-500 text-white",
    warning: "bg-yellow-400 text-gray-900",
  };

  return (
    <div className={`fixed bottom-5 right-5 px-4 py-2 rounded-md shadow-lg ${styles[type]}`}>
      {message}
    </div>
  );
};

export default Toast;
