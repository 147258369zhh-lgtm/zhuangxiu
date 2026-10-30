import { computeBom, getProject, yuan } from "@/lib/self";

/** 自装材料清单导出：CSV（带 BOM 头，Excel 中文不乱码） */
export async function GET() {
  const p = getProject();
  const bom = computeBom(p.id);

  const head = [
    "材料名称", "规格型号", "数量", "单位", "单价(元)", "损耗%", "金额(元)", "状态", "用量说明",
  ];
  const lines = [head.join(",")];
  for (const r of bom.rows) {
    lines.push(
      [
        r.name,
        r.spec ?? "",
        r.qty,
        r.unit,
        (r.unitPriceCents / 100).toFixed(2),
        (r.lossBp / 100).toFixed(1),
        (r.amountCents / 100).toFixed(2),
        r.status,
        r.breakdown,
      ]
        .map((v) => {
          const s = String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    );
  }
  lines.push(`合计,,,,,,${(bom.totalCents / 100).toFixed(2)},,`);
  lines.push("");
  lines.push(`项目,${p.name},房屋,${p.property_name},面积,${p.area_sqm}㎡,点位数,${bom.count}`);
  lines.push(`导出时间,${new Date().toLocaleString("zh-CN")},合计约,¥${yuan(bom.totalCents)}`);

  const csv = "\uFEFF" + lines.join("\r\n");
  const filename = encodeURIComponent(`${p.name}-材料清单.csv`);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
    },
  });
}
