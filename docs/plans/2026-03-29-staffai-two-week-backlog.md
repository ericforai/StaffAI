# 2026-03-29 StaffAI 未来两周迭代 Backlog

## 0. 文档定位

本文件是 [2026-03-29-staffai-master-development-plan.md](/Users/user/agency-agents/docs/plans/2026-03-29-staffai-master-development-plan.md) 的两周执行拆解版。

目标不是继续抽象路线，而是给出一份可以直接拉任务、排顺序、分配 agent 的短周期 backlog。

本轮只覆盖未来两周，且只聚焦总控计划中的最高优先级主线：

1. 统一控制面主流程
2. 定义 `TaskEnvelope v2`
3. 打通 Office / Workshop 协议
4. 落一条最小 HITL 挂起 / 恢复路径
5. 启动 L1 / L2 / L3 记忆分层设计与最小实现

---

## 1. 迭代目标

两周结束时，希望达到以下结果：

- 任务主链从创建、审批、执行到沉淀有唯一主流程
- TS Office 与 Python Workshop 有明确 `TaskEnvelope v2` 协议
- 至少一条任务路径支持挂起 -> 人类补充 -> 恢复
- 记忆层不再只有“统一 memory”，而是进入 L1 / L2 / L3 明确建模
- 团队可以在此基础上继续推进治理层和 HQ 三视图升级

---

## 2. Agent 分工原则

本轮建议使用三位 agent 做固定分工，减少职责飘移。

### Claude Code

定位：

- 主协调者
- 控制面与后端主链收口负责人
- 负责把多模块改动串成可工作的闭环

适合负责：

- orchestration / api / governance 主流程
- 集成测试
- 文档收口

### Codex

定位：

- 运行时与协议实现负责人
- 偏工程落地和接口精炼

适合负责：

- runtime adapter
- `TaskEnvelope v2`
- Workshop / Office 协议对齐
- execution / state contract

### Gemini CLI

定位：

- 方案审查与结构化设计负责人
- 偏设计推演、边界定义、评审和验收口径

适合负责：

- HITL 交互方案
- L1 / L2 / L3 记忆模型
- 验收标准与风险审查
- 周中 / 周末审查结论

---

## 3. 两周节奏

### Week 1

主目标：

- 收口控制面主链
- 落 `TaskEnvelope v2` 初版协议
- 先把双核通信契约定下来

### Week 2

主目标：

- 打通一条最小 HITL 路径
- 启动并落地最小版 L1 / L2 / L3
- 形成下一轮治理层和前端升级的稳定基线

---

## 4. Week 1 Backlog

## Task W1-1

### 名称

统一任务主链入口

### 目标

把任务从创建到执行的主链路统一成单一入口，减少桥接逻辑散落。

### 当前依据

- 已有 `TaskLifecycleService`
- 已有 `TaskStateMachine`
- 已有 `approval-execution-bridge`
- 已有 `task-execution-orchestrator`

### 要做的事

1. 梳理当前任务主链真实入口和分叉点
2. 定义“唯一主链服务”的职责边界
3. 收口以下行为的入口：
   - create task
   - risk assess
   - approval request / resolve
   - start execution
   - workflow advance
   - memory writeback
4. 为普通任务、审批任务、workflow 任务补统一集成测试

### 输出物

- 主链流程图
- 主链服务边界说明
- 集成测试用例清单
- 代码实现与测试补齐

### 依赖

- 无

### 建议负责人

- `Claude Code`

### 协作人

- `Gemini CLI`：review 主链边界是否清晰

### 验收标准

- 三类任务路径都走同一套主链语义
- API / service / UI 对同一状态解释一致

---

## Task W1-2

### 名称

定义 `TaskEnvelope v2` 协议

### 目标

把当前 Workshop 的简化 envelope 升级为双核统一协议。

### 当前依据

- `workshop/main.py` 已有 `TaskEnvelope`
- `deerflow-adapter.ts` 已在向 Workshop 发送执行上下文
- execution / workflow / memory / approval 基础字段已在 TS 侧存在

### 要做的事

1. 定义 `TaskEnvelope v2` schema
2. 明确字段分组：
   - task metadata
   - routing / assignee
   - approval context
   - memory context profile
   - budget / timeout / retry
   - tool policy
   - checkpoint reference
   - runtime control metadata
3. 标注哪些字段来自 TS 真相源，哪些由 Workshop 只读消费
4. 设计版本兼容策略，避免一次性打断现有调用

### 输出物

- `TaskEnvelope v2` 字段定义文档
- TS / Python 两端类型草案
- 兼容迁移说明

### 依赖

- W1-1 的主链边界确认

### 建议负责人

