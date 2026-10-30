import { randomUUID } from "node:crypto";
import { db, seedIfEmpty } from "./self-db";

/** 每次取数前确保库与种子就绪（幂等，代价是一条 COUNT） */
function ready() {
  seedIfEmpty();
}

const now = () => new Date().toISOString();
const all = <T>(sql: string, ...p: (string | number | null)[]) => db.prepare(sql).all(...p) as T[];
const get = <T>(sql: string, ...p: (string | number | null)[]) => db.prepare(sql).get(...p) as T | undefined;

export type Project = {
  id: string; name: string; template: string; status: string;
  start_date: string | null; planned_end: string | null;
  property_name: string; address: string | null; area_sqm: number; layout: string | null;
};

export function getProject(): Project {
  ready();
  const row = get<Project>(
    `SELECT p.id,p.name,p.template,p.status,p.start_date,p.planned_end,
            pr.name AS property_name,pr.address,pr.area_sqm,pr.layout
       FROM projects p JOIN properties pr ON pr.id=p.property_id
      ORDER BY p.created_at LIMIT 1`
  );
  if (!row) throw new Error("no project");
  return row;
}

/* ---------------- 空间与点位 ---------------- */

export type Space = { id: string; name: string; area_sqm: number; sort: number };
export type Point = {
  id: string; space_id: string; type: string; label: string | null;
  height_mm: number | null; spec: string | null; note: string | null; sort: number;
};

export const POINT_TYPES = ["插座", "开关", "灯具", "水口", "网口"] as const;
export type PointType = (typeof POINT_TYPES)[number];

export function listSpaces(projectId: string): Space[] {
  ready();
  return all<Space>(
    "SELECT id,name,area_sqm,sort FROM project_spaces WHERE project_id=? ORDER BY sort",
    projectId
  );
}

export function listPoints(projectId: string): Point[] {
  ready();
  return all<Point>(
    `SELECT id,space_id,type,label,height_mm,spec,note,sort
       FROM project_space_points WHERE project_id=? ORDER BY sort`,
    projectId
  );
}

