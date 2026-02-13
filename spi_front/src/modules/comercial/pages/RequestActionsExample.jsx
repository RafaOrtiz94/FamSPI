import React from "react";
import { motion } from "framer-motion";
import {
  RequestActionCard,
  RequestActionButton,
  RequestActionGrid,
  REQUEST_TYPES
} from "../../../core/ui/components/RequestActionCards";

/**
 * RequestActionsExample Component
 * ------------------------------------------------------------------
 * Página de ejemplo que muestra todos los tipos de botones de solicitud
 * disponibles para implementar en diferentes páginas del sistema.
 */

const RequestActionsExample = () => {
  // Ejemplo de acciones para una página específica
  const clientPageActions = [
    { type: "CLIENT" }
  ];

  const purchasePageActions = [
    { type: "PUBLIC_PURCHASE" },
    { type: "PRIVATE_PURCHASE" }
  ];

  const businessPageActions = [
    { type: "BUSINESS_CASE" }
  ];

  const servicePageActions = [
    { type: "MAINTENANCE" },
    { type: "EQUIPMENT" }
  ];

  const hrPageActions = [
    { type: "PERMISSION" }
  ];

  const allActions = [
    { type: "CLIENT" },
    { type: "PUBLIC_PURCHASE" },
    { type: "PRIVATE_PURCHASE" },
    { type: "BUSINESS_CASE" },
    { type: "MAINTENANCE" },
    { type: "EQUIPMENT" },
    { type: "PERMISSION" }
  ];

  return (
    <div className="p-8 space-y-12 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🎯 Botones de Solicitud Premium
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Componentes elegantes y consistentes para crear solicitudes en cada página del sistema.
            Diseño empresarial con gradientes y animaciones sutiles.
          </p>
        </div>

        {/* Tipos de Componentes */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">📋 Tipos de Componentes</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* RequestActionCard */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">🎨 RequestActionCard</h3>
              <p className="text-gray-600 mb-4">
                Tarjeta completa con gradientes, íconos y descripciones detalladas.
                Abre modales o navega según el tipo de solicitud.
              </p>
              <RequestActionCard type="CLIENT" className="max-w-sm" />
            </div>

            {/* RequestActionButton */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">🔘 RequestActionButton</h3>
              <p className="text-gray-600 mb-4">
                Botón premium con gradientes y efectos hover.
                Abre modales para solicitudes rápidas.
              </p>
              <RequestActionButton type="PERMISSION" />
            </div>
          </div>
        </section>

        {/* Ejemplos por Página */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">📄 Ejemplos por Página</h2>

          <div className="space-y-12">
            {/* Gestión de Clientes */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                👥 Gestión de Clientes
              </h3>
              <p className="text-gray-600 mb-4">
                Página: <code className="bg-gray-100 px-2 py-1 rounded">/dashboard/comercial/clientes</code> →
                Redirige a: <code className="bg-blue-100 px-2 py-1 rounded">/dashboard/comercial/new-client-request</code>
              </p>
              <RequestActionGrid actions={clientPageActions} columns={1} />
            </div>

            {/* Compras Públicas */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                🛒 Compras Públicas (ACP)
              </h3>
              <p className="text-gray-600 mb-4">
                Página: <code className="bg-gray-100 px-2 py-1 rounded">/dashboard/comercial/acp-compras</code> →
                Redirige a: <code className="bg-emerald-100 px-2 py-1 rounded">/dashboard/comercial/acp-compras</code>
              </p>
              <RequestActionGrid actions={purchasePageActions} columns={2} />
            </div>

            {/* Compras Privadas */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                💼 Compras Privadas
              </h3>
              <p className="text-gray-600 mb-4">
                Página: <code className="bg-gray-100 px-2 py-1 rounded">/dashboard/backoffice/private-purchases</code> →
                Redirige a: <code className="bg-purple-100 px-2 py-1 rounded">/dashboard/backoffice/private-purchases</code>
              </p>
              <RequestActionButton type="PRIVATE_PURCHASE" />
            </div>

            {/* Business Case */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                📊 Business Case
              </h3>
              <p className="text-gray-600 mb-4">
                Página: <code className="bg-gray-100 px-2 py-1 rounded">/dashboard/business-case</code> →
                Redirige a: <code className="bg-indigo-100 px-2 py-1 rounded">/dashboard/business-case/workspace</code>
              </p>
              <RequestActionCard type="BUSINESS_CASE" size="compact" />
            </div>

            {/* Servicio Técnico */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                🔧 Servicio Técnico
              </h3>
              <p className="text-gray-600 mb-4">
                Página: <code className="bg-gray-100 px-2 py-1 rounded">/dashboard/servicio-tecnico</code> →
                Redirige a: <code className="bg-orange-100 px-2 py-1 rounded">/dashboard/servicio-tecnico/mantenimientos</code> |
                <code className="bg-cyan-100 px-2 py-1 rounded">/dashboard/servicio-tecnico/equipos</code>
              </p>
              <RequestActionGrid actions={servicePageActions} columns={2} />
            </div>

            {/* Recursos Humanos */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                👤 Recursos Humanos
              </h3>
              <p className="text-gray-600 mb-4">
                Página: <code className="bg-gray-100 px-2 py-1 rounded">/dashboard/talento-humano</code> →
                Redirige a: <code className="bg-teal-100 px-2 py-1 rounded">/dashboard/talento-humano/permisos</code>
              </p>
              <RequestActionButton type="PERMISSION" />
            </div>
          </div>
        </section>

        {/* Todos los Tipos Disponibles */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">🎯 Todos los Tipos Disponibles</h2>

          <RequestActionGrid actions={allActions} columns={3} size="compact" />

          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">📚 Implementación</h3>
            <div className="space-y-3 text-blue-800">
              <p>
                <strong>1. Importar:</strong> <code className="bg-blue-100 px-2 py-1 rounded text-sm">import &#123; RequestActionButton &#125; from "../../../core/ui/components/RequestActionCards";</code>
              </p>
              <p>
                <strong>2. Usar:</strong> <code className="bg-blue-100 px-2 py-1 rounded text-sm"><RequestActionButton type="CLIENT" /></code>
              </p>
              <p>
                <strong>3. Personalizar:</strong> Props disponibles: <code>type</code>, <code>size</code>, <code>variant</code>, <code>className</code>, <code>onClick</code>
              </p>
            </div>
          </div>
        </section>

        {/* Características */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">✨ Características</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="text-2xl mb-3">🎨</div>
              <h3 className="font-semibold text-gray-900 mb-2">Diseño Premium</h3>
              <p className="text-gray-600 text-sm">
                Gradientes elegantes, animaciones sutiles y tipografía consistente.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="text-2xl mb-3">📱</div>
              <h3 className="font-semibold text-gray-900 mb-2">Responsive</h3>
              <p className="text-gray-600 text-sm">
                Se adapta perfectamente a todos los tamaños de pantalla.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="text-2xl mb-3">♿</div>
              <h3 className="font-semibold text-gray-900 mb-2">Accesible</h3>
              <p className="text-gray-600 text-sm">
                Etiquetas ARIA, navegación por teclado y contraste adecuado.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="text-2xl mb-3">🔧</div>
              <h3 className="font-semibold text-gray-900 mb-2">Configurable</h3>
              <p className="text-gray-600 text-sm">
                Múltiples tamaños, variantes y opciones de personalización.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="text-2xl mb-3">⚡</div>
              <h3 className="font-semibold text-gray-900 mb-2">Optimizado</h3>
              <p className="text-gray-600 text-sm">
                Animaciones eficientes y carga rápida sin afectar performance.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="text-2xl mb-3">🔄</div>
              <h3 className="font-semibold text-gray-900 mb-2">Actualizable</h3>
              <p className="text-gray-600 text-sm">
                Fácil agregar nuevos tipos de solicitud sin modificar código existente.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default RequestActionsExample;
