import Link from "next/link";
import {
  type Acceptance, getBudget, getProject, listAcceptances, listActivity,
  listEvents, listPayments, listPoints, listSpaces, summary, yuan,
} from "@/lib/self";
import {
  acceptResultAction, addPaymentAction, addPointAction, deletePointAction,
  applyEventsAction, updateMaterialAction,
} from "@/app/self-actions";
import { SubmitButton } from "@/components/SubmitButton";
import { PrintButton } from "@/components/PrintButton";

const TABS = [
  { key: "points", label: "点位设计", icon: "🔌" },
  { key: "materials", label: "材料清单", icon: "📋" },
  { key: "budget", label: "预算开销", icon: "💰" },
  { key: "accept", label: "验收", icon: "✅" },
  { key: "sync", label: "同步", icon: "🔄" },
] as const;

const TYPE_STYLE: Record<string, { icon: string; chip: string }> = {
  插座: { icon: "🔌", chip: "bg-amber-50 text-amber-700 ring-amber-200" },
  开关: { icon: "🎚️", chip: "bg-zinc-50 text-zinc-600 ring-zinc-200" },
  灯具: { icon: "💡", chip: "bg-yellow-50 text-yellow-700 ring-yellow-200" },
  水口: { icon: "🚿", chip: "bg-sky-50 text-sky-700 ring-sky-200" },
  网口: { icon: "🌐", chip: "bg-violet-50 text-violet-700 ring-violet-200" },
};

const ROOM_ICON: Record<string, string> = {
  客餐厅: "🛋️", 主卧: "🛏️", 次卧: "🛌", 厨房: "🍳", 卫生间: "🚿", 阳台: "🧺",
};

const BUDGET_CATEGORIES = [
  "水电材料", "水电人工", "瓦工材料", "瓦工人工", "木工材料", "木工人工",
  "油漆材料", "油漆人工", "主材", "卫浴厨电", "家具软装", "预留金",
];

