# 装修管理平台

装修公司（B 端）+ 业主/自装人（C 端）通用的装修管理软件。

- **规划文档**：[`规划.md`](./规划.md) —— 产品定位、架构决策、功能地图、里程碑
- **开源参考**：[`开源参考/`](./开源参考/) —— 11 个调研下载的参考项目（未并入本仓库）

## 仓库结构（pnpm workspace）

```
├── server/        NestJS 后端 API（TypeScript）
├── admin-web/     PC 管理端（Next.js，给装修公司用）
├── app-uniapp/    手机端（uniapp，一套代码 → 微信小程序 + App，给业主/自装人用）
└── 规划.md         产品与技术规划
```

## 决策记录

| 项 | 结论 |
|---|---|
| 手机端 | uniapp 双端（微信小程序 + App） |
| 后端 | NestJS + PostgreSQL + Redis，AI 重活走 Python sidecar |
| 第一期 | B+C 最小闭环：建工地 → 邀请业主 → 看进度/验收打卡 |
