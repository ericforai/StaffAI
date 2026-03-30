# StaffAI 1.0 前端架构升级报告 (2026-03-30)

## 1. 核心目标
*   **消除技术债**：解决上帝组件（God Components）导致的逻辑臃肿与代码重复。
*   **确立 DDD 模式**：通过物理隔离领域模型、API 契约与 UI 状态，建立稳定的业务内核。
*   **标准化基础设施**：收口 API 调用与格式化逻辑，提升系统健壮性。

## 2. 重大变更概览

### 🔹 领域层重构 (Types Layer)
将单体 `src/types.ts` 拆分为多层级的 `src/types/` 限界上下文：
- **`domain.ts`**：纯粹的业务实体（`Task`, `Agent`, `TaskExecution`）。移除了冗余的 `Summary` 后缀，建立以业务为中心的命名规范。
- **`api.ts`**：确立了基础设施层的通信契约（API Payloads, WebSocket Messages），防止外部协议污染内核。
- **`index.ts`**：提供统一导出入口，并利用类型别名（Type Alias）确保了全站旧代码的 100% 向后兼容。

### 🔹 基础设施层标准化 (Infrastructure)
- **`src/lib/api-client.ts`**：封装了工业级的 `apiClient` 工具。
    - 自动处理基础 URL、JSON 序列化/解析。
    - 建立了统一的 `ApiError` 拦截机制。
    - 统一了 Header 注入（如 `X-Agency-Control`）。
- **`src/hooks/` 全量升级**：
    - `useTaskActions`, `useTasks`, `useAgents` 等核心 Hook 全部移除硬编码 `fetch`，改为调用 `apiClient`。

### 🔹 逻辑层抽离 (Logic & Utils)
- **`src/lib/execution-parser.ts`**：剥离了原本嵌入 UI 的复杂 Markdown 清理与执行结果结构化解析算法。
- **`src/utils/formatters.ts`**：集中管理任务状态、执行模式、审批流等 10 余种展示格式化逻辑，彻底消除页面间的 Copy-Paste 代码。

### 🔹 UI 层原子化拆分 (Atomic Design)
对两个核心页面进行了“外科手术式”拆解：
- **任务详情页 (`TaskDetailPage`)**：代码从 1000+ 行精简至约 150 行。
    - 新增子组件：`TaskInfoCard`, `ExecutionList`, `WorkflowPlanPanel`, `AssignmentPanel`, `EventTimeline`。
- **任务列表页 (`TasksPage`)**：逻辑完全解耦。
    - 新增子组件：`TaskComposer`, `AgentSelector`, `TaskFilter`, `TaskCard`, `ExecutionConfirmModal`。

## 3. 架构收益
| 维度 | 重构前 | 重构后 |
| :--- | :--- | :--- |
| **可维护性** | 业务逻辑与 UI 深度耦合，改动一处易影响全局 | 逻辑高度内聚，页面变为声明式容器 |
| **类型安全** | 实体定义模糊，API 变动极易导致运行时崩溃 | 严格的 DDD 类型契约，`tsc` 全量覆盖 |
| **复用性** | 核心 UI 逻辑无法跨页面复用 | 沉淀了 10+ 个标准原子组件与独立 Service |
| **测试难度** | 几乎无法进行单元测试 | 解析逻辑、API 工具均可独立进行自动化测试 |

## 4. 后续演进建议
1.  **引入状态管理优化**：考虑将 `apiClient` 与 `React Query` 结合，实现更优雅的缓存管理。
2.  **完善 UI 类型层**：在 `src/types/ui.ts` 中进一步细化前端特有的交互状态。
3.  **跨端同步**：利用已确定的领域模型，与 Python Workshop 端建立更严格的数据同步契约。
