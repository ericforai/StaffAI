# StaffAI Platform 1.0 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn `agency-agents/hq` into a platform 1.0 task-orchestration core that can later be migrated into `ericforai/StaffAI`.

**Architecture:** Keep the current TypeScript + Express + MCP + Next.js stack, but enforce new bounded contexts from day one: `api`, `orchestration`, `runtime`, `governance`, `memory`, `observability`, and `registry`. Build the first production-worthy loop around `Task`, `Approval`, a lightweight `Execution`, and a preserved `discussion` advanced mode.

**Tech Stack:** TypeScript, Express, MCP SDK, Next.js 16, React 19, existing JSON/file storage, PostgreSQL-ready domain models, Playwright, Node test runner.

---

## Execution Status

### Snapshot

- [x] Sprint 1 started and largely completed
- [x] Sprint 2 task + approval core loop implemented
- [x] Sprint 3 lightweight execution path implemented
- [x] Sprint 4 multi-page workspace MVP implemented
- [x] Sprint 5 memory + observability started, first baseline landed
- [x] PostgreSQL-backed persistence adapter implemented (`pg` repositories landed)
- [x] Full discussion-service slimming completed to thin orchestration facade

### Completed So Far

- [x] Shared task vocabulary and execution modes
- [x] Thin API seams for tasks / approvals / executions
- [x] Task creation, list, detail, and newest-first ordering
- [x] Approval generation, listing, approve, reject
- [x] Execution creation and execution detail retrieval
- [x] Advanced discussion mode wired into task execution flow
- [x] Task read models for task list and task detail
- [x] Multi-page frontend workspace (`/tasks`, `/tasks/[id]`, `/approvals`, `/executions/[id]`)
- [x] Task creation from frontend workspace
- [x] Task execution from frontend workspace
- [x] Approval queue actions from frontend workspace
- [x] Backend test suite green
- [x] Frontend lint green
- [x] Task workspace smoke E2E green
- [x] `.ai/` memory retrieval + execution summary writeback baseline
- [x] `task-events` observability helper baseline
- [x] `GET /api/task-events` event feed endpoint (recent ring buffer)
- [x] Task Detail page wired to task-scoped event timeline (API snapshot + refresh)
- [x] Task Detail task-events upgraded to API snapshot + WS incremental realtime updates
- [x] Task List page shows per-task latest event summary (feed projection)
- [x] Approval Queue page shows task-event summary for pending and listed approvals
- [x] Persistence seam introduced (`Task/Approval/Execution` repositories + file adapters)
- [x] Expert ranking seam extracted from `discussion-service.ts` into orchestration module
- [x] Backend full suite expanded and remains green (109 tests)
- [x] `AGENCY_PERSISTENCE_MODE=memory` baseline landed (non-file-backed runtime mode)
- [x] Execution history list endpoint added: `GET /api/executions` (supports `taskId` filter)
- [x] `DashboardEvent` transport type extracted from `discussion-service.ts` into `observability`
- [x] Discussion executor/runtime boundary extracted via `runtime/discussion-runtime.ts`
- [x] PostgreSQL persistence adapter landed (`persistence/postgres-repositories.ts`, env-configurable)
- [x] Executions API no longer returns sprint skeleton stage (`stage: production`)
- [x] Backend suite now 117 tests green after seam + skeleton + runtime extraction
- [x] Discussion execution prompt/runtime calls extracted from `discussion-service.ts` into `runtime/discussion-execution-facade.ts`
- [x] Dashboard-wide task-event projection helper rollout landed (Dashboard / Tasks / Approvals)
- [x] Backend suite now 128 tests green after discussion-service seam completion

### Recently Closed

- [x] Continue extracting seams from `discussion-service.ts` (completed in current branch)
- [x] Continue hardening workspace UX beyond smoke coverage
- [x] Continue reducing transport/domain mixing in backend modules

### Additional Milestones

- [x] `.ai/` memory indexing and retrieval hardening (weighted ranking + fallback + truncation landed)
- [x] `task-events` / observability helper layer hardening (dashboard-wide rollout landed with shared projection helper)
- [x] richer execution history and non-file-backed persistence (history API projections + postgres adapter landed)
- [x] full `discussion-service` reduction to thin orchestration facade

---

## Implementation Rules

