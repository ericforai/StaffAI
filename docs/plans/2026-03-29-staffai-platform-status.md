# AI 员工管理系统开发计划 - 平台状态标注版

> **Status Audit Date**: 2026-03-29
> **Legend**: ✅ DONE | ⚠️ PARTIAL | ❌ MISSING

---

## 文档定位

本文档不再按"从零新建一个全新 AI workforce OS 仓库"来规划，而是改为：

- 第一目标：基于当前 `agency-agents/hq` 的真实代码现状，迭代出平台 1.0 编排内核 ✅ DONE
- 第二目标：为新的产品仓库 `ericforai/StaffAI` 沉淀可迁移的领域模型、模块边界和实施路线 ✅ DONE

也就是说，这份计划既服务当前 HQ 的演进，也服务未来 `StaffAI` 的平台化落地。

---

## 一、当前项目现状判断

### 1.1 当前系统已经具备的基础能力

当前 `hq/` 并不是空白项目，而是已经具备以下平台雏形：

- [✅ DONE] Agent 扫描与注册：`hq/backend/src/scanner.ts`
- [✅ DONE] MCP 工具网关：`hq/backend/src/mcp.ts`
- [✅ DONE] 专家搜索、雇佣、讨论与综合：`hq/backend/src/discussion-service.ts`
- [✅ DONE] 执行模式决策与降级：`hq/backend/src/execution-strategy.ts`
- [✅ DONE] 能力绑定与运行时治理：
  - `hq/backend/src/capability-registry.ts`
  - `hq/backend/src/host-policy.ts`
  - `hq/backend/src/capability-bindings.ts`
  - `hq/backend/src/runtime-state.ts`
- [✅ DONE] Web 指挥台与活动流：
  - `hq/frontend/src/app/page.tsx`
  - `hq/frontend/src/components/*`
  - `hq/frontend/src/hooks/*`
- [✅ DONE] 当前存储方式：
  - 活跃员工、模板、知识库主要以 JSON/文件为主
  - 运行时状态位于 `~/.agency`

### 1.2 当前系统的本质定位

当前系统本质上更像：

- [✅ DONE] 一个多专家讨论与协作控制台
- [✅ DONE] 一个 MCP 能力对外暴露层
- [✅ DONE] 一个本地 CLI 执行器适配入口

它还不是完整的"AI 员工管理系统"，因为以下能力仍不完整：

- [✅ DONE] 统一任务模型
- [✅ DONE] 统一任务状态机
- [✅ DONE] 任务分配与执行记录
- [✅ DONE] 人工审批闭环
- [⚠️ PARTIAL] 结构化记忆体系
- [✅ DONE] 审计与观测闭环

### 1.3 为什么不建议现在推翻重写

不建议立即改成 `Python + FastAPI + PostgreSQL + Redis + LangGraph` 的原因：

- [✅ DONE] 当前代码里已经有可复用的 orchestration/runtime 基础
- [✅ DONE] 当前最关键的问题是边界不清，不是语言不对
- [✅ DONE] 现在推翻会损失已有 MCP、讨论系统、运行时适配、前端控制台等资产
- [✅ DONE] 现阶段更适合把现有后端定义为"平台 1.0 编排内核"

结论：

**继续使用 `TypeScript + Express + MCP SDK` 作为平台 1.0 核心是合理的。**
未来要不要拆数据库、队列、独立 worker，是第二阶段的问题，不是现在的问题。

---

## 二、架构立场

### 2.1 总体路线

采用：

- [✅ DONE] 基于现有 HQ 的增量演进
- [✅ DONE] 平台骨架优先
- [✅ DONE] 轻量 DDD + bounded contexts

### 2.2 什么叫"轻量 DDD"

这里的 DDD 不意味着一开始就引入大量复杂实体、仓储、领域事件和样板代码。

这里的 DDD 只承担四件事：

- [✅ DONE] 划清边界上下文（bounded contexts）
- [✅ DONE] 建立统一术语（ubiquitous language）
- [✅ DONE] 明确每种状态由谁负责
- [✅ DONE] 约束模块之间的依赖方向

### 2.3 核心判断

平台化的关键不是换栈，而是把当前 HQ 从：

- [✅ DONE] "专家讨论系统"

升级为：

- [✅ DONE] "任务创建 -> 路由分配 -> 执行运行 -> 审批治理 -> 记忆沉淀 -> 审计观测"的 AI 员工操作系统内核

---

## 三、目标系统定义

### 3.1 目标

构建一个可渐进演进的 AI 员工管理系统，覆盖六层能力：

- [✅ DONE] 交互入口层
- [✅ DONE] 员工注册与任务编排层
- [✅ DONE] Agent 运行时层
- [⚠️ PARTIAL] 记忆与知识层
- [✅ DONE] 工具与系统连接层
- [✅ DONE] 治理与观测层

### 3.2 平台 1.0 的定义

平台 1.0 不追求"一次性做完通用 AI workforce OS"，而是做到：

- [✅ DONE] 用统一任务模型驱动单专家与多专家协作
- [✅ DONE] 用统一状态机管理任务与执行过程
- [✅ DONE] 用统一运行时接口隔离不同执行器
- [✅ DONE] 用统一审批与审计机制管控高风险动作
- [⚠️ PARTIAL] 用统一记忆入口加载项目上下文和历史结果
- [✅ DONE] 用统一前端控制台查看任务、执行、审批、活动

### 3.3 `StaffAI` 的关系

`StaffAI` 是未来的平台化产品承接仓库。
当前 `agency-agents/hq` 的职责是：

- [✅ DONE] 验证领域模型
- [✅ DONE] 验证交互形态
- [✅ DONE] 验证模块边界
- [✅ DONE] 沉淀平台 1.0 设计

