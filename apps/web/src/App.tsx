import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { RequireAuth } from "@/components/RequireAuth";
import DashboardPage from "@/pages/DashboardPage";
import EquipmentDetailPage from "@/pages/EquipmentDetailPage";
import HubRecordPage from "@/pages/HubRecordPage";
import LocationDetailPage from "@/pages/LocationDetailPage";
import LoginPage from "@/pages/LoginPage";
import OmnihubsPage from "@/pages/OmnihubsPage";
import StoreDetailPage from "@/pages/StoreDetailPage";
import StoresPage from "@/pages/StoresPage";
import TemplateDetailPage from "@/pages/TemplateDetailPage";
import TemplatesPage from "@/pages/TemplatesPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/stores" element={<StoresPage />} />
          <Route path="/stores/:id" element={<StoreDetailPage />} />
          <Route path="/locations/:id" element={<LocationDetailPage />} />
          <Route path="/equipments/:id" element={<EquipmentDetailPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/templates/:id" element={<TemplateDetailPage />} />
          <Route path="/omnihubs" element={<OmnihubsPage />} />
          <Route path="/omnihubs/:id/record" element={<HubRecordPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
