import { cookies } from "next/headers";

export type Role = "boss" | "foreman" | "supervisor";

export const ROLES: { key: Role; label: string; desc: string }[] = [
  { key: "boss", label: "老板", desc: "合同、收款、增项、经营全局" },
  { key: "foreman", label: "工长", desc: "工序推进、材料、日志、沟通" },
  { key: "supervisor", label: "监理", desc: "验收清单、质检记录" },
];

export const ROLE_LABEL: Record<Role, string> = { boss: "老板", foreman: "工长", supervisor: "监理" };

/** 演示无登录：角色存 cookie，默认老板 */
export async function getRole(): Promise<Role> {
  const jar = await cookies();
  const v = jar.get("zx-role")?.value;
  return v === "foreman" || v === "supervisor" ? v : "boss";
}
