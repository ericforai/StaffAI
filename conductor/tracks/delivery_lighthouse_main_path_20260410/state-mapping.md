# Intent wizard state ↔ UI（S1–S4）

| `useIntentWizard` | `RequirementDraft.status`（典型） | 向导 Step | 界面 |
|-------------------|-------------------------------------|-----------|------|
| `createIntent` 成功 | `clarifying` 等 | 1 + draft | ClarificationPanel |
| `clarify` / stream 完成且 `isComplete` | 进入设计就绪流 | 2 | DesignConfirmPanel |
| `confirmDesign` + `generate-plan` | `plan_ready` | 3 | PlanPreviewPanel |
| `create-task` API | — | — | 跳转任务详情 |

具体 `status` 字符串以后端 `RequirementDraft` 为准；前端 `loadIntent` 已按 `plan_ready` / `design_ready` / `design_approved` 推导 step。
