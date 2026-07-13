import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/store/AuthContext"; // TODO: point this at your actual auth hook/context

/**
 * Wraps admin-only routes. If there's no session, bounce to /login and
 * remember the URL the admin was actually trying to reach (e.g. the
 * magic link from a "payment pending" email) so we can send them back
 * there right after they log in.
 */
export function RequireAdmin() {
    // Auth context shape may vary; safely extract common possibilities.
    const auth = useAuth();
    const token = (auth as any)?.token ?? (auth as any)?.accessToken ?? (auth as any)?.session ?? null;
    const role = (auth as any)?.role ?? (auth as any)?.user?.role ?? null;
    const location = useLocation();

    if (!token) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}