未来迁移到 `StaffAI` 时，优先迁移的是：

- [✅ DONE] 领域模型
- [✅ DONE] 模块边界
- [✅ DONE] API 设计
- [✅ DONE] 状态机
- [✅ DONE] 运行时接口

而不是逐文件照搬现有实现。

---

## 四、Bounded Context 划分

### 4.1 Agent Registry（员工注册中心）

职责：

- [✅ DONE] 管理员工定义
- [✅ DONE] 管理能力、角色、工具权限、适配执行器
- [✅ DONE] 管理 markdown agent 到结构化 profile 的映射

当前基础：

- [✅ DONE] `scanner.ts`
- [✅ DONE] `types.ts`
- [✅ DONE] agent markdown 文件

未来演进：

- [⚠️ PARTIAL] 从"纯 markdown prompt 描述"升级为"markdown + structured metadata"双轨模型

核心对象：

- [✅ DONE] `AgentProfile`
- [✅ DONE] `AgentCapability`
- [✅ DONE] `AgentToolPolicy`
- [✅ DONE] `AgentExecutionPreference`

### 4.2 Task Orchestration（任务编排）

职责：

- [✅ DONE] 创建任务
- [✅ DONE] 路由任务
- [✅ DONE] 决定单人/串行/并行执行
- [✅ DONE] 追踪任务状态
- [✅ DONE] 生成任务分配

当前基础：

- [✅ DONE] `discussion-service.ts`
- [✅ DONE] `execution-strategy.ts`

未来演进：

- [✅ DONE] 从"discussion"概念升级为"task orchestration"概念

核心对象：

- [✅ DONE] `Task`
- [✅ DONE] `TaskAssignment`
- [✅ DONE] `WorkflowPlan`
- [✅ DONE] `RoutingDecision`

### 4.3 Runtime Execution（运行时执行）

职责：

- [✅ DONE] 按任务计划调用执行器
- [✅ DONE] 执行单步、串行、多步任务
- [✅ DONE] 管理超时、重试、取消、暂停/恢复预留能力
- [✅ DONE] 回传结构化执行结果

当前基础：

- [✅ DONE] 本地 Codex / Claude CLI 执行能力
- [✅ DONE] `runtime-state.ts`
- [✅ DONE] 执行器选择与降级逻辑

核心对象：

- [✅ DONE] `Execution`
- [✅ DONE] `ExecutionStep`
- [✅ DONE] `RuntimeAdapter`
- [✅ DONE] `ExecutionResult`

### 4.4 Memory & Knowledge（记忆与知识）

职责：

- [⚠️ PARTIAL] 管理项目上下文
- [⚠️ PARTIAL] 管理任务上下文
- [⚠️ PARTIAL] 管理历史决策与知识沉淀
- [⚠️ PARTIAL] 按任务与员工加载相关记忆

当前基础：

- [✅ DONE] `company_knowledge.json`
- [✅ DONE] `Store.searchKnowledge()`

未来演进：

- [⚠️ PARTIAL] 引入 `.ai/` 目录规范
- [⚠️ PARTIAL] 再逐步引入结构化索引与数据库化

核心对象：

- [⚠️ PARTIAL] `MemoryDocument`
- [⚠️ PARTIAL] `MemoryChunk`
- [⚠️ PARTIAL] `DecisionRecord`
- [✅ DONE] `KnowledgeEntry`

### 4.5 Governance（治理与审批）

职责：

- [✅ DONE] 风险等级判定
- [✅ DONE] 人工确认节点
- [✅ DONE] 审批记录
- [✅ DONE] 工具权限控制
- [✅ DONE] 操作审计

当前基础：

- [✅ DONE] Host policy
- [✅ DONE] Capability bindings
- [✅ DONE] 执行降级策略

未来演进：

- [✅ DONE] 从"能力限制"升级为"治理闭环"

核心对象：

- [✅ DONE] `Approval`
- [✅ DONE] `RiskPolicy`
- [✅ DONE] `AuditLog`
- [✅ DONE] `GovernanceDecision`

### 4.6 Observability（观测与追踪）

职责：

- [✅ DONE] 执行日志
- [✅ DONE] 活动流
- [✅ DONE] 工具调用记录
- [✅ DONE] 成本与耗时记录
- [✅ DONE] 追踪任务执行路径

当前基础：

- [✅ DONE] WebSocket 活动流
- [✅ DONE] 前端 ActivityLog

核心对象：

- [✅ DONE] `ExecutionTrace`
- [✅ DONE] `ToolCallLog`
- [✅ DONE] `CostLog`
- [✅ DONE] `TaskEvent`

---

## 五、统一术语

为了避免后续继续把"专家讨论""任务执行""员工雇佣""运行时选择"混在一起，统一术语如下：

- [✅ DONE] Agent：员工定义本身，包含角色、能力、工具策略、提示词素材
- [✅ DONE] Agent Profile：结构化员工档案
- [✅ DONE] Task：系统要完成的一项工作
- [✅ DONE] Assignment：某个任务分配给某个员工的记录
- [✅ DONE] Workflow Plan：任务拆分后的执行计划
- [✅ DONE] Execution：一次具体运行
- [✅ DONE] Memory：任务和项目上下文载体
- [✅ DONE] Approval：人工确认记录
- [✅ DONE] Tool Call：员工调用工具的一次操作
- [✅ DONE] Discussion：只保留为一种任务执行形态，不再作为系统核心概念

---

## 六、分阶段实施路线

## Phase 0｜现状对齐与平台骨架重命名

### 目标

先把现有 HQ 的概念和代码现实对齐，停止继续围绕"discussion"扩散功能。

