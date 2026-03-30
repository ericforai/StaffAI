# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**The Agency** is a collection of AI agent specialists organized by domain (engineering, design, marketing, etc.). Each agent is a Markdown file with frontmatter metadata and structured content defining personality, workflows, and deliverables.

**The Agency HQ** (`hq/`) is a web dashboard for managing these agents via MCP (Model Context Protocol). It includes multi-agent discussion deck, task/approval/execution workspaces, and real-time WebSocket communication.

---

## Quick Start

```bash
# Start both backend (3333) and frontend (3008)
cd hq && ./start.sh

# Or start individually:
cd hq/backend && npm run build && npm run start:web        # port 3333
cd hq/frontend && PORT=3008 npm run dev                     # port 3008
```

---

## Development Commands

### Initial Setup
```bash
cd hq && ./setup.sh    # One-time setup: installs deps, generates runtime artifacts
```

### Backend (`hq/backend/`)
```bash
npm run build          # Compile TypeScript (cleans dist/ first)
npm run test           # Run all tests (build + node:test)
npm run start:web      # Start Express server (port 3333)
npm run dev:web        # Dev mode with ts-node
npm run start:mcp      # Start MCP server for Claude integration
```

### Frontend (`hq/frontend/`)
```bash
npm run dev            # Start Next.js dev server (port 8888, uses webpack)
npm run build          # Production build
npm run start          # Start production server
npm run test:e2e       # Run Playwright E2E tests (tests/e2e/)
```

### Environment Variables

**Backend:**
- `AGENCY_HOME` - Runtime state directory (default: `~/.agency`)
- `AGENCY_MCP_SAMPLING_POLICY` - Sampling mode: `client` (default) | `server` | `disabled`
- `AGENCY_USER_ID_HEADER` - User ID header for multi-tenancy (default: `x-user-id`)

**Frontend:**
- `NEXT_PUBLIC_BACKEND_PORT` - Backend port override (default: `3333`)
- `NEXT_PUBLIC_WS_URL` - WebSocket URL override (default: auto-detected)
- `NEXT_PUBLIC_API_URL` - API base URL override (default: auto-detected)

---

## Architecture

### Agent File Structure

Each agent (e.g., `engineering/frontend-developer.md`) follows this format:

```markdown
---
name: Agent Name
description: One-line specialty
color: blue
emoji: ???
vibe: Personality hook
---

## ?? Your Identity & Memory
(Who the agent is - persona sections)

## ?? Your Core Mission
(What the agent does - operational sections)

## ?? Critical Rules You Must Follow
(Domain-specific constraints)

## ?? Your Technical Deliverables
(Code examples, templates, frameworks)

## ?? Your Workflow Process
(Step-by-step methodology)
```

**Key**: Sections are grouped into **Persona** (Identity, Communication, Rules) vs **Operations** (Mission, Deliverables, Workflow). The `convert.sh` script uses this to split agents for different tools.

### HQ System Architecture

