import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

/** 把上传的图片写入 .data/uploads，返回文件名（或 null） */
export async function saveUpload(file: File | null): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  const ext =
    (file.name.split(".").pop() ?? "jpg").replace(/[^a-zA-Z0-9]/g, "").slice(0, 5) || "jpg";
  const name = `${randomUUID()}.${ext}`;
  const dir = join(process.cwd(), ".data", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), Buffer.from(await file.arrayBuffer()));
  return name;
}