- Use TDD for every new core path: failing test first, then minimal implementation, then refactor.
- Keep HTTP handlers thin. No domain logic in route files.
- No new file should trend toward 500+ lines.
- New code must land in its bounded context folder.
- `discussion` remains available, but is treated as an advanced task execution mode.
- First-phase persistence rule:
  - database-backed model design now: `Task`, `Approval`
  - lightweight/in-memory-or-file-backed for now: `Assignment`, `Execution`
- Full naming migration from `discussion-first` to `task/orchestration/execution-first` is in scope.

## Architecture Defense Rules

- `api/` owns request/response mapping, validation, and route composition only.
- `orchestration/` owns task planning, routing, state progression, and synthesis only.
- `runtime/` owns executor interaction, timeout handling, degradation, and execution results only.
- `governance/` owns risk policy, approval decisions, and audit hooks only.
- `memory/` owns context retrieval and writeback only.
- `observability/` owns logging, event emission, and trace helpers only.
- No bounded context may directly mutate another context's primary state without going through an explicit interface.
- If a file approaches 500 lines or mixes transport + domain + persistence concerns, split it before adding more behavior.

## ASCII Architecture Map

```text
UI Pages
  |
  +--> Task List -------+
  +--> Task Detail -----+--> API Layer --> Orchestration --> Runtime
  +--> Execution Detail-+                  |               |
  +--> Approval List ---+                  |               +--> CLI executors
  +--> Dashboard -------+                  |
                                           +--> Governance
                                           +--> Memory
                                           +--> Observability
                                           +--> Registry
```

## Codepath-to-Test Map

```text
1. Create Task
   unit: task payload validation + task creation service
   integration: POST /api/tasks creates task record
   e2e: create task from UI and land on task detail
   failure: invalid payload returns actionable error

2. Route Task
   unit: route rules choose expected role/mode
   integration: task creation triggers route decision
   failure: no-match path returns fallback/manual-routing state

3. Single Execution
   unit: orchestrator builds single-step plan
   integration: task transitions CREATED -> ROUTED -> RUNNING -> COMPLETED/FAILED
   failure: runtime timeout / empty result / executor unavailable

4. Discussion Advanced Mode
   unit: discussion mode maps to advanced execution mode
   integration: existing discussion flow updates task-facing state correctly
   failure: degraded-to-serial path is visible and recorded

5. Approval Flow
   unit: risk policy determines approval requirement
   integration: approval creation, approve, reject transitions
   e2e: approval list -> approve/reject -> task status updates
   failure: rejection blocks continuation with clear state

6. Memory Load + Writeback
   unit: retrieval selects relevant files / empty fallback
   integration: task execution consumes memory context and writes summary back
   failure: missing memory does not crash execution path

7. Multi-page Navigation
   e2e: Dashboard -> Task List -> Task Detail -> Execution Detail
   e2e: Dashboard -> Approval List -> Approve/Reject
   failure: missing record routes show explicit not-found state
```

## Files Likely To Change First

**Backend existing files to refactor**
- Modify: `hq/backend/src/server.ts`
- Modify: `hq/backend/src/discussion-service.ts`
- Modify: `hq/backend/src/types.ts`
- Modify: `hq/backend/src/store.ts`
- Modify: `hq/backend/src/mcp.ts`

**Backend new folders/files**
- Create: `hq/backend/src/api/tasks.ts`
- Create: `hq/backend/src/api/approvals.ts`
- Create: `hq/backend/src/api/executions.ts`
- Create: `hq/backend/src/orchestration/task-orchestrator.ts`
- Create: `hq/backend/src/orchestration/task-routing.ts`
- Create: `hq/backend/src/orchestration/workflow-plan.ts`
- Create: `hq/backend/src/runtime/runtime-adapter.ts`
- Create: `hq/backend/src/runtime/execution-service.ts`
- Create: `hq/backend/src/governance/approval-service.ts`
- Create: `hq/backend/src/governance/risk-policy.ts`
- Create: `hq/backend/src/observability/task-events.ts`
- Create: `hq/backend/src/shared/task-types.ts`

**Backend tests**
- Create: `hq/backend/src/__tests__/task-orchestrator.test.ts`
- Create: `hq/backend/src/__tests__/task-routing.test.ts`
- Create: `hq/backend/src/__tests__/approval-service.test.ts`
- Create: `hq/backend/src/__tests__/tasks-routes.integration.test.ts`
- Create: `hq/backend/src/__tests__/approvals-routes.integration.test.ts`
- Create: `hq/backend/src/__tests__/discussion-task-mode.integration.test.ts`

