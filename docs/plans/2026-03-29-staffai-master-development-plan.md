# 2026-03-29 StaffAI 开发总控计划

## 0. 文档定位

这份文档用于替代“按零散 phase 文档分别推进”的开发方式，作为 StaffAI 当前阶段的**总控计划**。

它不是重新发明一套从零开始的路线，而是基于以下事实重新排布执行顺序：

- `2026-03-28` 的 Agent OS 白皮书已经定义了**目标架构**
- `agency-agents/hq` 已经具备了一套不小的真实底座
- `2026-03-24` 到 `2026-03-25` 的实施文档提供了阶段性拆解，但其中部分结论已经落后于代码现状

因此，本计划的目标是：

1. 把白皮书能力映射到当前真实代码状态
2. 明确哪些能力已完成、哪些在途中、哪些该立刻推进
3. 给出接下来可以直接执行的开发顺序

---

## 1. 本次总控计划的依据

### 1.1 目标文档

- `docs/plans/2026-03-28-StaffAI-Agent-OS-Spec.md`

### 1.2 既有计划文档

- `docs/plans/2026-03-24-staffai-platform-implementation.md`
- `docs/plans/2026-03-25-phase7-system-integration.md`
- `docs/plans/2026-03-23-agency-runtime-foundation-v2.md`
- `docs/plans/2026-03-25-phase2-orchestration-completion-slice.md`
- `docs/plans/2026-03-25-phase3-runtime-upgrade-slice.md`
- `docs/plans/2026-03-25-tool-gateway-next-slice.md`
- `ai员工管理系统开发计划.md`

### 1.3 本次实际 review 的关键代码路径

控制面与任务编排：

- `hq/backend/src/shared/task-types.ts`
- `hq/backend/src/orchestration/task-lifecycle-service.ts`
- `hq/backend/src/orchestration/task-state-machine.ts`
- `hq/backend/src/orchestration/task-execution-orchestrator.ts`
- `hq/backend/src/orchestration/workflow-execution-engine.ts`
- `hq/backend/src/orchestration/assignment-executor.ts`
- `hq/backend/src/orchestration/approval-execution-bridge.ts`
- `hq/backend/src/api/approvals.ts`
- `hq/backend/src/api/executions.ts`

运行时与双核：

- `hq/backend/src/runtime/adapters/deerflow-adapter.ts`
- `hq/backend/src/app/create-web-server-runtime.ts`
- `hq/start-dev-staffai.sh`
- `workshop/main.py`

记忆与知识：

- `hq/backend/src/memory/memory-retriever.ts`
- `hq/frontend/src/app/knowledge/page.tsx`

前端控制台：

- `hq/frontend/src/app/page.tsx`
- `hq/frontend/src/app/tasks/[id]/page.tsx`
- `hq/frontend/src/app/approvals/page.tsx`
- `hq/frontend/src/app/executions/[id]/page.tsx`

---

## 2. 总体判断

### 2.1 当前系统真实位置

当前 `hq/` 已经不是“多专家讨论 demo”，而是一个**平台内核雏形**，已经具备：

- 统一任务模型
- 审批模型与风险评估接缝
- 执行记录与工作流计划
- 串行 / 并行工作流引擎
- 暂停 / 恢复 / 取消控制
- Tool Gateway 与 MCP 对外暴露
- `.ai/` 记忆检索与写回 baseline
- 任务 / 审批 / 执行 / 知识的前端工作区
- TS Office + Python Workshop 的双核雏形

### 2.2 当前系统还不是什么

它还不是白皮书定义下的完整 Agent OS 1.0，当前缺口主要集中在：

- L1 / L2 / L3 分层记忆尚未正式建模
- HITL 仍主要表现为审批，而不是统一的挂起 / 干预 / 恢复
- Shared State Store 还没有变成真正的一致性底座
- UI 还不是 Console / Kanban / Tower 三视图
- Atlas 图谱、Sidecar Vault、动态工具提审、自由竞标、跨模型审计等高阶能力尚未进入主线

### 2.3 对旧文档的处理原则

- `2026-03-24` 的 implementation plan 仍可视为**平台底座建设主线**
- `2026-03-25` 的若干 phase/slice 文档可视为**历史实施记录**
- `2026-03-25-phase7-system-integration.md` 中部分“缺失项”已被代码补上，不再适合作为当前排期依据
- `2026-03-28` 白皮书应被视为**目标架构源头文档**
- 本文档是**当前执行源头文档**

---

## 3. 已完成

以下内容已经具备明确实现基础，可以视为“已完成的底座能力”。

### 3.1 控制面基础已完成

- 已有统一的 `Task / Approval / TaskAssignment / WorkflowPlan / Execution / ToolCallLog` 领域对象
- 已有任务状态集合、审批状态集合、执行状态集合
- 已有工作流模式 `single / serial / parallel`
- 已有风险等级、工具风险等级、执行 trace 事件等共享词汇

### 3.2 任务生命周期基础已完成

- 已有 `TaskLifecycleService`，支持任务创建时自动风险评估
- 已有 `ApprovalServiceV2` 接入路径
- 已有 `TaskStateMachine` 管理任务状态转换
- 已有审批通过后自动进入执行的桥接逻辑