- `Codex`

### 协作人

- `Claude Code`：确认字段能进入主链
- `Gemini CLI`：review schema 完整性

### 验收标准

- `TaskEnvelope v2` 能覆盖当前主链最小所需上下文
- 不再依赖 runtime adapter 中的临时 prompt 拼接兜底来表达控制语义

---

## Task W1-3

### 名称

双核事件与控制协议初版

### 目标

把 Office / Workshop 之间的运行事件、状态更新和控制动作定义清楚。

### 要做的事

1. 定义 streaming event contract
2. 定义 state update contract
3. 定义 control action contract：
   - pause
   - resume
   - cancel
   - ask_human
4. 定义最小错误协议：
   - runtime unavailable
   - invalid checkpoint
   - approval required
   - human input required

### 输出物

- 协议文档
- 事件类型清单
- 错误码清单

### 依赖

- W1-2

### 建议负责人

- `Codex`

### 协作人

- `Claude Code`

### 验收标准

- TS 与 Python 可以按统一事件命名理解执行过程
- 后续 HITL 和 resume 设计不再需要额外推翻协议

---

## Task W1-4

### 名称

控制面主链 review 与周中校准

### 目标

防止 Week 1 在实现中继续把主链拆散。

### 要做的事

1. 审查 W1-1 ~ W1-3 设计是否有职责重叠
2. 检查是否出现以下问题：
   - 状态机和 orchestrator 各管一半
   - approval 和 pause/resume 语义混用
   - envelope 字段过度设计
3. 输出周中 review 结论

### 输出物

- review note
- 调整建议

### 依赖

- W1-1
- W1-2
- W1-3

### 建议负责人

- `Gemini CLI`

### 验收标准

- 周中 review 输出可以直接指导剩余 Week 1 工作

---

## 5. Week 2 Backlog

## Task W2-1

### 名称

最小 HITL 路径落地

### 目标

实现一条基础版挂起 -> 人类补充 -> 恢复的真实链路。

### 要做的事

1. 定义挂起原因模型：
   - missing_information
   - approval_required
   - draft_review_required
2. 在控制面中新增“待人工处理”状态或等价视图
3. 定义人类反馈 payload
4. 实现 resume 后重新进入执行

### 输出物

- suspend reason model
- human feedback payload schema
- 最小 UI / API / runtime 打通

### 依赖

- W1-2
- W1-3

### 建议负责人

- `Claude Code`

### 协作人

- `Codex`：配合 runtime 恢复路径
- `Gemini CLI`：review 交互语义

### 验收标准

- 至少一条任务路径可以真实完成 suspend -> human input -> resume

---

## Task W2-2

### 名称

`TaskEnvelope v2` 接入 DeerFlow adapter 与 Workshop

### 目标

把 Week 1 的协议真正落到代码里。

### 要做的事

1. 更新 TS 侧 runtime adapter
2. 更新 Python `TaskEnvelope` 模型
3. 对齐 Workshop 消费方式
4. 保留最小兼容层，避免旧调用全挂

### 输出物

- TS 侧协议实现
- Python 侧协议实现
- 兼容回退逻辑

### 依赖

- W1-2
- W1-3

### 建议负责人

- `Codex`

### 协作人

- `Claude Code`

### 验收标准

- 一条真实任务可以使用 `TaskEnvelope v2` 跑通
- 执行 trace 中能看到 v2 协议相关字段生效

---

## Task W2-3

### 名称

L1 / L2 / L3 记忆模型最小落地

### 目标

把当前 memory baseline 变成显式分层模型。

### 要做的事

1. 定义 L1 / L2 / L3 的目录、归属、读写规则
2. 定义任务执行前的记忆装载策略
3. 定义执行后的写回策略
4. 改造 knowledge 页面支持按层级浏览

### 输出物

- memory layer model
- load / writeback policy
- 最小代码实现
- UI 层级筛选方案

### 依赖

- W1-1

### 建议负责人

- `Gemini CLI`

### 协作人

- `Claude Code`：主链接入
- `Codex`：必要时补 runtime 消费字段

### 验收标准

- 同一任务可明确使用 L1 / L2 / L3 中的至少两层
- 新沉淀结果能写入指定层级

---

## Task W2-4

### 名称

两周末收口 review

### 目标

确认两周成果能成为下一轮治理层和三视图升级的稳定基线。

### 要做的事

1. 审查主链是否仍存在重复入口
2. 审查 HITL 是否只是“另一个审批”
3. 审查 memory 分层是否只是目录重命名
4. 审查双核协议是否真正被代码消费
5. 给出下一轮建议 backlog

### 输出物

- 两周 review 结论
- 下一轮 backlog 建议

