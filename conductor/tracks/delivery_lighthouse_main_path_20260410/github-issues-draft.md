# GitHub Issues — 草稿（从手测/spec 缺口整理）

复制下列标题与正文到 GitHub New Issue（可打标签 `delivery-lighthouse`、`qa`、`frontend`）。

---

## DL-01 — 简易/高级切换时保留 intent 草稿

**标题：** `[Delivery Lighthouse] 从高级向导切回简易模式时应保留或明确丢弃 intent 草稿`

**正文：**
`spec.md` §3 S0 写明「随时切换模式（不丢已保存草稿则更佳）」。当前行为需在 UI 上验证：切换回简易模式后，再进入高级向导是否仍加载未完成的 `intentId`（URL 参数或本地状态）。若始终丢弃，请在 spec 中改为「显式确认丢弃」并加一句文案避免用户误以为丢数据。

---

## DL-02 — 交付产物：下载 / 外链 MVP

**标题：** `[Delivery Lighthouse] Artifacts：增加复制全文或导出，后续支持下载与外链`

**正文：**
`spec.md` §8 已定 MVP 为结构化正文；§3 S7 仍建议后续支持可下载文件或可点击外链。请在 `ArtifactsPanel` 迭代：至少「复制 Markdown/全文」按钮，再评估 Signed URL 或附件 API。

---

## DL-03 — 存为模板：替换 `prompt` 为内联表单

**标题：** `[UX] 保存为模板使用浏览器 prompt，改为模态框与错误展示一致`

**正文：**
当前 `TaskInfoCard` 使用 `prompt`/`alert`，与 Delivery Lighthouse 内联错误+重试不一致。建议模态输入模板名、成功 toast/内联提示，失败沿用现有 `task-save-template-error` 区域。

---

## DL-04 — E2E：向导错误重试路径

**标题：** `[test] Playwright：覆盖 intent 创建失败与向导重试按钮`

**正文：**
手测报告 F2：对 `POST /api/intents` 或 `clarify` mock 5xx，断言 `intent-wizard-error` 与「重试创建需求」/「重试上次澄清」可恢复。可与现有 `AGENCY_API_URL_RE` mock 模式一致。

---

## DL-05 — PR 检查清单（可改为 PR template 子项）

**标题：** `[chore] HQ 前端合并前跑 production E2E`

**正文：**
合并影响 `hq/frontend` 时，请在 CI 或本地执行：`cd hq/frontend && CI=1 npm run test:e2e`（依赖 `next start`，非 `next dev`）。参见 `playwright.config.ts` 中 `webServer` 说明。
