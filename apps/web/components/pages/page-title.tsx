export function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold md:text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-muted">{subtitle}</p>
    </div>
  );
}
