import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";

// TODO: point this at wherever your app already keeps the API base URL
// use a permissive cast to avoid TS errors when ImportMeta types aren't declared
const API_URL = (import.meta as any)?.env?.VITE_API_URL || "http://localhost:4000/api";

interface Payment {
    id: string;
    status: string;
    amount: number;
    currency: string;
    provider: string;
    buyerEmail: string | null;
    buyerName: string | null;
    plan?: { name: string } | null;
}

export default function PaymentDetail() {
    const { id } = useParams<{ id: string }>();
    const [payment, setPayment] = useState<Payment | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionPending, setActionPending] = useState(false);

    // TODO: swap for wherever your app actually keeps the token (context, cookie, etc.)
    const authHeader = { Authorization: `Bearer ${localStorage.getItem("token")}` };

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/payments/${id}`, { headers: authHeader });
            if (!res.ok) throw new Error(`Failed to load payment (${res.status})`);
            setPayment(await res.json());
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        load();
    }, [load]);

    async function runAction(action: "approve" | "reject" | "refund") {
        setActionPending(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/payments/${id}/${action}`, {
                method: "POST",
                headers: authHeader,
            });
            if (!res.ok) throw new Error(`Failed to ${action} payment (${res.status})`);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setActionPending(false);
        }
    }

    if (loading) return <p className="p-6 text-sm text-gray-500">Loading payment…</p>;
    if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;
    if (!payment) return null;

    return (
        <div className="max-w-xl mx-auto p-6">
            <h1 className="text-lg font-semibold text-gray-900">Payment {payment.id}</h1>

            <dl className="mt-4 space-y-2 text-sm">
                <Row label="Status">{payment.status}</Row>
                <Row label="Plan">{payment.plan?.name ?? "—"}</Row>
                <Row label="Amount">
                    {payment.currency} {payment.amount}
                </Row>
                <Row label="Provider">{payment.provider}</Row>
                <Row label="Buyer">
                    {payment.buyerName ?? "—"} ({payment.buyerEmail ?? "no email"})
                </Row>
            </dl>

            {payment.status === "PENDING" && (
                <div className="mt-6 flex gap-3">
                    <button
                        onClick={() => runAction("approve")}
                        disabled={actionPending}
                        className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
                    >
                        Approve
                    </button>
                    <button
                        onClick={() => runAction("reject")}
                        disabled={actionPending}
                        className="px-4 py-2 rounded-md bg-gray-100 text-gray-700 text-sm font-medium disabled:opacity-50"
                    >
                        Reject
                    </button>
                </div>
            )}

            {payment.status === "PAID" && (
                <button
                    onClick={() => runAction("refund")}
                    disabled={actionPending}
                    className="mt-6 px-4 py-2 rounded-md bg-gray-100 text-gray-700 text-sm font-medium disabled:opacity-50"
                >
                    Refund
                </button>
            )}
        </div>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex justify-between border-b border-gray-100 pb-2">
            <dt className="text-gray-500">{label}</dt>
            <dd className="text-gray-900">{children}</dd>
        </div>
    );
}