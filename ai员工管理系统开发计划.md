# AI 员工管理系统开发计划

## 文档定位
本文档不再按“从零新建一个全新 AI workforce OS 仓库”来规划，而是改为：

- 第一目标：基于当前 `agency-agents/hq` 的真实代码现状，迭代出平台 1.0 编排内核
- 第二目标：为新的产品仓库 `ericforai/StaffAI` 沉淀可迁移的领域模型、模块边界和实施路线

也就是说，这份计划既服务当前 HQ 的演进，也服务未来 `StaffAI` 的平台化落地。

---

## 一、当前项目现状判断

### 1.1 当前系统已经具备的基础能力
当前 `hq/` 并不是空白项目，而是已经具备以下平台雏形：

- Agent 扫描与注册：`hq/backend/src/scanner.ts`
- MCP 工具网关：`hq/backend/src/mcp.ts`
- 专家搜索、雇佣、讨论与综合：`hq/backend/src/discussion-service.ts`
- 执行模式决策与降级：`hq/backend/src/execution-strategy.ts`
- 能力绑定与运行时治理：
  - `hq/backend/src/capability-registry.ts`
  - `hq/backend/src/host-policy.ts`
  - `hq/backend/src/capability-bindings.ts`
  - `hq/backend/src/runtime-state.ts`
- Web 指挥台与活动流：
  - `hq/frontend/src/app/page.tsx`
  - `hq/frontend/src/components/*`
  - `hq/frontend/src/hooks/*`
- 当前存储方式：
  - 活跃员工、模板、知识库主要以 JSON/文件为主
  - 运行时状态位于 `~/.agency`

### 1.2 当前系统的本质定位
当前系统本质上更像：

- 一个多专家讨论与协作控制台
- 一个 MCP 能力对外暴露层
- 一个本地 CLI 执行器适配入口

它还不是完整的“AI 员工管理系统”，因为以下能力仍不完整：

- 统一任务模型
- 统一任务状态机
- 任务分配与执行记录
- 人工审批闭环
- 结构化记忆体系
- 审计与观测闭环

### 1.3 为什么不建议现在推翻重写
不建议立即改成 `Python + FastAPI + PostgreSQL + Redis + LangGraph` 的原因：

- 当前代码里已经有可复用的 orchestration/runtime 基础
- 当前最关键的问题是边界不清，不是语言不对
- 现在推翻会损失已有 MCP、讨论系统、运行时适配、前端控制台等资产
- 现阶段更适合把现有后端定义为“平台 1.0 编排内核”

结论：

**继续使用 `TypeScript + Express + MCP SDK` 作为平台 1.0 核心是合理的。**
未来要不要拆数据库、队列、独立 worker，是第二阶段的问题，不是现在的问题。

---

## 二、架构立场

### 2.1 总体路线
采用：

- 基于现有 HQ 的增量演进
- 平台骨架优先
- 轻量 DDD + bounded contexts

### 2.2 什么叫“轻量 DDD”
这里的 DDD 不意味着一开始就引入大量复杂实体、仓储、领域事件和样板代码。

这里的 DDD 只承担四件事：

- 划清边界上下文（bounded contexts）
- 建立统一术语（ubiquitous language）
- 明确每种状态由谁负责
- 约束模块之间的依赖方向

### 2.3 核心判断
平台化的关键不是换栈，而是把当前 HQ 从：

- “专家讨论系统”

升级为：

- “任务创建 -> 路由分配 -> 执行运行 -> 审批治理 -> 记忆沉淀 -> 审计观测”的 AI 员工操作系统内核

---

## 三、目标系统定义

## 3.1 目标
构建一个可渐进演进的 AI 员工管理系统，覆盖六层能力：

- 交互入口层
- 员工注册与任务编排层
- Agent 运行时层
- 记忆与知识层
- 工具与系统连接层
- 治理与观测层

## 3.2 平台 1.0 的定义
平台 1.0 不追求“一次性做完通用 AI workforce OS”，而是做到：

