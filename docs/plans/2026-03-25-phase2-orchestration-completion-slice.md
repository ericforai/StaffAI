## Phase 2 Orchestration Completion Slice

### Scope
- Complete structured `AgentProfile` registration and expose it through backend APIs.
- Finish the Phase 2 task model with `taskType`, `priority`, `requestedBy`, `requestedAt`, `candidateAgentRoles`, and `routeReason`.
- Turn the orchestrator into the real task entry point: `createTask`, `routeTask`, `buildPlan`, `assignAgents`, `advanceTaskState`, `advanceAssignmentState`.
- Expand routing from simple keyword matching into multi-role defaults for architecture, backend, frontend, review, documentation, and dispatcher work.
- Make task creation and approval resolution land in a routed state, not an unplanned placeholder state.
- Reuse persisted workflow plans and assignments during execution so task detail reflects state changes after execution.

### TDD Targets
- Task draft creation persists task, assignments, and workflow plan with structured routing metadata.
- Approval resolution moves tasks back to `routed`.
- Routed tasks are executable.
- Execution updates existing workflow plan and assignments to completed states.
- `/api/agents` returns structured profile data.

### Code Review Focus
- Avoid introducing a second routing truth outside `task-routing.ts`.
- Keep `advanced_discussion` behavior intact.
- Preserve compatibility with existing file persistence seams.

### Refactor-Clean
- Normalize executable-state checks in read models and task routes.
- Keep route registration thin; pass scanner-derived profiles via dependencies instead of reaching into scanner globally.
