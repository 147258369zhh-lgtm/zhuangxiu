-- ============================================================
-- 自装线真库 · 33 张表（SQLite）
-- 纪律三条：① 每张业务表带 project_id + UNIQUE(project_id,id)，引用走组合外键
--           ② 版本只追加不覆盖   ③ 状态 ≠ 历史
-- 金额一律 INTEGER 分；数量一律 INTEGER 千分之一（qty_milli），不用浮点
-- ============================================================

-- ---------- 1. 身份与项目（6） ----------
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  nickname    TEXT NOT NULL,
  phone       TEXT UNIQUE,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','closed')),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_identities (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider        TEXT NOT NULL CHECK (provider IN ('wechat','phone','device')),
  provider_subject TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  UNIQUE (provider, provider_subject)
);

CREATE TABLE IF NOT EXISTS properties (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  address     TEXT,
  area_sqm    REAL NOT NULL DEFAULT 0,
  layout      TEXT,
  created_by  TEXT REFERENCES users(id) ON DELETE RESTRICT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS property_rooms (
  id           TEXT PRIMARY KEY,
  property_id  TEXT NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  name         TEXT NOT NULL,
  area_sqm     REAL NOT NULL DEFAULT 0,
  sort         INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  UNIQUE (property_id, id)
);

CREATE TABLE IF NOT EXISTS projects (
  id                  TEXT PRIMARY KEY,
  property_id         TEXT NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  name                TEXT NOT NULL,
  template            TEXT NOT NULL DEFAULT '全屋翻新',
  start_date          TEXT,
  planned_end         TEXT,
  status              TEXT NOT NULL DEFAULT 'planning'
                      CHECK (status IN ('planning','active','paused','done','archived')),
  created_by          TEXT REFERENCES users(id) ON DELETE RESTRICT,
  created_at          TEXT NOT NULL,
  -- 支撑 property_access_grants 类组合外键（自装线暂不用，但唯一约束先建好，扩表不迁数据）
  UNIQUE (id, property_id),
  UNIQUE (id)
);

-- project_members.role 故意用枚举而非 roles/permissions 表：
-- 自装线是「一个业主 + 几个家人」，装企线上线时再补角色体系，届时扩表不迁数据。
CREATE TABLE IF NOT EXISTS project_members (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role        TEXT NOT NULL DEFAULT 'family' CHECK (role IN ('owner','family','viewer')),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('invited','active','left')),
  joined_at   TEXT NOT NULL,
  UNIQUE (project_id, id)
);

-- 同一项目同一用户只能有一条有效成员关系；退出后保留历史，且允许重新加入
CREATE UNIQUE INDEX IF NOT EXISTS uq_project_member_active
  ON project_members (project_id, user_id)
  WHERE status IN ('invited','active');

-- ---------- 2. 空间与点位（2） ----------
CREATE TABLE IF NOT EXISTS project_spaces (
  id               TEXT PRIMARY KEY,
  project_id       TEXT NOT NULL,
  property_id      TEXT NOT NULL,
  property_room_id TEXT,
  name             TEXT NOT NULL,
  area_sqm         REAL NOT NULL DEFAULT 0,
  sort             INTEGER NOT NULL DEFAULT 0,
  UNIQUE (project_id, id),
  -- 空间必须属于项目的同一套房（防跨房屋授权错误，见对话 C02）
  FOREIGN KEY (project_id, property_id) REFERENCES projects(id, property_id) ON DELETE RESTRICT,
  FOREIGN KEY (property_id, property_room_id) REFERENCES property_rooms(property_id, id) ON DELETE RESTRICT
);