**Frontend existing files to refactor**
- Modify: `hq/frontend/src/app/page.tsx`
- Modify: `hq/frontend/src/components/DiscussionControlPanel.tsx`
- Modify: `hq/frontend/src/types.ts`
- Modify: `hq/frontend/src/utils/constants.ts`

**Frontend new pages/modules**
- Create: `hq/frontend/src/app/tasks/page.tsx`
- Create: `hq/frontend/src/app/tasks/[id]/page.tsx`
- Create: `hq/frontend/src/app/executions/[id]/page.tsx`
- Create: `hq/frontend/src/app/approvals/page.tsx`
- Create: `hq/frontend/src/hooks/useTasks.ts`
- Create: `hq/frontend/src/hooks/useTaskDetail.ts`
- Create: `hq/frontend/src/hooks/useApprovals.ts`
- Create: `hq/frontend/src/components/tasks/TaskList.tsx`
- Create: `hq/frontend/src/components/tasks/TaskDetail.tsx`
- Create: `hq/frontend/src/components/approvals/ApprovalList.tsx`

**Frontend E2E**
- Create: `hq/frontend/tests/e2e/tasks.spec.ts`
- Create: `hq/frontend/tests/e2e/approvals.spec.ts`
- Modify: `hq/frontend/tests/e2e/runtime-foundation.spec.ts`

---

## Sprint 1: Platform Skeleton + Naming Reset

Status: `[x] Mostly complete`

### Epic 1.1: Lock the new language and boundaries

Status: `[x] Complete enough for current branch`

**Files:**
- Modify: `hq/backend/src/server.ts`
- Modify: `hq/backend/src/discussion-service.ts`
- Modify: `hq/backend/src/types.ts`
- Create: `hq/backend/src/shared/task-types.ts`

**Step 1: Write a failing test for task-centric naming seams**
- Add a backend test that expects task-facing types and route registration helpers to exist.

**Step 2: Run test to verify it fails**
Run: `cd /Users/user/agency-agents/hq/backend && npm test`
Expected: FAIL because task-oriented modules/types do not exist yet.

**Step 3: Introduce shared task vocabulary**
- Add `TaskStatus`, `ApprovalStatus`, `ExecutionStatus`, `ExecutionMode`, `Task`, `Approval`, `TaskAssignment`, `Execution` shape definitions.
- Keep them minimal and explicit.

**Step 4: Split route mounting responsibility away from `server.ts`**
- Keep `server.ts` as composition root.
- Add placeholders for task, approval, and execution route registration.

**Step 5: Refactor naming at the seams**
- Rename core internal references where they define architecture, not every string in one sweep.
- Ensure `discussion` is framed as an advanced execution mode, not the system center.

**Step 6: Run tests and adjust**
Run: `cd /Users/user/agency-agents/hq/backend && npm test`
Expected: PASS for new naming/boundary tests.

### Epic 1.2: Add architecture defense rules to docs and plan

Status: `[x] Complete`

**Files:**
- Modify: `ai员工管理系统开发计划.md`
- Modify: `docs/plans/2026-03-24-staffai-platform-implementation.md`

**Step 1: Add explicit architecture guardrails**
- Directory boundaries
- Thin API layer rule
- max file-size warning rule
- no cross-context direct state mutation

**Step 2: Review for ambiguity**
- Ensure each rule is actionable enough to enforce in review.

---

## Sprint 2: Task + Approval Core Loop

Status: `[x] Core loop complete on file-backed persistence`

### Epic 2.1: Create the first Task model and task routes

Status: `[x] Complete`

**Files:**
- Create: `hq/backend/src/api/tasks.ts`
- Create: `hq/backend/src/orchestration/task-orchestrator.ts`
- Create: `hq/backend/src/orchestration/task-routing.ts`
- Modify: `hq/backend/src/store.ts`
- Create: `hq/backend/src/__tests__/task-orchestrator.test.ts`
- Create: `hq/backend/src/__tests__/tasks-routes.integration.test.ts`

**Step 1: Write failing unit tests for task creation and routing**
- create task with valid payload
- reject invalid payload
- derive route recommendation
- handle no-match fallback

**Step 2: Write failing integration test for `POST /api/tasks`**
- Expect a created task record and initial state.

**Step 3: Implement minimal task persistence adapter**
- Start with a store-backed implementation behind a task repository-like interface.
- Shape it so `Task` can move to PostgreSQL later without API churn.

