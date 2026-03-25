# 2026-03-25 Tool-Gateway Next Slice

## Goal

Execute the next ordered implementation slice from the AI staff platform plan after the completed task-orchestration slice, using the required four-stage workflow:

1. `plan`
2. `tdd`
3. `code-review`
4. `refactor-clean`

This slice focuses on the earliest still-unstarted platform capability that now has enough foundation to land cleanly: a governed Tool Gateway with a minimal audit loop.

## Why This Slice Next

The previous slice established:

- explicit `TaskAssignment`
- explicit `WorkflowPlan`
- serial execution baseline
- task detail visibility for plan + assignments

The next missing capability in the ordered roadmap is `Phase 5｜工具与系统连接层`.
Without a Tool Gateway, later governance and trace work still has no stable abstraction boundary for:

- what tools exist
- which roles may use them
- which calls are high risk
- where to log those calls

This slice therefore implements the smallest production-credible Tool Gateway that can support later Phase 6 work.

## Scope For This Batch

### In Scope

1. Add first-class `ToolDefinition` vocabulary and risk model.
2. Add a backend Tool Gateway service with:
   - `listTools(agentRole)`
   - `checkPermission(agentRole, toolName, action?)`
   - `executeTool(toolName, input, actorContext)`
   - tool-call audit recording
3. Implement a first tool catalog with a bounded initial set:
   - `docs_search`
   - `runtime_executor`
   - `file_read`
   - `git_diff`
   - `test_runner`
4. Keep execution safe by using lightweight/dry-run or existing local abstractions where needed.
5. Add a `ToolCallLog` persistence seam alongside current task / execution / approval persistence.
6. Expose tool visibility and tool-call logs through API read models.
7. Extend execution detail so users can inspect tool calls tied to an execution.
8. Enforce high-risk tool approval blocking at the gateway boundary for this slice.
9. Add tests first for tool permissions, audit persistence, and API payload shape.
10. Run code review and refactor-clean on touched modules only.

### Out of Scope

- Full generic shell-command tool execution
- Full database / Redis migration
- Full execution trace model across every runtime action
- Pause / resume / cancel controls
- Full role migration for every agent markdown file
- UI for editing tool policy rules

## Slice Design

### Domain Additions

Add shared vocabulary for:

- `ToolRiskLevel`
- `ToolCategory`
- `ToolDefinition`
- `ToolCallStatus`
- `ToolCallLog`

### First Permission Model

Start with role-based visibility using existing task-routing vocabulary and the plan’s intended semantics:

- `reviewer`: read-only inspection tools
- `software-architect`: docs + runtime + read-only repo tools
- `backend-developer`: docs + runtime + test + repo inspection + limited write-safe tools only if explicitly allowed
- `technical-writer`: docs + read-only repo tools
- `dispatcher`: task/context/meta tools, but no direct high-risk execution

For this slice, permissions remain declarative and local to HQ backend code.

### High-Risk Behavior

High-risk tools should not execute if actor context requires approval and no approval has been granted.

Minimal rule for this slice:

- `runtime_executor` is `high`
- `file_read`, `git_diff`, `docs_search` are `low`
- `test_runner` is `medium`

The gateway should:

- allow low risk directly
- allow medium risk and record audit
- block high risk unless actor context says approval is already granted

### Audit / Log Shape

Each tool call log should capture at least:

- `id`
- `executionId`
- `taskId`
- `toolName`
- `actorRole`
- `status`
- `riskLevel`
- `inputSummary`
- `outputSummary`
- `createdAt`

This is intentionally narrower than the full future `AuditLog` + `ExecutionTrace`, but should be designed so those can build on it later.

## Bounded Context Ownership

- `shared/`: tool and audit vocabulary
- `tools/` or `gateway/`: tool catalog, permission checks, execution dispatch
- `store/` + `persistence/`: tool-call log persistence seam
- `api/`: tool listing and execution detail exposure
- `frontend/`: execution detail rendering for tool-call visibility

## Implementation Order

### Stage 1: Plan

1. Lock this slice to Tool Gateway + minimal audit loop only.
2. Reuse current runtime/discussion foundations instead of inventing a separate executor architecture.
3. Split work into backend domain/catalog, backend execution/API, and frontend execution-detail rendering.

### Stage 2: TDD

#### Backend track

1. Add failing tests for:
   - tool vocabulary and risk levels
   - permission filtering by role
   - high-risk tool blocking without approval
   - tool-call log persistence
   - execution detail payload including tool calls
2. Implement minimal tool catalog and gateway service.
3. Implement tool-call log store/repository seam.
4. Extend execution APIs/read models.

#### Frontend track

1. Extend execution detail types for tool-call logs.
2. Render a tool-call section in execution detail.
3. Keep existing execution detail states intact.

### Stage 3: Code Review

1. Review spec compliance against Phase 5 intent.
2. Review safety semantics around high-risk tools.
3. Fix blocking findings before completion.

### Stage 4: Refactor-Clean

1. Remove duplicated tool mapping or payload shaping introduced by the slice.
2. Keep cleanup limited to touched backend and execution-detail frontend files.
3. Re-run backend tests and frontend build.

## Parallel Subagent Plan

### Worker A: Backend tool vocabulary + persistence

Owns only:

- `hq/backend/src/shared/*`
- `hq/backend/src/store.ts`
- `hq/backend/src/persistence/*`
- backend tests directly covering tool-call persistence and shared vocabulary

Deliverables:

- tool domain types
- tool-call log repository seam
- store accessors

### Worker B: Backend gateway + API

Owns only:

- new tool gateway service/module(s)
- `hq/backend/src/api/executions.ts`
- optional new `hq/backend/src/api/tools.ts`
- integration tests for permissions and API payloads

Deliverables:

- tool catalog
- permission checks
- minimal execute/list API behavior
- execution detail payload exposure for tool logs

### Worker C: Frontend execution detail

Owns only:

- `hq/frontend/src/types.ts`
- `hq/frontend/src/hooks/useExecutionDetail.ts`
- `hq/frontend/src/app/executions/[id]/page.tsx`

Deliverables:

- execution detail tool-call section
- aligned frontend payload types

## Test Plan

### Backend

Run:

- `cd /Users/user/agency-agents/hq/backend && npm test`

Coverage focus:

- tool definition vocabulary
- permission filtering
- high-risk approval gating
- tool-call log persistence
- execution detail API payload shape

### Frontend

Run:

- `cd /Users/user/agency-agents/hq/frontend && npm run build`

## Expected Outcome

At the end of this slice, the platform should be able to:

- define a bounded set of governed tools
- show which tools a role can see/use
- block high-risk tool execution without approval context
- record a tool-call log for each gateway execution
- show tool-call logs on execution detail

## Risks

- The current backend does not yet have a universal runtime trace model, so tool logs must stay intentionally small.
- Tool execution should stay bounded and non-destructive in this slice.
- API growth must not break current task/execution consumers.

## Ship Gate

Do not mark this slice complete unless all are true:

- backend tests green
- frontend build green
- tool permission filtering is enforced
- high-risk tool path is blocked without approval
- execution detail shows stable tool-call data
- no unresolved blocking review findings
