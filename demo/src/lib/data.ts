import { randomUUID } from "node:crypto";
import db, { genCode } from "./db";
import { STEP_TEMPLATES, ACCEPT_TEMPLATES, PAYMENT_TEMPLATES, type SiteTemplate } from "./checklists";

export type Site = {
  id: string; code: string; name: string; community: string | null;
  owner_name: string | null; layout: string | null; foreman: string | null;
  budget: number; created_at: string;
};
export type Step = {
  id: string; site_id: string; name: string; sort: number; status: string;
  planned: number; actual: number; planned_days: number; started_at: string | null; finished_at: string | null;
};
export type Log = { id: string; site_id: string; author: string; step_name: string | null; content: string; photo: string | null; created_at: string };
export type Accept = {
  id: string; site_id: string; step_name: string; item: string; done: number;
  checked_by: string | null; checked_at: string | null; comment: string | null; photo: string | null;
};
export type Change = {
  id: string; site_id: string; title: string; reason: string | null; amount: number;
  status: "待确认" | "已确认" | "已拒绝"; decided_by: string | null; decided_at: string | null;
  decided_comment: string | null; created_at: string;
};
export type Payment = {
  id: string; site_id: string; title: string; amount: number;
  status: "待收款" | "已收款"; paid_at: string | null; note: string | null; created_at: string; due_date: string | null;
};
export type Warranty = {
  id: string; site_id: string; item: string; start_date: string; months: number; end_date: string; note: string | null;
};
export type Material = {
  id: string; site_id: string; name: string; spec: string | null; qty: string | null;
  status: "待进场" | "已进场"; arrived_at: string | null; sort: number;
};

const all = <T>(sql: string, ...params: (string | number)[]): T[] =>
  db.prepare(sql).all(...params) as T[];
const get = <T>(sql: string, ...params: (string | number)[]): T | undefined =>
  db.prepare(sql).get(...params) as T | undefined;

/* ---------- 工地 ---------- */

export function listSitesWithProgress() {
  const sites = all<Site>("SELECT * FROM sites ORDER BY created_at DESC");
  return sites.map((site) => {
    const c = get<{ done: number; total: number }>(
      "SELECT SUM(CASE WHEN status='已完成' THEN 1 ELSE 0 END) AS done, COUNT(*) AS total FROM steps WHERE site_id=?",
      site.id
    )!;
    const pending = get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM changes WHERE site_id=? AND status='待确认'", site.id
    )!;
    const extra = get<{ s: number }>(
      "SELECT COALESCE(SUM(amount),0) AS s FROM changes WHERE site_id=? AND status='已确认'", site.id
    )!;
    const received = get<{ s: number }>(
      "SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE site_id=? AND status='已收款'", site.id
    )!;
    // 风险：进行中工序超期天数（取最大）
    const d = get<{ n: number }>(
      `SELECT COALESCE(MAX(CAST((julianday('now','localtime') - julianday(started_at) - planned_days) AS INTEGER)),0) AS n
         FROM steps WHERE site_id=? AND status='进行中' AND started_at IS NOT NULL AND planned_days > 0`, site.id
    )!;
    return {
      site, done: c.done ?? 0, total: c.total || 1, pendingChanges: pending.n,
      extraAmount: extra.s, receivedAmount: received.s, delayDays: Math.max(0, d.n),
    };
  });
}

export const getSite = (id: string) => get<Site>("SELECT * FROM sites WHERE id=?", id);
export const getSiteByCode = (code: string) => get<Site>("SELECT * FROM sites WHERE code=?", code.toUpperCase());

/* ---------- 工序 ---------- */

const STEP_TEMPLATE: [string, number][] = [
  ["水电改造", 7], ["瓦工铺贴", 12], ["木工制作", 10],
  ["油漆涂装", 8], ["安装收尾", 5], ["竣工验收", 1],
];

