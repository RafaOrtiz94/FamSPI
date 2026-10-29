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
 <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center sm:p-6">
 <input
 type="file"
 multiple={multiple}
 ref={inputRef}
 accept={accept}
 className="hidden"
 onChange={handleFiles}
 />
 <FiUpload className="mx-auto mb-2 text-3xl text-slate-500" />
 <button
 type="button"
 onClick={() => inputRef.current?.click()}
 className="rounded-lg px-2 py-1 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
 >
 {label}
 </button>
 {helper && <p className="mt-1 break-words text-xs text-slate-500">{helper}</p>}
 </div>
 );
};

export default FileUploader;
