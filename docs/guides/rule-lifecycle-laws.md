# 法则生命周期管理（Rule Lifecycle Laws）

## 1. 目的

定义项目法则从提出到废弃的完整生命周期，确保规则系统可演进、可审计、可回溯。

## 2. 适用范围

- 适用于 `docs/guides/` 下所有“法则类”文档。
- 适用于新增、修订、合并、废弃等所有规则变更行为。

## 3. 生命周期状态

每条法则必须处于以下状态之一：

1. `Draft`：草案，尚未进入强约束。
2. `Active`：生效，默认必须遵守。
3. `Deprecated`：已废弃，不再推荐执行。
4. `Superseded`：被新法则替代，旧法则仅作历史参考。

## 4. 生命周期主法则

### LAW-LIFE-001
- Rule: 每条法则必须有唯一 `Rule ID` 与明确状态。
- Why: 防止规则冲突和追溯失败。
- Trigger: 新增或修改任意法则时。
- Required Actions:
  - 为法则分配唯一 ID（建议前缀与主题一致）。
  - 在条目中标注当前状态。
- Anti-patterns:
  - 使用重复 ID。
  - 不标状态直接发布。
- Verification:
  - 检查文档中每条法则都含 `Rule ID` 与 `Status` 字段。
- Exceptions:
  - 无。

### LAW-LIFE-002
- Rule: 法则从 `Draft` 转 `Active` 必须附带可验证标准。
- Why: 没有验证标准的规则无法执行。
- Trigger: 准备将草案法则生效时。
- Required Actions:
  - 定义至少 1 个可操作的验证动作。
  - 明确“通过/不通过”判定条件。
- Anti-patterns:
  - 只写方向，不写验收。
- Verification:
  - 能用 checklist 直接判定法则是否满足。
- Exceptions:
  - 无。

### LAW-LIFE-003
- Rule: 任何法则修订必须记录变更动机与影响范围。
- Why: 让团队理解“为什么改”，避免隐性破坏。
- Trigger: 修改 `Active` 法则内容时。
- Required Actions:
  - 在文档 `Changelog` 记录日期、改动点、动机。
  - 标注影响对象（人、流程、模块）。
- Anti-patterns:
  - 直接改正文，不记录历史。
- Verification:
  - `Changelog` 中可找到对应条目。
- Exceptions:
  - 纯错别字修正可简写为 `typo fix`。

### LAW-LIFE-004
- Rule: 废弃法则必须显式标记 `Deprecated`，禁止静默删除。
- Why: 删除会导致历史决策链断裂。
- Trigger: 旧法则不再适用时。
- Required Actions:
  - 保留原条目并标注 `Deprecated`。
  - 说明废弃原因与生效日期。
  - 若有替代规则，写明替代 `Rule ID`。
- Anti-patterns:
  - 直接删掉旧法则。
- Verification:
  - 文档中可检索到废弃标识与原因。
- Exceptions:
  - 涉及安全泄露信息时可删除正文，但需保留占位与说明。

### LAW-LIFE-005
- Rule: 被替代法则必须标注 `Superseded by <Rule ID>`。
- Why: 建立清晰的规则继承关系。
- Trigger: 新法则替代旧法则时。
- Required Actions:
  - 在旧法则下加入替代关系。
  - 在新法则中加入 `Replaces` 字段。
- Anti-patterns:
  - 只发布新法则，不处理旧法则引用。
- Verification:
  - 新旧法则可双向追溯。
- Exceptions:
  - 无。

## 5. 变更流程（执行顺序）

1. 提案：创建 `Draft` 法则，描述问题和约束。
2. 验证设计：补齐可执行验证标准。
3. 生效：状态改为 `Active`，进入默认约束。
4. 维护：按实践反馈持续修订并记录日志。
5. 替代或废弃：使用 `Superseded` / `Deprecated` 明确收口。

## 6. 最低门禁（提交前）

1. 每条法则有 ID 与状态。
2. `Active` 法则都有验证标准。
3. 变更有 `Changelog` 记录。
4. `Deprecated/Superseded` 有原因和关联规则。
5. 已同步 `AGENTS.md` 索引。

## 7. Changelog

- 2026-03-26: 初版发布，定义规则生命周期状态、变更流程和最低门禁。
