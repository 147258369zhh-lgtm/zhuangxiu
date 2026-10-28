/** B 端后台加载骨架：KPI 行 + 三栏内容占位 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-7">
      <div className="mb-5 h-16 animate-pulse rounded-2xl bg-gradient-to-r from-indigo-100 to-violet-100" />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-zinc-100" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-64 animate-pulse rounded-xl bg-zinc-100 lg:col-span-2" />
        <div className="h-64 animate-pulse rounded-xl bg-zinc-100" />
        <div className="h-40 animate-pulse rounded-xl bg-zinc-100 lg:col-span-2" />
        <div className="h-40 animate-pulse rounded-xl bg-zinc-100" />
      </div>
    </div>
  );
}
