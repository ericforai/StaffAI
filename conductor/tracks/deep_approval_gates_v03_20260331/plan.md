# Implementation Plan: deep_approval_gates_v03_20260331

## Title
V0.3: Deep Approval Gates

---

## Phase 1: Approval Model & Interception [checkpoint: d8892d3]

- [x] Task: Extend ApprovalRecord and Domain Types d8892d3
    - [x] Add `ApprovalType` enum: `plan_approval`, `tool_call`, `delivery_check`
    - [x] Add `riskContext` and `blockedAction` metadata to `ApprovalRecord`
- [x] Task: Implement High-Risk Tool Interception d8892d3
    - [x] Update `hq/backend/src/tools/tool-gateway.ts` to block and create approval for high-risk tools
    - [x] Integration with `RiskAssessmentEngine`

---

## Phase 2: Workflow Resumption [checkpoint: d8892d3]

- [x] Task: Enhance Workflow Engine for HITL d8892d3
    - [x] Logic to pause `AssignmentExecutor` when approval is needed
    - [x] Implement `resumeTask` behavior in `TaskLifecycleService`
- [x] Task: Backend API for Approval Decisions d8892d3
    - [x] Update `POST /api/approvals/:id/approve` to trigger workflow resumption

---

## Phase 3: Approval UI & Audit [checkpoint: ]

- [x] Task: Build Approval Detail View d8892d3
    - [x] Show risk reasoning, blocked parameters, and requester
- [x] Task: Integrate Approval Prompts in Task Detail d8892d3
    - [x] Real-time notification/banner when a task is blocked for approval
- [ ] Task: End-to-end verification
    - [ ] Execute a task -> High-risk tool triggered -> Pause -> Approve -> Verify execution continues
