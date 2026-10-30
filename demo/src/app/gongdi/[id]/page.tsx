import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { countLiveTasks, getAccepts, getChanges, getLogs, getMaterials, getMessages, getPayments, getSite, getSitePhotos, getSteps, getTaskPoints, getTasks, getWarranties, warrantyDaysLeft } from "@/lib/data";
import { CHANGE_PITFALLS } from "@/lib/checklists";
import {
  addLogAction,
  advanceStepAction,
  arriveMaterialAction,
  createAcceptAction,
  createChangeAction,
  createMaterialAction,
  createPaymentAction,
  createTaskAction,
  createWarrantyAction,
  receivePaymentAction,
  sendStaffMessageAction,
  updateSiteAction,
  updateStepBudgetAction,
} from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ZoomImg } from "@/components/ZoomImg";
import { BShell } from "@/components/BShell";
import { getRole } from "@/lib/role";
import { Donut, Progress, StatusBadge, DueBadge, daysBetween, fmtDate, fmtMoney, fmtTime } from "@/components/ui";

/* 甘特图两侧留白宽度：左标签列 w-14(56px)+gap-2(8px)；右天数列合计 116px */
const GUTTER_L = 64;
const GUTTER_R = 116;

/* 详情页分类 tab：每屏只呈现一个类别（分门别类，避免九卡堆叠） */
const TABS = [
  { key: "jia", label: "概览", icon: "📊", bossOnly: false },
  { key: "shigong", label: "施工", icon: "🧱", bossOnly: false },
  { key: "caiwu", label: "财务", icon: "💰", bossOnly: true },
  { key: "yanshou", label: "验收", icon: "✅", bossOnly: false },
  { key: "goutong", label: "沟通", icon: "💬", bossOnly: false },
] as const;

