# Implementation Plan: strategic_mission_control_v06_20260401

## Title
V0.6: Strategic Mission Control (OKR & Goals)

---

## Phase 1: OKR Backend Support [checkpoint: ]

- [x] Task: Implement OKR API Routes
    - [x] Create `hq/backend/src/api/okrs.ts` with full CRUD support
    - [x] Register routes in `app/register-backend-routes.ts`
- [x] Task: Enhance OKR Domain Logic
    - [x] Add `calculateProgress` utility for KeyResults
    - [x] Ensure `Store.updateOKR` is tested and reliable

---

## Phase 2: Tower UI Tabbed Layout [checkpoint: ]

- [x] Task: Refactor Tower page structure
    - [x] Create `TowerMonitor` sub-component (from existing page logic)
    - [x] Implement `Tabs` navigation (Dashboard vs. OKRs)
- [x] Task: Build OKR Dashboard Component
    - [x] Create `OKRManager` for high-level objective visibility

---

## Phase 3: OKR Management & Forms [checkpoint: ]

- [x] Task: Build OKR Management Interface
    - [x] Implement `OKRList` with status filtering (integrated in `OKRManager`)
    - [x] Create `OKRCreateModal` with form for Objective and multiple KRs
- [x] Task: End-to-end verification
    - [x] Create OKR -> Modify KR current value -> Verify Agent Proactive Intent is triggered via SSE

---

## Phase: Review Fixes

- [x] Task: Apply review suggestions 42c4d19