```
hq/
├── backend/
│   └── src/
│       ├── api/             # Express routes (agents, tasks, approvals, executions, discussions, runtime, memory)
│       ├── governance/      # Approval policy, risk assessment, audit logging, host policy
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

### Repository Pattern (Persistence Seam)

The persistence layer provides a seam between storage implementations:

- **File Repositories** (`file-repositories.ts`): JSON file storage for development
- **Memory Repositories**: In-memory storage for testing
- **Postgres Repositories** (`postgres-repositories.ts`): PostgreSQL for production

All repositories share common interfaces (`TaskRepository`, `ApprovalRepository`, `ExecutionRepository`, `TaskAssignmentRepository`, `WorkflowPlanRepository`), enabling storage swap without changing business logic.

### Risk Assessment & Approval Workflow

Tasks are evaluated for risk before execution:

- **Risk Levels**: LOW, MEDIUM, HIGH
- **Risk Factors**: Task type, execution mode, priority, keywords in description
- **Approval Required**: HIGH/MEDIUM risk tasks require approval before execution
- **Policy Rules**: Configurable via `RiskPolicyRule` in `governance/risk-assessment.ts`

### Smart Routing Algorithm

When `consult_the_agency` is called, the system:
1. Calculates match scores using weighted features (Name x10, ID x8, Description x2)
2. Checks active squad members first
3. If score < THRESHOLD (5), suggests hiring a better-matched inactive agent
4. Injects relevant knowledge base entries into the task context

### Runtime Architecture

The runtime system supports multi-host execution with capability detection:

- **Host Registry** (`hq/generated/registry/hosts.json`): Declares available executors (claude, codex, etc.) with capabilities
- **Dispatcher Runtime**: Routes execution requests to appropriate hosts based on task requirements
- **Runtime Adapter**: Abstracts host differences (sampling support, injection modes)
- **Capability Levels**: `full` (all features) vs `partial` (degraded execution with fallbacks)
- **Discovery API**: `GET /api/runtime/discovery` - scans system for available runtime hosts

**Sampling Policy** (`AGENCY_MCP_SAMPLING_POLICY`):
- `client` - Host's native sampling (preferred)
- `server` - HQ server-side sampling
- `disabled` - No sampling (direct prompts only)

### Knowledge System

- **File**: `hq/backend/company_knowledge.json`
- **Entry**: `{ task, agentId, resultSummary, timestamp }`
- **Limit**: 100 entries (oldest removed when exceeded)
- **Usage**: `searchKnowledge(query)` returns last 3 matching entries for context injection

### WebSocket Communication

Real-time updates flow through WebSocket events:

- **Dashboard Events**: Agent roster changes, task/approval/execution counts
- **Task Events**: Status changes, assignments, completions
- **Discussion Events**: Expert responses, completion status
- **Execution Events**: Trace updates, status changes

Frontend uses `useWebSocket` hook with auto-reconnect (3s delay).

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

## Type Safety Notes

- **Backend**: Uses strict TypeScript - no `any` types. Define interfaces in `types.ts`
- **Frontend**: React 19 with strict null checks. Ref components to <300 lines
- **Pattern**: Use `for...of` instead of `forEach`/`reduce` when dealing with union types (`T | null`) to avoid TypeScript inference issues
- **Validation**: Use Zod schemas for input validation at API boundaries

---

## Testing

### Backend Tests (Node.js built-in `node:test`)
- Location: `hq/backend/src/__tests__/`
- Test files must end in `.test.ts`
- Uses `node:test` + `assert` (no external framework)
- Set `AGENCY_UNDER_NODE_TEST=1` to detect test environment
- Run all: `npm run test` in `hq/backend/`
- Run single file: `node --test dist/__tests__/filename.test.js`
- Run matching tests: `npm run test -- --test-name-pattern="execution"`

### Frontend E2E Tests (Playwright)
- Location: `hq/frontend/tests/e2e/`
- Config: `playwright.config.ts`
- Run: `npm run test:e2e` in `hq/frontend/`
- Tests require frontend dev server running (auto-started by Playwright)

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
- `get_session_capabilities` - Check session capabilities and sampling support
- `probe_sampling_runtime` - Detect sampling support (handshake vs runtime)

---

## Adding a New Agent

1. Create file in appropriate category directory
2. Follow template in `CONTRIBUTING.md`
3. Include concrete code examples and success metrics
4. Run `./convert.sh <agent-file>` to generate tool-specific formats

---

## Common Patterns

### Zod Validation (Backend)

```typescript
import { z } from 'zod'

const schema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
})

const validated = schema.parse(input)
```

### Repository Interface

```typescript
export interface TaskRepository {
  list(): Promise<TaskRecord[]>;
  getById(taskId: string): Promise<TaskRecord | null>;
  save(task: TaskRecord): Promise<void>;
  update(taskId: string, updater: (task: TaskRecord) => TaskRecord): Promise<TaskRecord | null>;
}
```

### Immutable Updates

```typescript
// WRONG: Mutation
task.status = 'completed';

// CORRECT: Immutability
return { ...task, status: 'completed' };
```
