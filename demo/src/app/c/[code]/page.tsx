import { notFound } from "next/navigation";
import { getAccepts, getChanges, getLogs, getMaterials, getMessages, getPayments, getSiteByCode, getSteps, getWarranties, warrantyDaysLeft } from "@/lib/data";
import { confirmAcceptAction, decideChangeAction, sendOwnerMessageAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ZoomImg } from "@/components/ZoomImg";
import { Progress, StatusBadge, daysBetween, fmtMoney, fmtTime } from "@/components/ui";

export default async function ClientPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
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
    <div className="mx-auto max-w-md px-4 pb-28 pt-6">
      <div className="mb-5">
        <div className="text-xs font-medium text-amber-600">{site.community}</div>
        <h1 className="mt-0.5 text-xl font-bold">{site.name}</h1>
        <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-zinc-500">
          <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-zinc-200">{site.layout}</span>
          <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-zinc-200">工长 {site.foreman}</span>
          <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-zinc-200">演示装饰</span>
        </div>
      </div>

      {(pendingChanges.length > 0 || accepts.some((a) => !a.done)) && (
        <div className="mb-5 flex items-center gap-2.5 rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
          <span className="text-base">🔔</span>
          <div className="text-xs leading-relaxed text-amber-800">
            待你处理：
            {pendingChanges.length > 0 && <a href="#changes" className="font-semibold underline underline-offset-2">{pendingChanges.length} 笔增项确认</a>}
            {pendingChanges.length > 0 && accepts.some((a) => !a.done) && " · "}
            {accepts.some((a) => !a.done) && <a href="#accept" className="font-semibold underline underline-offset-2">{accepts.filter((a) => !a.done).length} 项验收打卡</a>}
          </div>
        </div>
      )}

      {/* 总进度 */}
      <div className="card mb-5 p-5">
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
        <div className="mt-3">
          <Progress value={pct} tone="amber" />
        </div>
        <div className="mt-3 flex justify-between text-[11px] text-zinc-400">
          {steps.map((s) => (
            <span key={s.id} className={s.status === "已完成" ? "font-semibold text-emerald-600" : s.status === "进行中" ? "font-semibold text-amber-600" : ""}>
              {s.name.replace("改造", "").replace("铺贴", "").replace("制作", "").replace("涂装", "").replace("收尾", "").replace("验收", "竣")}
            </span>
          ))}
        </div>
      </div>

      {/* 付款进度 */}
      <div className="card mb-5 p-5">
        <div className="mb-1 flex items-baseline justify-between">
          <div className="text-sm font-semibold">💰 付款进度</div>
          <div className="text-[11px] text-zinc-400">已收 ¥{fmtMoney(receivedSum)} / 合同 ¥{fmtMoney(site.budget)}</div>
        </div>
        <div className="mt-2">
          <Progress value={site.budget > 0 ? (receivedSum / site.budget) * 100 : 0} tone="emerald" />
        </div>
        <div className="mt-3 space-y-1.5">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-xs">
              <span className="text-zinc-600">{p.title}</span>
              <span className="flex items-center gap-2">
                <span className="font-mono font-semibold text-zinc-700">¥{fmtMoney(p.amount)}</span>
                {p.status === "已收款" ? (
                  <span className="text-[11px] text-emerald-600">{fmtTime(p.paid_at)} 已收</span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600 ring-1 ring-amber-200">待收款</span>
                )}
              </span>
            </div>
          ))}
        </div>
        {confirmedExtra > 0 && (
          <p className="mt-2.5 border-t border-zinc-100 pt-2 text-[11px] leading-relaxed text-zinc-400">
            合同 ¥{fmtMoney(site.budget)} + 已确认增项 ¥{fmtMoney(confirmedExtra)} = 应付合计 <b className="text-zinc-600">¥{fmtMoney(totalDue)}</b>
          </p>
        )}
      </div>

      {/* 预算执行 */}
      <div className="card mb-5 p-5">
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
        <div id="changes" className="card mb-5 scroll-mt-4 p-5">
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
        <div className="card mb-5 p-5">
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

      {/* 验收打卡 */}
      <div id="accept" className="card mb-5 scroll-mt-4 p-5">
        <div className="mb-1 flex items-baseline justify-between">
          <div className="text-sm font-semibold">📋 验收打卡</div>
          <div className="text-[11px] text-zinc-400">已确认 {accDone}/{accepts.length}</div>
        </div>
        <p className="mb-3 text-[11px] text-zinc-400">逐项对照检查，确认合格后拍照签字，双方实时同步。</p>
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.name}>
              <div className="mb-1.5 text-[11px] font-semibold text-zinc-400">· {g.name}</div>
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

      {/* 留言板 */}
      <div className="card mb-5 p-5">
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
        <div className="card mb-5 p-5">
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

      {/* 工地动态 */}
      <div className="card p-5">
        <div className="mb-3 text-sm font-semibold">💬 工地动态</div>
        <div className="space-y-3">
          {logs.map((l) => (
            <div key={l.id} className="overflow-hidden rounded-xl bg-zinc-50">
              <div className="px-3.5 pt-3">
                <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                  <span className="rounded-md bg-white px-1.5 py-0.5 font-medium text-zinc-600 ring-1 ring-zinc-200">{l.author}</span>
                  {l.step_name && <span>{l.step_name}</span>}
                  <span className="ml-auto">{fmtTime(l.created_at)}</span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed">{l.content}</p>
              </div>
              {l.photo && (
                <div className="px-3.5 pb-3 pt-2.5">
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

      <div className="mt-6 text-center text-[10px] text-zinc-300">装修管理平台 Demo · 业主端 {site.code}</div>

      {/* 底部联系栏 */}
      <div className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-600">
            {(site.foreman ?? "工").slice(0, 1)}
          </div>
          <div className="min-w-0 text-xs">
            <div className="font-semibold text-zinc-700">{site.foreman} · 正在负责你的工地</div>
            <div className="text-[10px] text-zinc-400">施工问题随时沟通，消息双方可见</div>
          </div>
          <a href="tel:13800000000" className="btn btn-primary ml-auto shrink-0 px-4 py-2 text-xs">📞 联系工长</a>
        </div>
      </div>
    </div>
  );
}
