// 全表冒烟：33 张表每张插一行，专门抓 SQLite 的 "foreign key mismatch"
// （组合外键要求父表存在 UNIQUE(project_id,id)；缺了平时不报，一写入就炸）
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

const db = new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys = ON;");
db.exec(readFileSync("src/lib/self-schema.sql", "utf8"));

const T = "2026-10-30T10:00:00.000Z";
const ins = (sql, ...p) => db.prepare(sql).run(...p);

const steps = [
  ["users", () => ins(`INSERT INTO users (id,nickname,status,created_at,updated_at) VALUES ('u1','张辉','active',?,?)`, T, T)],
  ["user_identities", () => ins(`INSERT INTO user_identities (id,user_id,provider,provider_subject,created_at) VALUES ('ui1','u1','wechat','o1',?)`, T)],
  ["properties", () => ins(`INSERT INTO properties (id,name,area_sqm,created_by,created_at) VALUES ('pr1','房A',89,'u1',?)`, T)],
  ["property_rooms", () => ins(`INSERT INTO property_rooms (id,property_id,name,area_sqm,created_at) VALUES ('rm1','pr1','客厅',28,?)`, T)],
  ["projects", () => ins(`INSERT INTO projects (id,property_id,name,created_by,created_at) VALUES ('pj1','pr1','项目A','u1',?)`, T)],
  ["project_members", () => ins(`INSERT INTO project_members (id,project_id,user_id,role,status,joined_at) VALUES ('m1','pj1','u1','owner','active',?)`, T)],
  ["project_spaces", () => ins(`INSERT INTO project_spaces (id,project_id,property_id,property_room_id,name,area_sqm) VALUES ('s1','pj1','pr1','rm1','客厅',28)`)],
  ["project_space_points", () => ins(`INSERT INTO project_space_points (id,project_id,space_id,type,label,created_at) VALUES ('pt1','pj1','s1','插座','电视墙',?)`, T)],
  ["files", () => ins(`INSERT INTO files (id,project_id,name,current_version_no,created_at) VALUES ('f1','pj1','图',1,?)`, T)],
  ["file_versions", () => ins(`INSERT INTO file_versions (id,project_id,file_id,version_no,storage_key,created_at) VALUES ('fv1','pj1','f1',1,'k',?)`, T)],
  ["file_relations", () => ins(`INSERT INTO file_relations (id,project_id,file_id,resource_type,resource_id,created_at) VALUES ('fr1','pj1','f1','point','pt1',?)`, T)],
  ["workflow_templates", () => ins(`INSERT INTO workflow_templates (id,name,created_at) VALUES ('wt1','标准',?)`, T)],
  ["workflow_template_versions", () => ins(`INSERT INTO workflow_template_versions (id,template_id,version_no,created_at) VALUES ('wtv1','wt1',1,?)`, T)],
  ["workflow_template_stages", () => ins(`INSERT INTO workflow_template_stages (id,template_version_id,name,sort,planned_days) VALUES ('wts1','wtv1','水电',0,7)`)],
  ["project_workflows", () => ins(`INSERT INTO project_workflows (id,project_id,template_version_id,created_at) VALUES ('pw1','pj1','wtv1',?)`, T)],
  ["workflow_stages", () => ins(`INSERT INTO workflow_stages (id,project_id,workflow_id,name,sort) VALUES ('st1','pj1','pw1','水电',0)`)],
  ["tasks", () => ins(`INSERT INTO tasks (id,project_id,stage_id,title,created_at) VALUES ('tk1','pj1','st1','放线',?)`, T)],
  ["task_status_history", () => ins(`INSERT INTO task_status_history (id,project_id,task_id,to_status,changed_at) VALUES ('th1','pj1','tk1','待施工',?)`, T)],
  ["task_events", () => ins(`INSERT INTO task_events (id,project_id,task_id,event_type,created_at) VALUES ('te1','pj1','tk1','started',?)`, T)],
  ["budgets", () => ins(`INSERT INTO budgets (id,project_id,name,current_version_no) VALUES ('b1','pj1','预算',1)`)],
  ["budget_versions", () => ins(`INSERT INTO budget_versions (id,project_id,budget_id,version_no,created_at) VALUES ('bv1','pj1','b1',1,?)`, T)],
  ["budget_items", () => ins(`INSERT INTO budget_items (id,project_id,budget_version_id,category,name) VALUES ('bi1','pj1','bv1','水电','材料')`)],
  ["materials", () => ins(`INSERT INTO materials (id,name,unit,base_price_cents) VALUES ('m1','插座','个',2800)`)],
  ["project_materials", () => ins(`INSERT INTO project_materials (id,project_id,material_id,updated_at) VALUES ('pm1','pj1','m1',?)`, T)],
  ["payment_records", () => ins(`INSERT INTO payment_records (id,project_id,amount_cents,category,occurred_at,created_at) VALUES ('pay1','pj1',1000,'水电',?,?)`, T, T)],
  ["acceptance_templates", () => ins(`INSERT INTO acceptance_templates (id,key,name,created_at) VALUES ('at1','水电','水电验收',?)`, T)],
  ["acceptance_template_items", () => ins(`INSERT INTO acceptance_template_items (id,template_id,text) VALUES ('ati1','at1','打压 30 分钟')`)],
  ["acceptances", () => ins(`INSERT INTO acceptances (id,project_id,stage_id,template_id,name,created_at) VALUES ('ac1','pj1','st1','at1','水电验收',?)`, T)],
  ["acceptance_items", () => ins(`INSERT INTO acceptance_items (id,project_id,acceptance_id,text) VALUES ('ai1','pj1','ac1','打压 30 分钟')`)],
  ["acceptance_item_results", () => ins(`INSERT INTO acceptance_item_results (id,project_id,item_id,round,result,checked_at) VALUES ('ar1','pj1','ai1',1,'合格',?)`, T)],
  ["activity_logs", () => ins(`INSERT INTO activity_logs (id,project_id,kind,text,created_at) VALUES ('al1','pj1','x','y',?)`, T)],
  ["audit_logs", () => ins(`INSERT INTO audit_logs (id,action,created_at) VALUES ('au1','test',?)`, T)],
  ["outbox_events", () => ins(`INSERT INTO outbox_events (id,project_id,event_type,created_at) VALUES ('oe1','pj1','photo.added',?)`, T)],
];

let fail = 0;
for (const [name, fn] of steps) {
  try { fn(); console.log("✅", name); }
  catch (e) { fail++; console.log("❌", name, "→", e.message.slice(0, 100)); }
}
const count = db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get().n;
console.log(`\n表 ${count} 张 · 冒烟 ${steps.length} 张 · 失败 ${fail}`);
if (fail > 0) process.exit(1);
