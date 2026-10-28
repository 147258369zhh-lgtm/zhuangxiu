import Link from "next/link";
import { getRole, ROLES, ROLE_LABEL } from "@/lib/role";
import { countPendingAccepts, countPendingPayments } from "@/lib/data";

const NAV = [
  { href: "/", label: "工地总览", icon: "🏗️", roles: ["boss", "foreman", "supervisor"] },
  { href: "/caiwu", label: "财务收款", icon: "💰", roles: ["boss"] },
  { href: "/zhijian", label: "质检验收", icon: "✅", roles: ["boss", "supervisor"] },
] as const;

/** B端后台外壳：侧栏 + 顶栏（含角色切换） */
export default async function BShell({
  active,
  children,
}: {
  active: string;
  children: React.ReactNode;
}) {
  const role = await getRole();
  const pendingPays = countPendingPayments();
  const pendingAccs = countPendingAccepts();

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
        <nav className="mt-2 flex-1 space-y-1 px-3">
          {NAV.filter((n) => (n.roles as readonly string[]).includes(role)).map((n) => {
            const badge = n.href === "/caiwu" ? pendingPays : n.href === "/zhijian" ? pendingAccs : 0;
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
        </nav>
        <div className="px-3 pb-4">
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
          <div className="flex items-center justify-between px-6 py-2.5">
            <div className="flex items-center gap-2 lg:hidden">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-sm">🏠</div>
              <span className="text-sm font-semibold">装修管理平台</span>
            </div>
            <div className="hidden text-xs text-zinc-400 lg:block">
              B端管理后台 · 当前视角：<b className="text-zinc-600">{ROLE_LABEL[role]}</b>
              <span className="ml-2 text-zinc-300">|</span>
              <span className="ml-2">演示装饰公司</span>
            </div>
            <div className="flex items-center rounded-xl bg-zinc-100 p-0.5">
              {ROLES.map((r) => (
                <Link
                  key={r.key}
                  href={`/role?to=${r.key}`}
                  title={r.desc}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                    role === r.key ? "bg-white text-indigo-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  {r.label}
                </Link>
              ))}
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}

export { BShell };
