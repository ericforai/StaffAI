# 🎭 StaffAI Agent OS - Workspace Guide

Welcome to the **StaffAI Agent OS** project. This document serves as the primary technical reference for this workspace, replacing global memories with project-specific context.

## 🚀 Project Overview
StaffAI is an enterprise-grade AI Agent Operating System designed for reliable, scalable, and governed multi-agent orchestration. It connects a vast library of **144+ specialized agents** with a robust execution environment.

### 🏗️ Dual-Core Architecture
The system follows a "Management-Execution" separation model:
1.  **TS Office (The Orchestrator)**: TypeScript/Express-based backend (`hq/`) managing workflow planning, task routing, approvals, and state.
2.  **Python Workshop (The Executor)**: Python-based environment (`workshop/`) using `deer-flow` and LangGraph for high-performance tool execution and agentic reasoning in sandboxed environments.

---

## 🛠️ Tech Stack
- **Management Core (TS Office)**:
  - **Backend**: Node.js, TypeScript, Express, MCP (Model Context Protocol), WebSockets.
  - **Frontend**: React 19, Next.js, TailwindCSS.
  - **Storage**: PostgreSQL (Production), JSON File (Development), Redis (Cache), ChromaDB (Vector).
- **Execution Core (Python Workshop)**:
  - **Engine**: Python 3.10+, FastAPI, LangGraph, `deer-flow`.
  - **Isolation**: Docker-based physical sandboxing.
- **Integration**: SSE (Server-Sent Events) for real-time thought-stream "broadcasting".

---

## ⚡ Quick Start & Startup Commands

### 1. Full System Bootstrap
The easiest way to start the entire HQ (Backend + Frontend):
```bash
cd hq
./setup.sh  # One-time setup
./start.sh  # Starts Backend (3333) and Frontend (3008)
```

### 2. Manual Component Startup
- **TS Backend (Port 3333)**:
  ```bash
  cd hq/backend
  npm run dev:web  # Development mode
  # or
  npm run build && npm run start:web  # Production mode
  ```
- **TS Frontend (Port 3008)**:
  ```bash
  cd hq/frontend
  PORT=3008 npm run dev
  ```
- **Python Workshop (Port 8000 default)**:
  ```bash
  cd workshop
  python main.py
  ```

---

## 🧠 Core Concepts & Memory
- **L1/L2/L3 Memory Hierarchy**:
  - **L1 (Org)**: Global shared knowledge (RAG).
  - **L2 (Project)**: Shared context for a specific task/squad.
  - **L3 (Agent)**: Personal experience and "style" for each specialist.
- **HITL (Human-in-the-Loop)**: Mandatory approval chains for HIGH/MEDIUM risk tasks.
- **Squad Mode**: Collaborative agent groups (Coordinator, Executor, Critic).

---

## 📅 Iteration Direction (v1.0 Roadmap)
- **Phase 1: The Walking Skeleton**: Finalizing physical connectivity between TS Office and Python Workshop via `deer-flow`.
- **Governance & Budgeting**: Implementing real-time cost tracking and multi-level approval gates.
- **Atlas Visualization**: Real-time growth of the company knowledge graph and agent relationship map.

---

## 📋 Development Conventions
- **Agent Definitions**: Managed in `engineering/`, `design/`, etc. Use `./scripts/convert.sh` to update tool-specific integrations.
- **Repository Pattern**: All persistence goes through `hq/backend/src/persistence/` interfaces to allow swapping between File and DB storage.
- **Type Safety**: Strict TypeScript in backend; React 19 in frontend.
