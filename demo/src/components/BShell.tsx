import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole, ROLES, ROLE_LABEL, DESKTOP_ROLES } from "@/lib/role";
import { countPendingAccepts, countPendingPayments } from "@/lib/data";

/** 导航分门别类：日常作业 / 平台能力 */
const NAV_GROUPS = [
  {
    label: "日常",
    items: [
      { href: "/", label: "工地总览", icon: "🏗️", roles: ["boss", "foreman", "supervisor"], badge: "" },
      { href: "/zhijian", label: "质检验收", icon: "✅", roles: ["boss", "supervisor"], badge: "accs" },
      { href: "/caiwu", label: "财务收款", icon: "💰", roles: ["boss"], badge: "pays" },
    ],
  },
  {
    label: "平台",
    items: [
      { href: "/roles", label: "产品架构", icon: "🧭", roles: ["boss", "foreman", "supervisor"], badge: "" },
      { href: "/self", label: "自装工作台", icon: "🎨", roles: ["boss", "foreman", "supervisor"], badge: "" },
    ],
  },
];

/** B端后台外壳：侧栏（分组导航） + 顶栏（角色切换 + 工人端入口） */
export default async function BShell({
  active,
  children,
}: {
  active: string;
  children: React.ReactNode;
}) {
  const role = await getRole();
  // 工人是移动端小程序角色，误入桌面后台直接跳回工人端
  if (role === "worker") redirect("/worker");
  const pendingPays = countPendingPayments();
  const pendingAccs = countPendingAccepts();
  const badgeOf = (k: string) => (k === "pays" ? pendingPays : k === "accs" ? pendingAccs : 0);

  return (
    <div className="lg:flex">
      {/* 侧栏（PC） */}
      <aside className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col border-r border-zinc-200 bg-white lg:flex">
        <Link href="/" className="flex items-center gap-2.5 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-base shadow-sm shadow-indigo-200">🏠</div>
          <div>
            <div className="text-sm font-semibold">装修管理平台</div>
            <div className="text-[10px] text-zinc-400">演示装饰公司 · B端</div>
          </div>
        </Link>
        <nav className="mt-1 flex-1 space-y-4 px-3">
          {NAV_GROUPS.map((g) => {
            const items = g.items.filter((n) => n.roles.includes(role));
            if (items.length === 0) return null;
            return (
              <div key={g.label}>
                <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-300">{g.label}</div>
                <div className="space-y-0.5">
                  {items.map((n) => {
                    const badge = badgeOf(n.badge);
                    const on = active === n.href;
                    return (
                      <Link
                        key={n.href}
                        href={n.href}
                        className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${
                          on ? "bg-indigo-50 font-semibold text-indigo-700" : "text-zinc-600 hover:bg-zinc-50"
                        }`}
                      >
                        <span>{n.icon}</span>
                        <span>{n.label}</span>
                        {badge > 0 && (
                          <span className="ml-auto rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">{badge}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="space-y-2 px-3 pb-4">
          {/* 工人端入口（小程序） */}
          <Link
            href="/role?to=worker&back=/worker"
            className="flex items-center gap-2.5 rounded-xl border border-dashed border-zinc-200 px-3 py-2 text-xs text-zinc-500 transition hover:border-indigo-300 hover:text-indigo-600"
          >
            <span>🔧</span>
            <span>工人端（小程序）</span>
            <span className="ml-auto text-[10px]">→</span>
          </Link>
          <div className="rounded-xl bg-zinc-50 p-3 text-[10px] leading-relaxed text-zinc-400">
            <b className="text-zinc-500">{ROLE_LABEL[role]}视角</b>
            <br />
            {ROLES.find((r) => r.key === role)?.desc}
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* 顶栏 */}
        <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-6 py-2.5">
            <div className="flex items-center gap-2 lg:hidden">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-sm">🏠</div>
              <span className="text-sm font-semibold">装修管理平台</span>
            </div>
            <div className="hidden text-xs text-zinc-400 lg:block">
              B端管理后台 · 当前视角：<b className="text-zinc-600">{ROLE_LABEL[role]}</b>
              <span className="ml-2 text-zinc-300">|</span>
              <span className="ml-2">演示装饰公司</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-xl bg-zinc-100 p-0.5">
                {DESKTOP_ROLES.map((r) => {
                  const info = ROLES.find((x) => x.key === r)!;
                  return (
                    <Link
                      key={r}
                      href={`/role?to=${r}&back=${encodeURIComponent(active)}`}
                      title={info.desc}
                      className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                        role === r ? "bg-white text-indigo-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                      }`}
                    >
                      {info.label}
                    </Link>
                  );
                })}
              </div>
              <Link
                href="/role?to=worker&back=/worker"
                className="rounded-xl bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-700"
              >
                🔧 工人端
              </Link>
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}

export { BShell };
