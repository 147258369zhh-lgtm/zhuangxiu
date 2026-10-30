import { notFound } from "next/navigation";
import { getAccepts, getChanges, getLogs, getMaterials, getMessages, getPayments, getSiteByCode, getSitePhotos, getSteps, getTasks, getWarranties, warrantyDaysLeft } from "@/lib/data";
import { confirmAcceptAction, decideChangeAction, sendOwnerMessageAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ZoomImg } from "@/components/ZoomImg";
import { MiniShell } from "@/components/MiniShell";
import { Progress, StatusBadge, DueBadge, daysBetween, fmtDate, fmtMoney, fmtTime } from "@/components/ui";

const C_TABS = ["progress", "photos", "accept", "chat"] as const;

export default async function ClientPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { code } = await params;
  const { tab: rawTab = "progress" } = await searchParams;
  const tab = (C_TABS as readonly string[]).includes(rawTab) ? rawTab : "progress";
  const site = getSiteByCode(code);
  if (!site) notFound();
  const steps = getSteps(site.id);
  const logs = getLogs(site.id);
  const accepts = getAccepts(site.id);
  const changes = getChanges(site.id);
  const payments = getPayments(site.id);
  const materials = getMaterials(site.id);
  const warranties = getWarranties(site.id);
  const messages = getMessages(site.id);
  const sitePhotos = getSitePhotos(site.id);
  const liveTasks = getTasks(site.id).filter((x) => x.live === 1);

  const stepDone = steps.filter((s) => s.status === "已完成").length;
  const pct = steps.length ? (stepDone / steps.length) * 100 : 0;
  const current = steps.find((s) => s.status === "进行中");
  const accDone = accepts.filter((a) => a.done).length;
  const pendingChanges = changes.filter((c) => c.status === "待确认");
  const decidedChanges = changes.filter((c) => c.status !== "待确认");
  const confirmedExtra = changes.filter((c) => c.status === "已确认").reduce((s, c) => s + c.amount, 0);
  const plannedSum = steps.reduce((s, st) => s + st.planned, 0);
  const actualSum = steps.reduce((s, st) => s + st.actual, 0);
  const receivedSum = payments.filter((p) => p.status === "已收款").reduce((s, p) => s + p.amount, 0);
  const totalDue = site.budget + confirmedExtra;
  const matDone = materials.filter((m) => m.status === "已进场").length;
  const currentElapsed = current ? daysBetween(current.started_at) : 0;

  const groups = [...new Set(accepts.map((a) => a.step_name))].map((name) => ({
    name,
    items: accepts.filter((a) => a.step_name === name),
  }));

  return (
    <MiniShell
      title="我的家"
      active={tab}
      tabs={[
        { key: "progress", href: `/c/${code}?tab=progress`, label: "进度", icon: "📊", badge: pendingChanges.length },
        { key: "photos", href: `/c/${code}?tab=photos`, label: "照片", icon: "📷" },
        { key: "accept", href: `/c/${code}?tab=accept`, label: "验收", icon: "✅", badge: accepts.filter((a) => !a.done).length },
        { key: "chat", href: `/c/${code}?tab=chat`, label: "沟通", icon: "💬" },
      ]}
    >
      <div>
      <div className="mb-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-4 text-white shadow-sm">
        <div className="text-[11px] font-medium text-indigo-100">{site.community}</div>
        <h1 className="mt-0.5 text-xl font-bold">{site.name}</h1>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
          <span className="rounded-full bg-white/15 px-2.5 py-1 ring-1 ring-inset ring-white/25">{site.layout}</span>
          <span className="rounded-full bg-white/15 px-2.5 py-1 ring-1 ring-inset ring-white/25">工长 {site.foreman}</span>
          <span className="rounded-full bg-white/15 px-2.5 py-1 ring-1 ring-inset ring-white/25">演示装饰</span>
        </div>
        {liveTasks.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-500/25 px-2.5 py-1.5 ring-1 ring-inset ring-red-200/40">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-300" />
            <span className="text-[10px] font-semibold">{liveTasks[0].worker} 正在直播「{liveTasks[0].title}」· 点击小程序围观</span>
          </div>
        )}
      </div>

      {/* ========== 进度 tab ========== */}
      {tab === "progress" && (
        <>
      {(pendingChanges.length > 0 || accepts.some((a) => !a.done)) && (
        <div className="mb-4 flex items-center gap-2.5 rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
          <span className="text-base">🔔</span>
          <div className="text-xs leading-relaxed text-amber-800">
            待你处理：
            {pendingChanges.length > 0 && <a href={`/c/${code}?tab=progress`} className="font-semibold underline underline-offset-2">{pendingChanges.length} 笔增项确认</a>}
            {pendingChanges.length > 0 && accepts.some((a) => !a.done) && " · "}
            {accepts.some((a) => !a.done) && <a href={`/c/${code}?tab=accept`} className="font-semibold underline underline-offset-2">{accepts.filter((a) => !a.done).length} 项验收打卡</a>}
          </div>
        </div>
      )}

      {/* 总进度 */}
      <div className="card mb-4 p-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs text-zinc-500">装修总进度</div>
            <div className="mt-0.5 text-3xl font-bold tabular-nums">{Math.round(pct)}<span className="text-base text-zinc-400">%</span></div>
          </div>
          <div className="text-right text-[11px] text-zinc-400">
            <div>当前工序</div>
            <div className="mt-0.5 text-sm font-semibold text-amber-600">{current ? current.name : pct >= 100 ? "已竣工 🎉" : "即将开工"}</div>
            {current && current.planned_days > 0 && (
              <div className={currentElapsed > current.planned_days ? "mt-0.5 text-[10px] font-semibold text-red-500" : "mt-0.5 text-[10px]"}>
                已进行 {currentElapsed} 天 · 预计还需 {Math.max(0, current.planned_days - currentElapsed)} 天
              </div>
            )}
          </div>
        </div>
        {/* 工序 stepper：圆点+连线，当前工序脉冲 */}
        <div className="relative mt-4 h-11">
          <div className="absolute left-[calc(100%/12)] right-[calc(100%/12)] top-[9px] h-[3px] rounded-full bg-zinc-100" />
          <div
            className="absolute left-[calc(100%/12)] top-[9px] h-[3px] rounded-full bg-emerald-400"
            style={{ width: `calc((100% - 16.6667%) * ${steps.length > 1 ? stepDone / (steps.length - 1) : 0})` }}
          />
          <div className="relative flex h-full">
            {steps.map((s, i) => {
              const done = s.status === "已完成";
              const active = s.status === "进行中";
              return (
                <div key={s.id} className="flex flex-1 flex-col items-center">
                  <span className={`flex h-[21px] w-[21px] items-center justify-center rounded-full text-[10px] font-bold ring-2 transition-all ${
                    done ? "bg-emerald-400 text-white ring-emerald-100"
                    : active ? "bg-amber-400 text-white ring-amber-100"
                    : "bg-white text-zinc-300 ring-zinc-100"
                  } ${active ? "animate-pulse" : ""}`}>
                    {done ? "✓" : i + 1}
                  </span>
                  <span className={`mt-1 text-[9px] leading-none ${active ? "font-semibold text-amber-600" : done ? "text-emerald-600" : "text-zinc-400"}`}>
                    {s.name.replace("改造", "").replace("铺贴", "").replace("制作", "").replace("涂装", "").replace("收尾", "").replace("验收", "竣")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 付款进度 */}
      <div className="card mb-4 p-4">
        <div className="mb-1 flex items-baseline justify-between">
          <div className="text-sm font-semibold">💰 付款进度</div>
          <div className="text-[11px] text-zinc-400">已收 ¥{fmtMoney(receivedSum)} / 合同 ¥{fmtMoney(site.budget)}</div>
        </div>
        <div className="mt-2">
          <Progress value={site.budget > 0 ? (receivedSum / site.budget) * 100 : 0} tone="emerald" />
        </div>
        <div className="mt-2.5 divide-y divide-zinc-50">
          {payments.map((p) => {
            const isOverdue = p.status === "待收款" && p.due_date && new Date(p.due_date).getTime() < Date.now();
            return (
              <div key={p.id} className="flex items-center gap-3 py-2">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs ${
                  p.status === "已收款" ? "bg-emerald-100 text-emerald-600" : isOverdue ? "bg-red-100 text-red-500" : "bg-amber-100 text-amber-600"
                }`}>
                  {p.status === "已收款" ? "✓" : isOverdue ? "!" : "⏰"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-zinc-700">{p.title}</div>
                  <div className="text-[10px] text-zinc-400">
                    {p.status === "已收款" ? `${fmtTime(p.paid_at)} 已收款` : p.due_date ? `应于 ${fmtDate(p.due_date)} 前缴纳` : "待收款"}
                  </div>
                </div>
                <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-zinc-700">¥{fmtMoney(p.amount)}</span>
                <DueBadge due={p.due_date} status={p.status} />
              </div>
            );
          })}
        </div>
        {confirmedExtra > 0 && (
          <p className="mt-2.5 border-t border-zinc-100 pt-2 text-[11px] leading-relaxed text-zinc-400">
            合同 ¥{fmtMoney(site.budget)} + 已确认增项 ¥{fmtMoney(confirmedExtra)} = 应付合计 <b className="text-zinc-600">¥{fmtMoney(totalDue)}</b>
          </p>
        )}
      </div>

      {/* 预算执行 */}
      <div className="card mb-4 p-4">
        <div className="mb-1 flex items-baseline justify-between">
          <div className="text-sm font-semibold">📊 预算执行</div>
          <div className="text-[11px] text-zinc-400">计划 ¥{fmtMoney(plannedSum)} · 实际 ¥{fmtMoney(actualSum)}</div>
        </div>
        <div className="mt-2 space-y-2.5">
          {steps.filter((s) => s.planned > 0).map((st) => {
            const ratio = st.planned > 0 ? (st.actual / st.planned) * 100 : 0;
            const over = st.actual > st.planned;
            return (
              <div key={st.id}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500">{st.name}</span>
                  <span className={over ? "font-semibold text-red-500" : "font-mono text-zinc-400"}>
                    ¥{fmtMoney(st.actual)} / ¥{fmtMoney(st.planned)}{over ? " 超支" : ""}
                  </span>
                </div>
                <div className="mt-1">
                  <Progress value={ratio} tone={over ? "red" : "amber"} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 增项确认 */}
      {changes.length > 0 && (
        <div id="changes" className="card mb-4 scroll-mt-4 p-4">
          <div className="mb-1 text-sm font-semibold">📋 增项确认</div>
          <p className="mb-3 text-[11px] text-zinc-400">任何加钱的项目都会先推送给你，确认后才执行——线上签字，避免扯皮。</p>
          <div className="space-y-3">
            {pendingChanges.map((c) => (
              <form key={c.id} action={decideChangeAction} className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3.5">
                <input type="hidden" name="changeId" value={c.id} />
                <input type="hidden" name="code" value={site.code} />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{c.title}</span>
                  <span className="font-mono text-base font-bold text-amber-600">+¥{fmtMoney(c.amount)}</span>
                </div>
                {c.reason && <div className="mt-1 text-[11px] text-zinc-500">{c.reason}</div>}
                <input name="comment" className="input mt-2.5 px-2.5 py-1.5 text-xs" placeholder="备注（选填），如：同意，麻烦尽快" />
                <div className="mt-2.5 flex gap-2">
                  <SubmitButton name="decision" value="已确认" className="btn btn-amber flex-1 py-1.5 text-xs" pending="提交中…">同意增项，签字</SubmitButton>
                  <SubmitButton name="decision" value="已拒绝" className="btn btn-ghost flex-1 py-1.5 text-xs text-red-500" pending="提交中…">拒绝</SubmitButton>
                </div>
              </form>
            ))}
            {decidedChanges.map((c) => (
              <div key={c.id} className={`rounded-xl border px-4 py-3 ${c.status === "已确认" ? "border-emerald-100 bg-emerald-50/50" : "border-zinc-200 bg-zinc-50"}`}>
                <div className="flex items-center gap-2.5">
                  <span className={`text-sm ${c.status === "已拒绝" ? "text-zinc-400 line-through" : "text-zinc-700"}`}>{c.title}</span>
                  <StatusBadge status={c.status} />
                  <span className={`ml-auto font-mono text-sm ${c.status === "已拒绝" ? "text-zinc-300" : "text-zinc-700"}`}>+¥{fmtMoney(c.amount)}</span>
                </div>
                {c.decided_comment && <div className="mt-1 text-[11px] text-zinc-500">"{c.decided_comment}" — {c.decided_by} {fmtTime(c.decided_at)}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 材料进场 */}
      {materials.length > 0 && (
        <div className="card mb-4 p-4">
          <div className="mb-1 flex items-baseline justify-between">
            <div className="text-sm font-semibold">📦 材料进场</div>
            <div className="text-[11px] text-zinc-400">已进场 {matDone}/{materials.length}</div>
          </div>
          <p className="mb-3 text-[11px] text-zinc-400">主要材料进场后可核对品牌与规格，与合同不符可当场拒收。</p>
          <div className="space-y-1.5">
            {materials.map((m) => (
              <div key={m.id} className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg px-3 py-2 text-xs ${m.status === "已进场" ? "bg-emerald-50/60" : "bg-zinc-50"}`}>
                <span className={m.status === "已进场" ? "text-emerald-500" : "text-zinc-300"}>{m.status === "已进场" ? "✓" : "○"}</span>
                <span className={m.status === "已进场" ? "font-medium text-zinc-700" : "text-zinc-500"}>{m.name}</span>
                {m.spec && <span className="text-[10px] text-zinc-400">{m.spec}</span>}
                {m.qty && <span className="text-[10px] text-zinc-300">· {m.qty}</span>}
                <span className="ml-auto text-[10px] text-zinc-400">{m.status === "已进场" ? `${fmtTime(m.arrived_at)} 进场` : "未到货"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
        </>
      )}

      {/* ========== 照片 tab（工人三类拍照，完整归档） ========== */}
      {tab === "photos" && (
        <div>
          {sitePhotos.length === 0 ? (
            <div className="card p-8 text-center text-xs text-zinc-400">
              工人还没有上传照片，施工开始后会实时同步到这里。
            </div>
          ) : (
            [
              { key: "before", label: "施工前", icon: "📷", desc: "原始现场 / 原线路" },
              { key: "material", label: "材料核对", icon: "📦", desc: "品牌型号留档" },
              { key: "after", label: "施工后", icon: "✨", desc: "安装完成效果" },
            ].map((c) => {
              const list = sitePhotos.filter((p) => p.category === c.key);
              return (
                <div key={c.key} className="card mb-4 p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-semibold">{c.icon} {c.label}</span>
                    <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 font-mono text-[9px] text-zinc-400">{list.length}</span>
                    <span className="ml-auto text-[10px] text-zinc-400">{c.desc}</span>
                  </div>
                  {list.length === 0 ? (
                    <p className="py-3 text-[11px] text-zinc-300">暂无</p>
                  ) : (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {list.map((p) => (
                        <div key={p.id} className="overflow-hidden rounded-xl ring-1 ring-zinc-100">
                          <ZoomImg src={p.url} alt={p.task_title} className="h-28 w-full object-cover" />
                          <div className="bg-white px-2 py-1">
                            <div className="truncate text-[9px] text-zinc-500">{p.task_title}</div>
                            <div className="text-[8px] text-zinc-300">{p.point_name ?? `${p.room} · ${p.worker}`}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <p className="pb-2 text-center text-[10px] leading-relaxed text-zinc-300">
            照片由工人现场拍摄并自动归档，三类齐全即代表该任务可按流程验收。
          </p>
        </div>
      )}

      {/* ========== 验收 tab ========== */}
      {tab === "accept" && (
        <>
      {/* 验收打卡 */}
      <div id="accept" className="card mb-4 scroll-mt-4 p-4">
        <div className="mb-1 flex items-baseline justify-between">
          <div className="text-sm font-semibold">📋 验收打卡</div>
          <div className="text-[11px] text-zinc-400">已确认 {accDone}/{accepts.length}</div>
        </div>
        <p className="mb-3 text-[11px] text-zinc-400">逐项对照检查，确认合格后拍照签字，双方实时同步。</p>
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.name}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[11px] font-semibold text-zinc-500">{g.name}</span>
                <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 font-mono text-[9px] text-zinc-400">
                  {g.items.filter((i) => i.done).length}/{g.items.length}
                </span>
                <span className="h-px flex-1 bg-zinc-100" />
              </div>
              <div className="space-y-2">
                {g.items.map((it) =>
                  it.done ? (
                    <div key={it.id} className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-3.5 py-2.5">
                      <div className="flex items-center gap-1.5 text-sm">
                        <span className="text-emerald-500">✓</span>
                        <span className="text-zinc-700">{it.item}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-zinc-400">
                        <span className="font-medium text-emerald-600">{it.checked_by} 已签字</span>
                        <span>{fmtTime(it.checked_at)}</span>
                      </div>
                      {it.comment && <div className="mt-1 text-xs text-zinc-500">"{it.comment}"</div>}
                      {it.photo && (
                        <div className="mt-2">
                          <ZoomImg
                            src={it.photo.startsWith("data:") ? it.photo : `/uploads/${it.photo}`}
                            alt="验收照片"
                            className="h-36 w-full rounded-lg object-cover"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <form key={it.id} action={confirmAcceptAction} className="rounded-xl border border-zinc-200 px-3.5 py-2.5">
                      <input type="hidden" name="acceptId" value={it.id} />
                      <input type="hidden" name="code" value={site.code} />
                      <div className="text-sm text-zinc-700">{it.item}</div>
                      <div className="mt-2 flex gap-2">
                        <input name="comment" className="input flex-1 px-2.5 py-1.5 text-xs" placeholder="备注（选填）" />
                        <input name="photo" type="file" accept="image/*" className="w-28 text-[10px] file:mr-1 file:rounded-md file:border-0 file:bg-zinc-100 file:px-2 file:py-0.5 file:text-[10px]" />
                      </div>
                      <SubmitButton className="btn btn-amber mt-2 w-full py-1.5 text-xs" pending="提交中…">确认合格，签字留档</SubmitButton>
                    </form>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
        </>
      )}

      {/* ========== 沟通 tab ========== */}
      {tab === "chat" && (
        <>
      {/* 工长联系卡（原固定底栏改入沟通 tab） */}
      <div className="card mb-4 flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-600">
          {(site.foreman ?? "工").slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1 text-xs">
          <div className="font-semibold text-zinc-700">{site.foreman} · 正在负责你的工地</div>
          <div className="text-[10px] text-zinc-400">施工问题随时沟通，消息双方可见</div>
        </div>
        <a href="tel:13800000000" className="btn btn-primary shrink-0 px-3.5 py-2 text-xs">📞 联系</a>
      </div>

      {/* 留言板 */}
      <div className="card mb-4 p-4">
        <div className="mb-1 text-sm font-semibold">💬 留言板</div>
        <p className="mb-3 text-[11px] text-zinc-400">和{site.foreman}直接沟通，双方可见、全程留痕。</p>
        <div className="space-y-2.5">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender === "业主" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[85%]">
                <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${m.sender === "业主" ? "rounded-br-md bg-indigo-600 text-white" : "rounded-bl-md bg-zinc-100 text-zinc-800"}`}>
                  {m.content}
                </div>
                <div className={`mt-0.5 text-[10px] text-zinc-400 ${m.sender === "业主" ? "text-right" : ""}`}>
                  {m.author} · {fmtTime(m.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
        <form action={sendOwnerMessageAction} className="mt-3 flex gap-2 border-t border-zinc-100 pt-3">
          <input type="hidden" name="code" value={site.code} />
          <input name="content" className="input min-w-0 flex-1 px-3 py-2 text-sm" placeholder={`给${site.foreman}留言…`} />
          <SubmitButton className="btn btn-primary shrink-0 px-4 py-2 text-sm" pending="…">发送</SubmitButton>
        </form>
      </div>

      {/* 保修权益 */}
      {warranties.length > 0 && (
        <div className="card mb-4 p-4">
          <div className="mb-1 text-sm font-semibold">🛡️ 保修权益</div>
          <p className="mb-3 text-[11px] text-zinc-400">竣工验收后自动起保；保修期内出现质量问题，在留言板报修即可，公司按《住宅装饰装修保修单》约定响应。</p>
          <div className="space-y-2">
            {warranties.map((w) => {
              const left = warrantyDaysLeft(w);
              const expired = left < 0;
              return (
                <div key={w.id} className="flex items-center gap-2.5 rounded-xl bg-zinc-50 px-3.5 py-2.5">
                  <span className="text-xs font-medium text-zinc-700">{w.item}</span>
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                    expired ? "bg-zinc-100 text-zinc-400 ring-zinc-200" : left <= 90 ? "bg-amber-50 text-amber-600 ring-amber-200" : "bg-emerald-50 text-emerald-600 ring-emerald-200"
                  }`}>
                    {expired ? "已过保" : `保修余 ${left} 天`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 工地动态（时间线） */}
      <div className="card p-4">
        <div className="mb-3 text-sm font-semibold">💬 工地动态</div>
        <div className="relative space-y-3 before:absolute before:bottom-2 before:left-[6px] before:top-2 before:w-px before:bg-zinc-100">
          {logs.map((l, idx) => (
            <div key={l.id} className="relative pl-6">
              <span className={`absolute left-[2px] top-[13px] h-[9px] w-[9px] rounded-full ring-2 ring-white ${idx === 0 ? "bg-amber-400" : "bg-emerald-300"}`} />
              <div className="rounded-xl bg-zinc-50 px-3.5 py-2.5">
                <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                  <span className="rounded-md bg-white px-1.5 py-0.5 font-medium text-zinc-600 ring-1 ring-zinc-200">{l.author}</span>
                  {l.step_name && <span>{l.step_name}</span>}
                  <span className="ml-auto">{fmtTime(l.created_at)}</span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed">{l.content}</p>
              </div>
              {l.photo && (
                <div className="mt-2">
                  <ZoomImg
                    src={l.photo.startsWith("data:") ? l.photo : `/uploads/${l.photo}`}
                    alt="施工照片"
                    className="h-40 w-full rounded-lg object-cover"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
        </>
      )}

      <div className="mt-6 text-center text-[10px] text-zinc-300">装修管理平台 Demo · 业主端 {site.code}</div>
      </div>
    </MiniShell>
  );
}
