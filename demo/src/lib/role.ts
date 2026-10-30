import { cookies } from "next/headers";

export type Role = "boss" | "foreman" | "supervisor" | "worker";

export const ROLES: { key: Role; label: string; desc: string }[] = [
  { key: "boss", label: "老板", desc: "合同、收款、增项、经营全局" },
  { key: "foreman", label: "工长", desc: "工序推进、材料、派任务、日志" },
  { key: "supervisor", label: "监理", desc: "验收清单、质检记录" },
  { key: "worker", label: "工人", desc: "任务图纸、现场三类拍照、打卡直播" },
];

export const ROLE_LABEL: Record<Role, string> = {
  boss: "老板", foreman: "工长", supervisor: "监理", worker: "工人",
};

/** B 端后台桌面角色（工人走小程序式移动端，不进 BShell） */
export const DESKTOP_ROLES: Role[] = ["boss", "foreman", "supervisor"];

/** 演示无登录：角色存 cookie，默认老板 */
export async function getRole(): Promise<Role> {
  const jar = await cookies();
  const v = jar.get("zx-role")?.value;
  return v === "foreman" || v === "supervisor" || v === "worker" ? v : "boss";
}