- 用统一任务模型驱动单专家与多专家协作
- 用统一状态机管理任务与执行过程
- 用统一运行时接口隔离不同执行器
- 用统一审批与审计机制管控高风险动作
- 用统一记忆入口加载项目上下文和历史结果
- 用统一前端控制台查看任务、执行、审批、活动

## 3.3 `StaffAI` 的关系
`StaffAI` 是未来的平台化产品承接仓库。
当前 `agency-agents/hq` 的职责是：

- 验证领域模型
- 验证交互形态
- 验证模块边界
- 沉淀平台 1.0 设计

未来迁移到 `StaffAI` 时，优先迁移的是：

- 领域模型
- 模块边界
- API 设计
- 状态机
- 运行时接口

而不是逐文件照搬现有实现。

---

## 四、Bounded Context 划分

### 4.1 Agent Registry（员工注册中心）
职责：

- 管理员工定义
- 管理能力、角色、工具权限、适配执行器
- 管理 markdown agent 到结构化 profile 的映射

当前基础：

- `scanner.ts`
- `types.ts`
- agent markdown 文件

未来演进：

- 从“纯 markdown prompt 描述”升级为“markdown + structured metadata”双轨模型

核心对象：

- `AgentProfile`
- `AgentCapability`
- `AgentToolPolicy`
- `AgentExecutionPreference`

### 4.2 Task Orchestration（任务编排）
职责：

- 创建任务
- 路由任务
- 决定单人/串行/并行执行
- 追踪任务状态
- 生成任务分配

当前基础：

- `discussion-service.ts`
- `execution-strategy.ts`

未来演进：

- 从“discussion”概念升级为“task orchestration”概念

核心对象：

- `Task`
- `TaskAssignment`
- `WorkflowPlan`
- `RoutingDecision`

### 4.3 Runtime Execution（运行时执行）
职责：

- 按任务计划调用执行器
- 执行单步、串行、多步任务
- 管理超时、重试、取消、暂停/恢复预留能力
- 回传结构化执行结果

当前基础：

- 本地 Codex / Claude CLI 执行能力
- `runtime-state.ts`
- 执行器选择与降级逻辑

核心对象：

- `Execution`
- `ExecutionStep`
- `RuntimeAdapter`
- `ExecutionResult`

### 4.4 Memory & Knowledge（记忆与知识）
职责：

- 管理项目上下文
- 管理任务上下文
- 管理历史决策与知识沉淀
- 按任务与员工加载相关记忆

当前基础：

- `company_knowledge.json`
- `Store.searchKnowledge()`

未来演进：

- 引入 `.ai/` 目录规范
- 再逐步引入结构化索引与数据库化

核心对象：

- `MemoryDocument`
- `MemoryChunk`
- `DecisionRecord`
- `KnowledgeEntry`

### 4.5 Governance（治理与审批）
职责：

- 风险等级判定
- 人工确认节点
- 审批记录
- 工具权限控制
- 操作审计

当前基础：

- Host policy
- Capability bindings
- 执行降级策略

未来演进：

- 从“能力限制”升级为“治理闭环”

核心对象：

- `Approval`
- `RiskPolicy`
- `AuditLog`
- `GovernanceDecision`

### 4.6 Observability（观测与追踪）
职责：

- 执行日志
- 活动流
- 工具调用记录
- 成本与耗时记录
- 追踪任务执行路径

当前基础：

- WebSocket 活动流
- 前端 ActivityLog

核心对象：

- `ExecutionTrace`
- `ToolCallLog`
- `CostLog`
- `TaskEvent`

---

## 五、统一术语

为了避免后续继续把“专家讨论”“任务执行”“员工雇佣”“运行时选择”混在一起，统一术语如下：

