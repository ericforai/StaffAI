# Track Implementation Plan: walking_skeleton_20260331

## Title
Finalize physical connectivity between TS Office and Python Workshop

---

## Phase 1: Preparation & Handshake

- [x] Task: Write connection health-check tests for both cores 3c46d10
    - [x] Define TS-side unit tests for Workshop registration endpoint
    - [x] Define Python-side tests for FastAPI health-check endpoint
- [x] Task: Implement Workshop registration mechanism 42a43ad
    - [x] Update `hq/backend` to accept registration from `workshop/`
    - [x] Update `workshop/main.py` to ping `hq/backend` on startup
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Preparation & Handshake' (Protocol in workflow.md)

---

## Phase 2: SSE Bridge & Streaming

- [ ] Task: Implement streaming tests for SSE thought-broadcasting
    - [ ] Write a test script to verify message ordering and delivery over SSE
- [ ] Task: Enhance SSE support in TS Backend
    - [ ] Implement SSE endpoint in `hq/backend` to forward logs from `workshop/`
- [ ] Task: Integrate `deer-flow` streaming into Workshop
    - [ ] Connect `DeerFlowClient.stream()` output to Workshop SSE endpoint
- [ ] Task: Conductor - User Manual Verification 'Phase 2: SSE Bridge & Streaming' (Protocol in workflow.md)

---

## Phase 3: Task Orchestration Logic

- [ ] Task: Create integration tests for task dispatch and completion
    - [ ] Mock task payload and verify end-to-end flow: HQ -> Workshop -> Result -> HQ
- [ ] Task: Finalize task routing in TS Office
    - [ ] Update `hq/backend` task service to use the Workshop executor for specific agent roles
- [ ] Task: Implement state persistence for results
    - [ ] Ensure `hq/backend` persists the results received from Workshop to the local JSON/Postgres database
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Task Orchestration Logic' (Protocol in workflow.md)

---

## Phase 4: Verification & Cleanup

- [ ] Task: Final end-to-end manual verification
    - [ ] Run the full system and execute a dummy task via Command Deck
- [ ] Task: Document final architecture in `docs/`
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Verification & Cleanup' (Protocol in workflow.md)
