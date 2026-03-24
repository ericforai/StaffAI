# Sampling 能力可视化与降级策略改造计划

## 1. 需求重述

目标是在不依赖客户端升级的前提下，提升 `expert_discussion` 在 `sampling=false` 场景下的可用性与可理解性：

1. 能力协商可视化：UI 明确显示 `sampling on/off`，调用前预检。
2. 自动降级策略：`sampling=false` 时从“并行分配”自动降级为“串行咨询”，并给出“已降级执行”提示。
3. 错误信息产品化：返回结构化错误，包含原因、影响、可选动作。
4. 会话级能力覆盖开关：提供 `auto / force_serial / require_sampling` 的会话级开关，减少环境切换成本。

## 2. 边界与事实

1. 客户端是否支持 sampling 由 MCP 客户端实现决定，仓库内无法直接“让客户端支持”。
2. 当前 MCP 网关 `sampling=false` 会直接抛错，导致硬失败。
3. 当前 Web 讨论链路可在本地 executor（claude/codex/openai）下完成串行执行，可作为自动降级承载路径。

## 3. 风险识别

1. 兼容性风险：新增响应字段可能影响前端类型。
2. 行为预期风险：用户可能误以为仍是并行执行，需要清晰标注“降级”状态。
3. 能力探测风险：Web UI 与 MCP 会话能力来源不同，需要在接口上明确“此状态来自 MCP 会话/本地配置”。
4. 质量风险：仓库暂无测试基建，需要最小化单测策略保证核心决策逻辑正确。

## 4. 实施步骤（按标准流程）

### 阶段 A：开发前测试设计（TDD-RED）

1. 抽离后端能力判定与执行模式决策函数（纯函数）。
2. 新增 Node 内置 `node:test` 单测，覆盖：
   - `sampling=true` + `auto` => `parallel`
   - `sampling=false` + `auto` => `serial_fallback`
   - `require_sampling` + `sampling=false` => `blocked`
   - `force_serial` => `serial_forced`
3. 先跑测试并确认失败（RED）。

### 阶段 B：最小实现（TDD-GREEN）

1. 后端 MCP：
   - 增加能力探测工具/接口（返回 `sampling` 状态与有效执行模式）。
   - 改造 `assign_expert_tasks`/`expert_discussion`：
     - 默认 `executionMode=auto`
     - `sampling=false` 自动降级到串行路径
     - 响应增加 `degraded`、`executionModeApplied`、`capabilities`
2. 后端错误产品化：
   - 统一错误对象：`reason`、`impact`、`actions[]`。
   - `require_sampling` 场景返回结构化错误而非仅字符串。
3. Web API 透传上述元信息。
4. 前端：
   - 增加能力状态展示：`sampling on/off`
   - 调用前预检与提示
   - 新增会话级开关（`auto/force_serial/require_sampling`）
   - 展示“已降级执行”提示条
   - 结构化错误卡片 + 动作按钮（改为自动降级/单专家咨询）

### 阶段 C：质检（/code-review）

1. 代码自审：重点检查空值、类型收敛、错误路径一致性、旧接口兼容。
2. 安全与稳定性检查：避免将内部栈信息透出 UI。
3. 运行构建与 lint（frontend lint、backend build）。

### 阶段 D：维护（/refactor-clean）

1. 清理重复错误映射与状态映射代码。
2. 保持最小变更，不引入额外依赖。
3. 再次运行验证命令。

## 5. 验收标准

1. `sampling=false` 时，多专家任务不再硬失败，可拿到串行结果。
2. UI 能在调用前看到 `sampling` 状态并感知执行模式。
3. 报错可读且可操作（至少 2 个动作选项）。
4. 会话级开关生效并体现在返回结果中。
5. 后端构建和前端 lint 通过，新增单测通过。

## 6. 回滚策略

若改造造成不稳定，可通过将 `executionMode` 默认改回 `require_sampling` 临时恢复原行为，同时保留能力可视化与结构化错误。

