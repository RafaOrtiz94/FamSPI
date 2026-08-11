import React, { useMemo, useRef, useState } from "react";
import { Outlet } from "react-router-dom";

import Footer from "../ui/components/Footer";
import Header from "../ui/components/Header";
import NavigationBar from "../ui/components/NavigationBar";
import NotificationBell from "../ui/components/NotificationBell";
import HelpTicketFab from "../ui/components/HelpTicketFab";
import FamSignFab from "../ui/components/FamSignFab";
import MobileFabDock from "../ui/components/MobileFabDock";
import PwaAvailabilityBanner from "../ui/components/PwaAvailabilityBanner";
import OnboardingConsentGate from "../ui/widgets/OnboardingConsentGate";
import { RequestModalProvider } from "../ui/components/RequestActionCards";
import { useAuth } from "../auth/AuthContext";
import AttendanceWidget from "../ui/widgets/AttendanceWidget";
import KickoffRankingFab from "../../modules/kickoff/components/KickoffRankingFab";
import { GoogleMapsProvider } from "../contexts/GoogleMapsContext";

export default function DashboardLayout() {
 const { user } = useAuth();
 const lopdpPending = useMemo(
 () => (user?.lopdp_internal_status || "").toLowerCase() !== "granted",
 [user?.lopdp_internal_status]
 );

  const famSignRef = useRef(null);
  const helpTicketRef = useRef(null);
  const [famSignCount, setFamSignCount] = useState(0);

  return (
    <div
      className={`min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100 ${lopdpPending ? "overflow-hidden" : ""}`}
    >
      <OnboardingConsentGate forceOpen={lopdpPending} />
      <RequestModalProvider />
      <div className={lopdpPending ? "pointer-events-none select-none blur-[2px]" : ""}>
        <Header />
        <PwaAvailabilityBanner />
        <NavigationBar />
        <FamSignFab ref={famSignRef} onCountChange={setFamSignCount} />
        <HelpTicketFab ref={helpTicketRef} />
        <MobileFabDock famSignRef={famSignRef} helpTicketRef={helpTicketRef} famSignCount={famSignCount} />
        <NotificationBell />
        <AttendanceWidget />
        <KickoffRankingFab />

        <GoogleMapsProvider>
          <main className="flex min-h-[calc(100vh-4rem)] flex-col">
            <div className="flex-1 overflow-y-auto px-2 py-2 sm:px-4 sm:py-4 lg:px-6 lg:py-6 2xl:px-8">
              <div className="w-full min-w-0 bg-transparent">
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