### Task 0.1 梳理现有能力与缺口

- [✅ DONE] 明确当前可复用模块
- [✅ DONE] 明确当前缺失的领域对象
- [✅ DONE] 明确哪些功能已经存在雏形，哪些还未开始

### Task 0.2 定义 bounded contexts 与统一术语

- [✅ DONE] 写清楚六个 bounded contexts
- [✅ DONE] 定义系统核心对象与状态边界
- [✅ DONE] 明确依赖方向

### Task 0.3 重写开发计划与技术路线说明

- [✅ DONE] 将"新仓库 + 新栈"改写为"HQ 演进 + StaffAI 承接"
- [✅ DONE] 明确平台 1.0 范围
- [✅ DONE] 明确平台 2.0 才考虑的内容

### Task 0.4 定义第一版目录演进策略

建议在当前 `hq/backend/src` 下逐步演进为：

```text
hq/backend/src/
  registry/
  orchestration/
  runtime/
  memory/
  governance/
  observability/
  api/
  shared/
```

注意：

第一阶段不要求一次性大搬家，但新代码按这个边界落位，旧代码逐步提炼。

### Task 0.4.1 架构防御规则

第一阶段起就执行以下规则：

- [✅ DONE] `api/` 只做协议转换、参数校验和调用编排，不承载领域逻辑
- [✅ DONE] `orchestration/` 只负责任务计划、状态推进和结果汇总，不直接处理 HTTP 细节
- [✅ DONE] `runtime/` 只负责执行器调用、超时、降级和执行结果，不直接决定业务路由
- [✅ DONE] `governance/` 只负责风险策略、审批与审计，不直接发起业务任务
- [✅ DONE] `memory/` 只负责上下文读取、检索和写回，不直接推进任务状态
- [✅ DONE] `observability/` 只负责事件、日志与追踪，不直接写业务主状态
- [✅ DONE] 新增文件默认不得继续向 500 行靠近；一旦跨越维护阈值就必须拆分
- [✅ DONE] 不允许跨 bounded context 直接改写对方主状态，只能通过显式接口调用

### Task 0.5 验收标准

- [✅ DONE] 全队使用统一术语
- [✅ DONE] 新计划与当前代码现状一致
- [✅ DONE] 后续新增能力有明确落位，不再继续堆进 `server.ts` 和 `discussion-service.ts`

---

## Phase 1｜交互入口层升级

### 目标

把当前 Web 指挥台从"专家讨论控制台"升级为"任务与执行控制台"。

### 当前可复用部分

- [✅ DONE] `hq/frontend/src/app/page.tsx`
- [✅ DONE] 现有三栏 dashboard
- [✅ DONE] `ActivityLog`
- [✅ DONE] 专家搜索、讨论控制、模板能力

### Task 1.1 新增任务中心视图

增加以下核心视图：

- [✅ DONE] 任务列表：`hq/frontend/src/app/tasks/page.tsx`
- [✅ DONE] 任务详情：`hq/frontend/src/app/tasks/[id]/page.tsx`
- [✅ DONE] 执行详情：`hq/frontend/src/app/executions/[id]/page.tsx`
- [✅ DONE] 审批列表：`hq/frontend/src/app/approvals/page.tsx`
- [✅ DONE] 员工列表：`hq/frontend/src/app/employees/page.tsx`

### Task 1.2 调整右侧控制台定位

从"讨论控制台"扩展为：

- [✅ DONE] 创建任务
- [✅ DONE] 选择执行模式
- [✅ DONE] 查看任务计划
- [✅ DONE] 查看审批状态
- [✅ DONE] 查看执行结果

### Task 1.3 后端 API 扩展

第一版新增：

- [✅ DONE] `POST /api/tasks`
- [✅ DONE] `GET /api/tasks`
- [✅ DONE] `GET /api/tasks/:id`
- [✅ DONE] `GET /api/executions/:id`
- [✅ DONE] `GET /api/approvals`
- [✅ DONE] `POST /api/approvals/:id/approve`
- [✅ DONE] `POST /api/approvals/:id/reject`

### Task 1.4 第一版交互原则

- [✅ DONE] discussion 仍可保留，但作为一种任务执行模式
- [✅ DONE] 用户先创建任务，再进入执行/讨论流程
- [✅ DONE] 所有运行结果都要挂到 task/execution 上，而不是只显示在活动流中

### Task 1.5 验收标准

- [✅ DONE] 能创建任务
- [✅ DONE] 能查看任务列表和任务详情
- [✅ DONE] 能查看执行详情
- [✅ DONE] 能看到待审批项

---

## Phase 2｜员工注册中心与任务编排层

### 目标

把"agent markdown + discussion matching"升级成真正的员工注册和任务编排体系。

### Task 2.1 Agent Profile 结构化

在保留 markdown 的前提下，补充结构化 metadata，至少包括：

- [✅ DONE] id
- [✅ DONE] name
- [✅ DONE] department
- [✅ DONE] role
- [✅ DONE] responsibilities
- [✅ DONE] tools
- [✅ DONE] allowed_task_types
- [✅ DONE] risk_scope
- [✅ DONE] execution_preferences
- [✅ DONE] output_contract

### Task 2.2 任务模型定义

第一版 `Task` 字段：

- [✅ DONE] id
- [✅ DONE] title
- [✅ DONE] description
- [✅ DONE] task_type
- [✅ DONE] priority
- [✅ DONE] status
- [✅ DONE] risk_level
- [✅ DONE] requested_by
- [✅ DONE] execution_mode
- [✅ DONE] approval_required
- [✅ DONE] created_at
- [✅ DONE] updated_at

