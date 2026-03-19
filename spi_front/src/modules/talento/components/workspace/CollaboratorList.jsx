import React from "react";
import { FiUsers } from "react-icons/fi";

const CollaboratorList = ({ collaborators, loading, selectedCollaboratorId, onSelect }) => {
 if (loading) {
 return (
 <div className="flex justify-center p-8">
 <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
 </div>
 );
 }

 if (!collaborators || collaborators.length === 0) {
 return (
 <div className="p-4 text-center text-sm text-gray-500">
 No hay colaboradores para mostrar.
 </div>
 );
 }

 return (
 <div className="space-y-2 p-2">
 {collaborators.map((collaborator) => (
 <button
 key={collaborator.id}
 onClick={() => onSelect(collaborator)}
 className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition ${
 String(collaborator.id) === String(selectedCollaboratorId)
 ? "border-blue-400 bg-blue-50 ring-1 ring-blue-400"
 : "border-gray-200 hover:bg-gray-50"
 }`}
 >
 <div className="flex items-start gap-3">
 <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
 <FiUsers />
 </div>
 <div className="min-w-0 flex-1">
 <p className="font-medium text-gray-900 truncate">
 {collaborator.fullname || collaborator.email || "Sin nombre"}
 </p>
 <p className="text-xs text-gray-500 truncate">{collaborator.email}</p>
 <p className="text-[10px] text-gray-400 mt-1 truncate">
 {collaborator.department_name || collaborator.department || "Sin departamento"}
 </p>
 </div>
 </div>
 </button>
 ))}
 </div>
 );
};

export default CollaboratorList;
