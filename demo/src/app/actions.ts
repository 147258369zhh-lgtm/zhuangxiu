"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveUpload } from "@/lib/upload";
import {
  addLog,
  addMessage,
  addSelfPoint,
  addTaskPhoto,
  arriveMaterial,
  confirmAccept,
  createAccept,
  createChange,
  createMaterial,
  createPayment,
  createSite,
  createTask,
  createWarranty,
  decideChange,
  getSite,
  getSiteByCode,
  getTask,
  getTaskPhotos,
  getTaskPoints,
  POINT_TYPES,
  receivePayment,
  removeSelfPoint,
  setStepStatus,
  setTaskPointStatus,
  setTaskStatus,
  toggleTaskLive,
  updateSite,
  updateStepBudget,
  STEP_STATUS,
  WORKER_NAME,
} from "@/lib/data";

function refresh(siteId: string, code?: string) {
  revalidatePath("/");
  revalidatePath("/caiwu");
  revalidatePath("/zhijian");
  revalidatePath(`/gongdi/${siteId}`);
  if (code) revalidatePath(`/c/${code}`);
}

export async function createSiteAction(fd: FormData) {
  const name = String(fd.get("name") || "").trim();
  if (!name) return;
  const siteId = createSite({
    name,
    community: String(fd.get("community") || ""),
    owner: String(fd.get("owner") || ""),
    layout: String(fd.get("layout") || ""),
    foreman: String(fd.get("foreman") || ""),
    budget: Number(fd.get("budget") || 0),
    template: String(fd.get("template") || "全屋翻新"),
  });
  revalidatePath("/");
  redirect(`/gongdi/${siteId}`);
}

export async function advanceStepAction(fd: FormData) {
  const stepId = String(fd.get("stepId") || "");
  const siteId = String(fd.get("siteId") || "");
  const current = String(fd.get("current") || "");
  const idx = STEP_STATUS.indexOf(current as (typeof STEP_STATUS)[number]);
  if (idx < 0) return;
  setStepStatus(stepId, STEP_STATUS[(idx + 1) % STEP_STATUS.length]);
  const site = getSite(siteId);
  refresh(siteId, site?.code);
}

export async function updateStepBudgetAction(fd: FormData) {
  const stepId = String(fd.get("stepId") || "");
  const siteId = String(fd.get("siteId") || "");
  if (!stepId) return;
  const planned = Number(fd.get("planned") || 0);
  const actual = Number(fd.get("actual") || 0);
  updateStepBudget(stepId, planned, actual);
  const site = getSite(siteId);
  refresh(siteId, site?.code);
}

export async function addLogAction(fd: FormData) {
  const siteId = String(fd.get("siteId") || "");
  const content = String(fd.get("content") || "").trim();
  if (!siteId || !content) return;
  const author = String(fd.get("author") || "工长");
  const stepName = String(fd.get("stepName") || "");
  const photo = await saveUpload(fd.get("photo") as File | null);
  addLog(siteId, author, stepName, content, photo);
  const site = getSite(siteId);
  refresh(siteId, site?.code);
}

export async function confirmAcceptAction(fd: FormData) {
  const acceptId = String(fd.get("acceptId") || "");
  const code = String(fd.get("code") || "");
  const site = getSiteByCode(code);
  if (!site || !acceptId) return;
  const comment = String(fd.get("comment") || "").trim() || null;
  const photo = await saveUpload(fd.get("photo") as File | null);
  confirmAccept(acceptId, site.owner_name || "业主", comment, photo);
  refresh(site.id, site.code);
}

export async function createChangeAction(fd: FormData) {
  const siteId = String(fd.get("siteId") || "");
  const title = String(fd.get("title") || "").trim();
  if (!siteId || !title) return;
  createChange(siteId, title, String(fd.get("reason") || ""), Number(fd.get("amount") || 0));
  const site = getSite(siteId);
  refresh(siteId, site?.code);
}

export async function decideChangeAction(fd: FormData) {
  const id = String(fd.get("changeId") || "");
  const code = String(fd.get("code") || "");
  const site = getSiteByCode(code);
  if (!site || !id) return;
  const decision = String(fd.get("decision")) === "已确认" ? "已确认" : "已拒绝";
  const comment = String(fd.get("comment") || "").trim() || null;
  decideChange(id, decision, site.owner_name || "业主", comment);
  refresh(site.id, site.code);
}

