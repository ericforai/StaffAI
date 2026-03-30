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

## Persistence

### Replace sync-compatible Postgres caching with true read-after-write repositories

**What:** Refactor the task, approval, and execution persistence seam so Postgres-backed repositories use async read/write contracts instead of returning synchronously from an in-process cache.

**Why:** The current Postgres implementation preserves API compatibility by queueing SQL work in the background and serving reads from local memory. That means cold reads can be empty or stale after restart, and multiple app instances can diverge until each one refreshes its own cache.

**Context:** During the 2026-03-24 post-PR diff review for `codex/staffai-platform-sprint1`, we confirmed this is not a missing `await` bug. It is a seam mismatch between synchronous repository/store contracts and async database IO. A correct fix needs an async persistence refactor across the backend call sites.

**Effort:** L
**Priority:** P1
**Depends on:** Async repository/store interface redesign and route/service adoption.

## Design Review (2026-03-30)

### Wire Tower cost KPI to real budget API

**What:** Replace `executions.length * 0.5` fabricated cost calculation in Tower dashboard with real budget data from backend. Either wire to `/api/budget/status` endpoint or show a clear "估算" (estimated) label with placeholder.

**Why:** The cost KPI currently looks like real data but is completely fabricated. An operator could make budget decisions based on fake numbers. This is the single most dangerous UX issue in the Tower dashboard.

**Context:** Found during `/plan-design-review` on 2026-03-30. The `totalCost` memo at `tower/page.tsx:76-79` multiplies execution count by a flat $0.50 rate. Eng review also flagged this as a HIGH priority issue.

**Effort:** S
**Priority:** P1
**Depends on:** Backend budget API endpoint or cost aggregation query.
**Pros:** Operators see real cost data, trust in dashboard increases.
**Cons:** Needs backend endpoint that may not exist yet.

### Fix SuspendedTaskPanel fetch patterns

**What:** Add AbortController for cleanup on unmount. Fix execution selection to pick the latest completed execution (not `data.executions[0]`). Add loading skeleton instead of bare text string.

**Why:** Current code fetches all executions and picks the first one (index 0), which may be a failed execution instead of the latest successful one. No AbortController means potential memory leaks and state updates on unmounted components.

**Context:** Found during `/plan-design-review` on 2026-03-30. Eng review also flagged the AbortController gap at `SuspendedTaskPanel.tsx:34-78`.

**Effort:** S
**Priority:** P1
**Depends on:** None.
**Pros:** Correct trace data shown, no memory leaks, professional loading experience.
**Cons:** Minimal — straightforward fix.

### Add heatmap responsive support and Tailwind config

**What:** Add `grid-cols-24` to Tailwind config under `extend.gridTemplateColumns`. Add responsive fallback for heatmap on mobile (horizontal scroll or vertical stack with hour labels).

**Why:** `grid-cols-24` is not a standard Tailwind class and will be silently ignored without config. The heatmap has 24 cells that are unreadable on mobile without responsive behavior.

**Context:** Found during `/plan-design-review` on 2026-03-30. Pass 6 (Responsive & Accessibility) flagged this as a hard blocker for mobile usage.

**Effort:** S
**Priority:** P2
**Depends on:** None.
**Pros:** Heatmap works on all screen sizes, Tailwind properly generates the class.
**Cons:** None.

### Add keyboard accessibility to SuspendedTaskPanel

**What:** Add `aria-expanded` attribute on toggle button. Add visible focus indicator. Implement keyboard navigation (arrow keys) through trace events when expanded. Add skip-to-content link.

**Why:** Screen reader users cannot navigate the panel. Keyboard-only users have no way to interact with expanded trace events. No `aria-expanded` means AT users don't know the panel state.

**Context:** Found during `/plan-design-review` on 2026-03-30. Pass 6 (Responsive & Accessibility) rated 3/10.

**Effort:** M
**Priority:** P2
**Depends on:** None.
**Pros:** Inclusive design, WCAG compliance.
**Cons:** Slightly more complex interaction code.

### Create DESIGN.md documenting app design system

**What:** Create a DESIGN.md file documenting the StaffAI HQ frontend design system: color tokens (slate structure, emerald/amber/rose status), card pattern (`rounded-lg border border-slate-200 bg-white p-5 shadow-sm`), icon system (lucide-react only), typography scale, grid patterns, container widths, and component vocabulary.

**Why:** The app has 8 pages with consistent implicit patterns but no formal design system document. Every new component requires reading existing code to discover the vocabulary. This leads to drift (emoji vs lucide-react, inconsistent empty states).

**Context:** Found during `/plan-design-review` on 2026-03-30. No DESIGN.md existed. All design decisions were reverse-engineered from existing pages.

**Effort:** M
**Priority:** P2
**Depends on:** None.
**Pros:** Future developers have a reference, new components stay consistent.
**Cons:** Needs maintenance as patterns evolve.

## Completed
