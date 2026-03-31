# Dual-Core Architecture: TS Office & Python Workshop Bridge

This document describes the physical connectivity and orchestration layer between the StaffAI Management Core (TS Office) and the Execution Core (Python Workshop).

## 🏗️ Architecture Overview

StaffAI follows a "Management-Execution" separation model:
1.  **TS Office (Management)**: Built with TypeScript/Express. Handles task management, routing, persistence, and the user interface.
2.  **Python Workshop (Execution)**: Built with FastAPI/LangGraph. Executes actual agentic workflows using `deer-flow` and various LLM adapters.

## 🤝 Handshake & Registration

The Workshop instances are dynamically discovered by the TS Office via a registration mechanism:
- **Startup Registration**: On startup, each Workshop instance sends a `POST /api/workshop/register` request to the HQ.
- **Capabilities**: The payload includes the Workshop's URL and its execution capabilities (e.g., `deer-flow`, `langgraph`).
- **Workshop Registry**: The TS Office maintains an in-memory `WorkshopRegistry` to track available execution cores.

## 📡 SSE Bridge (Streaming)

Real-time "thought-stream" broadcasting is achieved through an SSE proxy:
- **Workshop SSE**: The Workshop exposes an SSE endpoint `/api/v1/tasks/stream` providing real-time feedback from the execution engine.
- **HQ Proxy**: The TS Backend provides a proxy endpoint `/api/workshop/proxy-stream` that transparently forwards SSE events from the Workshop to the Frontend.
- **Transparency**: This allows the user interface to display the agent's reasoning process as it happens.

## ⚙️ Task Orchestration

Task routing is handled by the `DeerFlowRuntimeAdapter` in the TS Backend:
1.  **Discovery**: When a task with the `deerflow` executor is started, the adapter queries the `WorkshopRegistry`.
2.  **Routing**: It identifies a capable Workshop and forwards the task payload.
3.  **Persistence**: The adapter handles the streaming response and ensures the final result is persisted in the TS persistence layer (JSON/Postgres).

## 🛠️ Configuration

- **HQ_API_URL**: Environment variable in the Workshop pointing to the TS Backend.
- **PORT**: Environment variable to configure the Workshop's listening port.
- **WORKSHOP_URL**: Environment variable in the TS Backend (optional fallback for registration).
