import Link from "next/link";
import { redirect } from "next/navigation";
import { listAllPayments, listSitesWithProgress } from "@/lib/data";
import { getRole } from "@/lib/role";
import { createPaymentAction, receivePaymentAction } from "@/app/actions";
import { BShell } from "@/components/BShell";
import { SubmitButton } from "@/components/SubmitButton";
import { Donut, Progress, StatusBadge, fmtMoney, fmtTime } from "@/components/ui";

export default async function CaiwuPage() {
  const role = await getRole();
  if (role !== "boss") redirect("/");

  const sites = listSitesWithProgress();
  const rows = listAllPayments();

  const contractTotal = sites.reduce((s, x) => s + (x.site.budget || 0) + x.extraAmount, 0);
  const receivedTotal = sites.reduce((s, x) => s + x.receivedAmount, 0);
  const pendingTotal = Math.max(0, contractTotal - receivedTotal);
  const pendingRows = rows.filter((r) => r.status === "待收款");
  const payPct = contractTotal > 0 ? Math.min(100, Math.round((receivedTotal / contractTotal) * 100)) : 0;

  const cards = [
    { icon: "📑", label: "在管合同（含增项）", value: `¥${fmtMoney(contractTotal)}`, hint: `${sites.length} 个工地` },
    { icon: "🏦", label: "已收款", value: `¥${fmtMoney(receivedTotal)}`, hint: `${rows.length - pendingRows.length} 笔已到账` },
    { icon: "⏳", label: "待收款", value: `¥${fmtMoney(pendingTotal)}`, hint: `${pendingRows.length} 笔待回款`, warn: pendingRows.length > 0 },
    { icon: "📈", label: "回款率", value: `${payPct}%`, hint: "已收 / 应收合计" },
  ];

  return (
    <BShell active="/caiwu">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">💰 财务收款</h1>
          <p className="mt-1 text-sm text-zinc-500">
            全部工地的收款节点集中管理：登记到账、催收逾期款项；工长与监理视角不显示本页。
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {cards.map((s) => (
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

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* 跨工地付款节点表 */}
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold">💳 付款节点（全部工地）</span>
              <span className="text-[11px] text-zinc-400">待收款排在最前</span>
            </div>
            <div className="space-y-2">
              {rows.length === 0 && <p className="text-xs text-zinc-400">还没有付款节点。</p>}
              {rows.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-zinc-50 px-3 py-2.5">
                  <Link href={`/gongdi/${r.site_id}`} className="max-w-[180px] truncate text-xs font-medium text-zinc-700 hover:text-indigo-600 hover:underline">
                    {r.site_name}
                  </Link>
                  <span className="text-xs text-zinc-600">{r.title}</span>
                  {r.note && <span className="hidden text-[11px] text-zinc-400 md:inline">{r.note}</span>}
                  <StatusBadge status={r.status} />
                  <span className="ml-auto font-mono text-xs font-semibold text-zinc-700">¥{fmtMoney(r.amount)}</span>
                  {r.status === "已收款" ? (
                    <span className="w-[78px] text-right text-[11px] text-zinc-400">{fmtTime(r.paid_at)}</span>
                  ) : (
                    <form action={receivePaymentAction}>
                      <input type="hidden" name="paymentId" value={r.id} />
                      <input type="hidden" name="siteId" value={r.site_id} />
                      <SubmitButton className="btn btn-ghost px-2 py-1 text-[11px]" pending="…">登记收款</SubmitButton>
                    </form>
                  )}
                </div>
              ))}
            </div>
          </section>

          <aside className="space-y-4">
            {/* 总收款仪表 */}
            <section className="card p-5 text-center">
              <div className="mb-3 text-sm font-semibold">🏦 整体回款</div>
              <div className="relative mx-auto w-fit">
                <Donut pct={payPct} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold tabular-nums">{payPct}%</span>
                  <span className="text-[10px] text-zinc-400">回款率</span>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-zinc-500">应收合计</span><b className="tabular-nums">¥{fmtMoney(contractTotal)}</b></div>
                <div className="flex justify-between"><span className="text-emerald-600">已收款</span><b className="tabular-nums text-emerald-600">¥{fmtMoney(receivedTotal)}</b></div>
                <div className="flex justify-between"><span className="text-amber-600">待收款</span><b className="tabular-nums text-amber-600">¥{fmtMoney(pendingTotal)}</b></div>
              </div>
            </section>

            {/* 各工地回款条 */}
            <section className="card p-5">
              <div className="mb-3 text-sm font-semibold">🏗️ 各工地回款</div>
              <div className="space-y-3">
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

            {/* 新增收款节点 */}
            <section className="card p-5">
              <div className="mb-3 text-sm font-semibold">➕ 新增收款节点</div>
              <form action={createPaymentAction} className="space-y-2.5">
                <select name="siteId" className="input text-xs">
                  {sites.map(({ site }) => <option key={site.id} value={site.id}>{site.name}</option>)}
                </select>
                <input name="title" className="input text-xs" placeholder="节点名，如：增项尾款" />
                <input name="amount" type="number" className="input text-right font-mono text-xs" placeholder="金额 ¥" />
                <SubmitButton className="btn btn-primary w-full text-xs" pending="添加中…">添加节点</SubmitButton>
              </form>
            </section>
          </aside>
        </div>
      </div>
    </BShell>
  );
}
