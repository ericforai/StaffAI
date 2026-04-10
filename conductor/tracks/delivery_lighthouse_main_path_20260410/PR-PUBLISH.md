# 合并 / 发布说明（Delivery Lighthouse + E2E）

## 发布前验证（必跑）

```bash
cd hq/frontend && CI=1 npm run test:e2e
```

期望：**15/15 通过**（`next start` 由 Playwright `webServer` 拉起）。

可选：

```bash
cd hq/frontend && npm run build
cd hq/backend && npm run test
```

## 分支与 PR 建议

当前仓库若存在大量**与本次交付无关**的未提交改动（例如 `.ai/approvals/*.json`、`tasks.json` 等运行时文件），**不要**整仓一把提交。

推荐做法：

1. 新建分支：`git checkout -b feat/delivery-lighthouse-qa-docs`（名称自定）。
2. **仅暂存**与交付相关的路径，例如：
   - `conductor/tracks/delivery_lighthouse_main_path_20260410/**`
   - `conductor/product.md`（若含 Delivery Lighthouse 索引）
   - `hq/frontend/` 下：Delivery Lighthouse 实现、Playwright、`playwright.config.ts`、相关组件与 `lib/delivery-focus.ts`
   - `hq/backend/` 中若含 CORS/E2E 相关小改则按需纳入
3. 提交信息示例：  
   `feat(hq): delivery lighthouse hero, wizard retry, e2e hardening + QA docs`
4. 推送并开 PR：`gh pr create` 或在网页创建，描述中附上：
   - 本目录 `manual-qa-report.md` 链接
   - `CI=1 npm run test:e2e` 结果截图或 CI job 链接
   - 将 `github-issues-draft.md` 中条目转为正式 Issue 的跟踪链接（可选）

## PR 描述模板（粘贴用）

```markdown
## Summary
- 任务页「交付主线」Hero、`deriveDeliveryFocus` 与高级向导步骤/重试。
- 任务详情审批横幅、模板保存失败重试、Artifacts testid。
- Playwright：生产态 `next start`、API mock 与 15 条用例。
- Conductor：`spec/plan`、手测表、Issue 草稿、团队同步文案。

## Test plan
- [ ] `cd hq/frontend && CI=1 npm run test:e2e`
- [ ] （可选）产品按 `conductor/tracks/delivery_lighthouse_main_path_20260410/manual-qa-report.md` 手测签署

## Follow-ups
- 见 `github-issues-draft.md`（DL-01 … DL-05）
```