export default async function SelfPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const raw = (await searchParams).tab ?? "points";
  const tab = (TABS as readonly { key: string }[]).some((t) => t.key === raw) ? raw : "points";

  const p = getProject();
  const s = summary(p.id);
  const spaces = listSpaces(p.id);
  const points = listPoints(p.id);
  const budget = getBudget(p.id);
  const pays = listPayments(p.id);
  const accepts = listAcceptances(p.id);
  const events = listEvents(p.id);
  const acts = listActivity(p.id, 8);
  const over = s.remainingCents < 0;

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* ===== 顶栏 ===== */}
      <header className="no-print sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-base text-white shadow-sm shadow-violet-200">
                🏠
              </div>
              <div>
                <div className="text-sm font-semibold leading-tight">自装工作台 · 桌面版</div>
                <div className="text-[10px] text-zinc-400">
                  设计 / 算量 / 预算在这里做 —— 小程序负责现场拍照与打卡
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/m" target="_blank" className="btn btn-ghost rounded-xl px-3 py-1.5 text-xs">
                📱 打开手机端
              </Link>
              <Link href="/" className="btn btn-ghost rounded-xl px-3 py-1.5 text-xs">
                🏢 公司装线
              </Link>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
            <div className="card col-span-2 px-3.5 py-2.5">
              <div className="text-[10px] text-zinc-400">
                {p.property_name} · {p.layout} · {p.area_sqm}㎡
              </div>
              <div className="mt-0.5 truncate text-sm font-semibold">{p.name}</div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full rounded-full bg-violet-600" style={{ width: `${s.progressPct}%` }} />
                </div>
                <span className="text-[10px] tabular-nums text-zinc-500">{Math.round(s.progressPct)}%</span>
              </div>
            </div>
            <Stat
              label="当前工序"
              value={s.current?.name ?? "全部完成"}
              hint={s.current ? `计划 ${s.current.planned_days} 天` : "待竣工验收"}
            />
            <Stat label="点位" value={`${s.count} 个`} hint={`材料 ${s.bom.rows.length} 项`} />
            <Stat
              label="预算"
              value={`¥${yuan(s.budgetTotalCents)}`}
              hint={`已花 ¥${yuan(s.spentCents)}`}
              tone={over ? "red" : "normal"}
            />
            <Stat
              label="剩余可用"
              value={`¥${yuan(s.remainingCents)}`}
              hint={over ? `超支 ¥${yuan(-s.remainingCents)}` : "按当前进度健康"}
              tone={over ? "red" : "green"}
            />
          </div>

          <nav className="mt-3 flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={`/self?tab=${t.key}`}
                className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                  tab === t.key
                    ? "bg-violet-600 text-white shadow-sm shadow-violet-200"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {t.icon} {t.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-5 print:max-w-none print:px-0">
        {/* ================= 点位设计 ================= */}
        {tab === "points" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
              {spaces.map((sp) => {
                const pts = points.filter((x) => x.space_id === sp.id);
                return (
                  <section key={sp.id} className="card flex flex-col p-4">
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                        <span>{ROOM_ICON[sp.name] ?? "🏠"}</span>
                        {sp.name}
                      </div>
                      <span className="text-[10px] text-zinc-400">
                        {sp.area_sqm}㎡ · {pts.length} 点位
                      </span>
                    </div>

                    <ul className="mt-2 flex-1 space-y-0.5">
                      {pts.length === 0 && (
                        <li className="py-2 text-[11px] text-zinc-300">还没有点位，点下方添加。</li>
                      )}
                      {pts.map((pt) => {
                        const st = TYPE_STYLE[pt.type] ?? TYPE_STYLE["插座"];
                        return (
                          <li key={pt.id} className="group flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-zinc-50">
                            <span
                              className={`inline-flex w-[52px] shrink-0 items-center justify-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${st.chip}`}
                            >
                              {st.icon} {pt.type}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-700">
                              {pt.label ?? "—"}
                              {pt.height_mm ? (
                                <span className="ml-1 rounded bg-zinc-100 px-1 text-[9px] text-zinc-500">
                                  H{pt.height_mm}
                                </span>
                              ) : null}
                            </span>
                            <span className="hidden w-[86px] shrink-0 truncate text-[9px] text-zinc-400 sm:block">
                              {pt.spec ?? ""}
                            </span>
                            <form action={deletePointAction} className="no-print shrink-0">
                              <input type="hidden" name="pointId" value={pt.id} />
                              <button
                                type="submit"
                                title="删除（仅桌面端可删）"
                                className="rounded px-1 text-[11px] text-zinc-300 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                              >
                                ×
                              </button>
                            </form>
                          </li>
                        );
                      })}
                    </ul>

                    <details className="no-print group mt-2 border-t border-zinc-100 pt-2">
                      <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-violet-600 [&::-webkit-details-marker]:hidden">
                        <span className="transition-transform group-open:rotate-90">▸</span> ＋ 添加点位
                      </summary>
                      <form action={addPointAction} className="mt-2 space-y-1.5">
                        <input type="hidden" name="spaceId" value={sp.id} />
                        <div className="flex gap-1.5">
                          <select name="type" className="input w-[66px] shrink-0 px-1 py-1 text-[11px]">
                            {Object.keys(TYPE_STYLE).map((t) => (
                              <option key={t}>{t}</option>
                            ))}
                          </select>
                          <input
                            name="label"
                            className="input min-w-0 flex-1 px-2 py-1 text-[11px]"
                            placeholder="位置，如：电视墙左侧"
                          />
                        </div>
                        <div className="flex gap-1.5">
                          <input
                            name="heightMm"
                            inputMode="numeric"
                            className="input w-[70px] shrink-0 px-2 py-1 text-[11px]"
                            placeholder="高度"
                          />
                          <input
                            name="spec"
                            className="input min-w-0 flex-1 px-2 py-1 text-[11px]"
                            placeholder="规格，如：五孔 10A"
                          />
                          <SubmitButton className="btn btn-ghost shrink-0 px-2.5 py-1 text-[11px]" pending="…">
                            加
                          </SubmitButton>
                        </div>
                      </form>
                    </details>
                  </section>
                );
              })}
            </div>

            <aside className="space-y-4 lg:sticky lg:top-[196px] lg:self-start">
              <section className="card p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-semibold">📋 材料清单 BOM</span>
                  <span className="text-[10px] text-zinc-400">实时汇总 · {s.count} 点位</span>
                </div>
                <p className="mt-0.5 text-[10px] text-zinc-400">
                  点位增删自动重算，含 5% 损耗；单价可在「材料清单」改成本地价。
                </p>
                <div className="mt-2.5 overflow-hidden rounded-xl ring-1 ring-zinc-100">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-zinc-50 text-[10px] text-zinc-400">
                        <th className="px-2.5 py-1.5 text-left font-medium">材料 / 规格</th>
                        <th className="px-1 py-1.5 text-center font-medium">数量</th>
                        <th className="px-2.5 py-1.5 text-right font-medium">小计</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.bom.rows.map((r) => (
                        <tr key={r.materialId} className="border-t border-zinc-100">
                          <td className="px-2.5 py-1.5">
                            <div className="text-zinc-700">{r.name}</div>
                            <div className="text-[9px] text-zinc-400">{r.spec}</div>
                          </td>
                          <td className="px-1 py-1.5 text-center tabular-nums text-zinc-600">
                            {r.qty}
                            {r.unit}
                          </td>
                          <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-zinc-700">
                            ¥{yuan(r.amountCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-zinc-200 bg-zinc-50/70">
                        <td className="px-2.5 py-2 text-[11px] font-semibold text-zinc-600" colSpan={2}>
                          水电材料合计
                        </td>
                        <td className="px-2.5 py-2 text-right font-mono text-sm font-bold text-violet-600">
                          ¥{yuan(s.bom.totalCents)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <Link
                  href="/self?tab=materials"
                  className="btn mt-2.5 w-full rounded-xl bg-violet-600 py-2 text-xs font-semibold text-white hover:bg-violet-700"
                >
                  去改单价 / 导出清单 →
                </Link>
              </section>

              <section className="card p-4">
                <div className="text-[13px] font-semibold">🧭 自装四步</div>
                <ol className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-zinc-500">
                  {[
                    ["1", "点位设计（当前）"],
                    ["2", "导出清单发材料商比价"],
                    ["3", "手机上拍进度、记开销、验收打卡"],
                    ["4", "完工对账，材料差价一目了然"],
                  ].map(([n, text], i) => (
                    <li key={n} className="flex gap-2">
                      <b className={i === 0 ? "text-violet-600" : "text-zinc-400"}>{n}</b>
                      <span className={i === 0 ? "text-zinc-700" : ""}>{text}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </aside>
          </div>
        )}

        {/* ================= 材料清单（可编辑） ================= */}
        {tab === "materials" && (
          <section className="card overflow-hidden">
            <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
              <div>
                <div className="text-[13px] font-semibold">材料清单 · 单价可改</div>
                <div className="text-[10px] text-zinc-400">
                  存的价是你本地价，不会被模板覆盖；损耗按百分比加在用量上。
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a href="/self/export" download className="btn btn-ghost rounded-xl px-3 py-1.5 text-xs">
                  ⬇ 导出 CSV
                </a>
                <PrintButton className="btn btn-ghost rounded-xl px-3 py-1.5 text-xs" label="🖨 打印 / 存 PDF" />
              </div>
            </div>

            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-zinc-50 text-[10px] text-zinc-500">
                  <th className="px-3 py-2 text-left font-medium">材料 / 规格</th>
                  <th className="px-2 py-2 text-center font-medium">数量</th>
                  <th className="px-2 py-2 text-center font-medium" colSpan={2}>
                    单价(元) / 损耗%
                  </th>
                  <th className="px-2 py-2 text-right font-medium">金额</th>
                  <th className="no-print px-3 py-2 text-center font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {s.bom.rows.map((r) => (
                  <tr key={r.materialId} className="border-t border-zinc-100">
                    <td className="px-3 py-2">
                      <div className="font-medium text-zinc-800">{r.name}</div>
                      <div className="text-[9px] text-zinc-400">
                        {r.spec} · {r.breakdown}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums text-zinc-700">
                      {r.qty}
                      {r.unit}
                    </td>
                    <td className="px-2 py-2" colSpan={2}>
                      <form action={updateMaterialAction} className="no-print flex items-center justify-center gap-1">
                        <input type="hidden" name="materialId" value={r.materialId} />
                        <input
                          name="unitPrice"
                          defaultValue={(r.unitPriceCents / 100).toFixed(2)}
                          className="input w-16 px-1.5 py-1 text-center text-[11px]"
                        />
                        <input
                          name="lossPct"
                          defaultValue={(r.lossBp / 100).toFixed(1)}
                          className="input w-12 px-1 py-1 text-center text-[11px]"
                        />
                        <SubmitButton
                          className="rounded px-1.5 py-1 text-[11px] text-violet-600 hover:bg-violet-50"
                          pending="…"
                        >
                          ✓
                        </SubmitButton>
                      </form>
                      <span className="hidden text-center print:inline">
                        {(r.unitPriceCents / 100).toFixed(2)} / {(r.lossBp / 100).toFixed(1)}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums text-zinc-800">
                      ¥{yuan(r.amountCents)}
                    </td>
                    <td className="no-print px-3 py-2 text-center">
                      <form action={updateMaterialAction}>
                        <input type="hidden" name="materialId" value={r.materialId} />
                        <input
                          type="hidden"
                          name="status"
                          value={r.status === "未买" ? "已买" : r.status === "已买" ? "已到货" : "未买"}
                        />
                        <button
                          type="submit"
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset transition ${
                            r.status === "已到货"
                              ? "bg-emerald-50 text-emerald-600 ring-emerald-200"
                              : r.status === "已买"
                                ? "bg-amber-50 text-amber-600 ring-amber-200"
                                : "bg-zinc-50 text-zinc-500 ring-zinc-200 hover:bg-zinc-100"
                          }`}
                        >
                          {r.status}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-200 bg-zinc-50">
                  <td className="px-3 py-2.5 text-[12px] font-semibold" colSpan={4}>
                    水电材料合计（含损耗）
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono text-sm font-bold text-violet-700">
                    ¥{yuan(s.bom.totalCents)}
                  </td>
                  <td className="no-print" />
                </tr>
              </tfoot>
            </table>
            <div className="hidden border-t border-zinc-200 px-4 py-2 text-[9px] text-zinc-400 print:block">
              {p.property_name} · {p.name} · 打印时间 {new Date().toLocaleString("zh-CN")}
            </div>
          </section>
        )}

        {/* ================= 预算开销 ================= */}
        {tab === "budget" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="card overflow-hidden lg:col-span-2">
              <div className="flex items-baseline justify-between border-b border-zinc-100 px-4 py-3">
                <div>
                  <div className="text-[13px] font-semibold">预算表 · 第 {budget?.version.version_no ?? 1} 版</div>
                  <div className="text-[10px] text-zinc-400">改预算 = 存新版本，旧版永不覆盖（对账时能回溯）</div>
                </div>
                <span className={`text-[11px] font-semibold ${over ? "text-red-600" : "text-emerald-600"}`}>
                  {over ? `超支 ¥${yuan(-s.remainingCents)}` : `还剩 ¥${yuan(s.remainingCents)}`}
                </span>
              </div>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-zinc-50 text-[10px] text-zinc-500">
                    <th className="px-3 py-2 text-left font-medium">分项</th>
                    <th className="px-2 py-2 text-left font-medium">说明</th>
                    <th className="px-2 py-2 text-right font-medium">预算</th>
                    <th className="px-2 py-2 text-right font-medium">已花</th>
                    <th className="px-3 py-2 text-right font-medium">余</th>
                  </tr>
                </thead>
                <tbody>
                  {(budget?.items ?? []).map((i) => {
                    const planned = i.category === "水电材料" ? s.bom.totalCents : i.amount_cents;
                    const spent = budget?.spentMap.get(i.category) ?? 0;
                    const left = planned - spent;
                    return (
                      <tr key={i.id} className="border-t border-zinc-100">
                        <td className="px-3 py-1.5">
                          <span className="font-medium text-zinc-800">{i.category}</span>
                          {i.category === "水电材料" && (
                            <span className="ml-1 rounded bg-violet-50 px-1 py-0.5 text-[9px] text-violet-600">
                              按点位算
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-[10px] text-zinc-400">{i.name}</td>
                        <td className="px-2 py-1.5 text-right font-mono tabular-nums text-zinc-700">
                          ¥{yuan(planned)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono tabular-nums text-zinc-500">
                          {spent ? `¥${yuan(spent)}` : "—"}
                        </td>
                        <td
                          className={`px-3 py-1.5 text-right font-mono tabular-nums ${
                            left < 0 ? "font-semibold text-red-600" : "text-zinc-600"
                          }`}
                        >
                          ¥{yuan(left)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-zinc-200 bg-zinc-50">
                    <td className="px-3 py-2.5 text-[12px] font-semibold" colSpan={2}>
                      合计
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono text-sm font-bold">
                      ¥{yuan(s.budgetTotalCents)}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono text-sm font-bold text-zinc-600">
                      ¥{yuan(s.spentCents)}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-mono text-sm font-bold ${
                        over ? "text-red-600" : "text-emerald-600"
                      }`}
                    >
                      ¥{yuan(s.remainingCents)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </section>

            <aside className="space-y-4">
              <section className="card p-4">
                <div className="text-[13px] font-semibold">＋ 记一笔开销</div>
                <form action={addPaymentAction} className="mt-2 space-y-2">
                  <input name="amount" inputMode="decimal" className="input py-1.5 text-xs" placeholder="金额（元）" />
                  <select name="category" className="input py-1.5 text-xs">
                    {BUDGET_CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <input name="note" className="input py-1.5 text-xs" placeholder="备注，如：瓷砖到货" />
                  <SubmitButton
                    className="btn w-full rounded-xl bg-violet-600 py-2 text-xs font-semibold text-white hover:bg-violet-700"
                    pending="保存中…"
                  >
                    保存
                  </SubmitButton>
                </form>
              </section>

              <section className="card p-4">
                <div className="text-[13px] font-semibold">开销流水</div>
                <div className="mt-1 text-[10px] text-zinc-400">只追加，不删不改；记错用反向记录冲销</div>
                <ul className="mt-2 divide-y divide-zinc-100">
                  {pays.map((x) => (
                    <li key={x.id} className="flex items-center gap-2 py-1.5">
                      <span className="w-9 shrink-0 text-[9px] text-zinc-400">{x.occurred_at.slice(5, 10)}</span>
                      <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-700">
                        {x.note ?? x.category}
                      </span>
                      {x.source === "miniapp" && (
                        <span className="shrink-0 rounded bg-emerald-50 px-1 text-[9px] text-emerald-600">
                          小程序
                        </span>
                      )}
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-zinc-600">
                        ¥{yuan(x.amount_cents)}
                      </span>
                    </li>
                  ))}
                  {pays.length === 0 && <li className="py-2 text-[11px] text-zinc-300">还没有记录</li>}
                </ul>
              </section>
            </aside>
          </div>
        )}

        {/* ================= 验收 ================= */}
        {tab === "accept" && (
          <div className="space-y-4">
            {accepts.map((a) => (
              <AcceptCard key={a.id} a={a} />
            ))}
            <section className="card p-4">
              <div className="text-[13px] font-semibold">📚 标准验收清单库</div>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                水电 7 项 / 瓦工 5 项 / 木工 4 项 / 油漆 4 项 —— 建验收时复制成快照，以后改模板不影响历史记录。
                每轮复验另存新结果行，上一轮永远查得到。
              </p>
            </section>
          </div>
        )}

        {/* ================= 同步 ================= */}
        {tab === "sync" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="card overflow-hidden lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
                <div>
                  <div className="text-[13px] font-semibold">事件队列（小程序 → 桌面）</div>
                  <div className="text-[10px] text-zinc-400">
                    手机端只能 append，桌面 pull 后 apply 并标记已处理 —— 编辑权只在一端，所以不会冲突
                  </div>
                </div>
                <form action={applyEventsAction}>
                  <SubmitButton
                    className="btn rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                    pending="接收中…"
                  >
                    接收待处理事件
                  </SubmitButton>
                </form>
              </div>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-zinc-50 text-[10px] text-zinc-500">
                    <th className="px-3 py-2 text-left font-medium">时间</th>
                    <th className="px-2 py-2 text-left font-medium">事件</th>
                    <th className="px-2 py-2 text-left font-medium">来源</th>
                    <th className="px-3 py-2 text-right font-medium">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="border-t border-zinc-100">
                      <td className="px-3 py-1.5 text-[10px] text-zinc-400">
                        {e.created_at.slice(5, 16).replace("T", " ")}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-[10px] text-zinc-700">{e.event_type}</td>
                      <td className="px-2 py-1.5 text-[10px] text-zinc-500">{e.device}</td>
                      <td className="px-3 py-1.5 text-right">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
                            e.status === "applied"
                              ? "bg-emerald-50 text-emerald-600 ring-emerald-200"
                              : "bg-amber-50 text-amber-600 ring-amber-200"
                          }`}
                        >
                          {e.status === "applied" ? "已应用" : "待处理"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <aside className="card p-4">
              <div className="text-[13px] font-semibold">项目动态</div>
              <ul className="mt-2 space-y-2">
                {acts.map((a) => (
                  <li key={a.id} className="flex gap-2 text-[11px]">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-300" />
                    <div className="min-w-0">
                      <div className="text-zinc-700">{a.text}</div>
                      <div className="text-[9px] text-zinc-400">
                        {a.source === "miniapp" ? "📱 小程序" : "🖥 桌面"} ·{" "}
                        {a.created_at.slice(5, 16).replace("T", " ")}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "normal",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "normal" | "red" | "green";
}) {
  const color = tone === "red" ? "text-red-600" : tone === "green" ? "text-emerald-600" : "text-zinc-900";
  return (
    <div className="card px-3.5 py-2.5">
      <div className="text-[10px] text-zinc-400">{label}</div>
      <div className={`mt-0.5 truncate text-sm font-semibold tabular-nums ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 truncate text-[9px] text-zinc-400">{hint}</div>}
    </div>
  );
}

function AcceptCard({ a }: { a: Acceptance }) {
  const pass = a.items.filter((i) => i.latest === "合格").length;
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
        <div>
          <div className="text-[13px] font-semibold">{a.name}</div>
          <div className="text-[10px] text-zinc-400">
            第 {a.round} 轮 · {pass}/{a.items.length} 项合格 · 每轮复验另存新记录，不覆盖上一轮
          </div>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
            pass === a.items.length
              ? "bg-emerald-50 text-emerald-600 ring-emerald-200"
              : "bg-amber-50 text-amber-600 ring-amber-200"
          }`}
        >
          {pass === a.items.length ? "全部合格" : "部分合格"}
        </span>
      </div>
      <ul className="divide-y divide-zinc-100">
        {a.items.map((it) => (
          <li key={it.id} className="flex items-center gap-2 px-4 py-2">
            <span className="w-5 shrink-0 text-[10px] tabular-nums text-zinc-300">{it.sort + 1}</span>
            <span className="min-w-0 flex-1 text-[11px] text-zinc-700">{it.text}</span>
            {it.latest && (
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] ${
                  it.latest === "合格" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                }`}
              >
                第{it.round}轮 {it.latest}
              </span>
            )}
            <form action={acceptResultAction} className="no-print flex shrink-0 gap-1">
              <input type="hidden" name="itemId" value={it.id} />
              <input type="hidden" name="acceptanceId" value={a.id} />
              <input name="note" className="input w-28 px-1.5 py-0.5 text-[10px]" placeholder="备注" />
              <button
                name="result"
                value="合格"
                className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100"
              >
                合格
              </button>
              <button
                name="result"
                value="不合格"
                className="rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-100"
              >
                不合格
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