**Step 4: Implement route recommendation**
- Minimal explicit rules
- fallback/manual-routing state when no good match exists

**Step 5: Run backend tests**
Run: `cd /Users/user/agency-agents/hq/backend && npm test`
Expected: PASS with task creation and route tests green.

### Epic 2.2: Create the Approval core

Status: `[x] Complete`

**Files:**
- Create: `hq/backend/src/api/approvals.ts`
- Create: `hq/backend/src/governance/approval-service.ts`
- Create: `hq/backend/src/governance/risk-policy.ts`
- Create: `hq/backend/src/__tests__/approval-service.test.ts`
- Create: `hq/backend/src/__tests__/approvals-routes.integration.test.ts`

**Step 1: Write failing tests for risk policy**
- approval required for high-risk task
- no approval for low-risk task
- approval rejection blocks progression

**Step 2: Write failing route tests**
- list approvals
- approve approval
- reject approval

**Step 3: Implement minimal approval storage and transitions**
- explicit status transitions only
- no implicit fallthrough logic

**Step 4: Integrate approval check into task creation / plan building**
- task records `approval_required`
- approval records created where needed

**Step 5: Run backend tests**
Run: `cd /Users/user/agency-agents/hq/backend && npm test`
Expected: PASS with approvals green.

---

## Sprint 3: Runtime + Lightweight Execution

Status: `[x] Core runtime path complete`

### Epic 3.1: Extract runtime interface from current discussion flow

Status: `[x] Core path complete`

**Files:**
- Create: `hq/backend/src/runtime/runtime-adapter.ts`
- Create: `hq/backend/src/runtime/execution-service.ts`
- Modify: `hq/backend/src/discussion-service.ts`
- Modify: `hq/backend/src/execution-strategy.ts`
- Create: `hq/backend/src/__tests__/execution-service.test.ts`
- Create: `hq/backend/src/__tests__/discussion-task-mode.integration.test.ts`

**Step 1: Write failing tests for single execution path**
- build a single-step execution from a routed task
- mark failed on executor error
- mark degraded on forced fallback

**Step 2: Write failing compatibility test for discussion advanced mode**
- existing discussion path still works
- task-facing state is updated correctly

**Step 3: Implement minimal runtime adapter**
- wrap current Codex/Claude executor calls
- keep explicit output shape

**Step 4: Add lightweight execution records**
- start with thin stored summary rather than full database backing
- keep IDs and routeability stable

**Step 5: Run backend tests**
Run: `cd /Users/user/agency-agents/hq/backend && npm test`
Expected: PASS with execution and compatibility coverage.

### Epic 3.2: Add failure-path coverage

Status: `[x] Core failure paths covered`

**Files:**
- Modify: `hq/backend/src/__tests__/task-orchestrator.test.ts`
- Modify: `hq/backend/src/__tests__/approval-service.test.ts`
- Modify: `hq/backend/src/__tests__/discussion-task-mode.integration.test.ts`

**Step 1: Add failure tests for each key path**
- route miss
- executor failure
- approval rejection
- degraded discussion mode
- empty memory fallback

**Step 2: Run tests to confirm failures are visible and explicit**
Run: `cd /Users/user/agency-agents/hq/backend && npm test`
Expected: PASS with no silent-failure behavior.

---

## Sprint 4: Multi-Page Frontend + Read Models

Status: `[x] MVP in place`

### Epic 4.1: Move from dashboard-first to multi-page workflow

Status: `[x] MVP complete`

**Files:**
- Create: `hq/frontend/src/app/tasks/page.tsx`
- Create: `hq/frontend/src/app/tasks/[id]/page.tsx`
- Create: `hq/frontend/src/app/executions/[id]/page.tsx`
- Create: `hq/frontend/src/app/approvals/page.tsx`
- Modify: `hq/frontend/src/app/page.tsx`
- Create: `hq/frontend/src/components/tasks/TaskList.tsx`
- Create: `hq/frontend/src/components/tasks/TaskDetail.tsx`
- Create: `hq/frontend/src/components/approvals/ApprovalList.tsx`

**Step 1: Write failing frontend integration/E2E expectations**
- task list page loads
- task detail page loads
- approvals page loads
- dashboard still links into new workspace

**Step 2: Build page shells and route navigation**
- dashboard becomes overview/entry point
- detailed workflow moves into dedicated pages

**Step 3: Keep UI explicit**
- no hidden state coupling between dashboard and detail pages
- use route params and read models

