# Specification: Agent Evolution Engine (Project "Continuum")

## Goal
Implement the "Agent Evolution Engine" to transition StaffAI from a prompt-tool to a system of digital employees with long-term memory (L3), OKR-driven autonomy, and proactive proposal capabilities.

## Functional Requirements

### 1. L3 Exclusive Memory Matrix (Phase 1)
*   **Storage**: Implement a file-based storage mechanism (`JSON Files`) for individual agent L3 memories.
*   **Memory Composition**: Store Experience Logs, Behavioral Heuristics, and Organizational Awareness.
*   **The Reflection Loop**: 
    *   Implement a `Reflector` service.
    *   Trigger reflection **immediately after a single `TaskRecord` completes or fails**.
    *   The `Reflector` must compare the initial specification with the final output to extract user corrections and store them in the agent's L3 memory.
*   **Memory Injection**: On subsequent tasks, the agent's L3 memory must be retrieved and injected into their Private Instructions/System Prompt.

### 2. OKR Mission Control & Autonomous Intents (Phase 2)
*   **Proactive Perception**: Create "Inspector" agents that can run in the background to analyze code/metrics against OKRs.
*   **Autonomous Proposal Generation**: When a gap is found, the agent must generate a `RequirementDraft` (Intent) detailing the issue and proposed plan.
*   **Notification**: The system must notify the user of these proactive proposals in real-time via **SSE Broadcast**.
*   **HITL Integration**: Proposals must be approved by a human (Checkpoint C) before the agent can execute the plan.

### 3. Evolution UI/UX (Phase 3)
*   **Agent Evolution Dashboard**: Add a timeline view on the Agent Detail page showing newly acquired L3 memories ("Growth Log").
*   **Task Context Badges**: Display visual indicators on tasks that heavily utilized an agent's L3 memory.
*   **Trust Level Indicator**: Implement a mocked UI element showing the agent's progression from "Novice" to "Autonomous".

## Technical Details
*   **Backend**: Add `AgentMemoryRepository` to `hq/backend/src/persistence/`.
*   **Backend**: Integrate `Reflector` into the `TaskLifecycleService` or `WorkflowExecutionEngine` at the completion hook.
*   **Frontend**: Update `AgentCard` or create an `AgentProfile` page for the Evolution Dashboard.

## Out of Scope
*   Cross-agent shared memory (L2 Graph) is deferred to future updates.
*   Full L3 Autonomy (execution without plan approval) is deferred.