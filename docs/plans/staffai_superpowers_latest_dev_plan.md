# StaffAI 融入 Superpowers 后的最新开发计划

## 0. 目标重定义

StaffAI 下一阶段不再以“专家集合 / 提示词增强”为核心，而是升级为：

**一句模糊需求 → AI 澄清 → 设计确认 → 计划生成 → 自动组队 → 审批推进 → 中间产物 → 最终交付 → 模板沉淀**

其中，`superpowers-https://github.com/obra/superpowers` 主要补上两段最关键能力：

1. **brainstorming**：把模糊需求收敛成可执行设计
2. **writing-plans**：把已确认设计拆成清晰的实施计划

StaffAI 自己继续承担：

- 场景化组队
- 自治等级控制
- 审批门禁
- 执行追踪
- 中间产物归档
- 模板沉淀

---

## 1. 最新主流程

### 新主流程

1. 用户输入一句模糊需求
2. 系统进入需求澄清（Brainstorming）
3. AI 一次问一个问题，逐步形成需求摘要
4. 用户确认设计摘要
5. 系统生成实施计划（Writing Plans）
6. 系统推荐团队与自治等级
7. 创建正式任务并自动组队
8. 执行过程中按节点审批
9. 展示中间产物与执行状态
10. 输出最终交付物
11. 一键沉淀为模板

### 第一落地场景

**产品研发需求交付场景**

示例：
> “我要新增一个任务创建向导页，支持自治等级、执行计划预览、审批节点和模板沉淀。”

系统自动拉起：

- 产品经理
- 架构师
- 前端
- 后端
- 安全
- Reviewer

---

## 2. 状态机升级

在现有 task / workflow / execution 之外，新增前置状态：

### 新状态流

- `intake`：接收原始需求
- `clarifying`：需求澄清中
- `design_ready`：设计摘要已形成，等待确认
- `planning`：生成实施计划
- `plan_ready`：计划已完成，等待创建正式任务
- `executing`：正式执行
- `waiting_approval`：等待审批
- `completed`：交付完成
- `templated`：已沉淀为模板

### 新中间对象

新增 `RequirementDraft`（或 `TaskIntent`）对象：

- `id`
- `rawInput`
- `clarificationStatus`
- `clarifiedGoal`
- `targetUser`
- `desiredDeliverable`
- `constraints`
- `unknowns`
- `confidenceScore`
- `suggestedScenario`
- `suggestedAutonomyLevel`
- `designSummary`
- `implementationPlan`
- `approvedAt`
- `createdTaskId`

这层对象在正式 `TaskRecord` 之前存在，用来承接 superpowers 的 brainstorming 和 writing-plans。

---

## 3. 自治等级重构

前台不再展示技术术语 `single / serial / parallel / advanced_discussion`，改成用户可理解的自治等级：

### 自治等级

#### L0 辅助模式
- 只做需求澄清和方案建议
- 不自动创建任务
- 不自动执行

#### L1 半自动模式
- 自动形成设计与计划
- 用户确认后创建任务
- 执行过程以人工触发为主

#### L2 推进模式
- 自动创建任务并拉起团队
- 低风险步骤自动推进
- 关键节点暂停审批

#### L3 自治模式
- 在预算和权限范围内自动闭环
- 自动拆解、组队、推进、恢复
- 高风险动作才唤醒人

### 底层映射建议

- `L0` → 不进入 TaskRecord，仅生成 RequirementDraft 输出
- `L1` → `advanced_discussion` / `serial`
- `L2` → `serial`
- `L3` → `parallel` 或未来扩展 execution strategy

---

## 4. 场景化落地：Feature Delivery Squad

新增一个核心 preset：

### `feature-delivery`

角色建议：

- `sprint-prioritizer`：产品经理
- `software-architect`：架构师
- `frontend-developer`：前端
- `backend-architect`：后端
- `security-engineer`：安全
- `code-reviewer`：评审

### 角色职责

#### 产品经理
- 输出简版 PRD
- 补齐目标、用户、范围、验收标准

#### 架构师
- 拆前后端边界
- 明确模块和接口关系
- 给出技术风险

#### 前端
- 输出页面结构
- 交互流程
- 状态流

#### 后端
- 输出接口设计
- 数据结构
- 执行逻辑

#### 安全
- 审核审批节点
- 权限边界
- 风险动作识别

#### Reviewer
- 汇总结果
- 给出是否进入开发 / 合并 / 上线建议

