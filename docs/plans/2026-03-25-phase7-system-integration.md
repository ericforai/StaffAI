# Phase 7: 系统串联与联调实施计划

## 一、需求重述

Phase 7 需要完成以下核心闭环：

### 7.1 单任务闭环 (部分完成)
- ✅ 创建任务 → 路由专家 → 执行 → 记录 execution → 写入 memory 摘要
- ❌ **缺失**: 端到端自动化流程
- ❌ **缺失**: ApprovalServiceV2 与任务编排器的集成
- ❌ **缺失**: 审批后的自动执行触发

### 7.4 审批闭环 (基础版)
- ✅ ApprovalServiceV2 带风险评估
- ❌ **缺失**: 审批结果与任务状态联动
- ❌ **缺失**: 审批通过触发执行
- ❌ **缺失**: 取消审批的任务处理

### 7.5 串行/并行完整闭环
- ❌ **缺失**: WorkflowPlan 状态递进
- ❌ **缺失**: Assignment 状态转换
- ❌ **缺失**: Step-by-step 执行与状态持久化

## 二、架构分析

### 当前系统分层

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Layer                                 │
│  /api/tasks  /api/approvals  /api/executions  /api/audit        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────────┐
│                    Orchestration Layer                           │
│  TaskOrchestrator  TaskExecutionOrchestrator  WorkflowService   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────────┐
│                      Governance Layer                             │
│  ApprovalServiceV2  RiskAssessmentEngine  AuditLogger          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────────┐
│                      Runtime Layer                                │
│  ExecutionService  RuntimeAdapter  ExpertRunner                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────────┐
│                    Persistence Layer                             │
│  Store  Repositories  File/Postgres Adapters                  │
└─────────────────────────────────────────────────────────────────┘
```

### 关键问题

1. **审批 API 使用旧服务**: `api/approvals.ts` 仍导入 `approval-service` 而非 `approval-service-v2`
2. **任务编排器未集成新审批**: `task-orchestrator.ts` 未使用 ApprovalServiceV2
3. **缺少状态机**: Task、Approval、Assignment 的状态转换分散在各处
4. **执行流程断点**: 审批通过后没有自动触发执行

## 三、实施阶段

### Phase 7.1: 审批服务集成 (HIGH)

**目标**: 将 ApprovalServiceV2 集成到任务生命周期

**文件**:
- `api/approvals.ts` - 迁移到 ApprovalServiceV2
- `orchestration/task-orchestrator.ts` - 集成风险评估和审批
- `orchestration/task-lifecycle-service.ts` - **新建** 统一生命周期管理

**步骤**:
1. 更新 `api/approvals.ts` 使用 `ApprovalServiceV2`
2. 创建 `TaskLifecycleService` 封装状态转换逻辑
3. 在 `TaskOrchestrator` 中集成风险评估
4. 添加审批状态监听器

**验收**:
- [ ] POST /api/approvals/:id/approve 使用 ApprovalServiceV2
- [ ] 审批创建时自动进行风险评估
- [ ] 审批记录包含 riskLevel, reason 等扩展字段
- [ ] 审批通过后任务状态变为 `routed`

### Phase 7.2: 任务状态机 (HIGH)

**目标**: 创建统一的任务状态管理服务

**文件**:
- `orchestration/task-state-machine.ts` - **新建**

**功能**:
```typescript
interface TaskStateMachine {
  transition(taskId: string, event: TaskEvent): Promise<TaskTransitionResult>;
  canTransition(taskId: string, toStatus: TaskStatus): boolean;
  getAvailableTransitions(taskId: string): TaskStatus[];
}

type TaskEvent =
  | 'create'
  | 'route'
  | 'request_approval'
  | 'approve'
  | 'reject'
  | 'cancel_approval'
  | 'start_execution'
  | 'complete_execution'
  | 'fail_execution';
```

**状态转换图**:
```
created ──route──→ routed ──request_approval──→ waiting_approval
   │                    │                           │
   │                    │                        approve
   │                    └─────────────┬─────────────┘
   │                                  │
   │                                routed
   │                                  │
cancel                          start_execution
   │                                  │
cancelled                             running
                                    │
                          complete/fail
                                    │
                              completed/failed
