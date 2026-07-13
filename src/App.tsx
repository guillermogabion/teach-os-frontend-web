import { Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/store/AuthContext";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import AdminLayout from "@/layouts/AdminLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import UsersPage from "@/pages/UsersPage";
import SettingsPage from "@/pages/SettingsPage";
import PlaceholderPage from "@/pages/PlaceholderPage";
import { RequireAdmin } from "@/components/RequireAdmin";
import PaymentDetail from "@/components/PaymentDetail";
import PaymentsPage from "./pages/PaymentsPage";
import VouchersPage from "./pages/VouchersPage";
import PromoCampaignsPage from "./pages/PromoCampaignsPage";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<RequireAdmin />}>
            <Route path="/admin/payments/:id" element={<PaymentDetail />} />
            {/* your other existing admin routes */}
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/teachers" element={<PlaceholderPage title="Teacher Management" />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/vouchers" element={<VouchersPage />} />
              <Route path="/promo-campaigns" element={<PromoCampaignsPage />} />
              <Route path="/analytics" element={<PlaceholderPage title="Analytics" />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </QueryClientProvider>
  );
}