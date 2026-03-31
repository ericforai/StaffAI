# Implementation Plan: feature_delivery_v02_20260331

## Title
V0.2: Feature Delivery & Teaming

---

## Phase 1: Intent to Task Conversion [checkpoint: 0b35714]

- [x] Task: Implement backend API for task creation from intent 1b674f1
    - [x] Create `POST /api/intents/:id/create-task`
    - [x] Logic to hire the `feature-delivery` squad
    - [x] Map ImplementationPlan steps to Task workflow stages
- [x] Task: Update TaskRecord domain model 1b674f1
    - [x] Add `intentId` field to `TaskRecord`
    - [x] Add `structuredArtifacts` support to `Assignment` / `ExecutionResult`

---

## Phase 2: Frontend Integration [checkpoint: ]

- [ ] Task: Update Task Details View
    - [ ] Add "Plan" tab to show the implementation plan from the draft
    - [ ] Add "Artifacts" tab to show structured outputs per role
- [ ] Task: Update Intent Wizard completion flow
    - [ ] On plan confirmation, call the create-task API and redirect to the new task

---

## Phase 3: Workflow Orchestration [checkpoint: ]

- [ ] Task: Enhance `mvp-scenario-runner` for Feature Delivery
    - [ ] Ensure correct role sequence: PM -> Architect -> FE -> BE -> Security -> Reviewer
- [ ] Task: End-to-end verification of the full flow
    - [ ] Dummy demand -> Clarification -> Plan -> Task -> Teaming