export default async function GongdiPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params;
  const { t: rawT = "jia" } = await searchParams;
  const t = (["jia", "shigong", "caiwu", "yanshou", "goutong"] as string[]).includes(rawT) ? rawT : "jia";
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
  const warranties = getWarranties(site.id);
  const tasks = getTasks(site.id);
  const sitePhotos = getSitePhotos(site.id);
  const liveTasks = tasks.filter((x) => x.live === 1);

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
  const doneSteps = steps.filter((s) => s.status === "已完成").length;
  const totalDue = site.budget + confirmedSum;
  const payPct = totalDue > 0 ? Math.min(100, Math.round((receivedSum / totalDue) * 100)) : 0;

  // 工期超期：进行中工序超出计划天数的最大值
  const delayDays = Math.max(
    0,
    ...steps
      .filter((s) => s.status === "进行中" && s.started_at && s.planned_days > 0)
      .map((s) => daysBetween(s.started_at) - s.planned_days)
  );

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

  // 日期刻度：最多 8 个刻度点，贯穿网格线与顶部日期标签共用同一 left 公式
  const tickStep = Math.max(1, Math.ceil(totalDays / 8));
  const tickDays: number[] = [];
  for (let i = 0; i <= totalDays; i += tickStep) tickDays.push(i);
  const tickLeft = (d: number) => `calc(${GUTTER_L}px + (100% - ${GUTTER_R}px) * ${d / totalDays})`;
  const tickLabel = (d: number) => fmtDate(new Date(anchorMs + d * DAY).toISOString());

  /* ============ 共享卡片（两种角色复用，日志/留言抽变量避免重复） ============ */

  const stepsCard = (
    <section className="card p-4 lg:col-span-2">
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[13px] font-semibold">🧱 工序进度与预算</span>
        <span className="text-[10px] text-zinc-400">预算 ¥{fmtMoney(plannedSum)} · 实际 ¥{fmtMoney(actualSum)}</span>
      </div>
      <div className="space-y-2">
        {steps.map((st) => {
          const ratio = st.planned > 0 ? (st.actual / st.planned) * 100 : 0;
          const over = st.planned > 0 && st.actual > st.planned;
          const elapsed = daysBetween(st.started_at);
          const usedDays = Math.max(1, daysBetween(st.started_at, st.finished_at));
          const dayOver = st.planned_days > 0 && (st.status === "进行中" ? elapsed > st.planned_days : usedDays > st.planned_days);
          return (
            <div key={st.id} className="rounded-xl border border-zinc-100 bg-zinc-50/60 px-3.5 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-zinc-400 ring-1 ring-zinc-200">
                  {st.sort + 1}
                </span>
                <span className="text-[13px] font-medium">{st.name}</span>
                <StatusBadge status={st.status} />
                {st.status === "待开工" && st.planned_days > 0 && (
                  <span className="text-[10px] text-zinc-400">计划 {st.planned_days} 天</span>
                )}
                {st.status === "进行中" && (
                  <span className={`text-[10px] font-medium ${dayOver ? "text-red-500" : "text-amber-600"}`}>
                    已 {elapsed} 天 · 计划 {st.planned_days} 天{dayOver ? ` · 超期 ${elapsed - st.planned_days} 天` : ""}
                  </span>
                )}
                {st.status === "已完成" && (
                  <span className={`text-[10px] font-medium ${dayOver ? "text-red-500" : "text-emerald-600"}`}>
                    用时 {usedDays} 天{st.planned_days > 0 ? (dayOver ? ` · 超期 ${usedDays - st.planned_days} 天` : " · 准时") : ""}
                  </span>
                )}
                <form action={advanceStepAction} className="ml-auto">
                  <input type="hidden" name="stepId" value={st.id} />
                  <input type="hidden" name="siteId" value={site.id} />
                  <input type="hidden" name="current" value={st.status} />
                  <SubmitButton className="btn btn-ghost px-2.5 py-1 text-[11px]" pending="…">
                    {st.status === "待开工" ? "开始施工 →" : st.status === "进行中" ? "标记完成 →" : "重置"}
                  </SubmitButton>
                </form>
              </div>
              <div className="mt-1.5 flex items-center gap-2.5">
                <span className="w-24 shrink-0 font-mono text-[10px] text-zinc-400">
                  ¥{fmtMoney(st.planned)}
                </span>
                <div className="min-w-0 flex-1">
                  <Progress value={ratio} tone={over ? "red" : "indigo"} thin />
                </div>
                <form action={updateStepBudgetAction} className="flex shrink-0 items-center gap-1">
                  <input type="hidden" name="stepId" value={st.id} />
                  <input type="hidden" name="siteId" value={site.id} />
                  <input type="hidden" name="planned" value={st.planned} />
                  <span className="text-[10px] text-zinc-400">实际</span>
                  <input name="actual" type="number" defaultValue={st.actual} className="w-20 rounded-lg border border-zinc-200 bg-white px-1.5 py-0.5 text-right font-mono text-[11px] outline-none focus:border-indigo-400" />
                  <SubmitButton className="btn btn-ghost px-1.5 py-0.5 text-[10px]" pending="…">存</SubmitButton>
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  const ganttCard = (
    <section className="card p-4 lg:col-span-2">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-semibold">📅 工期甘特图</span>
        <div className="flex flex-wrap items-center gap-2.5 text-[9px] text-zinc-400">
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-emerald-400" />已完成</span>
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-amber-400" />进行中</span>
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-zinc-300" />未开始</span>
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-red-300" />超出计划</span>
          <span className="flex items-center gap-1"><i className="h-3 w-0 border-l-2 border-dashed border-indigo-400" />今天</span>
        </div>
      </div>
      <div className="relative">
        {/* 日期刻度网格线（贯穿） */}
        {tickDays.map((d) => (
          <i key={`g${d}`} className="pointer-events-none absolute bottom-0 top-[18px] border-l border-dashed border-zinc-100" style={{ left: tickLeft(d) }} />
        ))}
        {/* 今天线 */}
        <i className="pointer-events-none absolute bottom-0 top-[18px] z-10 border-l-2 border-dashed border-indigo-400" style={{ left: tickLeft(todayRatio * totalDays) }} />
        {/* 顶部日期标签 */}
        <div className="relative mb-1 h-3.5">
          {tickDays.map((d) => (
            <span key={`t${d}`} className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[9px] tabular-nums text-zinc-300" style={{ left: tickLeft(d) }}>
              {tickLabel(d)}
            </span>
          ))}
        </div>
        <div className="space-y-1">
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
              <div key={row.id} className="relative z-[1] flex items-center gap-2">
                <span className={`w-14 shrink-0 truncate text-[11px] ${row.status === "待开工" ? "text-zinc-400" : "font-medium text-zinc-600"}`}>
                  {row.name}
                </span>
                <div className="relative h-4.5 flex-1 overflow-hidden rounded-md bg-white ring-1 ring-zinc-100">
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
      <p className="mt-2 text-[10px] text-zinc-400">
        自 {fmtDate(anchorIso)} 开工排起；未开工工序按计划工期自动顺排，红色为越出计划部分。
      </p>
    </section>
  );

  const acceptCard = (
    <section className="card p-4 lg:col-span-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-semibold">✅ 验收进度</span>
        <span className="text-[10px] font-mono text-zinc-400">{accDone}/{accepts.length}</span>
      </div>
      <Progress value={accepts.length ? (accDone / accepts.length) * 100 : 0} tone="amber" thin />
      <div className="mt-2.5 space-y-1 text-[11px]">
        {[...new Set(accepts.map((a) => a.step_name))].map((name) => {
          const items = accepts.filter((a) => a.step_name === name);
          return (
            <div key={name} className="flex items-center justify-between rounded-lg bg-zinc-50 px-2.5 py-1">
              <span className="text-zinc-600">{name}</span>
              <span className="font-mono text-zinc-400">{items.filter((i) => i.done).length}/{items.length}</span>
            </div>
          );
        })}
      </div>
      <form action={createAcceptAction} className="no-print mt-2.5 border-t border-zinc-100 pt-2.5">
        <input type="hidden" name="siteId" value={site.id} />
        <div className="flex gap-1.5">
          <select name="stepName" defaultValue={steps.find((s) => s.status === "进行中")?.name} className="input w-24 shrink-0 px-1.5 py-1 text-[11px]">
            {steps.map((s) => <option key={s.id}>{s.name}</option>)}
          </select>
          <input name="item" className="input min-w-0 flex-1 px-2.5 py-1 text-[11px]" placeholder="自定义验收项，如：瓷砖缝隙均匀" />
          <SubmitButton className="btn btn-ghost shrink-0 px-2.5 py-1 text-[11px]" pending="…">添加</SubmitButton>
        </div>
        <p className="mt-1.5 text-[10px] text-zinc-400">标准清单已随模板生成，此处补充自定义项。</p>
      </form>
    </section>
  );

  const materialCard = (
    <section className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-semibold">📦 材料进场</span>
        <span className="text-[10px] font-mono text-zinc-400">{matDone}/{materials.length}</span>
      </div>
      <div className="space-y-1.5">
        {materials.length === 0 && <p className="text-[11px] text-zinc-400">暂无材料记录。</p>}
        {materials.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg bg-zinc-50 px-2.5 py-1.5">
            <span className={`text-[11px] ${m.status === "已进场" ? "font-medium text-zinc-700" : "text-zinc-500"}`}>{m.name}</span>
            {m.spec && <span className="hidden truncate text-[10px] text-zinc-400 xl:inline">{m.spec}</span>}
            <StatusBadge status={m.status} />
            {m.status === "已进场" ? (
              <span className="ml-auto shrink-0 text-[10px] text-zinc-400">{fmtTime(m.arrived_at)}</span>
            ) : (
              <form action={arriveMaterialAction} className="ml-auto shrink-0">
                <input type="hidden" name="materialId" value={m.id} />
                <input type="hidden" name="siteId" value={site.id} />
                <SubmitButton className="btn btn-ghost px-2 py-0.5 text-[10px]" pending="…">登记进场</SubmitButton>
              </form>
            )}
          </div>
        ))}
      </div>
      <details className="no-print group mt-2 border-t border-zinc-100 pt-2">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-500 [&::-webkit-details-marker]:hidden">
          <span className="transition-transform group-open:rotate-90">▸</span> ＋ 添加材料
        </summary>
        <form action={createMaterialAction} className="mt-2 flex flex-wrap gap-1.5">
          <input type="hidden" name="siteId" value={site.id} />
          <input name="name" className="input min-w-0 flex-1 px-2.5 py-1 text-[11px]" placeholder="材料名，如：石膏板" required />
          <input name="spec" className="input w-28 px-2.5 py-1 text-[11px]" placeholder="品牌型号" />
          <input name="qty" className="input w-16 px-2.5 py-1 text-[11px]" placeholder="数量" />
          <SubmitButton className="btn btn-ghost px-2.5 py-1 text-[11px]" pending="…">添加</SubmitButton>
        </form>
      </details>
    </section>
  );

  const logsCard = (
    <section className="card p-4 lg:col-span-3">
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[13px] font-semibold">📝 工地日志</span>
        <span className="text-[10px] text-zinc-400">业主端实时可见 · {logs.length} 条</span>
      </div>
      <div className="space-y-2">
        {logs.map((l) => (
          <div key={l.id} className="overflow-hidden rounded-xl border border-zinc-100">
            <div className="px-3.5 pt-2.5">
              <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-600">{l.author}</span>
                {l.step_name && <span>{l.step_name}</span>}
                <span className="ml-auto">{fmtTime(l.created_at)}</span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed">{l.content}</p>
            </div>
            {l.photo && (
              <div className="px-3.5 pb-2.5 pt-2">
                <ZoomImg
                  src={l.photo.startsWith("data:") ? l.photo : `/uploads/${l.photo}`}
                  alt="施工照片"
                  className="h-36 w-full rounded-lg object-cover"
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <details className="no-print group mt-2.5 border-t border-zinc-100 pt-2.5">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-500 [&::-webkit-details-marker]:hidden">
          <span className="transition-transform group-open:rotate-90">▸</span> ✍️ 发布施工日志
        </summary>
        <form action={addLogAction} className="mt-2.5">
          <input type="hidden" name="siteId" value={site.id} />
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="label">署名</label>
              <select name="author" className="input px-2.5 py-1.5 text-xs" defaultValue={role === "supervisor" ? "张监理" : role === "foreman" ? "李工长" : undefined}>
                {["李工长", "赵工长", "张监理", "项目经理"].map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="label">所属工序</label>
              <select name="stepName" className="input px-2.5 py-1.5 text-xs">
                {steps.map((s) => <option key={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-2">
            <label className="label">日志内容</label>
            <textarea name="content" rows={2} className="input" placeholder="今天完成了什么、明天做什么、需要业主配合什么……" />
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <label className="label">施工照片（选填）</label>
              <input name="photo" type="file" accept="image/*" className="w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1 file:text-xs" />
            </div>
            <SubmitButton className="btn btn-primary shrink-0" pending="发布中…">发布日志</SubmitButton>
          </div>
        </form>
      </details>
    </section>
  );

  const messagesInner = (
    <>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[13px] font-semibold">💬 留言板</span>
        <span className="text-[10px] text-zinc-400">与业主实时互通</span>
      </div>
      <div className="space-y-2">
        {messages.length === 0 && <p className="text-[11px] text-zinc-400">还没有留言。</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender === "工长" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[85%]">
              <div className={`rounded-2xl px-3 py-1.5 text-[13px] leading-relaxed ${m.sender === "工长" ? "rounded-br-md bg-indigo-600 text-white" : "rounded-bl-md bg-zinc-100 text-zinc-800"}`}>
                {m.content}
              </div>
              <div className={`mt-0.5 text-[9px] text-zinc-400 ${m.sender === "工长" ? "text-right" : ""}`}>
                {m.author} · {fmtTime(m.created_at)}
              </div>
            </div>
          </div>
        ))}
      </div>
      <form action={sendStaffMessageAction} className="mt-2 flex gap-1.5 border-t border-zinc-100 pt-2">
        <input type="hidden" name="siteId" value={site.id} />
        <select name="author" className="input w-20 shrink-0 px-1.5 py-1.5 text-[11px]">
          {["李工长", "赵工长", "张监理", "项目经理"].map((a) => <option key={a}>{a}</option>)}
        </select>
        <input name="content" className="input min-w-0 flex-1 px-2.5 py-1.5 text-xs" placeholder={`回复 ${site.owner_name ?? "业主"}…`} />
        <SubmitButton className="btn btn-primary shrink-0 px-3 py-1.5 text-xs" pending="…">发送</SubmitButton>
      </form>
    </>
  );

  /* ============ 新增：现场照片流 / 安装任务（工人小程序联动） ============ */

  const photosCard = (
    <section className="card p-4 lg:col-span-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[13px] font-semibold">📷 现场照片流</span>
        <span className="text-[10px] text-zinc-400">工人端拍照自动归档 · 共 {sitePhotos.length} 张</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { key: "before", label: "施工前", icon: "📷" },
          { key: "material", label: "材料核对", icon: "📦" },
          { key: "after", label: "施工后", icon: "✨" },
        ].map((c) => {
          const list = sitePhotos.filter((p) => p.category === c.key);
          return (
            <div key={c.key}>
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] text-zinc-400">
                <span className="font-medium text-zinc-500">{c.icon} {c.label}</span>
                <span className="rounded-full bg-zinc-100 px-1.5 font-mono">{list.length}</span>
              </div>
              <div className="space-y-2">
                {list.length === 0 && (
                  <div className="rounded-lg bg-zinc-50 py-8 text-center text-[10px] text-zinc-300">暂无照片</div>
                )}
                {list.map((p) => (
                  <div key={p.id} className="overflow-hidden rounded-lg ring-1 ring-zinc-100">
                    <ZoomImg src={p.url} alt={p.task_title} className="h-28 w-full object-cover" />
                    <div className="truncate bg-white px-2 py-1 text-[9px] text-zinc-400">
                      {p.task_title} · {p.worker}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  const tasksCard = (
    <section className="card p-4 lg:col-span-2">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-1">
        <span className="text-[13px] font-semibold">🧰 安装任务</span>
        <span className="text-[10px] text-zinc-400">派单 → 工人小程序执行 · 待办 {tasks.filter((t) => t.status !== "已完成").length}</span>
      </div>
      <div className="space-y-1.5">
        {tasks.length === 0 && <p className="text-[11px] text-zinc-400">暂无任务，工长可从下方派单。</p>}
        {tasks.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg bg-zinc-50 px-2.5 py-1.5">
            <span className="text-[12px] font-medium text-zinc-700">{t.title}</span>
            {t.live === 1 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> 直播中
              </span>
            )}
            <span className="text-[10px] text-zinc-400">📍{t.room} · {t.worker}</span>
            <StatusBadge status={t.status} />
            {(() => {
              const pts = getTaskPoints(t.id);
              if (pts.length === 0) return null;
              const d = pts.filter((p) => p.status === "已完成").length;
              return (
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ring-1 ring-inset ${
                  d === pts.length ? "bg-emerald-50 text-emerald-600 ring-emerald-200" : "bg-indigo-50 text-indigo-600 ring-indigo-100"
                }`}>
                  点位 {d}/{pts.length}
                </span>
              );
            })()}
            <span className="ml-auto font-mono text-[10px] text-zinc-400">
              📷{sitePhotos.filter((p) => p.task_id === t.id).length} · {fmtDate(t.created_at)}
            </span>
          </div>
        ))}
      </div>
      <details className="no-print group mt-2 border-t border-zinc-100 pt-2">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-500 [&::-webkit-details-marker]:hidden">
          <span className="transition-transform group-open:rotate-90">▸</span> ＋ 派任务给安装工人
        </summary>
        <form action={createTaskAction} className="mt-2.5">
          <input type="hidden" name="siteId" value={site.id} />
          <div className="grid gap-2 md:grid-cols-[1fr_100px_1fr_100px]">
            <input name="title" className="input px-2.5 py-1.5 text-xs" placeholder="任务内容，如：主卧安装 5 个插座" required />
            <input name="room" className="input px-2.5 py-1.5 text-xs" placeholder="点位房间" />
            <select name="stepName" className="input px-2.5 py-1.5 text-xs" defaultValue={steps.find((s) => s.status === "进行中")?.name}>
              {steps.map((s) => <option key={s.id}>{s.name}</option>)}
            </select>
            <input name="worker" className="input px-2.5 py-1.5 text-xs" placeholder="工人（张师傅）" />
          </div>
          <div className="mt-2 flex items-end gap-2.5">
            <input name="note" className="input min-w-0 flex-1 px-2.5 py-1.5 text-xs" placeholder="备注：材料清单/注意事项（选填）" />
            <SubmitButton className="btn btn-primary shrink-0 px-3 py-1.5 text-xs" pending="派单中…">派单</SubmitButton>
          </div>
          <p className="mt-1.5 text-[10px] text-zinc-400">工人小程序打开任务：对照点位图纸施工，上传施工前/材料/施工后三类照片，打卡完成自动推送各方。</p>
        </form>
      </details>
    </section>
  );

  const photosPreview = (
    <section className="card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold">📷 现场照片</span>
        <Link href={`/gongdi/${id}?t=shigong`} className="text-[10px] font-medium text-indigo-600 hover:underline">
          全部 {sitePhotos.length} 张 →
        </Link>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {sitePhotos.slice(0, 4).map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.id} src={p.url} alt={p.task_title} className="h-20 w-full rounded-lg object-cover ring-1 ring-zinc-100" />
        ))}
      </div>
      <div className="mt-2 text-[9px] text-zinc-400">施工前 / 材料 / 施工后 三类自动归档，任务完成即推送各方。</div>
    </section>
  );

  /* ============ 角色专属卡片 ============ */

  const paymentCard = (
    <section className="card p-4">
      <div className="mb-2.5 text-[13px] font-semibold">💰 收款进度</div>
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <Donut pct={payPct} size={92} stroke={10} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-base font-bold tabular-nums">{payPct}%</span>
            <span className="text-[9px] text-zinc-400">已收</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span className="text-zinc-500">应付合计</span>
            <b className="tabular-nums">¥{fmtMoney(totalDue)}</b>
          </div>
          <div className="text-[9px] leading-snug text-zinc-400">
            合同 ¥{fmtMoney(site.budget)}{confirmedSum > 0 ? ` + 增项 ¥${fmtMoney(confirmedSum)}` : ""}
          </div>
          <div className="flex justify-between border-t border-zinc-100 pt-1">
            <span className="text-emerald-600">已收款</span>
            <b className="tabular-nums text-emerald-600">¥{fmtMoney(receivedSum)}</b>
          </div>
          <div className="flex justify-between">
            <span className="text-amber-600">待收款</span>
            <b className="tabular-nums text-amber-600">¥{fmtMoney(Math.max(0, totalDue - receivedSum))}</b>
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-1 border-t border-zinc-100 pt-2.5">
        {payments.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg bg-zinc-50 px-2.5 py-1.5">
            <span className="text-[11px] font-medium text-zinc-700">{p.title}</span>
            <StatusBadge status={p.status} />
            <DueBadge due={p.due_date} status={p.status} />
            <span className="ml-auto font-mono text-[11px] font-semibold tabular-nums text-zinc-700">¥{fmtMoney(p.amount)}</span>
            {p.status === "已收款" ? (
              <span className="shrink-0 text-[9px] text-zinc-400">{fmtTime(p.paid_at)}</span>
            ) : (
              <form action={receivePaymentAction} className="shrink-0">
                <input type="hidden" name="paymentId" value={p.id} />
                <input type="hidden" name="siteId" value={site.id} />
                <SubmitButton className="btn btn-ghost px-2 py-0.5 text-[10px]" pending="…">登记收款</SubmitButton>
              </form>
            )}
          </div>
        ))}
      </div>
      <form action={createPaymentAction} className="mt-2.5 flex gap-1.5 border-t border-zinc-100 pt-2.5">
        <input type="hidden" name="siteId" value={site.id} />
        <input name="title" className="input min-w-0 flex-1 px-2.5 py-1 text-[11px]" placeholder="节点名，如：增项预付" />
        <input name="amount" type="number" className="input w-20 px-2 py-1 text-right font-mono text-[11px]" placeholder="¥" />
        <SubmitButton className="btn btn-ghost shrink-0 px-2.5 py-1 text-[11px]" pending="…">添加</SubmitButton>
      </form>
    </section>
  );

  const changeCard = (
    <section className="card p-4 lg:col-span-2">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[13px] font-semibold">📋 增项管理</span>
        <span className="text-[10px] text-zinc-400">已确认 +¥{fmtMoney(confirmedSum)}</span>
      </div>
      <div className="space-y-1.5">
        {changes.length === 0 && <p className="text-[11px] text-zinc-400">暂无增项单。</p>}
        {changes.map((c) => (
          <div key={c.id} className="rounded-xl border border-zinc-100 px-3.5 py-2">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium">{c.title}</span>
              <StatusBadge status={c.status} />
              <span className={`ml-auto font-mono text-[13px] font-semibold ${c.status === "已拒绝" ? "text-zinc-300 line-through" : "text-zinc-800"}`}>
                +¥{fmtMoney(c.amount)}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[10px] text-zinc-400">
              {c.reason && <span>{c.reason}</span>}
              {c.decided_by && <span className="text-emerald-600">{c.decided_by} {fmtTime(c.decided_at)}</span>}
              {c.decided_comment && <span className="text-zinc-500">"{c.decided_comment}"</span>}
            </div>
          </div>
        ))}
      </div>
      <details className="no-print group mt-2.5 border-t border-zinc-100 pt-2.5">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-500 [&::-webkit-details-marker]:hidden">
          <span className="transition-transform group-open:rotate-90">▸</span> ＋ 新建增项单（推送业主端）
        </summary>
        <form action={createChangeAction} className="mt-2.5">
          <input type="hidden" name="siteId" value={site.id} />
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_110px]">
            <input name="title" className="input px-2.5 py-1.5 text-xs" placeholder="增项内容，如：主卫增加壁龛" required />
            <input name="reason" className="input px-2.5 py-1.5 text-xs" placeholder="原因，如：业主需求变更" />
            <input name="amount" type="number" className="input px-2.5 py-1.5 text-right font-mono text-xs" placeholder="金额 ¥" />
          </div>
          <SubmitButton className="btn btn-primary mt-2 px-3 py-1.5 text-xs" pending="创建中…">创建增项单</SubmitButton>
          <div className="mt-2 rounded-xl bg-amber-50/70 px-3 py-2">
            <div className="text-[10px] font-semibold text-amber-700">⚠️ 常见易漏项参考（对照后再报价）</div>
            <p className="mt-0.5 text-[10px] leading-relaxed text-amber-600/90">{CHANGE_PITFALLS.join(" · ")}</p>
          </div>
        </form>
      </details>
    </section>
  );

  const warrantyCard = (
    <section className="card p-4">
      <div className="mb-2 text-[13px] font-semibold">🛡️ 保修台账</div>
      <div className="space-y-1.5">
        {warranties.length === 0 && <p className="text-[11px] text-zinc-400">暂无保修记录（竣工验收后登记）。</p>}
        {warranties.map((w) => {
          const left = warrantyDaysLeft(w);
          const expired = left < 0;
          return (
            <div key={w.id} className="rounded-xl border border-zinc-100 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-zinc-700">{w.item}</span>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                  expired ? "bg-zinc-100 text-zinc-400 ring-zinc-200" : left <= 90 ? "bg-amber-50 text-amber-600 ring-amber-200" : "bg-emerald-50 text-emerald-600 ring-emerald-200"
                }`}>
                  {expired ? "已过保" : `余 ${left} 天`}
                </span>
              </div>
              <div className="mt-0.5 text-[9px] text-zinc-400">
                {fmtDate(w.start_date)} 起保 · {w.months} 个月 · {fmtDate(w.end_date)} 到期{w.note ? ` · ${w.note}` : ""}
              </div>
            </div>
          );
        })}
      </div>
      <details className="no-print group mt-2 border-t border-zinc-100 pt-2">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-500 [&::-webkit-details-marker]:hidden">
          <span className="transition-transform group-open:rotate-90">▸</span> ＋ 登记保修
        </summary>
        <form action={createWarrantyAction} className="mt-2 flex gap-1.5">
          <input type="hidden" name="siteId" value={site.id} />
          <input name="item" className="input min-w-0 flex-1 px-2.5 py-1 text-[11px]" placeholder="工程名，如：厨房防水" />
          <input name="months" type="number" defaultValue={24} className="input w-16 shrink-0 px-2 py-1 text-right font-mono text-[11px]" title="保修月数" />
          <SubmitButton className="btn btn-ghost shrink-0 px-2.5 py-1 text-[11px]" pending="…">登记</SubmitButton>
        </form>
      </details>
    </section>
  );

  const tipCard = (
    <section className="card p-4">
      <div className="text-[13px] font-semibold">{role === "supervisor" ? "🔍 监理提示" : "🧰 工长提示"}</div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
        {role === "supervisor"
          ? "维护验收清单、发布质检日志；发现问题时在留言板同步业主。财务收款由老板管理。"
          : "推进工序、登记材料进场、发布带图日志、回复业主留言；财务收款由老板统一管理。"}
      </p>
      <Link href="/zhijian" className="btn btn-ghost mt-2.5 w-full text-xs">✅ 进入质检验收 →</Link>
    </section>
  );

  const inviteStack = (
    <div className="space-y-4">
      <section className="card p-4 text-center">
        <div className="text-[13px] font-semibold">📲 邀请业主</div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="业主端邀请二维码" className="mx-auto mt-2 h-24 w-24 rounded-xl ring-1 ring-zinc-100" />
        <div className="mt-1.5 font-mono text-xs font-bold tracking-widest text-indigo-600">{site.code}</div>
        <Link href={`/c/${site.code}`} target="_blank" className="btn btn-ghost mt-2 w-full text-xs">📱 预览业主端</Link>
      </section>
      <section className="card p-4">
        <div className="text-[13px] font-semibold">🖨 工地报告</div>
        <p className="mt-1 text-[10px] leading-relaxed text-zinc-400">生成可打印的施工进度报告。</p>
        <Link href={`/gongdi/${site.id}/baogao`} className="btn btn-ghost mt-2 w-full text-xs">打开报告 →</Link>
      </section>
    </div>
  );

  /* ============ 页面组装 ============ */

  const kpis = [
    { icon: "🧱", label: "工序进度", value: `${doneSteps}/${steps.length}`, hint: "道工序已完成", warn: false },
    delayDays > 0
      ? { icon: "⏰", label: "工期状态", value: `延期 ${delayDays} 天`, hint: "有工序超出计划", warn: true }
      : { icon: "⏰", label: "工期状态", value: "按期推进", hint: "进行中工序未超计划", warn: false },
    pendingChg > 0
      ? { icon: "📋", label: "增项确认", value: `${pendingChg} 笔`, hint: "待业主确认", warn: true }
      : { icon: "📋", label: "增项确认", value: `+¥${fmtMoney(confirmedSum)}`, hint: "已确认增项金额", warn: false },
    role === "boss"
      ? { icon: "💰", label: "收款进度", value: `${payPct}%`, hint: `已收 ¥${fmtMoney(receivedSum)}`, warn: false }
      : { icon: "📦", label: "材料进场", value: `${matDone}/${materials.length}`, hint: "项材料已到场", warn: false },
    { icon: "✅", label: "验收完成", value: `${accDone}/${accepts.length}`, hint: "项验收打卡通过", warn: false },
  ];

  return (
    <BShell active="/">
      <main className="mx-auto max-w-6xl px-6 py-6">
        {/* Hero 渐变紧凑条 */}
        <div className="mb-4 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 text-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <div className="min-w-0">
              <h1 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                {site.name}
                {pendingChg > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ring-white/25">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" /> {pendingChg} 笔增项待业主确认
                  </span>
                )}
                {delayDays > 0 && (
                  <span className="rounded-full bg-red-500/30 px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ring-red-300/40">
                    ⚠ 工序超期 {delayDays} 天
                  </span>
                )}
              </h1>
              <div className="mt-0.5 truncate text-xs text-indigo-100">
                {site.community} · {site.layout} · 业主 {site.owner_name} · 工长 {site.foreman}
              </div>
            </div>
            {role === "boss" && (
              <div className="flex shrink-0 items-center gap-4">
                <div className="text-right text-[11px] leading-tight text-indigo-100">
                  <div>合同 <b className="text-white">¥{fmtMoney(site.budget)}</b></div>
                  <div>已收 <b className="text-emerald-200">¥{fmtMoney(receivedSum)}</b></div>
                </div>
                <div className="rounded-lg bg-white/15 px-2.5 py-1 ring-1 ring-inset ring-white/25">
                  <div className="text-[9px] text-indigo-100">业主邀请码</div>
                  <div className="font-mono text-sm font-bold tracking-widest">{site.code}</div>
                </div>
              </div>
            )}
          </div>
          {role === "boss" && (
            <details className="no-print group mt-3 border-t border-white/15 pt-2">
              <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-indigo-100 hover:text-white [&::-webkit-details-marker]:hidden">
                <span className="transition-transform group-open:rotate-90">▸</span> ✏️ 编辑工地信息
              </summary>
              <form action={updateSiteAction} className="mt-2.5 grid gap-2.5 rounded-xl bg-white/10 p-3.5 backdrop-blur md:grid-cols-3">
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

        {/* KPI strip（5 mini 卡） */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {kpis.map((k) => (
            <div key={k.label} className={`card px-3.5 py-2.5 ${k.warn ? "ring-2 ring-red-200" : ""}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500">{k.label}</span>
                <span className="text-[11px]">{k.icon}</span>
              </div>
              <div className={`mt-0.5 text-[15px] font-semibold tabular-nums ${k.warn ? "text-red-600" : ""}`}>{k.value}</div>
              <div className={`text-[9px] ${k.warn ? "font-medium text-red-500" : "text-zinc-400"}`}>{k.hint}</div>
            </div>
          ))}
        </div>

        {/* 直播横幅（工地级状态，所有 tab 可见） */}
        {liveTasks.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2.5 rounded-xl bg-red-50 px-4 py-2.5 ring-1 ring-inset ring-red-100">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <span className="text-xs font-semibold text-red-600">
              🔴 {liveTasks[0].worker} 正在直播「{liveTasks[0].title}」· {liveTasks[0].room}
            </span>
            <span className="ml-auto text-[10px] text-red-400">工人小程序推流 · 工长/监理/业主可围观</span>
          </div>
        )}

        {/* 分门别类 tab 栏 */}
        <div className="no-print mb-4 flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm ring-1 ring-zinc-100">
          {TABS.filter((x) => !x.bossOnly || role === "boss").map((x) => {
            const on = t === x.key;
            const openCount = tasks.filter((k) => k.status !== "已完成").length;
            return (
              <Link
                key={x.key}
                href={`/gongdi/${site.id}?t=${x.key}`}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-medium transition ${
                  on ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-500 hover:bg-zinc-50"
                }`}
              >
                <span>{x.icon}</span>
                {x.label}
                {x.key === "shigong" && openCount > 0 && (
                  <span className={`rounded-full px-1.5 text-[9px] font-bold ${on ? "bg-white/20" : "bg-amber-100 text-amber-600"}`}>
                    {openCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* 内容区：按 tab 分桶，每屏只呈现当前类别 */}
        <div className="grid gap-4 lg:grid-cols-3">
          {t === "jia" && (
            <>
              {ganttCard}
              {tipCard}
              {stepsCard}
              {photosPreview}
            </>
          )}

          {t === "shigong" && (
            <>
              {photosCard}
              {tasksCard}
              {materialCard}
              {logsCard}
            </>
          )}

          {t === "caiwu" &&
            (role === "boss" ? (
              <>
                {paymentCard}
                {changeCard}
              </>
            ) : (
              <section className="card p-6 lg:col-span-3">
                <div className="text-[13px] font-semibold">💰 财务收款</div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
                  财务与增项金额由老板统一管理（信息隔离）。{role === "supervisor" ? "监理" : "工长"}的日常操作：推进工序、登记材料、发布日志、验收打卡。
                </p>
              </section>
            ))}

          {t === "yanshou" && (
            <>
              {acceptCard}
              {warrantyCard}
            </>
          )}

          {t === "goutong" && (
            <>
              <section className="card p-4 lg:col-span-2">{messagesInner}</section>
              {inviteStack}
            </>
          )}
        </div>
      </main>
    </BShell>
  );
}
