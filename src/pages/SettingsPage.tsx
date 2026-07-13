import { useState, forwardRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import clsx from "clsx";

// ---------- Schemas (mirror backend/src/services/settings.service.ts) ----------

const subscriptionSchema = z.object({
  monthlyPremiumPrice: z.coerce.number().min(0),
  quarterlyPremiumPrice: z.coerce.number().min(0).nullable(),
  yearlyPremiumPrice: z.coerce.number().min(0),
  freeTrialDays: z.coerce.number().int().min(0),
  maxDevicesPerPlan: z.coerce.number().int().min(1),
  offlineGracePeriodDays: z.coerce.number().int().min(0),
});

const paymentsSchema = z.object({
  gcashNumber: z.string(),
  mayaNumber: z.string(),
  bankAccountDetails: z.string(),
  paymentInstructions: z.string(),
  autoApproval: z.boolean(),
});

const voucherSchema = z.object({
  defaultExpirationDays: z.coerce.number().int().min(1),
  maxVoucherUses: z.coerce.number().int().min(1),
  codePrefix: z
    .string()
    .max(10)
    .regex(/^[A-Za-z0-9_-]*$/, "Letters, numbers, - and _ only"),
  codeLength: z.coerce.number().int().min(4).max(32),
});

const systemSchema = z.object({
  maintenanceMode: z.boolean(),
  latestAppVersion: z.string(),
  minSupportedAppVersion: z.string(),
  forceUpdateVersion: z.string().nullable(),
});

const SCHEMAS = {
  subscription: subscriptionSchema,
  payments: paymentsSchema,
  voucher: voucherSchema,
  system: systemSchema,
};

type Group = keyof typeof SCHEMAS;
type SubscriptionValues = z.infer<typeof subscriptionSchema>;
type PaymentsValues = z.infer<typeof paymentsSchema>;
type VoucherValues = z.infer<typeof voucherSchema>;
type SystemValues = z.infer<typeof systemSchema>;

const TABS: { key: Group; label: string }[] = [
  { key: "subscription", label: "Subscription" },
  { key: "payments", label: "Payments" },
  { key: "voucher", label: "Voucher" },
  { key: "system", label: "System" },
];

// ---------- Shared field primitives ----------

type TextFieldProps = { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>;

const TextFieldComponent = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, ...props },
  ref
) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        {...props}
        ref={ref}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
});

const TextField = TextFieldComponent as React.FC<TextFieldProps>;

type TextAreaFieldProps = { label: string; error?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField(
  { label, error, ...props },
  ref
) {
  return (
    <div className="sm:col-span-2">
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <textarea
        {...props}
        ref={ref}
        rows={3}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
});

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 sm:col-span-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          "relative h-6 w-11 rounded-full transition",
          checked ? "bg-brand" : "bg-slate-300"
        )}
      >
        <span
          className={clsx(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition",
            checked ? "left-5" : "left-0.5"
          )}
        />
      </button>
    </label>
  );
}

function FormShell({
  children,
  onSubmit,
  onReset,
  isSaving,
  isResetting,
  saved,
}: {
  children: React.ReactNode;
  onSubmit: () => void;
  onReset: () => void;
  isSaving: boolean;
  isResetting: boolean;
  saved: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="bg-white rounded-xl border border-slate-200 p-6"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>

      <div className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-4">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-brand text-white text-sm font-medium px-4 py-2 hover:bg-brand-dark transition disabled:opacity-60"
        >
          {isSaving ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          disabled={isResetting}
          onClick={() => {
            if (confirm("Reset this group to its default values?")) onReset();
          }}
          className="rounded-lg border border-slate-300 text-sm font-medium px-4 py-2 hover:bg-slate-50 disabled:opacity-60"
        >
          {isResetting ? "Resetting…" : "Reset to defaults"}
        </button>
        {saved && <span className="text-sm text-emerald-600">Saved.</span>}
      </div>
    </form>
  );
}

// ---------- Generic data hook ----------

function useSettingsGroup<T extends Record<string, unknown>>(group: Group) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["settings", group],
    queryFn: async () => (await api.get<T>(`/settings/${group}`)).data,
  });

  const save = useMutation({
    mutationFn: async (values: T) => (await api.put<T>(`/settings/${group}`, values)).data,
    onSuccess: (data) => queryClient.setQueryData(["settings", group], data),
  });

  const reset = useMutation({
    mutationFn: async () => (await api.delete<T>(`/settings/${group}`)).data,
    onSuccess: (data) => queryClient.setQueryData(["settings", group], data),
  });

  return { query, save, reset };
}

// ---------- Per-group forms ----------

