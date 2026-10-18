import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./App";
import { ToastProvider } from "./components/ui/toast";
import { DemoModeProvider } from "./hooks/useDemoMode";
import { SettingsProvider } from "./hooks/useSettings";
import "./index.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("FaceRecall could not find its root element.");
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <SettingsProvider>
          <DemoModeProvider>
            <App />
          </DemoModeProvider>
        </SettingsProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
