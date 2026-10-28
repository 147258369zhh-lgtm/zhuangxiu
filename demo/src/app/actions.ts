"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  addLog,
  confirmAccept,
  createSite,
  getSite,
  getSiteByCode,
  setStepStatus,
  STEP_STATUS,
} from "@/lib/data";

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
  const next = STEP_STATUS[(idx + 1) % STEP_STATUS.length];
  setStepStatus(stepId, next);
  revalidatePath(`/gongdi/${siteId}`);
  revalidatePath("/");
}

export async function addLogAction(fd: FormData) {
  const siteId = String(fd.get("siteId") || "");
  const content = String(fd.get("content") || "").trim();
  if (!siteId || !content) return;
  const author = String(fd.get("author") || "工长");
  const stepName = String(fd.get("stepName") || "");
  addLog(siteId, author, stepName, content);
  const site = getSite(siteId);
  if (site) revalidatePath(`/c/${site.code}`);
  revalidatePath(`/gongdi/${siteId}`);
}

export async function confirmAcceptAction(fd: FormData) {
  const acceptId = String(fd.get("acceptId") || "");
  const code = String(fd.get("code") || "");
  const site = getSiteByCode(code);
  if (!site || !acceptId) return;
  const comment = String(fd.get("comment") || "").trim() || null;
  let photo: string | null = null;
  const f = fd.get("photo");
  if (f instanceof File && f.size > 0) {
    const ext =
      (f.name.split(".").pop() ?? "jpg").replace(/[^a-zA-Z0-9]/g, "").slice(0, 5) || "jpg";
    const name = `${randomUUID()}.${ext}`;
    const dir = join(process.cwd(), ".data", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, name), Buffer.from(await f.arrayBuffer()));
    photo = name;
  }
  confirmAccept(acceptId, site.owner_name || "业主", comment, photo);
  revalidatePath(`/c/${site.code}`);
  revalidatePath(`/gongdi/${site.id}`);
}
