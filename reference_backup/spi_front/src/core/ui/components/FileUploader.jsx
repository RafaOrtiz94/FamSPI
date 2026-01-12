import React, { useRef } from "react";
import { FiUpload } from "react-icons/fi";

const FileUploader = ({
  label = "Subir archivos",
  helper,
  accept,
  multiple = true,
  onFilesSelected,
}) => {
  const inputRef = useRef(null);

  const handleFiles = (event) => {
    const files = Array.from(event.target.files || []);
    onFilesSelected?.(files);
  };

  return (
    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 bg-gray-50 dark:bg-gray-800/40 text-center">
      <input
        type="file"
        multiple={multiple}
        ref={inputRef}
        accept={accept}
        className="hidden"
        onChange={handleFiles}
      />
      <FiUpload className="text-gray-500 dark:text-gray-300 text-3xl mx-auto mb-2" />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
      >
        {label}
      </button>
      {helper && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{helper}</p>
      )}
    </div>
  );
};

export default FileUploader;
