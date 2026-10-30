"use server";

import { revalidatePath } from "next/cache";
import {
  addPayment, addPoint, applyPendingEvents, deletePoint, getProject,
  recordAcceptResult, upsertMaterialOverride,
} from "@/lib/self";

const num = (v: FormDataEntryValue | null, fallback = 0) => {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
};

function refresh() {
  revalidatePath("/self");
  revalidatePath("/m");
  revalidatePath("/m/list");
  revalidatePath("/m/money");
  revalidatePath("/m/accept");
}

export async function addPointAction(fd: FormData) {
  const p = getProject();
  addPoint({
    projectId: p.id,
    spaceId: String(fd.get("spaceId") ?? ""),
    type: String(fd.get("type") ?? "插座"),
    label: String(fd.get("label") ?? "").trim(),
    heightMm: fd.get("heightMm") ? num(fd.get("heightMm")) : null,
    spec: String(fd.get("spec") ?? "").trim() || null,
    note: null,
  });
  refresh();
}

export async function deletePointAction(fd: FormData) {
  const p = getProject();
  deletePoint(p.id, String(fd.get("pointId") ?? ""));
  refresh();
}

/** 单价/损耗/已买状态 —— 桌面端是唯一编辑入口 */
export async function updateMaterialAction(fd: FormData) {
  const p = getProject();
  const materialId = String(fd.get("materialId") ?? "");
  const patch: { unitPriceCents?: number; lossBp?: number; status?: string } = {};
  if (fd.get("unitPrice") != null && String(fd.get("unitPrice")) !== "")
    patch.unitPriceCents = Math.round(num(fd.get("unitPrice")) * 100);
  if (fd.get("lossPct") != null && String(fd.get("lossPct")) !== "")
    patch.lossBp = Math.round(num(fd.get("lossPct")) * 100);
  if (fd.get("status")) patch.status = String(fd.get("status"));
  upsertMaterialOverride(p.id, materialId, patch);
  refresh();
}

export async function addPaymentAction(fd: FormData) {
  const p = getProject();
  const yuanAmount = num(fd.get("amount"));
  if (yuanAmount <= 0) return;
  addPayment({
    projectId: p.id,
    amountCents: Math.round(yuanAmount * 100),
    category: String(fd.get("category") ?? "其他"),
    note: String(fd.get("note") ?? "").trim() || null,
    source: "desktop",
  });
  refresh();
}

export async function acceptResultAction(fd: FormData) {
  const p = getProject();
  recordAcceptResult({
    projectId: p.id,
    itemId: String(fd.get("itemId") ?? ""),
    acceptanceId: String(fd.get("acceptanceId") ?? ""),
    result: String(fd.get("result")) === "不合格" ? "不合格" : "合格",
    note: String(fd.get("note") ?? "").trim() || null,
    source: "desktop",
  });
  refresh();
}

/** 桌面端 pull 小程序追加的事件：apply 后标记已处理 */
export async function applyEventsAction() {
  const p = getProject();
  applyPendingEvents(p.id);
  refresh();
}
