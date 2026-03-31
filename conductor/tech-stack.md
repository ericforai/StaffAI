# Tech Stack

## Management Core (TS Office)
- **Language**: TypeScript (v5.9+)
- **Runtime**: Node.js (Latest stable)
- **Framework**: Express (v5.2.1+)
- **Orchestration**: MCP (Model Context Protocol), WebSockets (ws), Intent Services (Brainstorming & Planning)
- **Storage**: PostgreSQL (Production), JSON File (Development), Redis (Cache)

## Execution Core (Python Workshop)
- **Language**: Python (v3.10+)
- **Runtime**: FastAPI, LangGraph
- **Engine**: `deer-flow` (Proprietary framework)
- **Isolation**: Docker-based sandboxing

## Frontend
- **Framework**: React 19, Next.js
- **Styling**: TailwindCSS
- **Connectivity**: SSE (Server-Sent Events) for real-time thought broadcasting

## Data & Intelligence
- **LLM**: GPT-4o (Default), Support for multi-model integration
- **Vector Database**: ChromaDB
- **Budgeting**: Singleton-based cost tracking with automatic shutoff

## Tool Integrations
- **IDE Support**: Claude Code, Gemini CLI, Cursor, Windsurf, Aider, GitHub Copilot.