export function createSite(input: {
  name: string; community: string; owner: string; layout: string; foreman: string; budget: number;
  template?: string;
}): string {
  const siteId = randomUUID();
  const code = genCode();
  const template = (input.template && input.template in STEP_TEMPLATES ? input.template : "全屋翻新") as SiteTemplate;
  const tpl = STEP_TEMPLATES[template];
  db.prepare(
    "INSERT INTO sites (id, code, name, community, owner_name, layout, foreman, budget, created_at) VALUES (?,?,?,?,?,?,?,?,?)"
  ).run(siteId, code, input.name, input.community, input.owner, input.layout, input.foreman, input.budget, new Date().toISOString());
  const ins = db.prepare(
    "INSERT INTO steps (id, site_id, name, sort, status, planned, actual, planned_days, started_at) VALUES (?,?,?,?,?,?,?,?,?)"
  );
  tpl.forEach(([n, days], i) =>
    ins.run(randomUUID(), siteId, n, i, i === 0 ? "进行中" : "待开工", 0, 0, days, i === 0 ? new Date().toISOString() : null)
  );

  // 按模板生成标准验收清单（业主端即刻可打卡）
  const insAcc = db.prepare("INSERT INTO accepts (id, site_id, step_name, item, done) VALUES (?,?,?,?,0)");
  for (const [n] of tpl) {
    for (const item of ACCEPT_TEMPLATES[n] ?? []) insAcc.run(randomUUID(), siteId, n, item);
  }

  // 按模板生成付款计划（含到期日）
  const insPay = db.prepare("INSERT INTO payments (id, site_id, title, amount, status, note, created_at, due_date) VALUES (?,?,?,?,?,?,?,?)");
  const now = Date.now();
  for (const [title, ratio, dueDays] of PAYMENT_TEMPLATES) {
    insPay.run(randomUUID(), siteId, title, Math.round(input.budget * ratio), "待收款",
      title.includes("首期") ? "签约当天收讫" : title.includes("中期") ? "瓦工过半节点" : "竣工验收合格后",
      new Date(now).toISOString(), new Date(now + dueDays * 86400000).toISOString());
  }

  db.prepare("INSERT INTO logs (id, site_id, author, step_name, content, photo, created_at) VALUES (?,?,?,?,?,?,?)").run(
    randomUUID(), siteId, "系统", tpl[0][0],
    `工地创建完成（${template}模板）：已生成 ${tpl.length} 道标准工序、验收清单与付款计划，水电定位进行中。`,
    null, new Date().toISOString()
  );
  return siteId;
}

export const getSteps = (siteId: string) => all<Step>("SELECT * FROM steps WHERE site_id=? ORDER BY sort", siteId);
export const STEP_STATUS = ["待开工", "进行中", "已完成"] as const;

export function setStepStatus(stepId: string, status: string) {
  const step = get<Step>("SELECT * FROM steps WHERE id=?", stepId);
  if (!step) return;
  if (status === "进行中" && !step.started_at) {
    db.prepare("UPDATE steps SET status=?, started_at=? WHERE id=?").run(status, new Date().toISOString(), stepId);
  } else if (status === "已完成") {
    db.prepare("UPDATE steps SET status=?, finished_at=? WHERE id=?").run(status, new Date().toISOString(), stepId);
  } else if (status === "待开工") {
    db.prepare("UPDATE steps SET status=?, started_at=NULL, finished_at=NULL WHERE id=?").run(status, stepId);
  } else {
    db.prepare("UPDATE steps SET status=? WHERE id=?").run(status, stepId);
  }
}

export function updateStepBudget(stepId: string, planned: number, actual: number) {
  db.prepare("UPDATE steps SET planned=?, actual=? WHERE id=?").run(planned, actual, stepId);
}

/* ---------- 日志 ---------- */

export const getLogs = (siteId: string) => all<Log>("SELECT * FROM logs WHERE site_id=? ORDER BY created_at DESC", siteId);

export function addLog(siteId: string, author: string, stepName: string, content: string, photo: string | null) {
  db.prepare("INSERT INTO logs (id, site_id, author, step_name, content, photo, created_at) VALUES (?,?,?,?,?,?,?)").run(
    randomUUID(), siteId, author, stepName, content, photo, new Date().toISOString()
  );
}

/* ---------- 验收 ---------- */

export const getAccepts = (siteId: string) => all<Accept>("SELECT * FROM accepts WHERE site_id=? ORDER BY rowid", siteId);