export function addPoint(input: {
  projectId: string; spaceId: string; type: string;
  label: string; heightMm: number | null; spec: string | null; note: string | null;
}) {
  ready();
  const max = get<{ n: number }>(
    "SELECT COALESCE(MAX(sort),0) AS n FROM project_space_points WHERE project_id=?",
    input.projectId
  )?.n ?? 0;
  db.prepare(
    `INSERT INTO project_space_points (id,project_id,space_id,type,label,height_mm,spec,note,sort,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(randomUUID(), input.projectId, input.spaceId, input.type,
        input.label || null, input.heightMm, input.spec, input.note, max + 1, now());
}

/** 编辑权在桌面端：这里是唯一允许删除点位的入口 */
export function deletePoint(projectId: string, pointId: string) {
  ready();
  db.prepare("DELETE FROM project_space_points WHERE project_id=? AND id=?").run(projectId, pointId);
}

/* ---------------- BOM 汇总 ---------------- */

type Rule = { type: PointType; materialId: string; per: number; why: string };

/** 主材：每个点位一件 */
const MAIN_RULES: Rule[] = [
  { type: "插座", materialId: "m_socket", per: 1, why: "插座点位 1 个" },
  { type: "开关", materialId: "m_switch", per: 1, why: "开关点位 1 个" },
  { type: "灯具", materialId: "m_light", per: 1, why: "灯具点位 1 个" },
  { type: "水口", materialId: "m_ppr", per: 1, why: "水口点位 1 个弯头" },
  { type: "网口", materialId: "m_net", per: 1, why: "网口点位 1 个" },
];

export type BomRow = {
  materialId: string; name: string; spec: string | null; unit: string;
  qtyMilli: number; qty: number; unitPriceCents: number; lossBp: number;
  status: string; amountCents: number; breakdown: string; editable: boolean;
};

export type Bom = {
  rows: BomRow[]; totalCents: number; count: number; byType: Record<string, number>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
};

export function computeBom(projectId: string): Bom {
  ready();
  const points = listPoints(projectId);
  const byType: Record<string, number> = {};
  for (const p of points) byType[p.type] = (byType[p.type] ?? 0) + 1;

  // 数量（千分位）：主材按点位计；辅材按工程经验系数
  const qty: Record<string, { milli: number; why: string[] }> = {};
  const bump = (id: string, add: number, why: string) => {
    if (!qty[id]) qty[id] = { milli: 0, why: [] };
    qty[id].milli += Math.round(add * 1000);
    if (!qty[id].why.includes(why)) qty[id].why.push(why);
  };

  for (const r of MAIN_RULES) {
    const n = byType[r.type] ?? 0;
    if (n > 0) bump(r.materialId, n * r.per, r.why);
  }
  // 底盒：插座 + 开关 + 网口 各一个
  const boxes = (byType["插座"] ?? 0) + (byType["开关"] ?? 0) + (byType["网口"] ?? 0);
  if (boxes > 0) bump("m_box", boxes, "插座+开关+网口 各 1 个");
  // 电线：插座/开关 3.5m，灯具 4m（含两端余量）
  const wire =
    (byType["插座"] ?? 0) * 3.5 + (byType["开关"] ?? 0) * 3.5 + (byType["灯具"] ?? 0) * 4;
  if (wire > 0) bump("m_wire", wire, "插座/开关 3.5m + 灯具 4m");
  // PPR 管：每个水口 3m
  if ((byType["水口"] ?? 0) > 0) bump("m_pprpipe", (byType["水口"] ?? 0) * 3, "每个水口 3m");
  // 网线：每个网口 8m（含弱电箱到点位）
  if ((byType["网口"] ?? 0) > 0) bump("m_netline", (byType["网口"] ?? 0) * 8, "每个网口 8m");
  // 穿线管：按电线 1/2.5 折算
  if (wire > 0) bump("m_conduit", wire / 2.5, "电线 ÷ 2.5");

  const mats = all<{
    id: string; name: string; spec: string | null; unit: string; base_price_cents: number;
  }>("SELECT id,name,spec,unit,base_price_cents FROM materials");

  const overrides = all<{
    material_id: string; unit_price_cents: number; loss_rate_bp: number; status: string;
  }>("SELECT material_id,unit_price_cents,loss_rate_bp,status FROM project_materials WHERE project_id=?", projectId);
  const ov = new Map(overrides.map((o) => [o.material_id, o]));

  const rows: BomRow[] = [];
  for (const m of mats) {
    const q = qty[m.id];
    if (!q || q.milli <= 0) continue;
    const o = ov.get(m.id);
    const unitPriceCents = o?.unit_price_cents ?? m.base_price_cents;
    const lossBp = o?.loss_rate_bp ?? 500;
    const amountCents = Math.round((q.milli * unitPriceCents * (10000 + lossBp)) / 1000 / 10000);
    rows.push({
      materialId: m.id, name: m.name, spec: m.spec, unit: m.unit,
      qtyMilli: q.milli, qty: Math.round(q.milli / 10) / 100,
      unitPriceCents, lossBp, status: o?.status ?? "未买",
      amountCents, breakdown: q.why.join("；"), editable: true,
    });
  }
  rows.sort((a, b) => b.amountCents - a.amountCents);
  return { rows, totalCents: rows.reduce((s, r) => s + r.amountCents, 0), count: points.length, byType };
}

/** 用户改过的单价/损耗/已买状态写进 project_materials（不写死在代码里） */
export function upsertMaterialOverride(
  projectId: string,
  materialId: string,
  patch: { unitPriceCents?: number; lossBp?: number; status?: string; qtyMilli?: number }
) {
  ready();
  const cur = get<{ unit_price_cents: number; loss_rate_bp: number; status: string; qty_milli: number }>(
    "SELECT unit_price_cents,loss_rate_bp,status,qty_milli FROM project_materials WHERE project_id=? AND material_id=?",
    projectId, materialId
  );
  const price = patch.unitPriceCents ?? cur?.unit_price_cents ?? 0;
  const loss = patch.lossBp ?? cur?.loss_rate_bp ?? 500;
  const status = patch.status ?? cur?.status ?? "未买";
  const q = patch.qtyMilli ?? cur?.qty_milli ?? 0;
  if (cur) {
    db.prepare(
      "UPDATE project_materials SET unit_price_cents=?,loss_rate_bp=?,status=?,qty_milli=?,updated_at=? WHERE project_id=? AND material_id=?"
    ).run(price, loss, status, q, now(), projectId, materialId);
  } else {
    db.prepare(
      `INSERT INTO project_materials (id,project_id,material_id,qty_milli,unit_price_cents,loss_rate_bp,status,note,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).run(randomUUID(), projectId, materialId, q, price, loss, status, null, now());
  }
}