### 3.3 工作流执行基础已完成

- 已有 `AssignmentExecutor`
- 已有 `WorkflowExecutionEngine`
- 已支持串行 / 并行执行
- 已支持 workflow 级暂停 / 恢复 / 取消控制
- 已有 execution state store 与 checkpoint 基础结构

### 3.4 双核基础已完成

- TS Office 已具备 Web Server、MCP Gateway、Tool Gateway
- Python Workshop 已具备 FastAPI + DeerFlow bridge
- 已有 `DeerFlowRuntimeAdapter`
- 已有一键启动脚本串起 TS Office / Python Workshop / DeerFlow frontend

### 3.5 记忆与观测 baseline 已完成

- `.ai/` memory layout 已接入
- 已有 memory retrieval 与 execution summary writeback
- 已有 task events / execution trace / tool call log / cost log 基础能力
- 已有 file / memory / postgres 三种 persistence 模式

### 3.6 前端工作区 baseline 已完成

- Dashboard 已存在
- Tasks / Task Detail / Approvals / Execution Detail 页面已存在
- 任务详情页已能展示审批、执行、trace、结果摘要
- 执行详情页已能展示工具调用、执行 trace、控制动作
- 知识页已能展示历史沉淀与检索

---

## 4. 进行中

以下内容不是“完全没做”，而是已经开始，但还没有达到白皮书要求的产品级闭环。

### 4.1 Office / Workshop 仍是“接起来了”，不是“统一了”

现状：

- TS 与 Python 已经联通
- Workshop 已有 `TaskEnvelope`
- DeerFlow adapter 已可执行真实任务

未完成点：

- `TaskEnvelope` 还不是白皮书定义下的统一任务信封
- 预算、审批上下文、tool policy、checkpoint、memory profile 尚未统一收口
- Office 与 Workshop 还没有形成严格的共享状态协议

### 4.2 HITL 仍处于审批驱动阶段

现状：

- 风险任务可进入审批
- 审批可触发后续执行
- 执行有 pause / resume 基础能力

未完成点：

- 人工补充信息后的恢复执行尚未形成标准产品流
- “ask_human” 语义还没成为统一运行时协议
- UI 中尚未形成明确的挂起任务工作台

### 4.3 记忆层仍是 baseline，不是分层体系

现状：

- 已有 memory indexing / retrieve / writeback
- 知识页已可浏览沉淀

未完成点：

- L1 / L2 / L3 没有显式分层
- Agent 私人经验尚未纳入动态 prompt 注入机制
- 还没有项目级共享记忆和组织级只读记忆的强边界

### 4.4 前端仍是“工作区集合”，不是“数字总部三视图”

现状：

- 已有 Dashboard、任务页、审批页、知识页、执行页

未完成点：

- Dashboard 还只是入口和统计卡片
- 没有真正的 Kanban 视图
- 没有真正的 Tower 视图
- 没有 Atlas 图谱视图

### 4.5 Shared State Store 仍未达到目标架构

现状：

- Postgres 接缝已具备
- Redis 基础设施已存在

未完成点：

- Postgres / Redis 尚未形成 Office / Workshop 的统一主路径
- 没有图谱存储层
- 没有真正可依赖的跨执行器状态同步模型

---

## 5. 下一阶段

这一部分是接下来应直接执行的主线计划。

原则：

- 不再按旧 phase 文档逐个扫尾
- 改为按“白皮书目标 -> 当前底座升级”推进
- 先做主链闭环，再做高级能力

### 5.1 阶段 A：统一控制面主流程

目标：

- 把任务创建、审批、执行、工作流推进统一为单一主流程

要做的事：

1. 明确唯一任务主链：
   - `createTask`
   - `riskAssess`
   - `requestApproval`
   - `approve/reject`
   - `execute`
   - `advanceWorkflow`
   - `writeMemory`
   - `emitAudit`
2. 清理旧 phase 文档与现状不一致的问题，避免团队继续按过时缺口开发
3. 统一任务 / workflow / execution 的状态变更入口，减少桥接逻辑分散
4. 补齐三条主路径的集成测试：
   - 普通任务
   - 审批任务
   - 串行 / 并行 workflow 任务

验收标准：

- 单任务、审批任务、workflow 任务都能画出并验证唯一状态流转
- API、服务层、前端展示三处对同一状态解释一致

建议优先级：`P0`

### 5.2 阶段 B：定义 TaskEnvelope v2 并打通双核协议

目标：

- 把 Office / Workshop 从“可联通”升级为“统一协议协作”

要做的事：

1. 定义 `TaskEnvelope v2`，至少包含：
   - task metadata
   - assignee / roster
   - memory context profile
   - approval context
   - tool policy
   - budget / timeout / retry
   - checkpoint reference
   - runtime mode
2. 将 TS execution state 与 Workshop thread/checkpoint 对齐
3. 形成统一的 streaming / state update / control action 协议
4. 把 DeerFlow adapter 从“临时增强 prompt”升级为“协议驱动执行”

验收标准：

