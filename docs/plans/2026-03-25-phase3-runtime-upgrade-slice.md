## Phase 3 Runtime Upgrade Slice

### Scope
- Complete Task 3.2 by expanding the execution domain model with runtime-oriented fields:
  - `assignmentId`
  - `runtimeName`
  - `inputSnapshot`
  - `outputSnapshot`
  - `degraded`
  - retry/timeout metadata and structured failure payload
- Complete Task 3.3 by formalizing runtime adapters while reusing current executor pathways (`codex`, `claude`, optional `openai`).
- Complete Task 3.5 by adding timeout/retry/degradation flow for task runtime (not only discussion runtime).
- Complete Task 3.6 by making dispatcher responsibilities explicit in runtime orchestration.
- Complete Task 3.7 acceptance with executable evidence from tests:
  - single-assignee execution works
  - serial execution works
  - parallel request degrades when capability is missing
  - failure paths are recorded and visible

### Plan Phase Output
- Introduce runtime contracts in `runtime/`:
  - adapter contract
  - runtime execution context/result/error
  - dispatcher runtime policy helpers

### TDD Phase Output
- Extend shared execution model and store compatibility.
- Upgrade execution service and task execution orchestrator to emit richer execution records.
- Add structured timeout/retry/degrade logic and map failures to visible API payloads.
- Add/upgrade tests for:
  - execution model fields
  - adapter/degradation selection
  - retry and timeout behavior
  - dispatcher formalization in serial/parallel orchestration

### Code Review Focus
- Ensure old payload consumers do not break with new fields.
- Verify degraded paths keep deterministic status transitions.
- Verify no branch drops assignment/workflow linkage.

### Refactor-Clean
- Remove duplicated completion/failure mapping.
- Normalize runtime error shape and naming across runtime/orchestration/api.