/* ---------------- 预算与开销 ---------------- */

export type BudgetItem = {
  id: string; category: string; name: string; amount_cents: number; sort: number;
};

export function getBudget(projectId: string) {
  ready();
  const bv = get<{ id: string; version_no: number; total_cents: number; note: string | null; created_at: string }>(
    `SELECT v.id,v.version_no,v.total_cents,v.note,v.created_at
       FROM budget_versions v JOIN budgets b ON b.id=v.budget_id
      WHERE v.project_id=? ORDER BY v.version_no DESC LIMIT 1`,
    projectId
  );
  if (!bv) return null;
  const items = all<BudgetItem>(
    "SELECT id,category,name,amount_cents,sort FROM budget_items WHERE project_id=? AND budget_version_id=? ORDER BY sort",
    projectId, bv.id
  );
  const spent = all<{ category: string; s: number }>(
    "SELECT category,COALESCE(SUM(amount_cents),0) AS s FROM payment_records WHERE project_id=? AND direction='out' GROUP BY category",
    projectId
  );
  const spentMap = new Map(spent.map((x) => [x.category, x.s]));
  return { version: bv, items, spentMap };
}

export type Payment = {
  id: string; amount_cents: number; category: string; note: string | null;
  occurred_at: string; source: string; direction: string;
};

export function listPayments(projectId: string): Payment[] {
  ready();
  return all<Payment>(
    `SELECT id,amount_cents,category,note,occurred_at,source,direction
       FROM payment_records WHERE project_id=? ORDER BY occurred_at DESC`,
    projectId
  );
}

