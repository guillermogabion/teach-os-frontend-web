import { Navigate, Outlet } from "react-router-dom";
import { tokenStore } from "@/lib/api";

// Gate on presence of a stored access token rather than in-memory auth
// state, so a page refresh doesn't briefly bounce an authenticated user.
export function ProtectedRoute() {
  const hasToken = !!tokenStore.getAccess();
  if (!hasToken) return <Navigate to="/login" replace />;
  return <Outlet />;
}
