# Implementation Plan: agent_evolution_engine_v05_20260401

## Title
V0.5: Agent Evolution Engine (Project "Continuum")

---

## Phase 1: L3 Memory & Reflection Loop [checkpoint: ]

- [x] Task: Implement `AgentMemoryRepository` for JSON storage 62b2af5
    - [x] Define `AgentMemory` domain models in `shared/intent-types.ts`
    - [x] Create file-based repository in `persistence/file-repositories.ts`
- [ ] Task: Build the `Reflector` Service
    - [ ] Create `reflector-service.ts` to analyze task completion vs spec
    - [ ] Integrate LLM call to extract heuristics and update L3 memory
- [ ] Task: Integrate Reflection Trigger & Memory Injection
    - [ ] Update `TaskExecutionOrchestrator` to trigger reflection on task end
    - [ ] Update `PromptBuilder` to inject L3 memory into agent system prompts
- [ ] Task: Conductor - User Manual Verification 'Phase 1: L3 Memory & Reflection Loop' (Protocol in workflow.md)

---

## Phase 2: Autonomous Intents & Notifications [checkpoint: ]

- [ ] Task: Create "Inspector" Agent capabilities
    - [ ] Define mechanism for agents to evaluate OKR metrics
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