-- 点位只挂 project_space_id（M1 无图纸版本模型）；M2 上画布时再加 drawing_points 并迁一次
CREATE TABLE IF NOT EXISTS project_space_points (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  space_id    TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('插座','开关','灯具','水口','网口')),
  label       TEXT,
  height_mm   INTEGER,
  spec        TEXT,
  note        TEXT,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  UNIQUE (project_id, id),
  FOREIGN KEY (project_id, space_id) REFERENCES project_spaces(project_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ix_points_space ON project_space_points (project_id, space_id);

-- ---------- 3. 文件（3） ----------
CREATE TABLE IF NOT EXISTS files (
  id                 TEXT PRIMARY KEY,
  project_id         TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  name               TEXT NOT NULL,
  current_version_no INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL,
  UNIQUE (project_id, id),
  UNIQUE (project_id, id, current_version_no)
);

CREATE TABLE IF NOT EXISTS file_versions (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL,
  file_id     TEXT NOT NULL,
  version_no  INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  mime        TEXT,
  size_bytes  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  UNIQUE (project_id, id),
  UNIQUE (project_id, file_id, version_no),
  FOREIGN KEY (project_id, file_id) REFERENCES files(project_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS file_relations (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL,
  file_id       TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('project','space','point','task','acceptance','payment','material')),
  resource_id   TEXT NOT NULL,
  relation_type TEXT NOT NULL DEFAULT 'evidence',
  created_at    TEXT NOT NULL,
  FOREIGN KEY (project_id, file_id) REFERENCES files(project_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ix_file_rel ON file_relations (project_id, resource_type, resource_id);

-- ---------- 4. 工序与任务（8） ----------
CREATE TABLE IF NOT EXISTS workflow_templates (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 模板必须有版本：平台改模板不能影响在建项目（对话 C 类问题）
CREATE TABLE IF NOT EXISTS workflow_template_versions (
  id          TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES workflow_templates(id) ON DELETE RESTRICT,
  version_no  INTEGER NOT NULL,
  note        TEXT,
  created_at  TEXT NOT NULL,
  UNIQUE (template_id, version_no)
);

CREATE TABLE IF NOT EXISTS workflow_template_stages (
  id                  TEXT PRIMARY KEY,
  template_version_id TEXT NOT NULL REFERENCES workflow_template_versions(id) ON DELETE RESTRICT,
  name                TEXT NOT NULL,
  sort                INTEGER NOT NULL,
  planned_days        INTEGER NOT NULL DEFAULT 0,
  checklist_key       TEXT
);

CREATE TABLE IF NOT EXISTS project_workflows (
  id                  TEXT PRIMARY KEY,
  project_id          TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  template_version_id TEXT NOT NULL REFERENCES workflow_template_versions(id) ON DELETE RESTRICT,
  created_at          TEXT NOT NULL,
  UNIQUE (project_id, id)
);

CREATE TABLE IF NOT EXISTS workflow_stages (
  id             TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL,
  workflow_id    TEXT NOT NULL,
  name           TEXT NOT NULL,
  sort           INTEGER NOT NULL,
  planned_days   INTEGER NOT NULL DEFAULT 0,
  planned_cents  INTEGER NOT NULL DEFAULT 0,
  actual_cents   INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT '待开工' CHECK (status IN ('待开工','进行中','已完成')),
  started_at     TEXT,
  finished_at    TEXT,
  UNIQUE (project_id, id),
  FOREIGN KEY (project_id, workflow_id) REFERENCES project_workflows(project_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL,
  stage_id    TEXT NOT NULL,
  title       TEXT NOT NULL,
  room        TEXT,
  status      TEXT NOT NULL DEFAULT '待施工' CHECK (status IN ('待施工','施工中','已完成')),
  note        TEXT,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  UNIQUE (project_id, id),
  FOREIGN KEY (project_id, stage_id) REFERENCES workflow_stages(project_id, id) ON DELETE RESTRICT
);

-- 状态 ≠ 历史：当前状态只说明现在，独立历史表才答得出「这一步拖了几天」
CREATE TABLE IF NOT EXISTS task_status_history (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL,
  task_id     TEXT NOT NULL,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  changed_by  TEXT,
  changed_at  TEXT NOT NULL,
  FOREIGN KEY (project_id, task_id) REFERENCES tasks(project_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ix_tsh_task ON task_status_history (project_id, task_id, changed_at);

CREATE TABLE IF NOT EXISTS task_events (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL,
  task_id     TEXT NOT NULL,
  event_type  TEXT NOT NULL,
  payload     TEXT,
  actor       TEXT,
  source      TEXT NOT NULL DEFAULT 'desktop' CHECK (source IN ('desktop','miniapp')),
  created_at  TEXT NOT NULL,
  FOREIGN KEY (project_id, task_id) REFERENCES tasks(project_id, id) ON DELETE RESTRICT
);

-- ---------- 5. 预算（3） ----------
CREATE TABLE IF NOT EXISTS budgets (
  id                 TEXT PRIMARY KEY,
  project_id         TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  name               TEXT NOT NULL DEFAULT '装修预算',
  current_version_no INTEGER NOT NULL DEFAULT 1,
  UNIQUE (project_id, id)
);

CREATE TABLE IF NOT EXISTS budget_versions (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL,
  budget_id    TEXT NOT NULL,
  version_no   INTEGER NOT NULL,
  total_cents  INTEGER NOT NULL DEFAULT 0,
  note         TEXT,
  created_at   TEXT NOT NULL,
  UNIQUE (project_id, id),
  UNIQUE (project_id, budget_id, version_no),
  FOREIGN KEY (project_id, budget_id) REFERENCES budgets(project_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS budget_items (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL,
  budget_version_id TEXT NOT NULL,
  category          TEXT NOT NULL,
  name              TEXT NOT NULL,
  spec              TEXT,
  qty_milli         INTEGER NOT NULL DEFAULT 0,
  unit              TEXT,
  unit_price_cents  INTEGER NOT NULL DEFAULT 0,
  amount_cents      INTEGER NOT NULL DEFAULT 0,
  sort              INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (project_id, budget_version_id) REFERENCES budget_versions(project_id, id) ON DELETE RESTRICT
);

-- ---------- 6. 材料与开销（3） ----------
CREATE TABLE IF NOT EXISTS materials (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  spec             TEXT,
  unit             TEXT NOT NULL,
  base_price_cents INTEGER NOT NULL DEFAULT 0,
  category         TEXT NOT NULL DEFAULT '主材'
);

-- 用户改过的单价/损耗/已买状态落在这里（不写死在代码里 —— 地区价差 30%+）
CREATE TABLE IF NOT EXISTS project_materials (
  id               TEXT PRIMARY KEY,
  project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  material_id      TEXT NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  qty_milli        INTEGER NOT NULL DEFAULT 0,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  loss_rate_bp     INTEGER NOT NULL DEFAULT 500,
  status           TEXT NOT NULL DEFAULT '未买' CHECK (status IN ('未买','已买','已到货')),
  note             TEXT,
  updated_at       TEXT NOT NULL,
  UNIQUE (project_id, id),
  UNIQUE (project_id, material_id)
);

-- 只追加：小程序记一笔 = 一条记录；撤销用反向记录，不删不改
CREATE TABLE IF NOT EXISTS payment_records (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  direction         TEXT NOT NULL DEFAULT 'out' CHECK (direction IN ('out','in')),
  amount_cents      INTEGER NOT NULL,
  category          TEXT NOT NULL,
  note              TEXT,
  evidence_file_id  TEXT,
  occurred_at       TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  source            TEXT NOT NULL DEFAULT 'desktop' CHECK (source IN ('desktop','miniapp')),
  reversal_of_id    TEXT,
  UNIQUE (project_id, id)
);
CREATE INDEX IF NOT EXISTS ix_pay ON payment_records (project_id, occurred_at);

-- ---------- 7. 验收（5） ----------
CREATE TABLE IF NOT EXISTS acceptance_templates (
  id         TEXT PRIMARY KEY,
  key        TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS acceptance_template_items (
  id          TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES acceptance_templates(id) ON DELETE RESTRICT,
  text        TEXT NOT NULL,
  sort        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS acceptances (
  id                  TEXT PRIMARY KEY,
  project_id          TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  stage_id            TEXT,
  template_id         TEXT REFERENCES acceptance_templates(id) ON DELETE RESTRICT,
  name                TEXT NOT NULL,
  round               INTEGER NOT NULL DEFAULT 1,
  status              TEXT NOT NULL DEFAULT '待验收' CHECK (status IN ('待验收','部分合格','全部合格')),
  created_at          TEXT NOT NULL,
  UNIQUE (project_id, id),
  FOREIGN KEY (project_id, stage_id) REFERENCES workflow_stages(project_id, id) ON DELETE RESTRICT
);

-- 检查项快照：模板以后改了，历史验收不能跟着变
CREATE TABLE IF NOT EXISTS acceptance_items (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL,
  acceptance_id TEXT NOT NULL,
  text          TEXT NOT NULL,
  sort          INTEGER NOT NULL DEFAULT 0,
  UNIQUE (project_id, id),
  FOREIGN KEY (project_id, acceptance_id) REFERENCES acceptances(project_id, id) ON DELETE RESTRICT
);

-- 每轮复验 = 新结果行，绝不覆盖上一轮
CREATE TABLE IF NOT EXISTS acceptance_item_results (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL,
  item_id     TEXT NOT NULL,
  round       INTEGER NOT NULL DEFAULT 1,
  result      TEXT NOT NULL CHECK (result IN ('合格','不合格')),
  note        TEXT,
  photo_file_id TEXT,
  checked_by  TEXT,
  checked_at  TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'miniapp' CHECK (source IN ('desktop','miniapp')),
  FOREIGN KEY (project_id, item_id) REFERENCES acceptance_items(project_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ix_air_item ON acceptance_item_results (project_id, item_id, round);

-- ---------- 8. 记录与同步（3） ----------
CREATE TABLE IF NOT EXISTS activity_logs (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  actor      TEXT,
  kind       TEXT NOT NULL,
  text       TEXT NOT NULL,
  source     TEXT NOT NULL DEFAULT 'desktop' CHECK (source IN ('desktop','miniapp')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_act ON activity_logs (project_id, created_at DESC);

-- 审计日志只追加：不给业务路径任何 UPDATE/DELETE
CREATE TABLE IF NOT EXISTS audit_logs (
  id         TEXT PRIMARY KEY,
  project_id TEXT,
  actor      TEXT,
  action     TEXT NOT NULL,
  target     TEXT,
  detail     TEXT,
  created_at TEXT NOT NULL
);

-- 事务性 Outbox：手机端事件先落这里，桌面 pull → apply → 标记已处理（幂等靠 id）
CREATE TABLE IF NOT EXISTS outbox_events (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  event_type   TEXT NOT NULL,
  payload      TEXT,
  device       TEXT,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','failed')),
  created_at   TEXT NOT NULL,
  processed_at TEXT
);
CREATE INDEX IF NOT EXISTS ix_outbox ON outbox_events (project_id, status, created_at);