### Epic 4.2: Add page-specific read models

Status: `[x] Task + approval + execution read models present`

**Files:**
- Create: `hq/frontend/src/hooks/useTasks.ts`
- Create: `hq/frontend/src/hooks/useTaskDetail.ts`
- Create: `hq/frontend/src/hooks/useApprovals.ts`
- Create: `hq/backend/src/api/executions.ts`
- Modify: `hq/backend/src/api/tasks.ts`
- Modify: `hq/backend/src/api/approvals.ts`

**Step 1: Write failing tests / expectations for purpose-built reads**
- task list gets only summary fields
- task detail gets route, approval, execution summary fields
- approvals page gets status-focused projection

**Step 2: Implement read-model APIs**
- one endpoint per page purpose
- no generic “fetch everything” payload

**Step 3: Wire frontend hooks**
- keep page data loading isolated and explicit

### Epic 4.3: Add required E2E

Status: `[x] Smoke E2E complete`

**Files:**
- Create: `hq/frontend/tests/e2e/tasks.spec.ts`
- Create: `hq/frontend/tests/e2e/approvals.spec.ts`
- Modify: `hq/frontend/tests/e2e/runtime-foundation.spec.ts`

**Step 1: Write E2E for main navigation chain**
- Dashboard -> Task List -> Task Detail -> Execution Detail

**Step 2: Write E2E for approval chain**
- Approval List -> approve/reject -> task state update visible

**Step 3: Run frontend validation**
Run: `cd /Users/user/agency-agents/hq/frontend && npm run lint && npm run test:e2e`
Expected: PASS for critical user flows.

---

## Sprint 5: Memory + Observability + Review Cleanup

Status: `[x] Started with baseline complete`

### Epic 5.1: Introduce `.ai/` memory loading and writeback

Status: `[x] Baseline complete`

**Files:**
- Create: `hq/backend/src/memory/memory-indexer.ts`
- Create: `hq/backend/src/memory/memory-retriever.ts`
- Modify: `hq/backend/src/store.ts`
- Create: `hq/backend/src/__tests__/memory-retriever.test.ts`

**Step 1: Write failing tests for memory retrieval**
- retrieves project context
- tolerates empty folders
- writes back execution summary

**Step 2: Implement minimal file-based memory layer**
- simple markdown scan
- explicit fallback behavior

**Step 3: Integrate into orchestrator/runtime path**
- load before execution
- write summary after execution

### Epic 5.2: Keep logs simple but visible

Status: `[x] Baseline complete`

**Files:**
- Create: `hq/backend/src/observability/task-events.ts`
- Modify: `hq/backend/src/server.ts`
- Modify: `hq/frontend/src/components/ActivityLog.tsx`

**Step 1: Add thin logging helpers**
- task created
- approval requested/resolved
- execution started/completed/failed/degraded

**Step 2: Keep implementation synchronous for phase 1**
- but centralize helper calls enough that later event-stream migration is possible

---

## NOT in Scope for This Implementation Plan

- Full PostgreSQL migration for all objects
- Redis / async queue infrastructure
- Full structured Agent Profile migration
- Full discussion-to-workflow unification
- Full append-only event architecture
- LangGraph runtime adoption

## Risks To Watch

1. Full naming migration can inflate diff size and confuse review if mixed with behavior changes.
2. Leaving Agent Profile unstructured in phase 1 may cause some routing/policy logic to stay heuristic.
3. Sync log writes can spread unless helper entry points are introduced quickly.
4. Lightweight `Execution` storage may become a pressure point once task volume rises.

## Review-Driven Implementation Checklist

Before coding each epic, confirm:
- Which bounded context owns this change?
- Which existing module can be reused instead of rebuilt?
- What is the failing test first?
- What is the failure-path test for this codepath?
- Does this change make future `StaffAI` extraction easier or harder?

## Suggested Commit Shape

- `refactor: split server composition from domain routes`
- `feat: add task model and routing endpoints`
- `feat: add approval policy and approval APIs`
- `refactor: extract runtime adapter from discussion flow`
- `feat: add task pages and approval workspace`
- `test: cover execution failure and approval rejection flows`
- `feat: add memory retrieval and task summary writeback`

## Execution Recommendation

Implement in sprint order. Do not start Sprint 3 before Sprint 2 tests are green. Do not start Sprint 4 before task and approval APIs are stable enough for page-specific read models.
