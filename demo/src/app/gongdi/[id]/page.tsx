import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getAccepts, getChanges, getLogs, getMaterials, getPayments, getSite, getSteps } from "@/lib/data";
import {
  addLogAction,
  advanceStepAction,
  arriveMaterialAction,
  createChangeAction,
  createMaterialAction,
  createPaymentAction,
  receivePaymentAction,
  updateStepBudgetAction,
} from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ZoomImg } from "@/components/ZoomImg";
import { Progress, StatusBadge, daysBetween, fmtMoney, fmtTime } from "@/components/ui";

export default async function GongdiPage({ params }: { params: Promise<{ id: string }> }) {
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

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="text-sm text-zinc-500 transition hover:text-zinc-900">← 返回总览</Link>
          <div className="text-sm text-zinc-500">B端 · 工地详情</div>
        </div>
      </header>

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
            <span>合同额 <b className="text-zinc-800">¥{fmtMoney(site.budget)}</b></span>
            <span>已收 <b className="text-emerald-600">¥{fmtMoney(receivedSum)}</b></span>
            <span>邀请码 <b className="font-mono text-indigo-600">{site.code}</b></span>
          </div>
        </div>

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

            {/* 付款管理 */}
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

            {/* 增项管理 */}
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
                    <select name="author" className="input">
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
            </section>

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
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