### Task 2.3 分配模型定义

第一版 `TaskAssignment` 字段：

- [✅ DONE] id
- [✅ DONE] task_id
- [✅ DONE] agent_id
- [✅ DONE] assignment_role
- [✅ DONE] status
- [✅ DONE] started_at
- [✅ DONE] ended_at
- [✅ DONE] result_summary

### Task 2.4 Workflow Plan 模型

定义：

- [✅ DONE] plan_id
- [✅ DONE] task_id
- [✅ DONE] mode: SINGLE | SERIAL | PARALLEL
- [✅ DONE] steps
- [✅ DONE] synthesis_required

### Task 2.5 Orchestrator 服务

从 `discussion-service.ts` 中逐步提炼：

- [✅ DONE] `createTask()`
- [✅ DONE] `routeTask()`
- [✅ DONE] `buildPlan()`
- [✅ DONE] `assignAgents()`
- [✅ DONE] `advanceTaskState()`

### Task 2.6 默认路由规则 1.0

保留现有专家匹配思路，但升级为任务导向：

- [✅ DONE] architecture/design -> architect 类员工
- [✅ DONE] backend/api/db -> backend 类员工
- [✅ DONE] review/risk -> reviewer 类员工
- [✅ DONE] docs/spec/manual -> writer 类员工
- [✅ DONE] split/orchestrate -> dispatcher 类员工

### Task 2.7 状态机定义

任务状态：

- [✅ DONE] CREATED
- [✅ DONE] ROUTED
- [✅ DONE] RUNNING
- [✅ DONE] WAITING_APPROVAL
- [✅ DONE] COMPLETED
- [✅ DONE] FAILED
- [✅ DONE] CANCELLED
- [✅ DONE] SUSPENDED

分配状态：

- [✅ DONE] PENDING
- [✅ DONE] RUNNING
- [✅ DONE] COMPLETED
- [✅ DONE] FAILED
- [✅ DONE] SKIPPED

### Task 2.8 第一版存储策略

第一版可以继续使用文件/JSON 存储：

- [✅ DONE] 任务
- [✅ DONE] 分配
- [✅ DONE] 执行摘要

但访问层要抽象，避免业务逻辑直接依赖文件结构。

### Task 2.9 验收标准

- [✅ DONE] 创建任务后可自动路由
- [✅ DONE] 能生成单专家或多专家执行计划
- [✅ DONE] 能看到任务和分配状态变化
- [✅ DONE] discussion 能作为 task execution mode 被保留与复用

---

## Phase 3｜运行时层升级

### 目标

将现有 CLI 执行能力抽象为正式 Runtime 层。

### Task 3.1 Runtime Adapter 接口

定义统一接口：

- [✅ DONE] `runTask(task, assignment, context)`
- [✅ DONE] `runSerial(plan, context)`
- [✅ DONE] `runParallel(plan, context)`
- [✅ DONE] `cancelExecution(executionId)`
- [✅ DONE] `pauseExecution(executionId)` 预留
- [✅ DONE] `resumeExecution(executionId)` 预留

### Task 3.2 Execution 模型

第一版字段：

- [✅ DONE] id
- [✅ DONE] task_id
- [✅ DONE] assignment_id
- [✅ DONE] runtime_name
- [✅ DONE] status
- [✅ DONE] started_at
- [✅ DONE] ended_at
- [✅ DONE] input_snapshot
- [✅ DONE] output_snapshot
- [✅ DONE] error_message
- [✅ DONE] degraded
- [✅ DONE] executor

### Task 3.3 复用当前执行器能力

当前第一版运行时来源：

- [✅ DONE] 本地 `codex`
- [✅ DONE] 本地 `claude`
- [✅ DONE] 可选 `openai`
- [✅ DONE] DeerFlow adapter v2

现有相关模块：

- [✅ DONE] `discussion-service.ts`
- [✅ DONE] `execution-strategy.ts`
- [✅ DONE] `runtime-state.ts`

### Task 3.4 提炼 PromptBuilder

输入：

- [✅ DONE] agent profile
- [✅ DONE] task
- [✅ DONE] task assignment
- [✅ DONE] memory context
- [✅ DONE] tool policy

输出：

- [✅ DONE] system prompt
- [✅ DONE] user prompt
- [✅ DONE] execution constraints

### Task 3.5 超时、重试、降级

第一版实现：

- [✅ DONE] 超时控制
- [✅ DONE] 最大重试次数
- [✅ DONE] 串并行降级
- [✅ DONE] structured execution error

### Task 3.6 Dispatcher 员工正式化

把 dispatcher 从"隐含逻辑"升级为显式员工职责：

- [✅ DONE] 拆分任务
- [✅ DONE] 推荐执行模式
- [✅ DONE] 汇总多员工结果

### Task 3.7 验收标准

- [✅ DONE] 能运行单员工任务
- [✅ DONE] 能运行串行任务
- [✅ DONE] 能在不支持 parallel 时自动降级
- [✅ DONE] 执行失败可被记录并可见

---

## Phase 4｜记忆与知识层

### 目标

把当前 knowledge JSON 升级为可演进的 Memory 层。

### Task 4.1 `.ai/` 目录规范

在项目根目录约定：

```text
.ai/
  context/
  tasks/
  decisions/
  knowledge/
  agents/
```

- [✅ DONE] `hq/backend/src/memory/memory-layout.ts`

### Task 4.2 Memory 文档类型

支持：

- [✅ DONE] PROJECT
- [✅ DONE] TASK
- [✅ DONE] DECISION
- [✅ DONE] KNOWLEDGE
- [✅ DONE] AGENT
- [✅ DONE] SHARED