function SubscriptionForm() {
  const { query, save, reset } = useSettingsGroup<SubscriptionValues>("subscription");
  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
  } = useForm<SubscriptionValues>({
    resolver: zodResolver(subscriptionSchema),
    values: query.data,
  });

  if (query.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <FormShell
      onSubmit={handleSubmit((values) => save.mutate(values))}
      onReset={() => reset.mutate(undefined, { onSuccess: (d) => resetForm(d) })}
      isSaving={save.isPending}
      isResetting={reset.isPending}
      saved={save.isSuccess}
    >
      <TextField
        label="Monthly Premium Price (₱)"
        type="number"
        step="0.01"
        error={errors.monthlyPremiumPrice?.message}
        {...register("monthlyPremiumPrice")}
      />
      <TextField
        label="Quarterly Premium Price (₱, optional)"
        type="number"
        step="0.01"
        error={errors.quarterlyPremiumPrice?.message}
        {...register("quarterlyPremiumPrice")}
      />
      <TextField
        label="Yearly Premium Price (₱)"
        type="number"
        step="0.01"
        error={errors.yearlyPremiumPrice?.message}
        {...register("yearlyPremiumPrice")}
      />
      <TextField
        label="Free Trial Duration (days)"
        type="number"
        error={errors.freeTrialDays?.message}
        {...register("freeTrialDays")}
      />
      <TextField
        label="Maximum Devices per Plan"
        type="number"
        error={errors.maxDevicesPerPlan?.message}
        {...register("maxDevicesPerPlan")}
      />
      <TextField
        label="Offline Verification Grace Period (days)"
        type="number"
        error={errors.offlineGracePeriodDays?.message}
        {...register("offlineGracePeriodDays")}
      />
    </FormShell>
  );
}

function PaymentsForm() {
  const { query, save, reset } = useSettingsGroup<PaymentsValues>("payments");
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset: resetForm,
    formState: { errors },
  } = useForm<PaymentsValues>({
    resolver: zodResolver(paymentsSchema),
    values: query.data,
  });

  if (query.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <FormShell
      onSubmit={handleSubmit((values) => save.mutate(values))}
      onReset={() => reset.mutate(undefined, { onSuccess: (d) => resetForm(d) })}
      isSaving={save.isPending}
      isResetting={reset.isPending}
      saved={save.isSuccess}
    >
      <TextField
        label="GCash Number"
        error={errors.gcashNumber?.message}
        {...register("gcashNumber")}
      />
      <TextField
        label="Maya Number"
        error={errors.mayaNumber?.message}
        {...register("mayaNumber")}
      />
      <TextAreaField
        label="Bank Account Details"
        error={errors.bankAccountDetails?.message}
        {...register("bankAccountDetails")}
      />
      <TextAreaField
        label="Payment Instructions"
        error={errors.paymentInstructions?.message}
        {...register("paymentInstructions")}
      />
      <ToggleField
        label="Auto Approval"
        checked={!!watch("autoApproval")}
        onChange={(v) => setValue("autoApproval", v, { shouldDirty: true })}
      />
    </FormShell>
  );
}

function VoucherForm() {
  const { query, save, reset } = useSettingsGroup<VoucherValues>("voucher");
  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
  } = useForm<VoucherValues>({
    resolver: zodResolver(voucherSchema),
    values: query.data,
  });

  if (query.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <FormShell
      onSubmit={handleSubmit((values) => save.mutate(values))}
      onReset={() => reset.mutate(undefined, { onSuccess: (d) => resetForm(d) })}
      isSaving={save.isPending}
      isResetting={reset.isPending}
      saved={save.isSuccess}
    >
      <TextField
        label="Default Voucher Expiration (days)"
        type="number"
        error={errors.defaultExpirationDays?.message}
        {...register("defaultExpirationDays")}
      />
      <TextField
        label="Maximum Voucher Uses"
        type="number"
        error={errors.maxVoucherUses?.message}
        {...register("maxVoucherUses")}
      />
      <TextField
        label="Generated Code Prefix"
        error={errors.codePrefix?.message}
        {...register("codePrefix")}
      />
      <TextField
        label="Voucher Length"
        type="number"
        error={errors.codeLength?.message}
        {...register("codeLength")}
      />
    </FormShell>
  );
}

function SystemForm() {
  const { query, save, reset } = useSettingsGroup<SystemValues>("system");
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset: resetForm,
    formState: { errors },
  } = useForm<SystemValues>({
    resolver: zodResolver(systemSchema),
    values: query.data,
  });

  if (query.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <FormShell
      onSubmit={handleSubmit((values) => save.mutate(values))}
      onReset={() => reset.mutate(undefined, { onSuccess: (d) => resetForm(d) })}
      isSaving={save.isPending}
      isResetting={reset.isPending}
      saved={save.isSuccess}
    >
      <ToggleField
        label="Maintenance Mode"
        checked={!!watch("maintenanceMode")}
        onChange={(v) => setValue("maintenanceMode", v, { shouldDirty: true })}
      />
      <TextField
        label="Latest Mobile App Version"
        placeholder="e.g. 1.4.0"
        error={errors.latestAppVersion?.message}
        {...register("latestAppVersion")}
      />
      <TextField
        label="Minimum Supported App Version"
        placeholder="e.g. 1.2.0"
        error={errors.minSupportedAppVersion?.message}
        {...register("minSupportedAppVersion")}
      />
      <TextField
        label="Force Update Version (optional)"
        placeholder="e.g. 1.3.0"
        error={errors.forceUpdateVersion?.message}
        {...register("forceUpdateVersion")}
      />
    </FormShell>
  );
}

// ---------- Page ----------

export default function SettingsPage() {
  const [tab, setTab] = useState<Group>("subscription");

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 mb-4">Settings</h1>

      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition",
              tab === t.key
                ? "border-brand text-brand"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "subscription" && <SubscriptionForm />}
      {tab === "payments" && <PaymentsForm />}
      {tab === "voucher" && <VoucherForm />}
      {tab === "system" && <SystemForm />}
    </div>
  );
}