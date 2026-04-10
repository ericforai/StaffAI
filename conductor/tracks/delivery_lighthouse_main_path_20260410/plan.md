# Plan: Delivery Lighthouse — 端到端主路径

> 对应规格：`spec.md`。状态：`[ ]` 未开始 · `[~]` 进行中 · `[x]` 完成。

## Phase A — 产品与状态对齐

- [x] **A1** 确认 Open Questions（焦点仲裁、是否允许跳过澄清、产出物 MVP 形态），将结论写入 `spec.md` §8 答复段或 ADR 片段。
- [x] **A2** 梳理 `useIntentWizard` / 后端 intent 状态字段与 spec 表 S1–S4 的映射表（见 `state-mapping.md`）。

## Phase B — Delivery Lighthouse Hero（`/tasks`）

- [x] **B1** 定义 `deriveDeliveryFocus`（`hq/frontend/src/lib/delivery-focus.ts`）。
- [x] **B2** 在 `tasks/page.tsx` 顶部实现 Hero + `data-testid`。
- [x] **B3** 空状态：`deriveDeliveryFocus` `idle` → Primary CTA「发起新任务」锚点 `#delivery-wizard`。

## Phase C — 向导步骤完成态与失败恢复

- [x] **C1** `AdvancedTaskWizard` + `IntentWizardStepRail`：步骤条与 `intent-step-completion-hint`。
- [x] **C2** 统一错误区 `intent-wizard-error` + **重试**（创建 / 澄清 / 确认 / 建任务）。
- [ ] **C3**（可选）跳过澄清 — **不做**（见 spec §8）。

## Phase D — 任务详情：产出物与模板

- [x] **D1** `ArtifactsPanel`：`data-testid="delivery-artifacts-panel"`（空态与列表）。
- [x] **D2** `TaskInfoCard`：模板保存失败内联错误 + **使用上次名称重试**。
- [x] **D3** `waiting_approval`：`delivery-approval-banner` + 链到 `/approvals`。

## Phase E — 验证

- [x] **E1** Playwright：`delivery lighthouse`、`advanced wizard`、`task-risky` 横幅。
- [x] **E2** 手测走查：`manual-qa-report.md`（§3 对照 + Happy path + F1/F2）；缺口 `github-issues-draft.md`。**「手测结果」列须真人勾选签收。**
- [x] **E3** `CI=1 npm run test:e2e` 全绿（随用例增长更新计数；当前 18/18）。

## Phase F — QA 缺口落地（DL-01 / DL-03 / DL-04 + 文档）

- [x] **F1** S0：`AdvancedTaskWizard` — `sessionStorage` + URL `intentId` 恢复；建任务成功后清除。
- [x] **F2** S8：`TaskInfoCard` — 保存模板模态框，替代 `prompt`/`alert`。
- [x] **F3** E2E：mock `POST/GET /api/intents` + **创建 intent 500 → 重试成功** + **S0 简易/高级切换恢复草稿**。
- [x] **F4** 文档：`spec.md` §8–§9、`manual-qa-report.md` 与 DL-02 说明对齐。

## Checkpoint

- 完成 Phase E 后：按 `conductor/workflow.md` 做阶段检查点提交。
