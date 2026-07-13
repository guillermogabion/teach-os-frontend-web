import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface UserRow {
  id: string;
  name: string;
  email: string;
  isSuspended: boolean;
  role: { id: string; name: string };
}

interface RoleOption {
  id: string;
  name: string;
  description: string | null;
}

const getRoleBadgeStyle = (roleName: string) => {
  switch (roleName) {
    case "Super Admin":
      return "bg-purple-100 text-purple-700 border-purple-200";
    case "Admin":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "Support Staff":
      return "bg-orange-100 text-orange-800 border-orange-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
};

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    roleId: "",
  });

  // 1. Fetch Users
  const { data, isLoading, isError } = useQuery({
    queryKey: ["users", search, page],
    queryFn: async () =>
      (
        await api.get("/users", {
          params: { search: search || undefined, page, pageSize: 10 },
        })
      ).data as { items: UserRow[]; total: number; page: number; pageSize: number },
  });

  // 2. Fetch Roles (For the Add User dropdown selection)
  const { data: roles, isLoading: isLoadingRoles } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await api.get("/users/roles")).data as RoleOption[],
  });

  // 3. Mutations
  const createUser = useMutation({
    mutationFn: (newUser: typeof formData) => api.post("/users", newUser),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setIsModalOpen(false);
      setFormData({ name: "", email: "", password: "", roleId: "" });
    },
  });

  const suspendUser = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/suspend`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const unsuspendUser = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/unsuspend`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  // Handlers
  const handleToggleSuspend = (user: UserRow) => {
    if (user.isSuspended) {
      unsuspendUser.mutate(user.id);
    } else {
      if (confirm(`Are you sure you want to suspend ${user.name}?`)) {
        suspendUser.mutate(user.id);
      }
    }
  };

  const handleDelete = (user: UserRow) => {
    if (confirm(`CRITICAL: Are you sure you want to permanently delete ${user.name}?`)) {
      deleteUser.mutate(user.id);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password || !formData.roleId) {
      alert("Please fill in all fields.");
      return;
    }
    createUser.mutate(formData);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">View and manage system users, roles, and privileges.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Search name or email…"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-brand shadow-sm transition-shadow"
          />
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors shadow-sm text-center"
          >
            Add New User
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">User</th>
                <th className="px-6 py-4 font-semibold">Role</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr>
                  <td className="px-6 py-8 text-center text-slate-400" colSpan={4}>
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-brand border-t-transparent animate-spin" />
                      Loading users…
                    </div>
                  </td>
                </tr>
              )}

              {isError && (
                <tr>
                  <td className="px-6 py-8 text-center text-red-500 bg-red-50" colSpan={4}>
                    Failed to load users. Please check your connection and try again.
                  </td>
                </tr>
              )}

              {data?.items.length === 0 && (
                <tr>
                  <td className="px-6 py-8 text-center text-slate-500" colSpan={4}>
                    No users found matching your search.
                  </td>
                </tr>
              )}

              {data?.items.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{u.name}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{u.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${getRoleBadgeStyle(u.role?.name)}`}>
                      {u.role?.name || "User"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${u.isSuspended
                        ? "bg-red-50 text-red-700 border border-red-100"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                        }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${u.isSuspended ? 'bg-red-500' : 'bg-emerald-500'}`} />
                      {u.isSuspended ? "Suspended" : "Active"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => handleToggleSuspend(u)}
                        disabled={suspendUser.isPending || unsuspendUser.isPending}
                        className={`text-sm font-medium transition-colors ${u.isSuspended ? "text-emerald-600 hover:text-emerald-800" : "text-amber-600 hover:text-amber-800"
                          } disabled:opacity-50`}
                      >
                        {u.isSuspended ? "Activate" : "Suspend"}
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={deleteUser.isPending}
                        className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-slate-500">
            Showing <span className="font-medium">{(page - 1) * data.pageSize + 1}</span> to <span className="font-medium">{Math.min(page * data.pageSize, data.total)}</span> of <span className="font-medium">{data.total}</span> users
          </div>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            <button
              disabled={page * data.pageSize >= data.total}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* --- ADD USER MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Create New User / Admin</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-medium text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@teachos.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Assigned Role</label>
                <select
                  required
                  value={formData.roleId}
                  onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                  disabled={isLoadingRoles}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="" disabled>
                    {isLoadingRoles ? "Loading roles..." : "Select a system role..."}
                  </option>

                  {roles?.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createUser.isPending}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {createUser.isPending ? "Creating..." : "Save User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}