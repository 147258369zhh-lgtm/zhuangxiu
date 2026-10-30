"use server";

import { revalidatePath } from "next/cache";
import { saveUpload } from "@/lib/upload";
import {
  addFile, addPayment, getProject, logActivity, pushEvent, recordAcceptResult,
} from "@/lib/self";

/** 小程序端：只有 append，没有 update / delete 接口 —— 这是单向同步模型的地基 */

const num = (v: FormDataEntryValue | null, fallback = 0) => {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
};

function refresh() {
  revalidatePath("/m");
  revalidatePath("/self");
}

/** 勾选「已买」：不直接改库，先 append 事件，桌面接收后才生效 */
export async function mobileBoughtAction(fd: FormData) {
  const p = getProject();
  const materialId = String(fd.get("materialId") ?? "");
  if (!materialId) return;
  pushEvent(p.id, "material.bought", { material_id: materialId }, true);
  logActivity(p.id, "材料", "标记已购买（待桌面接收）", "miniapp");
  refresh();
}

export async function mobilePaymentAction(fd: FormData) {
  const p = getProject();
  const amount = num(fd.get("amount"));
  if (amount <= 0) return;
  addPayment({
    projectId: p.id,
    amountCents: Math.round(amount * 100),
    category: String(fd.get("category") ?? "其他"),
    note: String(fd.get("note") ?? "").trim() || null,
    source: "miniapp",
  });
  refresh();
}

export async function mobileAcceptAction(fd: FormData) {
  const p = getProject();
  recordAcceptResult({
    projectId: p.id,
    itemId: String(fd.get("itemId") ?? ""),
    acceptanceId: String(fd.get("acceptanceId") ?? ""),
    result: String(fd.get("result")) === "不合格" ? "不合格" : "合格",
    note: String(fd.get("note") ?? "").trim() || null,
    source: "miniapp",
  });
  refresh();
}

/** 拍照：文件进文件中心（files + file_versions + file_relations），事件进队列 */
export async function mobilePhotoAction(fd: FormData) {
  const p = getProject();
  const file = fd.get("photo");
  const saved = await saveUpload(file instanceof File ? file : null);
  const label = String(fd.get("label") ?? "").trim() || "现场照片";
  if (saved) {
    addFile({
      projectId: p.id,
      name: label,
      storageKey: saved,
      mime: file instanceof File ? file.type || "image/jpeg" : "image/jpeg",
      sizeBytes: file instanceof File ? file.size : 0,
      resourceType: "project",
      resourceId: p.id,
    });
  }
  pushEvent(p.id, "photo.added", { text: `${saved ? "上传" : "记录"}「${label}」` }, true);
  logActivity(p.id, "照片", `${saved ? "上传" : "记录"}「${label}」`, "miniapp");
  refresh();
}
