import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface Overview {
  totalUsers: number;
  activeTeachers: number;
  premiumSubs: number;
  trialSubs: number;
  newUsersToday: number;
  totalRevenue: number;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: async () => (await api.get<Overview>("/dashboard/overview")).data,
  });

  if (isLoading) return <p className="text-sm text-slate-500">Loading overview…</p>;
  if (isError || !data)
    return <p className="text-sm text-red-600">Couldn't load dashboard data.</p>;

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Overview</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Users" value={data.totalUsers} />
        <StatCard label="Active Teachers" value={data.activeTeachers} />
        <StatCard label="Premium Subscriptions" value={data.premiumSubs} />
        <StatCard label="Trial Subscriptions" value={data.trialSubs} />
        <StatCard label="New Users Today" value={data.newUsersToday} />
        <StatCard label="Total Revenue" value={`₱${data.totalRevenue.toLocaleString()}`} />
      </div>
    </div>
  );
}
