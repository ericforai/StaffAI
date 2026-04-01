# AGENTS.md

This file provides guidance to Codex when working in `/Users/user/agency-agents`.

## Project Overview

**StaffAI** is an enterprise-grade AI Agent Operating System. It connects a library of **144+ specialized agents** with a robust, governed execution environment.

**The Agency HQ** (`hq/`) is the dual-core management orchestrator:
- **TS Office (Management)**: Handles intent clarification, task routing, approval gates, and state persistence.
- **Python Workshop (Execution)**: Handles high-performance tool execution via `deer-flow`.

## Current HQ Shape

HQ is a multi-agent Command Deck with a unified delivery flow:

1. **Intake & Clarification**: Advanced Wizard for turning vague ideas into detailed Specs.
2. **Implementation Planning**: Automated plan generation and multi-agent squad recommendation.
3. **Execution & HITL**: Real-time streaming of agent thoughts with automated high-risk action interception.
4. **Institutional Knowledge**: One-click "Save as Template" to build a Reuse Flywheel.

## Quick Start

```bash
# Full System Bootstrap
cd hq && ./start.sh

# Or Manual Start (Ports: Backend 3333, Frontend 3008)
cd hq/backend && npm run dev:web
cd hq/frontend && PORT=3008 npm run dev
```

## HQ Architecture & Services

```text
hq/
├── backend/src/
│   ├── orchestration/      # CORE: TaskLifecycleService, TaskOrchestrator, Intent Services
│   ├── governance/         # HITL: ApprovalServiceV2, RiskAssessment, AuditLogger
│   ├── runtime/            # EXECUTORS: RuntimeAdapters (Claude, Codex, OpenAI, DeerFlow)
│   ├── tools/              # CAPABILITIES: ToolGateway (High-risk interception logic)
│   ├── persistence/        # STORAGE: Repository Pattern (File & Postgres support)
│   ├── shared/             # DOMAIN: Task, Intent, and Template type definitions
│   └── api/                # ROUTES: Intents, Templates, Approvals, Tasks, Runtime
└── frontend/src/
    ├── app/tasks/[id]/     # Atomic Task Detail view (Overview, Plan, Artifacts tabs)
    ├── app/templates/      # Template Center UI
    ├── components/intent/  # Clarification, Design, and Plan Preview panels
    └── components/approvals/ # HITL: ApprovalDetailPanel
```

## Core Capabilities

- **End-to-End Requirement Delivery**: AI-guided flow from raw input to implementation plan.
- **Advanced HITL**: Automated interception of high-risk tool actions (e.g., `rm`, `write`) with breakpoint resumption.
- **Reuse Flywheel**: Save successful task patterns as templates for one-click instantiation.
- **Dual-Core SSE Bridge**: Real-time thought broadcasting from Python executors to TS dashboard.

## Unified Domain APIs

### 1. Intent (Requirement Drafts)
- `POST /api/intents`: Create raw draft
- `POST /api/intents/:id/clarify`: Iterative clarification
- `POST /api/intents/:id/confirm-design`: Lock in design summary
- `POST /api/intents/:id/create-task`: Instantiate formal TaskRecord

### 2. Governance & Approvals
- `POST /api/approvals/:id/approve`: Authorize and resume execution
- `POST /api/approvals/:id/reject`: Cancel blocked action

### 3. Knowledge & Templates
- `GET /api/templates`: Browse organization patterns
- `POST /api/tasks/:id/save-template`: Capture task as reusable asset
- `POST /api/templates/:id/create-task`: Quick-start from template

## Type Safety Notes

- **Strict Mode**: Backend and Frontend both enforce strict TypeScript.
- **Exhaustive Mapping**: `TaskType` additions must be mapped in `TaskLifecycleService` and `TaskOrchestrator`.
- **Domain Alignment**: Frontend types in `domain.ts` must exactly match backend `shared/` types.

## 🛠️ 核心执行协议：Conductor

所有涉及系统功能变更、代码编写或架构调整的任务，必须严格遵守 **Conductor 规格驱动协议**：

1. **规格先行 (Spec First)**：创建 `spec.md` 定义目标与成功标准。
2. **计划驱动 (Plan Driven)**：在 `plan.md` 中使用 `[ ]`, `[~]`, `[x]` 追踪原子任务。
3. **工程闭环 (Engineering Loop)**：执行 TDD，commit 后附加 `git notes` 审计摘要。
4. **验证与检查点 (Verification & Checkpoint)**：每个阶段结束需提出手动验证计划并获取用户确认。
5. **文档同步 (Doc Sync)**：轨道完成后同步更新 `product.md` 和 `tech-stack.md`。

---
Protocol details: `conductor/workflow.md`

## Updated Roadmap

- [x] Intent-based Task Creation Flow
- [x] Automated High-Risk Tool Interception
- [x] Template Reuse Flywheel
- [ ] Multi-turn Parallel Autonomy (L3)
- [ ] Real-time Cost/Token Analytics Dash
- [ ] Cross-Agent Shared Memory (L2) Graph
