import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRole } from "@/lib/role";
import { getTask, getTaskPhotos, getTaskPoints, getSite, WORKER_NAME } from "@/lib/data";
import { MiniShell } from "@/components/MiniShell";
import { DrawingBoard } from "@/components/DrawingBoard";
import { SubmitButton } from "@/components/SubmitButton";
import { fmtDate, fmtTime } from "@/components/ui";
import {
  addTaskPhotoAction,
  startTaskAction,
  finishTaskAction,
  toggleLiveAction,
} from "@/app/actions";

const CATS = [
  { key: "before", label: "施工前", icon: "📷", desc: "原始现场/原线路" },
  { key: "material", label: "材料照片", icon: "📦", desc: "型号/品牌核对" },
  { key: "after", label: "施工后", icon: "✨", desc: "安装完成效果" },
] as const;

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const role = await getRole();
  if (role !== "worker") redirect(`/role?to=worker&back=/worker`);
  const { id } = await params;
  const task = getTask(id);
  if (!task || task.worker !== WORKER_NAME) notFound();
  const site = getSite(task.site_id);
  const photos = getTaskPhotos(id);
  const points = getTaskPoints(id);
  const byCat = (c: string) => photos.filter((p) => p.category === c);
  const pointName = (pid: string | null) => points.find((p) => p.id === pid)?.name ?? "任务整体";
  const isLive = task.live === 1;
  const open = task.status !== "已完成";

  return (
    <MiniShell title="任务详情" active="todo" tabs={[
      { key: "todo", href: "/worker?tab=todo", label: "任务", icon: "🧰" },
      { key: "done", href: "/worker?tab=done", label: "历史", icon: "✅" },
      { key: "me", href: "/worker?tab=me", label: "我的", icon: "👤" },
    ]}>
      {/* 工地来源 */}
      <div className="mb-3 rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-inset ring-zinc-100">
        <div className="text-[11px] text-zinc-400">所属工地</div>
        <div className="mt-0.5 text-[13px] font-semibold">{site?.name}</div>
        <div className="text-[10px] text-zinc-400">{site?.community} · {task.step_name}</div>
      </div>

      {/* 点位对照图（图纸 + 可点击点位 + 点位级拍照） */}
      <DrawingBoard
        plan={task.drawing ?? ""}
        points={points.map((p) => ({
          id: p.id, seq: p.seq, name: p.name, spec: p.spec, x: p.x, y: p.y, status: p.status,
        }))}
        photos={photos.map((p) => ({ id: p.id, point_id: p.point_id, category: p.category, url: p.url }))}
        taskId={id}
        editable={open}
      />

      {/* 拍照区（未完成时开放） */}
      {open ? (
        <>
          <div className="card mb-3 p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold">📷 现场拍照上传</div>
              <span className="text-[10px] text-zinc-400">完成后自动同步 工长/监理/业主</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {CATS.map((c) => (
                <form key={c.key} action={addTaskPhotoAction}>
                  <input type="hidden" name="taskId" value={id} />
                  <input type="hidden" name="category" value={c.key} />
                  <SubmitButton
                    className="btn w-full flex-col items-center gap-1 rounded-xl bg-white py-3 text-[11px] font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200 transition hover:ring-indigo-300 disabled:opacity-50"
                    pending="上传中…"
                  >
                    <span className="text-base">{c.icon}</span>
                    {c.label}
                    <span className="text-[9px] text-zinc-400">{c.desc}</span>
                  </SubmitButton>
                </form>
              ))}
            </div>
          </div>

          {/* 照片墙（三分类分组） */}
          {CATS.map((c) => {
            const list = byCat(c.key);
            if (list.length === 0) return null;
            return (
              <div key={c.key} className="card mb-3 p-4">
                <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-zinc-600">
                  <span>{c.icon} {c.label}</span>
                  <span className="rounded-full bg-zinc-100 px-1.5 font-mono text-[10px] text-zinc-400">{list.length}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {list.map((p) => (
                    <div key={p.id} className="overflow-hidden rounded-lg bg-white ring-1 ring-zinc-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={c.label} className="w-full" />
                      <div className="truncate px-1.5 py-0.5 text-[9px] text-zinc-400">{pointName(p.point_id)}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      ) : (
        <div className="card mb-3 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 ring-1 ring-inset ring-emerald-200">
              ✓ 已打卡完成
            </span>
            {task.done_at && <span className="text-[10px] text-zinc-400">{fmtTime(task.done_at)}</span>}
          </div>
          <div className="text-[11px] leading-relaxed text-zinc-500">
            现场照片已同步：<b className="text-zinc-700">工长</b>（任务确认）、<b className="text-zinc-700">监理</b>（抽检）、<b className="text-zinc-700">业主</b>（我家进度页可见）
          </div>
          {CATS.map((c) => {
            const list = byCat(c.key);
            if (list.length === 0) return null;
            return (
              <div key={c.key} className="mt-3">
                <div className="mb-1.5 text-[11px] font-semibold text-zinc-600">{c.icon} {c.label}</div>
                <div className="grid grid-cols-2 gap-2">
                  {list.map((p) => (
                    <div key={p.id} className="overflow-hidden rounded-lg bg-white ring-1 ring-zinc-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={c.label} className="w-full" />
                      <div className="truncate px-1.5 py-0.5 text-[9px] text-zinc-400">{pointName(p.point_id)}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 直播（施工中才有） */}
      {task.status === "施工中" && (
        <div className="card mb-3 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold">🔴 现场直播（远期 · 占位）</div>
            {isLive ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> 直播中
              </span>
            ) : (
              <span className="text-[10px] text-zinc-400">未开播</span>
            )}
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">
            小程序 live-pusher 推流，工长/监理/业主在小程序里围观。
          </p>
          <form action={toggleLiveAction} className="mt-2.5">
            <input type="hidden" name="taskId" value={id} />
            <SubmitButton
              className={`btn w-full rounded-xl py-2.5 text-xs font-semibold text-white ${isLive ? "bg-zinc-500" : "bg-red-500 hover:bg-red-600"}`}
              pending="处理中…"
            >
              {isLive ? "⏹ 结束直播" : "🔴 开启直播"}
            </SubmitButton>
          </form>
        </div>
      )}

      {/* 状态流转 */}
      <div className="card mb-3 p-4">
        <div className="text-xs font-semibold">状态流转</div>
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-zinc-400">
          <span>创建 {fmtDate(task.created_at)}</span>
          <span className="text-zinc-300">→</span>
          <span className={task.status === "待施工" ? "text-zinc-300" : ""}>{task.status === "待施工" ? "未开工" : `开工 ${fmtDate(task.created_at)}`}</span>
          <span className="text-zinc-300">→</span>
          <span className={task.status === "已完成" ? "font-semibold text-emerald-600" : ""}>
            {task.status === "已完成" ? `完成 ${fmtTime(task.done_at ?? "")}` : task.status === "施工中" ? "进行中" : "待完成"}
          </span>
        </div>
        <div className="mt-3 flex gap-2">
          {task.status === "待施工" && (
            <form action={startTaskAction} className="flex-1">
              <input type="hidden" name="taskId" value={id} />
              <SubmitButton className="btn btn-primary w-full rounded-xl py-2.5 text-xs" pending="处理中…">
                🧰 开始施工
              </SubmitButton>
            </form>
          )}
          {task.status === "施工中" && (
            <form action={finishTaskAction} className="flex-1">
              <input type="hidden" name="taskId" value={id} />
              <SubmitButton className="btn w-full rounded-xl bg-emerald-600 py-2.5 text-xs text-white hover:bg-emerald-700" pending="打卡中…">
                ✅ 打卡完成
              </SubmitButton>
            </form>
          )}
          {task.status === "已完成" && (
            <Link href="/worker?tab=done" className="btn btn-primary flex-1 text-center text-xs">
              返回任务列表
            </Link>
          )}
        </div>
      </div>
    </MiniShell>
  );
}