### Task 4.3 第一版 Memory Indexer

第一版先基于文件系统：

- [✅ DONE] 读取 markdown
- [✅ DONE] 提取标题与元数据
- [✅ DONE] 切分 chunk
- [✅ DONE] 生成简单关键词索引

- [✅ DONE] `hq/backend/src/memory/memory-indexer.ts`

### Task 4.4 第一版 Retriever

实现：

- [✅ DONE] `retrieveForTask(task, agent)`
- [✅ DONE] `retrieveProjectContext(projectKey)`
- [✅ DONE] `retrieveDecisions(topic)`
- [✅ DONE] `retrieveAgentContext(agentId)`

- [✅ DONE] `hq/backend/src/memory/file-memory-retriever.ts`
- [✅ DONE] `hq/backend/src/memory/memory-retriever.ts`（legacy/兼容路径）

### Task 4.5 复用当前知识能力

先兼容：

- [✅ DONE] `company_knowledge.json`
- [✅ DONE] `Store.searchKnowledge()`

再逐步迁移到正式 Memory 层。

### Task 4.6 第二版预留能力

预留但不强制首期落地：

- [✅ DONE] embedding
- [✅ DONE] rerank
- [✅ DONE] memory usage logs
- [✅ DONE] retrieval scoring

- [✅ DONE] 可插拔 embedding + cosine：`hq/backend/src/memory/retrieval/embedding.ts`
- [✅ DONE] usage logs（JSONL 追加写）：`hq/backend/src/memory/retrieval/usage-logger.ts`
- [✅ DONE] 开关配置：`hq/backend/src/memory/memory-retriever-types.ts`

### Task 4.7 写回策略

任务完成后写回：

- [✅ DONE] 任务摘要
- [✅ DONE] 决策记录
- [✅ DONE] 成功/失败经验
- [✅ DONE] 当前任务上下文

- [✅ DONE] `hq/backend/src/memory/write-back-service.ts`

### Task 4.8 验收标准

- [✅ DONE] 能从 `.ai/` 加载上下文
- [✅ DONE] 能按任务检索相关上下文
- [✅ DONE] 任务结果能写回知识层
- [⚠️ PARTIAL] 不同员工能看到不同范围的上下文

### Recent Sprint Addition: L1/L2/L3 Memory Layers

- [✅ DONE] L1/L2/L3 memory layer types defined
- [✅ DONE] Memory layer service implemented

---

## Phase 5｜工具与系统连接层

### 目标

把当前"执行器可调工具"的能力升级成受治理的 Tool Gateway。

### Task 5.1 Tool Definition 抽象

字段：

- [✅ DONE] name
- [✅ DONE] category
- [✅ DONE] risk_level
- [✅ DONE] allowed_roles
- [✅ DONE] input_schema
- [✅ DONE] output_schema

- [✅ DONE] `hq/backend/src/tools/base-tool.ts`（对外暴露 JSON schema）
- [✅ DONE] `hq/backend/src/tools/json-schema.ts`（`zod-to-json-schema` 转换 + 缓存）

### Task 5.2 Tool Gateway 接口

定义：

- [✅ DONE] `listTools(agent)`
- [✅ DONE] `executeTool(toolName, input, agent)`
- [✅ DONE] `checkPermission(agent, toolName, action)`
- [✅ DONE] `auditToolCall(record)`

- [✅ DONE] gateway：`hq/backend/src/tools/tool-gateway.ts`
- [✅ DONE] API：`hq/backend/src/api/tools.ts`

### Task 5.3 第一批工具映射

结合当前现实，第一批优先考虑：

- [✅ DONE] FileRead
- [✅ DONE] FileWrite
- [✅ DONE] GitRead
- [✅ DONE] GitDiff
- [✅ DONE] TestRunner
- [✅ DONE] DocsSearch
- [✅ DONE] RuntimeExecutor

- [✅ DONE] 工具实现：`hq/backend/src/tools/*`
- [✅ DONE] git 工具：`hq/backend/src/tools/git-tools.ts`（并已接入 gateway 默认注册）

### Task 5.4 工具权限模型

例如：

- [✅ DONE] reviewer：代码只读、测试、文档
- [✅ DONE] backend：代码读写、测试、schema 查询
- [✅ DONE] writer：文档读写、代码只读
- [✅ DONE] dispatcher：任务与上下文读写，不直接做高风险修改

### Task 5.5 高风险工具治理

高风险示例：

- [✅ DONE] 删除文件
- [✅ DONE] destructive command
- [✅ DONE] 修改核心配置
- [✅ DONE] 写数据库
- [✅ DONE] 发布内容

### Task 5.6 工具调用日志

记录：

- [✅ DONE] execution_id
- [✅ DONE] tool_name
- [✅ DONE] input_summary
- [✅ DONE] output_summary
- [✅ DONE] status
- [✅ DONE] risk_level
- [✅ DONE] created_at

- [✅ DONE] `ToolCallLog`：`hq/backend/src/shared/task-types.ts`
- [✅ DONE] 保存/查询：`hq/backend/src/store.ts` + `hq/backend/src/persistence/file-repositories.ts`

### Task 5.7 验收标准

- [✅ DONE] 员工只能看到有权限的工具
- [✅ DONE] 高风险工具不能绕过审批直接执行
- [✅ DONE] 每次工具调用都有日志

---

## Phase 6｜治理与观测层

### 目标

把当前 capability/host policy 进一步升级为真正的治理闭环。

### Task 6.1 Approval 模型

字段：

- [✅ DONE] id
- [✅ DONE] target_type
- [✅ DONE] target_id
- [✅ DONE] status
- [✅ DONE] requested_by
- [✅ DONE] approved_by
- [✅ DONE] comment
- [✅ DONE] created_at
- [✅ DONE] approved_at

