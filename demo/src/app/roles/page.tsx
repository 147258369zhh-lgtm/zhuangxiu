import Link from "next/link";
import { BShell } from "@/components/BShell";

/* 功能模块 × 角色：2=可操作 1=可查看 0=不可见（同一模块按角色组合不同能力） */
const MODULES: { name: string; icon: string; cells: [number, number, number, number, number] }[] = [
  { name: "工序进度", icon: "🧱", cells: [2, 2, 1, 0, 1] },
  { name: "安装任务", icon: "🧰", cells: [2, 2, 1, 2, 0] },
  { name: "现场照片", icon: "📷", cells: [1, 1, 1, 2, 1] },
  { name: "验收清单", icon: "✅", cells: [1, 1, 2, 0, 2] },
  { name: "财务收款", icon: "💰", cells: [2, 0, 0, 0, 1] },
  { name: "增项管理", icon: "📋", cells: [2, 1, 0, 0, 2] },
  { name: "材料进场", icon: "📦", cells: [1, 2, 1, 1, 1] },
  { name: "施工日志", icon: "📝", cells: [1, 2, 1, 1, 1] },
  { name: "留言沟通", icon: "💬", cells: [1, 2, 1, 0, 2] },
  { name: "现场直播", icon: "🔴", cells: [1, 1, 1, 2, 1] },
];

const ROLE_COLS = ["老板", "工长", "监理", "工人", "业主"];

const ENDS = [
  {
    role: "装修公司老板", icon: "🏢", end: ["桌面 Web 大屏", "小程序轻看板"], tone: "indigo",
    see: "经营驾驶舱、财务图表、全部工地健康度",
    do: "建工地、批增项、看报表、派工长",
    no: "工人现场单张照片细节（由工长汇总）",
  },
  {
    role: "工长", icon: "👷", end: ["小程序为主", "桌面管理"], tone: "emerald",
    see: "自己工地的工序、材料、任务、留言",
    do: "推工序、派任务给工人、发日志、回复业主",
    no: "别家工地、全公司财务",
  },
  {
    role: "监理", icon: "🔍", end: ["小程序为主", "桌面档案"], tone: "amber",
    see: "全工地验收项、超期预警、质检记录",
    do: "现场验收打卡、整改单、抽检",
    no: "财务页、增项定价",
  },
  {
    role: "安装工人", icon: "🔧", end: ["纯小程序"], tone: "rose",
    see: "自己名下任务：点位图纸 + 拍照要求",
    do: "三类拍照上传、打卡完成、现场直播",
    no: "预算、合同额、增项、别人任务",
  },
  {
    role: "业主 / 住户", icon: "🏠", end: ["纯小程序"], tone: "violet",
    see: "我家进度、现场照片、验收清单、付款节点",
    do: "验收打卡、确认增项、留言、微信付款、看直播",
    no: "别人家、公司成本明细",
  },
];

const toneCls: Record<string, string> = {
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  rose: "bg-rose-50 text-rose-700 ring-rose-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
};

function Dot({ v }: { v: number }) {
  if (v === 2) return <span className="mx-auto block h-2.5 w-2.5 rounded-full bg-indigo-600" title="可操作" />;
  if (v === 1) return <span className="mx-auto block h-2.5 w-2.5 rounded-full bg-indigo-200" title="可查看" />;
  return <span className="mx-auto block text-center text-[10px] leading-2.5 text-zinc-300">—</span>;
}