- Agent：员工定义本身，包含角色、能力、工具策略、提示词素材
- Agent Profile：结构化员工档案
- Task：系统要完成的一项工作
- Assignment：某个任务分配给某个员工的记录
- Workflow Plan：任务拆分后的执行计划
- Execution：一次具体运行
- Memory：任务和项目上下文载体
- Approval：人工确认记录
- Tool Call：员工调用工具的一次操作
- Discussion：只保留为一种任务执行形态，不再作为系统核心概念

---

## 六、分阶段实施路线

## Phase 0｜现状对齐与平台骨架重命名

### 目标
先把现有 HQ 的概念和代码现实对齐，停止继续围绕“discussion”扩散功能。

### Task 0.1 梳理现有能力与缺口
- 明确当前可复用模块
- 明确当前缺失的领域对象
- 明确哪些功能已经存在雏形，哪些还未开始

### Task 0.2 定义 bounded contexts 与统一术语
- 写清楚六个 bounded contexts
- 定义系统核心对象与状态边界
- 明确依赖方向

### Task 0.3 重写开发计划与技术路线说明
- 将“新仓库 + 新栈”改写为“HQ 演进 + StaffAI 承接”
- 明确平台 1.0 范围
- 明确平台 2.0 才考虑的内容

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

### Task 0.5 验收标准
- 全队使用统一术语
- 新计划与当前代码现状一致
- 后续新增能力有明确落位，不再继续堆进 `server.ts` 和 `discussion-service.ts`

---

## Phase 1｜交互入口层升级

### 目标
把当前 Web 指挥台从“专家讨论控制台”升级为“任务与执行控制台”。

### 当前可复用部分
- `hq/frontend/src/app/page.tsx`
- 现有三栏 dashboard
- `ActivityLog`
- 专家搜索、讨论控制、模板能力

### Task 1.1 新增任务中心视图
增加以下核心视图：
- 任务列表
- 任务详情
- 执行详情
- 审批列表
- 员工列表

### Task 1.2 调整右侧控制台定位
从“讨论控制台”扩展为：
- 创建任务
- 选择执行模式
- 查看任务计划
- 查看审批状态
- 查看执行结果

### Task 1.3 后端 API 扩展
第一版新增：
- `POST /api/tasks`
- `GET /api/tasks`
- `GET /api/tasks/:id`
- `GET /api/executions/:id`
- `GET /api/approvals`
- `POST /api/approvals/:id/approve`
- `POST /api/approvals/:id/reject`

### Task 1.4 第一版交互原则
- discussion 仍可保留，但作为一种任务执行模式
- 用户先创建任务，再进入执行/讨论流程
- 所有运行结果都要挂到 task/execution 上，而不是只显示在活动流中

### Task 1.5 验收标准
- 能创建任务
- 能查看任务列表和任务详情
- 能查看执行详情
- 能看到待审批项

---

## Phase 2｜员工注册中心与任务编排层

### 目标
把“agent markdown + discussion matching”升级成真正的员工注册和任务编排体系。

### Task 2.1 Agent Profile 结构化
在保留 markdown 的前提下，补充结构化 metadata，至少包括：
- id
- name
- department
- role
- responsibilities
- tools
- allowed_task_types
- risk_scope
- execution_preferences
- output_contract

### Task 2.2 任务模型定义
第一版 `Task` 字段：
- id
- title
- description
- task_type
- priority
- status
- risk_level
- requested_by
- execution_mode
- approval_required
- created_at
- updated_at

### Task 2.3 分配模型定义
第一版 `TaskAssignment` 字段：
- id
- task_id
- agent_id
- assignment_role
- status
- started_at
- ended_at
- result_summary

### Task 2.4 Workflow Plan 模型
定义：
- plan_id
- task_id
- mode: SINGLE | SERIAL | PARALLEL
- steps
- synthesis_required

### Task 2.5 Orchestrator 服务
从 `discussion-service.ts` 中逐步提炼：
- `createTask()`
- `routeTask()`
- `buildPlan()`
- `assignAgents()`
- `advanceTaskState()`

