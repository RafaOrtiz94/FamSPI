// ============================================================
// 🏢 Dashboard Comercial — SPI Fam Project (Versión Ejecutiva PRO)
// ------------------------------------------------------------
// Visualiza solicitudes, desempeño e inventario con estilo corporativo.
// ============================================================

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  FiDownload,
  FiRefreshCw,
  FiTrendingUp,
  FiCheckCircle,
  FiXCircle,
  FiX,
  FiFileText,
  FiPaperclip,
  FiPackage,
  FiClipboard,
  FiTruck,
  FiShoppingCart,
} from "react-icons/fi";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import { useUI } from "../../../core/ui/useUI";
import { useApi } from "../../../core/hooks/useApi";
import { useDashboard } from "../../../core/hooks/useDashboard";
import { useAuth } from "../../../core/auth/AuthContext";

import {
  getRequests,
  getRequestById,
  createRequest,
  cancelRequest,
} from "../../../core/api/requestsApi";
import { getDocumentsByRequest } from "../../../core/api/documentsApi";
import { getFilesByRequest } from "../../../core/api/filesApi";
import { getInventoryByRequest } from "../../../core/api/inventarioApi";

import SolicitudesGrid from "../components/SolicitudesGrid";
import CreateRequestModal from "../components/CreateRequestModal";
import NewClientActionCard from "../components/NewClientActionCard";
import RequestTypeActionCard from "../components/RequestTypeActionCard";
import RequestHighlights from "../components/RequestHighlights";
import ExecutiveStatCard from "../../../core/ui/components/ExecutiveStatCard";
import LoadingOverlay from "../../../core/ui/components/LoadingOverlay";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  LineElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  PointElement,
  Filler,
} from "chart.js";

ChartJS.register(
  ArcElement,
  BarElement,
  LineElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  PointElement,
  Filler
);

const safeJSON = (txt) => {
  try {
    return JSON.parse(txt);
  } catch {
    return {};
  }
};