### Task 6.2 Approval Service

定义：

- [✅ DONE] `requiresApproval(target)`
- [✅ DONE] `createApproval(payload)`
- [✅ DONE] `approve(id)`
- [✅ DONE] `reject(id)`

- [✅ DONE] 服务：`hq/backend/src/governance/approval-service-v2.ts`
- [✅ DONE] API：`hq/backend/src/api/approvals.ts`

### Task 6.3 风险策略

定义：

- [✅ DONE] LOW：自动执行
- [✅ DONE] MEDIUM：记录审计
- [✅ DONE] HIGH：必须审批

### Task 6.4 Audit Log

记录：

- [✅ DONE] actor_type
- [✅ DONE] actor_id
- [✅ DONE] action
- [✅ DONE] object_type
- [✅ DONE] object_id
- [✅ DONE] details
- [✅ DONE] created_at

- [✅ DONE] 领域：`hq/backend/src/governance/audit-logger.ts`
- [✅ DONE] repo：`hq/backend/src/persistence/audit-log-repositories.ts`

### Task 6.5 Execution Trace

记录：

- [✅ DONE] 哪个任务触发
- [✅ DONE] 分配给了谁
- [✅ DONE] 读了哪些 memory
- [✅ DONE] 调了哪些工具
- [✅ DONE] 哪一步失败
- [✅ DONE] 是否发生降级
- [✅ DONE] 最终结果是什么

- [✅ DONE] 类型：`hq/backend/src/shared/task-types.ts`（`ExecutionTraceEvent`）
- [✅ DONE] repo：`hq/backend/src/persistence/file-repositories.ts`（`ExecutionTraceRepository`）
- [✅ DONE] store：`hq/backend/src/store.ts`（append/get）
- [✅ DONE] 采集点：execution, tool call, approval
- [✅ DONE] API（聚合查询）：`hq/backend/src/api/executions.ts`

### Task 6.6 成本与耗时观测

记录：

- [✅ DONE] model / executor
- [✅ DONE] tokens 或近似成本
- [✅ DONE] execution duration
- [✅ DONE] task duration

- [✅ DONE] 类型：`hq/backend/src/shared/task-types.ts`（`CostLogEntry`）
- [✅ DONE] repo：`hq/backend/src/persistence/file-repositories.ts`（`CostLogRepository`）
- [✅ DONE] store：`hq/backend/src/store.ts`
- [✅ DONE] 采集点：`hq/backend/src/runtime/execution-service.ts`

### Task 6.7 复用当前基础

复用：

- [✅ DONE] WebSocket 活动流
- [✅ DONE] ActivityLog
- [✅ DONE] runtime state snapshot
- [✅ DONE] 当前 host/capability policy 能力

### Task 6.8 验收标准

- [✅ DONE] 高风险任务能进入审批
- [✅ DONE] 审批通过后可恢复执行
- [✅ DONE] 每次执行都有 trace
- [✅ DONE] 每次高风险操作都有审计记录

---

## Phase 7｜系统串联与联调

### 目标

把六层串成完整业务闭环。

### Task 7.1 单任务闭环

链路：

- [✅ DONE] 创建任务
- [✅ DONE] 自动路由
- [✅ DONE] 加载记忆
- [✅ DONE] 执行员工
- [✅ DONE] 调工具
- [✅ DONE] 写回结果
- [✅ DONE] 记录审计

### Task 7.2 串行任务闭环

链路：

- [✅ DONE] dispatcher 生成 plan
- [✅ DONE] architect 执行
- [✅ DONE] backend 执行
- [✅ DONE] reviewer 执行
- [✅ DONE] writer 汇总

### Task 7.3 并行任务闭环

链路：

- [✅ DONE] dispatcher 拆分
- [✅ DONE] 多专家并行执行
- [✅ DONE] synthesis 汇总
- [✅ DONE] 降级时自动串行兜底

### Task 7.4 审批闭环

链路：

- [✅ DONE] 识别高风险动作
- [✅ DONE] 创建审批
- [✅ DONE] 人工批准/拒绝
- [✅ DONE] 批准后恢复执行

### Task 7.5 联调验收标准

- [✅ DONE] 单任务闭环成功
- [✅ DONE] 串行闭环成功
- [✅ DONE] 并行或降级闭环成功
- [✅ DONE] 审批闭环成功
- [⚠️ PARTIAL] 缺少完整端到端演示验证

---

## Phase 8｜MVP 员工集与默认场景

### 8.1 MVP 员工集

- [✅ DONE] dispatcher
- [✅ DONE] software-architect
- [✅ DONE] backend-architect
- [✅ DONE] code-reviewer
- [✅ DONE] technical-writer

### 8.2 MVP 任务类型

- [✅ DONE] architecture_analysis
- [✅ DONE] backend_design
- [✅ DONE] code_review
- [✅ DONE] documentation
- [✅ DONE] workflow_dispatch

### 8.3 MVP 上下文来源

- [✅ DONE] `.ai/context/project.md`
- [✅ DONE] `.ai/tasks/current-task.md`
- [✅ DONE] `.ai/decisions/*.md`
- [✅ DONE] `.ai/knowledge/*.md`

### 8.4 MVP 验收目标

- [✅ DONE] 输入一个任务
- [✅ DONE] 系统自动选员工
- [✅ DONE] 自动加载上下文
- [✅ DONE] 至少支持一个串行流程
- [✅ DONE] discussion 模式仍然可用
- [✅ DONE] 结果可查看、可追踪、可审计
- [⚠️ PARTIAL] 缺少特定演示场景的结构化 squad 模板

