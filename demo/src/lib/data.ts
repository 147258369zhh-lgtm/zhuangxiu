import { randomUUID } from "node:crypto";
import db from "./db";

export type Site = {
  id: string; code: string; name: string; community: string | null;
  owner_name: string | null; layout: string | null; foreman: string | null;
  budget: number; created_at: string;
};
export type Step = { id: string; site_id: string; name: string; sort: number; status: string };
export type Log = { id: string; site_id: string; author: string; step_name: string | null; content: string; created_at: string };
export type Accept = {
  id: string; site_id: string; step_name: string; item: string; done: number;
  checked_by: string | null; checked_at: string | null; comment: string | null; photo: string | null;
};

const all = <T>(sql: string, ...params: (string | number)[]): T[] =>
  db.prepare(sql).all(...params) as T[];
const get = <T>(sql: string, ...params: (string | number)[]): T | undefined =>
  db.prepare(sql).get(...params) as T | undefined;

export function listSitesWithProgress() {
  const sites = all<Site>("SELECT * FROM sites ORDER BY created_at DESC");
  return sites.map((site) => {
    const counts = get<{ done: number; total: number }>(
      "SELECT SUM(CASE WHEN status='已完成' THEN 1 ELSE 0 END) AS done, COUNT(*) AS total FROM steps WHERE site_id=?",
      site.id
    )!;
    return { site, done: counts.done ?? 0, total: counts.total || 1 };
  });
}

export const getSite = (id: string) => get<Site>("SELECT * FROM sites WHERE id=?", id);
export const getSiteByCode = (code: string) => get<Site>("SELECT * FROM sites WHERE code=?", code.toUpperCase());
export const getSteps = (siteId: string) => all<Step>("SELECT * FROM steps WHERE site_id=? ORDER BY sort", siteId);
export const getLogs = (siteId: string) => all<Log>("SELECT * FROM logs WHERE site_id=? ORDER BY created_at DESC", siteId);
export const getAccepts = (siteId: string) => all<Accept>("SELECT * FROM accepts WHERE site_id=? ORDER BY rowid", siteId);

const STEP_TEMPLATE = ["水电改造", "瓦工铺贴", "木工制作", "油漆涂装", "安装收尾", "竣工验收"];

export function createSite(input: {
  name: string; community: string; owner: string; layout: string; foreman: string; budget: number;
}): string {
  const siteId = randomUUID();
  const code = genCode();
  db.prepare(
    "INSERT INTO sites (id, code, name, community, owner_name, layout, foreman, budget, created_at) VALUES (?,?,?,?,?,?,?,?,?)"
  ).run(siteId, code, input.name, input.community, input.owner, input.layout, input.foreman, input.budget, new Date().toISOString());
  const ins = db.prepare("INSERT INTO steps (id, site_id, name, sort, status) VALUES (?,?,?,?,?)");
  STEP_TEMPLATE.forEach((n, i) => ins.run(randomUUID(), siteId, n, i, i === 0 ? "进行中" : "待开工"));
  db.prepare("INSERT INTO logs (id, site_id, author, step_name, content, created_at) VALUES (?,?,?,?,?,?)").run(
    randomUUID(), siteId, "系统", "水电改造", "工地创建完成，水电定位进行中。", new Date().toISOString()
  );
  return siteId;
}

export const STEP_STATUS = ["待开工", "进行中", "已完成"] as const;

export function setStepStatus(stepId: string, status: string) {
  db.prepare("UPDATE steps SET status=? WHERE id=?").run(status, stepId);
}

export function addLog(siteId: string, author: string, stepName: string, content: string) {
  db.prepare("INSERT INTO logs (id, site_id, author, step_name, content, created_at) VALUES (?,?,?,?,?,?)").run(
    randomUUID(), siteId, author, stepName, content, new Date().toISOString()
  );
}

export function confirmAccept(acceptId: string, by: string, comment: string | null, photo: string | null) {
  db.prepare(
    "UPDATE accepts SET done=1, checked_by=?, checked_at=?, comment=?, photo=? WHERE id=? AND done=0"
  ).run(by, new Date().toISOString(), comment, photo, acceptId);
}
