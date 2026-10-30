import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { AppProviders } from "./app/providers";
import { initializeMocks } from "./app/bootstrap";
import { createQueryClient } from "./app/query-client";
import { initializeAuth } from "./app/session";

async function startApplication() {
  await initializeMocks();
  initializeAuth();
  const root = document.getElementById("root");
  if (!root) throw new Error("Application root element was not found");
  createRoot(root).render(
    <StrictMode>
      <AppProviders queryClient={createQueryClient()} />
    </StrictMode>
  );
}

void startApplication();
