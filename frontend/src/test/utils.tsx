import type { ReactElement } from "react";
import { render, type RenderResult } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { ToastProvider } from "../components/ui/toast";
import { DemoModeProvider } from "../hooks/useDemoMode";
import { SettingsProvider } from "../hooks/useSettings";

export function renderWithProviders(ui: ReactElement, route = "/"): RenderResult {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>
        <SettingsProvider>
          <DemoModeProvider>{ui}</DemoModeProvider>
        </SettingsProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}
