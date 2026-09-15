import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../core/auth/AuthContext";

const PLAN_ROLES = ["comercial", "jefe_comercial"];

const TABS = [
  { label: "Clientes", path: "/dashboard/comercial/clientes" },
  { label: "Planificacion", path: "/dashboard/comercial/planificacion", planOnly: true },
];

export default function ClientesPlanShell() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const canPlan = PLAN_ROLES.includes(user?.role);
  const tabs = TABS.filter(t => !t.planOnly || canPlan);

  return (
    <div className="flex flex-col">
      <div className="bg-white border-b border-[#E5E7EB] sm:-mx-6 sm:-mt-6">
        <div className="overflow-x-auto sm:px-6" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          <div className="flex min-w-max">
            {tabs.map(tab => {
              const active = location.pathname.startsWith(tab.path);
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className={[
                    "px-4 py-3 text-sm font-medium cursor-pointer whitespace-nowrap border-b-2 transition-colors",
                    active
                      ? "text-[#2563EB] border-[#2563EB]"
                      : "text-[#6B7280] border-transparent hover:text-[#1F2937]",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="sm:pt-6">
        <Outlet />
      </div>
    </div>
  );
}