---

## Phase 9｜数据持久化升级路线

### 目标

在平台 1.0 验证通过后，逐步从文件化存储升级到数据库化存储。

### Task 9.1 第一阶段继续文件化的对象

优先可继续文件化：

- [✅ DONE] agent profile metadata
- [✅ DONE] template
- [✅ DONE] 项目 context
- [✅ DONE] 决策与知识 markdown

### Task 9.2 第二阶段优先数据库化的对象

优先数据库化：

- [⚠️ PARTIAL] task
- [⚠️ PARTIAL] task assignment
- [⚠️ PARTIAL] execution
- [⚠️ PARTIAL] approval
- [⚠️ PARTIAL] audit log
- [⚠️ PARTIAL] tool call log

注：文件 + PostgreSQL 双模式存在，但未完全迁移

### Task 9.3 推荐数据库化顺序

- [✅ DONE] 先 PostgreSQL
- [❌ MISSING] 再考虑 Redis 作为缓存/队列
- [❌ MISSING] 最后考虑独立 worker / job queue

### Task 9.4 为什么不在第一天就上 PostgreSQL + Redis

- [✅ DONE] 现在最紧迫的是统一模型和边界
- [✅ DONE] 先上数据库不能自动解决上下文和模块混乱问题
- [✅ DONE] 数据库化应该服务于稳定模型，而不是替代建模

---

## Phase 10｜测试计划

### 10.1 单元测试

- [✅ DONE] Agent Registry
- [✅ DONE] Orchestrator
- [✅ DONE] Routing rules
- [✅ DONE] Runtime adapter
- [✅ DONE] Memory retriever
- [✅ DONE] Tool gateway
- [✅ DONE] Approval service

- [✅ DONE] Node.js tests：`hq/backend/src/__tests__/*`
- [✅ DONE] 运行：`cd hq/backend && npm test`（650+ tests passing）

### 10.2 集成测试

- [✅ DONE] 创建任务到完成
- [✅ DONE] 串行执行流程
- [✅ DONE] 并行或降级执行流程
- [✅ DONE] 高风险审批流程
- [✅ DONE] Memory 写回流程

### 10.3 前端验收测试

- [⚠️ PARTIAL] 创建任务
- [⚠️ PARTIAL] 查看任务详情
- [⚠️ PARTIAL] 查看执行轨迹
- [⚠️ PARTIAL] 审批后恢复执行
- [⚠️ PARTIAL] 查看工具调用记录

- [⚠️ PARTIAL] 覆盖任务/执行/审批工作区：`hq/frontend/tests/e2e/tasks-workspace.spec.ts`
- [⚠️ PARTIAL] 运行：`cd hq/frontend && npm run test:e2e`
- [⚠️ PARTIAL] 缺少全面的 E2E 覆盖

### 10.4 当前可复用测试基础

- [✅ DONE] `hq/backend/src/__tests__/*`
- [✅ DONE] `hq/frontend/tests/e2e/runtime-foundation.spec.ts`

---

## Phase 11｜建议实施顺序

### Sprint 1｜平台骨架与统一模型

- [✅ DONE] Phase 0
- [✅ DONE] Phase 2 的模型与术语部分
- [✅ DONE] Phase 1 的任务中心入口

### Sprint 2｜任务编排与运行时正式化

- [✅ DONE] Phase 2 的 orchestrator 部分
- [✅ DONE] Phase 3
- [✅ DONE] Phase 7.1 单任务闭环

### Sprint 3｜记忆、工具与治理补齐

- [⚠️ PARTIAL] Phase 4
- [✅ DONE] Phase 5
- [✅ DONE] Phase 6

### Sprint 4｜联调、MVP 与数据库升级预留

- [⚠️ PARTIAL] Phase 7
- [⚠️ PARTIAL] Phase 8
- [⚠️ PARTIAL] Phase 9
- [⚠️ PARTIAL] Phase 10

---

## 七、平台 1.0 不做什么

为了防止范围失控，平台 1.0 暂不强制做：

- [⚠️ PARTIAL] 完整 embedding / rerank 检索体系（基础实现存在）
- [❌ MISSING] 真正的分布式 worker 集群
- [❌ MISSING] 强依赖 Redis 的调度系统
- [❌ MISSING] 一开始就完整 LangGraph runtime 替换当前执行器
- [❌ MISSING] 过重的 DDD 仪式化建模

这些能力在 `StaffAI` 进入平台 2.0 时再评估。

---

## 八、最终交付物

### 平台 1.0 交付物

- [✅ DONE] 一个基于 HQ 演进的任务编排内核
- [✅ DONE] 一个可查看任务、执行、审批的前端控制台
- [✅ DONE] 一套统一领域模型与状态机
- [✅ DONE] 一套可扩展的 runtime adapter 接口
- [⚠️ PARTIAL] 一套基础 memory 目录规范与检索机制
- [✅ DONE] 一套审批与审计闭环
- [✅ DONE] 一套测试基线

### 可迁移到 `StaffAI` 的成果

- [✅ DONE] bounded contexts 设计
- [✅ DONE] 统一术语
- [✅ DONE] API 设计
- [✅ DONE] 运行时接口
- [✅ DONE] 任务、执行、审批、记忆模型
- [✅ DONE] 平台分阶段路线图

---

## 九、总结

这份计划的核心变化不是"功能更多了"，而是方向被纠正了：

- [✅ DONE] 从"重新做一个新系统"
- [✅ DONE] 改成"把当前 HQ 演进成平台 1.0 编排内核"

- [✅ DONE] 从"先换技术栈"
- [✅ DONE] 改成"先稳定领域边界和统一模型"

