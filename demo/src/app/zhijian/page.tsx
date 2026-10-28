import Link from "next/link";
import { redirect } from "next/navigation";
import { listPendingAccepts, listRecentAccepts } from "@/lib/data";
import { getRole } from "@/lib/role";
import { BShell } from "@/components/BShell";
import { fmtTime } from "@/components/ui";

export default async function ZhijianPage() {
  const role = await getRole();
  if (role === "foreman") redirect("/");

  const pending = listPendingAccepts();
  const recent = listRecentAccepts(10);

  // 按工地分组待验收项
  const bySite = [...new Set(pending.map((p) => p.site_id))].map((siteId) => {
    const rows = pending.filter((p) => p.site_id === siteId);
    return { siteId, siteName: rows[0].site_name, code: rows[0].code, rows };
  });
  const pendingSteps = new Set(pending.map((p) => p.step_name)).size;

  return (
    <BShell active="/zhijian">
      <div className="mx-auto max-w-6xl px-6 py-7">
        <div className="mb-5">
          <h1 className="text-lg font-semibold">✅ 质检验收</h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            {role === "supervisor"
              ? "监理工作台：跟进各工地待验收项，提醒业主到场打卡；验收结果双方留痕。"
              : "老板视角的质检总览：各工地验收完成情况与业主验收记录。"}
          </p>
        </div>

        {/* KPI 条 */}
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { icon: "⏳", label: "待验收项", value: `${pending.length}`, hint: "业主端待打卡", tone: pending.length ? "amber" : "" },
            { icon: "🏗️", label: "涉及工地", value: `${bySite.length}`, hint: "有待办事项" },
            { icon: "🧱", label: "待验收工序", value: `${pendingSteps}`, hint: "个工序有未完成项" },
            { icon: "🧾", label: "最近已验收", value: `${recent.length}`, hint: "条最新记录" },
          ].map((s) => (
            <div key={s.label} className={`card px-4 py-3 ${s.tone ? "ring-2 ring-amber-200" : ""}`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-500">{s.label}</span>
                <span className="text-xs">{s.icon}</span>
              </div>
              <div className="mt-0.5 text-[17px] font-semibold tabular-nums">{s.value}</div>
              <div className={`text-[10px] ${s.tone ? "font-medium text-amber-600" : "text-zinc-400"}`}>{s.hint}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_330px]">
          {/* 待验收：按工地的面板网格 */}
          <div className="space-y-4">
            {bySite.length === 0 && (
              <div className="card flex flex-col items-center justify-center gap-1 px-6 py-16 text-center">
                <span className="text-2xl">🎉</span>
                <div className="text-sm font-medium text-zinc-500">所有验收项都已通过</div>
                <div className="text-xs text-zinc-400">去工地详情按工序添加新的验收项</div>
              </div>
            )}
            {bySite.map((g) => (
              <section key={g.siteId} className="card overflow-hidden p-0">
                <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/60 px-4 py-2.5">
                  <Link href={`/gongdi/${g.siteId}`} className="flex items-center gap-1.5 text-[13px] font-semibold hover:text-indigo-600 hover:underline">
                    🏗️ {g.siteName}
                  </Link>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600 ring-1 ring-amber-200">
                    {g.rows.length} 项待验收
                  </span>
                </div>
                <div className="divide-y divide-zinc-50">
                  {g.rows.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-2">
                      <span className="w-20 shrink-0 truncate text-[10px] font-medium text-zinc-400">{r.step_name}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-zinc-700">{r.item}</span>
                      <Link href={`/gongdi/${g.siteId}`} className="btn btn-ghost shrink-0 px-2 py-0.5 text-[10px]">去跟进 →</Link>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* 最近验收记录：时间线 */}
          <aside className="space-y-4">
            <section className="card p-4">
              <div className="mb-3 text-[13px] font-semibold">🧾 最近验收记录</div>
              {recent.length === 0 && <p className="text-xs text-zinc-400">还没有验收记录。</p>}
              <div className="relative space-y-3.5 before:absolute before:bottom-1 before:left-[5px] before:top-1 before:w-px before:bg-zinc-100">
                {recent.map((r) => (
                  <div key={r.id} className="relative pl-5">
                    <span className="absolute left-0 top-1 h-[11px] w-[11px] rounded-full border-2 border-emerald-400 bg-white" />
                    <div className="text-xs font-medium text-zinc-700">{r.step_name} · {r.item}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-zinc-400">
                      <Link href={`/gongdi/${r.site_id}`} className="font-mono hover:text-indigo-600 hover:underline">{r.site_name}</Link>
                      <span>·</span>
                      <span className="font-medium text-emerald-600">{r.checked_by || "业主"}</span>
                      <span>·</span>
                      <span>{fmtTime(r.checked_at)}</span>
                    </div>
                    {r.comment && <div className="mt-0.5 text-[11px] text-zinc-500">"{r.comment}"</div>}
                  </div>
                ))}
              </div>
            </section>

            <section className="card p-4">
              <div className="mb-2 text-[13px] font-semibold">📖 质检流程</div>
              <ol className="list-decimal space-y-1 pl-4 text-[10px] leading-relaxed text-zinc-500">
                <li>工地详情页按工序维护验收项清单；</li>
                <li>工序完成时业主端自动出现待打卡项；</li>
                <li>业主到场拍照打卡，写验收意见；</li>
                <li>验收结果同步到本页与首页动态流。</li>
              </ol>
            </section>
          </aside>
        </div>
      </div>
    </BShell>
  );
}
