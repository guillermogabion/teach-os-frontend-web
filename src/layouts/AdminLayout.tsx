import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  CreditCard,
  Ticket,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  Megaphone,
} from "lucide-react";
import { useAuth } from "@/store/AuthContext";
import clsx from "clsx";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/users", label: "Users", icon: Users },
  { to: "/teachers", label: "Teachers", icon: GraduationCap },
  { to: "/payments", label: "Payments", icon: CreditCard },
  { to: "/vouchers", label: "Vouchers", icon: Ticket },
  { to: "/promo-campaigns", label: "Promo Campaigns", icon: Megaphone },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside
        className={clsx(
          "bg-brand text-white flex flex-col transition-all duration-200",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex items-center gap-2 h-16 px-4 border-b border-white/10">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="p-1.5 rounded hover:bg-white/10"
            aria-label="Toggle sidebar"
          >
            <Menu size={18} />
          </button>
          {!collapsed && <span className="font-semibold text-sm">TeachOS Admin</span>}
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                  isActive ? "bg-white/15 font-medium" : "hover:bg-white/10 text-white/85"
                )
              }
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/85 hover:bg-white/10"
          >
            <LogOut size={18} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <div className="text-sm text-slate-500">Admin Panel</div>
          <div className="text-sm text-slate-700">
            {user?.name ?? "—"}{" "}
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              {user?.role ?? ""}
            </span>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
