import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { mkdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

/**
 * 自装线真库（self.db）—— 33 张表的真实 schema，与公司装线的 demo.db 分文件共存。
 * 纪律：① 组合外键带 project_id ② 版本只追加 ③ 状态 ≠ 历史
 */

const dataDir = join(process.cwd(), ".data");
mkdirSync(join(dataDir, "uploads"), { recursive: true });

declare global {
  // eslint-disable-next-line no-var
  var __zxSelfDb: DatabaseSync | undefined;
}

function open(): DatabaseSync {
  const db = new DatabaseSync(join(dataDir, "self.db"));
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 4000;");
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

export const db: DatabaseSync = globalThis.__zxSelfDb ?? open();
globalThis.__zxSelfDb = db;

/** 建表（幂等） */
export function initSchema() {
  const sql = readFileSync(join(process.cwd(), "src/lib/self-schema.sql"), "utf8");
  db.exec(sql);
}

const now = () => new Date().toISOString();
const uid = () => randomUUID();

/* ============================================================
 * 种子数据：一套真实户型（89㎡ 两室两厅）+ 6 房间 + 39 点位
 * ============================================================ */

const ROOMS: [string, string, number][] = [
  ["sp_kc", "客餐厅", 28],
  ["sp_zw", "主卧", 15],
  ["sp_cw", "次卧", 11],
  ["sp_cf", "厨房", 7],
  ["sp_ws", "卫生间", 4.5],
  ["sp_yt", "阳台", 5],
];

/** [空间, 类型, 位置, 高度mm, 规格] */
const POINTS: [string, string, string, number, string][] = [
  // 客餐厅 12
  ["sp_kc", "插座", "电视墙左", 300, "五孔 10A"],
  ["sp_kc", "插座", "电视墙右", 300, "五孔 10A"],
  ["sp_kc", "插座", "沙发两侧各一(左)", 300, "带USB 五孔"],
  ["sp_kc", "插座", "餐边柜", 1100, "五孔 10A"],
  ["sp_kc", "插座", "空调位", 2000, "16A 三孔"],
  ["sp_kc", "开关", "入户双控", 1300, "双开双控"],
  ["sp_kc", "开关", "客厅主灯双控", 1300, "单开双控"],
  ["sp_kc", "开关", "餐厅灯", 1300, "单开"],
  ["sp_kc", "灯具", "客厅主灯", 0, "吸顶灯 60W"],
  ["sp_kc", "灯具", "餐厅吊灯", 0, "三头吊灯"],
  ["sp_kc", "灯具", "玄关筒灯", 0, "筒灯 7W ×3"],
  ["sp_kc", "网口", "电视墙路由器", 300, "CAT6"],
  // 主卧 8
  ["sp_zw", "插座", "床头左", 700, "五孔 10A"],
  ["sp_zw", "插座", "床头右", 700, "带USB 五孔"],
  ["sp_zw", "插座", "梳妆台", 300, "五孔 10A"],
  ["sp_zw", "插座", "空调位", 2000, "16A 三孔"],
  ["sp_zw", "开关", "门边双控", 1300, "双开双控"],
  ["sp_zw", "开关", "床尾双控", 1300, "单开双控"],
  ["sp_zw", "灯具", "卧室主灯", 0, "吸顶灯 36W"],
  ["sp_zw", "网口", "书桌位", 300, "CAT6"],
  // 次卧 7
  ["sp_cw", "插座", "床头", 700, "五孔 10A"],
  ["sp_cw", "插座", "书桌", 300, "五孔 10A"],
  ["sp_cw", "插座", "空调位", 2000, "16A 三孔"],
  ["sp_cw", "开关", "门边", 1300, "双开双控"],
  ["sp_cw", "开关", "床头双控", 1300, "单开双控"],
  ["sp_cw", "灯具", "吸顶灯", 0, "吸顶灯 24W"],
  ["sp_cw", "网口", "书桌位", 300, "CAT6"],
  // 厨房 6
  ["sp_cf", "插座", "烟机位", 2200, "五孔 10A"],
  ["sp_cf", "插座", "冰箱位", 1300, "五孔 10A"],
  ["sp_cf", "插座", "操作台", 1100, "防溅盒 五孔"],
  ["sp_cf", "开关", "厨房灯", 1300, "单开"],
  ["sp_cf", "灯具", "厨房面板灯", 0, "面板灯 18W"],
  ["sp_cf", "水口", "洗菜盆冷热", 450, "PPR φ20"],
  // 卫生间 4
  ["sp_ws", "插座", "镜柜旁", 1400, "防溅盒 五孔"],
  ["sp_ws", "开关", "门边", 1300, "三开(灯/排风/浴霸)"],
  ["sp_ws", "灯具", "镜前灯", 0, "镜前灯 12W"],
  ["sp_ws", "水口", "花洒冷热", 1000, "PPR φ20"],
  // 阳台 2
  ["sp_yt", "插座", "洗衣机位", 1200, "防溅盒 五孔"],
  ["sp_yt", "灯具", "阳台吸顶灯", 0, "吸顶灯 18W"],
];

/** 工序模板：[名称, 工期天, 预算分] */
const STAGES: [string, number, number][] = [
  ["水电改造", 7, 720000],
  ["瓦工铺贴", 12, 1440000],
  ["木工制作", 10, 1250000],
  ["油漆涂装", 8, 720000],
  ["安装收尾", 5, 1400000],
  ["竣工验收", 1, 0],
];

/** 验收模板：来自 lib/checklists.ts 的行业口径 */
const CHECKLISTS: Record<string, string[]> = {
  水电改造: [
    "强电箱回路标识清晰",
    "水路打压测试 0.8MPa 保压 30 分钟",
    "插座点位与图纸一致",
    "线管横平竖直、固定牢固",
    "冷热水管左热右冷、间距 ≥15cm",
    "强弱电交叉处锡箔屏蔽",
    "等电位联结端子连接可靠",
  ],
  瓦工铺贴: [
    "瓷砖空鼓率 < 5%（单砖不超 10%）",
    "卫生间地漏坡度排水顺畅",
    "阴阳角 45° 碰角整齐",
    "砖缝均匀、勾缝密实无空缝",
    "墙砖压地砖（墙压地工艺）",
  ],
  木工制作: [
    "柜体垂直度偏差 ≤2mm",
    "封边无脱胶、无爆边",
    "五金铰链开合顺畅无异响",
    "石膏板吊顶转角用 7 字整板，防开裂",
  ],
  油漆涂装: [
    "墙面无流坠、无色差",
    "阴阳角顺直",
    "灯槽/顶面平整无波浪",
    "开关插座面板周边无毛边",
  ],
};

/** 材料单价库（分）：用户可在桌面端改，改后落 project_materials */
const MATERIALS: [string, string, string, string, number, string][] = [
  ["m_socket", "五孔插座", "10A 250V 86型", "个", 2800, "水电材料"],
  ["m_switch", "开关面板", "86型 双控", "个", 3200, "水电材料"],
  ["m_light", "LED筒灯/吸顶灯", "7W 开孔75mm", "个", 4500, "水电材料"],
  ["m_ppr", "PPR内丝弯头", "φ20 1/2″", "个", 1800, "水电材料"],
  ["m_net", "六类网络插座", "CAT6 86型", "个", 5500, "水电材料"],
  ["m_box", "86型底盒", "加深型 60mm", "个", 350, "水电材料"],
  ["m_wire", "BV 铜芯电线", "2.5mm²", "米", 420, "水电材料"],
  ["m_pprpipe", "PPR 热水管", "φ20", "米", 1200, "水电材料"],
  ["m_netline", "六类网线", "CAT6 UTP", "米", 320, "水电材料"],
  ["m_conduit", "PVC 穿线管", "φ16", "米", 380, "水电材料"],
];

/** 预算分项（分）。水电材料由 BOM 实时算，这里留 0 占位 */
const BUDGET: [string, string, number][] = [
  ["水电材料", "点位材料（BOM 汇总）", 0],
  ["水电人工", "水电工 12 天 × 400", 480000],
  ["瓦工材料", "瓷砖/水泥/沙子", 900000],
  ["瓦工人工", "瓦工 12 天 × 450", 540000],
  ["木工材料", "板材/五金/石膏板", 800000],
  ["木工人工", "木工 10 天 × 450", 450000],
  ["油漆材料", "乳胶漆/腻子/辅料", 400000],
  ["油漆人工", "油漆工 8 天 × 400", 320000],
  ["主材", "门/地板/橱柜", 3800000],
  ["卫浴厨电", "马桶/花洒/烟机灶具", 1400000],
  ["家具软装", "床/沙发/窗帘", 3200000],
  ["预留金", "不可预见 5%", 1200000],
];

export function seedIfEmpty() {
  initSchema();
  const row = db.prepare("SELECT COUNT(*) AS n FROM projects").get() as { n: number };
  if (row.n > 0) return;

  const t = now();
  const owner = "u_zh";
  const partner = "u_lh";
  const prop = "pr_home";
  const proj = "pj_home";

  db.exec("BEGIN");
  try {
    db.prepare("INSERT INTO users (id,nickname,phone,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run(
      owner, "张辉", null, "active", t, t
    );
    db.prepare("INSERT INTO users (id,nickname,phone,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run(
      partner, "李慧", null, "active", t, t
    );
    db.prepare(
      "INSERT INTO user_identities (id,user_id,provider,provider_subject,created_at) VALUES (?,?,?,?,?)"
    ).run(uid(), owner, "wechat", "wx_openid_demo_owner", t);

    db.prepare(
      "INSERT INTO properties (id,name,address,area_sqm,layout,created_by,created_at) VALUES (?,?,?,?,?,?,?)"
    ).run(prop, "金域华府 3-2-1801", "西安市雁塔区", 89, "两室两厅一卫", owner, t);

    ROOMS.forEach(([id, name, area], i) => {
      db.prepare(
        "INSERT INTO property_rooms (id,property_id,name,area_sqm,sort,created_at) VALUES (?,?,?,?,?,?)"
      ).run(id.replace("sp_", "rm_"), prop, name, area, i, t);
    });

    db.prepare(
      `INSERT INTO projects (id,property_id,name,template,start_date,planned_end,status,created_by,created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).run(proj, prop, "我的家 · 全屋翻新", "全屋翻新", "2026-09-01", "2026-12-20", "active", owner, t);

    db.prepare(
      "INSERT INTO project_members (id,project_id,user_id,role,status,joined_at) VALUES (?,?,?,?,?,?)"
    ).run(uid(), proj, owner, "owner", "active", t);
    db.prepare(
      "INSERT INTO project_members (id,project_id,user_id,role,status,joined_at) VALUES (?,?,?,?,?,?)"
    ).run(uid(), proj, partner, "family", "active", t);

    /* 空间与点位 */
    ROOMS.forEach(([id, name, area], i) => {
      db.prepare(
        "INSERT INTO project_spaces (id,project_id,property_id,property_room_id,name,area_sqm,sort) VALUES (?,?,?,?,?,?,?)"
      ).run(id, proj, prop, id.replace("sp_", "rm_"), name, area, i);
    });
    POINTS.forEach(([space, type, label, h, spec], i) => {
      db.prepare(
        `INSERT INTO project_space_points (id,project_id,space_id,type,label,height_mm,spec,note,sort,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`
      ).run(uid(), proj, space, type, label, h, spec, null, i, t);
    });

    /* 工序模板 + 项目工作流 */
    const tpl = "wt_full";
    const tplVer = "wtv_full_1";
    db.prepare("INSERT INTO workflow_templates (id,name,created_at) VALUES (?,?,?)").run(tpl, "全屋翻新", t);
    db.prepare(
      "INSERT INTO workflow_template_versions (id,template_id,version_no,note,created_at) VALUES (?,?,?,?,?)"
    ).run(tplVer, tpl, 1, "标准全屋翻新工序", t);
    const wf = "pw_home";
    db.prepare(
      "INSERT INTO project_workflows (id,project_id,template_version_id,created_at) VALUES (?,?,?,?)"
    ).run(wf, proj, tplVer, t);

    STAGES.forEach(([name, days, cents], i) => {
      const id = `st_${i + 1}`;
      db.prepare(
        "INSERT INTO workflow_template_stages (id,template_version_id,name,sort,planned_days,checklist_key) VALUES (?,?,?,?,?,?)"
      ).run(uid(), tplVer, name, i, days, name);
      // 前两道已完成、第三道进行中 —— 演示进度用
      const status = i < 2 ? "已完成" : i === 2 ? "进行中" : "待开工";
      const started = i < 2 ? `2026-09-0${i * 3 + 1}T09:00:00.000Z` : i === 2 ? "2026-09-19T09:00:00.000Z" : null;
      const finished = i < 2 ? `2026-09-0${i * 3 + 2}T18:00:00.000Z` : null;
      db.prepare(
        `INSERT INTO workflow_stages (id,project_id,workflow_id,name,sort,planned_days,planned_cents,actual_cents,status,started_at,finished_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`
      ).run(id, proj, wf, name, i, days, cents, i < 2 ? Math.round(cents * 0.92) : 0, status, started, finished);

      // 每道工序两个任务
      for (let k = 0; k < 2; k++) {
        const tid = `tk_${i + 1}_${k + 1}`;
        const tstatus = i < 2 ? "已完成" : i === 2 && k === 0 ? "施工中" : "待施工";
        db.prepare(
          `INSERT INTO tasks (id,project_id,stage_id,title,room,status,note,sort,created_at)
           VALUES (?,?,?,?,?,?,?,?,?)`
        ).run(tid, proj, id, `${name} · ${k === 0 ? "放线定位" : "面层施工"}`, null, tstatus, null, k, t);
        db.prepare(
          `INSERT INTO task_status_history (id,project_id,task_id,from_status,to_status,changed_by,changed_at)
           VALUES (?,?,?,?,?,?,?)`
        ).run(uid(), proj, tid, null, tstatus, owner, t);
      }
    });

    /* 预算 */
    const budgetId = "bg_home";
    const bvId = "bv_home_1";
    db.prepare("INSERT INTO budgets (id,project_id,name,current_version_no) VALUES (?,?,?,?)").run(
      budgetId, proj, "装修预算", 1
    );
    db.prepare(
      "INSERT INTO budget_versions (id,project_id,budget_id,version_no,total_cents,note,created_at) VALUES (?,?,?,?,?,?,?)"
    ).run(bvId, proj, budgetId, 1, 0, "初版预算", t);
    let total = 0;
    BUDGET.forEach(([cat, name, cents], i) => {
      total += cents;
      db.prepare(
        `INSERT INTO budget_items (id,project_id,budget_version_id,category,name,spec,qty_milli,unit,unit_price_cents,amount_cents,sort)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`
      ).run(uid(), proj, bvId, cat, name, null, 1000, "项", cents, cents, i);
    });
    db.prepare("UPDATE budget_versions SET total_cents=? WHERE id=?").run(total, bvId);

    /* 材料单价库 */
    MATERIALS.forEach(([id, name, spec, unit, price, cat]) => {
      db.prepare(
        "INSERT INTO materials (id,name,spec,unit,base_price_cents,category) VALUES (?,?,?,?,?,?)"
      ).run(id, name, spec, unit, price, cat);
    });

    /* 验收模板 + 已有验收记录（水电：第一轮不合格→整改→第二轮合格） */
    Object.entries(CHECKLISTS).forEach(([key, items]) => {
      const tid = `at_${key}`;
      db.prepare("INSERT INTO acceptance_templates (id,key,name,created_at) VALUES (?,?,?,?)").run(
        tid, key, `${key}验收`, t
      );
      items.forEach((text, i) => {
        db.prepare(
          "INSERT INTO acceptance_template_items (id,template_id,text,sort) VALUES (?,?,?,?)"
        ).run(uid(), tid, text, i);
      });
    });

    const accId = "ac_1";
    db.prepare(
      `INSERT INTO acceptances (id,project_id,stage_id,template_id,name,round,status,created_at)
       VALUES (?,?,?,?,?,?,?,?)`
    ).run(accId, proj, "st_1", "at_水电改造", "水电隐蔽工程验收", 2, "部分合格", t);
    CHECKLISTS["水电改造"].forEach((text, i) => {
      const itemId = `ai_1_${i + 1}`;
      db.prepare(
        "INSERT INTO acceptance_items (id,project_id,acceptance_id,text,sort) VALUES (?,?,?,?,?)"
      ).run(itemId, proj, accId, text, i);
      // 第一轮：第 3、5 项不合格
      const bad = i === 2 || i === 4;
      db.prepare(
        `INSERT INTO acceptance_item_results (id,project_id,item_id,round,result,note,photo_file_id,checked_by,checked_at,source)
         VALUES (?,?,?,?,?,?,?,?,?,?)`
      ).run(uid(), proj, itemId, 1, bad ? "不合格" : "合格", bad ? "现场复核" : null, null, "张辉", "2026-09-08T10:00:00.000Z", "miniapp");
      if (bad) {
        // 第二轮已复验合格
        db.prepare(
          `INSERT INTO acceptance_item_results (id,project_id,item_id,round,result,note,photo_file_id,checked_by,checked_at,source)
           VALUES (?,?,?,?,?,?,?,?,?,?)`
        ).run(uid(), proj, itemId, 2, "合格", "整改后复验通过", null, "张辉", "2026-09-12T15:20:00.000Z", "miniapp");
      }
    });

    /* 已花（材料/人工） —— 只追加 */
    const PAYS: [string, number, string, string][] = [
      ["水电材料", 380000, "水电材料（第一批）", "2026-09-03"],
      ["水电人工", 260000, "水电工首期", "2026-09-05"],
      ["瓦工材料", 1280000, "瓷砖到货", "2026-09-15"],
    ];
    PAYS.forEach(([cat, cents, note, day]) => {
      db.prepare(
        `INSERT INTO payment_records (id,project_id,direction,amount_cents,category,note,evidence_file_id,occurred_at,created_at,source,reversal_of_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`
      ).run(uid(), proj, "out", cents, cat, note, null, `${day}T10:00:00.000Z`, t, "desktop", null);
    });

    /* 动态 + 小程序待处理事件（演示单向同步） */
    db.prepare(
      "INSERT INTO activity_logs (id,project_id,actor,kind,text,source,created_at) VALUES (?,?,?,?,?,?,?)"
    ).run(uid(), proj, "张辉", "stage", "水电改造完成，瓦工已进场", "desktop", "2026-09-08T18:00:00.000Z");
    db.prepare(
      "INSERT INTO activity_logs (id,project_id,actor,kind,text,source,created_at) VALUES (?,?,?,?,?,?,?)"
    ).run(uid(), proj, "张辉", "photo", "上传 3 张水电打压照片", "miniapp", "2026-09-10T14:20:00.000Z");

    db.prepare(
      `INSERT INTO outbox_events (id,project_id,event_type,payload,device,status,created_at,processed_at)
       VALUES (?,?,?,?,?,?,?,?)`
    ).run(uid(), proj, "expense.added", JSON.stringify({ category: "瓦工材料", amount_cents: 1280000 }), "iPhone·小程序", "pending", "2026-09-15T11:02:00.000Z", null);
    db.prepare(
      `INSERT INTO outbox_events (id,project_id,event_type,payload,device,status,created_at,processed_at)
       VALUES (?,?,?,?,?,?,?,?)`
    ).run(uid(), proj, "accept.result", JSON.stringify({ acceptance: "水电隐蔽工程验收", round: 2, passed: 2 }), "iPhone·小程序", "pending", "2026-09-12T15:21:00.000Z", null);

    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
