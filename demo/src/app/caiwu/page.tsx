import Link from "next/link";
import { redirect } from "next/navigation";
import { listAllPayments, listSitesWithProgress } from "@/lib/data";
import { getRole } from "@/lib/role";
import { createPaymentAction, receivePaymentAction } from "@/app/actions";
import { BShell } from "@/components/BShell";
import { SubmitButton } from "@/components/SubmitButton";
import { ReceiveAreaChart, SiteBarChart, type DailyPoint, type SiteBarPoint } from "@/components/charts";
import { StatusBadge, DueBadge, Progress, fmtMoney, fmtTime } from "@/components/ui";

export default async function CaiwuPage() {
  const role = await getRole();
  if (role !== "boss") redirect("/");

  const sites = listSitesWithProgress();
  const rows = listAllPayments();

  const contractTotal = sites.reduce((s, x) => s + (x.site.budget || 0) + x.extraAmount, 0);
  const receivedTotal = sites.reduce((s, x) => s + x.receivedAmount, 0);
  const pendingTotal = Math.max(0, contractTotal - receivedTotal);
  const pendingRows = rows.filter((r) => r.status === "待收款");
  const now = Date.now();
  const overdueRows = pendingRows.filter((r) => r.due_date && new Date(r.due_date).getTime() < now);
  const payPct = contractTotal > 0 ? Math.min(100, Math.round((receivedTotal / contractTotal) * 100)) : 0;

  // 图表数据：最近 30 天累计回款曲线
  const DAY = 86400000;
  const paid = rows
    .filter((r) => r.status === "已收款" && r.paid_at)
    .map((r) => ({ t: new Date(r.paid_at!).getTime(), amount: r.amount }));
  const startDay = Math.floor((now - 29 * DAY) / DAY);
  const areaData: DailyPoint[] = [];
  for (let i = 0; i < 30; i++) {
    const dayStart = (startDay + i) * DAY;
    const dayEnd = dayStart + DAY;
    const daySum = paid.filter((p) => p.t >= dayStart && p.t < dayEnd).reduce((s, p) => s + p.amount, 0);
    const d = new Date(dayStart);
    areaData.push({
      day: `${d.getMonth() + 1}/${d.getDate()}`,
      received: daySum,
      cumulative: i === 0
        ? paid.filter((p) => p.t < dayEnd).reduce((s, p) => s + p.amount, 0)
        : areaData[i - 1].cumulative + daySum,
    });
  }
  const barData: SiteBarPoint[] = sites.map(({ site, extraAmount, receivedAmount }) => ({
    name: site.name.replace(/^[\d-]+\s*/, "").replace(/的新家|的家/, ""),
    receivable: (site.budget || 0) + extraAmount,
    received: receivedAmount,
  }));

  const cards = [
    { icon: "📑", label: "在管合同（含增项）", value: `¥${fmtMoney(contractTotal)}`, hint: `${sites.length} 个工地` },
    { icon: "🏦", label: "已收款", value: `¥${fmtMoney(receivedTotal)}`, hint: `${rows.length - pendingRows.length} 笔已到账` },
    { icon: "⏳", label: "待收款", value: `¥${fmtMoney(pendingTotal)}`, hint: `${pendingRows.length} 笔待回款${overdueRows.length ? ` · ${overdueRows.length} 笔逾期` : ""}`, warn: overdueRows.length > 0 },
    { icon: "📈", label: "回款率", value: `${payPct}%`, hint: "已收 / 应收合计" },
  ];

  return (
    <BShell active="/caiwu">
      <div className="mx-auto max-w-6xl px-6 py-7">
        <div className="mb-5">
          <h1 className="text-lg font-semibold">💰 财务收款</h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            全部工地的收款节点集中管理；工长与监理视角不显示本页。
          </p>
        </div>

        {/* KPI 条 */}
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {cards.map((s) => (
            <div key={s.label} className={`card px-4 py-3 ${s.warn ? "ring-2 ring-red-200" : ""}`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-500">{s.label}</span>
                <span className="text-xs">{s.icon}</span>
              </div>
              <div className="mt-0.5 text-[17px] font-semibold tabular-nums">{s.value}</div>
              <div className={`text-[10px] ${s.warn ? "font-medium text-red-600" : "text-zinc-400"}`}>{s.hint}</div>
            </div>
          ))}
        </div>

        {/* 图表区：面积图 + 柱图 */}
        <div className="mb-5 grid gap-4 lg:grid-cols-2">
          <section className="card p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[13px] font-semibold">📈 累计回款走势</span>
              <span className="text-[10px] text-zinc-400">近 30 天</span>
            </div>
            <ReceiveAreaChart data={areaData} />
          </section>
          <section className="card p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[13px] font-semibold">🏗️ 各工地应收 / 已收</span>
              <span className="text-[10px] text-zinc-400">
                <i className="mr-1 inline-block h-2 w-2 rounded-sm bg-indigo-400 align-middle" />应收
                <i className="ml-3 mr-1 inline-block h-2 w-2 rounded-sm bg-emerald-400 align-middle" />已收
              </span>
            </div>
            <SiteBarChart data={barData} />
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* 跨工地付款节点表 */}
          <section className="card p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[13px] font-semibold">💳 付款节点（全部工地）</span>
              <span className="text-[10px] text-zinc-400">逾期优先 · 按到期日排序</span>
            </div>
            <div className="space-y-1.5">
              {rows.length === 0 && <p className="text-xs text-zinc-400">还没有付款节点。</p>}
              {rows.map((r) => (
                <div key={r.id} className={`flex flex-wrap items-center gap-x-2.5 gap-y-0.5 rounded-lg px-3 py-2 ${
                  r.status === "待收款" && r.due_date && new Date(r.due_date).getTime() < now ? "bg-red-50/70 ring-1 ring-red-100" : "bg-zinc-50"
                }`}>
                  <Link href={`/gongdi/${r.site_id}`} className="max-w-[170px] truncate text-xs font-medium text-zinc-700 hover:text-indigo-600 hover:underline">
                    {r.site_name}
                  </Link>
                  <span className="text-xs text-zinc-600">{r.title}</span>
                  {r.note && <span className="hidden text-[10px] text-zinc-400 xl:inline">{r.note}</span>}
                  <StatusBadge status={r.status} />
                  <DueBadge due={r.due_date} status={r.status} />
                  <span className="ml-auto font-mono text-xs font-semibold tabular-nums text-zinc-700">¥{fmtMoney(r.amount)}</span>
                  {r.status === "已收款" ? (
                    <span className="w-[74px] text-right text-[10px] text-zinc-400">{fmtTime(r.paid_at)}</span>
                  ) : (
                    <form action={receivePaymentAction}>
                      <input type="hidden" name="paymentId" value={r.id} />
                      <input type="hidden" name="siteId" value={r.site_id} />
                      <SubmitButton className="btn btn-ghost px-2 py-1 text-[10px]" pending="…">登记收款</SubmitButton>
                    </form>
                  )}
                </div>
              ))}
            </div>
          </section>

          <aside className="space-y-4">
            {/* 新增收款节点 */}
            <section className="card p-4">
              <div className="mb-2.5 text-[13px] font-semibold">➕ 新增收款节点</div>
              <form action={createPaymentAction} className="space-y-2">
                <select name="siteId" className="input px-2.5 py-1.5 text-xs">
                  {sites.map(({ site }) => <option key={site.id} value={site.id}>{site.name}</option>)}
                </select>
                <input name="title" className="input px-2.5 py-1.5 text-xs" placeholder="节点名，如：增项尾款" />
                <input name="amount" type="number" className="input px-2.5 py-1.5 text-right font-mono text-xs" placeholder="金额 ¥" />
                <SubmitButton className="btn btn-primary w-full text-xs" pending="添加中…">添加节点</SubmitButton>
              </form>
            </section>

            {/* 各工地回款进度 */}
            <section className="card p-4">
              <div className="mb-2.5 text-[13px] font-semibold">📊 各工地回款进度</div>
              <div className="space-y-2.5">
                {sites.map(({ site, extraAmount, receivedAmount }) => {
                  const due = (site.budget || 0) + extraAmount;
                  const pct = due > 0 ? Math.min(100, Math.round((receivedAmount / due) * 100)) : 0;
                  return (
                    <div key={site.id}>
                      <div className="mb-1 flex items-baseline justify-between text-[11px]">
                        <Link href={`/gongdi/${site.id}`} className="truncate font-medium text-zinc-600 hover:text-indigo-600 hover:underline">{site.name}</Link>
                        <span className="shrink-0 font-mono text-zinc-400">{pct}%</span>
                      </div>
                      <Progress value={pct} tone={pct >= 100 ? "emerald" : "indigo"} />
                    </div>
                  );
                })}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </BShell>
  );
}
