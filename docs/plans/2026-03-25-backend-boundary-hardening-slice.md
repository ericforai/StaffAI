# 2026-03-25 Backend Boundary Hardening Slice

## Goal

Prioritize the still-incomplete `Phase 0.4` and `Task 0.4.1` work before continuing later platform slices.

This slice will use the required four-stage workflow:

1. `plan`
2. `tdd`
3. `code-review`
4. `refactor-clean`

## Why This Slice First

The current backend has made real progress on directory evolution:

- `api/`
- `orchestration/`
- `runtime/`
- `memory/`
- `governance/`
- `observability/`
- `tools/`

But the implementation is still only partially aligned with the intended platform skeleton:

- [`server.ts`](/Users/user/agency-agents/hq/backend/src/server.ts) is still a heavy composition-and-wiring module
- the system has no hard architecture-defense mechanism yet
- dependency direction is mostly enforced by convention, not by failing tests or explicit guardrails

If we do not tighten these now, later slices will keep piling new behavior into already-heavy entrypoints and make bounded contexts less trustworthy.

## Scope For This Batch

### In Scope

1. Reduce `server.ts` into a thinner composition root.
2. Extract backend app wiring into dedicated setup modules so responsibilities are clearer.
3. Keep discussion/runtime/task wiring behavior unchanged while moving assembly code out of `server.ts`.
4. Add an enforceable architecture-defense test suite for backend dependency direction.
5. Guard at least these dependency rules:
   - `api` may depend on service/context modules, but `runtime` must not depend on `api`
   - `orchestration` must not depend on `api`
   - `governance`, `memory`, `observability`, `tools` must not depend on `api`
   - `server.ts` and startup modules are allowed to assemble cross-context dependencies
6. Add a lightweight module-manifest or rule definition file if needed to keep the guardrails explicit and maintainable.
7. Keep all current route behavior and public API behavior stable.
8. Re-run backend tests after refactor and guard addition.

### Out of Scope

- Full repository-wide architecture governance across frontend
- External tools like dependency-cruiser if they require expanding infra beyond a light local fit
- Renaming every legacy file to a new bounded-context namespace
- Reworking `DiscussionService` semantics beyond composition cleanup
- Broader runtime/governance feature changes

## Actual Gaps Being Closed

### Task 0.4 Directory Evolution Strategy

What remains unfinished today:

- `server.ts` still creates runtime objects, owns websocket setup, creates task event feed, injects memory functions, and registers nearly every route directly
- startup composition in [`web-server.ts`](/Users/user/agency-agents/hq/backend/src/web-server.ts) is still tied to that large server constructor

Target for this slice:

- a thinner `server.ts`
- extracted app setup / route wiring helpers
- clearer separation between:
  - startup/bootstrap
  - dependency assembly
  - transport/server shell
  - route registration

### Task 0.4.1 Architecture Defense Rules

What remains unfinished today:

- no automated check that fails when dependency direction is violated
- no explicit “allowed dependency direction” contract encoded in tests

Target for this slice:

- a backend architecture guard test that scans imports and fails on forbidden edges
- rules stored in code in a way future slices can extend

## Proposed Design

### Composition Cleanup

Introduce a dedicated backend app setup module, likely along these lines:

- `app/create-app-runtime.ts` or `app/create-backend-dependencies.ts`
- `app/register-backend-routes.ts`
- keep `server.ts` primarily responsible for:
  - express app lifecycle
  - http/ws server shell
  - delegating route registration and dependency creation

The exact filenames can be adjusted to fit the repo, but the principle is:

- composition lives in one place
- transport shell lives in one place
- route modules stay thin

### Architecture Guard

Prefer a zero-extra-infra approach first:

- implement a backend architecture test using file scanning and import parsing already available in repo tooling patterns
- encode allowed / forbidden dependency edges in a small rule table

This keeps the guardrails:

- visible in-repo
- runnable via existing `npm test`
- easy to extend later

## Implementation Order

### Stage 1: Plan

1. Lock the slice to backend composition cleanup + hard guardrails only.
2. Preserve runtime behavior and existing APIs.
3. Define explicit dependency-direction rules before touching code.

### Stage 2: TDD

#### Backend track

1. Add failing architecture-guard tests for forbidden imports.
2. Add or update tests around server/app setup if needed.
3. Refactor `server.ts` by extracting:
   - dependency assembly
   - route registration
   - event-feed creation if helpful
4. Make all tests green without changing route behavior.

### Stage 3: Code Review

1. Review that `server.ts` is actually thinner, not just shuffled.
2. Review that guardrails are meaningful and not easy to bypass accidentally.
3. Review that dependency rules match the intended bounded-context direction.

### Stage 4: Refactor-Clean

1. Remove any temporary setup indirection or duplicated registration code created during the refactor.
2. Keep only one clear composition path for the backend web server.
3. Re-run backend tests after cleanup.

## Parallel Subagent Plan

### Worker A: Composition refactor

Owns only:

- backend app/server bootstrap and route-registration wiring files
- tests directly related to server/app assembly

Deliverables:

- thinner `server.ts`
- extracted composition/setup helpers

### Worker B: Architecture defense

Owns only:

- architecture-guard test(s)
- optional rule-definition helper module

Deliverables:

- enforceable dependency-direction checks
- failing test coverage if forbidden imports appear later

### Worker C: Safety verifier

Owns only:

- targeted review of route behavior stability
- confirm no public API contract changed during composition cleanup

Deliverables:

- verification notes on route/API stability

## Test Plan

Run:

- `cd /Users/user/agency-agents/hq/backend && npm test`

Coverage focus:

- architecture guard failure conditions
- server/app setup stability
- no regressions in existing API integration tests

## Expected Outcome

At the end of this slice:

- `Task 0.4` should move from “partially done” to “done enough for 1.0”
- `Task 0.4.1` should move from “convention only” to “hard guard present”
- future slices should have a safer backend skeleton to build on

## Ship Gate

Do not mark this slice complete unless all are true:

- `server.ts` is materially thinner than before
- architecture rules are encoded in automated tests
- backend tests are green
- no route/API regression was introduced
