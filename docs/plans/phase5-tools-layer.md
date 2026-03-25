# Phase 5 Planning: Tools & System Connection Layer

## 1. 概述 (Overview)
Phase 5 旨在建立真实、安全的工具执行层。将目前的模拟执行 (Mock) 替换为真实的系统交互，包括文件系统、版本控制和质量保障工具。同时，引入严密的权限控制和高风险操作审批机制。

## 2. 核心目标 (Core Goals)
- **标准化工具定义**：引入参数 Schema 校验 (Zod)。
- **工具网关 (Tool Gateway)**：实现真实的 `executeTool`、`listTools`、`checkPermission` 和 `auditToolCall`。
- **首批核心工具集**：实现 `FileRead`, `FileWrite`, `GitRead`, `GitDiff`, `TestRunner` 的真实功能。
- **权限与治理**：基于角色 (RBAC) 和风险等级 (Risk Level) 的工具访问控制。
- **持久化审计日志**：完整记录每次工具调用的输入、输出、状态及风险。

## 3. 任务拆解 (Task Breakdown)

### Task 5.1: 工具定义抽象与参数校验 (Tool Definition & Validation)
- 在 `hq/backend/src/shared/task-types.ts` 中增强 `ToolDefinition`。
- 引入 `zod` 用于定义和验证工具输入参数。
- 创建 `BaseTool` 基类或接口，定义工具执行的标准生命周期。

### Task 5.2: 增强型工具网关 (Advanced Tool Gateway)
- 重构 `ToolGateway` 以支持异步真实执行。
- 实现 `checkPermission` 逻辑，对接角色权限矩阵。
- 集成 `Store` 以持久化 `ToolCallLog`。
- 实现工具执行前后的钩子 (Hooks)，用于审计和风险拦截。

### Task 5.3: 首批系统工具实现 (Real Tool Implementations)
- **FileReadTool**: 递归读取、单文件读取、存在性检查。
- **FileWriteTool** (HIGH RISK): 写入/修改文件，需沙箱路径限制。
- **GitReadTool**: 获取当前分支、提交记录。
- **GitDiffTool**: 差异对比。
- **TestRunnerTool**: 执行指定的测试命令 (npm test/node --test)。

### Task 5.4: 工具权限模型 (Tool Permission Model)
- 定义 `RoleToolMatrix`，明确不同角色 (Architect, Developer, Reviewer 等) 的工具访问权限。
- 区分 `LOW`, `MEDIUM`, `HIGH` 风险等级的默认处理策略。

### Task 5.5: 高风险工具治理 (High-Risk Governance)
- 实现拦截机制：当调用 `HIGH` 风险工具且未获得显式 `approvalGranted` 时，网关返回 `blocked` 状态并持久化日志（与任务维度 `waiting_approval` 区分）。
- HTTP 层：`approvalGranted: true` 仅在同 `taskId` 下存在 **已批准** 的 `ApprovalRecord` 时生效（见 `api/tools.ts` → `resolveToolApprovalClaim`）。

### Task 5.6: 工具调用审计日志 (Audit Logging)
- 记录详细的 `input` (对低风险工具) 和 `inputSummary` (对高风险/大数据量工具)。
- 记录 `executionId` 和 `taskId` 以供追溯。

## 4. 验收标准 (Acceptance Criteria)
- [ ] 所有 5 个核心工具均有真实的单元测试并通过。
- [ ] 调用 `FileWrite` 时，若无审批则被拦截并记录为 `blocked`。
- [ ] 审计日志包含完整的调用链信息。
- [ ] 工具网关能正确识别并拒绝未授权角色的调用。
- [ ] 代码覆盖率保持在 80% 以上。

## 5. 风险与对策 (Risks & Mitigations)
- **风险**: 真实文件操作可能破坏开发环境。**对策**: 实施严格的路径白名单 (Project Root) 和写操作审计。
- **风险**: 测试执行可能陷入死循环。**对策**: 引入执行超时 (Timeout) 机制。
