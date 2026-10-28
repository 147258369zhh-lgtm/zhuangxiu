/** 业主端加载骨架：渐变头 + 内容卡占位（形状预览比转圈感知更快） */
export default function Loading() {
  return (
    <div className="mx-auto max-w-md px-4 pb-28 pt-6">
      <div className="mb-4 h-28 animate-pulse rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card mb-4 p-4">
          <div className="h-3 w-24 animate-pulse rounded bg-zinc-100" style={{ animationDelay: `${i * 90}ms` }} />
          <div className="mt-3 h-2 w-full animate-pulse rounded-full bg-zinc-100" />
          <div className="mt-3 space-y-2">
            {[0, 1, 2].map((j) => (
              <div key={j} className="h-9 animate-pulse rounded-lg bg-zinc-50" style={{ animationDelay: `${i * 90 + j * 60}ms` }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