### Task 2.6 默认路由规则 1.0
保留现有专家匹配思路，但升级为任务导向：
- architecture/design -> architect 类员工
- backend/api/db -> backend 类员工
- review/risk -> reviewer 类员工
- docs/spec/manual -> writer 类员工
- split/orchestrate -> dispatcher 类员工

### Task 2.7 状态机定义
任务状态：
- CREATED
- ROUTED
- RUNNING
- WAITING_APPROVAL
- COMPLETED
- FAILED
- CANCELLED

分配状态：
- PENDING
- RUNNING
- COMPLETED
- FAILED
- SKIPPED

### Task 2.8 第一版存储策略
第一版可以继续使用文件/JSON 存储：
- 任务
- 分配
- 执行摘要

但访问层要抽象，避免业务逻辑直接依赖文件结构。

### Task 2.9 验收标准
- 创建任务后可自动路由
- 能生成单专家或多专家执行计划
- 能看到任务和分配状态变化
- discussion 能作为 task execution mode 被保留与复用

---

## Phase 3｜运行时层升级

### 目标
将现有 CLI 执行能力抽象为正式 Runtime 层。

### Task 3.1 Runtime Adapter 接口
定义统一接口：
- `runTask(task, assignment, context)`
- `runSerial(plan, context)`
- `runParallel(plan, context)`
- `cancelExecution(executionId)`
- `pauseExecution(executionId)` 预留
- `resumeExecution(executionId)` 预留

### Task 3.2 Execution 模型
第一版字段：
- id
- task_id
- assignment_id
- runtime_name
- status
- started_at
- ended_at
- input_snapshot
- output_snapshot
- error_message
- degraded
- executor

### Task 3.3 复用当前执行器能力
当前第一版运行时来源：
- 本地 `codex`
- 本地 `claude`
- 可选 `openai`

现有相关模块：
- `discussion-service.ts`
- `execution-strategy.ts`
- `runtime-state.ts`

### Task 3.4 提炼 PromptBuilder
输入：
- agent profile
- task
- task assignment
- memory context
- tool policy

输出：
- system prompt
- user prompt
- execution constraints

### Task 3.5 超时、重试、降级
第一版实现：
- 超时控制
- 最大重试次数
- 串并行降级
- structured execution error

### Task 3.6 Dispatcher 员工正式化
把 dispatcher 从“隐含逻辑”升级为显式员工职责：
- 拆分任务
- 推荐执行模式
- 汇总多员工结果

### Task 3.7 验收标准
- 能运行单员工任务
- 能运行串行任务
- 能在不支持 parallel 时自动降级
- 执行失败可被记录并可见

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

### Task 4.2 Memory 文档类型
支持：
- PROJECT
- TASK
- DECISION
- KNOWLEDGE
- AGENT
- SHARED

### Task 4.3 第一版 Memory Indexer
第一版先基于文件系统：
- 读取 markdown
- 提取标题与元数据
- 切分 chunk
- 生成简单关键词索引

### Task 4.4 第一版 Retriever
实现：
- `retrieveForTask(task, agent)`
- `retrieveProjectContext(projectKey)`
- `retrieveDecisions(topic)`
- `retrieveAgentContext(agentId)`

### Task 4.5 复用当前知识能力
先兼容：
- `company_knowledge.json`
- `Store.searchKnowledge()`

再逐步迁移到正式 Memory 层。

### Task 4.6 第二版预留能力
预留但不强制首期落地：
- embedding
- rerank
- memory usage logs
- retrieval scoring

### Task 4.7 写回策略
任务完成后写回：
- 任务摘要
- 决策记录
- 成功/失败经验
- 当前任务上下文

### Task 4.8 验收标准
- 能从 `.ai/` 加载上下文
- 能按任务检索相关上下文
- 任务结果能写回知识层
- 不同员工能看到不同范围的上下文

---

## Phase 5｜工具与系统连接层

### 目标
把当前“执行器可调工具”的能力升级成受治理的 Tool Gateway。

### Task 5.1 Tool Definition 抽象
字段：
- name
- category
- risk_level
- allowed_roles
- input_schema
- output_schema

