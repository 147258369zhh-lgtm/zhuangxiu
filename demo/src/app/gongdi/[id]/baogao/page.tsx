import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getAccepts, getChanges, getLogs, getMaterials, getPayments, getSite, getSteps } from "@/lib/data";
import { PrintButton } from "@/components/PrintButton";
import { StatusBadge, daysBetween, fmtDate, fmtMoney, fmtTime } from "@/components/ui";

export const metadata = { title: "工地报告 · 装修管理平台 Demo" };

function Th({ children }: { children: React.ReactNode }) {
  return <th className="border-b border-zinc-200 px-2 py-1.5 text-left text-[11px] font-medium text-zinc-400">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`border-b border-zinc-100 px-2 py-1.5 text-xs text-zinc-700 ${className}`}>{children}</td>;
}

export default async function BaogaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = getSite(id);
  if (!site) notFound();
  const steps = getSteps(site.id);
  const logs = getLogs(site.id);
  const accepts = getAccepts(site.id);
  const changes = getChanges(site.id);
  const payments = getPayments(site.id);
  const materials = getMaterials(site.id);

  const host = (await headers()).get("host") ?? "localhost:3300";
  const inviteUrl = `http://${host}/c/${site.code}`;
  const qr = await QRCode.toDataURL(inviteUrl, { width: 160, margin: 1, color: { dark: "#3730a3", light: "#ffffff" } });

  const stepDone = steps.filter((s) => s.status === "已完成").length;
  const pct = steps.length ? Math.round((stepDone / steps.length) * 100) : 0;
  const receivedSum = payments.filter((p) => p.status === "已收款").reduce((s, p) => s + p.amount, 0);
  const confirmedSum = changes.filter((c) => c.status === "已确认").reduce((s, c) => s + c.amount, 0);
  const accDone = accepts.filter((a) => a.done).length;
  const groups = [...new Set(accepts.map((a) => a.step_name))].map((name) => ({
    name,
    items: accepts.filter((a) => a.step_name === name),
  }));

  return (
    <div>
      {/* 工具条（打印时隐藏） */}
      <div className="no-print sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Link href={`/gongdi/${site.id}`} className="text-sm text-zinc-500 transition hover:text-zinc-900">← 返回工地</Link>
          <PrintButton />
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* 报告头 */}
        <div className="card mb-5 flex items-center justify-between gap-6 px-6 py-5">
          <div>
            <div className="text-xs font-medium text-zinc-400">演示装饰公司 · 工地档案报告</div>
            <h1 className="mt-1 text-xl font-bold">{site.name}</h1>
            <div className="mt-1.5 text-xs text-zinc-500">
              {site.community} · {site.layout} · 开工 {fmtDate(site.created_at)}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-500">
              <span>业主 <b className="text-zinc-800">{site.owner_name}</b></span>
              <span>工长 <b className="text-zinc-800">{site.foreman}</b></span>
              <span>合同额 <b className="text-zinc-800">¥{fmtMoney(site.budget)}</b></span>
              <span>总进度 <b className="text-indigo-600">{pct}%</b></span>
            </div>
          </div>
          <div className="shrink-0 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="业主端二维码" className="h-24 w-24 rounded-lg ring-1 ring-zinc-100" />
            <div className="mt-1 font-mono text-[10px] text-zinc-400">{site.code}</div>
          </div>
        </div>

        {/* 摘要四格 */}
        <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "装修总进度", value: `${pct}%`, hint: `工序 ${stepDone}/${steps.length}` },
            { label: "已收款项", value: `¥${fmtMoney(receivedSum)}`, hint: "含首期/中期" },
            { label: "已确认增项", value: `+¥${fmtMoney(confirmedSum)}`, hint: "业主线上签字" },
            { label: "验收打卡", value: `${accDone}/${accepts.length}`, hint: "业主逐项确认" },
          ].map((s) => (
            <div key={s.label} className="card px-4 py-3">
              <div className="text-[11px] text-zinc-400">{s.label}</div>
              <div className="mt-0.5 text-base font-semibold tabular-nums">{s.value}</div>
              <div className="text-[10px] text-zinc-400">{s.hint}</div>
            </div>
          ))}
        </div>

        {/* 工序与预算 */}
        <section className="card mb-5 p-5">
          <div className="mb-3 text-sm font-semibold">🧱 工序与预算</div>
          <table className="w-full">
            <thead>
              <tr><Th>工序</Th><Th>状态</Th><Th>工期</Th><Th className="text-right">计划预算</Th><Th className="text-right">实际开支</Th><Th className="text-right">偏差</Th></tr>
            </thead>
            <tbody>
              {steps.map((st) => {
                const used = st.started_at
                  ? st.status === "已完成"
                    ? Math.max(1, daysBetween(st.started_at, st.finished_at))
                    : daysBetween(st.started_at)
                  : null;
                const dev = st.actual - st.planned;
                return (
                  <tr key={st.id}>
                    <Td className="font-medium">{st.name}</Td>
                    <Td><StatusBadge status={st.status} /></Td>
                    <Td>{used == null ? `计划 ${st.planned_days} 天` : st.status === "已完成" ? `用时 ${used} 天` : `已 ${used} 天 / ${st.planned_days} 天`}</Td>
                    <Td className="text-right font-mono">{st.planned > 0 ? `¥${fmtMoney(st.planned)}` : "—"}</Td>
                    <Td className="text-right font-mono">{st.actual > 0 ? `¥${fmtMoney(st.actual)}` : "—"}</Td>
                    <Td className={`text-right font-mono ${dev > 0 ? "font-semibold text-red-500" : dev < 0 ? "text-emerald-600" : "text-zinc-300"}`}>
                      {st.planned > 0 && st.actual > 0 ? `${dev > 0 ? "+" : ""}¥${fmtMoney(dev)}` : "—"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* 付款与增项 */}
        <section className="card mb-5 p-5">
          <div className="mb-3 text-sm font-semibold">💰 付款与增项</div>
          <table className="w-full">
            <thead>
              <tr><Th>付款节点</Th><Th className="text-right">金额</Th><Th>状态</Th><Th>时间</Th></tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <Td className="font-medium">{p.title}{p.note ? <span className="ml-2 text-[10px] text-zinc-400">{p.note}</span> : null}</Td>
                  <Td className="text-right font-mono font-semibold">¥{fmtMoney(p.amount)}</Td>
                  <Td><StatusBadge status={p.status} /></Td>
                  <Td>{fmtDate(p.paid_at) || "—"}</Td>
                </tr>
              ))}
              {changes.map((c) => (
                <tr key={c.id}>
                  <Td className="font-medium">{c.title}{c.reason ? <span className="ml-2 text-[10px] text-zinc-400">{c.reason}</span> : null}</Td>
                  <Td className="text-right font-mono font-semibold text-amber-600">+¥{fmtMoney(c.amount)}</Td>
                  <Td><StatusBadge status={c.status} /></Td>
                  <Td>{c.status === "已确认" ? `${c.decided_by} 签于 ${fmtDate(c.decided_at)}` : c.status === "已拒绝" ? "业主拒绝" : "待业主确认"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 材料进场 */}
        {materials.length > 0 && (
          <section className="card mb-5 p-5">
            <div className="mb-3 text-sm font-semibold">📦 材料进场</div>
            <table className="w-full">
              <thead>
                <tr><Th>材料</Th><Th>品牌规格</Th><Th>数量</Th><Th>状态</Th><Th>进场时间</Th></tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id}>
                    <Td className="font-medium">{m.name}</Td>
                    <Td>{m.spec || "—"}</Td>
                    <Td>{m.qty || "—"}</Td>
                    <Td><StatusBadge status={m.status} /></Td>
                    <Td>{fmtDate(m.arrived_at) || "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* 验收清单 */}
        <section className="card mb-5 p-5">
          <div className="mb-3 text-sm font-semibold">✅ 验收清单（{accDone}/{accepts.length}）</div>
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.name}>
                <div className="mb-1 text-[11px] font-semibold text-zinc-400">{g.name}</div>
                <div className="space-y-1">
                  {g.items.map((it) => (
                    <div key={it.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg bg-zinc-50 px-3 py-1.5">
                      <span className={it.done ? "text-emerald-500" : "text-zinc-300"}>{it.done ? "✓" : "○"}</span>
                      <span className="text-xs text-zinc-700">{it.item}</span>
                      {it.done ? (
                        <span className="ml-auto text-[10px] text-zinc-400">{it.checked_by} {fmtDate(it.checked_at)}{it.comment ? ` · "${it.comment}"` : ""}</span>
                      ) : (
                        <span className="ml-auto text-[10px] text-zinc-300">待业主验收</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 日志摘要 */}
        <section className="card mb-5 p-5">
          <div className="mb-3 text-sm font-semibold">📝 施工日志摘要</div>
          <div className="space-y-2">
            {logs.slice(0, 10).map((l) => (
              <div key={l.id} className="flex gap-3 rounded-lg bg-zinc-50 px-3 py-2">
                <span className="shrink-0 text-[10px] tabular-nums text-zinc-400">{fmtTime(l.created_at)}</span>
                <span className="shrink-0 rounded bg-white px-1.5 text-[10px] font-medium text-zinc-500 ring-1 ring-zinc-200">{l.author}</span>
                <span className="text-xs leading-relaxed text-zinc-700">{l.content}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="pb-4 text-center text-[10px] text-zinc-300">
          生成于 {fmtTime(new Date().toISOString())} · 装修管理平台 Demo · 业主可扫右上角二维码实时查看工地
        </div>
      </main>
    </div>
  );
}