```

**验收**:
- [ ] 状态转换验证有效
- [ ] 无效转换抛出错误
- [ ] 所有转换记录审计日志
- [ ] 支持状态转换查询

### Phase 7.3: 工作流执行引擎 (HIGH)

**目标**: 实现串行/并行工作流的逐步执行

**文件**:
- `orchestration/workflow-execution-engine.ts` - **新建**
- `orchestration/assignment-executor.ts` - **新建**

**功能**:
```typescript
interface WorkflowExecutionEngine {
  execute(workflowPlan: WorkflowPlan): Promise<WorkflowExecutionResult>;
  resume(workflowPlanId: string): Promise<void>;
  cancel(workflowPlanId: string): Promise<void>;
  getStatus(workflowPlanId: string): WorkflowExecutionStatus;
}

interface AssignmentExecutor {
  execute(assignment: TaskAssignment): Promise<AssignmentResult>;
  resume(assignmentId: string): Promise<void>;
  cancel(assignmentId: string): Promise<void>;
}
```

**执行流程**:
```
1. 验证工作流状态
2. 获取下一个待执行的 step
3. 创建/获取对应的 assignment
4. 调用 RuntimeAdapter 执行
5. 更新 assignment 状态
6. 更新 step 状态
7. 如果有下一步，循环执行
8. 如果完成，更新 workflowPlan 状态
9. 记录审计日志
```

**验收**:
- [ ] 串行工作流按顺序执行所有步骤
- [ ] 并行工作流同时执行所有步骤
- [ ] Assignment 状态正确转换
- [ ] 支持执行中断和恢复
- [ ] 失败时正确处理状态

### Phase 7.4: 审批-执行联动 (MEDIUM)

**目标**: 审批通过后自动触发执行

**文件**:
- `api/approvals.ts` - 添加执行触发
- `orchestration/approval-execution-bridge.ts` - **新建**

**步骤**:
1. 审批通过后检查任务状态
2. 如果任务就绪 (routed)，自动触发执行
3. 创建 execution 记录
4. 更新任务状态为 `running`
5. 触发 WebSocket 事件

**验收**:
- [ ] 审批通过后自动创建 execution
- [ ] 任务状态变为 `running`
- [ ] WebSocket 推送执行开始事件
- [ ] 支持手动执行（不自动触发）

### Phase 7.5: 端到端测试 (MEDIUM)

**目标**: 覆盖完整流程的集成测试

**文件**:
- `__tests__/integration/task-lifecycle.integration.test.ts`
- `__tests__/integration/approval-execution.integration.test.ts`
- `__tests__/integration/workflow-execution.integration.test.ts`

**测试场景**:
1. **简单任务流程**: 创建 → 路由 → 执行 → 完成
2. **审批流程**: 创建 → 请求审批 → 审批 → 执行
3. **串行工作流**: 创建 → 串行执行 → 两步完成
4. **并行工作流**: 创建 → 并行执行 → 汇总结果
5. **失败场景**: 执行失败 → 重试 → 最终失败

**验收**:
- [ ] 所有场景测试通过
- [ ] 测试覆盖率达到 80%+
- [ ] 包含边界条件和错误处理

## 四、依赖关系

```
Phase 7.1 (审批服务集成)
    │
    ├── Phase 7.2 (任务状态机) ─┐
    │                           │
    └───────────────────────────┤
                                │
Phase 7.3 (工作流执行引擎) ◄────┘
    │
    ├── Phase 7.4 (审批-执行联动)
    │
    └── Phase 7.5 (端到端测试)
```

## 五、风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 状态机复杂度 | MEDIUM | 从小规模开始，逐步扩展 |
| 执行失败恢复 | HIGH | 添加重试机制和失败记录 |
| 并发执行冲突 | MEDIUM | 使用 Assignment 级别锁 |
| API 兼容性 | LOW | 保留旧 API 标记为 deprecated |
| 测试环境不稳定 | MEDIUM | 使用隔离的测试数据 |

## 六、复杂度评估

| 阶段 | 复杂度 | 预计时间 |
|------|--------|----------|
| Phase 7.1 | MEDIUM | 3-4 小时 |
| Phase 7.2 | HIGH | 4-5 小时 |
| Phase 7.3 | HIGH | 5-6 小时 |
| Phase 7.4 | MEDIUM | 2-3 小时 |
| Phase 7.5 | MEDIUM | 3-4 小时 |
| **总计** | | **17-22 小时** |

## 七、并行开发策略

建议同时启动 3 个并行子任务：

1. **子任务 A**: Phase 7.1 + 7.2 (状态机基础)
2. **子任务 B**: Phase 7.3 (工作流执行引擎)
3. **子任务 C**: Phase 7.4 (审批-执行联动)

最后合并进行 Phase 7.5 (集成测试)。

---

**等待确认**: 是否按此计划执行？(yes/no/modify)
