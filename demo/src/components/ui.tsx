export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "已完成" || status === "已确认"
      ? "bg-emerald-50 text-emerald-600 ring-emerald-200"
      : status === "进行中" || status === "待确认"
        ? "bg-amber-50 text-amber-600 ring-amber-200"
        : status === "已拒绝"
          ? "bg-zinc-100 text-zinc-400 ring-zinc-200"
          : "bg-zinc-100 text-zinc-500 ring-zinc-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {status}
    </span>
  );
}

export function Progress({ value, tone = "indigo" }: { value: number; tone?: "indigo" | "amber" | "red" }) {
  const bar =
    tone === "red" ? "bg-red-500" : tone === "amber" ? "bg-amber-500" : "bg-indigo-600";
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
      <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function fmtTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const mm = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  const hh = `${d.getHours()}`.padStart(2, "0");
  const mi = `${d.getMinutes()}`.padStart(2, "0");
  return `${mm}-${dd} ${hh}:${mi}`;
}

export function fmtMoney(n: number): string {
  return Math.round(n || 0).toLocaleString("zh-CN");
}
