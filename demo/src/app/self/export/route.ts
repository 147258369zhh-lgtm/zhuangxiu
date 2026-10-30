import { computeBom } from "@/lib/data";

/** 自装材料清单导出：CSV（带 BOM 头，Excel 中文不乱码） */
export async function GET() {
  const { rows, total } = computeBom();
  const lines = ["类型,材料名称,规格,数量,单位,单价(元),小计(元)"];
  for (const r of rows) {
    lines.push([r.type, r.name, r.spec, r.qty, r.unit, r.price, r.subtotal].join(","));
  }
  lines.push(`合计,,,,,,${total}`);
  const csv = "\uFEFF" + lines.join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("材料清单.csv")}`,
    },
  });
}
