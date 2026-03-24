# AGENTS.md

This file provides guidance to Codex when working in `/Users/user/agency-agents`.

## Project Overview

**The Agency** is a collection of AI agent specialists organized by domain.
Each agent is a Markdown file with frontmatter metadata and structured content for personality, workflow, and deliverables.

**The Agency HQ** (`hq/`) is the web dashboard for managing these agents via MCP and the web discussion APIs.

## Current HQ Shape

HQ now has two equally important entry points:

1. The Web UI, which is the primary multi-agent command deck.
2. MCP tools, which let Codex / Cursor clients call the same agency capabilities.

The Web UI is no longer a lightweight chat pane. It is a three-column command deck:

- left: squad storage, active roster, activity log
- center: talent pool and discovery
- right: discussion control console

## Quick Start

```bash
# Start both backend (3333) and frontend (3008)
cd hq && ./start.sh

# Or start individually
cd hq/backend && npm run build && npm run start:web
cd hq/frontend && npm run dev
```

## Development Commands

### Backend (`hq/backend/`)

```bash
npm run build       # Compile TypeScript
npm run start:web   # Start Express server (port 3333)
npm run dev:web     # Dev mode with ts-node
npm run start:mcp   # Start MCP server for Codex integration
```

### Frontend (`hq/frontend/`)

```bash
npm run dev         # Start Next.js dev server (port 3008)
npm run build       # Production build
npm run start       # Production server
npm run lint        # Run ESLint
```

## HQ Architecture

```text
hq/
├── backend/
│   └── src/
│       ├── mcp.ts              # MCP protocol and orchestration tools
│       ├── server.ts           # Express API, WebSocket broadcast, discussion routes
│       ├── discussion-service.ts
│       ├── store.ts            # squad, templates, knowledge
│       ├── scanner.ts          # Agent registry
│       └── types.ts
└── frontend/
    └── src/
        ├── app/page.tsx               # Main dashboard
        ├── components/                # AgentCard, DiscussionControlPanel, ActivityLog
        ├── hooks/                     # useAgents, useWebSocket, useDiscussionControl
        └── utils/constants.ts         # WS_CONFIG, API_CONFIG, DEPT_MAP
```

## What HQ Does Now

- `consult_the_agency` still handles smart routing and knowledge injection.
- The web discussion console can search experts, hire them, assign work, and run a real discussion.
- Templates can be saved and reused as discussion squads.
- Discussion execution can be routed through local CLI executors to save token cost.

## MCP Tools

Available tools include:

- `consult_the_agency`
- `manage_staff`
- `report_task_result`
- `find_experts`
- `hire_experts`
- `assign_expert_tasks`
- `expert_discussion`

## Web Discussion API

The dashboard uses the backend discussion service directly through:

- `POST /api/discussions/search`
- `POST /api/discussions/hire`
- `POST /api/discussions/run`
- `GET /api/startup-check`
- `GET /startup-check`

## Discussion Execution

The discussion service is designed around an executor layer rather than a fixed cloud API.

- Preferred path: local Claude Code / Codex CLI
- Optional fallback: OpenAI API
- Environment-driven selection is preferred over hardcoding a provider
- Main environment knobs:
  `AGENCY_DISCUSSION_EXECUTOR`, `AGENCY_DISCUSSION_CLAUDE_PATH`, `AGENCY_DISCUSSION_CODEX_PATH`, `AGENCY_DISCUSSION_TIMEOUT_MS`

## Agent File Structure

Each agent, such as `engineering/frontend-developer.md`, follows this pattern:

```markdown
---
name: Agent Name
description: One-line specialty
color: blue
emoji: 🎯
vibe: Personality hook
---

## 🧠 Your Identity & Memory
## 🎯 Your Core Mission
## 🚨 Critical Rules You Must Follow
## 📋 Your Technical Deliverables
## 🔄 Your Workflow Process
```

Sections are grouped into Persona versus Operations. The conversion scripts depend on that structure.

## Type Safety Notes

- Backend uses strict TypeScript.
- Frontend uses React 19 with strict null checks.
- Prefer `for...of` over `forEach` or `reduce` when dealing with nullable unions.

## Deferred TODO / Roadmap

These items are intentionally left for later:

- discussion history persistence and replay
- template rename/delete/tagging
- retry or replacement when an expert fails
- richer discussion progress visualization
- export discussion output to documents or tasks
- auth, rate limiting, and input validation

## MCP Setup Example

```json
{
  "command": "node",
  "args": ["/path/to/agency-agents/hq/backend/dist/mcp-server.js"]
}
```
