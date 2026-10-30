import Link from "next/link";

export type MiniTab = { key: string; href: string; label: string; icon: string; badge?: number };

/**
 * 小程序式移动外壳（工人端/业主端共用规格）：
 * 手机状态栏模拟 + 顶部标题胶囊 + 底部 tab 栏 —— 一眼即知"这是小程序端"
 */
export default function MiniShell({
  title,
  tabs,
  active,
  children,
}: {
  title: string;
  tabs: MiniTab[];
  active: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto min-h-screen max-w-md bg-zinc-50">
      {/* 手机状态栏模拟 */}
      <div className="flex items-center justify-between bg-white px-5 pt-1.5 text-[10px] text-zinc-700">
        <span className="font-semibold">9:41</span>
        <span className="tracking-tight text-zinc-400">●●●●● 📶 🔋</span>
      </div>
      {/* 顶部标题（小程序式胶囊装饰） */}
      <header className="sticky top-0 z-20 border-b border-zinc-100 bg-white/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="w-16" />
          <div className="text-sm font-semibold text-zinc-800">{title}</div>
          <div className="flex w-16 items-center justify-end gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-[10px] text-zinc-500">
            <span>⋯</span>
            <span className="h-2 w-px bg-zinc-300" />
            <span>⊙</span>
          </div>
        </div>
      </header>
      <main className="px-4 pb-28 pt-3">{children}</main>
      {/* 底部 tab 栏 */}
      <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
          {tabs.map((t) => {
            const on = active === t.key;
            return (
              <Link
                key={t.key}
                href={t.href}
                className={`relative flex flex-col items-center gap-0.5 py-2 text-[10px] transition ${
                  on ? "font-semibold text-indigo-600" : "text-zinc-400"
                }`}
              >
                <span className="text-base leading-none">{t.icon}</span>
                <span>{t.label}</span>
                {(t.badge ?? 0) > 0 && (
                  <span className="absolute right-1/2 top-1 translate-x-4 rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
                    {t.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export { MiniShell };
