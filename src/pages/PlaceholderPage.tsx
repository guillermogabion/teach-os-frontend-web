export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 mb-2">{title}</h1>
      <div className="bg-white rounded-xl border border-slate-200 border-dashed p-10 text-center text-slate-400 text-sm">
        {title} module goes here — same pattern as Users: a route in
        routes/index.ts, a controller, and a page like UsersPage.tsx.
      </div>
    </div>
  );
}
