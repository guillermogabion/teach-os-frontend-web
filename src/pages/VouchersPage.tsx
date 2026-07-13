import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Plan {
    id: string;
    name: string;
    price: number;
}

interface Campaign {
    id: string;
    name: string;
}

interface Voucher {
    id: string;
    code: string;
    name: string;
    description: string | null;
    discountType: "PERCENTAGE" | "FIXED";
    discountAmount: number;
    bonusDays: number;
    maxUsage: number;
    currentUsage: number;
    expiresAt: string | null;
    isActive: boolean;
    firstTimeOnly: boolean;
    premiumOnly: boolean;
    eligiblePlans: Plan[];
    campaign: Campaign | null;
}

interface VoucherFormData {
    code: string;
    name: string;
    description: string;
    discountType: "PERCENTAGE" | "FIXED";
    discountAmount: string;
    bonusDays: string;
    maxUsage: string;
    expiresAt: string;
    isActive: boolean;
    firstTimeOnly: boolean;
    premiumOnly: boolean;
    eligiblePlanIds: string[];
    campaignId: string;
}

const EMPTY_FORM: VoucherFormData = {
    code: "",
    name: "",
    description: "",
    discountType: "PERCENTAGE",
    discountAmount: "0",
    bonusDays: "0",
    maxUsage: "0",
    expiresAt: "",
    isActive: true,
    firstTimeOnly: false,
    premiumOnly: false,
    eligiblePlanIds: [],
    campaignId: "",
};

function formatVoucherSummary(v: Voucher): string {
    const parts: string[] = [];
    if (v.discountType === "PERCENTAGE" && v.discountAmount > 0) parts.push(`${v.discountAmount}% off`);
    if (v.discountType === "FIXED" && v.discountAmount > 0) parts.push(`₱${v.discountAmount.toLocaleString()} off`);
    if (v.bonusDays > 0) parts.push(`+${v.bonusDays} bonus day${v.bonusDays === 1 ? "" : "s"}`);
    return parts.length ? parts.join(" · ") : "No effect configured";
}

function getVoucherStatus(v: Voucher): { label: string; style: string } {
    if (!v.isActive) return { label: "Inactive", style: "bg-slate-100 text-slate-600 border-slate-200" };
    if (v.expiresAt && new Date(v.expiresAt) < new Date())
        return { label: "Expired", style: "bg-orange-50 text-orange-700 border-orange-100" };
    if (v.maxUsage > 0 && v.currentUsage >= v.maxUsage)
        return { label: "Used up", style: "bg-red-50 text-red-700 border-red-100" };
    return { label: "Active", style: "bg-emerald-50 text-emerald-700 border-emerald-100" };
}