---

## 5. 融入 Superpowers 后的模块改造计划

## Phase 1：需求澄清层（最高优先级）

### 目标
把“标题 + 描述 + 创建任务”改成“模糊需求 → AI 澄清”。

### 前端
新增 `/tasks/new` 向导页：

#### Step 1. 输入需求
- 仅输入一句需求
- 不要求用户一开始写完整 PRD

#### Step 2. 澄清对话
- 左侧：对话区
- 右侧：实时更新的需求摘要卡

摘要卡字段：
- 目标
- 用户
- 核心流程
- 本期范围
- 交付物
- 约束
- 风险与待确认项

### 后端
新增接口：

- `POST /api/intents`：创建 RequirementDraft
- `POST /api/intents/:id/clarify`：继续澄清对话
- `POST /api/intents/:id/confirm-design`：确认设计摘要

### AI 逻辑
采用 superpowers `brainstorming` 风格：

- 一次只问一个问题
- 问题聚焦：目标 / 用户 / 交付物 / 约束
- 问到足够就停止，不无限追问

### 停止规则
满足任意条件即结束澄清：

- 已明确目标 + 交付物 + 约束
- 连续两轮没有新增有效信息
- 用户明确说“按你的理解继续”

---

## Phase 2：设计确认层

### 目标
在真正开工前，先把 AI 的理解给用户看。

### 前端
新增“设计确认”页区块：

- 目标
- 目标用户
- 核心流程
- 本期范围
- 非本期范围
- 风险点

支持：
- 继续修改
- 确认进入计划阶段

### 后端
新增：

- `POST /api/intents/:id/generate-design-summary`
- `POST /api/intents/:id/approve-design`

### Superpowers 映射
这一层就是 `brainstorming` 的结果落地。

---

## Phase 3：计划生成层

### 目标
让设计确认后自动生成计划，而不是直接执行。

### 前端
新增“计划预览”页：

展示：
- 参与角色
- 角色职责
- 执行顺序
- 中间产物
- 关键审批点
- 推荐自治等级

### 后端
新增：

- `POST /api/intents/:id/generate-plan`
- `GET /api/intents/:id/plan`

### 计划内容结构
每个任务块包含：
- role
- goal
- input
- output
- files / modules involved
- verification step
- approval required

### Superpowers 映射
这一层就是 `writing-plans` 的结果落地。

---

## Phase 4：自动组队与正式任务创建

### 目标
从 RequirementDraft 正式转成 TaskRecord，并自动拉起团队。

### 后端
新增：

- `POST /api/intents/:id/create-task`

动作：
- 选择 `feature-delivery` preset
- 生成 workflowPlan
- 生成 assignments
- 写入 TaskRecord
- 写入 audit trail

### 代码改造重点

#### `mvp-preset.ts`
- 新增 `feature-delivery`

#### `mvp-scenario-runner.ts`
- 新增产品研发场景命中逻辑
- 避免默认回退到 `full-stack-dev`

#### `task-orchestrator.ts`
新增需求交付链：
1. Product
2. Architect
3. Frontend
4. Backend
5. Security
6. Reviewer

---

## Phase 5：中间产物系统

### 目标
让用户看到“团队真的在推进”，不是只看到日志和总结。

### 中间产物结构

#### Product
- PRD 摘要
- 用户故事
- 验收标准

#### Architect
- 模块划分
- 边界说明
- 接口草案

#### Frontend
- 页面结构
- 组件清单
- 状态流

#### Backend
- API 设计
- 数据模型
- 执行逻辑

#### Security
- 风险清单
- 权限要求
- 审批建议

#### Reviewer
- 总评
- 风险余项
- 是否可进入下一阶段

### 前端
任务详情页新增 tab：
- 总览
- 计划
- 中间产物
- 审批
- 最终交付

### 后端
扩展 assignment / execution 结果结构，支持结构化产物，而不是只有字符串 summary。

---

## Phase 6：审批节点升级

### 目标
让审批成为真实门禁。

### 审批类型

- 计划审批
- 高风险动作审批
- 最终交付审批

### 前端
审批页展示：
- 为什么要审批
- 当前建议是什么
- 批准后会发生什么
- 拒绝后会退回哪一步

### 后端
扩展 ApprovalRecord：
- `approvalType`
- `resumeTarget`
- `riskReason`
- `blockingArtifacts`

---

## Phase 7：最终交付与模板沉淀

