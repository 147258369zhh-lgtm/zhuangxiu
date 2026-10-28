import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const safe = file.replace(/[^a-zA-Z0-9_.-]/g, "");
  try {
    const buf = await readFile(join(process.cwd(), ".data", "uploads", safe));
    const ext = safe.split(".").pop()?.toLowerCase() ?? "";
    const mime =
      ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": mime, "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
