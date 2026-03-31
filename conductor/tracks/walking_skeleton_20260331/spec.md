# Track Specification: walking_skeleton_20260331

## Title
Finalize physical connectivity between TS Office and Python Workshop

## Goal
Establish robust, end-to-end communication between the TS-based Orchestrator (`hq/`) and the Python-based Executor (`workshop/`) using `deer-flow`.

## Background
StaffAI follows a dual-core architecture. For Phase 1 (The Walking Skeleton), we need to ensure that the Orchestrator can successfully dispatch tasks to the Executor and receive real-time updates via SSE.

## High-Level Requirements
- **SSE Connection**: Establish a stable Server-Sent Events (SSE) bridge for "thought-stream" broadcasting.
- **Task Dispatch**: TS Office can send structured tasks to Python Workshop.
- **State Sync**: Consistent state management between the two cores.
- **Error Handling**: Robust retry and recovery logic for connection drops.

## Tech Stack
- **TS Office**: Node.js, TypeScript, Express, MCP.
- **Python Workshop**: Python, FastAPI, LangGraph, `deer-flow`.
- **Communication**: HTTP/SSE.

## Success Criteria
1.  **Successful Handshake**: Workshop registers with HQ upon startup.
2.  **Streaming Feedback**: Real-time agent logs from Workshop appear in HQ Command Deck.
3.  **Task Completion**: Tasks dispatched from HQ are processed by Workshop, and results are persisted.
