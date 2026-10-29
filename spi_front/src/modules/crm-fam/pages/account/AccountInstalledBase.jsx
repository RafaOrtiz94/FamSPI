// Cuenta 360 · Base instalada: equipos y expedientes de compra del cliente de la cuenta (se enlazan
// por RUC con el registro de clientes) y sus expedientes de consumibles.
import { fetchAccountInstalledBase } from "../../../../core/api/crmFamApi";
import { OFFER_KINDS, PURCHASE_STATUS } from "../../components/OpportunityDialogs";
import { Badge, Btn, DataTable, EmptyState, ErrorNote, Panel, SkeletonRows, StatStrip } from "../../ui/kit";
import { date, number } from "../../ui/format";
import { useLoad } from "../../ui/useLoad";

const humanize = (value) => {
  const text = String(value || "").replaceAll("_", " ").toLowerCase();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "—";
};
const statusOf = (status) => PURCHASE_STATUS[status] || [humanize(status), "neutral"];
const kindOf = (item) => (item.type === "public_purchase" ? "Compra pública" : OFFER_KINDS[item.offer_kind] || "Compra privada");
const FILE_STATUS = { draft: ["Borrador", "neutral"], active: ["Activo", "success"], registered: ["Registrado", "success"], closed: ["Cerrado", "neutral"] };

export default function AccountInstalledBase({ accountId }) {
  const { data, loading, error, reload } = useLoad(() => fetchAccountInstalledBase(accountId), [accountId], { fallback: "No se pudo cargar la base instalada." });

  if (loading && !data) return <Panel flush><SkeletonRows rows={5} /></Panel>;
  if (error || !data) return <ErrorNote message={error || "Sin datos."} onRetry={reload} />;
  if (!data.has_identifier) {
    return (
      <Panel>
        <EmptyState title="La cuenta no tiene RUC" hint="Los equipos y consumibles se enlazan por el RUC o la cédula del cliente. Edita la cuenta y agrégalo para ver su base instalada." />
      </Panel>
    );
  }

  const installed = data.equipment.filter((e) => e.installed);
  const inProgress = data.equipment.filter((e) => !e.installed && !["rejected", "cancelled"].includes(e.status));
  const units = (list) => list.reduce((sum, e) => sum + Math.max(1, e.equipment.length), 0);

  return (
    <div className="space-y-6">
      <StatStrip
        items={[
          { label: "Equipos instalados", value: number(units(installed)), hint: `${number(installed.length)} expediente(s) entregado(s)` },
          { label: "En proceso", value: number(inProgress.length), hint: "expedientes de compra abiertos" },
          { label: "Expedientes de consumibles", value: number(data.consumables.length), hint: data.consumables.length ? "con sus pedidos" : "ninguno registrado" },
        ]}
      />

      <Panel title="Equipos y expedientes de compra" flush actions={<Btn size="sm" to="/dashboard/purchases/workspace">Abrir compras</Btn>}>
        {data.equipment.length === 0 ? (
          <EmptyState title="Sin equipos ni compras registradas" hint={data.client_ids.length ? "Este cliente aún no tiene expedientes de compra." : "No hay un cliente registrado con el RUC de esta cuenta."} />
        ) : (
          <DataTable
            caption="Equipos del cliente"
            columns={[
              { key: "equipment", header: "Equipo", render: (e) => (
                <div className="min-w-0">
                  <span className="font-medium">{e.equipment.length ? e.equipment.join(", ") : "Equipo sin detallar"}</span>
                  <div className="text-xs text-fam-muted">{kindOf(e)}{e.code ? ` · ${e.code}` : ""}</div>
                </div>
              ) },
              { key: "status", header: "Estado", render: (e) => (e.installed ? <Badge tone="success">Instalado</Badge> : <Badge tone={statusOf(e.status)[1]}>{statusOf(e.status)[0]}</Badge>) },
              { key: "delivered_at", header: "Entrega", hideBelow: "sm", render: (e) => <span className="fam-numeric">{e.delivered_at ? date(e.delivered_at) : "—"}</span> },
              { key: "contract_document_id", header: "Contrato", hideBelow: "md", render: (e) => (e.contract_document_id
                ? <a href={`https://drive.google.com/file/d/${encodeURIComponent(e.contract_document_id)}/view`} target="_blank" rel="noopener noreferrer" className="text-fam-action underline underline-offset-2">Ver contrato</a>
                : <span className="text-fam-muted">—</span>) },
              { key: "created_at", header: "Inicio", hideBelow: "lg", render: (e) => <span className="fam-numeric">{date(e.created_at)}</span> },
            ]}
            rows={data.equipment}
          />
        )}
      </Panel>

      <Panel title="Consumibles" hint="Expedientes de consumibles del cliente y sus pedidos" flush>
        {data.consumables.length === 0 ? (
          <EmptyState title="Sin expedientes de consumibles" hint="Cuando el cliente tenga un expediente de consumibles, aquí verás sus pedidos y la fecha del último." />
        ) : (
          <DataTable
            caption="Expedientes de consumibles"
            columns={[
              { key: "process_name", header: "Expediente", render: (f) => (<div><span className="font-medium">{f.process_name || "Sin nombre"}</span>{f.process_code && <div className="fam-id text-xs text-fam-muted">{f.process_code}</div>}</div>) },
              { key: "status", header: "Estado", render: (f) => { const [label, tone] = FILE_STATUS[f.status] || [humanize(f.status), "neutral"]; return <Badge tone={tone}>{label}</Badge>; } },
              { key: "orders_count", header: "Pedidos", align: "right", render: (f) => number(f.orders_count) },
              { key: "last_order_at", header: "Último pedido", hideBelow: "sm", render: (f) => <span className="fam-numeric">{f.last_order_at ? date(f.last_order_at) : "—"}</span> },
            ]}
            rows={data.consumables}
          />
        )}
      </Panel>
    </div>
  );
}
