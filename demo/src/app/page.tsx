import Link from "next/link";
import { listSitesWithProgress } from "@/lib/data";
import { createSiteAction } from "./actions";
import { Progress, StatusBadge, fmtTime } from "@/components/ui";

export default function HomePage() {
  const list = listSitesWithProgress();
  const active = list.filter(({ site, done, total }) => done > 0 && done < total).length;
  const budgetSum = list.reduce((s, { site }) => s + (site.budget || 0), 0);

  return (
    <div>
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-base">🏠</div>
            <div className="text-[15px] font-semibold">装修管理平台</div>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-zinc-500">DEMO</span>
          </div>
          <div className="text-sm text-zinc-500">演示装饰公司 · B端</div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">工地总览</h1>
          <p className="mt-1 text-sm text-zinc-500">装修公司从这里创建工地、跟进工序，业主扫码即看进度。</p>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            { label: "在建工地", value: `${list.length}`, hint: `进行中 ${active}` },
            { label: "在管预算", value: `¥${budgetSum.toLocaleString("zh-CN")}`, hint: "全部工地质检合计" },
            { label: "业主端入口", value: "扫码即用", hint: "无需注册 · 邀请码进入" },
          ].map((s) => (
            <div key={s.label} className="card px-5 py-4">
              <div className="text-xs text-zinc-500">{s.label}</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">{s.value}</div>
              <div className="mt-0.5 text-[11px] text-zinc-400">{s.hint}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="space-y-4">
            {list.map(({ site, done, total }) => {
              const pct = (done / total) * 100;
              return (
                <Link key={site.id} href={`/gongdi/${site.id}`} className="card block p-5 transition hover:border-indigo-200 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[15px] font-semibold">{site.name}</div>
                      <div className="mt-0.5 text-xs text-zinc-500">{site.community} · {site.layout}</div>
                    </div>
                    <StatusBadge status={done === total ? "已完成" : done > 0 ? "进行中" : "待开工"} />
                  </div>
                  <div className="mt-4">
                    <Progress value={pct} />
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-400">
                      <span>工序 {done}/{total}</span>
                      <span className="font-semibold text-zinc-600">{Math.round(pct)}%</span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                    <span>业主：{site.owner_name}</span>
                    <span>工长：{site.foreman}</span>
                    <span className="font-medium text-zinc-600">¥{(site.budget || 0).toLocaleString("zh-CN")}</span>
                    <span className="ml-auto text-zinc-400">{fmtTime(site.created_at)}</span>
                  </div>
                </Link>
              );
            })}
          </section>

          <aside className="space-y-4">
            <form action={createSiteAction} className="card p-5">
              <div className="mb-4 text-sm font-semibold">➕ 新建工地</div>
              <div className="space-y-3">
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
              <button className="btn btn-primary mt-4 w-full">创建工地</button>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
                创建后自动生成六道标准工序和业主邀请二维码。
              </p>
            </form>

            <div className="card p-5">
              <div className="mb-2 text-sm font-semibold">📱 业主端（C端）</div>
              <p className="text-xs leading-relaxed text-zinc-500">
                业主端是手机页面，扫码或直接打开：
              </p>
              <div className="mt-2 flex flex-col gap-1.5 text-xs">
                <Link href="/c/AX7K2M" className="font-mono text-indigo-600 hover:underline">/c/AX7K2M（王姐家 · 有已验收项）</Link>
                <Link href="/c/B3N8QK" className="font-mono text-indigo-600 hover:underline">/c/B3N8QK（李先生家 · 刚开工）</Link>
              </div>
              <p className="mt-2 text-[11px] text-zinc-400">浏览器打开后按 F12 切手机视图，效果最佳。</p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
