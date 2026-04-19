import React, { useMemo } from "react";
import { Outlet } from "react-router-dom";

import Footer from "../ui/components/Footer";
import Header from "../ui/components/Header";
import NavigationBar from "../ui/components/NavigationBar";
import NotificationBell from "../ui/components/NotificationBell";
import HelpTicketFab from "../ui/components/HelpTicketFab";
import InternalLopdpConsentModal from "../ui/widgets/InternalLopdpConsentModal";
import { RequestModalProvider } from "../ui/components/RequestActionCards";
import { useAuth } from "../auth/AuthContext";
import AttendanceWidget from "../ui/widgets/AttendanceWidget";
import { GoogleMapsProvider } from "../contexts/GoogleMapsContext";

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
      <RequestModalProvider />
      <div className={lopdpPending ? "pointer-events-none select-none blur-[2px]" : ""}>
        <Header />
        <NavigationBar />
        <HelpTicketFab />
        <NotificationBell />
        <AttendanceWidget />

        <GoogleMapsProvider>
          <main className="flex min-h-[calc(100vh-4rem)] flex-col">
            <div className="flex-1 overflow-y-auto px-2 py-2 sm:px-8 sm:py-8">
              <div className="w-full bg-transparent px-2 py-2 sm:mx-auto sm:max-w-6xl sm:rounded-3xl sm:border sm:border-slate-200 sm:bg-white sm:p-6 sm:shadow-lg dark:sm:border-slate-800 dark:sm:bg-slate-900/60">
                <Outlet />
              </div>
            </div>
            <Footer />
          </main>
        </GoogleMapsProvider>
      </div>
    </div>
  );
}
