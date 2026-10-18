import { Navigate, Route, Routes } from "react-router-dom";

import { ErrorBoundary } from "./components/app/ErrorBoundary";
import { AppLayout } from "./layouts/AppLayout";
import { PublicLayout } from "./layouts/PublicLayout";
import { AboutPage } from "./pages/About";
import { DashboardPage } from "./pages/Dashboard";
import { DocsPage } from "./pages/Docs";
import { HistoryPage } from "./pages/History";
import { LandingPage } from "./pages/Landing";
import { NotFoundPage } from "./pages/NotFound";
import { PeoplePage } from "./pages/People";
import { PersonEditPage } from "./pages/PersonEdit";
import { PersonNewPage } from "./pages/PersonNew";
import { PersonProfilePage } from "./pages/PersonProfile";
import { PrivacyPage } from "./pages/Privacy";
import { RecognizePage } from "./pages/Recognize";
import { SettingsPage } from "./pages/Settings";

export function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/docs" element={<DocsPage />} />
        </Route>

        <Route element={<AppLayout />}>
          <Route path="/app" element={<DashboardPage />} />
          <Route path="/recognize" element={<RecognizePage />} />
          <Route path="/people" element={<PeoplePage />} />
          <Route path="/people/new" element={<PersonNewPage />} />
          <Route path="/people/:id" element={<PersonProfilePage />} />
          <Route path="/people/:id/edit" element={<PersonEditPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        <Route path="/index.html" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
