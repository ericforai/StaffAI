# TODOS

## Discussion Pipeline

### Add startup-check parity tests for executor selection

**What:** Add automated tests that verify discussion startup-check output matches the runtime's real executor selection and fallback order.

**Why:** The startup-check page and API are intended to explain what the system will actually do at runtime. If runtime fallback logic changes without matching tests, the health view can drift into a false-green state where the UI says one thing and execution does another.

**Context:** During the 2026-03-24 `/plan-eng-review` for `codex/staffai-platform-sprint1`, we chose to implement real executor fallback and a more truthful startup-check model, but explicitly deferred parity tests for this PR. This TODO preserves that intent so the gap does not disappear from memory.

**Effort:** S
**Priority:** P2
**Depends on:** Executor fallback and startup-check redesign stabilizing.

### Expand discussion failure-matrix tests beyond the critical paths

**What:** Add follow-up tests for the remaining discussion failure matrix, especially quorum loss after participant failures, degraded result metadata, and mixed success/failure workflow paths.

**Why:** The current PR intentionally focuses on the two highest-value protections: runtime fallback and participant partial-failure handling. That still leaves several important branch combinations uncovered, especially around degraded-but-successful discussions.

**Context:** During the same 2026-03-24 `/plan-eng-review`, we chose the narrower `7B` test scope instead of the full failure-matrix package. This TODO records the intentionally deferred coverage rather than treating it as an accidental omission.

**Effort:** M
**Priority:** P2
**Depends on:** Participant-level failure modeling being implemented and the degraded result shape settling.

## Completed