export default function RolesPage() {
  return (
    <BShell active="/roles">
      <main className="mx-auto max-w-6xl px-6 py-6">
        {/* Hero */}
        <div className="mb-5 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 px-6 py-5 text-white shadow-sm">
          <h1 className="text-lg font-semibold">🧭 产品架构 · 一套能力，按角色组合</h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-indigo-100">
            双产品线共用同一套功能模块（工序/任务/照片/验收/财务/直播）；开发者拥有最高权限看到全部，
            各角色只是「模块 × 权限 × 端」的不同组合。下方矩阵即当前 Demo 的真实门控规则。
          </p>
        </div>

        {/* 双产品线 */}
        <div className="mb-5 grid gap-4 lg:grid-cols-2">
          <section className="card p-5">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-violet-50 px-2 py-1 text-sm">🎨</span>
              <span className="text-sm font-semibold">自装线 · 住户自己装</span>
              <span className="ml-auto rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-600 ring-1 ring-inset ring-violet-100">
                偏技术
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
              住户 = 自己的项目经理。桌面客户端内做精细化装修设计（房间点位：插座/开关/灯具/水口），
              实时汇总 BOM 材料清单并一键导出；施工跟踪部分走小程序（拍照、打卡、进度）。
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10px]">
              {["点位设计", "BOM 材料清单", "预算对照", "导出 CSV", "施工跟踪"].map((x) => (
                <span key={x} className="rounded-full bg-zinc-50 px-2 py-0.5 text-zinc-500 ring-1 ring-inset ring-zinc-100">{x}</span>
              ))}
            </div>
            <Link href="/self" className="btn btn-ghost mt-3 w-fit text-[11px] text-violet-600">🎨 进入自装工作台 →</Link>
          </section>
          <section className="card p-5">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-indigo-50 px-2 py-1 text-sm">🏢</span>
              <span className="text-sm font-semibold">公司装线 · 装修公司装</span>
              <span className="ml-auto rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600 ring-1 ring-inset ring-indigo-100">
                偏流程与验收
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
              老板/工长/监理/工人/业主五方协作：工序推进、任务派发、三类照片流转、验收打卡、
              收款与增项、保修台账。老板桌面大屏经营，现场角色全走小程序。
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10px]">
              {["工序甘特", "任务派发", "照片流转", "验收打卡", "收款增项", "保修台账"].map((x) => (
                <span key={x} className="rounded-full bg-zinc-50 px-2 py-0.5 text-zinc-500 ring-1 ring-inset ring-zinc-100">{x}</span>
              ))}
            </div>
          </section>
        </div>

        {/* 功能模块 × 角色矩阵 */}
        <section className="card mb-5 p-5">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-semibold">🔐 功能模块 × 角色权限矩阵</span>
            <span className="flex items-center gap-3 text-[10px] text-zinc-400">
              <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-indigo-600" />可操作</span>
              <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-indigo-200" />可查看</span>
              <span className="flex items-center gap-1">— 不可见</span>
            </span>
          </div>
          <p className="mb-3 text-[10px] text-zinc-400">同一模块按角色组合不同能力：如「现场照片」工人负责拍（可操作），其余角色只查看。</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white pb-2 text-left text-[11px] font-medium text-zinc-400">功能模块</th>
                  {ROLE_COLS.map((r) => (
                    <th key={r} className="pb-2 text-center text-[11px] font-medium text-zinc-500">{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULES.map((m) => (
                  <tr key={m.name} className="group">
                    <td className="sticky left-0 border-t border-zinc-100 bg-white py-2 pr-3 text-[11px] font-medium text-zinc-600 group-hover:bg-zinc-50">
                      {m.icon} {m.name}
                    </td>
                    {m.cells.map((v, i) => (
                      <td key={i} className="border-t border-zinc-100 py-2 group-hover:bg-zinc-50">
                        <Dot v={v} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 端位矩阵 */}
        <section className="mb-5">
          <div className="mb-2 text-sm font-semibold">📱 端位分配 · 谁用什么端</div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {ENDS.map((e) => (
              <div key={e.role} className="card p-4">
                <div className="flex items-center gap-2">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-base ring-1 ring-inset ${toneCls[e.tone]}`}>{e.icon}</span>
                  <div>
                    <div className="text-[13px] font-semibold">{e.role}</div>
                    <div className="flex flex-wrap gap-1">
                      {e.end.map((x) => (
                        <span key={x} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] text-zinc-500">{x}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <dl className="mt-2.5 space-y-1 text-[11px] leading-relaxed">
                  <div className="flex gap-1.5"><dt className="shrink-0 text-zinc-400">看</dt><dd className="text-zinc-600">{e.see}</dd></div>
                  <div className="flex gap-1.5"><dt className="shrink-0 text-zinc-400">干</dt><dd className="text-zinc-600">{e.do}</dd></div>
                  <div className="flex gap-1.5"><dt className="shrink-0 text-zinc-400">禁</dt><dd className="text-red-400/80">{e.no}</dd></div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* 小程序能力边界 */}
        <div className="mb-5 grid gap-4 lg:grid-cols-2">
          <section className="card p-5">
            <div className="text-sm font-semibold text-emerald-700">✅ 小程序能扛（且有原生优势）</div>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-zinc-600">
              <li>· 拍照上传（chooseMedia）、扫码进工地、订阅消息推送</li>
              <li>· <b className="text-zinc-800">微信支付</b>：业主付款场景天然契合</li>
              <li>· <b className="text-zinc-800">现场直播</b>：live-pusher / live-player 原生组件，工人推流、各方围观无需客户端</li>
              <li>· 现场角色（工人/监理/业主）的日常操作全部覆盖</li>
            </ul>
          </section>
          <section className="card p-5">
            <div className="text-sm font-semibold text-amber-700">⚠️ 小程序扛不住 → 客户端/桌面</div>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-zinc-600">
              <li>· 自装精细化设计：点位画布、多面板联动（主包 2MB 限制 + 双线程性能）</li>
              <li>· 材料 BOM 实时计算与导出（桌面客户端 Electron/Tauri）</li>
              <li>· 老板经营大屏：多图表并排分析（桌面 Web）</li>
            </ul>
          </section>
        </div>

        {/* 直播链路 */}
        <section className="card mb-5 p-5">
          <div className="text-sm font-semibold">🔴 现场直播链路（远期 · Demo 已留占位）</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              { n: "1", t: "工长派单", d: "任务带点位图纸，指定工人" },
              { n: "2", t: "工人开播", d: "小程序 live-pusher 推流，附任务与房间" },
              { n: "3", t: "各方围观", d: "工长/监理/业主小程序 live-player 观看" },
            ].map((s) => (
              <div key={s.n} className="rounded-xl bg-zinc-50 px-3.5 py-3">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">{s.n}</div>
                <div className="mt-1.5 text-[12px] font-semibold">{s.t}</div>
                <div className="mt-0.5 text-[10px] leading-relaxed text-zinc-400">{s.d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 演示入口 */}
        <section className="card flex flex-wrap items-center gap-2.5 p-4">
          <span className="text-xs font-semibold text-zinc-600">🚪 演示入口：</span>
          {[
            { href: "/role?to=boss&back=/", label: "老板驾驶舱", icon: "🏢" },
            { href: "/role?to=foreman&back=/", label: "工长视角", icon: "👷" },
            { href: "/role?to=supervisor&back=/", label: "监理视角", icon: "🔍" },
            { href: "/role?to=worker&back=/worker", label: "工人端（小程序）", icon: "🔧" },
            { href: "/c/AX7K2M", label: "业主端（小程序）", icon: "🏠" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="btn btn-ghost text-[11px]">{l.icon} {l.label}</Link>
          ))}
        </section>
      </main>
    </BShell>
  );
}
