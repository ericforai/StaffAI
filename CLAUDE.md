# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**The Agency** is a collection of AI agent specialists organized by domain (engineering, design, marketing, etc.). Each agent is a Markdown file with frontmatter metadata and structured content defining personality, workflows, and deliverables.

**The Agency HQ** (`hq/`) is a web dashboard for managing these agents via MCP (Model Context Protocol). It now includes both the multi-agent discussion deck and task/approval/execution workspaces.

---

## Quick Start

```bash
# Start both backend (3333) and frontend (3008)
cd hq && ./start.sh

# Or start individually:
cd hq/backend && npm run build && npm run start:web
cd hq/frontend && npm run dev
```

---

## Development Commands

### Backend (`hq/backend/`)
```bash
npm run build          # Compile TypeScript
npm run start:web     # Start Express server (port 3333)
npm run dev:web        # Dev mode with ts-node
npm run start:mcp      # Start MCP server for Claude integration
```

### Frontend (`hq/frontend/`)
```bash
npm run dev            # Start Next.js dev server (port 3008)
npm run build          # Production build
npm run start          # Start production server
npm run lint           # Run ESLint
```

---

## Architecture

### Agent File Structure

Each agent (e.g., `engineering/frontend-developer.md`) follows this format:

```markdown
---
name: Agent Name
description: One-line specialty
color: blue
emoji: 🎯
vibe: Personality hook
---

## 🧠 Your Identity & Memory
(Who the agent is - persona sections)

## 🎯 Your Core Mission
(What the agent does - operational sections)

## 🚨 Critical Rules You Must Follow
(Domain-specific constraints)

## 📋 Your Technical Deliverables
(Code examples, templates, frameworks)

## 🔄 Your Workflow Process
(Step-by-step methodology)
```

**Key**: Sections are grouped into **Persona** (Identity, Communication, Rules) vs **Operations** (Mission, Deliverables, Workflow). The `convert.sh` script uses this to split agents for different tools.

### HQ System Architecture

```
hq/
├── backend/
│   └── src/
│       ├── api/             # Express routes for tasks, approvals, executions, runtime, discussions
│       ├── governance/      # Approval policy and approval records
│       ├── memory/          # Memory retrieval and execution summary write-back
│       ├── observability/   # Dashboard, task, and discussion event publishers
│       ├── orchestration/   # Consult, discussion, staffing, and task workflows
│       ├── persistence/     # File/memory/postgres repository seams
│       ├── runtime/         # Execution services and executor adapters
│       ├── shared/          # Shared task/execution types
│       ├── mcp.ts           # MCP protocol and orchestration tools
│       ├── server.ts        # Composition root for Express + WebSocket dashboard server
│       ├── store.ts         # Squad/template/knowledge persistence facade
│       ├── scanner.ts       # Scans agent directories, builds agent registry
│       └── types.ts         # Shared TypeScript interfaces
│
└── frontend/
    └── src/
        ├── app/page.tsx             # Main dashboard
        ├── app/tasks/               # Task workspace and task detail
        ├── app/approvals/           # Approval queue
        ├── app/executions/          # Execution detail workspace
        ├── components/              # AgentCard, ActivityLog, DiscussionControlPanel, etc.
        ├── hooks/                   # useAgents, useWebSocket, task/approval/execution hooks
        ├── lib/                     # Event projection helpers
        └── utils/constants.ts       # WS_CONFIG, API_CONFIG, DEPT_MAP
```

### Smart Routing Algorithm

When `consult_the_agency` is called, the system:
1. Calculates match scores using weighted features (Name x10, ID x8, Description x2)
2. Checks active squad members first
3. If score < THRESHOLD (5), suggests hiring a better-matched inactive agent
4. Injects relevant knowledge base entries into the task context

### Knowledge System

- **File**: `hq/backend/company_knowledge.json`
- **Entry**: `{ task, agentId, resultSummary, timestamp }`
- **Limit**: 100 entries (oldest removed when exceeded)
- **Usage**: `searchKnowledge(query)` returns last 3 matching entries for context injection

---

## Agent Categories

- `engineering/` - Software development (frontend, backend, mobile, etc.)
- `design/` - UX/UI, graphics, accessibility
- `game-development/` - Game design, mechanics, engines
- `marketing/` - Growth, content, community
- `paid-media/` - Ads, acquisition, analytics
- `product/` - PM, strategy, roadmaps
- `project-management/` - Coordination, agile, delivery
- `testing/` - QA, automation, reliability
- `support/` - Ops, documentation, helpdesk
- `spatial-computing/` - AR/VR/XR
- `specialized/` - Unique specialists

---

## Adding a New Agent

1. Create file in appropriate category directory
2. Follow template in `CONTRIBUTING.md`
3. Include concrete code examples and success metrics
4. Run `./convert.sh <agent-file>` to generate tool-specific formats

---

## Type Safety Notes

- **Backend**: Uses strict TypeScript - no `any` types. Define interfaces in `types.ts`
- **Frontend**: React 19 with strict null checks. Ref components to <300 lines
- **Pattern**: Use `for...of` instead of `forEach`/`reduce` when dealing with union types (`T | null`) to avoid TypeScript inference issues

---

## MCP Integration

To use agents via MCP in Claude Code/Cursor, add to MCP settings:

```json
{
  "command": "node",
  "args": ["/path/to/agency-agents/hq/backend/dist/mcp-server.js"]
}
```

Available tools:
- `consult_the_agency` - Smart routing to best expert
- `manage_staff` - Hire/fire agents
- `report_task_result` - Save to knowledge base
- `find_experts` - Discover ranked experts for a topic
- `hire_experts` - Activate shortlisted experts
- `assign_expert_tasks` - Assign work to a selected expert set
- `expert_discussion` - Run the multi-expert discussion workflow
- `consult_<agent_id>` - Direct expert access
