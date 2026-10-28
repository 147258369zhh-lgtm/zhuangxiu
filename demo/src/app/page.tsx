import Link from "next/link";
import { listSitesWithProgress } from "@/lib/data";
import { createSiteAction } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import { Progress, StatusBadge, fmtMoney, fmtTime } from "@/components/ui";

const FILTERS = [
  { key: "all", label: "全部" },
  { key: "active", label: "进行中" },
  { key: "todo", label: "待开工" },
  { key: "done", label: "已竣工" },
] as const;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const { f = "all" } = await searchParams;
  const list = listSitesWithProgress();
  const withStatus = list.map((x) => ({
    ...x,
    st: x.done === x.total ? "已竣工" : x.done > 0 ? "进行中" : "待开工",
  }));
  const filtered = f === "active" ? withStatus.filter((x) => x.st === "进行中") : f === "todo" ? withStatus.filter((x) => x.st === "待开工") : f === "done" ? withStatus.filter((x) => x.st === "已竣工") : withStatus;

  const active = withStatus.filter((x) => x.st === "进行中").length;
  const budgetSum = list.reduce((s, { site }) => s + (site.budget || 0), 0);
  const extraSum = list.reduce((s, x) => s + x.extraAmount, 0);
  const receivedSum = list.reduce((s, x) => s + x.receivedAmount, 0);
  const pendingTotal = list.reduce((s, x) => s + x.pendingChanges, 0);

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-base shadow-sm shadow-indigo-200">🏠</div>
            <div className="text-[15px] font-semibold">装修管理平台</div>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold tracking-widest text-indigo-500 ring-1 ring-indigo-100">DEMO</span>
          </div>
          <div className="text-sm text-zinc-500">演示装饰公司 · <span className="font-medium text-zinc-700">B端</span></div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">工地总览</h1>
          <p className="mt-1 text-sm text-zinc-500">装修公司从这里创建工地、跟进工序与增项；业主扫码即看进度、线上签字。</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { icon: "🏗️", label: "在建工地", value: `${list.length}`, hint: `进行中 ${active}` },
            { icon: "💰", label: "在管合同", value: `¥${fmtMoney(budgetSum)}`, hint: `已确认增项 +¥${fmtMoney(extraSum)}` },
            { icon: "🏦", label: "已收款项", value: `¥${fmtMoney(receivedSum)}`, hint: "全部工地合计" },
            { icon: "📋", label: "待业主处理", value: `${pendingTotal}`, hint: "增项确认单", warn: pendingTotal > 0 },
          ].map((s) => (
            <div key={s.label} className={`card px-5 py-4 ${s.warn ? "ring-2 ring-amber-200" : ""}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">{s.label}</span>
                <span className="text-sm">{s.icon}</span>
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums">{s.value}</div>
              <div className={`mt-0.5 text-[11px] ${s.warn ? "font-medium text-amber-600" : "text-zinc-400"}`}>{s.hint}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((flt) => {
                const n =
                  flt.key === "all"
                    ? withStatus.length
                    : withStatus.filter((x) => x.st === flt.label).length;
                const on = f === flt.key;
                return (
                  <Link
                    key={flt.key}
                    href={flt.key === "all" ? "/" : `/?f=${flt.key}`}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                      on ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:ring-zinc-300"
                    }`}
                  >
                    {flt.label}
                    <span className={`font-mono ${on ? "text-indigo-200" : "text-zinc-400"}`}>{n}</span>
                  </Link>
                );
              })}
            </div>

            {filtered.length === 0 && (
              <div className="card flex flex-col items-center justify-center gap-1 px-6 py-14 text-center">
                <span className="text-2xl">🈳</span>
                <div className="text-sm font-medium text-zinc-500">该状态下暂无工地</div>
                <div className="text-xs text-zinc-400">切回"全部"或创建一个新工地</div>
              </div>
            )}

            {filtered.map(({ site, done, total, pendingChanges, extraAmount, receivedAmount }) => {
              const pct = (done / total) * 100;
              const payPct = site.budget > 0 ? Math.min(100, Math.round((receivedAmount / site.budget) * 100)) : 0;
              return (
                <Link key={site.id} href={`/gongdi/${site.id}`} className="card block p-5 transition hover:border-indigo-300 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-semibold">{site.name}</span>
                        {pendingChanges > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600 ring-1 ring-amber-200">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" /> {pendingChanges} 笔增项待确认
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">{site.community} · {site.layout}</div>
                    </div>
                    <StatusBadge status={done === total ? "已完成" : done > 0 ? "进行中" : "待开工"} />
                  </div>
                  <div className="mt-4">
                    <Progress value={pct} />
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-400">
                      <span>工序 {done}/{total}</span>
                      <span className="font-semibold text-zinc-600">{Math.round(pct)}%</span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                    <span>业主 <b className="font-medium text-zinc-700">{site.owner_name}</b></span>
                    <span>工长 <b className="font-medium text-zinc-700">{site.foreman}</b></span>
                    <span>¥{fmtMoney(site.budget)}{extraAmount > 0 && <span className="text-emerald-600"> +¥{fmtMoney(extraAmount)}</span>}</span>
                    <span className="text-emerald-600">已收 {payPct}%</span>
                    <span className="ml-auto text-zinc-400">{fmtTime(site.created_at)}</span>
                  </div>
                </Link>
              );
            })}
          </section>

          <aside className="space-y-4">
            <form action={createSiteAction} className="card p-5">
              <div className="mb-4 text-sm font-semibold">➕ 新建工地</div>
              <div className="space-y-3">
                <div>
                  <label className="label">工地名称（楼栋号）</label>
                  <input name="name" className="input" placeholder="如：5-1-201 陈先生的新家" required />
                </div>
                <div>
                  <label className="label">小区</label>
                  <input name="community" className="input" placeholder="如：翡翠湾" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">业主</label>
                    <input name="owner" className="input" placeholder="王女士" />
                  </div>
                  <div>
                    <label className="label">户型</label>
                    <input name="layout" className="input" placeholder="89㎡ 两居" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">工长</label>
                    <input name="foreman" className="input" placeholder="李工长" />
                  </div>
                  <div>
                    <label className="label">合同额（¥）</label>
                    <input name="budget" type="number" className="input" placeholder="150000" />
                  </div>
                </div>
              </div>
              <SubmitButton className="btn btn-primary mt-4 w-full" pending="创建中…">创建工地</SubmitButton>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
                创建后自动生成六道标准工序（含工期）、付款计划与业主邀请二维码。
              </p>
            </form>

            <div className="card p-5">
              <div className="mb-2 text-sm font-semibold">📱 业主端（C端）</div>
              <p className="text-xs leading-relaxed text-zinc-500">业主端是手机页面，扫码或直接打开：</p>
              <div className="mt-2 flex flex-col gap-1.5 text-xs">
                <Link href="/c/AX7K2M" className="font-mono text-indigo-600 hover:underline">/c/AX7K2M（王姐家 · 有增项待确认）</Link>
                <Link href="/c/B3N8QK" className="font-mono text-indigo-600 hover:underline">/c/B3N8QK（李先生家 · 刚开工）</Link>
              </div>
              <p className="mt-2 text-[11px] text-zinc-400">浏览器打开后按 F12 切手机视图，效果最佳。</p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
