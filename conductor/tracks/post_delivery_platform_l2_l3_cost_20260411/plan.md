# Plan: post_delivery_platform_l2_l3_cost_20260411

**规则：** 本 `plan.md` 仅在 **spec.md §0 门禁通过** 后进入执行；此前仅作占位与评审勾选项。

## Phase 0 — 门禁（未勾选前禁止编码）

- [ ] Delivery Lighthouse 连续 1～2 个版本稳定（定义见 spec §0）
- [ ] 产品 / 工程 sign-off on spec §8 Open Questions（或明确延期项）

## Phase 1 — Workstream A（成本 / Token 看板）

- [ ] 统一 cost/token 字段与写入路径（backend + 类型）
- [ ] HQ 二级页面或运营下钻 UI（MVP 表格 + 一种趋势图）
- [ ] 测试：API 契约 + 至少一条 E2E 或集成测

## Phase 2 — Workstream B 或 C（择一优先，由 kickoff 决定）

**B — L3 可控并行**

- [ ] 并发策略模型 + 默认保守
- [ ] 上限与排队 / 拒绝 UX
- [ ] 与 HITL 不绕过：E2E 场景

**C — L2 共享记忆图**

- [ ] 最小节点/边 schema + 存储选型
- [ ] 单写入源（如任务完成或存模板）
- [ ] 单读取路径（任务/意图侧栏或 debug）

## Phase 3 — 剩余工作流 + 横切

- [ ] 扩展 `delivery-analytics` 或统一观测事件（可选）
- [ ] 文档：`AGENTS.md` / `product.md` 同步路线图状态

---

**Status:** Blocked on Delivery Lighthouse stability · Do not start Phase 1 until Phase 0 complete.