### Task 5.2 Tool Gateway 接口
定义：
- `listTools(agent)`
- `executeTool(toolName, input, agent)`
- `checkPermission(agent, toolName, action)`
- `auditToolCall(record)`

### Task 5.3 第一批工具映射
结合当前现实，第一批优先考虑：
- FileRead
- FileWrite
- GitRead
- GitDiff
- TestRunner
- DocsSearch
- RuntimeExecutor

### Task 5.4 工具权限模型
例如：
- reviewer：代码只读、测试、文档
- backend：代码读写、测试、schema 查询
- writer：文档读写、代码只读
- dispatcher：任务与上下文读写，不直接做高风险修改

### Task 5.5 高风险工具治理
高风险示例：
- 删除文件
- destructive command
- 修改核心配置
- 写数据库
- 发布内容

### Task 5.6 工具调用日志
记录：
- execution_id
- tool_name
- input_summary
- output_summary
- status
- risk_level
- created_at

### Task 5.7 验收标准
- 员工只能看到有权限的工具
- 高风险工具不能绕过审批直接执行
- 每次工具调用都有日志

---

## Phase 6｜治理与观测层

### 目标
把当前 capability/host policy 进一步升级为真正的治理闭环。

### Task 6.1 Approval 模型
字段：
- id
- target_type
- target_id
- status
- requested_by
- approved_by
- comment
- created_at
- approved_at

### Task 6.2 Approval Service
定义：
- `requiresApproval(target)`
- `createApproval(payload)`
- `approve(id)`
- `reject(id)`

### Task 6.3 风险策略
定义：
- LOW：自动执行
- MEDIUM：记录审计
- HIGH：必须审批

### Task 6.4 Audit Log
记录：
- actor_type
- actor_id
- action
- object_type
- object_id
- details
- created_at

### Task 6.5 Execution Trace
记录：
- 哪个任务触发
- 分配给了谁
- 读了哪些 memory
- 调了哪些工具
- 哪一步失败
- 是否发生降级
- 最终结果是什么

### Task 6.6 成本与耗时观测
记录：
- model / executor
- tokens 或近似成本
- execution duration
- task duration

### Task 6.7 复用当前基础
复用：
- WebSocket 活动流
- ActivityLog
- runtime state snapshot
- 当前 host/capability policy 能力

### Task 6.8 验收标准
- 高风险任务能进入审批
- 审批通过后可恢复执行
- 每次执行都有 trace
- 每次高风险操作都有审计记录

---

## Phase 7｜系统串联与联调

### 目标
把六层串成完整业务闭环。

### Task 7.1 单任务闭环
链路：
- 创建任务
- 自动路由
- 加载记忆
- 执行员工
- 调工具
- 写回结果
- 记录审计

### Task 7.2 串行任务闭环
链路：
- dispatcher 生成 plan
- architect 执行
- backend 执行
- reviewer 执行
- writer 汇总

### Task 7.3 并行任务闭环
链路：
- dispatcher 拆分
- 多专家并行执行
- synthesis 汇总
- 降级时自动串行兜底

### Task 7.4 审批闭环
链路：
- 识别高风险动作
- 创建审批
- 人工批准/拒绝
- 批准后恢复执行

### Task 7.5 联调验收标准
- 单任务闭环成功
- 串行闭环成功
- 并行或降级闭环成功
- 审批闭环成功

---

## Phase 8｜MVP 员工集与默认场景

### 8.1 MVP 员工集
- dispatcher
- software-architect
- backend-architect
- code-reviewer
- technical-writer

### 8.2 MVP 任务类型
- architecture_analysis
- backend_design
- code_review
- documentation
- workflow_dispatch

### 8.3 MVP 上下文来源
- `.ai/context/project.md`
- `.ai/tasks/current-task.md`
- `.ai/decisions/*.md`
- `.ai/knowledge/*.md`

