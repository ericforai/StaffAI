# Implementation Plan: agent_evolution_engine_v05_20260401

## Title
V0.5: Agent Evolution Engine (Project "Continuum")

---

## Phase 1: L3 Memory & Reflection Loop [checkpoint: 2a1b3c4]

- [x] Task: Implement `AgentMemoryRepository` for JSON storage 62b2af5
    - [x] Define `AgentMemory` domain models in `shared/intent-types.ts`
    - [x] Create file-based repository in `persistence/file-repositories.ts`
- [x] Task: Build the `Reflector` Service f16e89d
    - [x] Create `reflector-service.ts` to analyze task completion vs spec
    - [x] Integrate LLM call to extract heuristics and update L3 memory (capability added)
- [x] Task: Integrate Reflection Trigger & Memory Injection 7dc7d88
    - [x] Update `TaskExecutionOrchestrator` to trigger reflection on task end
    - [x] Update `PromptBuilder` to inject L3 memory into agent system prompts
- [x] Task: Conductor - User Manual Verification 'Phase 1: L3 Memory & Reflection Loop' (Protocol in workflow.md)

---

## Phase 2: Autonomous Intents & Notifications [checkpoint: ]

- [x] Task: Create "Inspector" Agent capabilities 90cce1c
    - [x] Define mechanism for agents to evaluate OKR metrics (implemented via `InspectorService`)
- [ ] Task: Proactive Proposal Generation
    - [ ] Create service to convert an agent's finding into a `RequirementDraft`
    - [ ] Ensure the generated draft is linked to the originating agent
- [ ] Task: SSE Broadcast for Proactive Proposals
    - [ ] Update `DashboardEvent` types to include `PROACTIVE_PROPOSAL`
    - [ ] Implement SSE emission when a new autonomous intent is created
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Autonomous Intents & Notifications' (Protocol in workflow.md)

---

## Phase 3: Evolution UI Dashboard [checkpoint: ]

- [ ] Task: Agent Growth Timeline Component
    - [ ] Build UI to display L3 memory acquisition history
- [ ] Task: Task Context Badges & Mocked Trust Indicators
    - [ ] Update Task Detail view to show memory utilization badges
    - [ ] Add static/mocked "Trust Level" progress bar
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Evolution UI Dashboard' (Protocol in workflow.md)