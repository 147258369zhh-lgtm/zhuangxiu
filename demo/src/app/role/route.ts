import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import type { Role } from "@/lib/role";

/** GET 式角色切换（幂等）：/role?to=foreman&back=/ —— 浏览器重放也无副作用差异 */
export async function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get("to") ?? "";
  const back = req.nextUrl.searchParams.get("back") || "/";
  if (["boss", "foreman", "supervisor", "worker"].includes(to)) {
    (await cookies()).set("zx-role", to, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
  redirect(back);
}
