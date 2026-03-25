# 2026-03-25 Phase 1 Interaction Entry Upgrade Slice

## Goal

Finish the still-partial `Phase 1｜交互入口层升级` work by turning HQ from a discussion-first landing page with task links into a task-first unified workspace with a consistent backend read model.

This slice will follow the required four-stage workflow:

1. `plan`
2. `tdd`
3. `code-review`
4. `refactor-clean`

## Why This Slice Now

The platform already has:

- task list page
- task detail page
- execution detail page
- approvals page
- task creation and execution APIs

But `Phase 1` is still incomplete because:

- the homepage `tasks` workspace is still only a set of jump cards
- the right-side product center is still shaped around discussion-first behavior
- task and approval APIs still expose obvious `sprint-1-skeleton` scaffolding
- the user can navigate to task tools, but the main HQ command deck is not yet a unified task/execution console

## Scope For This Batch

### In Scope

1. Upgrade the homepage `tasks` workspace into a real unified task/execution control workspace.
2. Keep `advanced_discussion` available, but visually separate it from the main task-first flow.
3. Add a compact task command area on the homepage that supports:
   - creating a task
   - scanning task list state
   - surfacing pending approvals
   - surfacing latest execution outcome
   - jumping into task detail / execution detail when needed
4. Expose a more product-ready task workspace payload from backend APIs.
5. Remove or reduce visible `sprint-1-skeleton` markers from `Phase 1` task/approval APIs.
6. Keep task list, task detail, execution detail, and approvals pages compatible.
7. Add or update targeted tests for the touched backend/frontend behaviors.
8. Verify with backend tests and frontend build.

### Out of Scope

- replacing the discussion console itself
- redesigning the full three-column dashboard information architecture
- adding brand new task orchestration domain concepts beyond what already landed
- implementing a new dedicated employees page
- changing execution semantics or governance policy beyond display/read-model needs

## Phase 1 Gaps Being Closed

### Task 1.1

Make the homepage `tasks` workspace feel like a real work area instead of a link hub, while keeping task list/detail/execution/approval pages as the deeper drill-down surfaces.

### Task 1.2

Shift the product center from “discussion control panel dominates the HQ experience” toward “task and execution control is the default operational path”.

### Task 1.3

Make task and approval APIs look like stable product APIs rather than an early scaffold.

### Task 1.4

Strengthen the first task-first interaction principle:

- create task first
- execute from task workspace
- inspect approvals and latest execution from the same workspace
- use discussion as a specialized branch, not the default center of gravity

### Task 1.5

Close the remaining acceptance gap around a unified task/execution control console.

## Proposed Design

### Homepage Task Workspace

Add a dedicated task workspace section inside [`/Users/user/agency-agents/hq/frontend/src/app/page.tsx`](/Users/user/agency-agents/hq/frontend/src/app/page.tsx) that includes:

- task summary cards
- embedded task composer
- recent task list
- pending approval panel
- latest execution panel
- quick links into task detail and execution detail

The discussion console remains available under the `brainstorm` workspace and is no longer the primary operational workspace for execution.

### Backend Read Model Cleanup

Improve task/approval payload shaping so the frontend can present a unified operational view without special-casing scaffold data.

Focus on:

- stronger task list ordering/read-model shaping
- removing exposed `sprint-1-skeleton` markers from task and approval responses
- preserving backward compatibility for existing pages

## Implementation Order

### Stage 1: Plan

1. Lock scope to homepage task workspace + API read-model cleanup.
2. Preserve current task detail / execution detail / approvals flows.
3. Split work into backend API cleanup and frontend workspace upgrade.

### Stage 2: TDD

#### Backend track

1. Add or update tests for task and approval API payload shape.
2. Improve task/approval read models and remove scaffold markers.
3. Keep existing route contracts stable for current consumers.

#### Frontend track

1. Add task-workspace UI state/data flow first.
2. Build a real homepage operations console for task creation and quick triage.
3. Preserve existing dedicated pages for deeper drill-down.

### Stage 3: Code Review

1. Confirm the homepage now reads task-first, not discussion-first.
2. Confirm touched APIs no longer expose early-skeleton wording.
3. Confirm the new workspace reduces page-hopping for common operations.

### Stage 4: Refactor-Clean

1. Remove duplicated task workspace rendering logic where practical.
2. Keep shared formatting helpers coherent.
3. Re-run backend tests and frontend build.

## Parallel Subagent Plan

### Worker A: Backend API/read-model cleanup

Owns only:

- backend task/approval API files
- backend task read-model files
- backend tests directly covering these areas

### Worker B: Frontend homepage task workspace

Owns only:

- frontend homepage workspace rendering
- supporting frontend hooks/types/components
- frontend verification for this slice

## Test Plan

### Backend

Run:

- `cd /Users/user/agency-agents/hq/backend && npm test`

### Frontend

Run:

- `cd /Users/user/agency-agents/hq/frontend && npm run build`

## Ship Gate

Do not mark this slice complete unless all are true:

- homepage `tasks` workspace is a real operational console, not just jump cards
- discussion remains available but no longer dominates task operations
- task and approval APIs no longer expose `sprint-1-skeleton`
- backend tests are green
- frontend build is green
