import React, { useMemo } from "react";
import { Outlet } from "react-router-dom";

import Footer from "../ui/components/Footer";
import Header from "../ui/components/Header";
import NavigationBar from "../ui/components/NavigationBar";
import ImportantAlertsPanel from "../ui/components/ImportantAlertsPanel";
import InternalLopdpConsentModal from "../ui/widgets/InternalLopdpConsentModal";
import { useAuth } from "../auth/AuthContext";

export default function DashboardLayout() {
  const { user } = useAuth();
  const lopdpPending = useMemo(
    () => (user?.lopdp_internal_status || "").toLowerCase() !== "granted",
    [user?.lopdp_internal_status]
  );

  return (
    <div
      className={`min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100 ${lopdpPending ? "overflow-hidden" : ""}`}
    >
      <InternalLopdpConsentModal forceOpen={lopdpPending} />
      <div className={lopdpPending ? "pointer-events-none select-none blur-[2px]" : ""}>
        <Header />
        <NavigationBar />

        <main className="flex min-h-[calc(100vh-4rem)] flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-8">
            <div className="mx-auto w-full max-w-6xl rounded-3xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900/60">
              <ImportantAlertsPanel />
              <Outlet />
            </div>
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
}
