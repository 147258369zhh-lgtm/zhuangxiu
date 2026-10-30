// 校验 self-schema.sql：能否建表、组合外键/唯一索引是否真的拦得住脏数据
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

const sql = readFileSync("src/lib/self-schema.sql", "utf8");
const db = new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys = ON;");
db.exec(sql);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
console.log("表数量:", tables.length);
console.log(tables.map(t => t.name).join(" "));

const t = new Date().toISOString();
db.exec(`INSERT INTO users (id,nickname,status,created_at,updated_at) VALUES ('u1','张辉','active','${t}','${t}')`);
db.exec(`INSERT INTO properties (id,name,area_sqm,created_by,created_at) VALUES ('p1','房A',89,'u1','${t}'),('p2','房B',100,'u1','${t}')`);
db.exec(`INSERT INTO projects (id,property_id,name,created_at) VALUES ('pj1','p1','项目A','${t}'),('pj2','p2','项目B','${t}')`);
db.exec(`INSERT INTO property_rooms (id,property_id,name,area_sqm,created_at) VALUES ('r1','p1','客厅',28,'${t}')`);
db.exec(`INSERT INTO project_spaces (id,project_id,property_id,property_room_id,name,area_sqm) VALUES ('s1','pj1','p1','r1','客厅',28)`);
db.exec(`INSERT INTO project_space_points (id,project_id,space_id,type,label,created_at) VALUES ('pt1','pj1','s1','插座','电视墙','${t}')`);

function expectFail(label, fn) {
  try { fn(); console.log("❌ 未被拦住:", label); }
  catch (e) { console.log("✅ 拦住:", label, "→", String(e.message).slice(0, 70)); }
}

// 跨项目塞点位（组合外键应拦住）
expectFail("跨项目引用空间", () => {
  db.exec(`INSERT INTO project_space_points (id,project_id,space_id,type,label,created_at) VALUES ('bad1','pj2','s1','插座','x','${t}')`);
});
// 非法点位类型
expectFail("非法点位类型", () => {
  db.exec(`INSERT INTO project_space_points (id,project_id,space_id,type,label,created_at) VALUES ('bad2','pj1','s1','开关灯','x','${t}')`);
});
// 空间挂到别的房屋（C02 类错误）
expectFail("空间挂到不匹配的房屋", () => {
  db.exec(`INSERT INTO project_spaces (id,project_id,property_id,property_room_id,name,area_sqm) VALUES ('s9','pj1','p2','r1','x',10)`);
});
// 同一项目同一用户两条有效成员
db.exec(`INSERT INTO project_members (id,project_id,user_id,role,status,joined_at) VALUES ('m1','pj1','u1','owner','active','${t}')`);
expectFail("重复有效成员", () => {
  db.exec(`INSERT INTO project_members (id,project_id,user_id,role,status,joined_at) VALUES ('m2','pj1','u1','family','active','${t}')`);
});
// 退出后重新加入应允许
db.exec(`UPDATE project_members SET status='left' WHERE id='m1'`);
db.exec(`INSERT INTO project_members (id,project_id,user_id,role,status,joined_at) VALUES ('m3','pj1','u1','owner','active','${t}')`);
console.log("✅ 退出后可重新加入");

// 文件版本唯一
db.exec(`INSERT INTO files (id,project_id,name,current_version_no,created_at) VALUES ('f1','pj1','水电图',1,'${t}')`);
db.exec(`INSERT INTO file_versions (id,project_id,file_id,version_no,storage_key,created_at) VALUES ('fv1','pj1','f1',1,'k','${t}')`);
expectFail("同一文件重复版本号", () => {
  db.exec(`INSERT INTO file_versions (id,project_id,file_id,version_no,storage_key,created_at) VALUES ('fv2','pj1','f1',1,'k2','${t}')`);
});
// 版本只追加：新版本号可以
db.exec(`INSERT INTO file_versions (id,project_id,file_id,version_no,storage_key,created_at) VALUES ('fv2','pj1','f1',2,'k2','${t}')`);
console.log("✅ 新版本可追加");
console.log("file_versions 行数:", db.prepare("SELECT COUNT(*) n FROM file_versions").get().n);