export function confirmAccept(acceptId: string, by: string, comment: string | null, photo: string | null) {
  db.prepare(
    "UPDATE accepts SET done=1, checked_by=?, checked_at=?, comment=?, photo=? WHERE id=? AND done=0"
  ).run(by, new Date().toISOString(), comment, photo, acceptId);
}

/* ---------- 增项单 ---------- */

export const getChanges = (siteId: string) => all<Change>("SELECT * FROM changes WHERE site_id=? ORDER BY rowid DESC", siteId);

export function createChange(siteId: string, title: string, reason: string, amount: number): string {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO changes (id, site_id, title, reason, amount, status, created_at) VALUES (?,?,?,?,?,?,?)"
  ).run(id, siteId, title, reason, amount, "待确认", new Date().toISOString());
  return id;
}

export function decideChange(id: string, decision: "已确认" | "已拒绝", by: string, comment: string | null) {
  db.prepare("UPDATE changes SET status=?, decided_by=?, decided_at=?, decided_comment=? WHERE id=? AND status='待确认'")
    .run(decision, by, new Date().toISOString(), comment, id);
}

/* ---------- 付款 ---------- */

export const getPayments = (siteId: string) => all<Payment>("SELECT * FROM payments WHERE site_id=? ORDER BY rowid", siteId);

export function createPayment(siteId: string, title: string, amount: number, note: string) {
  db.prepare("INSERT INTO payments (id, site_id, title, amount, status, note, created_at) VALUES (?,?,?,?,?,?,?)").run(
    randomUUID(), siteId, title, amount, "待收款", note, new Date().toISOString()
  );
}

export function receivePayment(id: string) {
  db.prepare("UPDATE payments SET status='已收款', paid_at=? WHERE id=? AND status='待收款'")
    .run(new Date().toISOString(), id);
}

/* ---------- 材料 ---------- */

export const getMaterials = (siteId: string) => all<Material>("SELECT * FROM materials WHERE site_id=? ORDER BY sort, rowid", siteId);

export function createMaterial(siteId: string, name: string, spec: string, qty: string) {
  const maxSort = get<{ s: number | null }>("SELECT MAX(sort) AS s FROM materials WHERE site_id=?", siteId)!;
  db.prepare("INSERT INTO materials (id, site_id, name, spec, qty, status, sort) VALUES (?,?,?,?,?,?,?)").run(
    randomUUID(), siteId, name, spec, qty, "待进场", (maxSort.s ?? 0) + 1
  );
}

export function arriveMaterial(id: string) {
  db.prepare("UPDATE materials SET status='已进场', arrived_at=? WHERE id=? AND status='待进场'")
    .run(new Date().toISOString(), id);
}

/* ---------- 留言板 ---------- */

export type Message = { id: string; site_id: string; sender: string; author: string; content: string; created_at: string };

export const getMessages = (siteId: string) =>
  all<Message>("SELECT * FROM messages WHERE site_id=? ORDER BY created_at", siteId);

export function addMessage(siteId: string, sender: string, author: string, content: string) {
  db.prepare("INSERT INTO messages (id, site_id, sender, author, content, created_at) VALUES (?,?,?,?,?,?)").run(
    randomUUID(), siteId, sender, author, content, new Date().toISOString()
  );
}

/* ---------- 验收项（B端自定义） ---------- */

export function createAccept(siteId: string, stepName: string, item: string) {
  db.prepare("INSERT INTO accepts (id, site_id, step_name, item, done) VALUES (?,?,?,?,0)").run(
    randomUUID(), siteId, stepName, item
  );
}

/* ---------- 编辑工地 ---------- */

export function updateSite(id: string, input: { name: string; community: string; owner: string; layout: string; foreman: string; budget: number }) {
  db.prepare("UPDATE sites SET name=?, community=?, owner_name=?, layout=?, foreman=?, budget=? WHERE id=?").run(
    input.name, input.community, input.owner, input.layout, input.foreman, input.budget, id
  );
}

/* ---------- 全局动态流 ---------- */

export type RecentEvent = { type: string; code: string; site: string; author: string; extra: string | null; text: string; at: string | null };

