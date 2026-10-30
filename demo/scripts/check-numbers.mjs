// 端到端校验：从库里算出应有数字，再和页面渲染出来的数字比对
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(".data/self.db");
const all = (s, ...p) => db.prepare(s).all(...p);
const get = (s, ...p) => db.prepare(s).get(...p);

const pj = get("SELECT * FROM projects ORDER BY created_at LIMIT 1");
const byType = Object.fromEntries(
  all("SELECT type,COUNT(*) n FROM project_space_points WHERE project_id=? GROUP BY type", pj.id).map(r => [r.type, r.n])
);
const pts = get("SELECT COUNT(*) n FROM project_space_points WHERE project_id=?", pj.id).n;

// 与 src/lib/self.ts 的 computeBom 同一套规则
let qty = {};
const bump = (id, v) => (qty[id] = (qty[id] ?? 0) + Math.round(v * 1000));
const main = [["插座","m_socket"],["开关","m_switch"],["灯具","m_light"],["水口","m_ppr"],["网口","m_net"]];
for (const [t, m] of main) if (byType[t]) bump(m, byType[t]);
bump("m_box", (byType["插座"]??0)+(byType["开关"]??0)+(byType["网口"]??0));
const wire = (byType["插座"]??0)*3.5 + (byType["开关"]??0)*3.5 + (byType["灯具"]??0)*4;
bump("m_wire", wire);
if (byType["水口"]) bump("m_pprpipe", byType["水口"]*3);
if (byType["网口"]) bump("m_netline", byType["网口"]*8);
bump("m_conduit", wire/2.5);

const mats = all("SELECT * FROM materials");
const ov = Object.fromEntries(all("SELECT * FROM project_materials WHERE project_id=?", pj.id).map(r => [r.material_id, r]));
let bomTotal = 0;
const rows = [];
for (const m of mats) {
  if (!qty[m.id]) continue;
  const price = ov[m.id]?.unit_price_cents ?? m.base_price_cents;
  const loss = ov[m.id]?.loss_rate_bp ?? 500;
  const amount = Math.round(qty[m.id] * price * (10000 + loss) / 1000 / 10000);
  bomTotal += amount;
  rows.push({ name: m.name, qty: Math.round(qty[m.id]/10)/100, unit: m.unit, price, amount });
}
const bv = get("SELECT * FROM budget_versions ORDER BY version_no DESC LIMIT 1");
const items = all("SELECT * FROM budget_items WHERE budget_version_id=?", bv.id);
const budgetTotal = items.reduce((s,i) => s + (i.category === "水电材料" ? bomTotal : i.amount_cents), 0);
const spent = get("SELECT COALESCE(SUM(amount_cents),0) s FROM payment_records WHERE project_id=? AND direction='out'", pj.id).s;
const yuan = c => (c/100).toLocaleString("zh-CN", { maximumFractionDigits: 0 });

console.log(`点位 ${pts} 个 · 分布 ${JSON.stringify(byType)}`);
console.log(`BOM 合计 ¥${yuan(bomTotal)}`);
for (const r of rows) console.log(`  ${r.name.padEnd(14)} ${String(r.qty).padStart(6)}${r.unit}  ¥${(r.price/100).toFixed(2)}  = ¥${yuan(r.amount)}`);
console.log(`预算合计 ¥${yuan(budgetTotal)} / 已花 ¥${yuan(spent)} / 剩余 ¥${yuan(budgetTotal - spent)}`);

// 页面里必须出现的数字
const must = [yuan(bomTotal), yuan(budgetTotal), yuan(spent), yuan(budgetTotal - spent)];
console.log("\n页面应包含:", must.join(" , "));
export { must };
