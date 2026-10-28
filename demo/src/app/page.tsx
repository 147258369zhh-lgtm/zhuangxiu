import Link from "next/link";
import { listSitesWithProgress, recentEvents, getSteps, getAccepts, getMaterials, getMessages, countOverduePayments } from "@/lib/data";
import { getRole } from "@/lib/role";
import { SITE_TEMPLATES } from "@/lib/checklists";
import { createSiteAction } from "./actions";
import { BShell } from "@/components/BShell";
import { SubmitButton } from "@/components/SubmitButton";
import { Donut, Progress, fmtMoney, fmtTime } from "@/components/ui";

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
  const role = await getRole();
  const list0 = listSitesWithProgress();
  const list = role === "foreman" ? list0.filter((x) => x.site.foreman === "李工长") : list0;
  const withStatus = list.map((x) => ({
    ...x,
    st: x.done === x.total ? "已竣工" : x.done > 0 ? "进行中" : "待开工",
  }));
  const filtered =
    f === "active" ? withStatus.filter((x) => x.st === "进行中")
    : f === "todo" ? withStatus.filter((x) => x.st === "待开工")
    : f === "done" ? withStatus.filter((x) => x.st === "已竣工")
    : withStatus;

  const active = withStatus.filter((x) => x.st === "进行中").length;
  const budgetSum = list.reduce((s, { site }) => s + (site.budget || 0), 0);
  const extraSum = list.reduce((s, x) => s + x.extraAmount, 0);
  const receivedSum = list.reduce((s, x) => s + x.receivedAmount, 0);
  const pendingTotal = list.reduce((s, x) => s + x.pendingChanges, 0);
  const delayedSites = list.filter((x) => x.delayDays > 0);
  const overduePays = role === "boss" ? countOverduePayments() : 0;

  // 工长/监理视角的施工侧统计
  let activeSteps = 0;
  let pendingAccs = 0;
  let matPending = 0;
  let unreadMsgs = 0;
  for (const { site } of list) {
    activeSteps += getSteps(site.id).filter((s) => s.status === "进行中").length;
    pendingAccs += getAccepts(site.id).filter((a) => !a.done).length;
    matPending += getMaterials(site.id).filter((m) => m.status !== "已进场").length;
    unreadMsgs += getMessages(site.id).filter((m) => m.sender === "业主").length;
  }
  // 工长视角：动态流只保留自己工地的事件（不泄露其他工地的经营信息）
  const myCodes = new Set(list.map((x) => x.site.code));
  const events =
    role === "foreman"
      ? recentEvents(12).filter((e) => myCodes.has(e.code)).slice(0, 6)
      : recentEvents(6);

  const cards =
    role === "boss"
      ? [
          { icon: "🏗️", label: "在建工地", value: `${list.length}`, hint: `进行中 ${active}` },
          { icon: "💰", label: "在管合同", value: `¥${fmtMoney(budgetSum)}`, hint: `已确认增项 +¥${fmtMoney(extraSum)}` },
          { icon: "🏦", label: "已收款项", value: `¥${fmtMoney(receivedSum)}`, hint: "全部工地合计" },
          { icon: "📋", label: "待业主处理", value: `${pendingTotal}`, hint: "增项确认单", warn: pendingTotal > 0 },
        ]
      : role === "foreman"
        ? [
            { icon: "🏗️", label: "我的工地", value: `${list.length}`, hint: "工长=李工长" },
            { icon: "🧱", label: "进行中工序", value: `${activeSteps}`, hint: "推进后业主实时可见" },
            { icon: "✅", label: "待业主验收", value: `${pendingAccs}`, hint: "业主端打卡清单" },
            { icon: "💬", label: "业主留言", value: "留言板", hint: "工地详情内回复" },
          ]
        : [
            { icon: "🏗️", label: "在建工地", value: `${list.length}`, hint: `进行中 ${active}` },
            { icon: "🧱", label: "进行中工序", value: `${activeSteps}`, hint: "需巡回检查" },
            { icon: "✅", label: "待验收项", value: `${pendingAccs}`, hint: "催业主打卡" },
            { icon: "📝", label: "质检日志", value: "工地日志", hint: "详情内发布" },
          ];

  const pageTitle = role === "foreman" ? "我的工地" : role === "supervisor" ? "在建工地 · 质检总览" : "工地总览";
  const pageDesc =
    role === "boss"
      ? "装修公司从这里创建工地、跟进工序与增项；业主扫码即看进度、线上签字。"
      : role === "foreman"
        ? "只看到自己负责的工地；推进工序、发日志、回复业主留言，业主端实时同步。"
        : "监理视角：关注验收清单完成情况与质检记录，可维护验收项、发布质检日志。";

  return (
    <BShell active="/">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">{pageTitle}</h1>
          <p className="mt-1 text-sm text-zinc-500">{pageDesc}</p>
        </div>

        {/* 老板行动条（今日优先处理） */}
        {role === "boss" && (
          <div className="card mb-6 border-l-4 border-l-indigo-500 px-5 py-4">
            <div className="text-sm font-medium">早上好 👋</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
              {delayedSites.length === 0 && pendingTotal === 0 && overduePays === 0 ? (
                <span className="text-emerald-600">所有工地按计划推进，无待处理事项 ✓</span>
              ) : (
                <>
                  <span className="text-zinc-600">今日优先处理：</span>
                  {delayedSites.length > 0 && (
                    <Link href={`/gongdi/${delayedSites[0].site.id}`} className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-600 ring-1 ring-red-200 hover:bg-red-100">
                      {delayedSites.length} 个工地工序超期
                    </Link>
                  )}
                  {pendingTotal > 0 && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-600 ring-1 ring-amber-200">{pendingTotal} 笔增项待业主确认</span>
                  )}
                  {overduePays > 0 && (
                    <Link href="/caiwu" className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-600 ring-1 ring-red-200 hover:bg-red-100">
                      {overduePays} 笔收款已逾期
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* 工长/监理行动条 */}
        {role !== "boss" && (
          <div className="card mb-6 border-l-4 border-l-indigo-500 px-5 py-4">
            <div className="text-sm font-medium">{role === "supervisor" ? "今日跟进 👀" : "今日待办 🧰"}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
              {role === "foreman" ? (
                <>
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-600 ring-1 ring-indigo-200">{activeSteps} 道工序进行中</span>
                  {matPending > 0 && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-600 ring-1 ring-amber-200">{matPending} 项材料待进场</span>
                  )}
                  {unreadMsgs > 0 && list[0] && (
                    <Link href={`/gongdi/${list[0].site.id}`} className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-600 ring-1 ring-amber-200 hover:bg-amber-100">
                      {unreadMsgs} 条业主留言待回复
                    </Link>
                  )}
                  {activeSteps === 0 && matPending === 0 && unreadMsgs === 0 && (
                    <span className="text-emerald-600">暂无待办，进入工地推进工序或发布日志 ✓</span>
                  )}
                </>
              ) : (
                <>
                  <Link href="/zhijian" className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-600 ring-1 ring-amber-200 hover:bg-amber-100">
                    {pendingAccs} 项待业主验收
                  </Link>
                  {delayedSites.length > 0 && (
                    <Link href={`/gongdi/${delayedSites[0].site.id}`} className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-600 ring-1 ring-red-200 hover:bg-red-100">
                      {delayedSites.length} 个工地工序超期
                    </Link>
                  )}
                  {pendingAccs === 0 && delayedSites.length === 0 && (
                    <span className="text-emerald-600">无待跟进事项 ✓</span>
                  )}
                </>
              )}
            </div>
          </div>
        )}

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

        <div className={`grid gap-6 ${role === "boss" ? "lg:grid-cols-[1fr_360px]" : "lg:grid-cols-[1fr_320px]"}`}>
          <section className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((flt) => {
                const n = flt.key === "all" ? withStatus.length : withStatus.filter((x) => x.st === flt.label).length;
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
                <div className="text-xs text-zinc-400">
                  {role === "foreman" ? "新建工地时把「工长」写为 李工长，就会出现在你的视角里" : "切回「全部」或创建一个新工地"}
                </div>
              </div>
            )}

            {filtered.map(({ site, done, total, pendingChanges, extraAmount, receivedAmount, delayDays }) => {
              const pct = (done / total) * 100;
              const payPct = site.budget > 0 ? Math.min(100, Math.round((receivedAmount / site.budget) * 100)) : 0;
              return (
                <Link key={site.id} href={`/gongdi/${site.id}`} className="card relative block p-5 transition hover:border-indigo-300 hover:shadow-md">
                  {delayDays > 0 && <i className="absolute bottom-4 left-0 top-4 w-1 rounded-r-full bg-red-400" />}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-semibold">{site.name}</span>
                        {delayDays > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600 ring-1 ring-red-200">
                            ⚠ 已延期 {delayDays} 天
                          </span>
                        )}
                        {pendingChanges > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600 ring-1 ring-amber-200">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" /> {pendingChanges} 笔增项待确认
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">{site.community} · {site.layout}</div>
                    </div>
                    {/* 迷你进度环：色随状态，中心为百分比 */}
                    <div className="relative shrink-0">
                      <Donut pct={pct} size={48} stroke={6} tone={done === total ? "emerald" : done > 0 ? "indigo" : "amber"} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[11px] font-bold tabular-nums text-zinc-700">{Math.round(pct)}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Progress value={pct} thin />
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-400">
                      <span className={done === total ? "font-semibold text-emerald-600" : done > 0 ? "font-medium text-indigo-600" : ""}>
                        {done === total ? "已竣工" : done > 0 ? "施工中" : "筹备中"} · 工序 {done}/{total}
                      </span>
                      <span className="font-semibold text-zinc-600">{Math.round(pct)}%</span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                    <span>业主 <b className="font-medium text-zinc-700">{site.owner_name}</b></span>
                    <span>工长 <b className="font-medium text-zinc-700">{site.foreman}</b></span>
                    <span>¥{fmtMoney(site.budget)}{extraAmount > 0 && <span className="text-emerald-600"> +¥{fmtMoney(extraAmount)}</span>}</span>
                    {role === "boss" && <span className="text-emerald-600">已收 {payPct}%</span>}
                    <span className="ml-auto text-zinc-400">{fmtTime(site.created_at)}</span>
                  </div>
                </Link>
              );
            })}
          </section>

          <aside className="space-y-4">
            {role === "boss" && (
              <form action={createSiteAction} className="card p-5">
                <div className="mb-4 text-sm font-semibold">➕ 新建工地</div>
                <div className="space-y-3">
                  <div>
                    <label className="label">工地模板</label>
                    <select name="template" className="input">
                      {SITE_TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                    <p className="mt-1 text-[10px] text-zinc-400">
                      {SITE_TEMPLATES.map((t) => `${t.label}：${t.desc}`).join("；")}
                    </p>
                  </div>
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
                  按所选模板自动生成标准工序（含工期）、逐项验收清单、30/35/35 付款计划（含到期日）与业主邀请二维码。
                </p>
              </form>
            )}

            {role === "foreman" && (
              <div className="card p-5">
                <div className="mb-2 text-sm font-semibold">🧰 工长工作台</div>
                <p className="text-xs leading-relaxed text-zinc-500">
                  进入工地后可以：推进工序状态、登记材料进场、发布带图日志、回复业主留言。
                  <br />
                  财务收款由公司统一管理，此视角不展示。
                </p>
              </div>
            )}

            {role === "supervisor" && (
              <div className="card p-5">
                <div className="mb-2 text-sm font-semibold">🔍 质检工作台</div>
                <p className="text-xs leading-relaxed text-zinc-500">各工地待验收项与质检记录已汇总到「质检验收」页。</p>
                <Link href="/zhijian" className="btn btn-primary mt-3 w-full text-xs">进入质检验收 →</Link>
              </div>
            )}

            <div className="card p-5">
              <div className="mb-2 text-sm font-semibold">📱 业主端（C端）</div>
              <p className="text-xs leading-relaxed text-zinc-500">业主端是手机页面，扫码或直接打开：</p>
              <div className="mt-2 flex flex-col gap-1.5 text-xs">
                {list.map(({ site }) => (
                  <Link key={site.code} href={`/c/${site.code}`} className="font-mono text-indigo-600 hover:underline">/c/{site.code}（{site.name}）</Link>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-zinc-400">浏览器打开后按 F12 切手机视图，效果最佳。</p>
            </div>

            <div className="card p-5">
              <div className="mb-3 text-sm font-semibold">🕐 最近动态</div>
              <div className="relative space-y-3 before:absolute before:bottom-1 before:left-[5px] before:top-1 before:w-px before:bg-zinc-100">
                {events.length === 0 && <p className="text-xs text-zinc-400">还没有动态。</p>}
                {events.map((e, i) => {
                  const text =
                    e.type === "log" ? `${e.author} 发布日志`
                    : e.type === "accept" ? `${e.author} 验收通过`
                    : e.type === "pay" ? `收到款项`
                    : `${e.author} 留言`;
                  const dot =
                    e.type === "log" ? "bg-indigo-300"
                    : e.type === "accept" ? "bg-emerald-400"
                    : e.type === "pay" ? "bg-emerald-500"
                    : "bg-amber-300";
                  return (
                    <div key={i} className="relative pl-5">
                      <span className={`absolute left-0 top-[3px] h-[11px] w-[11px] rounded-full border-2 border-white ${dot}`} />
                      <div className="truncate text-xs text-zinc-700">{text}：{e.text || e.extra}</div>
                      <div className="mt-0.5 flex items-center justify-between text-[10px] text-zinc-400">
                        <Link href={`/c/${e.code}`} className="font-mono hover:text-indigo-600 hover:underline">{e.site}</Link>
                        <span>{fmtTime(e.at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </BShell>
  );
}
