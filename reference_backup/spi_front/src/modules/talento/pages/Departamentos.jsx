// src/modules/talento/pages/Departamentos.jsx
import React, { useEffect, useMemo, useState } from "react";
import { getDepartments } from "../../../core/api/departmentsApi";
import api from "../../../core/api";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import Input from "../../../core/ui/components/Input";
import Modal from "../../../core/ui/components/Modal";
import toast from "react-hot-toast";
import { FiPlus, FiEdit2, FiTrash2 } from "react-icons/fi";

const Departamentos = () => {
  const [departamentos, setDepartamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [nombre, setNombre] = useState("");
  const [search, setSearch] = useState("");

  // 🔹 Cargar departamentos al montar
  const fetchDepartamentos = async () => {
    try {
      const departamentosList = await getDepartments();
      setDepartamentos(Array.isArray(departamentosList) ? departamentosList : []);
    } catch (err) {
      console.error("❌ Error al cargar departamentos:", err);
      toast.error("Error al cargar los departamentos");
      setDepartamentos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartamentos();
  }, []);

  // 🔹 Abrir modal para crear o editar
  const handleOpenModal = (dept = null) => {
    if (dept) {
      setEditing(dept);
      setNombre(dept.name || dept.nombre || "");
    } else {
      setEditing(null);
      setNombre("");
    }
    setModalOpen(true);
  };

  // 🔹 Crear o actualizar departamento
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) return toast.error("El nombre es obligatorio");

    try {
      if (editing) {
        await api.put(`/departments/${editing.id}`, { name: nombre });
        toast.success("Departamento actualizado correctamente");
      } else {
        await api.post("/departments", { name: nombre, code: nombre.slice(0, 3).toUpperCase() });
        toast.success("Departamento creado correctamente");
      }
      setModalOpen(false);
      fetchDepartamentos();
    } catch (err) {
      console.error("❌ Error al guardar:", err);
      toast.error("No se pudo guardar el departamento");
    }
  };

  // 🔹 Eliminar departamento
  const handleDelete = async (id) => {
    if (!window.confirm("¿Deseas eliminar este departamento?")) return;
    try {
      await api.delete(`/departments/${id}`);
      toast.success("Departamento eliminado");
      fetchDepartamentos();
    } catch (err) {
      console.error("❌ Error al eliminar:", err);
      toast.error("No se pudo eliminar el departamento");
    }
  };

  const filteredDepartamentos = useMemo(() => {
    if (!search.trim()) return departamentos;
    const needle = search.toLowerCase();
    return departamentos.filter((dept) =>
      (dept.name || dept.nombre || "")
        .toLowerCase()
        .includes(needle)
    );
  }, [departamentos, search]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Departamentos</h1>
          <p className="text-sm text-gray-500">
            Organiza las unidades internas y gestiona sus nombres/códigos.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
          <Input
            placeholder="Buscar por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Button
            onClick={() => handleOpenModal()}
            variant="primary"
            className="flex items-center gap-2 justify-center"
          >
            <FiPlus className="text-lg" /> Nuevo Departamento
          </Button>
        </div>
      </div>

      {/* ===== Tarjetas de Departamentos ===== */}
      <Card className="p-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-blue-600"></div>
          </div>
        ) : filteredDepartamentos.length === 0 ? (
          <p className="text-gray-500 text-center py-6">
            No hay departamentos que coincidan con tu búsqueda.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredDepartamentos.map((dept) => (
              <div
                key={dept.id}
                className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-gray-800">
                      {dept.name || dept.nombre}
                    </p>
                    <p className="text-xs uppercase tracking-wide text-gray-400">
                      Código: {dept.code || "N/D"}
                    </p>
                  </div>
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
                    #{dept.id}
                  </span>
                </div>

                <p className="mt-3 text-sm text-gray-600 min-h-[48px]">
                  {dept.description || "Sin descripción registrada."}
                </p>

                <div className="mt-4 flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1 inline-flex items-center justify-center gap-1"
                    onClick={() => handleOpenModal(dept)}
                  >
                    <FiEdit2 /> Editar
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1 inline-flex items-center justify-center gap-1"
                    onClick={() => handleDelete(dept.id)}
                  >
                    <FiTrash2 /> Eliminar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ===== Modal de Creación/Edición ===== */}
      {modalOpen && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editing ? "Editar Departamento" : "Nuevo Departamento"}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del Departamento
              </label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ejemplo: Servicio Técnico"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary">
                {editing ? "Actualizar" : "Guardar"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Departamentos;
