import Link from "next/link";
import MiniShell from "@/components/MiniShell";
import {
  getBudget, getProject, listAcceptances, listActivity, listFiles, listPayments,
  listStages, summary, yuan,
} from "@/lib/self";
import {
  mobileAcceptAction, mobileBoughtAction, mobilePaymentAction, mobilePhotoAction,
} from "@/app/m-actions";
import { SubmitButton } from "@/components/SubmitButton";

const TABS = [
  { key: "home", label: "首页", icon: "🏠" },
  { key: "list", label: "清单", icon: "📋" },
  { key: "money", label: "记账", icon: "💰" },
  { key: "accept", label: "验收", icon: "✅" },
  { key: "photo", label: "照片", icon: "📷" },
] as const;

const CATS = ["主材", "水电材料", "瓦工材料", "木工材料", "油漆材料", "卫浴厨电", "家具软装", "其他"];

export default async function MiniAppPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const raw = (await searchParams).tab ?? "home";
  const tab = (TABS as readonly { key: string }[]).some((t) => t.key === raw) ? raw : "home";

  const p = getProject();
  const s = summary(p.id);
  const stages = listStages(p.id);
  const budget = getBudget(p.id);
  const pays = listPayments(p.id);
  const accepts = listAcceptances(p.id);
  const files = listFiles(p.id);
  const acts = listActivity(p.id, 5);

  const pendingAccept = accepts.reduce(
    (n, a) => n + a.items.filter((i) => i.latest === null || i.latest === "不合格").length,
    0
  );
  const unbought = s.bom.rows.filter((r) => r.status === "未买").length;

  return (
    <MiniShell
      title="我的家 · 装修助手"
      active={tab}
      tabs={TABS.map((t) => ({
        key: t.key,
        label: t.label,
        icon: t.icon,
        href: `/m?tab=${t.key}`,
        badge:
          t.key === "accept" ? pendingAccept : t.key === "list" ? unbought : 0,
      }))}
    >
      {/* ================== 首页 ================== */}
      {tab === "home" && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-4 text-white shadow-sm">
            <div className="text-[11px] text-indigo-100">{p.property_name}</div>
            <h1 className="mt-0.5 text-lg font-bold">{p.name}</h1>
            <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
              <span className="rounded-full bg-white/15 px-2 py-0.5 ring-1 ring-inset ring-white/25">
                {p.layout}
              </span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 ring-1 ring-inset ring-white/25">
                {p.area_sqm}㎡
              </span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 ring-1 ring-inset ring-white/25">
                {s.count} 个点位
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/25">
                <div className="h-full rounded-full bg-white" style={{ width: `${s.progressPct}%` }} />
              </div>
              <span className="text-[11px] font-semibold tabular-nums">{Math.round(s.progressPct)}%</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { l: "预算", v: `¥${yuan(s.budgetTotalCents)}`, c: "text-zinc-800" },
              { l: "已花", v: `¥${yuan(s.spentCents)}`, c: "text-amber-600" },
              { l: "剩余", v: `¥${yuan(s.remainingCents)}`, c: s.remainingCents < 0 ? "text-red-600" : "text-emerald-600" },
            ].map((x) => (
              <div key={x.l} className="rounded-xl bg-white px-2.5 py-2 ring-1 ring-zinc-100">
                <div className="text-[9px] text-zinc-400">{x.l}</div>
                <div className={`mt-0.5 text-[12px] font-bold tabular-nums ${x.c}`}>{x.v}</div>
              </div>
            ))}
          </div>

          <section className="rounded-2xl bg-white p-3.5 ring-1 ring-zinc-100">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold">施工进度</span>
              {s.current && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-medium text-amber-600">
                  当前 {s.current.name}
                </span>
              )}
            </div>
            <ul className="mt-2 space-y-1.5">
              {stages.map((st) => (
                <li key={st.id} className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      st.status === "已完成"
                        ? "bg-emerald-500"
                        : st.status === "进行中"
                          ? "bg-amber-500 ring-2 ring-amber-100"
                          : "bg-zinc-200"
                    }`}
                  />
                  <span
                    className={`flex-1 text-[11px] ${
                      st.status === "已完成" ? "text-zinc-400 line-through" : "text-zinc-700"
                    }`}
                  >
                    {st.name}
                  </span>
                  <span className="text-[9px] text-zinc-400">{st.planned_days}天</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/m?tab=accept"
              className="rounded-2xl bg-white p-3 ring-1 ring-zinc-100 active:bg-zinc-50"
            >
              <div className="text-lg">✅</div>
              <div className="mt-1 text-[12px] font-semibold text-zinc-800">待验收 {pendingAccept} 项</div>
              <div className="text-[9px] text-zinc-400">现场逐项打卡</div>
            </Link>
            <Link
              href="/m?tab=list"
              className="rounded-2xl bg-white p-3 ring-1 ring-zinc-100 active:bg-zinc-50"
            >
              <div className="text-lg">📋</div>
              <div className="mt-1 text-[12px] font-semibold text-zinc-800">待买 {unbought} 项材料</div>
              <div className="text-[9px] text-zinc-400">按清单去建材市场</div>
            </Link>
          </div>

          <section className="rounded-2xl bg-white p-3.5 ring-1 ring-zinc-100">
            <div className="text-[12px] font-semibold">最近动态</div>
            <ul className="mt-2 space-y-2">
              {acts.map((a) => (
                <li key={a.id} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-300" />
                  <div className="min-w-0">
                    <div className="text-[11px] text-zinc-700">{a.text}</div>
                    <div className="text-[9px] text-zinc-400">
                      {a.source === "miniapp" ? "📱 手机" : "🖥 桌面"} · {a.created_at.slice(5, 16).replace("T", " ")}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <p className="pb-2 text-center text-[9px] leading-relaxed text-zinc-400">
            手机端只负责「看 · 拍 · 记 · 勾」<br />
            点位设计、改单价、出报表在电脑上的桌面版做
          </p>
        </div>
      )}

      {/* ================== 清单 ================== */}
      {tab === "list" && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-white p-3.5 ring-1 ring-zinc-100">
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] font-semibold">水电材料清单</span>
              <span className="text-[10px] text-zinc-400">
                共 ¥{yuan(s.bom.totalCents)}
              </span>
            </div>
            <p className="mt-0.5 text-[9px] text-zinc-400">
              由电脑端按 {s.count} 个点位算出；点「已买」会先进事件队列，电脑接收后才生效。
            </p>
          </div>

          {s.bom.rows.map((r) => (
            <div key={r.materialId} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5 ring-1 ring-zinc-100">
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium text-zinc-800">{r.name}</div>
                <div className="text-[9px] text-zinc-400">
                  {r.spec} · {r.qty}
                  {r.unit}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[11px] font-semibold tabular-nums text-zinc-700">
                  ¥{yuan(r.amountCents)}
                </div>
                <div className="text-[9px] text-zinc-400">¥{(r.unitPriceCents / 100).toFixed(2)}/{r.unit}</div>
              </div>
              {r.status === "未买" ? (
                <form action={mobileBoughtAction} className="shrink-0">
                  <input type="hidden" name="materialId" value={r.materialId} />
                  <SubmitButton
                    className="rounded-full bg-indigo-600 px-2.5 py-1 text-[10px] font-semibold text-white active:bg-indigo-700"
                    pending="…"
                  >
                    已买
                  </SubmitButton>
                </form>
              ) : (
                <span
                  className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${
                    r.status === "已到货" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                  }`}
                >
                  {r.status}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ================== 记账 ================== */}
      {tab === "money" && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-3.5 text-white">
            <div className="text-[10px] text-indigo-100">已花 / 预算</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold tabular-nums">¥{yuan(s.spentCents)}</span>
              <span className="text-[11px] text-indigo-100">/ ¥{yuan(s.budgetTotalCents)}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-white"
                style={{ width: `${Math.min(100, (s.spentCents / Math.max(1, s.budgetTotalCents)) * 100)}%` }}
              />
            </div>
            <div className="mt-1.5 text-[10px] text-indigo-100">
              剩余 ¥{yuan(s.remainingCents)}
              {s.remainingCents < 0 && "（已超支）"}
            </div>
          </div>

          <section className="rounded-2xl bg-white p-3.5 ring-1 ring-zinc-100">
            <div className="text-[12px] font-semibold">记一笔</div>
            <form action={mobilePaymentAction} className="mt-2 space-y-2">
              <input
                name="amount"
                inputMode="decimal"
                placeholder="金额（元）"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-indigo-500"
              />
              <select
                name="category"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-indigo-500"
              >
                {CATS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <input
                name="note"
                placeholder="买了什么？"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-indigo-500"
              />
              <SubmitButton
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-[13px] font-semibold text-white active:bg-indigo-700"
                pending="保存中…"
              >
                保存（先进事件队列）
              </SubmitButton>
            </form>
          </section>

          <section className="rounded-2xl bg-white p-3.5 ring-1 ring-zinc-100">
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] font-semibold">流水</span>
              <span className="text-[9px] text-zinc-400">只追加，不改不删</span>
            </div>
            <ul className="mt-2 divide-y divide-zinc-100">
              {pays.slice(0, 12).map((x) => (
                <li key={x.id} className="flex items-center gap-2 py-2">
                  <span className="w-9 shrink-0 text-[9px] text-zinc-400">{x.occurred_at.slice(5, 10)}</span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-700">
                    {x.note ?? x.category}
                    <span className="ml-1 text-[9px] text-zinc-400">{x.category}</span>
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-zinc-700">
                    ¥{yuan(x.amount_cents)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl bg-white p-3.5 ring-1 ring-zinc-100">
            <div className="text-[12px] font-semibold">分项剩余</div>
            <ul className="mt-2 space-y-1">
              {(budget?.items ?? []).map((i) => {
                const planned = i.category === "水电材料" ? s.bom.totalCents : i.amount_cents;
                const spent = budget?.spentMap.get(i.category) ?? 0;
                const left = planned - spent;
                if (!spent && i.category !== "水电材料") return null;
                return (
                  <li key={i.id} className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-600">{i.category}</span>
                    <span className={`tabular-nums ${left < 0 ? "font-semibold text-red-600" : "text-zinc-500"}`}>
                      余 ¥{yuan(left)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}

      {/* ================== 验收 ================== */}
      {tab === "accept" && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-white p-3.5 ring-1 ring-zinc-100">
            <div className="text-[12px] font-semibold">现场验收打卡</div>
            <p className="mt-0.5 text-[9px] leading-relaxed text-zinc-400">
              逐项对照勾选。不合格会自动记为新一轮结果，上一轮的记录不会被覆盖——
              整改完再复验，两轮都查得到。
            </p>
          </div>

          {accepts.map((a) => (
            <section key={a.id} className="rounded-2xl bg-white p-3.5 ring-1 ring-zinc-100">
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] font-semibold">{a.name}</span>
                <span className="text-[9px] text-zinc-400">第 {a.round} 轮</span>
              </div>
              <ul className="mt-2 space-y-2">
                {a.items.map((it) => (
                  <li key={it.id} className="rounded-xl bg-zinc-50/70 px-2.5 py-2">
                    <div className="flex items-start gap-1.5">
                      <span className="mt-0.5 text-[9px] tabular-nums text-zinc-400">{it.sort + 1}</span>
                      <span className="min-w-0 flex-1 text-[11px] leading-snug text-zinc-700">{it.text}</span>
                      {it.latest && (
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium ${
                            it.latest === "合格"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {it.latest}
                        </span>
                      )}
                    </div>
                    <form action={mobileAcceptAction} className="mt-1.5 flex gap-1.5">
                      <input type="hidden" name="itemId" value={it.id} />
                      <input type="hidden" name="acceptanceId" value={a.id} />
                      <input
                        name="note"
                        placeholder="备注（可选）"
                        className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-2 py-1 text-[10px] outline-none focus:border-indigo-500"
                      />
                      <button
                        name="result"
                        value="合格"
                        className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-semibold text-white active:bg-emerald-700"
                      >
                        合格
                      </button>
                      <button
                        name="result"
                        value="不合格"
                        className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-[10px] font-semibold text-red-600 ring-1 ring-inset ring-red-200 active:bg-red-50"
                      >
                        不合格
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* ================== 照片 ================== */}
      {tab === "photo" && (
        <div className="space-y-3">
          <section className="rounded-2xl bg-white p-3.5 ring-1 ring-zinc-100">
            <div className="text-[12px] font-semibold">拍照留档</div>
            <p className="mt-0.5 text-[9px] leading-relaxed text-zinc-400">
              照片进文件中心（多版本 + 可同时挂任务/点位/验收多个业务对象），不重复存。
            </p>
            <form action={mobilePhotoAction} className="mt-2.5 space-y-2">
              <input
                type="file"
                name="photo"
                accept="image/*"
                capture="environment"
                className="w-full rounded-xl border border-dashed border-zinc-300 px-3 py-3 text-[11px] text-zinc-500"
              />
              <input
                name="label"
                placeholder="拍的是什么？如：卫生间防水闭水试验"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-indigo-500"
              />
              <SubmitButton
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-[13px] font-semibold text-white active:bg-indigo-700"
                pending="上传中…"
              >
                上传
              </SubmitButton>
            </form>
          </section>

          {files.length > 0 && (
            <section className="rounded-2xl bg-white p-3 ring-1 ring-zinc-100">
              <div className="px-0.5 text-[12px] font-semibold">已留档 {files.length} 张</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {files.map((f) => (
                  <a key={f.id} href={`/uploads/${f.storage_key}`} target="_blank" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/uploads/${f.storage_key}`}
                      alt={f.name}
                      className="aspect-square w-full rounded-xl object-cover ring-1 ring-zinc-100"
                    />
                    <div className="mt-1 truncate text-[9px] text-zinc-500">{f.name}</div>
                  </a>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-2xl bg-white p-3.5 ring-1 ring-zinc-100">
            <div className="text-[12px] font-semibold">照片动态</div>
            <ul className="mt-2 space-y-1.5">
              {acts
                .filter((a) => a.kind === "照片")
                .map((a) => (
                  <li key={a.id} className="flex gap-2 text-[11px] text-zinc-600">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-300" />
                    <span className="min-w-0 flex-1">{a.text}</span>
                    <span className="shrink-0 text-[9px] text-zinc-400">
                      {a.created_at.slice(5, 10)}
                    </span>
                  </li>
                ))}
              {acts.filter((a) => a.kind === "照片").length === 0 && (
                <li className="text-[11px] text-zinc-300">还没有照片</li>
              )}
            </ul>
          </section>
        </div>
      )}
    </MiniShell>
  );
}
