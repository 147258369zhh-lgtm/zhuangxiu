import Link from "next/link";
import { computeBom, getSelfPoints, listSelfRooms, POINT_TYPES } from "@/lib/data";
import { addSelfPointAction, removeSelfPointAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { fmtMoney } from "@/components/ui";

const ROOM_ICON: Record<string, string> = {
  客餐厅: "🛋️", 主卧: "🛏️", 次卧: "🛌", 厨房: "🍳", 卫生间: "🚿", 阳台: "🧺",
};

const TYPE_STYLE: Record<string, { icon: string; chip: string }> = {
  插座: { icon: "🔌", chip: "bg-amber-50 text-amber-700 ring-amber-100" },
  开关: { icon: "🎚️", chip: "bg-zinc-50 text-zinc-600 ring-zinc-200" },
  灯具: { icon: "💡", chip: "bg-yellow-50 text-yellow-700 ring-yellow-100" },
  水口: { icon: "🚿", chip: "bg-sky-50 text-sky-700 ring-sky-100" },
  网口: { icon: "🌐", chip: "bg-violet-50 text-violet-700 ring-violet-100" },
};

export default function SelfPage() {
  const rooms = listSelfRooms();
  const bom = computeBom();
  const totalArea = rooms.reduce((s, r) => s + r.area, 0);

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* 工具条（自装线独立产品线外壳） */}
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-base shadow-sm shadow-violet-200">🎨</div>
            <div>
              <div className="text-sm font-semibold">自装工作台</div>
              <div className="text-[10px] text-zinc-400">
                我的家 · {totalArea}㎡ 两室两厅 · {bom.count} 个点位 · 桌面设计工具（小程序端跟踪施工）
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-zinc-100 p-0.5">
            <span className="rounded-lg bg-white px-3 py-1 text-xs font-medium text-violet-600 shadow-sm">🎨 自装线</span>
            <Link href="/" className="rounded-lg px-3 py-1 text-xs text-zinc-500 transition hover:text-zinc-700">🏢 公司装线</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-5">
        <div className="grid gap-4 lg:grid-cols-3">
          {/* 左：房间点位设计 */}
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
            {rooms.map((room) => {
              const pts = getSelfPoints(room.id);
              return (
                <section key={room.id} className="card flex flex-col p-4">
                  <div className="flex items-baseline justify-between">
                    <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                      <span>{ROOM_ICON[room.name] ?? "🏠"}</span>
                      {room.name}
                    </div>
                    <span className="text-[10px] text-zinc-400">{room.area}㎡ · {pts.length} 点位</span>
                  </div>
                  <div className="mt-2 flex flex-1 flex-wrap content-start gap-1.5">
                    {pts.length === 0 && <span className="py-2 text-[11px] text-zinc-300">还没有点位，点下方添加。</span>}
                    {pts.map((p) => {
                      const st = TYPE_STYLE[p.type] ?? TYPE_STYLE["插座"];
                      return (
                        <form key={p.id} action={removeSelfPointAction} className="group/chip">
                          <input type="hidden" name="pointId" value={p.id} />
                          <button
                            type="submit"
                            title={`删除「${p.label ?? p.type}」`}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium ring-1 ring-inset transition hover:ring-red-200 hover:bg-red-50 hover:text-red-500 ${st.chip}`}
                          >
                            <span>{st.icon}</span>
                            {p.label ?? p.type}
                            <span className="text-current/40 group-hover/chip:text-red-400">×</span>
                          </button>
                        </form>
                      );
                    })}
                  </div>
                  <details className="no-print group mt-2.5 border-t border-zinc-100 pt-2">
                    <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-violet-600 hover:text-violet-500 [&::-webkit-details-marker]:hidden">
                      <span className="transition-transform group-open:rotate-90">▸</span> ＋ 添加点位
                    </summary>
                    <form action={addSelfPointAction} className="mt-2 flex gap-1.5">
                      <input type="hidden" name="roomId" value={room.id} />
                      <select name="type" className="input w-[74px] shrink-0 px-1.5 py-1 text-[11px]">
                        {POINT_TYPES.map((t) => <option key={t}>{t}</option>)}
                      </select>
                      <input name="label" className="input min-w-0 flex-1 px-2 py-1 text-[11px]" placeholder="位置，如：电视墙左侧" />
                      <SubmitButton className="btn btn-ghost shrink-0 px-2.5 py-1 text-[11px]" pending="…">加</SubmitButton>
                    </form>
                  </details>
                </section>
              );
            })}
          </div>

          {/* 右：BOM 材料清单 */}
          <aside className="space-y-4 lg:sticky lg:top-16 lg:self-start">
            <section className="card p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-semibold">📋 材料清单 BOM</span>
                <span className="text-[10px] text-zinc-400">实时汇总 · {bom.count} 点位</span>
              </div>
              <p className="mt-0.5 text-[10px] text-zinc-400">点位增删自动重算，导出后可直接发材料商或施工队。</p>
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
                    {bom.rows.map((r) => (
                      <tr key={r.type} className="border-t border-zinc-100">
                        <td className="px-2.5 py-1.5">
                          <div className="text-zinc-700">{r.name}</div>
                          <div className="text-[9px] text-zinc-400">{r.spec}</div>
                        </td>
                        <td className="px-1 py-1.5 text-center tabular-nums text-zinc-600">{r.qty}{r.unit}</td>
                        <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-zinc-700">¥{fmtMoney(r.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-zinc-200 bg-zinc-50/60">
                      <td className="px-2.5 py-2 text-[11px] font-semibold text-zinc-600" colSpan={2}>合计（参考价）</td>
                      <td className="px-2.5 py-2 text-right font-mono text-sm font-bold text-violet-600">¥{fmtMoney(bom.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <a
                href="/self/export"
                download
                className="btn mt-2.5 w-full rounded-xl bg-violet-600 py-2.5 text-xs font-semibold text-white transition hover:bg-violet-700"
              >
                ⬇ 导出材料清单（CSV）
              </a>
              <p className="mt-1.5 text-[9px] leading-relaxed text-zinc-400">
                含类型/规格/数量/单价/小计，Excel 可直接打开；辅材按插座+开关数 × 3.5 米估算。
              </p>
            </section>

            <section className="card p-4">
              <div className="text-[13px] font-semibold">🧭 自装路线图</div>
              <ol className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-zinc-500">
                <li className="flex gap-2"><b className="text-violet-600">1</b> 点位设计（当前）：按房间逐个点位，插座/开关/灯具/水口/网口</li>
                <li className="flex gap-2"><b className="text-zinc-400">2</b> 导出 BOM：清单发材料商比价，或直接发施工队</li>
                <li className="flex gap-2"><b className="text-zinc-400">3</b> 施工跟踪（小程序）：拍照打卡、进度、验收</li>
                <li className="flex gap-2"><b className="text-zinc-400">4</b> 完工验收与保修台账</li>
              </ol>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
