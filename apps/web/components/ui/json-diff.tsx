import { CardMeta } from "@/components/ui/card";

interface JsonDiffProps {
  diff: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringify(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function JsonDiff({ diff }: JsonDiffProps) {
  const normalized = isRecord(diff) && ("before" in diff || "after" in diff)
    ? {
        before: (diff as Record<string, unknown>).before ?? null,
        after: (diff as Record<string, unknown>).after ?? null
      }
    : {
        before: null,
        after: diff
      };

  return (
    <div className="space-y-2">
      <CardMeta>JSON diff</CardMeta>
      <div className="grid gap-2 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-semibold text-muted">Before</p>
          <pre className="h-48 overflow-auto rounded-xl border border-border bg-slate-950 p-3 text-xs text-slate-100">
            {stringify(normalized.before)}
          </pre>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-muted">After</p>
          <pre className="h-48 overflow-auto rounded-xl border border-border bg-slate-950 p-3 text-xs text-slate-100">
            {stringify(normalized.after)}
          </pre>
        </div>
      </div>
    </div>
  );
}
