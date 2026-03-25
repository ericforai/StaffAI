# 2026-03-25 Task-Orchestration Next Slice

## Goal

Execute the next ordered implementation slice from the StaffAI / HQ platform plan using the required four-stage workflow:

1. `plan`
2. `tdd`
3. `code-review`
4. `refactor-clean`

This slice deliberately focuses on the earliest still-incomplete items that unlock later phases without trying to finish the entire master plan in one batch.

## Why This Slice First

From the ordered completion review, the earliest gaps that still block later work are:

- Phase 2: `TaskAssignment` model is missing
- Phase 2: `WorkflowPlan` model is missing
- Phase 2/3: runtime still lacks explicit serial-plan execution for task orchestration
- Phase 1: the task workspace is still partly discussion-first instead of task-orchestration-first

If we implement those first, we create the minimal backbone needed for later tool gateway, trace, audit, and richer governance work.

## Scope For This Batch

### In Scope

1. Add first-class `TaskAssignment` and `WorkflowPlan` domain models.
2. Persist assignments alongside tasks / approvals / executions using the existing repository seam.
3. Extend task orchestration so task creation can produce:
   - a routed task
   - a workflow plan
   - one or more assignments
4. Add a lightweight serial execution path for task workflows.
5. Update task read models and APIs so task detail exposes plan + assignments.
6. Upgrade the task workspace UI so task detail shows:
   - workflow plan summary
   - assignment list
   - serial execution progress/result summary
7. Preserve `advanced_discussion` as a distinct execution mode.
8. Add tests first for all new backend logic and core UI data flow.
9. Run code review on the resulting diff.
10. Run refactor-clean pass limited to files touched in this slice.

### Out of Scope

- Full Tool Gateway
- Full Audit Log / Execution Trace system
- Full structured Agent Profile migration
- Pause / resume / cancel runtime controls
- Full parallel workflow orchestration beyond preserving discussion advanced mode
- Database migration of the new entities beyond repository seams

## Bounded Context Ownership

- `shared/`: shared task, assignment, and workflow vocabulary
- `orchestration/`: plan building, assignment generation, task state progression
- `runtime/`: serial workflow execution and assignment execution summaries
- `api/`: thin mapping for tasks and task detail payloads
- `observability/`: emit assignment / plan / execution lifecycle events only if needed for touched flows
- `frontend/`: task-centric workspace rendering of plans and assignments

## Implementation Order

### Stage 1: Plan

1. Lock the implementation slice and boundaries.
2. Keep `discussion` intact while making task orchestration more explicit.
3. Split work into backend domain/runtime and frontend read/render tasks so subagents can work safely in parallel.

### Stage 2: TDD

#### Backend track

1. Add failing tests for shared types and orchestration behavior:
   - `TaskAssignment` shape exists
   - `WorkflowPlan` shape exists
   - task creation returns persisted plan + assignments
   - serial execution updates assignments and task state
   - advanced discussion remains isolated
2. Add failing integration tests for task APIs:
   - task detail includes plan + assignments
   - executing a serial task records assignment-level progress/results
3. Implement the minimal backend changes to make those tests pass.

#### Frontend track

1. Add or extend tests around task detail data projections where practical.
2. Update task detail page and hooks to render workflow plan and assignments.
3. Keep UI changes incremental and compatible with existing pages.

### Stage 3: Code Review

1. Run a spec-compliance review against this plan.
2. Run a code-quality review on the resulting diff.
3. Fix any blocking findings before marking the slice complete.

### Stage 4: Refactor-Clean

1. Remove dead or now-redundant task-detail mapping logic introduced by this slice.
2. Keep cleanup limited to touched modules.
3. Re-run backend tests and frontend build after cleanup.

## Parallel Subagent Plan

### Worker A: Backend orchestration + persistence

Owns only:

- `hq/backend/src/shared/task-types.ts`
- `hq/backend/src/store.ts`
- `hq/backend/src/persistence/*`
- `hq/backend/src/orchestration/task-orchestrator.ts`
- `hq/backend/src/orchestration/task-read-model.ts`
- backend tests directly covering those modules

Deliverables:

- assignment / plan models
- persistence seam updates
- task detail read model support

### Worker B: Backend runtime + API

Owns only:

- `hq/backend/src/runtime/execution-service.ts`
- `hq/backend/src/orchestration/task-execution-orchestrator.ts`
- `hq/backend/src/api/tasks.ts`
- `hq/backend/src/api/executions.ts` if payload extension is needed
- backend integration tests for execution behavior

Deliverables:

- serial workflow execution baseline
- assignment-aware task execution path
- API payloads exposing serial execution results

### Worker C: Frontend task workspace

Owns only:

- `hq/frontend/src/types.ts`
- `hq/frontend/src/hooks/useTaskDetail.ts`
- `hq/frontend/src/hooks/useTaskActions.ts`
- `hq/frontend/src/app/tasks/[id]/page.tsx`
- optionally `hq/frontend/src/app/tasks/page.tsx` if summary fields need small updates

Deliverables:

- workflow plan section
- assignment list section
- assignment/result visibility in task detail UI

## Test Plan

### Backend

Run:

- `cd /Users/user/agency-agents/hq/backend && npm test`

Coverage focus:

- shared task vocabulary
- task orchestration persistence of assignments/plans
- serial task execution behavior
- task detail API payload shape
- advanced discussion compatibility

### Frontend

Run:

- `cd /Users/user/agency-agents/hq/frontend && npm run build`

Optional if needed after UI changes:

- targeted E2E only if an existing spec is directly affected

## Expected Outcome

At the end of this slice, the platform should be able to:

- create a task with explicit workflow plan and assignments
- show plan + assignments on task detail
- execute at least one serial task workflow baseline
- keep advanced discussion as a separate path
- move the task workspace further from discussion-first toward task-orchestration-first

## Risks

- Existing tests may assume task detail only returns approvals + executions.
- The current runtime is intentionally thin, so serial workflow must stay minimal.
- Frontend task detail page already has several states; UI changes should avoid turning it into another oversized mixed-responsibility page.

## Ship Gate

Do not proceed to implementation complete unless all are true:

- backend tests green
- frontend build green
- new task detail payload is stable
- advanced discussion path still works
- spec review and code-quality review have no unresolved blocking findings
