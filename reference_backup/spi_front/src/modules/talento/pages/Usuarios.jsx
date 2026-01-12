import React, { useEffect, useMemo, useState } from "react";
import { FiPlus, FiEdit2, FiTrash2 } from "react-icons/fi";
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
} from "../../../core/api/usersApi";
import { getDepartments } from "../../../core/api/departmentsApi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import Input from "../../../core/ui/components/Input";
import Select from "../../../core/ui/components/Select";
import Modal from "../../../core/ui/components/Modal";
import toast from "react-hot-toast";

const ROLE_OPTIONS = [
  { label: "Pendiente", value: "pendiente" },
  { label: "Gerencia", value: "gerencia" },
  { label: "Comercial", value: "comercial" },
  { label: "Servicio Técnico", value: "servicio_tecnico" },
  { label: "Técnico", value: "tecnico" },
  { label: "Finanzas", value: "finanzas" },
  { label: "Talento Humano", value: "talento_humano" },
  { label: "TI", value: "ti" },
  { label: "Usuario", value: "usuario" },
];

const Usuarios = () => {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    fullname: "",
    email: "",
    role: "pendiente",
    department_id: "",
    google_id: "",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersData, depData] = await Promise.all([getUsers(), getDepartments()]);
      setUsers(usersData || []);
      setDepartments(depData || []);
    } catch (error) {
      console.error("Error cargando usuarios:", error);
      toast.error("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openModal = (user = null) => {
    if (user) {
      setEditing(user);
      setForm({
        fullname: user.fullname || "",
        email: user.email || "",
        role: user.role || "pendiente",
        department_id: user.department_id || "",
        google_id: user.google_id || "",
      });
    } else {
      setEditing(null);
      setForm({
        fullname: "",
        email: "",
        role: "pendiente",
        department_id: "",
        google_id: "",
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.email.trim() || !form.fullname.trim()) {
      toast.error("Nombre y correo son obligatorios");
      return;
    }
    try {
      if (editing) {
        await updateUser(editing.id, {
          fullname: form.fullname,
          email: form.email,
          role: form.role,
          department_id: form.department_id || null,
          google_id: form.google_id || null,
        });
        toast.success("Usuario actualizado");
      } else {
        await createUser({
          fullname: form.fullname,
          email: form.email,
          role: form.role,
          department_id: form.department_id || null,
          google_id: form.google_id || null,
        });
        toast.success("Usuario creado");
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      console.error("Error guardando usuario:", err);
      toast.error("No se pudo guardar el usuario");
    }
  };

  const handleDelete = async (user) => {
    const confirmed = window.confirm(
      `¿Eliminar al usuario ${user.fullname || user.email}?`
    );
    if (!confirmed) return;
    try {
      await deleteUser(user.id);
      toast.success("Usuario eliminado");
      loadData();
    } catch (err) {
      console.error("Error eliminando usuario:", err);
      const serverMsg = err?.response?.data?.message;
      const dependencies = err?.response?.data?.dependencies;
      if (Array.isArray(dependencies) && dependencies.length > 0) {
        const reasons = dependencies
          .map((dep) => `${dep.total} ${dep.type}`)
          .join(", ");
        toast.error(
          serverMsg ||
            `No se puede eliminar: el usuario tiene registros asociados (${reasons}).`
        );
      } else {
        toast.error(serverMsg || "No se pudo eliminar el usuario");
      }
    }
  };

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    return users.filter((u) => {
      const needle = search.toLowerCase();
      return (
        (u.fullname || "").toLowerCase().includes(needle) ||
        (u.email || "").toLowerCase().includes(needle) ||
        (u.role || "").toLowerCase().includes(needle)
      );
    });
  }, [users, search]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[70vh]">
        <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">
            Gestión de Usuarios
          </h1>
          <p className="text-sm text-gray-500">
            Administra roles, departamentos y altas manuales.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <Input
            placeholder="Buscar por nombre, correo o rol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Button className="flex items-center gap-2" onClick={() => openModal()}>
            <FiPlus /> Nuevo usuario
          </Button>
        </div>
      </div>

      <Card className="shadow-sm">
        {filteredUsers.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            No hay usuarios que coincidan con tu búsqueda.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredUsers.map((u) => {
              const roleLabel =
                ROLE_OPTIONS.find((r) => r.value === u.role)?.label ||
                u.role ||
                "Pendiente";

              return (
                <div
                  key={u.id}
                  className="border border-gray-100 rounded-xl p-4 flex flex-col bg-white shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-gray-800">
                        {u.fullname || "Sin nombre"}
                      </p>
                      <p className="text-sm text-gray-500 break-all">{u.email}</p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600">
                      {roleLabel}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 text-sm text-gray-600">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-xs uppercase tracking-wide">
                        Departamento
                      </span>
                      <span className="font-medium text-gray-800">
                        {u.department_name || "Sin asignar"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-xs uppercase tracking-wide">
                        Google ID
                      </span>
                      <span className="text-gray-700 truncate max-w-[160px]">
                        {u.google_id || "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-xs uppercase tracking-wide">
                        Creado
                      </span>
                      <span className="text-gray-700">
                        {u.created_at
                          ? new Date(u.created_at).toLocaleDateString()
                          : "—"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-1"
                      onClick={() => openModal(u)}
                    >
                      <FiEdit2 /> Editar
                    </Button>
                    <Button
                      variant="danger"
                      className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-1"
                      onClick={() => handleDelete(u)}
                    >
                      <FiTrash2 /> Eliminar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar usuario" : "Nuevo usuario"}
      >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Nombre completo</label>
                <Input
                  value={form.fullname}
                  onChange={(e) => setForm({ ...form, fullname: e.target.value })}
                  placeholder="Ej. Maria Pérez"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Correo</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="usuario@famproject.com.ec"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Rol</label>
                <Select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  options={ROLE_OPTIONS}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Departamento</label>
                <Select
                  value={form.department_id || ""}
                  onChange={(e) =>
                    setForm({ ...form, department_id: e.target.value || "" })
                  }
                  options={[
                    { label: "Sin asignar", value: "" },
                    ...departments.map((d) => ({
                      label: d.name,
                      value: d.id,
                    })),
                  ]}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Google ID (opcional)
              </label>
              <Input
                value={form.google_id || ""}
                onChange={(e) => setForm({ ...form, google_id: e.target.value })}
                placeholder="ID de Google Workspace"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary">
                {editing ? "Actualizar" : "Crear"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Usuarios;
