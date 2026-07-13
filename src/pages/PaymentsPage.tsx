import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import ConfirmDialog from "@/components/ConfirmDialog";

interface PaymentRow {
    id: string;
    status: "PENDING" | "PAID" | "EXPIRED" | "FAILED" | "REFUNDED";
    amount: number;
    currency: string;
    provider: string;
    buyerEmail: string | null;
    buyerName: string | null;
    createdAt: string;
    plan?: { name: string } | null;
}

const STATUS_FILTERS = ["ALL", "PENDING", "PAID", "EXPIRED", "FAILED", "REFUNDED"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const getStatusBadgeStyle = (status: PaymentRow["status"]) => {
    switch (status) {
        case "PAID":
            return "bg-emerald-50 text-emerald-700 border-emerald-100";
        case "PENDING":
            return "bg-amber-50 text-amber-700 border-amber-100";
        case "FAILED":
            return "bg-red-50 text-red-700 border-red-100";
        case "REFUNDED":
            return "bg-slate-100 text-slate-600 border-slate-200";
        case "EXPIRED":
            return "bg-orange-50 text-orange-700 border-orange-100";
        default:
            return "bg-slate-100 text-slate-700 border-slate-200";
    }
};

function formatDate(iso: string) {
    return new Date(iso).toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

export default function PaymentsPage() {
    const [status, setStatus] = useState<StatusFilter>("ALL");
    const [page, setPage] = useState(1);
    // The list endpoint only filters by status server-side (no free-text
    // search param on payments yet), so this just narrows what's already
    // on the current page — it resets whenever page/status changes.
    const [pageFilter, setPageFilter] = useState("");
    const queryClient = useQueryClient();

    const [confirmTarget, setConfirmTarget] = useState<{ id: string; action: "reject" | "refund" } | null>(null);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["payments", status, page],
        queryFn: async () =>
            (
                await api.get("/payments", {
                    params: {
                        status: status === "ALL" ? undefined : status,
                        page,
                        pageSize: 10,
                    },
                })
            ).data as { items: PaymentRow[]; total: number; page: number; pageSize: number },
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["payments"] });

    const approvePayment = useMutation({
        mutationFn: (id: string) => api.post(`/payments/${id}/approve`),
        onSuccess: invalidate,
    });

    const rejectPayment = useMutation({
        mutationFn: (id: string) => api.post(`/payments/${id}/reject`),
        onSuccess: () => {
            invalidate();
            setConfirmTarget(null);
        },
    });

    const refundPayment = useMutation({
        mutationFn: (id: string) => api.post(`/payments/${id}/refund`),
        onSuccess: () => {
            invalidate();
            setConfirmTarget(null);
        },
    });

    const isActing = rejectPayment.isPending || refundPayment.isPending;

    const visibleItems = data?.items.filter((p) => {
        if (!pageFilter.trim()) return true;
        const needle = pageFilter.trim().toLowerCase();
        return (
            p.id.toLowerCase().includes(needle) ||
            p.buyerEmail?.toLowerCase().includes(needle) ||
            p.buyerName?.toLowerCase().includes(needle)
        );
    });

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        All recorded purchase attempts — GCash, PayMongo, Stripe, and Maya.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <input
                        value={pageFilter}
                        onChange={(e) => setPageFilter(e.target.value)}
                        placeholder="Filter this page by buyer or ID…"
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-brand shadow-sm transition-shadow"
                    />
                    <select
                        value={status}
                        onChange={(e) => {
                            setPage(1);
                            setStatus(e.target.value as StatusFilter);
                        }}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand shadow-sm"
                    >
                        {STATUS_FILTERS.map((s) => (
                            <option key={s} value={s}>
                                {s === "ALL" ? "All statuses" : s.charAt(0) + s.slice(1).toLowerCase()}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Buyer</th>
                                <th className="px-6 py-4 font-semibold">Plan</th>
                                <th className="px-6 py-4 font-semibold">Amount</th>
                                <th className="px-6 py-4 font-semibold">Provider</th>
                                <th className="px-6 py-4 font-semibold">Status</th>
                                <th className="px-6 py-4 font-semibold">Date</th>
                                <th className="px-6 py-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading && (
                                <tr>
                                    <td className="px-6 py-8 text-center text-slate-400" colSpan={7}>
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 rounded-full border-2 border-brand border-t-transparent animate-spin" />
                                            Loading payments…
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {isError && (
                                <tr>
                                    <td className="px-6 py-8 text-center text-red-500 bg-red-50" colSpan={7}>
                                        Failed to load payments. Please check your connection and try again.
                                    </td>
                                </tr>
                            )}

                            {!isLoading && !isError && visibleItems?.length === 0 && (
                                <tr>
                                    <td className="px-6 py-8 text-center text-slate-500" colSpan={7}>
                                        No payments found.
                                    </td>
                                </tr>
                            )}

                            {visibleItems?.map((p) => (
                                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="text-slate-500 text-xs mt-0.5">{p.buyerEmail || "no email provided"}</div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-700">{p.plan?.name ?? "—"}</td>
                                    <td className="px-6 py-4 text-slate-900 font-medium">
                                        {p.currency} {p.amount.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-slate-700">{p.provider}</td>
                                    <td className="px-6 py-4">
                                        <span
                                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${getStatusBadgeStyle(
                                                p.status
                                            )}`}
                                        >
                                            {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 text-xs whitespace-nowrap">{formatDate(p.createdAt)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-3">
                                            <Link
                                                to={`/admin/payments/${p.id}`}
                                                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                                            >
                                                View
                                            </Link>

                                            {p.status === "PENDING" && (
                                                <>
                                                    <span className="text-slate-300">|</span>
                                                    <button
                                                        onClick={() => approvePayment.mutate(p.id)}
                                                        disabled={approvePayment.isPending}
                                                        className="text-sm font-medium text-emerald-600 hover:text-emerald-800 transition-colors disabled:opacity-50"
                                                    >
                                                        Approve
                                                    </button>
                                                    <span className="text-slate-300">|</span>
                                                    <button
                                                        onClick={() => setConfirmTarget({ id: p.id, action: "reject" })}
                                                        disabled={isActing}
                                                        className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors disabled:opacity-50"
                                                    >
                                                        Reject
                                                    </button>
                                                </>
                                            )}

                                            {p.status === "PAID" && (
                                                <>
                                                    <span className="text-slate-300">|</span>
                                                    <button
                                                        onClick={() => setConfirmTarget({ id: p.id, action: "refund" })}
                                                        disabled={isActing}
                                                        className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors disabled:opacity-50"
                                                    >
                                                        Refund
                                                    </button>
                                                </>
                                            )}
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
                        Showing <span className="font-medium">{(page - 1) * data.pageSize + 1}</span> to{" "}
                        <span className="font-medium">{Math.min(page * data.pageSize, data.total)}</span> of{" "}
                        <span className="font-medium">{data.total}</span> payments
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

            <ConfirmDialog
                open={confirmTarget !== null}
                title={confirmTarget?.action === "refund" ? "Refund this payment?" : "Reject this payment?"}
                description={
                    confirmTarget?.action === "refund"
                        ? "This marks the payment as REFUNDED. It won't revoke any license already issued — do that separately from the Licenses page if needed."
                        : "This marks the payment as FAILED. No license will be issued for it."
                }
                confirmLabel={confirmTarget?.action === "refund" ? "Refund" : "Reject"}
                danger
                isLoading={isActing}
                onCancel={() => setConfirmTarget(null)}
                onConfirm={() => {
                    if (!confirmTarget) return;
                    if (confirmTarget.action === "refund") refundPayment.mutate(confirmTarget.id);
                    else rejectPayment.mutate(confirmTarget.id);
                }}
            />
        </div>
    );
}