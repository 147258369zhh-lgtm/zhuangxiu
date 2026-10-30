import Link from "next/link";
import { getProject, summary, yuan } from "@/lib/self";

export default async function StartPage() {
  const p = getProject();
  const s = summary(p.id);

  const entries = [
    {
      href: "/self",
      icon: "🖥",
      title: "桌面端 · 自装工作台",
      sub: "设计 / 算量 / 预算 / 导出",
      desc: "点位设计、BOM 自动汇总、单价可改、预算表、打印清单。收费的这一端。",
      tone: "from-violet-600 to-indigo-600",
      cta: "进入桌面端",
    },
    {
      href: "/m",
      icon: "📱",
      title: "小程序端 · 现场助手",
      sub: "看 / 拍 / 记 / 勾",
      desc: "看清单、拍照留档、记开销、验收打卡。只能追加，不能编辑——所以两端不会冲突。",
      tone: "from-indigo-600 to-sky-500",
      cta: "打开手机端（建议手机尺寸）",
    },
    {
      href: "/",
      icon: "🏢",
      title: "公司装线（旧原型）",
      sub: "装企视角，未接新库",
      desc: "12 轮迭代留下的公司端原型，仍是旧 SQLite 假表，留作下一步接装企线时的参考。",
      tone: "from-zinc-600 to-zinc-500",
      cta: "看看旧原型",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-lg text-white shadow-md shadow-violet-200">
            🏠
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900">装修助手 · 可演示版本</h1>
            <p className="text-xs text-zinc-500">
              桌面软件 + 微信小程序 双端 | 自装线先行 | 本地真库 33 张表
            </p>
          </div>
        </div>

        {/* 当前演示项目 */}
        <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:grid-cols-4">
          <div>
            <div className="text-[10px] text-zinc-400">演示项目</div>
            <div className="mt-0.5 truncate text-sm font-semibold">{p.name}</div>
            <div className="text-[10px] text-zinc-400">
              {p.property_name} · {p.area_sqm}㎡
            </div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-400">点位</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">{s.count} 个</div>
            <div className="text-[10px] text-zinc-400">材料 {s.bom.rows.length} 项</div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-400">预算 / 已花</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">
              ¥{yuan(s.budgetTotalCents)}
            </div>
            <div className="text-[10px] text-zinc-400">已花 ¥{yuan(s.spentCents)}</div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-400">完工进度</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">{Math.round(s.progressPct)}%</div>
            <div className="text-[10px] text-zinc-400">当前 {s.current?.name ?? "—"}</div>
          </div>
        </div>

        {/* 两端入口 */}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {entries.map((e) => (
            <Link
              key={e.href}
              href={e.href}
              className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className={`bg-gradient-to-br ${e.tone} px-4 py-5 text-white`}>
                <div className="text-2xl">{e.icon}</div>
                <div className="mt-2 text-sm font-semibold">{e.title}</div>
                <div className="text-[10px] text-white/80">{e.sub}</div>
              </div>
              <div className="flex flex-1 flex-col justify-between p-4">
                <p className="text-[11px] leading-relaxed text-zinc-500">{e.desc}</p>
                <div className="mt-3 text-[11px] font-medium text-violet-600 group-hover:underline">
                  {e.cta} →
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* 演示动线 */}
        <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="text-sm font-semibold text-zinc-800">建议演示动线（3 分钟）</div>
          <ol className="mt-3 space-y-2 text-[12px] leading-relaxed text-zinc-600">
            {[
              ["桌面端 · 点位设计", "看 6 个房间 39 个点位（带高度和规格），右边 BOM 自动汇总到「水电材料合计」"],
              ["桌面端 · 材料清单", "把某项单价从 28 改成当地价 32，金额和预算立刻变；顺手点一下「打印/存 PDF」"],
              ["桌面端 · 预算开销", "12 个分项，「水电材料」是按点位算出来的，不是手填；已花 3 笔有来源"],
              ["手机端 · 验收打卡", "水电验收第 1 轮有 2 项不合格、第 2 轮整改后合格 —— 两轮都查得到"],
              ["手机端 · 记一笔开销", "回到桌面端「预算开销」，这笔就出现在流水里，标着「小程序」"],
              ["手机端 · 清单点「已买」", "这笔是**先进事件队列**；到桌面端「同步」点「接收待处理事件」才生效 —— 这就是单向同步"],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-2.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[9px] font-bold text-violet-700">
                  {i + 1}
                </span>
                <span>
                  <b className="text-zinc-800">{t}</b>
                  <span className="ml-1 text-zinc-500">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* 架构说明 */}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="text-sm font-semibold text-zinc-800">数据在哪</div>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-zinc-600">
              <li>• 真相在本地 SQLite：<code className="rounded bg-zinc-100 px-1">demo/.data/self.db</code>，33 张表</li>
              <li>• 云端只做转接点（快照 + 事件队列），这一版用 <code className="rounded bg-zinc-100 px-1">outbox_events</code> 模拟</li>
              <li>• 手机端只有 append 接口，编辑权全在桌面 —— 冲突面≈0</li>
              <li>• 金额一律存「分」，数量存千分位整数，不用浮点</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="text-sm font-semibold text-zinc-800">三条数据库纪律</div>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-zinc-600">
              <li>• 组合外键：每条业务记录带 project_id，跨项目引用会被库拦住</li>
              <li>• 版本不覆盖：预算改版 = 新版本行；文件改动 = 新版本号</li>
              <li>• 状态 ≠ 历史：验收每轮另存结果；任务状态有独立历史表</li>
              <li className="text-zinc-400">跑 <code className="rounded bg-zinc-100 px-1">node scripts/verify-schema.mjs</code> 可验证约束真的生效</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
