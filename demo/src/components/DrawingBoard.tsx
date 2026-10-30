"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { addTaskPhotoAction, toggleTaskPointAction } from "@/app/actions";

export type BoardPoint = {
  id: string;
  seq: number;
  name: string;
  spec: string | null;
  x: number;
  y: number;
  status: string;
};

export type BoardPhoto = {
  id: string;
  point_id: string | null;
  category: string;
  url: string;
};

const CATS = [
  { key: "before", label: "施工前", icon: "📷", tone: "bg-zinc-50 text-zinc-600 ring-zinc-200" },
  { key: "material", label: "材料", icon: "📦", tone: "bg-blue-50 text-blue-600 ring-blue-200" },
  { key: "after", label: "施工后", icon: "✨", tone: "bg-emerald-50 text-emerald-600 ring-emerald-200" },
] as const;

/**
 * 点位对照板：图纸 + 可点击点位圆点 + 选中点位的要求/照片/拍照上传。
 * 工人现场按编号施工，点一下就知道「这个点位要什么标准、拍到哪一步了」。
 */
export function DrawingBoard({
  plan,
  points,
  photos,
  taskId,
  editable,
}: {
  plan: string;
  points: BoardPoint[];
  photos: BoardPhoto[];
  taskId: string;
  editable: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const done = points.filter((p) => p.status === "已完成").length;
  const selected = points.find((p) => p.id === selectedId) ?? null;
  const selectedPhotos = selected ? photos.filter((p) => p.point_id === selected.id) : [];

  return (
    <div className="card mb-3 overflow-hidden p-0">
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="text-xs font-semibold">📐 点位对照图</div>
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
          点位完成 {done}/{points.length}
        </span>
      </div>

      {/* 图纸 + 点位热区 */}
      <div className="relative mt-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={plan} alt="点位图纸" className="block w-full" />
        {points.map((p) => {
          const isDone = p.status === "已完成";
          const on = selectedId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedId(on ? null : p.id)}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              title={p.name}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full text-[10px] font-bold leading-none shadow-sm ring-2 transition ${
                on
                  ? "h-8 w-8 ring-indigo-500/40 ring-4 bg-indigo-600 text-white scale-110"
                  : isDone
                    ? "h-6 w-6 bg-emerald-500 text-white ring-white"
                    : "h-6 w-6 bg-white text-zinc-500 ring-indigo-200 hover:ring-indigo-400"
              }`}
            >
              {isDone && !on ? "✓" : p.seq}
            </button>
          );
        })}
      </div>

      {/* 图例 */}
      <div className="flex items-center gap-3 px-4 py-2 text-[10px] text-zinc-400">
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-emerald-500" />已施工</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-white ring-1 ring-indigo-300" />未施工</span>
        <span className="ml-auto">点编号查看要求</span>
      </div>

      {/* 选中点位详情 */}
      {selected ? (
        <div className="border-t border-zinc-100 bg-zinc-50/60 px-4 py-3">
          <div className="flex items-start gap-2">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                selected.status === "已完成" ? "bg-emerald-500" : "bg-indigo-600"
              }`}
            >
              {selected.seq}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-zinc-800">{selected.name}</div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{selected.spec}</div>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
                selected.status === "已完成"
                  ? "bg-emerald-50 text-emerald-600 ring-emerald-200"
                  : "bg-amber-50 text-amber-600 ring-amber-200"
              }`}
            >
              {selected.status}
            </span>
          </div>

          {/* 该点位已拍照片 */}
          {selectedPhotos.length > 0 ? (
            <div className="mt-2.5 grid grid-cols-3 gap-1.5">
              {selectedPhotos.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.id} src={p.url} alt="点位照片" className="h-16 w-full rounded-lg object-cover ring-1 ring-zinc-200" />
              ))}
            </div>
          ) : (
            <div className="mt-2.5 rounded-lg bg-white px-3 py-2 text-[10px] text-zinc-400 ring-1 ring-inset ring-zinc-100">
              该点位还没有照片，施工前后各拍一张留档。
            </div>
          )}

          {/* 该点位拍照 / 完成打卡 */}
          {editable && (
            <div className="mt-2.5">
              <div className="grid grid-cols-3 gap-1.5">
                {CATS.map((c) => (
                  <form key={c.key} action={addTaskPhotoAction}>
                    <input type="hidden" name="taskId" value={taskId} />
                    <input type="hidden" name="pointId" value={selected.id} />
                    <input type="hidden" name="category" value={c.key} />
                    <SubmitButton
                      className={`btn w-full flex-col gap-0.5 rounded-lg py-2 text-[10px] font-medium ring-1 ring-inset ${c.tone}`}
                      pending="…"
                    >
                      <span className="text-sm">{c.icon}</span>
                      {c.label}
                    </SubmitButton>
                  </form>
                ))}
              </div>
              <form action={toggleTaskPointAction} className="mt-2">
                <input type="hidden" name="taskId" value={taskId} />
                <input type="hidden" name="pointId" value={selected.id} />
                <input type="hidden" name="to" value={selected.status === "已完成" ? "未施工" : "已完成"} />
                <SubmitButton
                  className={`btn w-full rounded-lg py-2 text-[11px] font-semibold ${
                    selected.status === "已完成"
                      ? "bg-white text-zinc-500 ring-1 ring-inset ring-zinc-200"
                      : "bg-indigo-600 text-white"
                  }`}
                  pending="…"
                >
                  {selected.status === "已完成" ? "↩ 撤销该点位完成" : "✓ 标记该点位已完成"}
                </SubmitButton>
              </form>
            </div>
          )}
        </div>
      ) : (
        <div className="border-t border-zinc-100 bg-zinc-50/60 px-4 py-2.5 text-[11px] text-zinc-400">
          点图纸上的编号，查看该点位的施工标准、照片与打卡。
        </div>
      )}
    </div>
  );
}