- 同一任务在 Office 与 Workshop 间可以完整追踪
- 执行中的任务可暂停、恢复，且状态一致
- TaskEnvelope 成为双核唯一任务协议

建议优先级：`P0`

### 5.3 阶段 C：把 HITL 从审批扩展成挂起-恢复机制

目标：

- 实现白皮书里的 Suspend & Resume 基础版

要做的事：

1. 定义运行时挂起原因：
   - 信息不足
   - 高风险动作待确认
   - 草案待审阅
2. 前端新增“待人工处理”工作区或任务视图
3. 人类反馈要能作为结构化输入回注运行时
4. 将 pause / resume 与 approval 打通，但不混为一谈

验收标准：

- 至少 1 条任务路径可实现：运行中挂起 -> 人类补充信息 -> 恢复执行

建议优先级：`P1`

### 5.4 阶段 D：把记忆层升级为 L1 / L2 / L3

目标：

- 将现有 memory baseline 升级为白皮书核心卖点

要做的事：

1. 建模：
   - L1 组织公共记忆
   - L2 项目共享记忆
   - L3 Agent 私人经验
2. 让任务执行前显式选择要加载的记忆层
3. L3 写回要支持按 Agent 归属沉淀
4. 知识页升级为按层级浏览，而不是只看混合列表

验收标准：

- 同一任务可显式加载不同层级记忆
- 执行后沉淀能落入正确层级

建议优先级：`P1`

### 5.5 阶段 E：治理层产品化

目标：

- 把当前的风险评估和审批基础升级为白皮书里的治理中心基础版

要做的事：

1. 审批升级为可配置多级流程基础版
2. 成本 / 预算 / 熔断进入统一治理模型
3. 工具权限、审批记录、执行 trace、审计日志统一进入治理视图
4. 定义红队审计与执行模型的扩展位，但本阶段先不做完整跨模型系统

验收标准：

- 高风险任务可通过规则进入多级审批
- 成本与风险信息不再分散在不同页面和数据结构中

建议优先级：`P1`

### 5.6 阶段 F：前端升级为三视图 HQ

目标：

- 让产品界面真正匹配 StaffAI 叙事

要做的事：

1. Console：
   - 保留现有专家协作和任务入口
2. Kanban：
   - 展示 task / workflow / assignment / execution 的推进关系
3. Tower：
   - 汇总审批阻塞、运行异常、成本、活跃度
4. 先做 Tower 和 Kanban，再考虑 Atlas

验收标准：

- 首页从“入口页”升级为“控制面”
- 管理者不需要进入多个页面才能掌握系统状态

建议优先级：`P2`

---

## 6. 延后项

以下内容明确重要，但不应进入当前主线。

### 6.1 延后到主链稳定之后

- Atlas 知识图谱可视化
- 图谱写入工具与关系编辑器
- Sidecar Vault / mTLS 影子代理
- 动态工具提审流
- 自由竞标机制
- 人才市场
- 跨模型红队审计完整体系
- 沙箱休眠与镜像级 hibernation
- Docker 物理沙箱的严格产品化

### 6.2 延后原因

- 这些功能都建立在“统一任务主链”和“统一双核协议”稳定之后
- 当前过早推进会打散控制面收口
- 会让团队从主线交付切换为多条概念验证并发，风险过高

---

## 7. 本季度建议执行顺序

建议按以下顺序推进：

1. 阶段 A：统一控制面主流程
2. 阶段 B：TaskEnvelope v2 + 双核协议
3. 阶段 C：HITL 挂起 / 恢复
4. 阶段 D：L1 / L2 / L3 记忆分层
5. 阶段 E：治理层产品化
6. 阶段 F：HQ 三视图升级

其中：

- `A + B` 是当前最关键的主线
- `C + D + E` 是白皮书价值真正落地的主体
- `F` 是产品化放大器

---

## 8. 立即执行清单

如果从本周开始执行，建议直接开以下 4 个任务：

### Task 1

统一控制面主链设计与测试补齐

输出：

- 状态流转图
- 单一主链服务边界
- 三条集成测试主路径

### Task 2

定义 `TaskEnvelope v2` 和 Office / Workshop 协议

输出：

- 新 envelope schema
- runtime event contract
- control action contract

### Task 3

实现基础版 HITL 挂起 / 恢复

输出：

- suspend reason model
- human feedback payload
- resume flow

### Task 4

设计并落地 L1 / L2 / L3 记忆分层

输出：

- memory model
- load policy
- writeback policy
- knowledge UI 升级方案

---

## 9. 文档治理规则

从本文档生效后，以下规则成立：

1. `2026-03-28-StaffAI-Agent-OS-Spec.md` 继续作为目标架构文档
2. 本文档作为当前执行总控文档
3. 旧 phase 文档保留，但不再默认作为排期源头
4. 后续子计划必须显式引用本文档中的阶段编号

---

## 10. 一句话结论

StaffAI 现在最应该做的，不是继续横向堆白皮书能力，而是先把**任务主链、双核协议、HITL、分层记忆**这四根主梁立稳；只要这四项做扎实，后面的 Atlas、竞标、人才市场和高级治理才会真正有产品承载力。