- [✅ DONE] 从"discussion-first"
- [✅ DONE] 改成"task-orchestration-first"

- [✅ DONE] 从"只面向当前仓库"
- [✅ DONE] 改成"当前 HQ 验证 + StaffAI 承接平台化"

接下来所有实现动作，都应优先回答三个问题：

1. [✅ DONE] 这段能力属于哪个 bounded context？
2. [✅ DONE] 这段状态应该由谁负责？
3. [✅ DONE] 这段实现未来是否可迁移到 `StaffAI`？

如果这三个问题答不清，就先不要继续写代码。

---

## 十、Recent Sprint Additions (2026-03-29)

### Core Infrastructure

- [✅ DONE] TaskMainChainService - unified main chain service
- [✅ DONE] TaskEnvelope v2 - 8-field protocol implementation
- [✅ DONE] Dual-core event protocol types

### HITL (Human-in-the-Loop)

- [✅ DONE] HITL suspend/resume capability
- [✅ DONE] HitlService implementation
- [✅ DONE] SuspendedTaskPanel frontend UI

### Runtime & Adapters

- [✅ DONE] DeerFlow adapter v2 wiring
- [✅ DONE] Priority selector on task creation
- [✅ DONE] TaskRepositoryAdapter for composition

### Memory System

- [✅ DONE] L1/L2/L3 memory layer types defined
- [✅ DONE] Memory layer service implemented

---

## 十一、StaffAI Agent OS Spec - Section Status

> Based on `/Users/user/agency-agents/docs/plans/2026-03-28-StaffAI-Agent-OS-Spec.md`

### Core Platform

- **Section 1: Dual-core Office/Workshop** - [⚠️ PARTIAL]
  - [✅ DONE] TypeScript Office exists
  - [✅ DONE] Python Workshop exists
  - [❌ MISSING] No shared PostgreSQL/Redis/ChromaDB infrastructure

- **Section 2: HITL with thought chain** - [⚠️ PARTIAL]
  - [✅ DONE] Suspend/resume capability exists
  - [❌ MISSING] No thought chain display UI

- **Section 3: Multi-level approval** - [⚠️ PARTIAL]
  - [✅ DONE] Single-level approval exists
  - [❌ MISSING] No multi-step approval chain

- **Section 4: L1/L2/L3 memory** - [⚠️ PARTIAL]
  - [✅ DONE] Types defined in recent sprint
  - [❌ MISSING] No full integration yet

- **Section 5: Knowledge Graph** - [❌ MISSING]

### User Interface

- **Section 6: Atlas View** - [❌ MISSING]

- **Section 7: Three-view UI** - [⚠️ PARTIAL]
  - [✅ DONE] Console view exists
  - [✅ DONE] Kanban view exists
  - [❌ MISSING] Tower view not implemented

- **Section 8: Sidecar Vault** - [❌ MISSING]

### Task & Squad Management

- **Section 9: Tool Evolution** - [❌ MISSING]

- **Section 10: SSE + REST** - [✅ DONE]

- **Section 11: Task Envelope** - [✅ DONE]
  - [✅ DONE] v2 protocol implemented

- **Section 12: Squad Mode** - [⚠️ PARTIAL]
  - [✅ DONE] Discussion capability exists
  - [❌ MISSING] No commander/executor/critic structure

- **Section 13: Parallel with merge** - [✅ DONE]
  - [✅ DONE] Map-Reduce parallel workflow implemented

### Reliability & Security

- **Section 14: Self-healing** - [⚠️ PARTIAL]
  - [✅ DONE] Checkpoint on pause
  - [❌ MISSING] No auto-restart capability

- **Section 15: Budget/cost controls** - [⚠️ PARTIAL]
  - [✅ DONE] Cost logging exists
  - [❌ MISSING] No circuit breaker

- **Section 16: UAD Onboarding** - [❌ MISSING]

- **Section 17: Three-stage dispatcher** - [⚠️ PARTIAL]
  - [✅ DONE] Semantic routing exists
  - [✅ DONE] Manual selection exists
  - [❌ MISSING] No bidding mechanism

- **Section 18: Four-layer security** - [⚠️ PARTIAL]
  - [✅ DONE] Audit logging exists
  - [✅ DONE] Permissions system exists
  - [❌ MISSING] No sandbox isolation
  - [❌ MISSING] No vault system
  - [❌ MISSING] No red-team testing

### V1.1 Patches

All missing:

- [❌ MISSING] Broadcast interruption
- [❌ MISSING] Cognitive relief
- [❌ MISSING] Diversity bias
- [❌ MISSING] Cross-model audit

---

## Summary Statistics

**Overall Completion by Phase:**

- Phase 0: 100% (Platform Foundation)
- Phase 1: 100% (Interaction Layer)
- Phase 2: 100% (Agent Registry & Orchestration)
- Phase 3: 100% (Runtime Layer)
- Phase 4: 75% (Memory & Knowledge - types done, integration partial)
- Phase 5: 100% (Tool Gateway)
- Phase 6: 100% (Governance & Observability)
- Phase 7: 90% (System Integration - missing E2E demo validation)
- Phase 8: 85% (MVP - missing demo squad templates)
- Phase 9: 50% (Persistence - dual-mode exists, Redis/worker missing)
- Phase 10: 75% (Testing - backend strong, E2E partial)

**Spec Document Sections:**

- Fully DONE: 3 sections (SSE+REST, Task Envelope v2, Parallel merge)
- Partial: 9 sections
- Missing: 6 sections (Knowledge Graph, Atlas View, Sidecar Vault, Tool Evolution, UAD Onboarding, V1.1 patches)

**Overall Platform Status: 85% Complete for Platform 1.0**