export default function VouchersPage() {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<VoucherFormData>(EMPTY_FORM);
    const [deleteTarget, setDeleteTarget] = useState<Voucher | null>(null);
    const queryClient = useQueryClient();

    const { data, isLoading, isError } = useQuery({
        queryKey: ["vouchers", search, page],
        queryFn: async () =>
            (
                await api.get("/vouchers", { params: { search: search || undefined, page, pageSize: 10 } })
            ).data as { items: Voucher[]; total: number; page: number; pageSize: number },
    });

    // Assumes a `/plans` endpoint listing SubscriptionPlan rows exists
    // elsewhere in the admin API — swap the path if yours differs.
    const { data: plans } = useQuery({
        queryKey: ["plans"],
        queryFn: async () => (await api.get("/plans")).data as Plan[],
    });

    const { data: campaigns } = useQuery({
        queryKey: ["promo-campaigns"],
        queryFn: async () => (await api.get("/promo-campaigns")).data as Campaign[],
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["vouchers"] });

    const createVoucher = useMutation({
        mutationFn: (payload: unknown) => api.post("/vouchers", payload),
        onSuccess: () => {
            invalidate();
            closeModal();
        },
    });

    const updateVoucher = useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: unknown }) => api.patch(`/vouchers/${id}`, payload),
        onSuccess: () => {
            invalidate();
            closeModal();
        },
    });

    const toggleVoucher = useMutation({
        mutationFn: (id: string) => api.post(`/vouchers/${id}/toggle`),
        onSuccess: invalidate,
    });

    const deleteVoucher = useMutation({
        mutationFn: (id: string) => api.delete(`/vouchers/${id}`),
        onSuccess: () => {
            invalidate();
            setDeleteTarget(null);
        },
    });

    function openCreateModal() {
        setEditingId(null);
        setFormData(EMPTY_FORM);
        setIsModalOpen(true);
    }

    function openEditModal(v: Voucher) {
        setEditingId(v.id);
        setFormData({
            code: v.code,
            name: v.name,
            description: v.description ?? "",
            discountType: v.discountType,
            discountAmount: String(v.discountAmount),
            bonusDays: String(v.bonusDays),
            maxUsage: String(v.maxUsage),
            expiresAt: v.expiresAt ? v.expiresAt.slice(0, 10) : "",
            isActive: v.isActive,
            firstTimeOnly: v.firstTimeOnly,
            premiumOnly: v.premiumOnly,
            eligiblePlanIds: v.eligiblePlans.map((p) => p.id),
            campaignId: v.campaign?.id ?? "",
        });
        setIsModalOpen(true);
    }

    function closeModal() {
        setIsModalOpen(false);
        setEditingId(null);
        setFormData(EMPTY_FORM);
    }

    function togglePlan(planId: string) {
        setFormData((f) => ({
            ...f,
            eligiblePlanIds: f.eligiblePlanIds.includes(planId)
                ? f.eligiblePlanIds.filter((id) => id !== planId)
                : [...f.eligiblePlanIds, planId],
        }));
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formData.code || !formData.name) {
            alert("Code and name are required.");
            return;
        }

        const payload = {
            code: formData.code,
            name: formData.name,
            description: formData.description || undefined,
            discountType: formData.discountType,
            discountAmount: Number(formData.discountAmount) || 0,
            bonusDays: Number(formData.bonusDays) || 0,
            maxUsage: Number(formData.maxUsage) || 0,
            expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : undefined,
            isActive: formData.isActive,
            firstTimeOnly: formData.firstTimeOnly,
            premiumOnly: formData.premiumOnly,
            eligiblePlanIds: formData.eligiblePlanIds,
            campaignId: formData.campaignId || undefined,
        };

        if (editingId) {
            updateVoucher.mutate({ id: editingId, payload });
        } else {
            createVoucher.mutate(payload);
        }
    }

    const isSaving = createVoucher.isPending || updateVoucher.isPending;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Vouchers</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Discount codes and event promos. Group related codes under a campaign for reporting.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <input
                        value={search}
                        onChange={(e) => {
                            setPage(1);
                            setSearch(e.target.value);
                        }}
                        placeholder="Search code or name…"
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-brand shadow-sm"
                    />
                    <button
                        onClick={openCreateModal}
                        className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
                    >
                        New Voucher
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Code</th>
                                <th className="px-6 py-4 font-semibold">Effect</th>
                                <th className="px-6 py-4 font-semibold">Usage</th>
                                <th className="px-6 py-4 font-semibold">Campaign</th>
                                <th className="px-6 py-4 font-semibold">Status</th>
                                <th className="px-6 py-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading && (
                                <tr>
                                    <td className="px-6 py-8 text-center text-slate-400" colSpan={6}>
                                        Loading vouchers…
                                    </td>
                                </tr>
                            )}
                            {isError && (
                                <tr>
                                    <td className="px-6 py-8 text-center text-red-500 bg-red-50" colSpan={6}>
                                        Failed to load vouchers.
                                    </td>
                                </tr>
                            )}
                            {!isLoading && !isError && data?.items.length === 0 && (
                                <tr>
                                    <td className="px-6 py-8 text-center text-slate-500" colSpan={6}>
                                        No vouchers yet.
                                    </td>
                                </tr>
                            )}

                            {data?.items.map((v) => {
                                const status = getVoucherStatus(v);
                                return (
                                    <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-mono font-semibold text-slate-900">{v.code}</div>
                                            <div className="text-slate-500 text-xs mt-0.5">{v.name}</div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-700">{formatVoucherSummary(v)}</td>
                                        <td className="px-6 py-4 text-slate-700">
                                            {v.currentUsage} / {v.maxUsage > 0 ? v.maxUsage : "∞"}
                                        </td>
                                        <td className="px-6 py-4 text-slate-700">{v.campaign?.name ?? "—"}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${status.style}`}>
                                                {status.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                <button
                                                    onClick={() => openEditModal(v)}
                                                    className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                                                >
                                                    Edit
                                                </button>
                                                <span className="text-slate-300">|</span>
                                                <button
                                                    onClick={() => toggleVoucher.mutate(v.id)}
                                                    disabled={toggleVoucher.isPending}
                                                    className={`text-sm font-medium transition-colors disabled:opacity-50 ${v.isActive ? "text-amber-600 hover:text-amber-800" : "text-emerald-600 hover:text-emerald-800"
                                                        }`}
                                                >
                                                    {v.isActive ? "Deactivate" : "Activate"}
                                                </button>
                                                <span className="text-slate-300">|</span>
                                                <button
                                                    onClick={() => setDeleteTarget(v)}
                                                    className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {data && data.total > data.pageSize && (
                <div className="flex items-center justify-between mt-6">
                    <div className="text-sm text-slate-500">
                        Showing <span className="font-medium">{(page - 1) * data.pageSize + 1}</span> to{" "}
                        <span className="font-medium">{Math.min(page * data.pageSize, data.total)}</span> of{" "}
                        <span className="font-medium">{data.total}</span> vouchers
                    </div>
                    <div className="flex gap-2">
                        <button
                            disabled={page <= 1}
                            onClick={() => setPage((p) => p - 1)}
                            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                        >
                            Previous
                        </button>
                        <button
                            disabled={page * data.pageSize >= data.total}
                            onClick={() => setPage((p) => p + 1)}
                            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full my-8">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-900">
                                {editingId ? "Edit Voucher" : "New Voucher"}
                            </h2>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 font-medium text-sm">
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                        Code
                                    </label>
                                    <input
                                        required
                                        placeholder="XMAS2026"
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                        Name
                                    </label>
                                    <input
                                        required
                                        placeholder="Christmas Promo"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Description
                                </label>
                                <textarea
                                    rows={2}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                                />
                            </div>

                            <div className="rounded-lg border border-slate-200 p-4 space-y-3 bg-slate-50">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    What this voucher does
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs text-slate-600 mb-1">Discount type</label>
                                        <select
                                            value={formData.discountType}
                                            onChange={(e) =>
                                                setFormData({ ...formData, discountType: e.target.value as "PERCENTAGE" | "FIXED" })
                                            }
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
                                        >
                                            <option value="PERCENTAGE">Percentage off</option>
                                            <option value="FIXED">Fixed amount off</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-600 mb-1">
                                            {formData.discountType === "PERCENTAGE" ? "Percent (%)" : "Amount (₱)"}
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={formData.discountAmount}
                                            onChange={(e) => setFormData({ ...formData, discountAmount: e.target.value })}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-600 mb-1">
                                        Bonus license days (added on top of the plan's normal length — leave 0 if this voucher is
                                        price-only)
                                    </label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={formData.bonusDays}
                                        onChange={(e) => setFormData({ ...formData, bonusDays: e.target.value })}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                        Max Usage (0 = unlimited)
                                    </label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={formData.maxUsage}
                                        onChange={(e) => setFormData({ ...formData, maxUsage: e.target.value })}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                        Expires On
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.expiresAt}
                                        onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Campaign (optional)
                                </label>
                                <select
                                    value={formData.campaignId}
                                    onChange={(e) => setFormData({ ...formData, campaignId: e.target.value })}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
                                >
                                    <option value="">No campaign</option>
                                    {campaigns?.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Eligible plans (none checked = valid for every plan)
                                </label>
                                <div className="border border-slate-300 rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
                                    {plans?.map((p) => (
                                        <label key={p.id} className="flex items-center gap-2 text-sm px-2 py-1 hover:bg-slate-50 rounded">
                                            <input
                                                type="checkbox"
                                                checked={formData.eligiblePlanIds.includes(p.id)}
                                                onChange={() => togglePlan(p.id)}
                                            />
                                            {p.name}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-4 text-sm">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.isActive}
                                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    />
                                    Active
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.firstTimeOnly}
                                        onChange={(e) => setFormData({ ...formData, firstTimeOnly: e.target.checked })}
                                    />
                                    First-time buyers only
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.premiumOnly}
                                        onChange={(e) => setFormData({ ...formData, premiumOnly: e.target.checked })}
                                    />
                                    Paid plans only
                                </label>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                                >
                                    {isSaving ? "Saving…" : editingId ? "Save Changes" : "Create Voucher"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={deleteTarget !== null}
                title="Delete this voucher?"
                description={`"${deleteTarget?.code}" will be permanently removed. This only works if it's never been redeemed.`}
                confirmLabel="Delete"
                danger
                isLoading={deleteVoucher.isPending}
                onCancel={() => setDeleteTarget(null)}
                onConfirm={() => deleteTarget && deleteVoucher.mutate(deleteTarget.id)}
            />
        </div>
    );
}