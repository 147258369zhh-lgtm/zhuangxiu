import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole, ROLE_LABEL } from "@/lib/role";
import { listTasksForWorker, WORKER_NAME, getTaskPhotos } from "@/lib/data";
import { MiniShell } from "@/components/MiniShell";
import { fmtDate } from "@/components/ui";

const TASK_TONE: Record<string, string> = {
  待施工: "bg-zinc-100 text-zinc-500 ring-zinc-200",
  施工中: "bg-amber-50 text-amber-600 ring-amber-200",
  已完成: "bg-emerald-50 text-emerald-600 ring-emerald-200",
};

function TaskCard({ t }: { t: Awaited<ReturnType<typeof listTasksForWorker>>[number] }) {
  const photos = getTaskPhotos(t.id);
  const liveBadge = t.live === 1;
  return (
    <Link
      href={`/worker/${t.id}`}
      className="card block overflow-hidden p-0 transition hover:border-indigo-300 hover:shadow-md"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={t.drawing ?? ""} alt="点位图纸" className="h-24 w-full object-cover object-top" />
      <div className="p-3.5">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${TASK_TONE[t.status]}`}>
            {t.status}
          </span>
          {liveBadge && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> 直播中
            </span>
          )}
          <span className="ml-auto text-[10px] text-zinc-400">{fmtDate(t.created_at)}</span>
        </div>
        <div className="mt-1.5 text-[15px] font-semibold leading-snug">{t.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-500">
          <span>📍 {t.room}</span>
          <span className="text-zinc-300">·</span>
          <span>{t.step_name}</span>
          <span className="text-zinc-300">·</span>
          <span>📷 {photos.length} 张</span>
        </div>
        <div className="mt-2 rounded-lg bg-indigo-50/60 px-2.5 py-1.5 text-[11px] text-indigo-600">
          🏠 {t.site_name} <span className="font-mono text-indigo-400">/c/{t.code}</span>
        </div>
      </div>
    </Link>
  );
}

export default async function WorkerPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const role = await getRole();
  if (role !== "worker") redirect(`/role?to=worker&back=/worker`);
  const { tab = "todo" } = await searchParams;
  const tasks = listTasksForWorker(WORKER_NAME);
  const todo = tasks.filter((t) => t.status !== "已完成");
  const done = tasks.filter((t) => t.status === "已完成");
  const liveCount = todo.filter((t) => t.live === 1).length;
  const photoCount = tasks.reduce((n, t) => n + getTaskPhotos(t.id).length, 0);

  return (
    <MiniShell
      title="师傅小助手"
      active={tab}
      tabs={[
        { key: "todo", href: "/worker?tab=todo", label: "任务", icon: "🧰", badge: todo.length },
        { key: "done", href: "/worker?tab=done", label: "历史", icon: "✅" },
        { key: "me", href: "/worker?tab=me", label: "我的", icon: "👤" },
      ]}
    >
      {tab !== "me" && (
        <div className="mb-3 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-3 text-white shadow-sm">
          <div className="text-[11px] font-medium text-indigo-100">安装工 · {WORKER_NAME}</div>
          <div className="mt-0.5 text-lg font-bold">
            {tab === "todo" ? `今日 ${todo.length} 个任务` : `累计完成 ${done.length} 个任务`}
          </div>
          <div className="mt-1 text-[11px] text-indigo-100">
            {tab === "todo"
              ? liveCount > 0 ? `🔴 ${liveCount} 个现场正在直播` : "现场拍照上传，进度业主端实时可见"
              : `共上传现场照片 ${photoCount} 张`}
          </div>
        </div>
      )}

      {tab === "me" ? (
        <div className="space-y-3">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-xl">🔧</div>
              <div>
                <div className="text-sm font-semibold">{WORKER_NAME}</div>
                <div className="text-[11px] text-zinc-400">安装工 · 承接 2 个工地任务</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                { n: tasks.length, l: "累计任务" },
                { n: done.length, l: "已完成" },
                { n: photoCount, l: "现场照片" },
              ].map((s) => (
                <div key={s.l} className="rounded-xl bg-zinc-50 py-2.5">
                  <div className="text-lg font-bold tabular-nums text-indigo-600">{s.n}</div>
                  <div className="text-[10px] text-zinc-400">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-4">
            <div className="text-xs font-semibold text-zinc-600">🛠️ 现场能力（小程序）</div>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-zinc-500">
              <li>· 点位图纸：任务自带施工图，现场对照定位</li>
              <li>· 三类拍照：施工前 / 材料照片 / 施工后，自动归档</li>
              <li>· 打卡完成：照片同步工长、监理、业主查看</li>
              <li>· 现场直播（远期）：live-pusher 推流，各方线上围观</li>
            </ul>
          </div>
          <div className="rounded-xl bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-700 ring-1 ring-inset ring-amber-100">
            你正以<b>工人视角</b>查看（{ROLE_LABEL[role]}）。工人的预算、合同、增项金额一律不可见。
          </div>
        </div>
      ) : (tab === "todo" ? todo : done).length === 0 ? (
        <div className="card p-8 text-center text-xs text-zinc-400">
          {tab === "todo" ? "暂无待办任务，工长派单后这里会出现 ✓" : "还没有完成记录"}
        </div>
      ) : (
        <div className="space-y-3">
          {(tab === "todo" ? todo : done).map((t) => (
            <TaskCard key={t.id} t={t} />
          ))}
        </div>
      )}
    </MiniShell>
  );
}