const ComercialDashboard = () => {
  const { showToast, confirm } = useUI();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [presetRequestType, setPresetRequestType] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [detail, setDetail] = useState({
    open: false,
    loading: false,
    data: null,
    error: null,
  });
  const reportRef = useRef(null);

  const [statsLoading, setStatsLoading] = useState(true);
  const [kpiStats, setKpiStats] = useState({
    total: 0,
    aprobadas: 0,
    rechazadas: 0,
  });

  const normalizedScope = (user?.scope || user?.role || "").toLowerCase();
  const canCreateClients = ["comercial", "jefe_comercial", "asesor_comercial", "asesor"].includes(normalizedScope);

  // ============================
  // 🔌 API Hooks
  // ============================
  const {
    data: listData,
    loading,
    execute: fetchList,
  } = useApi(getRequests, { errorMsg: "Error al cargar solicitudes" });

  const { data: invData, execute: fetchInv } = useApi(getInventoryByRequest);

  // ============================
  // 🚀 Carga de Datos y Estadísticas
  // ============================
  const load = useCallback(() => {
    const filters = {
      page: 1,
      pageSize: 24,
      status: status === "all" ? undefined : status,
      q: query || undefined,
    };
    fetchList(filters);
  }, [fetchList, status, query]);

  useEffect(() => {
    load();
  }, [load]);

    useEffect(() => {

      const calculateStats = async () => {

        setStatsLoading(true);

        try {

          // Fetch ALL requests to calculate stats client-side

          const allRequestsData = await getRequests({

            q: query || undefined,

            pageSize: 9999,

          });

          const allRequests = allRequestsData.rows || [];

  

          const total = allRequests.length;

          const aprobadas = allRequests.filter(

            (r) => r.status === "aprobado"

          ).length;

          const rechazadas = allRequests.filter(

            (r) => r.status === "rechazado"

          ).length;

  

          setKpiStats({

            total,

            aprobadas,

            rechazadas,

          });

        } catch (error) {

          console.error("Error al cargar estadísticas KPI:", error);

          showToast(

            "No se pudieron cargar las estadísticas de las tarjetas.",

            "error"

          );

        } finally {

          setStatsLoading(false);

        }

      };

  

      calculateStats();

    }, [query, showToast]);


  const solicitudes = useMemo(
    () =>
      (listData?.rows || []).map((r) => ({
        ...r,
        payload: typeof r.payload === "string" ? safeJSON(r.payload) : r.payload,
      })),
    [listData]
  );

  const { chartData: baseChartData = {} } = useDashboard(solicitudes);

  const chartData = useMemo(() => {
    const typeCounts = new Map();
    solicitudes.forEach((req) => {
      const type = req.type_title || "Sin tipo";
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    });

    const labels = [...typeCounts.keys()];
    const data = [...typeCounts.values()];

    const barChart = {
      labels,
      datasets: [
        {
          label: "Número de Solicitudes",
          data,
          backgroundColor: [
            "rgba(54, 162, 235, 0.6)",
            "rgba(255, 99, 132, 0.6)",
            "rgba(75, 192, 192, 0.6)",
            "rgba(255, 206, 86, 0.6)",
            "rgba(153, 102, 255, 0.6)",
          ],
        },
      ],
    };
    return { ...baseChartData, bar: barChart };
  }, [solicitudes, baseChartData]);

  // ============================
  // 🧾 Funciones CRUD
  // ============================
  const handleCreate = async ({ request_type_id, payload, files }) => {
    try {
      setLoadingMessage("Creando solicitud...");
      await new Promise(res => setTimeout(res, 800)); 

      if (files && files.length > 0) {
        setLoadingMessage("Adjuntando archivos...");
        await new Promise(res => setTimeout(res, 800));
      }
      
      await createRequest({ request_type_id, payload, files });
      
      setLoadingMessage("Finalizando...");
      await new Promise(res => setTimeout(res, 800));


      showToast("Solicitud creada correctamente ✅", "success");
      closeRequestModal();
      await load();
    } catch {
      showToast("No se pudo crear la solicitud", "error");
    } finally {
      setLoadingMessage("");
    }
  };

  const handleView = async (req) => {
    setDetail({ open: true, loading: true, data: null, error: null });
    try {
      const data = await getRequestById(req.id);
      const docs = await getDocumentsByRequest(req.id);
      const files = await getFilesByRequest(req.id);
      const inv = await fetchInv({ requestId: req.id });

      const parsed = {
        request: {
          ...(data.request || data),
        },
        documents: docs || [],
        attachments: files || [],
        inventario: inv || [],
      };
      setDetail({ open: true, loading: false, data: parsed, error: null });
    } catch (e) {
      console.error(e);
      setDetail({
        open: true,
        loading: false,
        data: null,
        error: "No se pudo cargar el detalle",
      });
    }
  };

  const handleCancel = async (req) => {
    const ok = await confirm(`¿Cancelar la solicitud #${req.id}?`);
    if (!ok) return;
    try {
      await cancelRequest(req.id);
      showToast(`Solicitud #${req.id} cancelada`, "success");
      await load();
    } catch {
      showToast("No se pudo cancelar la solicitud", "error");
    }
  };

  // ============================
  // 📄 Exportar PDF
  // ============================
  const exportPDF = async () => {
    try {
      setLoadingMessage("Generando PDF...");
      const canvas = await html2canvas(reportRef.current);
      const pdf = new jsPDF("p", "mm", "a4");
      const imgData = canvas.toDataURL("image/png");
      const width = pdf.internal.pageSize.getWidth();
      const height = (canvas.height * width) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, width, height);
      pdf.save("reporte-comercial.pdf");
      showToast("Reporte exportado correctamente", "success");
    } catch {
      showToast("Error al exportar PDF", "error");
    } finally {
      setLoadingMessage("");
    }
  };

  // ============================
  // 🎨 Render principal
  // ============================
  const requestActionCards = useMemo(
    () => [
      {
        id: "inspection",
        subtitle: "Inspecciones",
        title: "Evalúa ambientes críticos",
        description:
          "Agenda la visita del equipo técnico y genera automáticamente la F.ST-INS para ambientes, LIS y periféricos.",
        chips: ["F.ST-INS", "Checklist"],
        tone: "blue",
        icon: FiClipboard,
      },
      {
        id: "retiro",
        subtitle: "Retiros",
        title: "Coordina retiros y devoluciones",
        description:
          "Gestiona la logística inversa para equipos en campo, notifica a inventario y documenta las observaciones.",
        chips: ["Rutas", "Inventario"],
        tone: "amber",
        icon: FiTruck,
      },
      {
        id: "compra",
        subtitle: "Compras",
        title: "Activa procesos de compra",
        description:
          "Solicita nuevos equipos o accesorios, asigna fechas tentativas y comparte especificaciones con abastecimiento.",
        chips: ["CapEx", "Prioridades"],
        tone: "violet",
        icon: FiShoppingCart,
      },
    ],
    [],
  );

  const openRequestModal = (type) => {
    setPresetRequestType(type);
    setModalOpen(true);
  };

  const closeRequestModal = () => {
    setModalOpen(false);
    setPresetRequestType(null);
  };

  return (
    <motion.div
      ref={reportRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 md:p-10 space-y-10 bg-slate-50 dark:bg-slate-900 min-h-screen"
    >
      <LoadingOverlay message={loadingMessage} />
      {/* HEADER */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard Comercial
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Reporte ejecutivo • {new Date().toLocaleDateString("es-EC")}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={load}
            className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center gap-2 px-4 py-2 rounded-xl shadow-sm transition-colors"
          >
            <FiRefreshCw /> Actualizar
          </button>
          <button
            onClick={exportPDF}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 px-4 py-2 rounded-xl shadow-md hover:shadow-lg transition-all"
          >
            <FiDownload /> Exportar
          </button>
        </div>
      </div>

      {/* ACCIONES DESTACADAS */}
      <section className="space-y-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
              Crear una nueva solicitud
            </p>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Coordina inspecciones, retiros, compras y registros
            </h2>
          </div>
          <button
            type="button"
            onClick={() => openRequestModal(null)}
            className="inline-flex items-center justify-center rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 dark:border-blue-900/40 dark:text-blue-200 dark:hover:bg-blue-900/20"
          >
            Explorar opciones
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {requestActionCards.map((card) => (
            <RequestTypeActionCard
              key={card.id}
              {...card}
              onClick={() => openRequestModal(card.id)}
              ctaLabel="Iniciar"
            />
          ))}

          {canCreateClients && (
            <NewClientActionCard
              className="h-full"
              onClick={() => navigate("/dashboard/comercial/new-client-request")}
            />
          )}
        </div>
      </section>

      {/* SOLICITUDES DESTACADAS */}
      <RequestHighlights
        requests={solicitudes.slice(0, 3)}
        onView={handleView}
        onCancel={handleCancel}
      />

      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <ExecutiveStatCard
          icon={<FiTrendingUp size={22} />}
          label="Total Solicitudes"
          value={statsLoading ? "..." : kpiStats.total}
          from="from-blue-600"
          to="to-blue-500"
        />
        <ExecutiveStatCard
          icon={<FiCheckCircle size={22} />}
          label="Aprobadas"
          value={statsLoading ? "..." : kpiStats.aprobadas}
          from="from-green-600"
          to="to-green-500"
        />
        <ExecutiveStatCard
          icon={<FiXCircle size={22} />}
          label="Rechazadas"
          value={statsLoading ? "..." : kpiStats.rechazadas}
          from="from-rose-600"
          to="to-pink-500"
        />
      </section>

      {/* GRÁFICOS */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Tendencia de Solicitudes
          </p>
          {chartData?.line ? <Line data={chartData.line} /> : <p>Cargando...</p>}
        </div>
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Estado General
            </p>
            {chartData?.doughnut ? (
              <Doughnut data={chartData.doughnut} />
            ) : (
              <p>Cargando...</p>
            )}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Solicitudes por Tipo
            </p>
            {chartData?.bar ? <Bar data={chartData.bar} /> : <p>Cargando...</p>}
          </div>
        </div>
      </section>

      {/* LISTADOS */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="font-semibold mb-3 text-gray-700 dark:text-gray-200">
            Últimas Solicitudes
          </p>
          {solicitudes?.length ? (
            <ul className="text-sm space-y-2">
              {solicitudes.slice(0, 5).map((s, i) => (
                <li
                  key={i}
                  className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-1"
                >
                  <span>
                    {s.type_title || "Solicitud"} — #{s.id}
                  </span>
                  <span className="text-gray-500">
                    {new Date(s.created_at).toLocaleDateString("es-EC")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">No hay solicitudes recientes.</p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="font-semibold mb-3 text-gray-700 dark:text-gray-200">
            Movimientos de Inventario
          </p>
          {invData?.length ? (
            <ul className="text-sm space-y-2">
              {invData.map((m, i) => (
                <li
                  key={i}
                  className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-1"
                >
                  <span>
                    {m.tipo_movimiento} — Item #{m.item_id}
                  </span>
                  <span className="text-gray-500">{m.cantidad}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">No hay movimientos registrados.</p>
          )}
        </div>
      </section>

      {/* GRID SOLICITUDES */}
      {loading ? (
        <div className="text-gray-500 py-10 text-center">Cargando…</div>
      ) : (
        <SolicitudesGrid
          items={solicitudes}
          onView={handleView}
          onCancel={handleCancel}
        />
      )}

      {/* MODAL CREAR */}
      <CreateRequestModal
        open={modalOpen}
        onClose={closeRequestModal}
        onSubmit={handleCreate}
        presetType={presetRequestType}
      />

      <RequestDetailModal
        detail={detail}
        onClose={() =>
          setDetail({ open: false, loading: false, data: null, error: null })
        }
      />
    </motion.div>
  );
};

export default ComercialDashboard;

const RequestDetailModal = ({ detail, onClose }) => {
  if (!detail.open) return null;

  const request = detail.data?.request || {};
  const payload =
    typeof request.payload === "string"
      ? safeJSON(request.payload)
      : request.payload || {};
  const documents = Array.isArray(detail.data?.documents)
    ? detail.data.documents
    : [];
  const attachments = Array.isArray(detail.data?.attachments)
    ? detail.data.attachments
    : [];
  const inventario = Array.isArray(detail.data?.inventario)
    ? detail.data.inventario
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Solicitud #{request.id || "—"}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {request.type_title || request.type_name || "Detalle completo"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-gray-200 p-2 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            aria-label="Cerrar detalle"
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-6">
          {detail.loading ? (
            <p className="py-10 text-center text-gray-500 dark:text-gray-400">
              Cargando detalle…
            </p>
          ) : detail.error ? (
            <p className="py-10 text-center text-red-500">{detail.error}</p>
          ) : (
            <>
              <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Información general
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-200">
                    <li>
                      <span className="font-medium">Estado:</span>{" "}
                      {request.status || "—"}
                    </li>
                    <li>
                      <span className="font-medium">Tipo:</span>{" "}
                      {request.type_title || request.type_name || "—"}
                    </li>
                    <li>
                      <span className="font-medium">Creado:</span>{" "}
                      {request.created_at
                        ? new Date(request.created_at).toLocaleString("es-EC")
                        : "—"}
                    </li>
                    <li>
                      <span className="font-medium">Solicitante:</span>{" "}
                      {request.requester_email || "—"}
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Cliente
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-200">
                    <li>
                      <span className="font-medium">Nombre:</span>{" "}
                      {payload?.nombre_cliente || "—"}
                    </li>
                    <li>
                      <span className="font-medium">Contacto:</span>{" "}
                      {payload?.persona_contacto || "—"}
                    </li>
                    <li>
                      <span className="font-medium">Dirección:</span>{" "}
                      {payload?.direccion_cliente || "—"}
                    </li>
                    <li>
                      <span className="font-medium">Observación:</span>{" "}
                      {payload?.observacion || "—"}
                    </li>
                  </ul>
                </div>
              </section>

              <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                  <div className="mb-3 flex items-center gap-2">
                    <FiFileText />
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                      Documentos
                    </h3>
                  </div>
                  {documents.length ? (
                    <ul className="space-y-2 text-sm">
                      {documents.map((doc) => (
                        <li
                          key={`${doc.id || doc.doc_drive_id}`}
                          className="rounded-xl border border-gray-200 px-3 py-2 text-gray-700 dark:border-gray-700 dark:text-gray-200"
                        >
                          <p className="font-medium">
                            {doc.title || doc.name || "Documento"}
                          </p>
                          {doc.link || doc.doc_drive_id ? (
                            <a
                              href={doc.link || doc.doc_drive_id}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                            >
                              Abrir
                            </a>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Sin documentos generados.
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                  <div className="mb-3 flex items-center gap-2">
                    <FiPaperclip />
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                      Adjuntos
                    </h3>
                  </div>
                  {attachments.length ? (
                    <ul className="space-y-2 text-sm">
                      {attachments.map((file) => (
                        <li
                          key={file.id || file.drive_file_id}
                          className="rounded-xl border border-gray-200 px-3 py-2 text-gray-700 dark:border-gray-700 dark:text-gray-200"
                        >
                          <p className="font-medium">
                            {file.title || file.filename}
                          </p>
                          {file.drive_link && (
                            <a
                              href={file.drive_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                            >
                              Descargar
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No hay archivos cargados.
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                <div className="mb-3 flex items-center gap-2">
                  <FiPackage />
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                    Movimientos de inventario
                  </h3>
                </div>
                {inventario.length ? (
                  <ul className="divide-y divide-gray-200 text-sm dark:divide-gray-800">
                    {inventario.map((item, idx) => (
                      <li key={idx} className="flex justify-between py-2">
                        <span className="text-gray-700 dark:text-gray-200">
                          {item.tipo_movimiento || item.tipo} — Item #
                          {item.item_id || item.inventory_id}
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {item.cantidad || item.quantity || "–"}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Sin movimientos registrados para esta solicitud.
                  </p>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
