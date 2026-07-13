import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Campaign {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    bannerUrl: string | null;
    isActive: boolean;
    vouchers: { id: string; code: string; isActive: boolean }[];
}

interface CampaignFormData {
    name: string;
    startDate: string;
    endDate: string;
    bannerUrl: string;
    isActive: boolean;
}

const EMPTY_FORM: CampaignFormData = {
    name: "",
    startDate: "",
    endDate: "",
    bannerUrl: "",
    isActive: true,
};

function getCampaignPhase(c: Campaign): { label: string; style: string } {
    const now = new Date();
    const start = new Date(c.startDate);
    const end = new Date(c.endDate);
    if (!c.isActive) return { label: "Disabled", style: "bg-slate-100 text-slate-600 border-slate-200" };
    if (now < start) return { label: "Upcoming", style: "bg-blue-50 text-blue-700 border-blue-100" };
    if (now > end) return { label: "Ended", style: "bg-slate-100 text-slate-500 border-slate-200" };
    return { label: "Running", style: "bg-emerald-50 text-emerald-700 border-emerald-100" };
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-PH", { dateStyle: "medium" });
}

export default function PromoCampaignsPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<CampaignFormData>(EMPTY_FORM);
    const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);
    const queryClient = useQueryClient();

    const { data, isLoading, isError } = useQuery({
        queryKey: ["promo-campaigns"],
        queryFn: async () => (await api.get("/promo-campaigns")).data as Campaign[],
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["promo-campaigns"] });

    const createCampaign = useMutation({
        mutationFn: (payload: unknown) => api.post("/promo-campaigns", payload),
        onSuccess: () => {
            invalidate();
            closeModal();
        },
    });

    const updateCampaign = useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: unknown }) =>
            api.patch(`/promo-campaigns/${id}`, payload),
        onSuccess: () => {
            invalidate();
            closeModal();
        },
    });

    const deleteCampaign = useMutation({
        mutationFn: (id: string) => api.delete(`/promo-campaigns/${id}`),
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

    function openEditModal(c: Campaign) {
        setEditingId(c.id);
        setFormData({
            name: c.name,
            startDate: c.startDate.slice(0, 10),
            endDate: c.endDate.slice(0, 10),
            bannerUrl: c.bannerUrl ?? "",
            isActive: c.isActive,
        });
        setIsModalOpen(true);
    }

    function closeModal() {
        setIsModalOpen(false);
        setEditingId(null);
        setFormData(EMPTY_FORM);
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formData.name || !formData.startDate || !formData.endDate) {
            alert("Name, start date, and end date are required.");
            return;
        }
        const payload = {
            name: formData.name,
            startDate: new Date(formData.startDate).toISOString(),
            endDate: new Date(formData.endDate).toISOString(),
            bannerUrl: formData.bannerUrl || undefined,
            isActive: formData.isActive,
        };
        if (editingId) {
            updateCampaign.mutate({ id: editingId, payload });
        } else {
            createCampaign.mutate(payload);
        }
    }

    const isSaving = createCampaign.isPending || updateCampaign.isPending;

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Promo Campaigns</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Group vouchers under a themed event — Christmas, Balik Eskwela, anniversary sales, and so on.
                    </p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
                >
                    New Campaign
                </button>
            </div>

            {isLoading && <p className="text-sm text-slate-500">Loading campaigns…</p>}
            {isError && <p className="text-sm text-red-600">Failed to load campaigns.</p>}

            {!isLoading && !isError && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {data?.length === 0 && (
                        <p className="text-sm text-slate-500 col-span-full">No campaigns yet.</p>
                    )}
                    {data?.map((c) => {
                        const phase = getCampaignPhase(c);
                        return (
                            <div key={c.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                {c.bannerUrl && (
                                    <img src={c.bannerUrl} alt={c.name} className="w-full h-28 object-cover" />
                                )}
                                <div className="p-5">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <h2 className="font-semibold text-slate-900">{c.name}</h2>
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${phase.style}`}>
                                            {phase.label}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500">
                                        {formatDate(c.startDate)} – {formatDate(c.endDate)}
                                    </p>
                                    <p className="text-sm text-slate-500 mt-1">
                                        {c.vouchers.length} voucher{c.vouchers.length === 1 ? "" : "s"} attached
                                    </p>
                                    <div className="flex items-center gap-3 mt-4">
                                        <button
                                            onClick={() => openEditModal(c)}
                                            className="text-sm font-medium text-slate-600 hover:text-slate-900"
                                        >
                                            Edit
                                        </button>
                                        <span className="text-slate-300">|</span>
                                        <button
                                            onClick={() => setDeleteTarget(c)}
                                            className="text-sm font-medium text-red-600 hover:text-red-800"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-900">
                                {editingId ? "Edit Campaign" : "New Campaign"}
                            </h2>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 font-medium text-sm">
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Name
                                </label>
                                <input
                                    required
                                    placeholder="Christmas 2026"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                        Start Date
                                    </label>
                                    <input
                                        required
                                        type="date"
                                        value={formData.startDate}
                                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                        End Date
                                    </label>
                                    <input
                                        required
                                        type="date"
                                        value={formData.endDate}
                                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Banner URL (optional)
                                </label>
                                <input
                                    placeholder="https://…"
                                    value={formData.bannerUrl}
                                    onChange={(e) => setFormData({ ...formData, bannerUrl: e.target.value })}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                                />
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                />
                                Active
                            </label>
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
                                    {isSaving ? "Saving…" : editingId ? "Save Changes" : "Create Campaign"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={deleteTarget !== null}
                title="Delete this campaign?"
                description={`"${deleteTarget?.name}" will be removed. Vouchers attached to it stay, just unlinked from the campaign.`}
                confirmLabel="Delete"
                danger
                isLoading={deleteCampaign.isPending}
                onCancel={() => setDeleteTarget(null)}
                onConfirm={() => deleteTarget && deleteCampaign.mutate(deleteTarget.id)}
            />
        </div>
    );
}