### 目标
让每次任务都能变成可复用模板。

### 最终交付结构
- 最终方案摘要
- 前后端实现建议
- 风险和限制
- 待办事项
- 建议 merge / PR / hold

### 模板沉淀
新增模板类型：
- 需求澄清模板
- 设计摘要模板
- 交付计划模板
- 角色协作模板
- 审批模板

### 新接口
- `POST /api/tasks/:id/save-template`
- `GET /api/templates`
- `POST /api/templates/:id/create-task`

---

## 6. 版本路线图

## V0.1（必须先做）

### 目标
让 StaffAI 具备“模糊需求 → 设计确认 → 计划预览”的前置能力。

### 范围
- RequirementDraft 对象
- `/tasks/new` 向导页
- brainstorming 对话流
- 设计确认页
- 计划预览页
- `feature-delivery` preset
- 自治等级 UI 映射

### 验收标准
用户可以只输入一句模糊需求，系统能：
- 主动澄清
- 输出需求摘要
- 生成一版可读计划
- 显示推荐团队

---

## V0.2

### 目标
从“计划”进入“自动组队执行”。

### 范围
- RequirementDraft → TaskRecord 转换
- 自动组队
- 需求交付链 workflow
- 中间产物骨架
- 任务详情页新增计划 / 产物视图

### 验收标准
用户确认计划后，系统能自动拉起团队，并能按角色展示阶段性产物。

---

## V0.3

### 目标
补齐审批与恢复执行。

### 范围
- 审批类型细分
- 审批 UI
- 高风险动作拦截
- 批准后自动恢复
- 审批轨迹展示

### 验收标准
系统能在关键节点停住，等人批，再继续跑。

---

## V0.4

### 目标
形成复用飞轮。

### 范围
- 模板沉淀
- 模板中心
- 一键复用历史需求交付链
- 模板与场景绑定

### 验收标准
一次做过的需求交付流程，可以被下次直接复用。

---

## 7. 按角色拆分的任务单

## 产品
- 定义 RequirementDraft 字段
- 定义 4 档自治等级
- 定义需求澄清停止规则
- 定义设计摘要结构
- 定义计划预览结构
- 定义中间产物结构
- 定义审批类型
- 定义模板结构

## 前端
- 重做 `/tasks/new`
- 需求澄清 UI
- 设计确认 UI
- 计划预览 UI
- 任务详情页新增 tab
- 审批页
- 最终交付页
- 模板入口

## 后端
- RequirementDraft 模型与接口
- brainstorming service
- plan generation service
- `feature-delivery` preset
- plan preview API
- intent → task 转换逻辑
- assignment 结构化产物支持
- template API

## 架构
- 设计 RequirementDraft → TaskRecord 的边界
- 定义 brainstorming / planning / execution 的状态机
- 统一 assignment output schema
- 定义自治等级与执行模式映射
- 设计 future-proof 的 workflow engine 扩展点

## 安全
- 审批规则设计
- 高风险动作列表
- 模板复用权限边界
- 需求澄清阶段的敏感信息拦截
- 最终执行阶段的工具调用边界

---

## 8. 第一周立即开工清单

### Day 1-2
- 新增 `RequirementDraft` schema
- 新增 `feature-delivery` preset
- 定义自治等级枚举与映射
- 输出 `/tasks/new` 页面低保真原型

### Day 3-4
- 完成 brainstorming API 骨架
- 完成前端澄清对话页
- 完成设计摘要页
- 完成计划预览页静态版本

### Day 5-6
- 打通 plan generation API
- 打通 RequirementDraft → TaskRecord
- 接入 `feature-delivery` 自动组队

### Day 7
- 端到端跑一个真实 demo：
  - 输入一句需求
  - AI 澄清
  - 用户确认设计
  - 生成计划
  - 创建任务并组队

---

## 9. 当前阶段不做的事

为了避免失焦，暂时不做：

- 全场景统一引入 superpowers 全量 skill
- 通用 agent marketplace 重构
- 深度接管 git worktree / branch 管理
- 复杂多轮并行自治恢复
- 面向所有任务类型的一次性泛化

当前只做：

**产品研发需求交付场景**

---

## 10. 一句话收口

StaffAI 融入 superpowers 后，下一阶段开发重点不是“让 AI 更像很多专家在聊天”，而是：

**让模糊需求先被澄清，再被设计、再被计划、再自动组织一支小组推进到交付。**