/* ---------- 付款 ---------- */

export async function receivePaymentAction(fd: FormData) {
  const paymentId = String(fd.get("paymentId") || "");
  const siteId = String(fd.get("siteId") || "");
  if (!paymentId || !siteId) return;
  receivePayment(paymentId);
  const site = getSite(siteId);
  refresh(siteId, site?.code);
}

export async function createPaymentAction(fd: FormData) {
  const siteId = String(fd.get("siteId") || "");
  const title = String(fd.get("title") || "").trim();
  if (!siteId || !title) return;
  createPayment(siteId, title, Number(fd.get("amount") || 0), String(fd.get("note") || "").trim());
  const site = getSite(siteId);
  refresh(siteId, site?.code);
}

/* ---------- 保修 ---------- */

export async function createWarrantyAction(fd: FormData) {
  const siteId = String(fd.get("siteId") || "");
  const item = String(fd.get("item") || "").trim();
  if (!siteId || !item) return;
  createWarranty(siteId, item, Number(fd.get("months") || 12), String(fd.get("note") || "").trim() || null);
  const site = getSite(siteId);
  refresh(siteId, site?.code);
}

/* ---------- 材料 ---------- */

export async function createMaterialAction(fd: FormData) {
  const siteId = String(fd.get("siteId") || "");
  const name = String(fd.get("name") || "").trim();
  if (!siteId || !name) return;
  createMaterial(siteId, name, String(fd.get("spec") || "").trim(), String(fd.get("qty") || "").trim());
  const site = getSite(siteId);
  refresh(siteId, site?.code);
}

export async function arriveMaterialAction(fd: FormData) {
  const materialId = String(fd.get("materialId") || "");
  const siteId = String(fd.get("siteId") || "");
  if (!materialId || !siteId) return;
  arriveMaterial(materialId);
  const site = getSite(siteId);
  refresh(siteId, site?.code);
}

/* ---------- 验收项 ---------- */

export async function createAcceptAction(fd: FormData) {
  const siteId = String(fd.get("siteId") || "");
  const stepName = String(fd.get("stepName") || "").trim();
  const item = String(fd.get("item") || "").trim();
  if (!siteId || !stepName || !item) return;
  createAccept(siteId, stepName, item);
  const site = getSite(siteId);
  refresh(siteId, site?.code);
}

/* ---------- 编辑工地 ---------- */

export async function updateSiteAction(fd: FormData) {
  const siteId = String(fd.get("siteId") || "");
  const name = String(fd.get("name") || "").trim();
  if (!siteId || !name) return;
  updateSite(siteId, {
    name,
    community: String(fd.get("community") || ""),
    owner: String(fd.get("owner") || ""),
    layout: String(fd.get("layout") || ""),
    foreman: String(fd.get("foreman") || ""),
    budget: Number(fd.get("budget") || 0),
  });
  refresh(siteId);
}

/* ---------- 留言板 ---------- */

export async function sendStaffMessageAction(fd: FormData) {
  const siteId = String(fd.get("siteId") || "");
  const content = String(fd.get("content") || "").trim();
  if (!siteId || !content) return;
  const author = String(fd.get("author") || "工长");
  addMessage(siteId, "工长", author, content);
  const site = getSite(siteId);
  refresh(siteId, site?.code);
}

export async function sendOwnerMessageAction(fd: FormData) {
  const code = String(fd.get("code") || "");
  const content = String(fd.get("content") || "").trim();
  const site = getSiteByCode(code);
  if (!site || !content) return;
  addMessage(site.id, "业主", site.owner_name || "业主", content);
  refresh(site.id, site.code);
}

/* ---------- 安装任务（工长派发 / 工人执行 / 直播） ---------- */

function refreshTask(siteId: string) {
  revalidatePath("/");
  revalidatePath("/worker");
  revalidatePath(`/gongdi/${siteId}`);
}