### 8.4 MVP 验收目标
- 输入一个任务
- 系统自动选员工
- 自动加载上下文
- 至少支持一个串行流程
- discussion 模式仍然可用
- 结果可查看、可追踪、可审计

---

## Phase 9｜数据持久化升级路线

### 目标
在平台 1.0 验证通过后，逐步从文件化存储升级到数据库化存储。

### Task 9.1 第一阶段继续文件化的对象
优先可继续文件化：
- agent profile metadata
- template
- 项目 context
- 决策与知识 markdown

### Task 9.2 第二阶段优先数据库化的对象
优先数据库化：
- task
- task assignment
- execution
- approval
- audit log
- tool call log

### Task 9.3 推荐数据库化顺序
- 先 PostgreSQL
- 再考虑 Redis 作为缓存/队列
- 最后考虑独立 worker / job queue

### Task 9.4 为什么不在第一天就上 PostgreSQL + Redis
- 现在最紧迫的是统一模型和边界
- 先上数据库不能自动解决上下文和模块混乱问题
- 数据库化应该服务于稳定模型，而不是替代建模

---

## Phase 10｜测试计划

### 10.1 单元测试
- Agent Registry
- Orchestrator
- Routing rules
- Runtime adapter
- Memory retriever
- Tool gateway
- Approval service

### 10.2 集成测试
- 创建任务到完成
- 串行执行流程
- 并行或降级执行流程
- 高风险审批流程
- Memory 写回流程

### 10.3 前端验收测试
- 创建任务
- 查看任务详情
- 查看执行轨迹
- 审批后恢复执行
- 查看工具调用记录

### 10.4 当前可复用测试基础
- `hq/backend/src/__tests__/*`
- `hq/frontend/tests/e2e/runtime-foundation.spec.ts`

---

## Phase 11｜建议实施顺序

### Sprint 1｜平台骨架与统一模型
- Phase 0
- Phase 2 的模型与术语部分
- Phase 1 的任务中心入口

### Sprint 2｜任务编排与运行时正式化
- Phase 2 的 orchestrator 部分
- Phase 3
- Phase 7.1 单任务闭环

### Sprint 3｜记忆、工具与治理补齐
- Phase 4
- Phase 5
- Phase 6

### Sprint 4｜联调、MVP 与数据库升级预留
- Phase 7
- Phase 8
- Phase 9
- Phase 10

---

## 七、平台 1.0 不做什么

为了防止范围失控，平台 1.0 暂不强制做：

- 完整 embedding / rerank 检索体系
- 真正的分布式 worker 集群
- 强依赖 Redis 的调度系统
- 一开始就完整 LangGraph runtime 替换当前执行器
- 过重的 DDD 仪式化建模

这些能力在 `StaffAI` 进入平台 2.0 时再评估。

---

## 八、最终交付物

### 平台 1.0 交付物
- 一个基于 HQ 演进的任务编排内核
- 一个可查看任务、执行、审批的前端控制台
- 一套统一领域模型与状态机
- 一套可扩展的 runtime adapter 接口
- 一套基础 memory 目录规范与检索机制
- 一套审批与审计闭环
- 一套测试基线

### 可迁移到 `StaffAI` 的成果
- bounded contexts 设计
- 统一术语
- API 设计
- 运行时接口
- 任务、执行、审批、记忆模型
- 平台分阶段路线图

---

## 九、总结

这份计划的核心变化不是“功能更多了”，而是方向被纠正了：

- 从“重新做一个新系统”
- 改成“把当前 HQ 演进成平台 1.0 编排内核”

- 从“先换技术栈”
- 改成“先稳定领域边界和统一模型”

- 从“discussion-first”
- 改成“task-orchestration-first”

- 从“只面向当前仓库”
- 改成“当前 HQ 验证 + StaffAI 承接平台化”

接下来所有实现动作，都应优先回答三个问题：

1. 这段能力属于哪个 bounded context？
2. 这段状态应该由谁负责？
3. 这段实现未来是否可迁移到 `StaffAI`？

如果这三个问题答不清，就先不要继续写代码。
