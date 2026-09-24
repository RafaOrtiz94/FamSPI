// src/App.js
import React from "react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./core/auth/AuthContext";
import { PwaStatusProvider } from "./core/pwa/PwaStatusContext";
import { UIProvider } from "./core/ui/UIContext";
import { NotificationProvider } from "./core/ui/NotificationContext";
import AppRoutes from "./routes/AppRoutes"; // ✅ Importa el archivo correcto
import { Toaster } from "react-hot-toast";
import "bootstrap/dist/css/bootstrap.min.css";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <UIProvider>
      <PwaStatusProvider>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <NotificationProvider>
              <BrowserRouter>
                <AppRoutes />
                <Toaster
                  position="top-right"
                  containerStyle={{
                    zIndex: 100000,
                  }}
                  toastOptions={{
                    style: {
                      background: "#fff",
                      color: "#1f2937",
                      borderRadius: "0.75rem",
                      padding: "0.75rem 1rem",
                      boxShadow: "0 5px 20px rgba(0,0,0,0.08)",
                    },
                  }}
                />
              </BrowserRouter>
            </NotificationProvider>
          </QueryClientProvider>
        </AuthProvider>
      </PwaStatusProvider>
    </UIProvider>
  );
}

export default App;
