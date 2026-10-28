"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveUpload } from "@/lib/upload";
import {
  addLog,
  confirmAccept,
  createChange,
  createSite,
  decideChange,
  getSite,
  getSiteByCode,
  setStepStatus,
  updateStepBudget,
  STEP_STATUS,
} from "@/lib/data";

function refresh(siteId: string, code?: string) {
  revalidatePath("/");
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