/** 工长派任务（B 端工地详情 · 施工 tab） */
export async function createTaskAction(fd: FormData) {
  const siteId = String(fd.get("siteId") || "");
  const title = String(fd.get("title") || "").trim();
  if (!siteId || !title) return;
  createTask(siteId, {
    title,
    room: String(fd.get("room") || "").trim() || "未指定",
    stepName: String(fd.get("stepName") || "").trim() || "",
    worker: String(fd.get("worker") || "").trim() || WORKER_NAME,
    note: String(fd.get("note") || "").trim(),
  });
  refreshTask(siteId);
}

/** 工人现场拍照（模拟上传）：生成分类照片入库，可绑定到具体点位 */
export async function addTaskPhotoAction(fd: FormData) {
  const taskId = String(fd.get("taskId") || "");
  const category = String(fd.get("category") || "") as "before" | "material" | "after";
  const pointId = String(fd.get("pointId") || "") || null;
  if (!taskId || !["before", "material", "after"].includes(category)) return;
  const task = getTask(taskId);
  if (!task || task.status === "已完成") return;
  const point = pointId ? getTaskPoints(taskId).find((p) => p.id === pointId) : null;
  const where = point ? `${point.name}` : `${task.room ?? ""}`;
  const sub =
    category === "before" ? `${where}原始现场 · 打卡定位`
    : category === "material" ? `${where}材料核对 · 与清单一致`
    : `${where}安装完成 · 待验收`;
  addTaskPhoto(taskId, category, task.title, sub, pointId);
  refreshTask(task.site_id);
}

/** 点位完成打卡 / 撤销（点位级进度，工人自检） */
export async function toggleTaskPointAction(fd: FormData) {
  const taskId = String(fd.get("taskId") || "");
  const pointId = String(fd.get("pointId") || "");
  const to = String(fd.get("to") || "") as "未施工" | "已完成";
  if (!taskId || !pointId || !["未施工", "已完成"].includes(to)) return;
  const task = getTask(taskId);
  if (!task) return;
  setTaskPointStatus(pointId, to);
  refreshTask(task.site_id);
}

/** 工人开工（待施工 → 施工中） */
export async function startTaskAction(fd: FormData) {
  const taskId = String(fd.get("taskId") || "");
  if (!taskId) return;
  const task = getTask(taskId);
  if (!task || task.status !== "待施工") return;
  setTaskStatus(taskId, "施工中");
  refreshTask(task.site_id);
}

/** 工人打卡完成（施工中 → 已完成）：照片已同步工长/监理/业主 */
export async function finishTaskAction(fd: FormData) {
  const taskId = String(fd.get("taskId") || "");
  if (!taskId) return;
  const task = getTask(taskId);
  if (!task || task.status !== "施工中") return;
  // 完成前自动补一张施工后照（若一张都没拍，保证照片流不空）
  const hasAfter = getTaskPhotos(taskId).some((p) => p.category === "after");
  if (!hasAfter) {
    addTaskPhoto(taskId, "after", task.title, `${task.room ?? ""}安装完成 · 自动打卡照`);
  }
  setTaskStatus(taskId, "已完成");
  if (task.live) toggleTaskLive(taskId); // 下播
  refreshTask(task.site_id);
}

/** 开/关直播（小程序 live-pusher 占位） */
export async function toggleLiveAction(fd: FormData) {
  const taskId = String(fd.get("taskId") || "");
  if (!taskId) return;
  const task = getTask(taskId);
  if (!task) return;
  toggleTaskLive(taskId);
  refreshTask(task.site_id);
}

/* ---------- 自装线：点位设计（桌面客户端场景） ---------- */

/** 添加点位 */
export async function addSelfPointAction(fd: FormData) {
  const roomId = String(fd.get("roomId") || "");
  const type = String(fd.get("type") || "");
  if (!roomId || !POINT_TYPES.includes(type as (typeof POINT_TYPES)[number])) return;
  addSelfPoint(roomId, type, String(fd.get("label") || "").trim());
  revalidatePath("/self");
}

/** 删除点位 */
export async function removeSelfPointAction(fd: FormData) {
  const pointId = String(fd.get("pointId") || "");
  if (!pointId) return;
  removeSelfPoint(pointId);
  revalidatePath("/self");
}
