import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getAccepts, getChanges, getLogs, getMaterials, getMessages, getPayments, getSite, getSteps } from "@/lib/data";
import {
  addLogAction,
  advanceStepAction,
  arriveMaterialAction,
  createAcceptAction,
  createChangeAction,
  createMaterialAction,
  createPaymentAction,
  receivePaymentAction,
  sendStaffMessageAction,
  updateSiteAction,
  updateStepBudgetAction,
} from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ZoomImg } from "@/components/ZoomImg";
import { BShell } from "@/components/BShell";
import { getRole } from "@/lib/role";
import { Donut, Progress, StatusBadge, daysBetween, fmtDate, fmtMoney, fmtTime } from "@/components/ui";

export default async function GongdiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = getSite(id);
  if (!site) notFound();
  const role = await getRole();
  const steps = getSteps(site.id);
  const logs = getLogs(site.id);
  const accepts = getAccepts(site.id);
  const changes = getChanges(site.id);
  const payments = getPayments(site.id);
  const materials = getMaterials(site.id);
  const messages = getMessages(site.id);

  const host = (await headers()).get("host") ?? "localhost:3300";
  const inviteUrl = `http://${host}/c/${site.code}`;
  const qr = await QRCode.toDataURL(inviteUrl, {
    width: 320, margin: 1, color: { dark: "#3730a3", light: "#ffffff" },
  });

  const accDone = accepts.filter((a) => a.done).length;
  const plannedSum = steps.reduce((s, st) => s + st.planned, 0);
  const actualSum = steps.reduce((s, st) => s + st.actual, 0);
  const pendingChg = changes.filter((c) => c.status === "待确认").length;
  const confirmedSum = changes.filter((c) => c.status === "已确认").reduce((s, c) => s + c.amount, 0);
  const receivedSum = payments.filter((p) => p.status === "已收款").reduce((s, p) => s + p.amount, 0);
  const matDone = materials.filter((m) => m.status === "已进场").length;
  const totalDue = site.budget + confirmedSum;
  const payPct = totalDue > 0 ? Math.min(100, Math.round((receivedSum / totalDue) * 100)) : 0;

  // 甘特图排程：以最早开工日为锚点，未开工工序自动顺排
  const DAY = 86400000;
  const anchorIso =
    steps.map((s) => s.started_at).filter((x): x is string => !!x).sort()[0] ?? site.created_at;
  const anchorMs = new Date(anchorIso).getTime();
  const nowDay = Math.max(0, (Date.now() - anchorMs) / DAY);
  let prevEnd = 0;
  const ganttRows = steps.map((st) => {
    const planned = st.planned_days || 1;
    let start: number;
    let used = 0;
    if (st.started_at) {
      start = Math.max(0, (new Date(st.started_at).getTime() - anchorMs) / DAY);
      used =
        st.status === "已完成"
          ? Math.max(1, daysBetween(st.started_at, st.finished_at))
          : daysBetween(st.started_at);
    } else {
      start = Math.max(nowDay, prevEnd);
    }
    const end = st.started_at ? Math.max(start + planned, start + used) : start + planned;
    prevEnd = end;
    return { id: st.id, name: st.name, status: st.status, start, planned, used, end };
  });
  const totalDays = Math.max(nowDay + 1, ...ganttRows.map((r) => r.end), 7);
  const todayRatio = Math.min(1, Math.max(0, nowDay / totalDays));

  return (
    <BShell active="/">
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="card mb-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 px-6 py-5">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              {site.name}
              {pendingChg > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600 ring-1 ring-amber-200">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" /> {pendingChg} 笔增项待业主确认
                </span>
              )}
            </h1>
            <div className="mt-1 text-xs text-zinc-500">{site.community} · {site.layout}</div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
            <span>业主 <b className="text-zinc-800">{site.owner_name}</b></span>
            <span>工长 <b className="text-zinc-800">{site.foreman}</b></span>
            {role === "boss" ? (
              <>
                <span>合同额 <b className="text-zinc-800">¥{fmtMoney(site.budget)}</b></span>
                <span>已收 <b className="text-emerald-600">¥{fmtMoney(receivedSum)}</b></span>
                <span>邀请码 <b className="font-mono text-indigo-600">{site.code}</b></span>
              </>
            ) : (
              <span className="text-zinc-300">· 财务信息仅老板可见 ·</span>
            )}
          </div>
          {role === "boss" && (
          <details className="no-print mt-2 w-full">
            <summary className="cursor-pointer text-[11px] font-medium text-indigo-600 hover:text-indigo-500">✏️ 编辑工地信息</summary>
            <form action={updateSiteAction} className="mt-3 grid gap-3 md:grid-cols-3">
              <input type="hidden" name="siteId" value={site.id} />
              <div className="md:col-span-2">
                <label className="label">工地名称</label>
                <input name="name" defaultValue={site.name} className="input" />
              </div>
              <div>
                <label className="label">小区</label>
                <input name="community" defaultValue={site.community ?? ""} className="input" />
              </div>
              <div>
                <label className="label">业主</label>
                <input name="owner" defaultValue={site.owner_name ?? ""} className="input" />
              </div>
              <div>
                <label className="label">户型</label>
                <input name="layout" defaultValue={site.layout ?? ""} className="input" />
              </div>
              <div>
                <label className="label">工长</label>
                <input name="foreman" defaultValue={site.foreman ?? ""} className="input" />
              </div>
              <div>
                <label className="label">合同额（¥）</label>
                <input name="budget" type="number" defaultValue={site.budget} className="input" />
              </div>
              <div className="flex items-end">
                <SubmitButton className="btn btn-primary w-full text-xs" pending="保存中…">保存修改</SubmitButton>
              </div>
            </form>
          </details>
          )}
        </div>

        {/* 工期甘特图（全宽） */}
        <section className="card mb-6 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold">📅 工期甘特图</span>
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-zinc-400">
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-emerald-400" />已完成</span>
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-amber-400" />进行中</span>
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-zinc-300" />未开始</span>
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-red-300" />超出计划</span>
              <span className="flex items-center gap-1"><i className="h-3 w-0 border-l-2 border-dashed border-indigo-400" />今天</span>
            </div>
          </div>
          <div className="relative">
            <div
              className="pointer-events-none absolute bottom-1 top-1 z-10 border-l-2 border-dashed border-indigo-400"
              style={{ left: `calc(64px + (100% - 116px) * ${todayRatio})` }}
            />
            <div className="space-y-1.5">
              {ganttRows.map((row) => {
                const perDay = 100 / totalDays;
                const seg = (left: number, width: number, cls: string, k: string) =>
                  width <= 0 ? null : (
                    <div
                      key={k}
                      className={`absolute inset-y-0.5 rounded-[3px] ${cls}`}
                      style={{ left: `${left * perDay}%`, width: `${Math.max(width * perDay, 0.8)}%` }}
                    />
                  );
                return (
                  <div key={row.id} className="flex items-center gap-2">
                    <span className={`w-14 shrink-0 truncate text-[11px] ${row.status === "待开工" ? "text-zinc-400" : "font-medium text-zinc-600"}`}>
                      {row.name}
                    </span>
                    <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-zinc-50 ring-1 ring-zinc-100">
                      {row.status === "待开工" && seg(row.start, row.planned, "bg-zinc-200", "p")}
                      {row.status !== "待开工" && (
                        <>
                          {seg(row.start, row.planned, row.status === "已完成" ? "bg-emerald-100" : "bg-amber-100", "plan")}
                          {seg(row.start, Math.min(row.used, row.planned), row.status === "已完成" ? "bg-emerald-400" : "bg-amber-400", "used")}
                          {row.used > row.planned && seg(row.start + row.planned, row.used - row.planned, "bg-red-300", "over")}
                        </>
                      )}
                    </div>
                    <span className="w-11 shrink-0 text-right text-[10px] tabular-nums text-zinc-400">
                      {row.status === "已完成" ? `${row.used}天` : row.status === "进行中" ? `${row.used}/${row.planned}天` : `${row.planned}天`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
            自 {fmtDate(anchorIso)} 开工排起；未开工工序按计划工期自动顺排，实际进度越出计划的部分显示为红色。
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            {/* 工序进度与预算 */}
            <section className="card p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold">🧱 工序进度与预算</span>
                <span className="text-[11px] text-zinc-400">计划 ¥{fmtMoney(plannedSum)} · 实际 ¥{fmtMoney(actualSum)}</span>
              </div>
              <div className="space-y-3">
                {steps.map((st) => {
                  const ratio = st.planned > 0 ? (st.actual / st.planned) * 100 : 0;
                  const over = st.planned > 0 && st.actual > st.planned;
                  const elapsed = daysBetween(st.started_at);
                  const usedDays = Math.max(1, daysBetween(st.started_at, st.finished_at));
                  const dayOver = st.planned_days > 0 && (st.status === "进行中" ? elapsed > st.planned_days : usedDays > st.planned_days);
                  return (
                    <div key={st.id} className="rounded-xl border border-zinc-100 bg-zinc-50/60 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold text-zinc-400 ring-1 ring-zinc-200">
                          {st.sort + 1}
                        </span>
                        <span className="text-sm font-medium">{st.name}</span>
                        <StatusBadge status={st.status} />
                        {st.status === "待开工" && st.planned_days > 0 && (
                          <span className="text-[11px] text-zinc-400">计划 {st.planned_days} 天</span>
                        )}
                        {st.status === "进行中" && (
                          <span className={`text-[11px] font-medium ${dayOver ? "text-red-500" : "text-amber-600"}`}>
                            已 {elapsed} 天 · 计划 {st.planned_days} 天{dayOver ? ` · 超期 ${elapsed - st.planned_days} 天` : ""}
                          </span>
                        )}
                        {st.status === "已完成" && (
                          <span className={`text-[11px] font-medium ${dayOver ? "text-red-500" : "text-emerald-600"}`}>
                            用时 {usedDays} 天{st.planned_days > 0 ? (dayOver ? ` · 超期 ${usedDays - st.planned_days} 天` : " · 准时") : ""}
                          </span>
                        )}
                        <form action={advanceStepAction} className="ml-auto">
                          <input type="hidden" name="stepId" value={st.id} />
                          <input type="hidden" name="siteId" value={site.id} />
                          <input type="hidden" name="current" value={st.status} />
                          <SubmitButton className="btn btn-ghost px-3 py-1 text-xs" pending="…">
                            {st.status === "待开工" ? "开始施工 →" : st.status === "进行中" ? "标记完成 →" : "重置"}
                          </SubmitButton>
                        </form>
                      </div>
                      <div className="mt-2.5 flex items-center gap-3">
                        <span className="w-28 shrink-0 font-mono text-[11px] text-zinc-400">
                          预算 ¥{fmtMoney(st.planned)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <Progress value={ratio} tone={over ? "red" : "indigo"} />
                        </div>
                        <form action={updateStepBudgetAction} className="flex shrink-0 items-center gap-1">
                          <input type="hidden" name="stepId" value={st.id} />
                          <input type="hidden" name="siteId" value={site.id} />
                          <input type="hidden" name="planned" value={st.planned} />
                          <span className="text-[11px] text-zinc-400">实际</span>
                          <input name="actual" type="number" defaultValue={st.actual} className="w-24 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-right font-mono text-[11px] outline-none focus:border-indigo-400" />
                          <SubmitButton className="btn btn-ghost px-2 py-1 text-[11px]" pending="…">存</SubmitButton>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 付款管理（仅老板） */}
            {role === "boss" && (
            <section className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold">💰 付款管理</span>
                <span className="text-[11px] text-zinc-400">
                  已收 ¥{fmtMoney(receivedSum)} / 合同 ¥{fmtMoney(site.budget)}
                  {site.budget > 0 && ` · ${Math.round((receivedSum / site.budget) * 100)}%`}
                </span>
              </div>
              <Progress value={site.budget > 0 ? (receivedSum / site.budget) * 100 : 0} tone="emerald" />
              <div className="mt-3 space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-zinc-50 px-3 py-2">
                    <span className="text-xs font-medium text-zinc-700">{p.title}</span>
                    {p.note && <span className="hidden text-[11px] text-zinc-400 md:inline">{p.note}</span>}
                    <StatusBadge status={p.status} />
                    <span className="ml-auto font-mono text-xs font-semibold text-zinc-700">¥{fmtMoney(p.amount)}</span>
                    {p.status === "已收款" ? (
                      <span className="w-[78px] text-right text-[11px] text-zinc-400">{fmtTime(p.paid_at)}</span>
                    ) : (
                      <form action={receivePaymentAction}>
                        <input type="hidden" name="paymentId" value={p.id} />
                        <input type="hidden" name="siteId" value={site.id} />
                        <SubmitButton className="btn btn-ghost px-2 py-1 text-[11px]" pending="…">登记收款</SubmitButton>
                      </form>
                    )}
                  </div>
                ))}
              </div>
              <form action={createPaymentAction} className="mt-3 flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
                <input type="hidden" name="siteId" value={site.id} />
                <input name="title" className="input min-w-0 flex-1 px-2.5 py-1.5 text-xs" placeholder="付款节点名，如：增项预付" />
                <input name="amount" type="number" className="input w-28 px-2.5 py-1.5 text-right font-mono text-xs" placeholder="金额 ¥" />
                <SubmitButton className="btn btn-ghost px-3 py-1.5 text-xs" pending="…">添加节点</SubmitButton>
              </form>
            </section>
            )}

            {/* 增项管理（仅老板） */}
            {role === "boss" && (
            <section className="card p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold">📋 增项管理</span>
                <span className="text-[11px] text-zinc-400">已确认增项 +¥{fmtMoney(confirmedSum)}</span>
              </div>
              <div className="space-y-2.5">
                {changes.length === 0 && <p className="text-xs text-zinc-400">暂无增项单。</p>}
                {changes.map((c) => (
                  <div key={c.id} className="rounded-xl border border-zinc-100 px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-medium">{c.title}</span>
                      <StatusBadge status={c.status} />
                      <span className={`ml-auto font-mono text-sm font-semibold ${c.status === "已拒绝" ? "text-zinc-300 line-through" : "text-zinc-800"}`}>
                        +¥{fmtMoney(c.amount)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-zinc-400">
                      {c.reason && <span>{c.reason}</span>}
                      {c.decided_by && <span className="text-emerald-600">{c.decided_by} {fmtTime(c.decided_at)}</span>}
                    </div>
                    {c.decided_comment && <div className="mt-1 text-xs text-zinc-500">"{c.decided_comment}"</div>}
                  </div>
                ))}
              </div>
              <form action={createChangeAction} className="mt-4 border-t border-zinc-100 pt-4">
                <input type="hidden" name="siteId" value={site.id} />
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_120px]">
                  <div>
                    <label className="label">增项内容</label>
                    <input name="title" className="input" placeholder="如：主卫增加壁龛" required />
                  </div>
                  <div>
                    <label className="label">原因</label>
                    <input name="reason" className="input" placeholder="如：业主需求变更" />
                  </div>
                  <div>
                    <label className="label">金额（¥）</label>
                    <input name="amount" type="number" className="input" placeholder="300" />
                  </div>
                </div>
                <SubmitButton className="btn btn-primary mt-3" pending="创建中…">创建增项单（推送业主端）</SubmitButton>
              </form>
            </section>
            )}

            {/* 材料进场 */}
            <section className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold">📦 材料进场</span>
                <span className="text-[11px] text-zinc-400">已进场 {matDone}/{materials.length}</span>
              </div>
              <div className="space-y-2">
                {materials.length === 0 && <p className="text-xs text-zinc-400">暂无材料记录。</p>}
                {materials.map((m) => (
                  <div key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-zinc-100 px-3 py-2">
                    <span className={`text-xs ${m.status === "已进场" ? "font-medium text-zinc-700" : "text-zinc-500"}`}>{m.name}</span>
                    {m.spec && <span className="hidden text-[11px] text-zinc-400 md:inline">{m.spec}</span>}
                    {m.qty && <span className="hidden text-[11px] text-zinc-400 lg:inline">· {m.qty}</span>}
                    <StatusBadge status={m.status} />
                    {m.status === "已进场" ? (
                      <span className="ml-auto text-[11px] text-zinc-400">{fmtTime(m.arrived_at)} 进场</span>
                    ) : (
                      <form action={arriveMaterialAction} className="ml-auto">
                        <input type="hidden" name="materialId" value={m.id} />
                        <input type="hidden" name="siteId" value={site.id} />
                        <SubmitButton className="btn btn-ghost px-2 py-1 text-[11px]" pending="…">登记进场</SubmitButton>
                      </form>
                    )}
                  </div>
                ))}
              </div>
              <form action={createMaterialAction} className="mt-3 flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
                <input type="hidden" name="siteId" value={site.id} />
                <input name="name" className="input min-w-0 flex-1 px-2.5 py-1.5 text-xs" placeholder="材料名，如：石膏板" required />
                <input name="spec" className="input w-36 px-2.5 py-1.5 text-xs" placeholder="品牌型号" />
                <input name="qty" className="input w-24 px-2.5 py-1.5 text-xs" placeholder="数量" />
                <SubmitButton className="btn btn-ghost px-3 py-1.5 text-xs" pending="…">添加材料</SubmitButton>
              </form>
            </section>

            {/* 留言板 */}
            <section className="card p-5">
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-sm font-semibold">💬 留言板</span>
                <span className="text-[11px] text-zinc-400">与业主直接沟通 · 双方实时可见</span>
              </div>
              <div className="space-y-2.5">
                {messages.length === 0 && <p className="text-xs text-zinc-400">还没有留言。</p>}
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender === "工长" ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[85%]">
                      <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${m.sender === "工长" ? "rounded-br-md bg-indigo-600 text-white" : "rounded-bl-md bg-zinc-100 text-zinc-800"}`}>
                        {m.content}
                      </div>
                      <div className={`mt-0.5 text-[10px] text-zinc-400 ${m.sender === "工长" ? "text-right" : ""}`}>
                        {m.author} · {fmtTime(m.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <form action={sendStaffMessageAction} className="mt-3 flex gap-2 border-t border-zinc-100 pt-3">
                <input type="hidden" name="siteId" value={site.id} />
                <select name="author" className="input w-24 shrink-0 px-2 py-2 text-xs">
                  {["李工长", "赵工长", "张监理", "项目经理"].map((a) => <option key={a}>{a}</option>)}
                </select>
                <input name="content" className="input min-w-0 flex-1 px-3 py-2 text-sm" placeholder={`回复 ${site.owner_name ?? "业主"}…`} />
                <SubmitButton className="btn btn-primary shrink-0 px-4 py-2 text-sm" pending="…">发送</SubmitButton>
              </form>
            </section>

            {/* 工地日志 */}
            <section className="card p-5">
              <div className="mb-4 text-sm font-semibold">📝 工地日志 <span className="ml-1 text-xs font-normal text-zinc-400">业主端实时可见</span></div>
              <div className="space-y-3">
                {logs.map((l) => (
                  <div key={l.id} className="overflow-hidden rounded-xl border border-zinc-100">
                    <div className="px-4 pt-3">
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                        <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-600">{l.author}</span>
                        {l.step_name && <span>{l.step_name}</span>}
                        <span className="ml-auto">{fmtTime(l.created_at)}</span>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed">{l.content}</p>
                    </div>
                    {l.photo && (
                      <div className="px-4 pb-3 pt-2.5">
                        <ZoomImg
                          src={l.photo.startsWith("data:") ? l.photo : `/uploads/${l.photo}`}
                          alt="施工照片"
                          className="h-44 w-full rounded-lg object-cover"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <form action={addLogAction} className="mt-4 border-t border-zinc-100 pt-4">
                <input type="hidden" name="siteId" value={site.id} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">署名</label>
                    <select name="author" className="input" defaultValue={role === "supervisor" ? "张监理" : role === "foreman" ? "李工长" : undefined}>
                      {["李工长", "赵工长", "张监理", "项目经理"].map((a) => <option key={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">所属工序</label>
                    <select name="stepName" className="input">
                      {steps.map((s) => <option key={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="label">日志内容</label>
                  <textarea name="content" rows={2} className="input" placeholder="今天完成了什么、明天做什么、需要业主配合什么……" />
                </div>
                <div className="mt-3">
                  <label className="label">施工照片（选填）</label>
                  <input name="photo" type="file" accept="image/*" className="text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1 file:text-xs" />
                </div>
                <SubmitButton className="btn btn-primary mt-3" pending="发布中…">发布日志</SubmitButton>
              </form>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="card p-5 text-center">
              <div className="mb-3 text-sm font-semibold">📲 邀请业主进工地</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="业主端邀请二维码" className="mx-auto h-44 w-44 rounded-xl ring-1 ring-zinc-100" />
              <div className="mt-3 break-all font-mono text-[11px] text-zinc-400">{inviteUrl}</div>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                业主微信扫码打开：看进度/预算/付款/材料，按清单验收打卡，增项线上签字。
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link href={`/gongdi/${site.id}/baogao`} className="btn btn-ghost text-xs">🖨 工地报告</Link>
                <Link href={`/c/${site.code}`} target="_blank" className="btn btn-ghost text-xs">📱 预览业主端</Link>
              </div>
            </section>

            {role === "boss" ? (
            <section className="card p-5">
              <div className="mb-3 text-sm font-semibold">💵 收款概览</div>
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <Donut pct={payPct} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold tabular-nums">{payPct}%</span>
                    <span className="text-[10px] text-zinc-400">收款进度</span>
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">应付合计</span>
                    <b className="tabular-nums">¥{fmtMoney(totalDue)}</b>
                  </div>
                  <div className="text-[10px] leading-relaxed text-zinc-400">
                    合同 ¥{fmtMoney(site.budget)}{confirmedSum > 0 ? ` + 已确认增项 ¥${fmtMoney(confirmedSum)}` : ""}
                  </div>
                  <div className="flex justify-between border-t border-zinc-100 pt-1.5">
                    <span className="text-emerald-600">已收款</span>
                    <b className="tabular-nums text-emerald-600">¥{fmtMoney(receivedSum)}</b>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-600">待收款</span>
                    <b className="tabular-nums text-amber-600">¥{fmtMoney(Math.max(0, totalDue - receivedSum))}</b>
                  </div>
                </div>
              </div>
            </section>
            ) : (
              <section className="card p-5">
                <div className="mb-2 text-sm font-semibold">
                  {role === "supervisor" ? "🔍 监理提示" : "🧰 工长提示"}
                </div>
                <p className="text-xs leading-relaxed text-zinc-500">
                  {role === "supervisor"
                    ? "维护下方验收清单、发布质检日志；发现问题时在留言板同步业主。财务收款由老板管理。"
                    : "推进工序、登记材料进场、发布带图日志、回复业主留言；财务收款由老板统一管理。"}
                </p>
                <Link href="/zhijian" className="btn btn-ghost mt-3 w-full text-xs">✅ 进入质检验收 →</Link>
              </section>
            )}

            <section className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold">✅ 验收进度</span>
                <span className="text-xs text-zinc-400">{accDone}/{accepts.length}</span>
              </div>
              <Progress value={accepts.length ? (accDone / accepts.length) * 100 : 0} tone="amber" />
              <div className="mt-3 space-y-1.5 text-xs text-zinc-500">
                {[...new Set(accepts.map((a) => a.step_name))].map((name) => {
                  const items = accepts.filter((a) => a.step_name === name);
                  return (
                    <div key={name} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-1.5">
                      <span>{name}</span>
                      <span className="font-mono text-zinc-400">{items.filter((i) => i.done).length}/{items.length}</span>
                    </div>
                  );
                })}
              </div>
              <form action={createAcceptAction} className="no-print mt-4 border-t border-zinc-100 pt-3">
                <input type="hidden" name="siteId" value={site.id} />
                <div className="flex gap-1.5">
                  <select name="stepName" defaultValue={steps.find((s) => s.status === "进行中")?.name} className="input w-24 shrink-0 px-2 py-1.5 text-[11px]">
                    {steps.map((s) => <option key={s.id}>{s.name}</option>)}
                  </select>
                  <input name="item" className="input min-w-0 flex-1 px-2.5 py-1.5 text-[11px]" placeholder="验收项，如：瓷砖缝隙均匀" />
                  <SubmitButton className="btn btn-ghost shrink-0 px-2.5 py-1.5 text-[11px]" pending="…">添加</SubmitButton>
                </div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-400">
                  新建工地时验收清单为空，按工序逐项添加后，业主端即可扫码打卡。
                </p>
              </form>
            </section>
          </aside>
        </div>
      </main>
    </BShell>
  );
}
