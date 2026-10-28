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

// WAL + busy_timeout：dev 下多 worker 并发访问不再报 database is locked
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA busy_timeout = 3000;");

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
  status TEXT NOT NULL DEFAULT '待开工',
  planned REAL NOT NULL DEFAULT 0,
  actual REAL NOT NULL DEFAULT 0,
  planned_days INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  finished_at TEXT
);
CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  author TEXT NOT NULL,
  step_name TEXT,
  content TEXT NOT NULL,
  photo TEXT,
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
CREATE TABLE IF NOT EXISTS changes (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  title TEXT NOT NULL,
  reason TEXT,
  amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT '待确认',
  decided_by TEXT,
  decided_at TEXT,
  decided_comment TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  title TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT '待收款',
  paid_at TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  name TEXT NOT NULL,
  spec TEXT,
  qty TEXT,
  status TEXT NOT NULL DEFAULT '待进场',
  arrived_at TEXT,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);

// 旧库平滑升级：缺列自动补（dev 迭代友好）
function ensureColumn(table: string, col: string, ddl: string) {
  const cols = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
    (c) => c.name
  );
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`);
}
ensureColumn("steps", "planned_days", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("steps", "started_at", "TEXT");
ensureColumn("steps", "finished_at", "TEXT");

function genCode(): string {
  return randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
}

// 极简 SVG 施工照片占位（数据 URL，无需文件）
function photo(label: string, sub: string, from: string, to: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
<rect width="640" height="360" fill="url(#g)"/>
<rect x="24" y="24" width="120" height="34" rx="17" fill="rgba(255,255,255,.22)"/>
<text x="48" y="46" font-family="sans-serif" font-size="15" fill="#fff" text-anchor="middle">施工记录</text>
<text x="40" y="300" font-family="sans-serif" font-size="34" font-weight="bold" fill="#fff">${label}</text>
<text x="40" y="336" font-family="sans-serif" font-size="17" fill="rgba(255,255,255,.75)">${sub}</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

const cnt = db.prepare("SELECT COUNT(*) AS c FROM sites").get() as { c: number };
if (cnt.c === 0) {
  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * 86400000).toISOString();

  const seed = (s: {
    code: string; name: string; community: string; owner: string; layout: string;
    foreman: string; budget: number;
    steps: { name: string; status: string; planned: number; actual: number; days: number; start?: number; end?: number }[];
  }) => {
    const siteId = randomUUID();
    db.prepare(
      "INSERT INTO sites (id, code, name, community, owner_name, layout, foreman, budget, created_at) VALUES (?,?,?,?,?,?,?,?,?)"
    ).run(siteId, s.code, s.name, s.community, s.owner, s.layout, s.foreman, s.budget, daysAgo(14));
    const ins = db.prepare(
      "INSERT INTO steps (id, site_id, name, sort, status, planned, actual, planned_days, started_at, finished_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
    );
    s.steps.forEach((st, i) =>
      ins.run(
        randomUUID(), siteId, st.name, i, st.status, st.planned, st.actual, st.days,
        st.start != null ? daysAgo(st.start) : null,
        st.end != null ? daysAgo(st.end) : null
      )
    );
    return siteId;
  };

  const s1 = seed({
    code: "AX7K2M", name: "3-2-502 王姐的新家", community: "澜庭叙·雲著", owner: "王女士",
    layout: "98㎡ · 两室两厅", foreman: "李工长", budget: 186000,
    steps: [
      { name: "水电改造", status: "已完成", planned: 28000, actual: 26500, days: 7, start: 14, end: 7 },
      { name: "瓦工铺贴", status: "进行中", planned: 32000, actual: 12400, days: 12, start: 6 },
      { name: "木工制作", status: "待开工", planned: 26000, actual: 0, days: 10 },
      { name: "油漆涂装", status: "待开工", planned: 22000, actual: 0, days: 8 },
      { name: "安装收尾", status: "待开工", planned: 18000, actual: 0, days: 5 },
      { name: "竣工验收", status: "待开工", planned: 0, actual: 0, days: 1 },
    ],
  });
  const s2 = seed({
    code: "B3N8QK", name: "7-1-301 李先生的家", community: "绿地新都会", owner: "李先生",
    layout: "128㎡ · 三室两厅", foreman: "赵工长", budget: 236000,
    steps: [
      { name: "水电改造", status: "进行中", planned: 36000, actual: 0, days: 7, start: 1 },
      { name: "瓦工铺贴", status: "待开工", planned: 38000, actual: 0, days: 12 },
      { name: "木工制作", status: "待开工", planned: 30000, actual: 0, days: 10 },
      { name: "油漆涂装", status: "待开工", planned: 24000, actual: 0, days: 8 },
      { name: "安装收尾", status: "待开工", planned: 20000, actual: 0, days: 5 },
      { name: "竣工验收", status: "待开工", planned: 0, actual: 0, days: 1 },
    ],
  });

  // 日志
  const insLog = db.prepare("INSERT INTO logs (id, site_id, author, step_name, content, photo, created_at) VALUES (?,?,?,?,?,?,?)");
  insLog.run(randomUUID(), s1, "李工长", "水电改造", "全屋水电改造完成，打压测试通过，已拍照归档，可以进入瓦工阶段。",
    photo("水电隐蔽验收", "管线横平竖直 · 打压 0.8MPa 合格", "#0f172a", "#334155"), daysAgo(7.2));
  insLog.run(randomUUID(), s1, "张监理", "水电改造", "隐蔽工程验收合格，回路标识规范，同意封闭。",
    null, daysAgo(6.8));
  insLog.run(randomUUID(), s1, "李工长", "瓦工铺贴", "厨房卫生间墙砖铺贴中，预计 3 天完成。",
    photo("卫生间墙砖铺贴", "已完成 60% · 阴阳角垂直", "#78350f", "#b45309"), daysAgo(0.5));
  insLog.run(randomUUID(), s2, "赵工长", "水电改造", "进场交底完成，水电定位放线中。",
    null, daysAgo(1));

  // 验收清单
  const insAcc = db.prepare("INSERT INTO accepts (id, site_id, step_name, item, done, checked_by, checked_at, comment, photo) VALUES (?,?,?,?,?,?,?,?,?)");
  const acc = (site: string, step: string, item: string, done = 0, by?: string, comment?: string) =>
    insAcc.run(randomUUID(), site, step, item, done, by ?? null, done ? daysAgo(2) : null, comment ?? null, null);

  acc(s1, "水电改造", "强电箱回路标识清晰", 1, "王女士", "线管排得很整齐，满意");
  acc(s1, "水电改造", "水路打压测试 0.8MPa 保压 30 分钟", 1, "王女士", "监理在场，一次通过");
  acc(s1, "水电改造", "插座点位与图纸一致");
  acc(s1, "瓦工铺贴", "瓷砖空鼓率 < 5%");
  acc(s1, "瓦工铺贴", "卫生间地漏坡度排水顺畅");
  acc(s2, "水电改造", "强电箱回路标识清晰");
  acc(s2, "水电改造", "水路打压测试 0.8MPa 保压 30 分钟");
  acc(s2, "水电改造", "插座点位与图纸一致");

  // 增项单
  const insChg = db.prepare("INSERT INTO changes (id, site_id, title, reason, amount, status, decided_by, decided_at, decided_comment, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)");
  insChg.run(randomUUID(), s1, "卫生间增加壁龛", "瓦工师傅建议，洗浴用品有地方放了", 380, "已确认",
    "王女士", daysAgo(4), "实用，同意", daysAgo(5));
  insChg.run(randomUUID(), s1, "厨房水槽更换抽拉式龙头", "原型号缺货，升级款同价换差价 260", 260, "待确认",
    null, null, null, daysAgo(0.8));
  insChg.run(randomUUID(), s2, "客厅增加两组筒灯点位", "照明设计调整，吊顶后补线", 150, "待确认",
    null, null, null, daysAgo(0.5));

  // 付款计划（30% / 35% / 35%）
  const insPay = db.prepare("INSERT INTO payments (id, site_id, title, amount, status, paid_at, note, created_at) VALUES (?,?,?,?,?,?,?,?)");
  const pay = (site: string, title: string, amount: number, status: string, paidAt: string | null, note: string, createdAt: number) =>
    insPay.run(randomUUID(), site, title, amount, status, paidAt, note, daysAgo(createdAt));
  pay(s1, "首期款 · 签约 30%", 55800, "已收款", daysAgo(14), "签约当天收讫", 14);
  pay(s1, "中期款 · 瓦工过半 35%", 65100, "待收款", null, "瓦工过半节点", 14);
  pay(s1, "尾款 · 竣工验收 35%", 65100, "待收款", null, "竣工验收合格后", 14);
  pay(s2, "首期款 · 签约 30%", 70800, "已收款", daysAgo(5), "签约当天收讫", 5);
  pay(s2, "中期款 · 瓦工过半 35%", 82600, "待收款", null, "瓦工过半节点", 5);
  pay(s2, "尾款 · 竣工验收 35%", 82600, "待收款", null, "竣工验收合格后", 5);

  // 材料清单
  const insMat = db.prepare("INSERT INTO materials (id, site_id, name, spec, qty, status, arrived_at, sort) VALUES (?,?,?,?,?,?,?,?)");
  const mat = (site: string, name: string, spec: string, qty: string, status: string, arrived: number | null, sort: number) =>
    insMat.run(randomUUID(), site, name, spec, qty, status, arrived != null ? daysAgo(arrived) : null, sort);
  mat(s1, "强电电缆 · 熊猫牌", "BV 2.5/4㎡ 全屋回路", "3 盘 + 辅材", "已进场", 13, 0);
  mat(s1, "PPR 给水管 · 伟星", "4分/6分 冷热水", "全套", "已进场", 13, 1);
  mat(s1, "防水涂料 · 德高", "JS-II 卫生间两遍", "2 组", "已进场", 6, 2);
  mat(s1, "墙地砖 · 马可波罗", "800×800 全瓷通体", "98㎡ 用量", "已进场", 5, 3);
  mat(s1, "铝扣板吊顶 · 奥华", "厨卫 300×300", "厨房 + 两卫", "待进场", null, 4);
  mat(s1, "乳胶漆 · 多乐士", "致悦五合一 净味", "2 底 + 4 面", "待进场", null, 5);
  mat(s2, "强电电缆 · 熊猫牌", "BV 2.5/4㎡ 全屋回路", "4 盘 + 辅材", "已进场", 4, 0);
  mat(s2, "PPR 给水管 · 伟星", "4分/6分 冷热水", "全套", "已进场", 4, 1);
  mat(s2, "墙地砖 · 东鹏", "750×1500 通体大理石", "128㎡ 用量", "待进场", null, 2);
  mat(s2, "乳胶漆 · 立邦", "抗甲醛五合一", "3 底 + 5 面", "待进场", null, 3);
}

// 留言板种子（独立判断，老库也能自动补齐）
const msgCnt = db.prepare("SELECT COUNT(*) AS n FROM messages").get() as { n: number };
if (msgCnt.n === 0) {
  const byCode = (code: string) =>
    db.prepare("SELECT id FROM sites WHERE code=?").get(code) as { id: string } | undefined;
  const m1 = byCode("AX7K2M");
  const m2 = byCode("B3N8QK");
  const insMsg = db.prepare("INSERT INTO messages (id, site_id, sender, author, content, created_at) VALUES (?,?,?,?,?,?)");
  const mNow = Date.now();
  if (m1) {
    insMsg.run(randomUUID(), m1.id, "业主", "王女士", "李工长，瓦工大概什么时候能完？我周末想去看下瓷砖。", new Date(mNow - 2 * 86400000).toISOString());
    insMsg.run(randomUUID(), m1.id, "工长", "李工长", "王姐，墙砖明天贴完，地砖后天，周五下午来看整体效果正好。", new Date(mNow - 1.9 * 86400000).toISOString());
    insMsg.run(randomUUID(), m1.id, "业主", "王女士", "好的，那我周五下午过去 👍", new Date(mNow - 1.5 * 86400000).toISOString());
  }
  if (m2) {
    insMsg.run(randomUUID(), m2.id, "业主", "李先生", "水电定位能不能在主卧电视墙再加一个网口？", new Date(mNow - 0.5 * 86400000).toISOString());
    insMsg.run(randomUUID(), m2.id, "工长", "赵工长", "可以的，明天师傅到场加一个，不额外收费。", new Date(mNow - 0.4 * 86400000).toISOString());
  }
}

export default db;
export { genCode };
