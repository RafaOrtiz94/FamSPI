import React from "react";
import { Outlet } from "react-router-dom";

import Footer from "../ui/components/Footer";
import Header from "../ui/components/Header";
import NavigationBar from "../ui/components/NavigationBar";

export default function DashboardLayout() {

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <Header />
      <NavigationBar />

      <main className="flex min-h-[calc(100vh-4rem)] flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-8">
          <div className="mx-auto w-full max-w-6xl rounded-3xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900/60">
            <Outlet />
          </div>
        </div>
        <Footer />
      </main>
    </div>
  );
}
