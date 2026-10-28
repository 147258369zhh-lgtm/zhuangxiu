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

  return (
    <BShell active="/zhijian">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">✅ 质检验收</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {role === "supervisor"
              ? "监理工作台：跟进各工地待验收项，提醒业主到现场打卡；质检验收结果双方留痕。"
              : "老板视角的质检总览：查看各工地验收完成情况与业主验收记录。"}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="card px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">待验收项</span><span className="text-sm">⏳</span>
            </div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{pending.length}</div>
            <div className="mt-0.5 text-[11px] text-zinc-400">业主端待打卡</div>
          </div>
          <div className="card px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">涉及工地</span><span className="text-sm">🏗️</span>
            </div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{bySite.length}</div>
            <div className="mt-0.5 text-[11px] text-zinc-400">有待办事项</div>
          </div>
          <div className="card px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">最近已验收</span><span className="text-sm">🕐</span>
            </div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{recent.length}</div>
            <div className="mt-0.5 text-[11px] text-zinc-400">条最新记录</div>
          </div>
          <div className="card px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">待验收工序</span><span className="text-sm">🧱</span>
            </div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{new Set(pending.map((p) => p.step_name)).size}</div>
            <div className="mt-0.5 text-[11px] text-zinc-400">个工序有未完成项</div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* 待验收清单（按工地分组） */}
          <section className="space-y-4">
            {bySite.length === 0 && (
              <div className="card flex flex-col items-center justify-center gap-1 px-6 py-14 text-center">
                <span className="text-2xl">🎉</span>
                <div className="text-sm font-medium text-zinc-500">所有验收项都已通过</div>
                <div className="text-xs text-zinc-400">去工地详情按工序添加新的验收项</div>
              </div>
            )}
            {bySite.map((g) => (
              <section key={g.siteId} className="card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <Link href={`/gongdi/${g.siteId}`} className="text-sm font-semibold hover:text-indigo-600 hover:underline">
                    🏗️ {g.siteName}
                  </Link>
                  <span className="text-[11px] text-zinc-400">{g.rows.length} 项待验收</span>
                </div>
                <div className="space-y-2">
                  {g.rows.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 rounded-lg bg-zinc-50 px-3 py-2">
                      <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-500" />
                      <span className="text-xs text-zinc-600">{r.step_name}</span>
                      <span className="truncate text-sm text-zinc-800">{r.item}</span>
                      <Link href={`/gongdi/${g.siteId}`} className="btn btn-ghost ml-auto shrink-0 px-2 py-1 text-[11px]">去跟进 →</Link>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </section>

          {/* 最近验收记录 */}
          <aside className="space-y-4">
            <section className="card p-5">
              <div className="mb-3 text-sm font-semibold">🧾 最近验收记录</div>
              <div className="space-y-2.5">
                {recent.length === 0 && <p className="text-xs text-zinc-400">还没有验收记录。</p>}
                {recent.map((r) => (
                  <div key={r.id} className="rounded-xl border border-zinc-100 px-3.5 py-2.5">
                    <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                      <Link href={`/gongdi/${r.site_id}`} className="truncate font-mono hover:text-indigo-600 hover:underline">{r.site_name}</Link>
                      <span className="ml-auto shrink-0">{fmtTime(r.checked_at)}</span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-600">{r.step_name} · {r.item}</div>
                    <div className="mt-1 flex items-center gap-2 text-[11px]">
                      <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-600">✓ {r.checked_by || "业主"}</span>
                      {r.comment && <span className="truncate text-zinc-400">"{r.comment}"</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card p-5">
              <div className="mb-2 text-sm font-semibold">📖 质检流程说明</div>
              <ol className="list-decimal space-y-1.5 pl-4 text-[11px] leading-relaxed text-zinc-500">
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