export function addPayment(input: {
  projectId: string; amountCents: number; category: string;
  note: string | null; source: "desktop" | "miniapp";
}) {
  ready();
  const t = now();
  db.prepare(
    `INSERT INTO payment_records (id,project_id,direction,amount_cents,category,note,evidence_file_id,occurred_at,created_at,source,reversal_of_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(randomUUID(), input.projectId, "out", input.amountCents, input.category, input.note, null, t, t, input.source, null);
  pushEvent(input.projectId, "expense.added", {
    category: input.category, amount_cents: input.amountCents,
  }, input.source === "miniapp");
  logActivity(input.projectId, "开销", `记录 ${input.category} ¥${(input.amountCents / 100).toFixed(2)}`, input.source);
}

/* ---------------- 进度 ---------------- */

export type Stage = {
  id: string; name: string; sort: number; planned_days: number;
  planned_cents: number; actual_cents: number; status: string;
  started_at: string | null; finished_at: string | null;
};

export function listStages(projectId: string): Stage[] {
  ready();
  return all<Stage>(
    `SELECT id,name,sort,planned_days,planned_cents,actual_cents,status,started_at,finished_at
       FROM workflow_stages WHERE project_id=? ORDER BY sort`,
    projectId
  );
}

/* ---------------- 验收 ---------------- */

export type AcceptItem = { id: string; text: string; sort: number; latest: string | null; round: number | null; note: string | null };
export type Acceptance = { id: string; name: string; round: number; status: string; items: AcceptItem[] };

export function listAcceptances(projectId: string): Acceptance[] {
  ready();
  const heads = all<{ id: string; name: string; round: number; status: string }>(
    "SELECT id,name,round,status FROM acceptances WHERE project_id=? ORDER BY created_at",
    projectId
  );
  return heads.map((h) => {
    const items = all<AcceptItem>(
      `SELECT i.id,i.text,i.sort,
              (SELECT r.result FROM acceptance_item_results r
                WHERE r.item_id=i.id AND r.project_id=i.project_id
                ORDER BY r.round DESC LIMIT 1) AS latest,
              (SELECT r.round FROM acceptance_item_results r
                WHERE r.item_id=i.id AND r.project_id=i.project_id
                ORDER BY r.round DESC LIMIT 1) AS round,
              (SELECT r.note FROM acceptance_item_results r
                WHERE r.item_id=i.id AND r.project_id=i.project_id
                ORDER BY r.round DESC LIMIT 1) AS note
         FROM acceptance_items i WHERE i.project_id=? AND i.acceptance_id=? ORDER BY i.sort`,
      projectId, h.id
    );
    return { ...h, items };
  });
}

/** 每轮复验 = 新结果行，绝不覆盖上一轮 */
export function recordAcceptResult(input: {
  projectId: string; itemId: string; acceptanceId: string; result: "合格" | "不合格";
  note: string | null; source: "desktop" | "miniapp";
}) {
  ready();
  const cur = get<{ round: number }>(
    "SELECT COALESCE(MAX(round),0) AS round FROM acceptance_item_results WHERE project_id=? AND item_id=?",
    input.projectId, input.itemId
  );
  const round = (cur?.round ?? 0) + 1;
  db.prepare(
    `INSERT INTO acceptance_item_results (id,project_id,item_id,round,result,note,photo_file_id,checked_by,checked_at,source)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(randomUUID(), input.projectId, input.itemId, round, input.result, input.note, null, "张辉", now(), input.source);
  pushEvent(input.projectId, "accept.result", { item_id: input.itemId, result: input.result }, input.source === "miniapp");
  logActivity(input.projectId, "验收", `${input.result === "合格" ? "✅" : "❌"} ${input.note ?? "打卡"}`.trim(), input.source);
}

/* ---------------- 事件与动态 ---------------- */

export type OutboxEvent = {
  id: string; event_type: string; payload: string | null; device: string | null;
  status: string; created_at: string; processed_at: string | null;
};

export function listEvents(projectId: string, limit = 8): OutboxEvent[] {
  ready();
  return all<OutboxEvent>(
    `SELECT id,event_type,payload,device,status,created_at,processed_at
       FROM outbox_events WHERE project_id=? ORDER BY created_at DESC LIMIT ?`,
    projectId, limit
  );
}

/** 小程序端只 append 事件；桌面端 pull → apply → 标记已处理（幂等靠 id） */
export function pushEvent(
  projectId: string, eventType: string, payload: unknown, fromMobile: boolean
) {
  db.prepare(
    `INSERT INTO outbox_events (id,project_id,event_type,payload,device,status,created_at,processed_at)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(randomUUID(), projectId, eventType, JSON.stringify(payload),
        fromMobile ? "iPhone·小程序" : "桌面端", fromMobile ? "pending" : "applied",
        now(), fromMobile ? null : now());
}

export function applyPendingEvents(projectId: string): number {
  ready();
  const pending = all<{ id: string; event_type: string; payload: string | null }>(
    "SELECT id,event_type,payload FROM outbox_events WHERE project_id=? AND status='pending' ORDER BY created_at",
    projectId
  );
  const t = now();
  for (const e of pending) {
    // 事件消费按类型分发；失败不阻断其它事件，标记 failed 以便重试
    try {
      const payload = e.payload ? (JSON.parse(e.payload) as Record<string, unknown>) : {};
      if (e.event_type === "material.bought" && typeof payload.material_id === "string") {
        upsertMaterialOverride(projectId, payload.material_id, { status: "已买" });
      }
      if (e.event_type === "photo.added" && typeof payload.text === "string") {
        logActivity(projectId, "照片", payload.text, "miniapp");
      }
      db.prepare("UPDATE outbox_events SET status='applied',processed_at=? WHERE id=?").run(t, e.id);
    } catch {
      db.prepare("UPDATE outbox_events SET status='failed' WHERE id=?").run(e.id);
    }
  }
  return pending.length;
}

/* ---------------- 文件（拍照留档） ---------------- */

/** 一个文件可以有多个版本、同时挂多个业务对象 —— 不复制文件 */
export function addFile(input: {
  projectId: string; name: string; storageKey: string; mime: string; sizeBytes: number;
  resourceType: "project" | "point" | "task" | "acceptance" | "payment" | "material" | "space";
  resourceId: string;
}) {
  ready();
  const t = now();
  const fileId = randomUUID();
  db.prepare(
    "INSERT INTO files (id,project_id,name,current_version_no,created_at) VALUES (?,?,?,?,?)"
  ).run(fileId, input.projectId, input.name, 1, t);
  db.prepare(
    `INSERT INTO file_versions (id,project_id,file_id,version_no,storage_key,mime,size_bytes,created_at)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(randomUUID(), input.projectId, fileId, 1, input.storageKey, input.mime, input.sizeBytes, t);
  db.prepare(
    `INSERT INTO file_relations (id,project_id,file_id,resource_type,resource_id,relation_type,created_at)
     VALUES (?,?,?,?,?,?,?)`
  ).run(randomUUID(), input.projectId, fileId, input.resourceType, input.resourceId, "evidence", t);
  return fileId;
}

export function listFiles(projectId: string, limit = 12) {
  ready();
  return all<{ id: string; name: string; storage_key: string; created_at: string; resource_type: string }>(
    `SELECT f.id,f.name,v.storage_key,f.created_at,r.resource_type
       FROM files f
       JOIN file_versions v ON v.file_id=f.id AND v.project_id=f.project_id
       LEFT JOIN file_relations r ON r.file_id=f.id AND r.project_id=f.project_id
      WHERE f.project_id=? ORDER BY f.created_at DESC LIMIT ?`,
    projectId, limit
  );
}

export function logActivity(projectId: string, kind: string, text: string, source: "desktop" | "miniapp") {
  db.prepare(
    "INSERT INTO activity_logs (id,project_id,actor,kind,text,source,created_at) VALUES (?,?,?,?,?,?,?)"
  ).run(randomUUID(), projectId, "张辉", kind, text, source, now());
}

export function listActivity(projectId: string, limit = 10) {
  ready();
  return all<{ id: string; kind: string; text: string; source: string; created_at: string }>(
    "SELECT id,kind,text,source,created_at FROM activity_logs WHERE project_id=? ORDER BY created_at DESC LIMIT ?",
    projectId, limit
  );
}

/* ---------------- 汇总（两端共用） ---------------- */

export function summary(projectId: string) {
  ready();
  const stages = listStages(projectId);
  const done = stages.filter((s) => s.status === "已完成").length;
  const bom = computeBom(projectId);
  const budget = getBudget(projectId);
  const pays = listPayments(projectId);
  const spent = pays.filter((p) => p.direction === "out").reduce((s, p) => s + p.amount_cents, 0);
  const items = budget?.items ?? [];
  // 「水电材料」这一项由 BOM 实时算出来，不是手填的
  const budgetTotal = items.reduce(
    (s, i) => s + (i.category === "水电材料" ? bom.totalCents : i.amount_cents),
    0
  );
  const current = stages.find((s) => s.status === "进行中");
  return {
    stages, progressPct: stages.length ? (done / stages.length) * 100 : 0,
    current, bom, budgetTotalCents: budgetTotal, spentCents: spent,
    remainingCents: budgetTotal - spent, count: bom.count,
  };
}

export function yuan(cents: number) {
  return (cents / 100).toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