export function recentEvents(limit = 6): RecentEvent[] {
  return all<RecentEvent>(
    `SELECT 'log' AS type, s.code, s.name AS site, l.author, l.step_name AS extra, l.content AS text, l.created_at AS at
       FROM logs l JOIN sites s ON s.id = l.site_id
      UNION ALL
      SELECT 'accept', s.code, s.name, COALESCE(a.checked_by,'业主'), a.step_name, a.item, a.checked_at
       FROM accepts a JOIN sites s ON s.id = a.site_id WHERE a.done = 1
      UNION ALL
      SELECT 'pay', s.code, s.name, '财务', p.title, p.note, p.paid_at
       FROM payments p JOIN sites s ON s.id = p.site_id WHERE p.status = '已收款'
      UNION ALL
      SELECT 'msg', s.code, s.name, m.author, m.sender, m.content, m.created_at
       FROM messages m JOIN sites s ON s.id = m.site_id
      ORDER BY at DESC LIMIT ?`,
    limit
  );
}

/* ---------- 跨工地（财务/质检工作台） ---------- */

export type PaymentRow = Payment & { site_name: string; code: string };

/** 全部工地的付款节点：逾期 > 待收 > 已收，待收按到期日升序 */
export function listAllPayments(): PaymentRow[] {
  const rows = all<PaymentRow>(
    `SELECT p.*, s.name AS site_name, s.code
       FROM payments p JOIN sites s ON s.id = p.site_id`
  );
  const now = Date.now();
  const rank = (r: PaymentRow) =>
    r.status !== "待收款" ? 2 : r.due_date && new Date(r.due_date).getTime() < now ? 0 : 1;
  return rows.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
      a.site_name.localeCompare(b.site_name)
  );
}

export type AcceptRow = {
  id: string; site_id: string; step_name: string; item: string; done: number;
  checked_by: string | null; checked_at: string | null; comment: string | null; photo: string | null;
  site_name: string; code: string;
};

/** 待验收项（监理待办） */
export function listPendingAccepts(): AcceptRow[] {
  return all<AcceptRow>(
    `SELECT a.*, s.name AS site_name, s.code
       FROM accepts a JOIN sites s ON s.id = a.site_id
      WHERE a.done = 0
      ORDER BY s.name, a.rowid`
  );
}

/** 最近验收记录 */
export function listRecentAccepts(limit = 8): AcceptRow[] {
  return all<AcceptRow>(
    `SELECT a.*, s.name AS site_name, s.code
       FROM accepts a JOIN sites s ON s.id = a.site_id
      WHERE a.done = 1
      ORDER BY a.checked_at DESC LIMIT ?`,
    limit
  );
}

export function countPendingAccepts(): number {
  return (get<{ n: number }>("SELECT COUNT(*) AS n FROM accepts WHERE done=0")!).n;
}

export function countPendingPayments(): number {
  return (get<{ n: number }>("SELECT COUNT(*) AS n FROM payments WHERE status='待收款'")!).n;
}

/** 逾期未收的付款笔数（待收款且已过到期日） */
export function countOverduePayments(): number {
  return (get<{ n: number }>("SELECT COUNT(*) AS n FROM payments WHERE status='待收款' AND due_date IS NOT NULL AND due_date < ?", new Date().toISOString())!).n;
}

/* ---------- 保修（OCA 式：起保日 + 保修月数 → 自动算终保日） ---------- */

export const getWarranties = (siteId: string) =>
  all<Warranty>("SELECT * FROM warranties WHERE site_id=? ORDER BY end_date", siteId);

export function createWarranty(siteId: string, item: string, months: number, note: string | null) {
  const start = new Date();
  db.prepare("INSERT INTO warranties (id, site_id, item, start_date, months, end_date, note) VALUES (?,?,?,?,?,?,?)").run(
    randomUUID(), siteId, item, start.toISOString(), months,
    new Date(start.getTime() + months * 30.44 * 86400000).toISOString(), note
  );
}

/** 保修剩余天数（负数=已过期） */
export const warrantyDaysLeft = (w: Warranty) =>
  Math.ceil((new Date(w.end_date).getTime() - Date.now()) / 86400000);