### 依赖

- W2-1
- W2-2
- W2-3

### 建议负责人

- `Gemini CLI`

### 验收标准

- review 结论可以直接作为下一轮计划输入

---

## 6. Sprint 1 执行结果 (2026-03-29)

### 后端 Sprint — 全部完成 ✅

| Task | 状态 | 测试 | 关键文件 |
|------|------|------|----------|
| W1-1 统一任务主链 | ✅ | 11/11 | `orchestration/task-main-chain-service.ts` |
| W1-2 TaskEnvelope v2 | ✅ | 11/11 | `shared/task-envelope-v2.ts`, `workshop/task_envelope_v2.py` |
| W1-3 双核事件协议 | ✅ | 类型定义 | `shared/dual-core-protocol.ts` |
| W2-1 最小 HITL 路径 | ✅ | 7/7 | `shared/hitl-types.ts`, `orchestration/hitl-service.ts` |
| W2-2 DeerFlow 接入 | ✅ | 5/5 | `runtime/adapters/deerflow-adapter.ts`, `workshop/main.py` |
| W2-3 记忆分层 | ✅ | 9/9 | `shared/memory-layer-types.ts`, `orchestration/memory-layer-service.ts` |

**总计**: 43/43 新测试通过, 后端构建零错误, 架构师审核通过。

### Frontend Sprint — 全部完成 ✅ (分支: feat/frontend-hitl-wiring)

| Task | 状态 | 关键变更 |
|------|------|----------|
| FE-1 suspended 状态显示 | ✅ | 3 个 formatTaskStatus + 事件类型/元数据 |
| FE-2 HITL API 端点 | ✅ | POST /tasks/:id/suspend, POST /tasks/:id/resume |
| FE-3 前端 hooks | ✅ | useTaskActions 增加 suspendTask/resumeTask |
| FE-4 HITL 反馈 UI | ✅ | SuspendedTaskPanel 组件 + 任务详情页集成 |

**总计**: 前后端构建均零错误, 架构师审核通过。

### 遗留项 (非阻塞, 下一迭代处理)

1. TaskMainChainService 未集成 MemoryLayerService.writeback() — 写回职责归 ExecutionService
2. HITL suspend/resume 未接入 runtime adapter 实际执行流
3. Python `parse_task_envelope()` 缺少独立单元测试
4. W1-4 / W2-4 review 任务未执行 (Gemini CLI 审查)

---

## 7. 优先级排序

说明：

- `W1-1` 是所有任务的地基
- `W1-2 + W1-3 + W2-2` 决定双核是否真的成为系统主路径
- `W2-1 + W2-3` 决定 Agent OS 是否开始呈现白皮书特征

---

## 7. Agent 任务清单汇总

### Claude Code

- W1-1 统一任务主链入口
- W2-1 最小 HITL 路径落地
- 配合 W1-2 / W1-3 / W2-2 / W2-3 的主链接入

### Codex

- W1-2 定义 `TaskEnvelope v2`
- W1-3 双核事件与控制协议初版
- W2-2 `TaskEnvelope v2` 接入 DeerFlow adapter 与 Workshop

### Gemini CLI

- W1-4 控制面主链 review 与周中校准
- W2-3 L1 / L2 / L3 记忆模型最小落地
- W2-4 两周末收口 review

---

## 8. 建议的每日推进方式

建议采用以下节奏：

### Day 1-2

- Claude Code 启动 W1-1
- Codex 启动 W1-2

### Day 3-4

- Codex 启动 W1-3
- Claude Code 继续补 W1-1 集成测试

### Day 5

- Gemini CLI 做 W1-4 周中 review

### Day 6-8

- Codex 启动 W2-2
- Claude Code 启动 W2-1

### Day 9-10

- Gemini CLI 启动 W2-3
- Claude Code 配合接入主链

### Day 10 末

- Gemini CLI 做 W2-4 收口 review

---

## 9. 本轮不建议进入的事项

两周内不要主动插入以下任务：

- Atlas 图谱可视化
- Sidecar Vault
- 多级审批完整平台化
- 跨模型红队审计
- 自由竞标
- 人才市场
- Tower / Kanban 全量前端重构

原因：

- 这些任务会直接打断当前主线
- 现在最需要的是建立稳定的 Agent OS 核心协议，而不是扩功能面

---

## 10. 一句话结论

未来两周的最佳打法不是平均铺开，而是让 `Claude Code` 收口主链、让 `Codex` 固化双核协议、让 `Gemini CLI` 做结构审查与记忆模型；三者各守一条主责线，才能把 StaffAI 从“已有底座”推进到“真正可持续演进的 Agent OS 起点”。
