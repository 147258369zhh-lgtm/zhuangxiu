import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";

const dataDir = join(process.cwd(), ".data");
mkdirSync(join(dataDir, "uploads"), { recursive: true });

// 用 globalThis 挂单例，避免 HMR 热更新时反复开连接
declare global {
  // eslint-disable-next-line no-var
  var __zxDemoDb: DatabaseSync | undefined;
}

const db =
  globalThis.__zxDemoDb ??
  new DatabaseSync(join(dataDir, "demo.db"), { allowBareNamedParameters: false });
globalThis.__zxDemoDb = db;

db.exec(`
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  community TEXT,
  owner_name TEXT,
  layout TEXT,
  foreman TEXT,
  budget REAL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS steps (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT '待开工'
);
CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  author TEXT NOT NULL,
  step_name TEXT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS accepts (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  step_name TEXT NOT NULL,
  item TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  checked_by TEXT,
  checked_at TEXT,
  comment TEXT,
  photo TEXT
);
`);

function genCode(): string {
  return randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
}

const STEP_TEMPLATE = ["水电改造", "瓦工铺贴", "木工制作", "油漆涂装", "安装收尾", "竣工验收"];

const row = db.prepare("SELECT COUNT(*) AS c FROM sites").get() as { c: number };
if (row.c === 0) {
  const seed = (s: {
    code: string; name: string; community: string; owner: string; layout: string;
    foreman: string; budget: number; steps: Record<string, string>;
  }) => {
    const siteId = randomUUID();
    db.prepare(
      "INSERT INTO sites (id, code, name, community, owner_name, layout, foreman, budget, created_at) VALUES (?,?,?,?,?,?,?,?,?)"
    ).run(siteId, s.code, s.name, s.community, s.owner, s.layout, s.foreman, s.budget, new Date().toISOString());
    const insStep = db.prepare("INSERT INTO steps (id, site_id, name, sort, status) VALUES (?,?,?,?,?)");
    STEP_TEMPLATE.forEach((n, i) => insStep.run(randomUUID(), siteId, n, i, s.steps[n] ?? "待开工"));
    return siteId;
  };

  const s1 = seed({
    code: "AX7K2M", name: "3-2-502 王姐的新家", community: "澜庭叙·雲著", owner: "王女士",
    layout: "98㎡ · 两室两厅", foreman: "李工长", budget: 186000,
    steps: { 水电改造: "已完成", 瓦工铺贴: "进行中" },
  });
  const s2 = seed({
    code: "B3N8QK", name: "7-1-301 李先生的家", community: "绿地新都会", owner: "李先生",
    layout: "128㎡ · 三室两厅", foreman: "赵工长", budget: 236000,
    steps: { 水电改造: "进行中" },
  });

  const insLog = db.prepare("INSERT INTO logs (id, site_id, author, step_name, content, created_at) VALUES (?,?,?,?,?,?)");
  const now = Date.now();
  insLog.run(randomUUID(), s1, "李工长", "水电改造", "全屋水电改造完成，打压测试通过，已拍照归档，可以进入瓦工阶段。", new Date(now - 3 * 86400000).toISOString());
  insLog.run(randomUUID(), s1, "张监理", "水电改造", "隐蔽工程验收合格，回路标识规范，同意封闭。", new Date(now - 2.5 * 86400000).toISOString());
  insLog.run(randomUUID(), s1, "李工长", "瓦工铺贴", "厨房卫生间墙砖铺贴中，预计 3 天完成。", new Date(now - 0.5 * 86400000).toISOString());
  insLog.run(randomUUID(), s2, "赵工长", "水电改造", "进场交底完成，水电定位放线中。", new Date(now - 86400000).toISOString());

  const insAcc = db.prepare("INSERT INTO accepts (id, site_id, step_name, item, done, checked_by, checked_at, comment, photo) VALUES (?,?,?,?,?,?,?,?,?)");
  const acc = (site: string, step: string, item: string, done = 0, by?: string, comment?: string) =>
    insAcc.run(randomUUID(), site, step, item, done, by ?? null, done ? new Date(now - 2 * 86400000).toISOString() : null, comment ?? null, null);

  acc(s1, "水电改造", "强电箱回路标识清晰", 1, "王女士", "线管排得很整齐，满意");
  acc(s1, "水电改造", "水路打压测试 0.8MPa 保压 30 分钟", 1, "王女士", "监理在场，一次通过");
  acc(s1, "水电改造", "插座点位与图纸一致");
  acc(s1, "瓦工铺贴", "瓷砖空鼓率 < 5%");
  acc(s1, "瓦工铺贴", "卫生间地漏坡度排水顺畅");
  acc(s2, "水电改造", "强电箱回路标识清晰");
  acc(s2, "水电改造", "水路打压测试 0.8MPa 保压 30 分钟");
  acc(s2, "水电改造", "插座点位与图纸一致");
}

export default db;
export { genCode };
